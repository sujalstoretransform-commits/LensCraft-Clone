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

export async function loadLensConfiguratorPage(request: Request) {
  const url = new URL(request.url);

  const { admin } = url.searchParams.has("signature")
    ? await authenticate.public.appProxy(request)
    : await authenticate.admin(request);

  const shop = url.searchParams.get("shop") ?? "";

  const requestedCurrency = url.searchParams.get("currency")?.toUpperCase();

  const currencyCode =
    requestedCurrency && /^[A-Z]{3}$/.test(requestedCurrency)
      ? requestedCurrency
      : "USD";

  const catalog = await loadLensCatalog(currencyCode);

  const product = {
    productId: url.searchParams.get("productId"),
    variantId: url.searchParams.get("variantId"),
    variantTitle: url.searchParams.get("variantTitle"),
    image: safeImageUrl(url.searchParams.get("image")),
  };

  const rawFramePrice = Number.parseInt(
    url.searchParams.get("framePrice") ?? "",
    10,
  );
  const framePriceMinor = Number.isInteger(rawFramePrice) && rawFramePrice >= 0 ? rawFramePrice : 0;

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
