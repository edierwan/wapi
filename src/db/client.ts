/**
 * Drizzle client (Phase 1 skeleton).
 *
 * We lazily create a single pg client only when DATABASE_URL is set.
 * In Phase 1 nothing in the UI uses this — it exists so Phase 2
 * migrations and auth can plug in immediately without restructuring.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __wapi_pg_pool__: Pool | undefined;
}

function getPool(): Pool | null {
  if (!env.DATABASE_URL) return null;
  if (!global.__wapi_pg_pool__) {
    global.__wapi_pg_pool__ = new Pool({
      connectionString: env.DATABASE_URL,
      max: 5,
    });
  }
  return global.__wapi_pg_pool__;
}

export function getDb() {
  const pool = getPool();
  if (!pool) return null;
  return drizzle(pool);
}
