import { loadLensCatalog } from "app/services/lens-catalog.server";
import { getAuthenticatedShopCurrency } from "app/services/shop-currency.server";
import { authenticate } from "app/shopify.server";
import {
    applyShopLensPricesToCatalog,
    loadShopLensPriceComponents,
} from "app/services/shopify-lens-pricing.server";
import type { LoaderFunctionArgs } from "react-router"

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const { admin } = await authenticate.admin(request);
        const storeCurrency = await getAuthenticatedShopCurrency(request);
        const url = new URL(request.url);
        const requestedCurrency = url.searchParams.get("currency")?.toUpperCase();
        const country = url.searchParams.get("country")?.toUpperCase();
        const countryCode = country && /^[A-Z]{2}$/.test(country) ? country : undefined;
        const catalog = await loadLensCatalog(storeCurrency);
        const prices = await loadShopLensPriceComponents(
            admin,
            storeCurrency,
            catalog,
            countryCode,
        );
        if (requestedCurrency && prices.currencyCode !== requestedCurrency) {
            return Response.json(
                { error: "Lens prices are unavailable in the requested currency." },
                { status: 422 },
            );
        }
        return Response.json(
            applyShopLensPricesToCatalog(catalog, prices.priceByCode, prices.currencyCode),
        );
    } catch (error) {
        if (error instanceof Response) throw error;
        console.error("Lens catalog API lookup failed:", error);
        return Response.json(
            { error: "Lens catalog is temporarily unavailable." },
            { status: 503 },
        );
    }
}
