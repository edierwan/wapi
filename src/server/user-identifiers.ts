import "server-only";
import { inArray, sql } from "drizzle-orm";
import { requireDb } from "@/db/client";
import { users, type User } from "@/db/schema";
import { parseLoginIdentifier } from "@/server/auth-identifiers";

export async function findUserByIdentifier(identifier: string): Promise<User | null> {
  const db = requireDb();
  const parsed = parseLoginIdentifier(identifier);
  const rows = await db
    .select()
    .from(users)
    .where(
      parsed.kind === "email"
        ? sql`lower(${users.email}) = ${parsed.email}`
        : inArray(users.phone, parsed.candidates),
    )
    .limit(1);

  return rows[0] ?? null;
}