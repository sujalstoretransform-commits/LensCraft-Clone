import "@shopify/shopify-app-react-router/adapters/node";
import {
  type AdminApiContext,
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const defaultLensProductTag = "lenscraft_default_lens_catalog_v2";

async function createDefaultLensProduct(admin: AdminApiContext) {
  const [lensTypes, lensIndices, lensTechnologies, lensOptions] = await Promise.all([
    prisma.lensType.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { code: true, name: true } }),
    prisma.lensIndex.findMany({ where: { active: true }, orderBy: { refractiveIndex: "asc" }, select: { code: true, displayName: true } }),
    prisma.lensTechnology.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true } }),
    prisma.lensOption.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { code: "asc" }], select: { code: true, name: true } }),
  ]);

  if (!lensTypes.length || !lensIndices.length || !lensTechnologies.length) {
    throw new Error("Default lens catalog is empty. Run the Prisma seeders before installing the app.");
  }

  const lookup = await admin.graphql(
    `#graphql
      query FindDefaultLensProduct($query: String!) {
        products(first: 1, query: $query) { nodes { id } }
      }
    `,
    { variables: { query: `tag:${defaultLensProductTag}` } },
  );
  const lookupData = await lookup.json() as any;
  if (lookupData.data?.products?.nodes?.length) return;

  const catalogItems = [
    ...lensTypes.map(({ code, name }) => ({ code, name, optionName: "Lens Type" })),
    ...lensIndices.map(({ code, displayName }) => ({ code, name: displayName, optionName: "Lens Index" })),
    ...lensTechnologies.map(({ code, name }) => ({ code, name, optionName: "Lens Technology" })),
    ...lensOptions.map(({ code, name }) => ({ code, name, optionName: "Lens Option" })),
  ];
  const duplicateCodes = catalogItems
    .map(({ code }) => code)
    .filter((code, index, codes) => codes.indexOf(code) !== index);
  if (duplicateCodes.length) {
    throw new Error(`Catalog codes must be unique Shopify SKUs: ${[...new Set(duplicateCodes)].join(", ")}`);
  }
  if (catalogItems.length === 0) {
    throw new Error("Default lens catalog has no Shopify-priced catalog codes.");
  }

  const result = await admin.graphql(
    `#graphql
      mutation CreateDefaultLensProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product { id variants(first: 1) { nodes { id } } }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        product: {
          title: "Lens Upgrade Catalog",
          handle: "lens-upgrade-catalog",
          status: "DRAFT",
          tags: [defaultLensProductTag],
          productOptions: [
            { name: "Lens Type", values: [{ name: "Not applicable" }, ...lensTypes.map(({ name }) => ({ name }))] },
            { name: "Lens Index", values: [{ name: "Not applicable" }, ...lensIndices.map(({ displayName }) => ({ name: displayName }))] },
            { name: "Lens Technology", values: [{ name: "Not applicable" }, ...lensTechnologies.map(({ name }) => ({ name }))] },
            { name: "Lens Option", values: [{ name: "Not applicable" }, ...lensOptions.map(({ name }) => ({ name }))] },
          ],
        },
      },
    },
  );
  const data = await result.json() as any;
  const errors = data.data?.productCreate?.userErrors;
  if (errors?.length || !data.data?.productCreate?.product) {
    throw new Error(JSON.stringify(errors ?? "Product creation returned no product"));
  }

  const productId = data.data.productCreate.product.id as string;
  const firstVariantId = data.data.productCreate.product.variants?.nodes?.[0]?.id as string | undefined;
  if (!firstVariantId) throw new Error("Shopify created the lens product without its first variant.");
  const optionValuesFor = (item: typeof catalogItems[number]) => [
    { optionName: "Lens Type", name: item.optionName === "Lens Type" ? item.name : "Not applicable" },
    { optionName: "Lens Index", name: item.optionName === "Lens Index" ? item.name : "Not applicable" },
    { optionName: "Lens Technology", name: item.optionName === "Lens Technology" ? item.name : "Not applicable" },
    { optionName: "Lens Option", name: item.optionName === "Lens Option" ? item.name : "Not applicable" },
  ];
  const firstItem = catalogItems[0];
  const firstVariantResult = await admin.graphql(`#graphql
    mutation SetFirstLensVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`, {
    variables: {
      productId,
      variants: [{ id: firstVariantId, sku: firstItem.code, optionValues: optionValuesFor(firstItem) }],
    },
  });
  const firstVariantData = await firstVariantResult.json() as any;
  const firstVariantErrors = firstVariantData.data?.productVariantsBulkUpdate?.userErrors;
  if (!firstVariantResult.ok || firstVariantErrors?.length) {
    throw new Error(JSON.stringify(firstVariantErrors ?? "Could not set the first catalog variant"));
  }

  const variantInputs = catalogItems.slice(1).map((item) => ({
    sku: item.code,
    optionValues: optionValuesFor(item),
  }));

  for (let offset = 0; offset < variantInputs.length; offset += 250) {
    const variantsResult = await admin.graphql(
      `#graphql
        mutation CreateDefaultLensVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
            product { id }
            userErrors { field message }
          }
        }
      `,
      {
        variables: {
          productId,
          variants: variantInputs.slice(offset, offset + 250),
        },
      },
    );
    const variantsData = await variantsResult.json() as any;
    const variantErrors = variantsData.data?.productVariantsBulkCreate?.userErrors;
    if (variantErrors?.length) {
      throw new Error(JSON.stringify(variantErrors));
    }
  }
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ admin }) => {
      await createDefaultLensProduct(admin);
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
