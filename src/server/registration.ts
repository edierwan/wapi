import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { requireDb } from "@/db/client";
import {
  pendingRegistrations,
  phoneVerifications,
  tenantBusinessProfiles,
  tenantMembers,
  tenantSettings,
  tenants,
  users,
  type PendingRegistration,
  type User,
} from "@/db/schema";
import { hashPassword } from "./password";
import { issueSessionForUser } from "./auth";
import {
  generateOtpCode,
  hashOtpCode,
  sendOtpViaProvider,
  type OtpSendResult,
} from "./otp";
import { deriveSlugCandidate, isValidPhoneE164, normalisePhone } from "@/lib/phone";
import { RESERVED_SLUGS } from "@/lib/slug";
import { normaliseMalaysiaPhone } from "@/server/auth-identifiers";

const OTP_EXPIRES_MIN = Number(process.env.OTP_EXPIRES_MINUTES || 10);
const OTP_RESEND_COOLDOWN_S = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
const PENDING_TTL_MIN = 30;

function resolveOtpProviderName(): string {
  return process.env.USE_PLATFORM_BROKER === "true"
    ? "platform_broker"
    : process.env.OTP_PROVIDER || "whatsapp_gateway";
}

export type StartRegistrationInput = {
  businessName: string;
  fullName: string;
  email: string;
  phoneCountryCode: string; // e.g. "+60"
  phoneNumber: string; // local part
  password: string;
  confirmPassword: string;
  businessNature?: string | null;
  numberOfAgents?: number | null;
};

export type StartRegistrationResult =
  | {
      ok: true;
      pendingId: string;
      phone: string;
      debugCode?: string;
      gatewayMessage?: string;
    }
  | { ok: false; error: string; field?: string };

function ensurePublicRegistrationEnabled(): string | null {
  // In production we require the explicit flag. In dev we always allow.
  const flag = process.env.ENABLE_PUBLIC_REGISTRATION === "true";
  if (!flag && process.env.NODE_ENV === "production") {
    return "Public registration is not open yet.";
  }
  return null;
}

export async function startRegistration(
  input: StartRegistrationInput,
): Promise<StartRegistrationResult> {
  const gate = ensurePublicRegistrationEnabled();
  if (gate) return { ok: false, error: gate };

  // ── basic validation ────────────────────────────────────────────────
  const businessName = input.businessName.trim();
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!businessName) return { ok: false, error: "Business name required.", field: "businessName" };
  if (!fullName) return { ok: false, error: "Your name is required.", field: "fullName" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "Valid email required.", field: "email" };
  if (!password || password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters.", field: "password" };
  if (password !== input.confirmPassword)
    return { ok: false, error: "Passwords do not match.", field: "confirmPassword" };

  const phone = normaliseRegistrationPhone(
    input.phoneCountryCode || "+60",
    input.phoneNumber || "",
  );
  if (!isValidPhoneE164(phone))
    return { ok: false, error: "Phone number looks invalid.", field: "phoneNumber" };

  // ── duplicate email check ──────────────────────────────────────────
  const db = requireDb();
  const dupe = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (dupe.length) {
    return { ok: false, error: "An account with this email already exists.", field: "email" };
  }

  // ── slug candidate ─────────────────────────────────────────────────
  const slugCandidate = deriveSlugCandidate(businessName, phone);

  // ── pending registration ───────────────────────────────────────────
  const passwordHash = await hashPassword(password);
  const expiresAt = new Date(Date.now() + PENDING_TTL_MIN * 60_000);

  const [pending] = await db
    .insert(pendingRegistrations)
    .values({
      businessName,
      fullName,
      email,
      phone,
      passwordHash,
      businessNature: input.businessNature ?? null,
      numberOfAgents: input.numberOfAgents ?? null,
      tenantSlugCandidate: slugCandidate,
      expiresAt,
    })
    .returning();

  // ── OTP record ─────────────────────────────────────────────────────
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const otpExpires = new Date(Date.now() + OTP_EXPIRES_MIN * 60_000);

  const sendRes: OtpSendResult = await sendOtpViaProvider({
    phone,
    code,
    purpose: "register",
    businessName,
  });

  await db.insert(phoneVerifications).values({
    pendingRegistrationId: pending.id,
    phone,
    codeHash,
    purpose: "register",
    expiresAt: otpExpires,
    provider: resolveOtpProviderName(),
    providerMessageId: sendRes.providerMessageId,
  });

  if (!sendRes.ok) {
    // Keep the pending row around — the user might retry — but surface a clear error.
    return {
      ok: false,
      error:
        sendRes.error ??
        "Could not send OTP via WhatsApp. Please check your number and try again.",
    };
  }

  return {
    ok: true,
    pendingId: pending.id,
    phone,
    debugCode: sendRes.debugCode,
  };
}

export async function resendRegistrationOtp(
  pendingId: string,
): Promise<StartRegistrationResult> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(pendingRegistrations)
    .where(eq(pendingRegistrations.id, pendingId))
    .limit(1);
  const pending = rows[0];
  if (!pending) return { ok: false, error: "Registration not found." };
  if (pending.verifiedAt) return { ok: false, error: "Already verified." };

  // cooldown: find newest phone_verification for this pending
  const latest = await db
    .select()
    .from(phoneVerifications)
    .where(eq(phoneVerifications.pendingRegistrationId, pendingId))
    .orderBy(sql`${phoneVerifications.createdAt} desc`)
    .limit(1);
  const last = latest[0];
  if (last) {
    const ageMs = Date.now() - last.createdAt.getTime();
    if (ageMs < OTP_RESEND_COOLDOWN_S * 1000) {
      const waitS = Math.ceil((OTP_RESEND_COOLDOWN_S * 1000 - ageMs) / 1000);
      return { ok: false, error: `Please wait ${waitS}s before resending.` };
    }
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60_000);

  const sendRes = await sendOtpViaProvider({
    phone: pending.phone,
    code,
    purpose: "register",
    businessName: pending.businessName,
  });

  await db.insert(phoneVerifications).values({
    pendingRegistrationId: pending.id,
    phone: pending.phone,
    codeHash,
    purpose: "register",
    expiresAt,
    provider: resolveOtpProviderName(),
    providerMessageId: sendRes.providerMessageId,
  });

  if (!sendRes.ok) {
    return { ok: false, error: sendRes.error ?? "Failed to send OTP." };
  }
  return {
    ok: true,
    pendingId: pending.id,
    phone: pending.phone,
    debugCode: sendRes.debugCode,
  };
}

export type VerifyOtpResult =
  | { ok: true; tenantSlug: string; userId: string }
  | { ok: false; error: string };

export async function verifyOtpAndCreateAccount(input: {
  pendingId: string;
  code: string;
}): Promise<VerifyOtpResult> {
  const db = requireDb();
  const pending = (
    await db
      .select()
      .from(pendingRegistrations)
      .where(eq(pendingRegistrations.id, input.pendingId))
      .limit(1)
  )[0];
  if (!pending) return { ok: false, error: "Registration not found." };
  if (pending.verifiedAt) return { ok: false, error: "Already verified." };
  if (pending.expiresAt.getTime() < Date.now())
    return { ok: false, error: "This registration has expired. Please start again." };

  // Take the newest unexpired verification row for this pending
  const latest = (
    await db
      .select()
      .from(phoneVerifications)
      .where(
        and(
          eq(phoneVerifications.pendingRegistrationId, pending.id),
          isNull(phoneVerifications.verifiedAt),
        ),
      )
      .orderBy(sql`${phoneVerifications.createdAt} desc`)
      .limit(1)
  )[0];
  if (!latest) return { ok: false, error: "No active OTP. Please request a new one." };
  if (latest.expiresAt.getTime() < Date.now())
    return { ok: false, error: "OTP expired. Please request a new one." };
  if (latest.attempts >= latest.maxAttempts)
    return { ok: false, error: "Too many attempts. Please request a new OTP." };

  const codeHash = hashOtpCode(input.code.trim());
  if (codeHash !== latest.codeHash) {
    await db
      .update(phoneVerifications)
      .set({ attempts: latest.attempts + 1 })
      .where(eq(phoneVerifications.id, latest.id));
    return { ok: false, error: "Incorrect code." };
  }

  // ── Create user + tenant ────────────────────────────────────────────
  const slug = await resolveAvailableSlug(pending.tenantSlugCandidate, pending.phone);

  const [user] = await db
    .insert(users)
    .values({
      email: pending.email,
      name: pending.fullName,
      phone: pending.phone,
      passwordHash: pending.passwordHash,
      phoneVerified: true,
      emailVerified: false,
      status: "active",
    })
    .returning();

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: pending.businessName,
      slug,
      status: "trial",
    })
    .returning();

  await db.insert(tenantMembers).values({
    tenantId: tenant.id,
    userId: user.id,
    role: "owner",
    status: "active",
  });

  await db.insert(tenantSettings).values({
    tenantId: tenant.id,
    businessName: pending.businessName,
  });

  await db.insert(tenantBusinessProfiles).values({
    tenantId: tenant.id,
    businessNature: (pending.businessNature as
      | "product"
      | "service"
      | "hybrid"
      | "booking"
      | "lead_gen"
      | "support"
      | "other") || "other",
    primaryPhone: pending.phone,
  });

  await db
    .update(phoneVerifications)
    .set({ verifiedAt: new Date() })
    .where(eq(phoneVerifications.id, latest.id));

  await db
    .update(pendingRegistrations)
    .set({ verifiedAt: new Date() })
    .where(eq(pendingRegistrations.id, pending.id));

  await issueSessionForUser(user.id);

  return { ok: true, tenantSlug: tenant.slug, userId: user.id };
}

async function resolveAvailableSlug(
  candidate: string,
  phone: string,
): Promise<string> {
  const db = requireDb();
  const tryOne = async (s: string) => {
    if (RESERVED_SLUGS.has(s)) return false;
    const hit = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, s))
      .limit(1);
    return hit.length === 0;
  };

  const base = candidate || "wa" + phone.replace(/\D+/g, "").slice(-10);
  if (await tryOne(base)) return base;
  for (let i = 2; i < 50; i++) {
    const s = `${base}-${i}`.slice(0, 63);
    if (await tryOne(s)) return s;
  }
  // Final fallback — always unique
  return `${base}-${Date.now().toString(36)}`.slice(0, 63);
}

export type { PendingRegistration, User };

function normaliseRegistrationPhone(countryCode: string, localNumber: string): string {
  const ccDigits = (countryCode || "+60").replace(/\D+/g, "");
  const localDigits = (localNumber || "").replace(/\D+/g, "").replace(/^0+/, "");
  return normalisePhone(`+${ccDigits}${localDigits}`) || normaliseMalaysiaPhone(`+${ccDigits}${localDigits}`);
}
