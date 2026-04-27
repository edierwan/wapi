import { normalisePhone } from "@/lib/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParsedLoginIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string; candidates: string[] };

export function isEmailIdentifier(value: string): boolean {
  return EMAIL_RE.test(value.trim().toLowerCase());
}

export function normaliseMalaysiaPhone(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return "";

  if (trimmed.startsWith("+")) {
    if (digits.startsWith("60")) {
      return `+60${digits.slice(2).replace(/^0+/, "")}`;
    }
    return `+${digits}`;
  }

  if (digits.startsWith("00")) {
    const intl = digits.slice(2);
    if (intl.startsWith("60")) {
      return `+60${intl.slice(2).replace(/^0+/, "")}`;
    }
    return `+${intl}`;
  }

  if (digits.startsWith("60")) {
    return `+60${digits.slice(2).replace(/^0+/, "")}`;
  }

  return `+60${digits.replace(/^0+/, "")}`;
}

export function buildPhoneLookupCandidates(raw: string): string[] {
  const values = new Set<string>();
  const trimmed = raw.trim();
  const canonical = normaliseMalaysiaPhone(trimmed);
  const loose = normalisePhone(trimmed);
  const digits = trimmed.replace(/\D+/g, "");

  for (const value of [canonical, loose, trimmed]) {
    if (value) values.add(value);
  }

  if (canonical) {
    const canonicalDigits = canonical.replace(/^\+/, "");
    values.add(canonicalDigits);
    if (canonicalDigits.startsWith("60")) {
      const local = `0${canonicalDigits.slice(2)}`;
      values.add(local);
      values.add(`+600${canonicalDigits.slice(2)}`);
    }
  }

  if (digits) {
    values.add(digits);
    if (digits.startsWith("0")) {
      values.add(`+60${digits.replace(/^0+/, "")}`);
    }
    if (digits.startsWith("60")) {
      values.add(`+${digits}`);
      values.add(`0${digits.slice(2)}`);
      values.add(`+600${digits.slice(2)}`);
    }
  }

  return [...values].filter(Boolean);
}

export function parseLoginIdentifier(raw: string): ParsedLoginIdentifier {
  const trimmed = raw.trim();
  if (isEmailIdentifier(trimmed)) {
    return { kind: "email", email: trimmed.toLowerCase() };
  }

  const phone = normaliseMalaysiaPhone(trimmed);
  return {
    kind: "phone",
    phone,
    candidates: buildPhoneLookupCandidates(trimmed),
  };
}