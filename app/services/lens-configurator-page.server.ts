import { authenticate } from "../shopify.server";
import { loadLensCatalog } from "./lens-catalog.server";
import { parseMajorToMinorUnits } from "app/utils/currency";
import {
  applyShopLensPricesToCatalog,
  loadShopLensPriceComponents,
} from "./shopify-lens-pricing.server";

type LensCatalog = Awaited<ReturnType<typeof loadLensCatalog>>;

const getGraphqlErrors = (body: unknown) => {
  if (typeof body !== "object" || body === null) return [];
  const errors = "errors" in body ? body.errors : undefined;
  return Array.isArray(errors) ? errors : [];
};

type AdminGraphqlClient = {
  graphql(
    query: string,
    options?: { variables?: Record<string, unknown> },
  ): Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;
};

async function ensureLensCartTransform(admin: AdminGraphqlClient) {
  try {
    const lookup = await admin.graphql(`#graphql
      query LensCartTransforms {
        cartTransforms(first: 1) {
          nodes { id }
        }
      }`);
    const lookupBody = await lookup.json();
    const lookupErrors = getGraphqlErrors(lookupBody);
    if (!lookup.ok || lookupErrors.length > 0) {
      console.error("Lens cart transform lookup failed:", lookup.status, lookupErrors);
      return;
    }

    const existing = (lookupBody as { data?: { cartTransforms?: { nodes?: unknown[] } } })
      .data?.cartTransforms?.nodes ?? [];
    if (existing.length > 0) return;

    const creation = await admin.graphql(`#graphql
      mutation CreateLensCartTransform {
        cartTransformCreate(functionHandle: "lens-price", blockOnFailure: false) {
          cartTransform { id }
          userErrors { field message }
        }
      }`);
    const creationBody = await creation.json();
    const creationErrors = getGraphqlErrors(creationBody);
    const userErrors = (creationBody as {
      data?: { cartTransformCreate?: { userErrors?: { message: string }[] } };
    }).data?.cartTransformCreate?.userErrors ?? [];
    if (!creation.ok || creationErrors.length > 0 || userErrors.length > 0) {
      console.error(
        "Lens cart transform activation failed:",
        creation.status,
        creationErrors,
        userErrors,
      );
    }
  } catch (error) {
    console.error("Lens cart transform activation failed:", error);
  }
}

function emptyLensCatalog(currencyCode: string): LensCatalog {
  return {
    currencyCode,
    pricingAvailable: false,
    lensTypes: [],
    lensIndices: [],
    lensOptions: [],
    rules: [],
    lensIndexCompatibilities: [],
    lensTechnologies: [],
    lensTechnologyIndexCompatibility: [],
    prescriptionMethods: [],
  };
}

function withoutCatalogPrices(catalog: LensCatalog): LensCatalog {
  return {
    ...catalog,
    pricingAvailable: false,
    lensTypes: catalog.lensTypes.map((lensType) => ({
      ...lensType,
      prices: [],
    })),
    lensIndices: catalog.lensIndices.map((lensIndex) => ({
      ...lensIndex,
      prices: [],
    })),
    lensOptions: catalog.lensOptions.map((option) => ({
      ...option,
      prices: [],
      lensTechnologyOptions: option.lensTechnologyOptions.map((mapping) => ({
        ...mapping,
        lensTechnology: {
          ...mapping.lensTechnology,
          lensPrices: [],
        },
      })),
    })),
    lensTechnologies: catalog.lensTechnologies.map((technology) => ({
      ...technology,
      lensPrices: [],
    })),
  };
}

const safeImageUrl = (raw: string | null): string | null => {
  if (!raw) return null;

  try {
    const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);

    const isShopifyImage =
      url.protocol === "https:" &&
      (url.hostname === "cdn.shopify.com" ||
        url.hostname.endsWith(".myshopify.com") ||
        url.pathname.startsWith("/cdn/shop/"));

    return isShopifyImage ? url.toString() : null;
  } catch {
    return null;
  }
};

export async function loadLensConfiguratorPage(
  request: Request,
  frameSelection?: { productId: string; variantId: string },
  authMode: "appProxy" | "admin" = new URL(request.url).searchParams.has(
    "signature",
  )
    ? "appProxy"
    : "admin",
) {
  const url = new URL(request.url);

  const { admin, session } = authMode === "appProxy"
    ? await authenticate.public.appProxy(request)
    : await authenticate.admin(request);

  const shop = session?.shop ?? "";

  if (!admin || !shop) {
    throw new Response(
      "Unable to verify this store's currency. Please refresh the page or contact support.",
      { status: 503 },
    );
  }

  await ensureLensCartTransform(admin);

  const requestedCurrency = url.searchParams.get("currency")?.toUpperCase();
  const requestedCountry = url.searchParams.get("country")?.toUpperCase();
  const countryCode = requestedCountry && /^[A-Z]{2}$/.test(requestedCountry)
    ? requestedCountry
    : undefined;
  let currencyCode = "USD";
  let storeCurrencyCode = "USD";
  let currencyVerified = false;
  try {
    const currencyResponse = await admin.graphql(`#graphql
      query StoreCurrency {
        shop {
          currencyCode
        }
      }`);
    const currencyJson = await currencyResponse.json();
    const currencyErrors = getGraphqlErrors(currencyJson);
    const shopCurrency = currencyJson.data?.shop?.currencyCode;

    if (
      currencyResponse.ok &&
      currencyErrors.length === 0 &&
      typeof shopCurrency === "string" &&
      /^[A-Z]{3}$/.test(shopCurrency)
    ) {
      currencyCode = shopCurrency;
      storeCurrencyCode = shopCurrency;
      currencyVerified = true;
    } else {
      console.error(
        "Shop currency lookup failed; continuing without prices:",
        currencyResponse.status,
        currencyErrors,
      );
    }
  } catch (error) {
    console.error("Shop currency lookup failed; continuing without prices:", error);
  }

  const requestedCurrencyMatchesShop =
    !requestedCurrency ||
    (/^[A-Z]{3}$/.test(requestedCurrency) &&
      (requestedCurrency === storeCurrencyCode || Boolean(countryCode)));
  if (countryCode && requestedCurrency && /^[A-Z]{3}$/.test(requestedCurrency)) {
    currencyCode = requestedCurrency;
  }

  let catalog: LensCatalog;
  let catalogAvailable = true;
  try {
    // The database supplies the catalog structure and labels. Shopify variants
    // replace its USD price amounts below, so no exchange-rate lookup is needed.
    catalog = await loadLensCatalog("USD");
  } catch (error) {
    console.error("Lens catalog lookup failed:", error);
    catalog = emptyLensCatalog(currencyCode);
    catalogAvailable = false;
  }
  let pricingAvailable =
    currencyVerified && requestedCurrencyMatchesShop && catalogAvailable;

  let product = {
    productId: null as string | null,
    variantId: null as string | null,
    variantTitle: null as string | null,
    image: null as string | null,
  };
  let framePriceMinor = 0;

  if (frameSelection) {
    const productGid = `gid://shopify/Product/${frameSelection.productId}`;
    const variantGid = `gid://shopify/ProductVariant/${frameSelection.variantId}`;
    let frameLookupSucceeded = false;
    try {
      const frameQuery = countryCode
        ? `#graphql
        query LensFrameSelection($variantId: ID!, $country: CountryCode!) {
          productVariant(id: $variantId) {
            id
            title
            contextualPricing(context: { country: $country }) {
              price { amount currencyCode }
            }
            media(first: 1) {
              nodes {
                ... on MediaImage {
                  image { url }
                }
              }
            }
            product {
              id
              featuredMedia {
                ... on MediaImage {
                  image { url }
                }
              }
            }
          }
        }`
        : `#graphql
        query LensFrameSelection($variantId: ID!) {
          productVariant(id: $variantId) {
            id
            title
            price
            media(first: 1) {
              nodes {
                ... on MediaImage {
                  image { url }
                }
              }
            }
            product {
              id
              featuredMedia {
                ... on MediaImage {
                  image { url }
                }
              }
            }
          }
        }`;
      const frameVariables: Record<string, unknown> = { variantId: variantGid };
      if (countryCode) frameVariables.country = countryCode;
      const frameResponse = await admin.graphql(frameQuery, {
        variables: frameVariables,
      });
      const frameJson = await frameResponse.json();
      const variant = frameJson.data?.productVariant;
      const frameErrors = getGraphqlErrors(frameJson);
      frameLookupSucceeded =
        frameResponse.ok &&
        frameErrors.length === 0 &&
        variant?.product?.id === productGid &&
        variant.id === variantGid;

      if (frameLookupSucceeded) {
        product = {
          productId: frameSelection.productId,
          variantId: frameSelection.variantId,
          variantTitle: variant.title,
          image: safeImageUrl(
            variant.media?.nodes?.[0]?.image?.url ??
              variant.product.featuredMedia?.image?.url ??
              null,
          ),
        };

        if (pricingAvailable) {
          const frameMoney = countryCode
            ? variant.contextualPricing?.price
            : { amount: variant.price, currencyCode: storeCurrencyCode };
          const parsedFramePrice = Number(frameMoney?.amount);
          if (!Number.isFinite(parsedFramePrice) || parsedFramePrice < 0) {
            console.error("Selected frame returned an invalid price.");
            pricingAvailable = false;
          } else {
            try {
              framePriceMinor = parseMajorToMinorUnits(
                String(frameMoney?.amount),
                frameMoney?.currencyCode ?? currencyCode,
              );
              currencyCode = frameMoney?.currencyCode ?? currencyCode;
              if (requestedCurrency && currencyCode !== requestedCurrency) {
                pricingAvailable = false;
              }
            } catch (error) {
              console.error("Selected frame returned an invalid currency price:", error);
              pricingAvailable = false;
            }
          }
        }
      } else {
        console.error(
          "Selected frame could not be verified; continuing without frame details:",
          frameResponse.status,
          frameErrors,
        );
      }
    } catch (error) {
      console.error("Selected frame lookup failed; continuing without frame details:", error);
    }

    if (!frameLookupSucceeded) {
      product = {
        productId: frameSelection.productId,
        variantId: frameSelection.variantId,
        variantTitle: null,
        image: null,
      };
      pricingAvailable = false;
    }
  }

  let lensVariantIdByCode: Record<string, string> = {};
  let lensVariantsLoaded = false;
  if (pricingAvailable) {
    try {
      const priceMappings = await loadShopLensPriceComponents(
        admin,
        currencyCode,
        catalog,
        countryCode,
      );
      if (
        requestedCurrency &&
        priceMappings.currencyCode !== requestedCurrency
      ) {
        pricingAvailable = false;
        console.error(
          "Shopify contextual lens prices do not match the storefront currency:",
          priceMappings.currencyCode,
          requestedCurrency,
        );
      } else if (priceMappings.missingPriceCodes.length > 0) {
        console.error(
          "Shopify lens-upgrade prices could not be resolved for catalog price components (expected exact catalog-code SKUs):",
          priceMappings.missingPriceCodes,
        );
      }

      currencyCode = priceMappings.currencyCode;
      catalog = applyShopLensPricesToCatalog(
        catalog,
        priceMappings.priceByCode,
        currencyCode,
      );
      lensVariantIdByCode = Object.fromEntries(
        Object.entries(priceMappings.priceByCode).map(([code, price]) => [
          code,
          price.variantId,
        ]),
      );
      lensVariantsLoaded = true;
    } catch (error) {
      console.error("Shopify lens prices could not be loaded:", error);
      pricingAvailable = false;
    }
  }

  catalog = { ...catalog, currencyCode };
  if (!pricingAvailable) catalog = withoutCatalogPrices(catalog);

  const lensIndices = catalog.lensIndices.map((index) => ({
    ...index,
    refractiveIndex: Number(index.refractiveIndex),
  }));

  return {
    shop,
    currencyCode,
    pricingAvailable,
    catalogAvailable,
    proxyPathPrefix: url.searchParams.get("path_prefix"),
    framePriceMinor,
    product,
    lensIndices,
    lensVariantsLoaded,
    lensVariantIdByCode,
    catalog: {
      lensTypes: catalog.lensTypes,
      lensOptions: catalog.lensOptions,
      lensIndexCompatibilities: catalog.lensIndexCompatibilities,
      lensTechnology: catalog.lensTechnologies,
      lensTechnologyIndexCompatibility: catalog.lensTechnologyIndexCompatibility,
      prescriptionMethods: catalog.prescriptionMethods,
    },
  };
}

export type LensConfiguratorPageData = Awaited<
  ReturnType<typeof loadLensConfiguratorPage>
>;

export async function loadLensConfiguratorFallback(
  request: Request,
): Promise<LensConfiguratorPageData> {
  const url = new URL(request.url);
  const requestedCurrency = url.searchParams.get("currency")?.toUpperCase();
  const currencyCode =
    requestedCurrency && /^[A-Z]{3}$/.test(requestedCurrency)
      ? requestedCurrency
      : "USD";
  const parseNumericId = (value: string | null) => {
    const match = value?.match(/\d{1,20}$/);
    return match?.[0] ?? null;
  };
  let catalog: LensCatalog;
  let catalogAvailable = true;

  try {
    catalog = await loadLensCatalog("USD");
  } catch (error) {
    console.error("Fallback lens catalog lookup failed:", error);
    catalog = emptyLensCatalog(currencyCode);
    catalogAvailable = false;
  }

  catalog = withoutCatalogPrices(catalog);

  return {
    shop: "",
    currencyCode,
    pricingAvailable: false,
    catalogAvailable,
    proxyPathPrefix: url.searchParams.get("path_prefix"),
    framePriceMinor: 0,
    product: {
      productId: parseNumericId(url.searchParams.get("productId")),
      variantId: parseNumericId(url.searchParams.get("variantId")),
      variantTitle: null,
      image: null,
    },
    lensIndices: catalog.lensIndices.map((index) => ({
      ...index,
      refractiveIndex: Number(index.refractiveIndex),
    })),
    lensVariantsLoaded: false,
    lensVariantIdByCode: {},
    catalog: {
      lensTypes: catalog.lensTypes,
      lensOptions: catalog.lensOptions,
      lensIndexCompatibilities: catalog.lensIndexCompatibilities,
      lensTechnology: catalog.lensTechnologies,
      lensTechnologyIndexCompatibility:
        catalog.lensTechnologyIndexCompatibility,
      prescriptionMethods: catalog.prescriptionMethods,
    },
  };
}
