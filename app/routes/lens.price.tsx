import type { ActionFunctionArgs } from "react-router";
import { loadLensCatalog } from "app/services/lens-catalog.server";
import { getAuthenticatedShopCurrency } from "app/services/shop-currency.server";
import { authenticate } from "app/shopify.server";
import {
    applyShopLensPricesToCatalog,
    loadShopLensPriceComponents,
} from "app/services/shopify-lens-pricing.server";
import {
    calculatePrice,
    PriceError,
    PriceUnavailableError,
} from "app/services/lens-pricing";

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)
    const { selection, framePriceMinor } = body ?? {}
    if (typeof selection?.lensTypeCode !== "string" || !Array.isArray(selection?.optionCodes)) {
        return Response.json(
            { error: "selection needs lensTypeCode and optionCodes[]" },
            { status: 400 },
        );
    }

    try {
        const { admin } = await authenticate.admin(request);
        const storeCurrency = await getAuthenticatedShopCurrency(request);
        const url = new URL(request.url);
        const requestedCurrency = url.searchParams.get("currency")?.toUpperCase();
        const country = url.searchParams.get("country")?.toUpperCase();
        const countryCode = country && /^[A-Z]{2}$/.test(country) ? country : undefined;
        const baseCatalog = await loadLensCatalog(storeCurrency);
        const priceMappings = await loadShopLensPriceComponents(
            admin,
            storeCurrency,
            baseCatalog,
            countryCode,
        );
        if (requestedCurrency && priceMappings.currencyCode !== requestedCurrency) {
            throw new PriceUnavailableError(
                "Lens prices are unavailable in the requested currency.",
            );
        }
        const catalog = applyShopLensPricesToCatalog(
            baseCatalog,
            priceMappings.priceByCode,
            priceMappings.currencyCode,
        );
        const price = calculatePrice(catalog, selection, framePriceMinor)
        return Response.json({ currency: priceMappings.currencyCode, ...price })
    } catch (e) {
        if (e instanceof Response) throw e;
        if (e instanceof PriceUnavailableError) {
            return Response.json({ error: e.message }, { status: 422 });
        }
        if (e instanceof PriceError) {
            return Response.json({ error: e.message }, { status: 400 });
        }
        console.error("Lens price calculation failed:", e);
        return Response.json(
            { error: "Lens pricing is temporarily unavailable." },
            { status: 503 },
        );
    }
}
