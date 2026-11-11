import { authenticate } from "../shopify.server";
import { loadLensCatalog } from "./lens-catalog.server";
import { parseMajorToMinorUnits } from "app/utils/currency";
import { loadShopLensVariantsByPrice } from "./shopify-lens-pricing.server";

type LensCatalog = Awaited<ReturnType<typeof loadLensCatalog>>;

const getGraphqlErrors = (body: unknown) => {
  if (typeof body !== "object" || body === null) return [];
  const errors = "errors" in body ? body.errors : undefined;
  return Array.isArray(errors) ? errors : [];
};

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

  const requestedCurrency = url.searchParams.get("currency")?.toUpperCase();
  let currencyCode = "USD";
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
    const storeCurrencyCode = currencyJson.data?.shop?.currencyCode;

    if (
      currencyResponse.ok &&
      currencyErrors.length === 0 &&
      typeof storeCurrencyCode === "string" &&
      /^[A-Z]{3}$/.test(storeCurrencyCode)
    ) {
      currencyCode = storeCurrencyCode;
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
      requestedCurrency === currencyCode);

  let catalog: LensCatalog;
  let catalogAvailable = true;
  try {
    catalog = await loadLensCatalog(currencyCode);
  } catch (error) {
    console.error("Lens catalog lookup failed:", error);
    catalog = emptyLensCatalog(currencyCode);
    catalogAvailable = false;
  }
  let pricingAvailable =
    currencyVerified &&
    requestedCurrencyMatchesShop &&
    catalog.pricingAvailable;

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
      const frameResponse = await admin.graphql(
        `#graphql
        query LensFrameSelection($variantId: ID!) {
          productVariant(id: $variantId) {
            id
            title
            price
            image {
              url
            }
            product {
              id
              featuredImage {
                url
              }
            }
          }
        }`,
        { variables: { variantId: variantGid } },
      );
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
            variant.image?.url ?? variant.product.featuredImage?.url ?? null,
          ),
        };

        if (pricingAvailable) {
          const parsedFramePrice = Number(variant.price);
          if (!Number.isFinite(parsedFramePrice) || parsedFramePrice < 0) {
            console.error("Selected frame returned an invalid price.");
            pricingAvailable = false;
          } else {
            try {
              framePriceMinor = parseMajorToMinorUnits(
                String(variant.price),
                currencyCode,
              );
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

  if (!pricingAvailable) catalog = withoutCatalogPrices(catalog);

  const lensIndices = catalog.lensIndices.map((index) => ({
    ...index,
    refractiveIndex: Number(index.refractiveIndex),
  }));

  let lensVariantIdByPrice: Record<string, string> = {};
  let lensVariantsLoaded = false;
  if (pricingAvailable) {
    try {
      lensVariantIdByPrice = await loadShopLensVariantsByPrice(
        admin,
        currencyCode,
      );
      lensVariantsLoaded = true;
    } catch (error) {
      console.error("Shopify lens-upgrade variants could not be loaded:", error);
    }
  }

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
    lensVariantIdByPrice,
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
    catalog = await loadLensCatalog(currencyCode);
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
    lensVariantIdByPrice: {},
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
