import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import {
  getCampaign,
  listVariants,
  previewAudience,
  type AudienceFilter,
} from "@/server/campaigns";

/**
 * Internal safety review for a campaign.
 *
 * This is NOT a checklist UI for the tenant. It produces a single overall
 * status + a short human summary + a list of itemized findings so that
 * the composer can show a one-line outcome and the tenant can drill in
 * if they want to.
 *
 * Findings are channel-aware in spirit: rules that only matter for a
 * given channel can short-circuit when channel is known, but for now
 * the rules below all apply to text-style messaging (which covers
 * WhatsApp text, FB/IG DM, and marketplace chat).
 */

export type SafetyFinding = {
  code: string;
  status: "good" | "needs_review" | "high_risk";
  message: string;
  variantLabel?: string;
  autoFixable?: boolean;
};

export type SafetyResult = {
  overallStatus: "good" | "needs_review" | "high_risk";
  summary: string;
  findings: SafetyFinding[];
};

const MAX_BODY_CHARS = 1024;
const SOFT_LIMIT_CHARS = 700;

const OPT_OUT_HINTS = [
  "stop",
  "unsubscribe",
  "opt out",
  "opt-out",
  "berhenti",
  "henti",
];

function hasOptOutHint(body: string): boolean {
  const lower = body.toLowerCase();
  return OPT_OUT_HINTS.some((h) => lower.includes(h));
}

function findProhibited(
  body: string,
  prohibited: string[] | null,
): string[] {
  if (!prohibited || prohibited.length === 0) return [];
  const lower = body.toLowerCase();
  return prohibited
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .filter((w) => lower.includes(w.toLowerCase()));
}

function looksLikeAllCapsShout(body: string): boolean {
  const letters = body.replace(/[^A-Za-z]/g, "");
  if (letters.length < 30) return false;
  const upper = letters.replace(/[^A-Z]/g, "");
  return upper.length / letters.length > 0.7;
}

export async function reviewCampaign(input: {
  tenantId: string;
  campaignId: string;
}): Promise<SafetyResult> {
  const db = requireDb();
  const variants = await listVariants(input.tenantId, input.campaignId);
  const campaign = await getCampaign(input.tenantId, input.campaignId);

  // Tenant business profile (for prohibited words). Single row per tenant.
  const [profile] = await db
    .select()
    .from(schema.tenantBusinessProfiles)
    .where(eq(schema.tenantBusinessProfiles.tenantId, input.tenantId))
    .limit(1);
  const prohibited = (profile?.prohibitedWords as string[] | null) ?? null;

  const findings: SafetyFinding[] = [];

  if (variants.length === 0) {
    findings.push({
      code: "no_variants",
      status: "high_risk",
      message: "Campaign has no message variants yet. Add at least one before scheduling.",
    });
  }

  for (const v of variants) {
    const body = v.bodyText ?? "";
    if (body.trim().length === 0) {
      findings.push({
        code: "empty_body",
        status: "high_risk",
        variantLabel: v.label,
        message: `Variant ${v.label} has no body text.`,
      });
      continue;
    }
    if (body.length > MAX_BODY_CHARS) {
      findings.push({
        code: "body_too_long",
        status: "high_risk",
        variantLabel: v.label,
        message: `Variant ${v.label} is ${body.length} characters; the gateway hard limit is ${MAX_BODY_CHARS}.`,
      });
    } else if (body.length > SOFT_LIMIT_CHARS) {
      findings.push({
        code: "body_long",
        status: "needs_review",
        variantLabel: v.label,
        message: `Variant ${v.label} is ${body.length} characters; consider shortening for readability.`,
      });
    }
    const hits = findProhibited(body, prohibited);
    if (hits.length > 0) {
      findings.push({
        code: "prohibited_words",
        status: "high_risk",
        variantLabel: v.label,
        message: `Variant ${v.label} contains prohibited terms: ${hits.join(", ")}.`,
      });
    }
    if (!hasOptOutHint(body)) {
      findings.push({
        code: "no_opt_out_hint",
        status: "needs_review",
        variantLabel: v.label,
        message: `Variant ${v.label} has no opt-out instruction (e.g. reply STOP).`,
        autoFixable: true,
      });
    }
    if (looksLikeAllCapsShout(body)) {
      findings.push({
        code: "all_caps",
        status: "needs_review",
        variantLabel: v.label,
        message: `Variant ${v.label} appears to be mostly uppercase, which often reads as spam.`,
      });
    }
  }

  // Consent coverage. Promotional objectives need marketing consent on
  // file. Transactional / followup / survey relax this; the tenant still
  // needs opt-in for outbound contact, but consent_type='marketing' is
  // not the right gate. Channel-agnostic: contact_consents.channel can
  // expand beyond whatsapp without code changes here.
  const isMarketingObjective =
    !campaign?.objective ||
    campaign.objective === "promo" ||
    campaign.objective === "re_engage" ||
    campaign.objective === "event";

  if (isMarketingObjective) {
    const filter = (campaign?.audienceFilter as AudienceFilter | null) ?? {};
    const audience = await previewAudience(input.tenantId, filter);
    if (audience.total > 0) {
      // Count consent rows for this tenant's audience contacts.
      // We re-derive contact ids via a tenant-scoped subselect to avoid
      // pulling all ids into the app process.
      const consentRows = await db
        .select({
          contactId: schema.contactConsents.contactId,
          granted: schema.contactConsents.granted,
        })
        .from(schema.contactConsents)
        .innerJoin(
          schema.contacts,
          eq(schema.contactConsents.contactId, schema.contacts.id),
        )
        .where(
          and(
            eq(schema.contacts.tenantId, input.tenantId),
            eq(schema.contactConsents.consentType, "marketing"),
          ),
        );
      // Resolve audience ids in full (preview only sampled 20).
      const audienceIds = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.tenantId, input.tenantId),
            eq(schema.contacts.status, "active"),
          ),
        );
      // Build a granted-set restricted to audience ids.
      const audienceIdSet = new Set(audienceIds.map((r) => r.id));
      const grantedSet = new Set(
        consentRows
          .filter((r) => r.granted && audienceIdSet.has(r.contactId))
          .map((r) => r.contactId),
      );
      const grantedCount = grantedSet.size;
      const ratio =
        audience.total > 0 ? grantedCount / audience.total : 0;

      if (grantedCount === 0) {
        findings.push({
          code: "no_marketing_consent",
          status: "high_risk",
          message:
            "No contact in the audience has marketing consent on file. Capture consent before sending a promotional campaign.",
        });
      } else if (ratio < 0.5) {
        findings.push({
          code: "low_marketing_consent",
          status: "needs_review",
          message: `Only ${grantedCount} of ${audience.total} audience contacts (${Math.round(
            ratio * 100,
          )}%) have marketing consent on file.`,
        });
      } else {
        findings.push({
          code: "marketing_consent_ok",
          status: "good",
          message: `${grantedCount} of ${audience.total} audience contacts (${Math.round(
            ratio * 100,
          )}%) have marketing consent on file.`,
        });
      }
    }
  }

  // touch unused import to keep tree-shake hint stable when editing later
  void inArray;
  void sql;

  const overallStatus: SafetyResult["overallStatus"] = findings.some(
    (f) => f.status === "high_risk",
  )
    ? "high_risk"
    : findings.some((f) => f.status === "needs_review")
      ? "needs_review"
      : "good";

  const summary =
    overallStatus === "good"
      ? "Looks good. No blocking issues found."
      : overallStatus === "needs_review"
        ? `${findings.filter((f) => f.status !== "good").length} suggestion(s). Review before scheduling.`
        : `${findings.filter((f) => f.status === "high_risk").length} blocker(s). Fix before scheduling.`;

  return { overallStatus, summary, findings };
}

/**
 * Persist a review snapshot. Returns the inserted row.
 */
export async function recordSafetyReview(input: {
  tenantId: string;
  campaignId: string;
  reviewedByUserId?: string | null;
  result: SafetyResult;
}) {
  const db = requireDb();
  // Tenant guard: confirm campaign ownership before writing.
  const [campaign] = await db
    .select({ id: schema.campaigns.id })
    .from(schema.campaigns)
    .where(
      and(
        eq(schema.campaigns.id, input.campaignId),
        eq(schema.campaigns.tenantId, input.tenantId),
      ),
    )
    .limit(1);
  if (!campaign) throw new Error("campaign not found for tenant");

  const [row] = await db
    .insert(schema.campaignSafetyReviews)
    .values({
      campaignId: input.campaignId,
      overallStatus: input.result.overallStatus,
      checks: input.result.findings,
      summaryText: input.result.summary,
      reviewedByUserId: input.reviewedByUserId ?? null,
      reviewedAt: input.reviewedByUserId ? new Date() : null,
    })
    .returning();
  return row;
}

export async function listReviews(tenantId: string, campaignId: string) {
  const db = requireDb();
  return requireDb()
    .select({
      id: schema.campaignSafetyReviews.id,
      overallStatus: schema.campaignSafetyReviews.overallStatus,
      summaryText: schema.campaignSafetyReviews.summaryText,
      createdAt: schema.campaignSafetyReviews.createdAt,
      checks: schema.campaignSafetyReviews.checks,
    })
    .from(schema.campaignSafetyReviews)
    .innerJoin(
      schema.campaigns,
      eq(schema.campaignSafetyReviews.campaignId, schema.campaigns.id),
    )
    .where(
      and(
        eq(schema.campaigns.tenantId, tenantId),
        eq(schema.campaignSafetyReviews.campaignId, campaignId),
      ),
    )
    .orderBy(desc(schema.campaignSafetyReviews.createdAt))
    .limit(20)
    .then((rows) => {
      void db;
      return rows;
    });
}
