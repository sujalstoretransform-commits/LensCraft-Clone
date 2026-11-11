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
  title: string;
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
  missingPriceNames: string[];
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

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
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

function addPriceName(namesByCode: Map<string, string>, code: string, name: string) {
  const existing = namesByCode.get(code);
  if (existing && normalize(existing) !== normalize(name)) {
    throw new ShopLensPricingError(
      `Lens price "${code}" has inconsistent product-name mappings.`,
    );
  }
  namesByCode.set(code, name);
}

function getPriceNames(catalog: Catalog): Map<string, string> {
  const namesByCode = new Map<string, string>();

  for (const lensType of catalog.lensTypes) {
    for (const price of lensType.prices) {
      if (!price.lensIndex) {
        addPriceName(namesByCode, price.code, lensType.name);
        continue;
      }

      // Index prices are independent price components in the configurator.
      addPriceName(namesByCode, price.code, `Index ${price.lensIndex.code}`);
    }
  }

  for (const option of catalog.lensOptions) {
    for (const price of option.prices) {
      addPriceName(namesByCode, price.code, option.name);
    }
  }

  for (const technology of catalog.lensTechnologies) {
    for (const price of technology.lensPrices) {
      addPriceName(namesByCode, price.code, technology.name);
    }
  }

  return namesByCode;
}

function variantMatchesNameGroups(
  variant: ShopifyVariant,
  requiredName: string,
): boolean {
  const optionValues = variant.selectedOptions.map(({ value }) => normalize(value));
  const title = normalize(variant.title);
  const normalizedName = normalize(requiredName);
  return (
    optionValues.includes(normalizedName) ||
    title === normalizedName ||
    title.includes(normalizedName)
  );
}

export async function loadShopLensPriceComponents(
  admin: AdminGraphqlClient,
  currencyCode: string,
  catalog: Catalog,
  countryCode?: string,
): Promise<PriceMappingResult> {
  const namesByCode = getPriceNames(catalog);
  if (namesByCode.size === 0) {
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
                  title
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
                  title
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
  const missingPriceNames: string[] = [];
  let resolvedCurrencyCode: string | null = null;

  for (const [code, requiredName] of namesByCode) {
    const matchingVariants = variants.filter((variant) =>
      variantMatchesNameGroups(variant, requiredName),
    );
    if (matchingVariants.length !== 1) {
      missingPriceNames.push(requiredName);
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
      missingPriceNames.push(requiredName);
      continue;
    }

    if (pricedVariants.length !== 1) {
      missingPriceNames.push(requiredName);
      continue;
    }

    const variant = pricedVariants[0].variant;
    resolvedCurrencyCode ??= pricedVariants[0].currencyCode;
    priceByCode[code] = {
      variantId: getVariantId(variant.id),
      amountMinor: pricedVariants[0].amountMinor,
    };
  }

  return {
    priceByCode,
    missingPriceNames,
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
