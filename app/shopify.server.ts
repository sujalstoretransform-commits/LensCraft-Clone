import "@shopify/shopify-app-react-router/adapters/node";
import {
  type AdminApiContext,
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const defaultLensProductTag = "lenscraft_default_lens_catalog";

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
    ...lensTypes.map(({ code, name }) => ({ code, name })),
    ...lensIndices.map(({ code, displayName }) => ({ code, name: displayName })),
    ...lensTechnologies.map(({ code, name }) => ({ code, name })),
    ...lensOptions.map(({ code, name }) => ({ code, name })),
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
          title: "Lens Upgrade",
          handle: "lens-upgrade",
          status: "DRAFT",
          tags: [defaultLensProductTag],
          productOptions: [
            { name: "Catalog Item", values: catalogItems.map(({ name }) => ({ name })) },
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

  const product = data.data.productCreate.product;
  const productId = product.id as string;
  const firstVariantId = product.variants?.nodes?.[0]?.id as string | undefined;
  if (!firstVariantId) throw new Error("Shopify created the lens product without its first variant.");

  const firstSkuResult = await admin.graphql(`#graphql
    mutation SetFirstLensVariantSku($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`, {
    variables: {
      productId,
      variants: [{ id: firstVariantId, sku: catalogItems[0].code }],
    },
  });
  const firstSkuData = await firstSkuResult.json() as any;
  const firstSkuErrors = firstSkuData.data?.productVariantsBulkUpdate?.userErrors;
  if (!firstSkuResult.ok || firstSkuErrors?.length) {
    throw new Error(JSON.stringify(firstSkuErrors ?? "Could not set the first catalog SKU"));
  }

  const variantInputs = catalogItems.slice(1).map(({ code, name }) => ({
    sku: code,
    optionValues: [{ optionName: "Catalog Item", name }],
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
