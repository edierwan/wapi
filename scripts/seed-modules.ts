/**
 * Seed module catalog + industry presets (idempotent).
 *
 *   pnpm db:seed:modules
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";

for (const envFile of [".env.local", ".env"]) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), "scripts/sql/0003_seed_modules.sql");
  if (!existsSync(sqlPath)) {
    console.error(`Seed SQL not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = readFileSync(sqlPath, "utf8");
  const pool = new Pool({ connectionString: url });

  try {
    await pool.query(sql);
    const counts = await pool.query<{
      modules: string;
      presets: string;
      tenantModules: string;
    }>(`
      SELECT
        (SELECT count(*) FROM modules) AS modules,
        (SELECT count(*) FROM industry_module_presets) AS presets,
        (SELECT count(*) FROM tenant_modules) AS tenant_modules
    `);
    console.log("[seed:modules] applied. counts:", counts.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed:modules] failed:", err);
  process.exit(1);
});