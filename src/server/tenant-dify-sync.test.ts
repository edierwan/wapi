import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKnowledgeDocuments,
  buildTenantDatasetName,
  type TenantKnowledgeSnapshot,
} from "@/server/tenant-dify-sync-core";

test("buildTenantDatasetName stays tenant-specific and readable", () => {
  const name = buildTenantDatasetName("clinic-demo", "Clinic Demo");

  assert.equal(name, "Clinic Demo (clinic-demo) knowledge");
});

test("buildKnowledgeDocuments keeps tenant-scoped external ids for every source", () => {
  const snapshot: TenantKnowledgeSnapshot = {
    tenant: { id: "tenant-a", slug: "clinic-a", name: "Clinic A" },
    profile: {
      industry: "Healthcare",
      supportEmail: "clinic@example.com",
      websiteUrl: "https://clinic.example.com",
      brandVoice: "Calm and factual",
      defaultLanguage: "en",
      defaultCurrency: "MYR",
      primaryCountry: "MY",
    },
    products: [
      {
        id: "product-1",
        productCode: "SKU-001",
        name: "Vitamin Pack",
        shortDescription: "Daily vitamins",
        longDescription: "Supports recovery.",
        brand: "Getouch",
        currency: "MYR",
        defaultPrice: "89.00",
        aiSellingNotes: "Recommend for repeat visits.",
        aiFaqNotes: "Take after meals.",
      },
    ],
    services: [
      {
        id: "service-1",
        serviceCode: "CONSULT-30",
        name: "Consultation",
        shortDescription: "General consultation",
        longDescription: "30 minute appointment.",
        currency: "MYR",
        defaultPrice: "120.00",
        durationMinutes: 30,
      },
    ],
    memory: [
      {
        id: "memory-1",
        kind: "faq",
        title: "Operating hours",
        body: "Mon-Fri 9am-6pm.",
        weight: 5,
      },
    ],
  };

  const documents = buildKnowledgeDocuments(snapshot);

  assert.equal(documents.length, 4);
  assert.ok(
    documents.every((doc) => doc.externalId.startsWith("tenant:tenant-a:")),
  );
  assert.deepEqual(
    documents.map((doc) => doc.sourceType),
    ["business_profile", "product", "service", "business_memory"],
  );
});