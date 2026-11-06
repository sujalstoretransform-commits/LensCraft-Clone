import type { ActionFunctionArgs } from "react-router";
import { checkRules } from "app/services/lens-rules";
import {
    LENS_CURRENCY_CODE,
    loadLensCatalog,
} from "app/services/lens-catalog.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)
    const { currency, selection } = body ?? {}

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
        const { rules } = await loadLensCatalog(currencyCode)
        return Response.json(checkRules(rules, selection))
    } catch (error) {
        console.error("Lens compatibility lookup failed:", error);
        return Response.json(
            { error: "Lens compatibility is temporarily unavailable." },
            { status: 503 },
        );
    }
}