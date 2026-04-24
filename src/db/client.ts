/**
 * Drizzle client.
 * Single pg Pool per Node process. Only instantiated when DATABASE_URL is set.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __wapi_pg_pool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __wapi_db__: NodePgDatabase<typeof schema> | undefined;
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

export function getDb(): NodePgDatabase<typeof schema> | null {
  if (!global.__wapi_db__) {
    const pool = getPool();
    if (!pool) return null;
    global.__wapi_db__ = drizzle(pool, { schema });
  }
  return global.__wapi_db__ ?? null;
}

/** Throws if DATABASE_URL is not set. Use where the DB is required. */
export function requireDb(): NodePgDatabase<typeof schema> {
  const db = getDb();
  if (!db) {
    throw new Error(
      "DATABASE_URL is not configured. Set it in your .env or Coolify env.",
    );
  }
  return db;
}

export { schema };
