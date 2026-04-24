import { RESERVED_SLUGS, validateSlug } from "./slug";

/**
 * Normalise a phone number to a simple E.164-ish form: "+" + digits only.
 * We do not use a heavy phone lib in MVP. If the user provided only digits,
 * assume the supplied country code is already included or will be added by
 * the caller (registration flow prepends +60 when country picker is MY).
 */
export function normalisePhone(raw: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return "";
  return plus + digits;
}

/** Lightweight E.164 check — `+` then 7–15 digits. */
export function isValidPhoneE164(phone: string): boolean {
  return /^\+\d{7,15}$/.test(phone);
}

/**
 * Derive a slug candidate from a business name.
 * Falls back to `wa{phoneDigits}` if the derived slug is empty, reserved, or
 * fails slug rules.
 */
export function deriveSlugCandidate(
  businessName: string,
  phoneDigitsFallback: string,
): string {
  const base = (businessName || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 63)
    .replace(/^-+|-+$/g, "");

  if (base && !RESERVED_SLUGS.has(base) && validateSlug(base).ok) {
    return base;
  }

  const digits = (phoneDigitsFallback || "").replace(/\D+/g, "").slice(-10);
  const fallback = `wa${digits || Math.floor(Math.random() * 1e10)}`;
  return fallback.slice(0, 63);
}
