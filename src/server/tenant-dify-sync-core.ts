export const MAX_TENANT_DIFY_DOC_TEXT = 4000;

function squash(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export type TenantKnowledgeSnapshot = {
  tenant: { id: string; slug: string; name: string };
  profile: {
    industry: string | null;
    supportEmail: string | null;
    websiteUrl: string | null;
    brandVoice: string | null;
    defaultLanguage: string;
    defaultCurrency: string;
    primaryCountry: string;
  } | null;
  products: Array<{
    id: string;
    productCode: string;
    name: string;
    shortDescription: string | null;
    longDescription: string | null;
    brand: string | null;
    currency: string;
    defaultPrice: string | null;
    aiSellingNotes: string | null;
    aiFaqNotes: string | null;
  }>;
  services: Array<{
    id: string;
    serviceCode: string;
    name: string;
    shortDescription: string | null;
    longDescription: string | null;
    currency: string;
    defaultPrice: string | null;
    durationMinutes: number | null;
  }>;
  memory: Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    weight: number;
  }>;
};

export type TenantKnowledgeDocument = {
  externalId: string;
  title: string;
  text: string;
  sourceType: "business_profile" | "product" | "service" | "business_memory";
  metadata: Record<string, unknown>;
};

export function buildTenantDatasetName(tenantSlug: string, tenantName: string) {
  const slug = squash(tenantSlug).slice(0, 48) || "tenant";
  const name = squash(tenantName).slice(0, 72) || slug;
  return `${name} (${slug}) knowledge`;
}

export function buildKnowledgeDocuments(
  snapshot: TenantKnowledgeSnapshot,
): TenantKnowledgeDocument[] {
  const documents: TenantKnowledgeDocument[] = [];

  if (snapshot.profile) {
    const profileLines = [
      snapshot.profile.industry
        ? `Industry: ${snapshot.profile.industry}`
        : null,
      snapshot.profile.brandVoice
        ? `Brand voice: ${snapshot.profile.brandVoice}`
        : null,
      snapshot.profile.websiteUrl
        ? `Website: ${snapshot.profile.websiteUrl}`
        : null,
      snapshot.profile.supportEmail
        ? `Support email: ${snapshot.profile.supportEmail}`
        : null,
      snapshot.profile.primaryCountry
        ? `Primary country: ${snapshot.profile.primaryCountry}`
        : null,
      snapshot.profile.defaultLanguage
        ? `Default language: ${snapshot.profile.defaultLanguage}`
        : null,
      snapshot.profile.defaultCurrency
        ? `Currency: ${snapshot.profile.defaultCurrency}`
        : null,
    ].filter(Boolean);

    if (profileLines.length > 0) {
      documents.push({
        externalId: `tenant:${snapshot.tenant.id}:business-profile`,
        title: `${snapshot.tenant.name} business profile`,
        text: truncate(profileLines.join("\n"), MAX_TENANT_DIFY_DOC_TEXT),
        sourceType: "business_profile",
        metadata: {
          tenantId: snapshot.tenant.id,
          tenantSlug: snapshot.tenant.slug,
        },
      });
    }
  }

  for (const product of snapshot.products) {
    const price = product.defaultPrice
      ? `${product.currency} ${product.defaultPrice}`
      : null;
    const text = [
      `Product: ${product.name}`,
      `Code: ${product.productCode}`,
      product.brand ? `Brand: ${product.brand}` : null,
      price ? `Price: ${price}` : null,
      product.shortDescription
        ? `Summary: ${product.shortDescription}`
        : null,
      product.longDescription
        ? `Details: ${product.longDescription}`
        : null,
      product.aiSellingNotes
        ? `AI selling notes: ${product.aiSellingNotes}`
        : null,
      product.aiFaqNotes ? `AI FAQ notes: ${product.aiFaqNotes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!text) continue;
    documents.push({
      externalId: `tenant:${snapshot.tenant.id}:product:${product.id}`,
      title: product.name,
      text: truncate(text, MAX_TENANT_DIFY_DOC_TEXT),
      sourceType: "product",
      metadata: {
        tenantId: snapshot.tenant.id,
        tenantSlug: snapshot.tenant.slug,
        productId: product.id,
        productCode: product.productCode,
      },
    });
  }

  for (const service of snapshot.services) {
    const price = service.defaultPrice
      ? `${service.currency} ${service.defaultPrice}`
      : null;
    const text = [
      `Service: ${service.name}`,
      `Code: ${service.serviceCode}`,
      service.durationMinutes
        ? `Duration: ${service.durationMinutes} minutes`
        : null,
      price ? `Price: ${price}` : null,
      service.shortDescription
        ? `Summary: ${service.shortDescription}`
        : null,
      service.longDescription
        ? `Details: ${service.longDescription}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!text) continue;
    documents.push({
      externalId: `tenant:${snapshot.tenant.id}:service:${service.id}`,
      title: service.name,
      text: truncate(text, MAX_TENANT_DIFY_DOC_TEXT),
      sourceType: "service",
      metadata: {
        tenantId: snapshot.tenant.id,
        tenantSlug: snapshot.tenant.slug,
        serviceId: service.id,
        serviceCode: service.serviceCode,
      },
    });
  }

  for (const item of snapshot.memory) {
    const text = [`Kind: ${item.kind}`, item.body].filter(Boolean).join("\n");
    documents.push({
      externalId: `tenant:${snapshot.tenant.id}:memory:${item.id}`,
      title: item.title,
      text: truncate(text, MAX_TENANT_DIFY_DOC_TEXT),
      sourceType: "business_memory",
      metadata: {
        tenantId: snapshot.tenant.id,
        tenantSlug: snapshot.tenant.slug,
        itemId: item.id,
        kind: item.kind,
        weight: item.weight,
      },
    });
  }

  return documents;
}