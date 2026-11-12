import { parseMajorToMinorUnits } from "app/utils/currency";
import type { loadLensCatalog } from "./lens-catalog.server";

const PRODUCT_HANDLE = "lens-upgrade";
const VARIANT_PAGE_SIZE = 100;
const MAX_VARIANT_PAGES = 25;

type Catalog = Awaited<ReturnType<typeof loadLensCatalog>>;

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
  price?: string;
  contextualPricing?: {
    price?: { amount: string; currencyCode: string } | null;
  } | null;
  selectedOptions: { name: string; value: string }[];
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

type VariantPrice = {
  variantId: string;
  amountMinor: number;
};

type PriceMappingResult = {
  priceByCode: Record<string, VariantPrice>;
  missingPriceCodes: string[];
  currencyCode: string;
};

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
    throw new ShopLensPricingError("Shopify lens prices could not be loaded.");
  }

  const errors = getGraphqlErrors(body);
  if (!response.ok || errors.length > 0) {
    console.error(
      "Shopify lens-pricing GraphQL request returned errors:",
      response.status,
      errors,
    );
    throw new ShopLensPricingError("Shopify lens prices could not be loaded.");
  }

  if (typeof body !== "object" || body === null || !("data" in body)) {
    throw new ShopLensPricingError("Shopify returned an invalid pricing response.");
  }
  return (body as { data: T }).data;
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

type PriceSkuMapping = { sku: string; label: string };

function addPriceSku(
  mappingsByPriceCode: Map<string, PriceSkuMapping>,
  priceCode: string,
  sku: string,
  label: string,
) {
  mappingsByPriceCode.set(priceCode, { sku, label });
}

function getPriceSkuMappings(catalog: Catalog): Map<string, PriceSkuMapping> {
  const mappingsByPriceCode = new Map<string, PriceSkuMapping>();

  for (const lensType of catalog.lensTypes) {
    for (const price of lensType.prices) {
      const sku = price.lensIndex
        ? price.lensIndex.code
        : lensType.code;
      addPriceSku(mappingsByPriceCode, price.code, sku, price.code);
    }
  }

  for (const option of catalog.lensOptions) {
    for (const price of option.prices) {
      addPriceSku(
        mappingsByPriceCode,
        price.code,
        option.code,
        price.code,
      );
    }
  }

  for (const technology of catalog.lensTechnologies) {
    for (const price of technology.lensPrices) {
      addPriceSku(
        mappingsByPriceCode,
        price.code,
        technology.code,
        price.code,
      );
    }
  }

  return mappingsByPriceCode;
}

export async function loadShopLensPriceComponents(
  admin: AdminGraphqlClient,
  currencyCode: string,
  catalog: Catalog,
  countryCode?: string,
): Promise<PriceMappingResult> {
  const priceSkuMappings = getPriceSkuMappings(catalog);
  if (priceSkuMappings.size === 0) {
    throw new ShopLensPricingError("No active lens prices are configured.");
  }
  const variants: ShopifyVariant[] = [];
  let cursor: string | null = null;
  let productGid: string | null = null;
  let pageCount = 0;

  do {
    pageCount += 1;
    if (pageCount > MAX_VARIANT_PAGES) {
      throw new ShopLensPricingError(
        "The lens-upgrade product has too many variants to read safely.",
      );
    }

    const query = countryCode
      ? `#graphql
          query LensUpgradeProductVariants(
            $handle: String!
            $cursor: String
            $country: CountryCode!
          ) {
            productByIdentifier(identifier: { handle: $handle }) {
              id
              variants(first: ${VARIANT_PAGE_SIZE}, after: $cursor) {
                nodes {
                  id
                  sku
                  selectedOptions { name value }
                  contextualPricing(context: { country: $country }) {
                    price { amount currencyCode }
                  }
                }
                pageInfo { hasNextPage endCursor }
              }
            }
          }`
      : `#graphql
          query LensUpgradeProductVariants($handle: String!, $cursor: String) {
            productByIdentifier(identifier: { handle: $handle }) {
              id
              variants(first: ${VARIANT_PAGE_SIZE}, after: $cursor) {
                nodes {
                  id
                  sku
                  price
                  selectedOptions { name value }
                }
                pageInfo { hasNextPage endCursor }
              }
            }
          }`;

    const variables: Record<string, unknown> = {
      handle: PRODUCT_HANDLE,
      cursor,
    };
    if (countryCode) variables.country = countryCode;
    const data = await executeGraphql<ProductVariantPage>(admin, query, variables);

    const product = data.productByIdentifier;
    if (!product) {
      throw new ShopLensPricingError(
        "The lens-upgrade product is missing from this Shopify store.",
      );
    }
    if (productGid && productGid !== product.id) {
      throw new ShopLensPricingError(
        "The lens-upgrade product changed while its variants were being read.",
      );
    }
    productGid = product.id;
    variants.push(...product.variants.nodes);

    if (product.variants.pageInfo.hasNextPage) {
      const nextCursor = product.variants.pageInfo.endCursor;
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

  const priceByCode: Record<string, VariantPrice> = {};
  const missingPriceCodes: string[] = [];
  let resolvedCurrencyCode: string | null = null;

  for (const [priceCode, mapping] of priceSkuMappings) {
    const matchingVariants = variants.filter(
      (variant) => variant.sku === mapping.sku,
    );
    if (matchingVariants.length !== 1) {
      missingPriceCodes.push(`${mapping.label} (SKU ${mapping.sku})`);
      continue;
    }

    const pricedVariants = matchingVariants.flatMap((variant) => {
      try {
        const money = countryCode
          ? variant.contextualPricing?.price
          : variant.price
            ? { amount: variant.price, currencyCode }
            : null;
        if (!money) return [];
        if (resolvedCurrencyCode && money.currencyCode !== resolvedCurrencyCode) {
          return [];
        }
        return [{
          variant,
          amountMinor: parseMajorToMinorUnits(money.amount, money.currencyCode),
          currencyCode: money.currencyCode,
        }];
      } catch {
        return [];
      }
    });
    if (pricedVariants.length === 0) {
      missingPriceCodes.push(`${mapping.label} (SKU ${mapping.sku})`);
      continue;
    }

    if (pricedVariants.length !== 1) {
      missingPriceCodes.push(`${mapping.label} (SKU ${mapping.sku})`);
      continue;
    }

    const variant = pricedVariants[0].variant;
    resolvedCurrencyCode ??= pricedVariants[0].currencyCode;
    priceByCode[priceCode] = {
      variantId: getVariantId(variant.id),
      amountMinor: pricedVariants[0].amountMinor,
    };
  }

  return {
    priceByCode,
    missingPriceCodes,
    currencyCode: resolvedCurrencyCode ?? currencyCode,
  };
}

export function applyShopLensPricesToCatalog(
  catalog: Catalog,
  priceByCode: Record<string, VariantPrice>,
  currencyCode: string,
): Catalog {
  const applyPrices = <T extends { code: string; amountMinor: number }>(prices: T[]) =>
    prices.flatMap((price) => {
      const shopPrice = priceByCode[price.code];
      return shopPrice
        ? [{ ...price, amountMinor: shopPrice.amountMinor, currencyCode }]
        : [];
    });

  return {
    ...catalog,
    currencyCode,
    pricingAvailable: catalog.pricingAvailable,
    lensTypes: catalog.lensTypes.map((lensType) => ({
      ...lensType,
      prices: applyPrices(lensType.prices),
    })),
    lensIndices: catalog.lensIndices.map((lensIndex) => ({
      ...lensIndex,
      prices: applyPrices(lensIndex.prices),
    })),
    lensOptions: catalog.lensOptions.map((option) => ({
      ...option,
      prices: applyPrices(option.prices),
      lensTechnologyOptions: option.lensTechnologyOptions.map((mapping) => ({
        ...mapping,
        lensTechnology: {
          ...mapping.lensTechnology,
          lensPrices: applyPrices(mapping.lensTechnology.lensPrices),
        },
      })),
    })),
    lensTechnologies: catalog.lensTechnologies.map((technology) => ({
      ...technology,
      lensPrices: applyPrices(technology.lensPrices),
    })),
  };
}
