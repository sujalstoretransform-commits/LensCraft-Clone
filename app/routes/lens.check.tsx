import type { ActionFunctionArgs } from "react-router";
import { checkRules } from "app/services/lens-rules";
import { loadLensCatalog } from "app/services/lens-catalog.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)
    const { currency, selection } = body ?? {}

    if (typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency)) {
        return Response.json({ error: "currency is required, e.g. USD" }, { status: 400 });
    }
    if (typeof selection?.lensTypeCode !== "string" || !Array.isArray(selection?.optionCodes)) {
        return Response.json(
            { error: "selection needs lensTypeCode and optionCodes[]" },
            { status: 400 },
        );
    }

    try {
        const { rules } = await loadLensCatalog(currency.toUpperCase())
        return Response.json(checkRules(rules, selection))
    } catch (error) {
        console.error("Lens compatibility lookup failed:", error);
        return Response.json(
            { error: "Lens compatibility is temporarily unavailable." },
            { status: 503 },
        );
    }
}