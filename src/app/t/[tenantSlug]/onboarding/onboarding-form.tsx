"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Country = {
  id: string;
  iso2Code: string;
  name: string;
  defaultCurrencyCode: string | null;
  defaultLanguageCode: string | null;
  defaultTimezone: string | null;
};
type Currency = { id: string; code: string; name: string; symbol: string | null };
type Language = { id: string; code: string; name: string; nativeName: string | null };
type Timezone = { id: string; name: string; label: string };
type Industry = { id: string; code: string; name: string; description: string | null };
type BusinessNature = { id: string; code: string; name: string; description: string | null };
type BrandVoice = {
  id: string;
  code: string;
  name: string;
  description: string | null;
};

export type OnboardingDefaults = {
  countryId: string | null;
  currencyId: string | null;
  languageId: string | null;
  timezoneId: string | null;
  industryId: string | null;
  businessNatureId: string | null;
  brandVoiceId: string | null;
  brandVoiceCustom: string | null;
  primaryPhone: string | null;
  supportEmail: string | null;
  websiteUrl: string | null;
  industryFreeText: string | null;
  // Legacy enum value (product, service, ...).
  legacyBusinessNature: string | null;
};

export type OnboardingRefData = {
  countries: Country[];
  currencies: Currency[];
  languages: Language[];
  timezones: Timezone[];
  industries: Industry[];
  natures: BusinessNature[];
  voices: BrandVoice[];
};

// Map a ref_business_natures.code → legacy `business_nature` enum value the
// existing tenant_business_profiles.business_nature column accepts.
const NATURE_CODE_TO_LEGACY: Record<string, string> = {
  product: "product",
  service: "service",
  hybrid: "hybrid",
  booking: "booking",
  lead_generation: "lead_gen",
  support_helpdesk: "support",
  other: "other",
};

export function OnboardingForm({
  ref,
  defaults,
}: {
  ref: OnboardingRefData;
  defaults: OnboardingDefaults;
}) {
  // Compute initial selections. If FK ids are missing, derive from defaults
  // or fall back to Malaysia.
  const malaysia = ref.countries.find((c) => c.iso2Code === "MY") ?? ref.countries[0];
  const initialCountryId = defaults.countryId ?? malaysia?.id ?? "";

  const [countryId, setCountryId] = useState(initialCountryId);
  const [currencyId, setCurrencyId] = useState(
    defaults.currencyId ??
      currencyFromCountry(ref.currencies, malaysia ?? null) ??
      "",
  );
  const [languageId, setLanguageId] = useState(
    defaults.languageId ??
      languageFromCountry(ref.languages, malaysia ?? null) ??
      "",
  );
  const [timezoneId, setTimezoneId] = useState(
    defaults.timezoneId ??
      timezoneFromCountry(ref.timezones, malaysia ?? null) ??
      "",
  );
  const [industryId, setIndustryId] = useState(defaults.industryId ?? "");
  const [natureId, setNatureId] = useState(
    defaults.businessNatureId ??
      ref.natures.find((n) => n.code === "service")?.id ??
      "",
  );
  const [voiceId, setVoiceId] = useState(defaults.brandVoiceId ?? "");
  const [voiceCustom, setVoiceCustom] = useState(defaults.brandVoiceCustom ?? "");

  const selectedCountry = useMemo(
    () => ref.countries.find((c) => c.id === countryId) ?? null,
    [ref.countries, countryId],
  );
  const selectedNature = useMemo(
    () => ref.natures.find((n) => n.id === natureId) ?? null,
    [ref.natures, natureId],
  );
  const selectedCurrency = useMemo(
    () => ref.currencies.find((c) => c.id === currencyId) ?? null,
    [ref.currencies, currencyId],
  );
  const selectedLanguage = useMemo(
    () => ref.languages.find((l) => l.id === languageId) ?? null,
    [ref.languages, languageId],
  );
  const selectedTimezone = useMemo(
    () => ref.timezones.find((t) => t.id === timezoneId) ?? null,
    [ref.timezones, timezoneId],
  );

  function onCountryChange(newId: string) {
    setCountryId(newId);
    const c = ref.countries.find((x) => x.id === newId);
    if (!c) return;
    // Auto-fill cascade — only when a default code is present.
    const cur = ref.currencies.find((x) => x.code === c.defaultCurrencyCode);
    if (cur) setCurrencyId(cur.id);
    const lang = ref.languages.find((x) => x.code === c.defaultLanguageCode);
    if (lang) setLanguageId(lang.id);
    const tz = ref.timezones.find((x) => x.name === c.defaultTimezone);
    if (tz) setTimezoneId(tz.id);
  }

  // Derive the legacy enum value (required by existing column).
  const legacyNature = selectedNature
    ? NATURE_CODE_TO_LEGACY[selectedNature.code] ?? "other"
    : defaults.legacyBusinessNature ?? "service";

  return (
    <>
      {/* Hidden mirrors so the existing server action receives both old + new. */}
      <input type="hidden" name="businessNature" value={legacyNature} />
      <input type="hidden" name="businessNatureId" value={natureId} />
      <input type="hidden" name="industryId" value={industryId} />
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="currencyId" value={currencyId} />
      <input type="hidden" name="languageId" value={languageId} />
      <input type="hidden" name="timezoneId" value={timezoneId} />
      <input type="hidden" name="brandVoiceId" value={voiceId} />
      <input
        type="hidden"
        name="primaryCountry"
        value={selectedCountry?.iso2Code ?? "MY"}
      />
      <input
        type="hidden"
        name="defaultCurrency"
        value={selectedCurrency?.code ?? "MYR"}
      />
      <input
        type="hidden"
        name="defaultLanguage"
        value={selectedLanguage?.code ?? "en"}
      />
      <input
        type="hidden"
        name="timezone"
        value={selectedTimezone?.name ?? "Asia/Kuala_Lumpur"}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business nature</CardTitle>
          <CardDescription>
            Pick the closest match. Gates which setup modules appear.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {ref.natures.map((n) => (
            <label
              key={n.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 transition hover:border-[var(--primary)]/50 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]"
            >
              <input
                type="radio"
                name="natureRadio"
                value={n.id}
                checked={natureId === n.id}
                onChange={() => setNatureId(n.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{n.name}</span>
                {n.description ? (
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    {n.description}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
          <CardDescription>
            Used for AI tone, number formatting, and default language.
            Choosing a country auto-fills currency, language, and timezone —
            you can still override.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Industry"
            value={industryId}
            onChange={setIndustryId}
            placeholder="Select industry…"
            options={ref.industries.map((i) => ({
              value: i.id,
              label: i.name,
              hint: i.description ?? undefined,
            }))}
          />
          <SelectField
            label="Primary country"
            value={countryId}
            onChange={onCountryChange}
            options={ref.countries.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.iso2Code})`,
            }))}
          />
          <SelectField
            label="Default currency"
            value={currencyId}
            onChange={setCurrencyId}
            options={ref.currencies.map((c) => ({
              value: c.id,
              label: `${c.code} — ${c.name}${c.symbol ? ` (${c.symbol})` : ""}`,
            }))}
          />
          <SelectField
            label="Default language"
            value={languageId}
            onChange={setLanguageId}
            options={ref.languages.map((l) => ({
              value: l.id,
              label: l.nativeName ? `${l.name} — ${l.nativeName}` : l.name,
            }))}
          />
          <SelectField
            label="Timezone"
            value={timezoneId}
            onChange={setTimezoneId}
            options={ref.timezones.map((t) => ({ value: t.id, label: t.label }))}
          />
          <TextField
            label="Primary phone"
            name="primaryPhone"
            placeholder="+60..."
            defaultValue={defaults.primaryPhone ?? ""}
          />
          <TextField
            label="Support email"
            name="supportEmail"
            type="email"
            placeholder="[email protected]"
            defaultValue={defaults.supportEmail ?? ""}
          />
          <TextField
            label="Website URL"
            name="websiteUrl"
            type="url"
            placeholder="https://..."
            defaultValue={defaults.websiteUrl ?? ""}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand voice</CardTitle>
          <CardDescription>
            Pick a preset, then add custom notes if needed. AI uses this when
            drafting campaigns and replies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {ref.voices.map((v) => (
              <label
                key={v.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 transition hover:border-[var(--primary)]/50 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]"
              >
                <input
                  type="radio"
                  name="voiceRadio"
                  value={v.id}
                  checked={voiceId === v.id}
                  onChange={() => setVoiceId(v.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{v.name}</span>
                  {v.description ? (
                    <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                      {v.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-dashed border-[var(--border)] p-3 transition hover:border-[var(--primary)]/50 has-[:checked]:border-[var(--primary)]">
              <input
                type="radio"
                name="voiceRadio"
                value=""
                checked={voiceId === ""}
                onChange={() => setVoiceId("")}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">No preset</span>
                <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                  Use only the custom notes below.
                </span>
              </span>
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
              Custom notes (optional)
            </span>
            <textarea
              name="brandVoiceCustom"
              rows={3}
              value={voiceCustom}
              onChange={(e) => setVoiceCustom(e.target.value)}
              placeholder="e.g. Always sign off with 'Terima kasih'. Avoid mentioning competitor names."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </label>
          {/* Keep the legacy free-text column populated for back-compat. */}
          <input type="hidden" name="brandVoice" value={voiceCustom.slice(0, 400)} />
          <input type="hidden" name="industry" value={
            ref.industries.find((i) => i.id === industryId)?.name ?? defaults.industryFreeText ?? ""
          } />
        </CardContent>
      </Card>
    </>
  );
}

function currencyFromCountry(currencies: Currency[], country: Country | null) {
  if (!country?.defaultCurrencyCode) return null;
  return currencies.find((c) => c.code === country.defaultCurrencyCode)?.id ?? null;
}
function languageFromCountry(languages: Language[], country: Country | null) {
  if (!country?.defaultLanguageCode) return null;
  return languages.find((l) => l.code === country.defaultLanguageCode)?.id ?? null;
}
function timezoneFromCountry(timezones: Timezone[], country: Country | null) {
  if (!country?.defaultTimezone) return null;
  return timezones.find((t) => t.name === country.defaultTimezone)?.id ?? null;
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; hint?: string }[];
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
      />
    </label>
  );
}
