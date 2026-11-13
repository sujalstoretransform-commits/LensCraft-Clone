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
    ...lensTypes.map(({ code, name }) => ({ code, name, category: "type", optionValue: `Lens type: ${name} (${code})` })),
    ...lensIndices.map(({ code, displayName }) => ({ code, name: displayName, category: "index", optionValue: `Lens index: ${displayName} (${code})` })),
    ...lensTechnologies.map(({ code, name }) => ({ code, name, category: "technology", optionValue: `Technology: ${name} (${code})` })),
    ...lensOptions.map(({ code, name }) => ({ code, name, category: "option", optionValue: `Lens option: ${name} (${code})` })),
  ];
  const allCodes = catalogItems.map(({ code }) => code);
  const duplicateCodes = allCodes.filter((code, index) => allCodes.indexOf(code) !== index);
  if (duplicateCodes.length) throw new Error(`Catalog codes must be unique Shopify SKUs: ${[...new Set(duplicateCodes)].join(", ")}`);
  if (catalogItems.length > 2048) throw new Error("Shopify supports at most 2,048 variants on this catalog product.");
  if (!catalogItems.length) throw new Error("Lens catalog has no active items to create variants from.");
  const optionName = "Lens Catalog Item";
  const optionValues = catalogItems.map(({ optionValue }) => ({ name: optionValue }));
  const optionValuesFor = (item: typeof catalogItems[number]) => [{ optionName, name: item.optionValue }];

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
        nodes { id handle title options { id name optionValues { id name } } tags variants(first: 250) { nodes { id sku } } }
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
        productOptions: [{ name: optionName, values: optionValues }],
      } } });
    const createData = await create.json() as any;
    const createErrors = graphqlErrors(createData);
    const userErrors = createData.data?.productCreate?.userErrors;
    if (!create.ok || createErrors.length || userErrors?.length || !createData.data?.productCreate?.product) {
      throw new Error(`Could not create Lens Catalog: ${JSON.stringify(createErrors.length ? createErrors : userErrors)}`);
    }
    product = createData.data.productCreate.product;
  }

  const allExistingVariants: { id: string; sku?: string | null; selectedOptions?: { name: string; value: string }[] }[] = [];
  let variantCursor: string | null = null;
  do {
    const variantPage = await admin.graphql(`#graphql
      query ReadLensCatalogVariants($productId: ID!, $cursor: String) {
        product(id: $productId) {
          variants(first: 250, after: $cursor) {
            nodes { id sku selectedOptions { name value } }
            pageInfo { hasNextPage endCursor }
          }
        }
      }`, { variables: { productId: product.id, cursor: variantCursor } });
    const variantPageData = await variantPage.json() as any;
    const variantPageErrors = graphqlErrors(variantPageData);
    const variantConnection = variantPageData.data?.product?.variants;
    if (!variantPage.ok || variantPageErrors.length || !variantConnection) {
      throw new Error(`Could not read existing lens catalog variants: ${JSON.stringify(variantPageErrors)}`);
    }
    allExistingVariants.push(...variantConnection.nodes);
    variantCursor = variantConnection.pageInfo.hasNextPage ? variantConnection.pageInfo.endCursor : null;
    if (variantConnection.pageInfo.hasNextPage && !variantCursor) {
      throw new Error("Shopify returned an invalid lens catalog variant cursor.");
    }
  } while (variantCursor);
  product.variants = { nodes: allExistingVariants };

  let primaryOption = product.options?.find((option: { name: string }) => option.name === optionName)
    ?? product.options?.[0];
  if (!primaryOption) throw new Error("Lens catalog product has no option to migrate.");
  const itemByCode = new Map(catalogItems.map((item) => [item.code, item]));
  const legacyValueByVariantId = new Map<string, string>();
  for (const variant of allExistingVariants) {
    if (variant.sku && itemByCode.has(variant.sku)) continue;
    const idSuffix = variant.id.split("/").pop();
    const fallback = `Unmapped catalog variant (${variant.sku || idSuffix})`;
    legacyValueByVariantId.set(variant.id, fallback);
  }
  const currentValueNames = new Set(primaryOption.optionValues?.map((value: { name: string }) => value.name) ?? []);
  const migrationOptionValues = [
    ...optionValues,
    ...[...new Set(legacyValueByVariantId.values())].map((name) => ({ name })),
  ];
  const valuesToAdd = migrationOptionValues.filter(({ name }) => !currentValueNames.has(name));
  const optionMigration = await admin.graphql(`#graphql
    mutation PrepareFlatLensCatalogOption($productId: ID!, $option: OptionUpdateInput!, $values: [OptionValueCreateInput!]) {
      productOptionUpdate(productId: $productId, option: $option, optionValuesToAdd: $values, variantStrategy: LEAVE_AS_IS) {
        product { id options { id name optionValues { id name } } }
        userErrors { field message }
      }
    }`, { variables: { productId: product.id, option: { id: primaryOption.id, name: optionName, position: 1 }, values: valuesToAdd } });
  const migrationData = await optionMigration.json() as any;
  const migrationErrors = graphqlErrors(migrationData);
  const migrationUserErrors = migrationData.data?.productOptionUpdate?.userErrors;
  if (!optionMigration.ok || migrationErrors.length || migrationUserErrors?.length) {
    throw new Error(`Could not prepare flat lens catalog option: ${JSON.stringify(migrationErrors.length ? migrationErrors : migrationUserErrors)}`);
  }
  product.options = migrationData.data?.productOptionUpdate?.product?.options ?? product.options;
  primaryOption = product.options?.find((option: { name: string }) => option.name === optionName);
  if (!primaryOption) throw new Error("Shopify did not return the updated lens catalog option.");

  const existingVariants = product.variants?.nodes ?? [];
  const existingSkuList = existingVariants.map((variant: { sku?: string | null }) => variant.sku).filter(Boolean) as string[];
  const duplicateExistingSkus = existingSkuList.filter((sku, index) => existingSkuList.indexOf(sku) !== index);
  if (duplicateExistingSkus.length) throw new Error(`Duplicate Shopify catalog SKUs: ${[...new Set(duplicateExistingSkus)].join(", ")}`);
  const existingSkus = new Set(existingSkuList);
  const firstUnassignedItem = catalogItems.find(({ code }) => !existingSkus.has(code));
  const updates = existingVariants.flatMap((variant: { id: string; sku?: string | null; selectedOptions?: { name: string; value: string }[] }, index: number) => {
    let item = variant.sku ? itemByCode.get(variant.sku) : undefined;
    if (!item && !variant.sku && index === 0) item = firstUnassignedItem;
    if (!item) {
      const name = legacyValueByVariantId.get(variant.id);
      return name ? [{ id: variant.id, optionValues: [{ optionName, name }] }] : [];
    }
    const alreadyFlat = variant.selectedOptions?.length === 1
      && variant.selectedOptions[0].name === optionName
      && variant.selectedOptions[0].value === item.optionValue;
    if (alreadyFlat && variant.sku) return [];
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

  const obsoleteOptionIds = (product.options ?? [])
    .filter((option: { id: string; name: string }) => option.id !== primaryOption.id)
    .map((option: { id: string }) => option.id);
  if (obsoleteOptionIds.length) {
    const removeOptions = await admin.graphql(`#graphql
      mutation RemoveLensCatalogGroupingOptions($productId: ID!, $options: [ID!]!) {
        productOptionsDelete(productId: $productId, options: $options, strategy: NON_DESTRUCTIVE) {
          deletedOptionsIds
          userErrors { field message }
        }
      }`, { variables: { productId: product.id, options: obsoleteOptionIds } });
    const removeData = await removeOptions.json() as any;
    const removeErrors = graphqlErrors(removeData);
    const removeUserErrors = removeData.data?.productOptionsDelete?.userErrors;
    if (!removeOptions.ok || removeErrors.length || removeUserErrors?.length) {
      throw new Error(`Could not remove lens catalog grouping options: ${JSON.stringify(removeErrors.length ? removeErrors : removeUserErrors)}`);
    }
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
