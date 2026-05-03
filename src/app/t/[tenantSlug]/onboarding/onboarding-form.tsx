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
  suggestedIndustryId: string | null;
  suggestedIndustryName: string | null;
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

export function OnboardingForm({
  refData,
  defaults,
}: {
  refData: OnboardingRefData;
  defaults: OnboardingDefaults;
}) {
  // Compute initial selections. If FK ids are missing, derive from defaults
  // or fall back to Malaysia.
  const malaysia = refData.countries.find((c) => c.iso2Code === "MY") ?? refData.countries[0];
  const initialCountryId = defaults.countryId ?? malaysia?.id ?? "";
  const initialCountry =
    refData.countries.find((country) => country.id === initialCountryId) ?? malaysia ?? null;

  const [countryId, setCountryId] = useState(initialCountryId);
  const [currencyId, setCurrencyId] = useState(
    defaults.currencyId ??
      currencyFromCountry(refData.currencies, initialCountry) ??
      "",
  );
  const [languageId, setLanguageId] = useState(
    defaults.languageId ??
      languageFromCountry(refData.languages, initialCountry) ??
      "",
  );
  const [timezoneId, setTimezoneId] = useState(
    defaults.timezoneId ??
      timezoneFromCountry(refData.timezones, initialCountry) ??
      "",
  );
  const [industryId, setIndustryId] = useState(
    defaults.industryId ?? defaults.suggestedIndustryId ?? "",
  );

  const selectedCountry = useMemo(
    () => refData.countries.find((c) => c.id === countryId) ?? null,
    [refData.countries, countryId],
  );
  const selectedCurrency = useMemo(
    () => refData.currencies.find((c) => c.id === currencyId) ?? null,
    [refData.currencies, currencyId],
  );
  const selectedLanguage = useMemo(
    () => refData.languages.find((l) => l.id === languageId) ?? null,
    [refData.languages, languageId],
  );
  const selectedTimezone = useMemo(
    () => refData.timezones.find((t) => t.id === timezoneId) ?? null,
    [refData.timezones, timezoneId],
  );
  const selectedIndustry = useMemo(
    () => refData.industries.find((industry) => industry.id === industryId) ?? null,
    [refData.industries, industryId],
  );
  const showSuggestionNote = Boolean(
    defaults.suggestedIndustryId &&
      defaults.suggestedIndustryName &&
      defaults.suggestedIndustryId === industryId,
  );

  function onCountryChange(newId: string) {
    setCountryId(newId);
    const c = refData.countries.find((x) => x.id === newId);
    if (!c) return;
    // Auto-fill cascade — only when a default code is present.
    const cur = refData.currencies.find((x) => x.code === c.defaultCurrencyCode);
    if (cur) setCurrencyId(cur.id);
    const lang = refData.languages.find((x) => x.code === c.defaultLanguageCode);
    if (lang) setLanguageId(lang.id);
    const tz = refData.timezones.find((x) => x.name === c.defaultTimezone);
    if (tz) setTimezoneId(tz.id);
  }

  return (
    <>
      <input type="hidden" name="industryId" value={industryId} />
      <input type="hidden" name="countryId" value={countryId} />
      <input type="hidden" name="currencyId" value={currencyId} />
      <input type="hidden" name="languageId" value={languageId} />
      <input type="hidden" name="timezoneId" value={timezoneId} />
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
      <input type="hidden" name="brandVoice" value="" />
      <input type="hidden" name="brandVoiceCustom" value="" />
      <input type="hidden" name="industry" value={selectedIndustry?.name ?? defaults.industryFreeText ?? ""} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business profile</CardTitle>
          <CardDescription>
            Confirm your business details so your workspace can be prepared correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <SelectField
              label="Industry"
              value={industryId}
              onChange={setIndustryId}
              placeholder="Select industry…"
              options={refData.industries.map((i) => ({
                value: i.id,
                label: i.name,
                hint: i.description ?? undefined,
              }))}
            />
            {showSuggestionNote ? (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Based on your company name, we selected {defaults.suggestedIndustryName}. You can change it if needed.
              </p>
            ) : null}
          </div>
          <SelectField
            label="Primary country"
            value={countryId}
            onChange={onCountryChange}
            options={refData.countries.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.iso2Code})`,
            }))}
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
          <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--muted)]/20 px-3 py-2 text-sm sm:col-span-2">
            <p className="font-medium text-[var(--foreground)]">Country defaults</p>
            <p className="mt-1 text-[var(--muted-foreground)]">
              Currency {selectedCurrency?.code ?? "MYR"}, timezone {selectedTimezone?.label ?? "Asia/Kuala_Lumpur"}, and default language {selectedLanguage?.name ?? "English"} will be prepared automatically.
            </p>
          </div>
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
