import "@shopify/shopify-app-react-router/adapters/node";
import {
  type AdminApiContext,
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const defaultLensProductTag = "lenscraft_lens_catalog_v4";
const defaultScopes = [
  "write_app_proxy",
  "read_products",
  "write_products",
  "read_cart_transforms",
  "write_cart_transforms",
];

function graphqlErrors(body: unknown): unknown[] {
  if (typeof body !== "object" || body === null || !("errors" in body)) return [];
  return Array.isArray(body.errors) ? body.errors : [];
}

export async function createDefaultLensProduct(admin: AdminApiContext) {
  const [lensTypes, lensIndices, lensTechnologies, lensOptions] = await Promise.all([
    prisma.lensType.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { code: true, name: true } }),
    prisma.lensIndex.findMany({ where: { active: true }, orderBy: { refractiveIndex: "asc" }, select: { code: true, displayName: true } }),
    prisma.lensTechnology.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true } }),
    prisma.lensOption.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { code: "asc" }], select: { code: true, name: true } }),
  ]);

  const uniqueNames = <T extends { code: string; name: string }>(items: T[]) => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
    return items.map((item) => ({
      ...item,
      optionValue: counts.get(item.name)! > 1 ? `${item.name} (${item.code})` : item.name,
    }));
  };
  const catalogItems = [
    ...uniqueNames(lensTypes.map(({ code, name }) => ({ code, name }))).map((item) => ({ ...item, category: "type" })),
    ...uniqueNames(lensIndices.map(({ code, displayName }) => ({ code, name: displayName }))).map((item) => ({ ...item, category: "index" })),
    ...lensTechnologies.map(({ code, name }) => ({ code, name, category: "combined", optionValue: `Technology: ${name}` })),
    ...lensOptions.map(({ code, name }) => ({ code, name, category: "combined", optionValue: `Lens option: ${name}` })),
  ];
  const combinedValueCounts = new Map<string, number>();
  for (const item of catalogItems.filter(({ category }) => category === "combined")) {
    combinedValueCounts.set(item.optionValue, (combinedValueCounts.get(item.optionValue) ?? 0) + 1);
  }
  for (const item of catalogItems.filter(({ category }) => category === "combined")) {
    if (combinedValueCounts.get(item.optionValue)! > 1) item.optionValue = `${item.optionValue} (${item.code})`;
  }
  const allCodes = catalogItems.map(({ code }) => code);
  const duplicateCodes = allCodes.filter((code, index) => allCodes.indexOf(code) !== index);
  if (duplicateCodes.length) throw new Error(`Catalog codes must be unique Shopify SKUs: ${[...new Set(duplicateCodes)].join(", ")}`);
  if (catalogItems.length > 2048) throw new Error("Shopify supports at most 2,048 variants on this catalog product.");
  const typeValues = catalogItems.filter(({ category }) => category === "type").map(({ optionValue }) => optionValue);
  const indexValues = catalogItems.filter(({ category }) => category === "index").map(({ optionValue }) => optionValue);
  const combinedValues = catalogItems.filter(({ category }) => category === "combined").map(({ optionValue }) => optionValue);
  if (!typeValues.length || !indexValues.length || !combinedValues.length) {
    throw new Error("Lens catalog needs at least one active value for type, index, technology, and option.");
  }

  const combinations = typeValues.flatMap((type) => indexValues.flatMap((index) => combinedValues.map((combined) => [type, index, combined])));
  if (combinations.length < catalogItems.length) {
    throw new Error("The active catalog values do not provide enough unique Shopify variant combinations for all catalog SKUs.");
  }
  const usedCombinations = new Set<string>();
  const optionValuesByCode = new Map<string, { optionName: string; name: string }[]>();
  for (const item of catalogItems) {
    const targetIndex = item.category === "type" ? 0 : item.category === "index" ? 1 : 2;
    const combination = combinations.find((values) =>
      values[targetIndex] === item.optionValue && !usedCombinations.has(JSON.stringify(values)),
    );
    if (!combination) {
      throw new Error(`Could not assign a unique Shopify variant combination to catalog SKU ${item.code}.`);
    }
    usedCombinations.add(JSON.stringify(combination));
    optionValuesByCode.set(item.code, [
      { optionName: "Lens Type", name: combination[0] },
      { optionName: "Lens Index", name: combination[1] },
      { optionName: "Lens Technology and Lens Option", name: combination[2] },
    ]);
  }
  const optionValuesFor = (item: typeof catalogItems[number]) => optionValuesByCode.get(item.code)!;

  const handle = "lens-types-catalog";
  const lookup = await admin.graphql(`#graphql
    query FindLensCatalogProduct($handle: String!, $query: String!) {
      productByIdentifier(identifier: { handle: $handle }) {
        id
        title
        options { id name optionValues { id name } }
        tags
        variants(first: 250) { nodes { id sku selectedOptions { name value } } }
      }
      products(first: 1, query: $query) {
        nodes { id handle title options { name } tags variants(first: 250) { nodes { id sku } } }
      }
    }`, { variables: { handle, query: `handle:${handle}` } });
  const lookupData = await lookup.json() as any;
  const lookupErrors = graphqlErrors(lookupData);
  if (!lookup.ok || lookupErrors.length) throw new Error(`Could not look up lens catalog product: ${JSON.stringify(lookupErrors)}`);

  let product = lookupData.data?.productByIdentifier ?? lookupData.data?.products?.nodes?.[0];
  if (product && product.title !== "Lens Types" && product.title !== "Lens Catalog" && !product.tags?.includes(defaultLensProductTag)) {
    throw new Error(`Shopify handle '${handle}' is already used by another product.`);
  }
  if (!product) {
    const create = await admin.graphql(`#graphql
      mutation CreateLensCatalogProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product { id options { id name optionValues { id name } } variants(first: 250) { nodes { id sku selectedOptions { name value } } } }
          userErrors { field message }
        }
      }`, { variables: { product: {
        title: "Lens Catalog",
        handle,
        status: "DRAFT",
        tags: [defaultLensProductTag],
        productOptions: [
          { name: "Lens Type", values: typeValues.map((name) => ({ name })) },
          { name: "Lens Index", values: indexValues.map((name) => ({ name })) },
          { name: "Lens Technology and Lens Option", values: combinedValues.map((name) => ({ name })) },
        ],
      } } });
    const createData = await create.json() as any;
    const createErrors = graphqlErrors(createData);
    const userErrors = createData.data?.productCreate?.userErrors;
    if (!create.ok || createErrors.length || userErrors?.length || !createData.data?.productCreate?.product) {
      throw new Error(`Could not create Lens Catalog: ${JSON.stringify(createErrors.length ? createErrors : userErrors)}`);
    }
    product = createData.data.productCreate.product;
  }

  const optionSpecs = [
    { name: "Lens Index", values: indexValues.map((name) => ({ name })) },
    { name: "Lens Technology and Lens Option", values: combinedValues.map((name) => ({ name })) },
  ];
  const desiredValuesByOption = new Map([
    ["Lens Type", new Set(typeValues)],
    ["Lens Index", new Set(indexValues)],
    ["Lens Technology and Lens Option", new Set(combinedValues)],
  ]);
  const missingOptions = optionSpecs.filter((option) => !product.options?.some((existing: { name: string }) => existing.name === option.name));
  if (missingOptions.length) {
    const addOptions = await admin.graphql(`#graphql
      mutation AddLensCatalogOptions($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options, variantStrategy: LEAVE_AS_IS) {
          product { id options { id name optionValues { id name } } variants(first: 250) { nodes { id sku selectedOptions { name value } } } }
          userErrors { field message }
        }
      }`, { variables: { productId: product.id, options: missingOptions } });
    const optionsData = await addOptions.json() as any;
    const optionsErrors = graphqlErrors(optionsData);
    const userErrors = optionsData.data?.productOptionsCreate?.userErrors;
    if (!addOptions.ok || optionsErrors.length || userErrors?.length) {
      throw new Error(`Could not add lens catalog options: ${JSON.stringify(optionsErrors.length ? optionsErrors : userErrors)}`);
    }
    product = optionsData.data?.productOptionsCreate?.product ?? product;
  }

  const existingVariants = product.variants?.nodes ?? [];
  const existingSkuList = existingVariants.map((variant: { sku?: string | null }) => variant.sku).filter(Boolean) as string[];
  const duplicateExistingSkus = existingSkuList.filter((sku, index) => existingSkuList.indexOf(sku) !== index);
  if (duplicateExistingSkus.length) throw new Error(`Duplicate Shopify catalog SKUs: ${[...new Set(duplicateExistingSkus)].join(", ")}`);
  const existingSkus = new Set(existingSkuList);
  const itemByCode = new Map(catalogItems.map((item) => [item.code, item]));
  const firstUnassignedItem = catalogItems.find(({ code }) => !existingSkus.has(code));
  const updates = existingVariants.flatMap((variant: { id: string; sku?: string | null; selectedOptions?: { name: string; value: string }[] }, index: number) => {
    let item = variant.sku ? itemByCode.get(variant.sku) : undefined;
    if (!item && !variant.sku && index === 0) item = firstUnassignedItem;
    if (!item) return [];
    const needsPlaceholderRepair = !variant.sku || variant.selectedOptions?.some((option) => option.value === "Not applicable");
    if (!needsPlaceholderRepair) return [];
    existingSkus.add(item.code);
    return [{ id: variant.id, inventoryItem: { sku: item.code }, optionValues: optionValuesFor(item) }];
  });
  for (let offset = 0; offset < updates.length; offset += 250) {
    const update = await admin.graphql(`#graphql
      mutation UpdateLensCatalogVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
      }`, { variables: { productId: product.id, variants: updates.slice(offset, offset + 250) } });
    const updateData = await update.json() as any;
    const updateErrors = graphqlErrors(updateData);
    const userErrors = updateData.data?.productVariantsBulkUpdate?.userErrors;
    if (!update.ok || updateErrors.length || userErrors?.length) throw new Error(`Could not sync existing lens variants: ${JSON.stringify(updateErrors.length ? updateErrors : userErrors)}`);
  }

  const missingItems = catalogItems.filter(({ code }) => !existingSkus.has(code));
  for (let offset = 0; offset < missingItems.length; offset += 250) {
    const variants = missingItems.slice(offset, offset + 250).map((item) => ({ inventoryItem: { sku: item.code }, optionValues: optionValuesFor(item) }));
    const bulk = await admin.graphql(`#graphql
      mutation CreateLensCatalogVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) { userErrors { field message } }
      }`, { variables: { productId: product.id, variants } });
    const bulkData = await bulk.json() as any;
    const bulkErrors = graphqlErrors(bulkData);
    const userErrors = bulkData.data?.productVariantsBulkCreate?.userErrors;
    if (!bulk.ok || bulkErrors.length || userErrors?.length) throw new Error(`Could not create lens catalog variants: ${JSON.stringify(bulkErrors.length ? bulkErrors : userErrors)}`);
  }

  for (const option of product.options ?? []) {
    const desiredValues = desiredValuesByOption.get(option.name) ?? new Set<string>();
    const placeholderIds = option.optionValues
      ?.filter((value: { name: string }) => value.name === "Not applicable" && !desiredValues.has(value.name))
      .map((value: { id: string }) => value.id) ?? [];
    if (!placeholderIds.length) continue;
    const cleanup = await admin.graphql(`#graphql
      mutation RemoveLensCatalogPlaceholderValues($productId: ID!, $option: OptionUpdateInput!, $valueIds: [ID!]!) {
        productOptionUpdate(productId: $productId, option: $option, optionValuesToDelete: $valueIds, variantStrategy: LEAVE_AS_IS) {
          userErrors { field message }
        }
      }`, { variables: { productId: product.id, option: { id: option.id }, valueIds: placeholderIds } });
    const cleanupData = await cleanup.json() as any;
    const cleanupErrors = graphqlErrors(cleanupData);
    const userErrors = cleanupData.data?.productOptionUpdate?.userErrors;
    if (!cleanup.ok || cleanupErrors.length || userErrors?.length) throw new Error(`Could not remove placeholder values from ${option.name}: ${JSON.stringify(cleanupErrors.length ? cleanupErrors : userErrors)}`);
  }
}
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October26,
  scopes: (() => {
    const configuredScopes = (process.env.SCOPES ?? "")
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
    const scopes = new Set([...configuredScopes, ...defaultScopes]);
    return [...scopes];
  })(),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ admin }) => {
      try {
        await createDefaultLensProduct(admin);
      } catch (error) {
        console.error("Default lens product creation failed after authorization:", error);
        throw error;
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
