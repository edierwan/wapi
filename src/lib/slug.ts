/**
 * Tenant slug rules.
 *
 *  - lowercase letters, numbers, and hyphens only
 *  - 1..63 chars
 *  - no leading or trailing hyphen
 *  - no double hyphens in a row (keeps it DNS-friendly for future subdomains)
 *  - must not be a reserved word
 */

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "app",
  "api",
  "www",
  "admin",
  "root",
  "mail",
  "smtp",
  "webhook",
  "status",
  "support",
  "billing",
  "assets",
  "cdn",
  "auth",
  "login",
  "register",
  "dashboard",
  "monitor",
  "grafana",
  "n8n",
  "dify",
  "coolify",
  "traefik",
  "wapi",
  "wapi-dev",
  "wapi-api",
  "wapi-webhook",
  "wapi-worker",
  "wapi-admin",
  // paths we use in this app
  "t",
  "health",
  "access-denied",
  "workspace-not-found",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type SlugCheck =
  | { ok: true; slug: string }
  | { ok: false; reason: string };

export function validateSlug(input: string): SlugCheck {
  const slug = input.trim().toLowerCase();
  if (!slug) return { ok: false, reason: "Slug is required." };
  if (slug.length > 63)
    return { ok: false, reason: "Slug must be 63 characters or fewer." };
  if (slug.startsWith("-") || slug.endsWith("-"))
    return { ok: false, reason: "Slug cannot start or end with a hyphen." };
  if (slug.includes("--"))
    return { ok: false, reason: "Slug cannot contain consecutive hyphens." };
  if (!SLUG_RE.test(slug))
    return {
      ok: false,
      reason: "Slug may only contain lowercase letters, numbers, and hyphens.",
    };
  if (RESERVED_SLUGS.has(slug))
    return { ok: false, reason: "That slug is reserved. Please choose another." };
  return { ok: true, slug };
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}
