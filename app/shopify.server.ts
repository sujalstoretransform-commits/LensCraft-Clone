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
  const [lensTypes, lensIndices, lensTechnologies] = await Promise.all([
    prisma.lensType.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { name: true } }),
    prisma.lensIndex.findMany({ where: { active: true }, orderBy: { refractiveIndex: "asc" }, select: { displayName: true } }),
    prisma.lensTechnology.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { name: true } }),
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

  const result = await admin.graphql(
    `#graphql
      mutation CreateDefaultLensProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product { id options { name optionValues { name } } }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        product: {
          title: "LensCraft Lens Options",
          status: "DRAFT",
          tags: [defaultLensProductTag],
          productOptions: [
            { name: "Lens Type", values: lensTypes.map(({ name }) => ({ name })) },
            { name: "Lens Index", values: lensIndices.map(({ displayName }) => ({ name: displayName })) },
            { name: "Lens Technology", values: lensTechnologies.map(({ name }) => ({ name })) },
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
  const variantInputs = lensTypes.flatMap(({ name: lensType }) =>
    lensIndices.flatMap(({ displayName: lensIndex }) =>
      lensTechnologies.map(({ name: lensTechnology }) => ({
        optionValues: [
          { optionName: "Lens Type", name: lensType },
          { optionName: "Lens Index", name: lensIndex },
          { optionName: "Lens Technology", name: lensTechnology },
        ],
      })),
    ),
  ).slice(1); // productCreate already creates the first combination.

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
