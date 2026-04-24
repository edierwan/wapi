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
  WA_GATEWAY_URL: process.env.WA_GATEWAY_URL ?? "",
  WA_GATEWAY_SECRET: process.env.WA_GATEWAY_SECRET ?? "",
  OTP_PROVIDER: (process.env.OTP_PROVIDER as "whatsapp_gateway" | "dev_console" | undefined) ?? "whatsapp_gateway",
  OTP_EXPIRES_MINUTES: Number(process.env.OTP_EXPIRES_MINUTES ?? 10),
  OTP_RESEND_COOLDOWN_SECONDS: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 60),
  ENABLE_PUBLIC_REGISTRATION: process.env.ENABLE_PUBLIC_REGISTRATION === "true",
  ENABLE_DEV_EMAIL_LOGIN: process.env.ENABLE_DEV_EMAIL_LOGIN === "true",
  ENABLE_DEV_OTP_FALLBACK: process.env.ENABLE_DEV_OTP_FALLBACK === "true",
  DIFY_DEFAULT_BASE_URL: process.env.DIFY_DEFAULT_BASE_URL ?? "",
} as const;

export type AppEnv = typeof env;
