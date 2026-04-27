import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPhoneLookupCandidates,
  normaliseMalaysiaPhone,
  parseLoginIdentifier,
} from "@/server/auth-identifiers";

test("normaliseMalaysiaPhone canonicalizes local and international MY inputs", () => {
  assert.equal(normaliseMalaysiaPhone("0192277233"), "+60192277233");
  assert.equal(normaliseMalaysiaPhone("60192277233"), "+60192277233");
  assert.equal(normaliseMalaysiaPhone("+60192277233"), "+60192277233");
  assert.equal(normaliseMalaysiaPhone("+600192277233"), "+60192277233");
});

test("buildPhoneLookupCandidates includes canonical and legacy stored variants", () => {
  const candidates = buildPhoneLookupCandidates("0192277233");

  assert.ok(candidates.includes("+60192277233"));
  assert.ok(candidates.includes("60192277233"));
  assert.ok(candidates.includes("0192277233"));
  assert.ok(candidates.includes("+600192277233"));
});

test("parseLoginIdentifier distinguishes email and phone identifiers", () => {
  assert.deepEqual(parseLoginIdentifier("USER@Example.com"), {
    kind: "email",
    email: "user@example.com",
  });

  const parsed = parseLoginIdentifier("0192277233");
  assert.equal(parsed.kind, "phone");
  if (parsed.kind !== "phone") return;
  assert.equal(parsed.phone, "+60192277233");
  assert.ok(parsed.candidates.includes("+60192277233"));
});