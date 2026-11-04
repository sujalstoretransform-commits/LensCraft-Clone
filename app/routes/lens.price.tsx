import type { ActionFunctionArgs } from "react-router";
import { loadLensCatalog } from "app/services/lens-catalog.server";
import { calculatePrice, PriceError } from "app/services/lens-pricing";

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)
    const { currency, selection, framePriceMinor } = body ?? {}

    if (typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency)) {
        return Response.json({ error: "currency is required, e.g. USD" }, { status: 400 });
    }
    if (typeof selection?.lensTypeCode !== "string" || !Array.isArray(selection?.optionCodes)) {
        return Response.json(
            { error: "selection needs lensTypeCode and optionCodes[]" },
            { status: 400 },
        );
    }

    const catalog = await loadLensCatalog(currency.toUpperCase())

    try {
        const price = calculatePrice(catalog, selection, framePriceMinor)
        return Response.json({ currency: currency.toUpperCase(), ...price })
    } catch (e) {
        if (e instanceof PriceError) {
            return Response.json({ error: e.message }, { status: 400 });
        }
        throw e;
    }
}