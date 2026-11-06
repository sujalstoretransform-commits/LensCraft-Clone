import { authenticate } from "../shopify.server";
import {
  LENS_CURRENCY_CODE,
  loadLensCatalog,
} from "./lens-catalog.server";

const getGraphqlErrors = (body: unknown) => {
  if (typeof body !== "object" || body === null) return [];
  const errors = "errors" in body ? body.errors : undefined;
  return Array.isArray(errors) ? errors : [];
};

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

  const { admin } = authMode === "appProxy"
    ? await authenticate.public.appProxy(request)
    : await authenticate.admin(request);

  const shop = url.searchParams.get("shop") ?? "";

  if (!admin) {
    throw new Response(
      "Unable to verify this store's currency. Please refresh the page or contact support.",
      { status: 503 },
    );
  }

  let currencyResponse: Awaited<ReturnType<typeof admin.graphql>>;
  let currencyJson: Awaited<ReturnType<typeof currencyResponse.json>>;
  try {
    currencyResponse = await admin.graphql(`#graphql
      query StoreCurrency {
        shop {
          currencyCode
        }
      }`);
    currencyJson = await currencyResponse.json();
  } catch (error) {
    console.error("Shop currency lookup failed:", error);
    throw new Response(
      "Unable to verify this store's currency. Please try again or contact support.",
      { status: 502 },
    );
  }

  const currencyErrors = getGraphqlErrors(currencyJson);
  if (!currencyResponse.ok || currencyErrors.length > 0) {
    console.error(
      "Shop currency lookup failed with HTTP status:",
      currencyResponse.status,
      currencyErrors,
    );
    throw new Response(
      "Unable to verify this store's currency. Please try again or contact support.",
      { status: 502 },
    );
  }

  const storeCurrencyCode = currencyJson.data?.shop?.currencyCode;
  if (typeof storeCurrencyCode !== "string" || !/^[A-Z]{3}$/.test(storeCurrencyCode)) {
    console.error("Shop currency lookup returned no valid currency code.");
    throw new Response(
      "Unable to verify this store's currency. Please try again or contact support.",
      { status: 502 },
    );
  }

  if (storeCurrencyCode !== LENS_CURRENCY_CODE) {
    throw new Response(
      "LensCraft currently supports Shopify stores whose primary currency is USD.",
      { status: 422 },
    );
  }

  const presentmentCurrencyCode = url.searchParams.get("currency");
  if (
    presentmentCurrencyCode &&
    presentmentCurrencyCode.toUpperCase() !== LENS_CURRENCY_CODE
  ) {
    throw new Response(
      "LensCraft currently supports shoppers checking out in USD only.",
      { status: 422 },
    );
  }

  const currencyCode = LENS_CURRENCY_CODE;
  let catalog: Awaited<ReturnType<typeof loadLensCatalog>>;
  try {
    catalog = await loadLensCatalog();
  } catch (error) {
    console.error("Lens catalog lookup failed:", error);
    throw new Response(
      "Unable to load lens options right now. Please try again or contact the store.",
      { status: 503 },
    );
  }

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
    let frameResponse: Awaited<ReturnType<typeof admin.graphql>>;
    let frameJson: Awaited<ReturnType<typeof frameResponse.json>>;
    try {
      frameResponse = await admin.graphql(
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
      frameJson = await frameResponse.json();
    } catch (error) {
      console.error("Selected frame lookup failed:", error);
      throw new Response(
        "Unable to load the selected frame from Shopify. Please try again.",
        { status: 502 },
      );
    }

    const variant = frameJson.data?.productVariant;
    const frameErrors = getGraphqlErrors(frameJson);

    if (!frameResponse.ok || frameErrors.length > 0) {
      console.error(
        "Selected frame lookup failed with HTTP status:",
        frameResponse.status,
        frameErrors,
      );
      throw new Response(
        "Unable to load the selected frame from Shopify. Please try again.",
        { status: 502 },
      );
    }

    if (
      !variant ||
      variant.product?.id !== productGid ||
      variant.id !== variantGid
    ) {
      throw new Response(
        "The selected frame variant could not be verified. Please select it again.",
        { status: 400 },
      );
    }

    const parsedFramePrice = Number(variant.price);
    if (!Number.isFinite(parsedFramePrice) || parsedFramePrice < 0) {
      console.error("Selected frame returned an invalid price.");
      throw new Response(
        "Unable to determine the selected frame price. Please contact the store.",
        { status: 502 },
      );
    }

    product = {
      productId: frameSelection.productId,
      variantId: frameSelection.variantId,
      variantTitle: variant.title,
      image: safeImageUrl(
        variant.image?.url ?? variant.product.featuredImage?.url ?? null,
      ),
    };
    framePriceMinor = Math.round(parsedFramePrice * 100);
  }

  const lensIndices = catalog.lensIndices.map((index) => ({
    ...index,
    refractiveIndex: Number(index.refractiveIndex),
  }));

  const lensVariantByMinor: Record<number, string> = {};

  if (admin) {
    try {
      const res = await admin.graphql(`#graphql
        query {
          productByIdentifier(identifier: { handle: "lens-upgrade" }) {
            variants(first: 100) {
              nodes { id price }
            }
          }
        }`);

      const json = await res.json();
      const queryErrors = getGraphqlErrors(json);

      if (!res.ok || queryErrors.length > 0) {
        console.error(
          "Lens upgrade product lookup failed with HTTP status:",
          res.status,
          queryErrors,
        );
      } else {
        for (const variant of json.data?.productByIdentifier?.variants?.nodes ?? []) {
          const priceMinor = Math.round(Number(variant.price) * 100);
          const variantId = variant.id.split("/").pop();
          if (Number.isFinite(priceMinor) && variantId) {
            lensVariantByMinor[priceMinor] = variantId;
          }
        }
      }
    } catch (error) {
      console.error("Lens upgrade product lookup failed:", error);
    }
  }

  return {
    shop,
    currencyCode,
    proxyPathPrefix: url.searchParams.get("path_prefix"),
    framePriceMinor,
    product,
    lensIndices,
    lensVariantByMinor,
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
