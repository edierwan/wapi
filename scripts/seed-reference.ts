/**
 * Seed reference / master-data tables (idempotent).
 *
 * Runs the SQL file `scripts/sql/0002_seed_reference_data.sql` against
 * DATABASE_URL. Safe to run repeatedly — uses INSERT ... ON CONFLICT DO UPDATE.
 *
 * Reads (REQUIRED):
 *   - DATABASE_URL
 *
 *   pnpm db:seed:reference
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Pool } from "pg";

for (const envFile of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), envFile);
  if (existsSync(p)) dotenv.config({ path: p, override: false });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  const sqlPath = path.resolve(
    process.cwd(),
    "scripts/sql/0002_seed_reference_data.sql",
  );
  if (!existsSync(sqlPath)) {
    console.error(`Seed SQL not found: ${sqlPath}`);
    process.exit(1);
  }
  const sql = readFileSync(sqlPath, "utf8");
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(sql);
    const counts = await pool.query<{
      countries: string;
      currencies: string;
      languages: string;
      timezones: string;
      industries: string;
      natures: string;
      voices: string;
    }>(
      `SELECT
         (SELECT count(*) FROM ref_countries)         AS countries,
         (SELECT count(*) FROM ref_currencies)        AS currencies,
         (SELECT count(*) FROM ref_languages)         AS languages,
         (SELECT count(*) FROM ref_timezones)         AS timezones,
         (SELECT count(*) FROM ref_industries)        AS industries,
         (SELECT count(*) FROM ref_business_natures)  AS natures,
         (SELECT count(*) FROM ref_brand_voices)      AS voices`,
    );
    console.log("[seed:reference] applied. counts:", counts.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[seed:reference] failed:", err);
  process.exit(1);
});
