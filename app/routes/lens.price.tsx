import type { ActionFunctionArgs } from "react-router";
import {
    LENS_CURRENCY_CODE,
    loadLensCatalog,
} from "app/services/lens-catalog.server";
import {
    calculatePrice,
    PriceError,
    PriceUnavailableError,
} from "app/services/lens-pricing";

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)
    const { currency, selection, framePriceMinor } = body ?? {}

    const currencyCode = currency === undefined
        ? LENS_CURRENCY_CODE
        : typeof currency === "string"
            ? currency.toUpperCase()
            : "";
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
        return Response.json({ error: "A valid three-letter currency code is required." }, { status: 400 });
    }
    if (typeof selection?.lensTypeCode !== "string" || !Array.isArray(selection?.optionCodes)) {
        return Response.json(
            { error: "selection needs lensTypeCode and optionCodes[]" },
            { status: 400 },
        );
    }

    try {
        const catalog = await loadLensCatalog(currencyCode)
        const price = calculatePrice(catalog, selection, framePriceMinor)
        return Response.json({ currency: currencyCode, ...price })
    } catch (e) {
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