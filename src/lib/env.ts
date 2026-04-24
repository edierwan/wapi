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
} as const;

export type AppEnv = typeof env;
