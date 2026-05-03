import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireDb } from "@/db/client";
import {
  passwordResetSessions,
  phoneVerifications,
  users,
} from "@/db/schema";
import { invalidateSessionsForUser } from "@/server/auth";
import {
  generateOtpCode,
  hashOtpCode,
  isPlatformBrokerConfigured,
  sendOtpViaProvider,
} from "@/server/otp";
import { hashPassword } from "@/server/password";
import { findUserByIdentifier } from "@/server/user-identifiers";

const OTP_EXPIRES_MIN = Number(process.env.OTP_EXPIRES_MINUTES || 10);
const OTP_RESEND_COOLDOWN_S = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
const RESET_SESSION_TTL_MIN = 15;
const RESET_COOKIE = "wapi_password_reset";
const GENERIC_REQUEST_MESSAGE =
  "If the account exists, we sent a verification code to the registered phone.";
const GENERIC_VERIFY_ERROR = "Invalid or expired verification code.";

export type PasswordResetRequestResult = {
  ok: true;
  message: string;
  debugCode?: string;
};

export type PasswordResetVerifyResult =
  | { ok: true }
  | { ok: false; error: string };

export type PasswordResetCompleteResult =
  | { ok: true }
  | { ok: false; error: string };

export async function requestPasswordReset(
  identifier: string,
): Promise<PasswordResetRequestResult> {
  const user = await findUserByIdentifier(identifier);
  if (!user) {
    return { ok: true, message: GENERIC_REQUEST_MESSAGE };
  }

  if (!user.phone) {
    console.info("[password-reset] account exists but no phone is registered", {
      userId: user.id,
    });
    return { ok: true, message: GENERIC_REQUEST_MESSAGE };
  }

  const db = requireDb();
  const [latest] = await db
    .select()
    .from(phoneVerifications)
    .where(
      and(
        eq(phoneVerifications.userId, user.id),
        eq(phoneVerifications.phone, user.phone),
        eq(phoneVerifications.purpose, "password_reset"),
        isNull(phoneVerifications.verifiedAt),
      ),
    )
    .orderBy(desc(phoneVerifications.createdAt))
    .limit(1);

  if (latest) {
    const ageMs = Date.now() - latest.createdAt.getTime();
    if (ageMs < OTP_RESEND_COOLDOWN_S * 1000) {
      return { ok: true, message: GENERIC_REQUEST_MESSAGE };
    }
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60_000);

  const sendRes = await sendOtpViaProvider({
    phone: user.phone,
    code,
    purpose: "password_reset",
  });

  await db.insert(phoneVerifications).values({
    userId: user.id,
    phone: user.phone,
    codeHash,
    purpose: "password_reset",
    expiresAt,
    provider: isPlatformBrokerConfigured()
      ? "platform_broker"
      : process.env.OTP_PROVIDER || "whatsapp_gateway",
    providerMessageId: sendRes.providerMessageId,
  });

  if (!sendRes.ok) {
    console.error("[password-reset] failed to send password reset OTP", {
      userId: user.id,
      provider: isPlatformBrokerConfigured()
        ? "platform_broker"
        : process.env.OTP_PROVIDER || "whatsapp_gateway",
      error: sendRes.error,
    });
  }

  return {
    ok: true,
    message: GENERIC_REQUEST_MESSAGE,
    debugCode: sendRes.debugCode,
  };
}

export async function verifyPasswordResetOtp(input: {
  identifier: string;
  code: string;
}): Promise<PasswordResetVerifyResult> {
  const user = await findUserByIdentifier(input.identifier);
  if (!user?.phone) {
    return { ok: false, error: GENERIC_VERIFY_ERROR };
  }

  const db = requireDb();
  const [latest] = await db
    .select()
    .from(phoneVerifications)
    .where(
      and(
        eq(phoneVerifications.userId, user.id),
        eq(phoneVerifications.phone, user.phone),
        eq(phoneVerifications.purpose, "password_reset"),
        isNull(phoneVerifications.verifiedAt),
      ),
    )
    .orderBy(desc(phoneVerifications.createdAt))
    .limit(1);

  if (!latest) return { ok: false, error: GENERIC_VERIFY_ERROR };
  if (latest.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: GENERIC_VERIFY_ERROR };
  }
  if (latest.attempts >= latest.maxAttempts) {
    return { ok: false, error: "Too many attempts. Please request a new code." };
  }

  const codeHash = hashOtpCode(input.code.trim());
  if (codeHash !== latest.codeHash) {
    await db
      .update(phoneVerifications)
      .set({ attempts: latest.attempts + 1 })
      .where(eq(phoneVerifications.id, latest.id));
    return { ok: false, error: GENERIC_VERIFY_ERROR };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const resetTokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_SESSION_TTL_MIN * 60_000);

  await db.transaction(async (tx) => {
    await tx
      .update(phoneVerifications)
      .set({ verifiedAt: new Date() })
      .where(eq(phoneVerifications.id, latest.id));

    await tx.insert(passwordResetSessions).values({
      userId: user.id,
      phoneVerificationId: latest.id,
      resetTokenHash,
      expiresAt,
    });
  });

  const store = await cookies();
  store.set(RESET_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return { ok: true };
}

export async function getActivePasswordResetSession() {
  const store = await cookies();
  const rawToken = store.get(RESET_COOKIE)?.value;
  if (!rawToken) return null;

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const db = requireDb();
  const [row] = await db
    .select({
      id: passwordResetSessions.id,
      userId: passwordResetSessions.userId,
      expiresAt: passwordResetSessions.expiresAt,
      usedAt: passwordResetSessions.usedAt,
      email: users.email,
      phone: users.phone,
    })
    .from(passwordResetSessions)
    .innerJoin(users, eq(users.id, passwordResetSessions.userId))
    .where(eq(passwordResetSessions.resetTokenHash, tokenHash))
    .limit(1);

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return row;
}

export async function completePasswordReset(input: {
  password: string;
  confirmPassword: string;
}): Promise<PasswordResetCompleteResult> {
  if (!input.password || input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (input.password !== input.confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }

  const session = await getActivePasswordResetSession();
  if (!session) {
    return { ok: false, error: "Your reset session has expired. Please start again." };
  }

  const nextHash = await hashPassword(input.password);
  const db = requireDb();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: nextHash, updatedAt: new Date() })
      .where(eq(users.id, session.userId));

    await tx
      .update(passwordResetSessions)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetSessions.id, session.id));
  });

  await invalidateSessionsForUser(session.userId);
  const store = await cookies();
  store.delete(RESET_COOKIE);
  return { ok: true };
}

export async function clearPasswordResetCookie() {
  const store = await cookies();
  store.delete(RESET_COOKIE);
}

export async function getMaskedPasswordResetPhone(identifier: string): Promise<string | null> {
  const user = await findUserByIdentifier(identifier);
  if (!user?.phone) return null;
  return maskPhone(user.phone);
}

function maskPhone(phone: string): string {
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return cleaned;
  return `${cleaned.slice(0, 4)}${"*".repeat(Math.max(0, cleaned.length - 7))}${cleaned.slice(-3)}`;
}