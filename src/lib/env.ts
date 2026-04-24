/**
 * Typed, minimal env accessor.
 * Only fields used in Phase 1 are required; everything else is optional.
 */
const APP_ENV_RAW = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "development";

export const env = {
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "WAPI",
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  APP_ENV: (APP_ENV_RAW as "production" | "development" | "preview"),
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  NODE_ENV: (process.env.NODE_ENV ?? "development") as "production" | "development" | "test",
  TENANT_ROUTING_MODE:
    (process.env.TENANT_ROUTING_MODE as "path" | "subdomain" | undefined) ?? "path",
  SESSION_SECRET:
    process.env.SESSION_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "",
  WA_GATEWAY_DEFAULT_URL: process.env.WA_GATEWAY_DEFAULT_URL ?? "",
  DIFY_DEFAULT_BASE_URL: process.env.DIFY_DEFAULT_BASE_URL ?? "",
} as const;

export type AppEnv = typeof env;
