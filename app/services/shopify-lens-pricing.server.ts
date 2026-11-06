import prisma from "app/db.server";
import {
  minorUnitsToMajorDecimalString,
  parseMajorToMinorUnits,
} from "app/utils/currency";
import type { loadLensCatalog } from "./lens-catalog.server";

const PRODUCT_HANDLE = "lens-upgrade";
const VARIANT_PAGE_SIZE = 100;
const VARIANT_UPDATE_BATCH_SIZE = 100;
const MAX_VARIANT_PAGES = 25;

type Catalog = Awaited<ReturnType<typeof loadLensCatalog>>;
type PriceComponent = {
  code: string;
  amountMinor: number;
};

type AdminGraphqlClient = {
  graphql(
    query: string,
    options?: { variables?: Record<string, unknown> },
  ): Promise<{
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }>;
};

type ShopifyVariant = {
  id: string;
  sku: string | null;
  price: string;
};

type ProductVariantPage = {
  productByIdentifier?: {
    id: string;
    variants: {
      nodes: ShopifyVariant[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

export class ShopLensPricingError extends Error {}

function getGraphqlErrors(body: unknown): unknown[] {
  if (typeof body !== "object" || body === null) return [];
  const errors = "errors" in body ? body.errors : undefined;
  return Array.isArray(errors) ? errors : [];
}

async function executeGraphql<T>(
  admin: AdminGraphqlClient,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  let response: Awaited<ReturnType<AdminGraphqlClient["graphql"]>>;
  let body: unknown;
  try {
    response = await admin.graphql(query, { variables });
    body = await response.json();
  } catch (error) {
    console.error("Shopify lens-pricing GraphQL request failed:", error);
    throw new ShopLensPricingError("Shopify pricing could not be verified.");
  }

  const errors = getGraphqlErrors(body);
  if (!response.ok || errors.length > 0) {
    console.error(
      "Shopify lens-pricing GraphQL request returned errors:",
      response.status,
      errors,
    );
    throw new ShopLensPricingError("Shopify pricing could not be verified.");
  }

  if (typeof body !== "object" || body === null || !("data" in body)) {
    throw new ShopLensPricingError("Shopify returned an invalid pricing response.");
  }
  return (body as { data: T }).data;
}

export function collectLensPriceComponents(
  catalog: Catalog,
): PriceComponent[] {
  const components = new Map<string, number>();
  const addPrices = (prices: { code: string; amountMinor: number }[]) => {
    for (const price of prices) {
      if (!Number.isSafeInteger(price.amountMinor) || price.amountMinor < 0) {
        throw new ShopLensPricingError(
          `Lens price "${price.code}" has an invalid amount.`,
        );
      }
      const previousAmount = components.get(price.code);
      if (
        previousAmount !== undefined &&
        previousAmount !== price.amountMinor
      ) {
        throw new ShopLensPricingError(
          `Lens price "${price.code}" has inconsistent catalog amounts.`,
        );
      }
      components.set(price.code, price.amountMinor);
    }
  };

  catalog.lensTypes.forEach((lensType) => addPrices(lensType.prices));
  catalog.lensIndices.forEach((lensIndex) => addPrices(lensIndex.prices));
  catalog.lensOptions.forEach((option) => {
    addPrices(option.prices);
    option.lensTechnologyOptions.forEach((mapping) =>
      addPrices(mapping.lensTechnology.lensPrices),
    );
  });
  catalog.lensTechnologies.forEach((technology) =>
    addPrices(technology.lensPrices),
  );

  return [...components].map(([code, amountMinor]) => ({
    code,
    amountMinor,
  })).filter(({ amountMinor }) => amountMinor > 0);
}

async function loadLensUpgradeVariants(
  admin: AdminGraphqlClient,
): Promise<{ productGid: string; variants: ShopifyVariant[] }> {
  const variants: ShopifyVariant[] = [];
  let cursor: string | null = null;
  let productGid: string | null = null;
  let pageCount = 0;

  do {
    pageCount += 1;
    if (pageCount > MAX_VARIANT_PAGES) {
      throw new ShopLensPricingError(
        "The lens-upgrade product has too many variants to synchronize safely.",
      );
    }

    const data: ProductVariantPage = await executeGraphql<ProductVariantPage>(
      admin,
      `#graphql
        query LensUpgradeProductVariants($handle: String!, $cursor: String) {
          productByIdentifier(identifier: { handle: $handle }) {
            id
            variants(first: ${VARIANT_PAGE_SIZE}, after: $cursor) {
              nodes {
                id
                sku
                price
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }`,
      { handle: PRODUCT_HANDLE, cursor },
    );

    const productResponse = data.productByIdentifier;
    if (!productResponse) {
      throw new ShopLensPricingError(
        "The lens-upgrade product is missing from this Shopify store.",
      );
    }
    const product: NonNullable<ProductVariantPage["productByIdentifier"]> =
      productResponse;
    if (productGid && productGid !== product.id) {
      throw new ShopLensPricingError(
        "The lens-upgrade product changed during synchronization.",
      );
    }
    productGid = product.id;
    variants.push(...product.variants.nodes);

    if (product.variants.pageInfo.hasNextPage) {
      const nextCursor: string | null = product.variants.pageInfo.endCursor;
      if (!nextCursor || nextCursor === cursor) {
        throw new ShopLensPricingError(
          "Shopify returned an invalid lens variant cursor.",
        );
      }
      cursor = nextCursor;
    } else {
      cursor = null;
    }
  } while (cursor !== null);

  if (!productGid) {
    throw new ShopLensPricingError(
      "The lens-upgrade product is missing from this Shopify store.",
    );
  }
  return { productGid, variants };
}

function getVariantId(variantGid: string): string {
  const match = /\/ProductVariant\/(\d+)$/.exec(variantGid);
  if (!match) {
    throw new ShopLensPricingError(
      "Shopify returned an invalid lens variant identifier.",
    );
  }
  return match[1];
}

function getMappedVariants(
  variants: ShopifyVariant[],
  components: PriceComponent[],
): Map<string, ShopifyVariant> {
  const componentCodes = new Set(components.map(({ code }) => code));
  const variantsByCode = new Map<string, ShopifyVariant>();
  for (const variant of variants) {
    if (!variant.sku || !componentCodes.has(variant.sku)) continue;
    if (variantsByCode.has(variant.sku)) {
      throw new ShopLensPricingError(
        `More than one lens-upgrade variant uses master price code "${variant.sku}".`,
      );
    }
    variantsByCode.set(variant.sku, variant);
  }

  const missingCodes = components
    .filter(({ code }) => !variantsByCode.has(code))
    .map(({ code }) => code);
  if (missingCodes.length > 0) {
    console.error(
      "Shopify lens pricing is missing variants mapped by master price SKU:",
      missingCodes,
    );
    throw new ShopLensPricingError(
      "Shopify lens variants are missing stable master-price SKU mappings.",
    );
  }
  return variantsByCode;
}

async function updateVariantPrices(
  admin: AdminGraphqlClient,
  productGid: string,
  updates: { id: string; price: string; amountMinor: number }[],
  currencyCode: string,
): Promise<void> {
  for (
    let start = 0;
    start < updates.length;
    start += VARIANT_UPDATE_BATCH_SIZE
  ) {
    const batch = updates.slice(start, start + VARIANT_UPDATE_BATCH_SIZE);
    const data = await executeGraphql<{
      productVariantsBulkUpdate?: {
        productVariants: { id: string; price: string }[] | null;
        userErrors: { field: string[] | null; message: string }[];
      } | null;
    }>(
      admin,
      `#graphql
        mutation UpdateLensVariantPrices(
          $productId: ID!
          $variants: [ProductVariantsBulkInput!]!
        ) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
            }
            userErrors {
              field
              message
            }
          }
        }`,
      {
        productId: productGid,
        variants: batch.map(({ id, price }) => ({ id, price })),
      },
    );

    const result = data.productVariantsBulkUpdate;
    if (!result || result.userErrors.length > 0) {
      console.error(
        "Shopify rejected lens variant price updates:",
        result?.userErrors ?? [],
      );
      throw new ShopLensPricingError(
        "Shopify could not synchronize all lens variant prices.",
      );
    }

    const updatedById = new Map(
      (result.productVariants ?? []).map((variant) => [
        variant.id,
        variant.price,
      ]),
    );
    for (const update of batch) {
      const updatedPrice = updatedById.get(update.id);
      if (
        updatedPrice === undefined ||
        parseMajorToMinorUnits(updatedPrice, currencyCode) !==
          update.amountMinor
      ) {
        throw new ShopLensPricingError(
          "Shopify did not confirm the synchronized lens variant price.",
        );
      }
    }
  }
}

export async function syncShopLensPricing(
  admin: AdminGraphqlClient,
  shop: string,
  currencyCode: string,
  catalog: Catalog,
): Promise<Record<string, string>> {
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
    throw new ShopLensPricingError(
      "The authenticated Shopify shop domain is invalid.",
    );
  }
  if (!catalog.pricingAvailable || catalog.currencyCode !== currencyCode) {
    throw new ShopLensPricingError(
      "Lens prices are not available in the authenticated store currency.",
    );
  }

  const components = collectLensPriceComponents(catalog);
  if (components.length === 0) {
    throw new ShopLensPricingError("No active lens prices are configured.");
  }

  const { productGid, variants } = await loadLensUpgradeVariants(admin);
  const variantsByCode = getMappedVariants(variants, components);
  const existingMappings = await prisma.shopLensVariantMapping.findMany({
    where: { shop, productGid },
  });
  const mappingByVariant = new Map(
    existingMappings.map((mapping) => [mapping.variantGid, mapping]),
  );
  for (const component of components) {
    const variant = variantsByCode.get(component.code);
    const existingMapping = variant
      ? mappingByVariant.get(variant.id)
      : undefined;
    if (
      existingMapping &&
      existingMapping.lensPriceCode !== component.code
    ) {
      throw new ShopLensPricingError(
        "A Shopify variant is already mapped to a different master price.",
      );
    }
  }

  const updates: {
    id: string;
    price: string;
    amountMinor: number;
  }[] = [];

  for (const component of components) {
    const variant = variantsByCode.get(component.code);
    if (!variant) {
      throw new ShopLensPricingError(
        `Shopify variant mapping is missing for "${component.code}".`,
      );
    }
    if (
      parseMajorToMinorUnits(variant.price, currencyCode) !==
      component.amountMinor
    ) {
      updates.push({
        id: variant.id,
        price: minorUnitsToMajorDecimalString(
          component.amountMinor,
          currencyCode,
        ),
        amountMinor: component.amountMinor,
      });
    }
  }

  if (updates.length > 0) {
    await updateVariantPrices(admin, productGid, updates, currencyCode);
  }

  for (const component of components) {
    const variant = variantsByCode.get(component.code);
    if (!variant) continue;

    const existingMapping = mappingByVariant.get(variant.id);
    if (
      existingMapping?.lensPriceCode === component.code &&
      existingMapping.currencyCode === currencyCode &&
      existingMapping.syncedAmountMinor === component.amountMinor
    ) {
      continue;
    }

    await prisma.shopLensVariantMapping.upsert({
      where: {
        shop_lensPriceCode: { shop, lensPriceCode: component.code },
      },
      create: {
        shop,
        lensPriceCode: component.code,
        productGid,
        variantGid: variant.id,
        currencyCode,
        syncedAmountMinor: component.amountMinor,
      },
      update: {
        productGid,
        variantGid: variant.id,
        currencyCode,
        syncedAmountMinor: component.amountMinor,
        syncedAt: new Date(),
      },
    });
  }

  return Object.fromEntries(
    components.map(({ code }) => {
      const variant = variantsByCode.get(code);
      if (!variant) {
        throw new ShopLensPricingError(
          `Shopify variant mapping is missing for "${code}".`,
        );
      }
      return [code, getVariantId(variant.id)];
    }),
  );
}
