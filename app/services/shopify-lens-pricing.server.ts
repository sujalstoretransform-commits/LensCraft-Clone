import { parseMajorToMinorUnits } from "app/utils/currency";

const PRODUCT_HANDLE = "lens-upgrade";
const VARIANT_PAGE_SIZE = 100;
const MAX_VARIANT_PAGES = 25;

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

function getVariantId(variantGid: string): string {
  const match = /\/ProductVariant\/(\d+)$/.exec(variantGid);
  if (!match) {
    throw new ShopLensPricingError(
      "Shopify returned an invalid lens variant identifier.",
    );
  }
  return match[1];
}

/**
 * Loads the existing price-tier variants for the single Lens upgrade cart line.
 * Keys are currency minor-unit amounts (for example "26500" for USD 265.00).
 */
export async function loadShopLensVariantsByPrice(
  admin: AdminGraphqlClient,
  currencyCode: string,
): Promise<Record<string, string>> {
  const variantsByPrice: Record<string, string> = {};
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

    const data = await executeGraphql<ProductVariantPage>(
      admin,
      `#graphql
        query LensUpgradeProductVariants($handle: String!, $cursor: String) {
          productByIdentifier(identifier: { handle: $handle }) {
            id
            variants(first: ${VARIANT_PAGE_SIZE}, after: $cursor) {
              nodes {
                id
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

    for (const variant of product.variants.nodes) {
      try {
        const amountMinor = parseMajorToMinorUnits(variant.price, currencyCode);
        const key = String(amountMinor);
        // Variants with an identical price are interchangeable for checkout.
        variantsByPrice[key] ??= getVariantId(variant.id);
      } catch (error) {
        console.warn("Skipping a lens-upgrade variant with an invalid price:", error);
      }
    }

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

  return variantsByPrice;
}
