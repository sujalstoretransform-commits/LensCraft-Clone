import type { ActionFunctionArgs } from "react-router";
import { loadLensCatalog } from "app/services/lens-catalog.server";
import { getAuthenticatedShopCurrency } from "app/services/shop-currency.server";
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
        const currencyCode = await getAuthenticatedShopCurrency(request);
        const catalog = await loadLensCatalog(currencyCode)
        const price = calculatePrice(catalog, selection, framePriceMinor)
        return Response.json({ currency: currencyCode, ...price })
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