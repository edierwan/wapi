import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { requireDb, schema } from "@/db/client";
import { isOnboardingComplete } from "@/server/business-profile";
import { contactCount } from "@/server/contacts";
import { memoryItemCount } from "@/server/business-memory";

/**
 * AI Readiness scoring. Computes a 0-100 score across simple,
 * deterministic signals and persists the latest snapshot per tenant.
 *
 * Buckets (each weighted equally → 25 pts max):
 *  - businessProfile : onboarding completed
 *  - catalog         : at least 1 product or service
 *  - contacts        : at least 1 contact (10pts) / >= 25 contacts (full)
 *  - businessBrain   : memory items (faq/policy/brand/offer presence)
 *
 * This is intentionally simple. Once richer signals exist (gateway
 * connection, campaigns sent, opt-in coverage) we extend `components`.
 */

export type ReadinessBand = "not_ready" | "basic" | "good" | "excellent";

export type ReadinessComponents = {
  businessProfile: number;
  catalog: number;
  contacts: number;
  businessBrain: number;
};

export type ReadinessRecommendation = {
  code: string;
  title: string;
  weight: number;
};

export type ReadinessSnapshot = {
  overallScore: number;
  bandLabel: ReadinessBand;
  components: ReadinessComponents;
  recommendations: ReadinessRecommendation[];
  computedAt: Date;
};

function bandFor(score: number): ReadinessBand {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 35) return "basic";
  return "not_ready";
}

export async function computeReadiness(
  tenantId: string,
): Promise<ReadinessSnapshot> {
  const db = requireDb();

  const [profileDone, productCountRow, serviceCountRow, brainKindsRow] =
    await Promise.all([
      isOnboardingComplete(tenantId),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.products)
        .where(eq(schema.products.tenantId, tenantId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.services)
        .where(eq(schema.services.tenantId, tenantId)),
      db
        .select({
          kind: schema.businessMemoryItems.kind,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.businessMemoryItems)
        .where(eq(schema.businessMemoryItems.tenantId, tenantId))
        .groupBy(schema.businessMemoryItems.kind),
    ]);

  const products = productCountRow[0]?.count ?? 0;
  const services = serviceCountRow[0]?.count ?? 0;
  const contacts = await contactCount(tenantId);

  // businessProfile: 25 if onboarding complete, else 0
  const businessProfile = profileDone ? 25 : 0;

  // catalog: 25 if any product or service, scale up to 25 with >= 5 items
  const catalogItems = products + services;
  const catalog =
    catalogItems === 0
      ? 0
      : catalogItems >= 5
        ? 25
        : 10 + Math.min(15, catalogItems * 3);

  // contacts: 10 for first contact, 25 at >= 25
  const contactsScore =
    contacts === 0 ? 0 : contacts >= 25 ? 25 : Math.min(25, 10 + contacts);

  // businessBrain: 6 pts per distinct kind, capped at 25
  const distinctKinds = brainKindsRow.length;
  const businessBrain = Math.min(25, distinctKinds * 6);

  const components: ReadinessComponents = {
    businessProfile,
    catalog,
    contacts: contactsScore,
    businessBrain,
  };
  const overallScore =
    components.businessProfile +
    components.catalog +
    components.contacts +
    components.businessBrain;

  const recommendations: ReadinessRecommendation[] = [];
  if (!profileDone) {
    recommendations.push({
      code: "onboarding.complete",
      title: "Finish onboarding to lock in your business profile.",
      weight: 25,
    });
  }
  if (catalogItems === 0) {
    recommendations.push({
      code: "catalog.add",
      title: "Add at least one product or service so AI can answer questions.",
      weight: 25,
    });
  } else if (catalogItems < 5) {
    recommendations.push({
      code: "catalog.expand",
      title: "Add more catalog items — aim for at least 5 to cover common asks.",
      weight: 15,
    });
  }
  if (contacts === 0) {
    recommendations.push({
      code: "contacts.import",
      title: "Add or import contacts to reach with campaigns.",
      weight: 25,
    });
  } else if (contacts < 25) {
    recommendations.push({
      code: "contacts.grow",
      title: "Grow your audience to at least 25 contacts before campaigning.",
      weight: 15,
    });
  }
  const totalBrain = await memoryItemCount(tenantId);
  if (totalBrain === 0) {
    recommendations.push({
      code: "brain.seed",
      title: "Add Business Brain entries — start with 1 FAQ and 1 brand note.",
      weight: 25,
    });
  } else if (distinctKinds < 3) {
    recommendations.push({
      code: "brain.expand",
      title:
        "Cover more Business Brain kinds (FAQ, policy, brand, offer) to improve grounding.",
      weight: 15,
    });
  }

  return {
    overallScore,
    bandLabel: bandFor(overallScore),
    components,
    recommendations,
    computedAt: new Date(),
  };
}

export async function persistReadiness(
  tenantId: string,
  snap: ReadinessSnapshot,
) {
  const db = requireDb();
  const [row] = await db
    .insert(schema.aiReadinessScores)
    .values({
      tenantId,
      overallScore: snap.overallScore,
      bandLabel: snap.bandLabel,
      components: snap.components,
      recommendations: snap.recommendations,
      computedAt: snap.computedAt,
    })
    .returning();
  return row;
}

export async function getLatestReadiness(
  tenantId: string,
): Promise<ReadinessSnapshot | null> {
  const db = requireDb();
  const [row] = await db
    .select()
    .from(schema.aiReadinessScores)
    .where(eq(schema.aiReadinessScores.tenantId, tenantId))
    .orderBy(desc(schema.aiReadinessScores.computedAt))
    .limit(1);
  if (!row) return null;
  return {
    overallScore: row.overallScore,
    bandLabel: (row.bandLabel as ReadinessBand) ?? "not_ready",
    components: (row.components as ReadinessComponents) ?? {
      businessProfile: 0,
      catalog: 0,
      contacts: 0,
      businessBrain: 0,
    },
    recommendations:
      (row.recommendations as ReadinessRecommendation[]) ?? [],
    computedAt: row.computedAt,
  };
}

export async function recomputeReadiness(tenantId: string) {
  const snap = await computeReadiness(tenantId);
  await persistReadiness(tenantId, snap);
  return snap;
}
