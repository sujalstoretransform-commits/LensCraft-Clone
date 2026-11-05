import { authenticate } from "../shopify.server";
import { loadLensCatalog } from "./lens-catalog.server";

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
) {
  const url = new URL(request.url);

  const { admin } = url.searchParams.has("signature")
    ? await authenticate.public.appProxy(request)
    : await authenticate.admin(request);

  const shop = url.searchParams.get("shop") ?? "";

  if (!admin) {
    throw new Response(
      "Unable to verify this store's currency. Please refresh the page or contact support.",
      { status: 503 },
    );
  }

  const currencyResponse = await admin.graphql(`#graphql
    query StoreCurrency {
      shop {
        currencyCode
      }
    }`);
  const currencyJson = await currencyResponse.json();

  if (!currencyResponse.ok) {
    console.error(
      "Shop currency lookup failed with HTTP status:",
      currencyResponse.status,
    );
    throw new Response(
      "Unable to load this store's currency. Please try again or contact support.",
      { status: 502 },
    );
  }

  const currencyCode = currencyJson.data?.shop?.currencyCode;
  if (typeof currencyCode !== "string" || !/^[A-Z]{3}$/.test(currencyCode)) {
    console.error("Shop currency lookup returned no valid currency code.");
    throw new Response(
      "Unable to determine this store's currency. Please contact support.",
      { status: 502 },
    );
  }

  const catalog = await loadLensCatalog(currencyCode);
  const hasCurrencyPrices =
    catalog.lensTypes.some((lensType) => lensType.prices.length > 0) ||
    catalog.lensIndices.some((lensIndex) => lensIndex.prices.length > 0) ||
    catalog.lensOptions.some(
      (option) =>
        option.prices.length > 0 ||
        option.lensTechnologyOptions.some(
          (mapping) => mapping.lensTechnology.lensPrices.length > 0,
        ),
    );

  if (!hasCurrencyPrices) {
    console.error(`No active lens catalog prices found for ${currencyCode}.`);
    throw new Response(
      `No active lens prices are configured for this store's ${currencyCode} currency. Please contact the store.`,
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

    if (!frameResponse.ok) {
      console.error(
        "Selected frame lookup failed with HTTP status:",
        frameResponse.status,
      );
      throw new Response(
        "Unable to load the selected frame from Shopify. Please try again.",
        { status: 502 },
      );
    }

    if (!variant || variant.product.id !== productGid || variant.id !== variantGid) {
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
    const res = await admin.graphql(`#graphql
      query {
        productByIdentifier(identifier: { handle: "lens-upgrade" }) {
          variants(first: 100) {
            nodes { id price }
          }
        }
      }`);

    const json = await res.json();

    for (const v of json.data?.productByIdentifier?.variants?.nodes ?? []) {
      lensVariantByMinor[Math.round(Number(v.price) * 100)] = v.id
        .split("/")
        .pop()!;
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
