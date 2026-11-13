import { parseMajorToMinorUnits } from "app/utils/currency";
import type { loadLensCatalog } from "./lens-catalog.server";

const PRODUCT_HANDLES = [
  "lens-types-catalog",
  "lens-indices-catalog",
  "lens-technologies-catalog",
  "lens-options-catalog",
];
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
  title?: string | null;
  selectedOptions?: { name: string; value: string }[];
  media?: { nodes?: { image?: { url?: string | null } | null }[] } | null;
  price?: string;
  contextualPricing?: {
    price?: { amount: string; currencyCode: string } | null;
  } | null;
  productDescription?: string | null;
  productImage?: string | null;
};

type ProductVariantPage = {
  productByIdentifier?: {
    id: string;
    descriptionHtml?: string | null;
    featuredMedia?: { image?: { url?: string | null } | null } | null;
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
  name?: string;
  image?: string | null;
  description?: string | null;
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

function getCatalogCodes(catalog: Catalog): Map<string, string> {
  const labelsByCode = new Map<string, string>();
  const add = (code: string, label: string) => {
    if (!labelsByCode.has(code)) labelsByCode.set(code, label);
  };

  for (const lensType of catalog.lensTypes) add(lensType.code, lensType.name);
  for (const lensIndex of catalog.lensIndices) {
    add(lensIndex.code, `Index ${lensIndex.code}`);
  }
  for (const option of catalog.lensOptions) {
    // Clear lenses are included in the base lens price and have no separate SKU.
    if (option.code !== "clear") add(option.code, option.name);
  }
  for (const technology of catalog.lensTechnologies) {
    add(technology.code, technology.name);
  }

  return labelsByCode;
}

export async function loadShopLensPriceComponents(
  admin: AdminGraphqlClient,
  currencyCode: string,
  catalog: Catalog,
  countryCode?: string,
): Promise<PriceMappingResult> {
  const labelsByCode = getCatalogCodes(catalog);
  if (labelsByCode.size === 0) {
    throw new ShopLensPricingError("No active lens catalog codes are configured.");
  }
  const variants: ShopifyVariant[] = [];
  for (const handle of PRODUCT_HANDLES) {
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
              descriptionHtml
              featuredMedia { ... on MediaImage { image { url } } }
              variants(first: ${VARIANT_PAGE_SIZE}, after: $cursor) {
                nodes {
                  id
                  sku
                  title
                  selectedOptions { name value }
                  media(first: 1) { nodes { ... on MediaImage { image { url } } } }
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
              descriptionHtml
              featuredMedia { ... on MediaImage { image { url } } }
              variants(first: ${VARIANT_PAGE_SIZE}, after: $cursor) {
                nodes {
                  id
                  sku
                  title
                  selectedOptions { name value }
                  media(first: 1) { nodes { ... on MediaImage { image { url } } } }
                  price
                }
                pageInfo { hasNextPage endCursor }
              }
            }
          }`;

    const variables: Record<string, unknown> = {
      handle,
      cursor,
    };
    if (countryCode) variables.country = countryCode;
    const data = await executeGraphql<ProductVariantPage>(admin, query, variables);

    const product = data.productByIdentifier;
    if (!product) {
      throw new ShopLensPricingError(
        `The lens catalog product '${handle}' is missing from this Shopify store.`,
      );
    }
    if (productGid && productGid !== product.id) {
      throw new ShopLensPricingError(
        `The lens catalog product '${handle}' changed while its variants were being read.`,
      );
    }
    productGid = product.id;
    variants.push(...product.variants.nodes.map((variant) => ({
      ...variant,
      productDescription: product.descriptionHtml ?? null,
      productImage: product.featuredMedia?.image?.url ?? null,
    })));

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
      throw new ShopLensPricingError(`The lens catalog product '${handle}' is missing from this Shopify store.`);
    }
  }

  const priceByCode: Record<string, VariantPrice> = {};
  const missingPriceCodes: string[] = [];
  let resolvedCurrencyCode: string | null = null;

  for (const [code, label] of labelsByCode) {
    const matchingVariants = variants.filter(
      (variant) => variant.sku === code,
    );
    if (matchingVariants.length !== 1) {
      missingPriceCodes.push(`${label} (SKU ${code})`);
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
      missingPriceCodes.push(`${label} (SKU ${code})`);
      continue;
    }

    if (pricedVariants.length !== 1) {
      missingPriceCodes.push(`${label} (SKU ${code})`);
      continue;
    }

    const variant = pricedVariants[0].variant;
    resolvedCurrencyCode ??= pricedVariants[0].currencyCode;
    priceByCode[code] = {
      variantId: getVariantId(variant.id),
      amountMinor: pricedVariants[0].amountMinor,
      name: variant.selectedOptions?.find((option) => option.value !== "Not applicable")?.value
        ?? (variant.title && variant.title !== "Default Title" ? variant.title : label),
      image: variant.media?.nodes?.[0]?.image?.url ?? variant.productImage,
      description: variant.productDescription,
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
  const getPrice = (code: string, kind: string) => {
    const shopPrice = priceByCode[code];
    return shopPrice
      ? [{ code, kind, amountMinor: shopPrice.amountMinor, currencyCode }]
      : [];
  };
  const getShopDetails = (code: string) => {
    const item = priceByCode[code];
    return item ? {
      ...(item.name ? { name: item.name } : {}),
      ...(item.image ? { image: item.image } : {}),
      ...(item.description ? { description: item.description } : {}),
    } : {};
  };

  return {
    ...catalog,
    currencyCode,
    pricingAvailable: catalog.pricingAvailable,
    lensTypes: catalog.lensTypes.map((lensType) => ({
      ...lensType,
      ...getShopDetails(lensType.code),
      prices: [
        ...getPrice(lensType.code, "base"),
        ...catalog.lensIndices.flatMap((lensIndex) =>
          getPrice(lensIndex.code, "upgrade").map((price) => ({
            ...price,
            lensIndex: { code: lensIndex.code },
          })),
        ),
      ],
    })),
    lensIndices: catalog.lensIndices.map((lensIndex) => ({
      ...lensIndex,
      ...(priceByCode[lensIndex.code]
        ? {
            displayName: priceByCode[lensIndex.code].name ?? lensIndex.displayName,
            image: priceByCode[lensIndex.code].image ?? null,
            description: priceByCode[lensIndex.code].description ?? null,
          }
        : {}),
      prices: catalog.lensTypes.flatMap((lensType) =>
        getPrice(lensIndex.code, "upgrade").map((price) => ({
          ...price,
          lensType: { code: lensType.code },
        })),
      ),
    })),
    lensOptions: catalog.lensOptions.map((option) => ({
      ...option,
      ...getShopDetails(option.code),
      prices: getPrice(option.code, option.category === "add_on" ? "add_on" : "upgrade"),
      lensTechnologyOptions: option.lensTechnologyOptions.map((mapping) => ({
        ...mapping,
        lensTechnology: {
          ...mapping.lensTechnology,
          lensPrices: getPrice(mapping.lensTechnology.code, "upgrade"),
        },
      })),
    })),
    lensTechnologies: catalog.lensTechnologies.map((technology) => ({
      ...technology,
      ...getShopDetails(technology.code),
      lensPrices: getPrice(technology.code, "upgrade"),
    })),
  };
}
