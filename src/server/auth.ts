/**
 * Phase-2 bridge auth.
 *
 * Today: a lightweight, server-side session mechanism that writes rows to the
 *        same `users` / `sessions` tables Better Auth will use later. We use
 *        a signed cookie (HMAC) pointing at a session row.
 *
 * Later: swap this module out for the Better Auth handlers. Callers only use
 *        `getCurrentUser()`, so the swap is a one-file change.
 *
 * This is intentionally simple — no passwords. Sign-in = "give us an email,
 * we create/fetch the user, issue a session." This is a **placeholder** until
 * Better Auth is wired.
 */

import "server-only";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { requireDb } from "@/db/client";
import { sessions, users, type User } from "@/db/schema";

const COOKIE_NAME = "wapi_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sessionSecret(): string {
  const s =
    process.env.SESSION_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    // Dev-only fallback so the app still runs locally without config.
    "dev-insecure-secret-change-me";
  return s;
}

function sign(token: string): string {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(token)
    .digest("hex")
    .slice(0, 32);
}

function encodeCookie(token: string): string {
  return `${token}.${sign(token)}`;
}

function decodeCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const [token, sig] = raw.split(".");
  if (!token || !sig) return null;
  const expected = sign(token);
  if (
    expected.length !== sig.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  )
    return null;
  return token;
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  const token = decodeCookie(raw);
  if (!token) return null;

  const db = requireDb();
  const row = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.token, token))
    .limit(1);

  const rec = row[0];
  if (!rec) return null;
  if (rec.expiresAt.getTime() < Date.now()) return null;
  return rec.user;
}

export async function signInWithEmail(input: {
  email: string;
  name?: string;
}): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("A valid email is required.");

  const db = requireDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let user = existing[0];
  if (!user) {
    const inserted = await db
      .insert(users)
      .values({ email, name: input.name?.trim() || null })
      .returning();
    user = inserted[0]!;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const hdrs = await headers();
  await db.insert(sessions).values({
    userId: user.id,
    token,
    expiresAt,
    userAgent: hdrs.get("user-agent") ?? null,
  });

  const store = await cookies();
  store.set(COOKIE_NAME, encodeCookie(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return user;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  const token = decodeCookie(raw);
  if (token) {
    try {
      const db = requireDb();
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {
      /* ignore */
    }
  }
  store.delete(COOKIE_NAME);
}
