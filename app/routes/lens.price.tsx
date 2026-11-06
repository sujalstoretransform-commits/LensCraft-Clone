import type { ActionFunctionArgs } from "react-router";
import {
    LENS_CURRENCY_CODE,
    loadLensCatalog,
} from "app/services/lens-catalog.server";
import { calculatePrice, PriceError } from "app/services/lens-pricing";

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)
    const { currency, selection, framePriceMinor } = body ?? {}

    if (
        currency !== undefined &&
        (typeof currency !== "string" ||
            currency.toUpperCase() !== LENS_CURRENCY_CODE)
    ) {
        return Response.json({ error: "Only USD lens pricing is supported." }, { status: 400 });
    }
    if (typeof selection?.lensTypeCode !== "string" || !Array.isArray(selection?.optionCodes)) {
        return Response.json(
            { error: "selection needs lensTypeCode and optionCodes[]" },
            { status: 400 },
        );
    }

    try {
        const catalog = await loadLensCatalog()
        const price = calculatePrice(catalog, selection, framePriceMinor)
        return Response.json({ currency: LENS_CURRENCY_CODE, ...price })
    } catch (e) {
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