import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireDb } from "@/db/client";
import {
  refBrandVoices,
  refBusinessNatures,
  refCountries,
  refCurrencies,
  refIndustries,
  refLanguages,
  refTimezones,
  refUnits,
  type RefBrandVoice,
  type RefBusinessNature,
  type RefCountry,
  type RefCurrency,
  type RefIndustry,
  type RefLanguage,
  type RefTimezone,
  type RefUnit,
} from "@/db/schema";

const ACTIVE = "active";

/**
 * Reference / master data loaders. All return only `status='active'` rows
 * and are sorted by `(sortOrder, name)`.
 *
 * These are safe to call from server components and server actions.
 * No tenant scoping — reference data is global.
 */

export async function listActiveCountries(): Promise<RefCountry[]> {
  const db = requireDb();
  return db
    .select()
    .from(refCountries)
    .where(eq(refCountries.status, ACTIVE))
    .orderBy(asc(refCountries.sortOrder), asc(refCountries.name));
}

export async function listActiveCurrencies(): Promise<RefCurrency[]> {
  const db = requireDb();
  return db
    .select()
    .from(refCurrencies)
    .where(eq(refCurrencies.status, ACTIVE))
    .orderBy(asc(refCurrencies.sortOrder), asc(refCurrencies.code));
}

export async function listActiveLanguages(): Promise<RefLanguage[]> {
  const db = requireDb();
  return db
    .select()
    .from(refLanguages)
    .where(eq(refLanguages.status, ACTIVE))
    .orderBy(asc(refLanguages.sortOrder), asc(refLanguages.name));
}

export async function listActiveUnits(): Promise<RefUnit[]> {
  const db = requireDb();
  return db
    .select()
    .from(refUnits)
    .where(eq(refUnits.status, ACTIVE))
    .orderBy(asc(refUnits.sortOrder), asc(refUnits.code));
}

export async function listActiveTimezones(): Promise<RefTimezone[]> {
  const db = requireDb();
  return db
    .select()
    .from(refTimezones)
    .where(eq(refTimezones.status, ACTIVE))
    .orderBy(asc(refTimezones.sortOrder), asc(refTimezones.name));
}

export async function listActiveIndustries(): Promise<RefIndustry[]> {
  const db = requireDb();
  return db
    .select()
    .from(refIndustries)
    .where(eq(refIndustries.status, ACTIVE))
    .orderBy(asc(refIndustries.sortOrder), asc(refIndustries.name));
}

export async function listActiveBusinessNatures(): Promise<RefBusinessNature[]> {
  const db = requireDb();
  return db
    .select()
    .from(refBusinessNatures)
    .where(eq(refBusinessNatures.status, ACTIVE))
    .orderBy(asc(refBusinessNatures.sortOrder), asc(refBusinessNatures.name));
}

export async function listActiveBrandVoices(): Promise<RefBrandVoice[]> {
  const db = requireDb();
  return db
    .select()
    .from(refBrandVoices)
    .where(eq(refBrandVoices.status, ACTIVE))
    .orderBy(asc(refBrandVoices.sortOrder), asc(refBrandVoices.name));
}

/**
 * Bundle loader so onboarding (and other forms) can fetch everything in one
 * round trip. Tables are tiny and queries are independent.
 */
export async function loadOnboardingReferenceData() {
  const [
    countries,
    currencies,
    units,
    languages,
    timezones,
    industries,
    natures,
    voices,
  ] = await Promise.all([
    listActiveCountries(),
    listActiveCurrencies(),
    listActiveUnits(),
    listActiveLanguages(),
    listActiveTimezones(),
    listActiveIndustries(),
    listActiveBusinessNatures(),
    listActiveBrandVoices(),
  ]);
  return { countries, currencies, units, languages, timezones, industries, natures, voices };
}

/**
 * Validate that an arbitrary set of ref-table IDs exist and are active.
 * Returns the list of IDs that are missing or inactive, so the caller can
 * surface a precise error.
 *
 * Pass only the IDs you actually use. Any `null`/`undefined` is skipped.
 */
export async function validateActiveRefIds(input: {
  countryId?: string | null;
  currencyId?: string | null;
  languageId?: string | null;
  timezoneId?: string | null;
  industryId?: string | null;
  businessNatureId?: string | null;
  brandVoiceId?: string | null;
}): Promise<{ ok: boolean; invalid: string[] }> {
  const db = requireDb();
  const invalid: string[] = [];

  const checks: Array<[string, string | null | undefined, () => Promise<boolean>]> = [
    ["countryId", input.countryId, async () => {
      if (!input.countryId) return true;
      const r = await db.select({ id: refCountries.id }).from(refCountries)
        .where(and(eq(refCountries.id, input.countryId), eq(refCountries.status, ACTIVE))).limit(1);
      return r.length > 0;
    }],
    ["currencyId", input.currencyId, async () => {
      if (!input.currencyId) return true;
      const r = await db.select({ id: refCurrencies.id }).from(refCurrencies)
        .where(and(eq(refCurrencies.id, input.currencyId), eq(refCurrencies.status, ACTIVE))).limit(1);
      return r.length > 0;
    }],
    ["languageId", input.languageId, async () => {
      if (!input.languageId) return true;
      const r = await db.select({ id: refLanguages.id }).from(refLanguages)
        .where(and(eq(refLanguages.id, input.languageId), eq(refLanguages.status, ACTIVE))).limit(1);
      return r.length > 0;
    }],
    ["timezoneId", input.timezoneId, async () => {
      if (!input.timezoneId) return true;
      const r = await db.select({ id: refTimezones.id }).from(refTimezones)
        .where(and(eq(refTimezones.id, input.timezoneId), eq(refTimezones.status, ACTIVE))).limit(1);
      return r.length > 0;
    }],
    ["industryId", input.industryId, async () => {
      if (!input.industryId) return true;
      const r = await db.select({ id: refIndustries.id }).from(refIndustries)
        .where(and(eq(refIndustries.id, input.industryId), eq(refIndustries.status, ACTIVE))).limit(1);
      return r.length > 0;
    }],
    ["businessNatureId", input.businessNatureId, async () => {
      if (!input.businessNatureId) return true;
      const r = await db.select({ id: refBusinessNatures.id }).from(refBusinessNatures)
        .where(and(eq(refBusinessNatures.id, input.businessNatureId), eq(refBusinessNatures.status, ACTIVE))).limit(1);
      return r.length > 0;
    }],
    ["brandVoiceId", input.brandVoiceId, async () => {
      if (!input.brandVoiceId) return true;
      const r = await db.select({ id: refBrandVoices.id }).from(refBrandVoices)
        .where(and(eq(refBrandVoices.id, input.brandVoiceId), eq(refBrandVoices.status, ACTIVE))).limit(1);
      return r.length > 0;
    }],
  ];

  for (const [name, val, check] of checks) {
    if (!val) continue;
    const ok = await check();
    if (!ok) invalid.push(name);
  }

  // silence unused-import linter for inArray helper kept for future bulk uses
  void inArray;

  return { ok: invalid.length === 0, invalid };
}
