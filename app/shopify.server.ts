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

  const catalogItems = [
    ...lensTypes.map(({ code, name }) => ({ code, name, category: "type", optionValue: name })),
    ...lensIndices.map(({ code, displayName }) => ({ code, name: displayName, category: "index", optionValue: displayName })),
    ...lensTechnologies.map(({ code, name }) => ({ code, name, category: "combined", optionValue: `Technology: ${name}` })),
    ...lensOptions.map(({ code, name }) => ({ code, name, category: "combined", optionValue: `Lens option: ${name}` })),
  ];
  const allCodes = catalogItems.map(({ code }) => code);
  const duplicateCodes = allCodes.filter((code, index) => allCodes.indexOf(code) !== index);
  if (duplicateCodes.length) throw new Error(`Catalog codes must be unique Shopify SKUs: ${[...new Set(duplicateCodes)].join(", ")}`);
  const typeValues = lensTypes.map(({ name }) => name);
  const indexValues = lensIndices.map(({ displayName }) => displayName);
  const combinedValues = catalogItems.filter(({ category }) => category === "combined").map(({ optionValue }) => optionValue);
  const fallbackTypeValue = lensTypes[0]?.name ?? "Not applicable";
  const fallbackIndexValue = lensIndices[0]?.displayName ?? "Not applicable";
  const optionValuesFor = (item: typeof catalogItems[number]) => [
    { optionName: "Lens Type", name: item.category === "type" ? item.optionValue : fallbackTypeValue },
    { optionName: "Lens Index", name: item.category === "index" ? item.optionValue : "Not applicable" },
    { optionName: "Lens Technology / Lens Option", name: item.category === "combined" ? item.optionValue : "Not applicable" },
  ];

  const handle = "lens-types-catalog";
  const lookup = await admin.graphql(`#graphql
    query FindLensCatalogProduct($handle: String!) {
      productByIdentifier(identifier: { handle: $handle }) {
        id
        title
        options { name }
        tags
        variants(first: 250) { nodes { id sku } }
      }
    }`, { variables: { handle } });
  const lookupData = await lookup.json() as any;
  const lookupErrors = graphqlErrors(lookupData);
  if (!lookup.ok || lookupErrors.length) throw new Error(`Could not look up lens catalog product: ${JSON.stringify(lookupErrors)}`);

  let product = lookupData.data?.productByIdentifier;
  if (product && product.title !== "Lens Types" && product.title !== "Lens Catalog" && !product.tags?.includes(defaultLensProductTag)) {
    throw new Error(`Shopify handle '${handle}' is already used by another product.`);
  }
  if (!product) {
    const create = await admin.graphql(`#graphql
      mutation CreateLensCatalogProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product { id options { name } variants(first: 1) { nodes { id sku } } }
          userErrors { field message }
        }
      }`, { variables: { product: {
        title: "Lens Catalog",
        handle,
        status: "DRAFT",
        tags: [defaultLensProductTag],
        productOptions: [
          { name: "Lens Type", values: typeValues.map((name) => ({ name })) },
          { name: "Lens Index", values: [{ name: "Not applicable" }, ...indexValues.map((name) => ({ name }))] },
          { name: "Lens Technology / Lens Option", values: [{ name: "Not applicable" }, ...combinedValues.map((name) => ({ name }))] },
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
    { name: "Lens Index", values: [{ name: "Not applicable" }, ...indexValues.map((name) => ({ name }))] },
    { name: "Lens Technology / Lens Option", values: [{ name: "Not applicable" }, ...combinedValues.map((name) => ({ name }))] },
  ];
  const missingOptions = optionSpecs.filter((option) => !product.options?.some((existing: { name: string }) => existing.name === option.name));
  if (missingOptions.length) {
    const addOptions = await admin.graphql(`#graphql
      mutation AddLensCatalogOptions($productId: ID!, $options: [OptionCreateInput!]!) {
        productOptionsCreate(productId: $productId, options: $options, variantStrategy: LEAVE_AS_IS) {
          product { id }
          userErrors { field message }
        }
      }`, { variables: { productId: product.id, options: missingOptions } });
    const optionsData = await addOptions.json() as any;
    const optionsErrors = graphqlErrors(optionsData);
    const userErrors = optionsData.data?.productOptionsCreate?.userErrors;
    if (!addOptions.ok || optionsErrors.length || userErrors?.length) {
      throw new Error(`Could not add lens catalog options: ${JSON.stringify(optionsErrors.length ? optionsErrors : userErrors)}`);
    }
  }

  const existingVariants = product.variants?.nodes ?? [];
  const existingSkus = new Set(existingVariants.map((variant: { sku?: string | null }) => variant.sku).filter(Boolean));
  const firstItem = catalogItems.find(({ code }) => !existingSkus.has(code));
  const unassignedVariant = existingVariants.find((variant: { sku?: string | null }) => !variant.sku);
  if (firstItem && unassignedVariant) {
    const update = await admin.graphql(`#graphql
      mutation SetFirstLensCatalogSku($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
      }`, { variables: { productId: product.id, variants: [{ id: unassignedVariant.id, sku: firstItem.code, optionValues: optionValuesFor(firstItem) }] } });
    const updateData = await update.json() as any;
    const updateErrors = graphqlErrors(updateData);
    const userErrors = updateData.data?.productVariantsBulkUpdate?.userErrors;
    if (!update.ok || updateErrors.length || userErrors?.length) throw new Error(`Could not set SKU ${firstItem.code}: ${JSON.stringify(updateErrors.length ? updateErrors : userErrors)}`);
    existingSkus.add(firstItem.code);
  }

  const missingItems = catalogItems.filter(({ code }) => !existingSkus.has(code));
  for (let offset = 0; offset < missingItems.length; offset += 250) {
    const variants = missingItems.slice(offset, offset + 250).map((item) => ({ sku: item.code, optionValues: optionValuesFor(item) }));
    const bulk = await admin.graphql(`#graphql
      mutation CreateLensCatalogVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkCreate(productId: $productId, variants: $variants) { userErrors { field message } }
      }`, { variables: { productId: product.id, variants } });
    const bulkData = await bulk.json() as any;
    const bulkErrors = graphqlErrors(bulkData);
    const userErrors = bulkData.data?.productVariantsBulkCreate?.userErrors;
    if (!bulk.ok || bulkErrors.length || userErrors?.length) throw new Error(`Could not create lens catalog variants: ${JSON.stringify(bulkErrors.length ? bulkErrors : userErrors)}`);
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
