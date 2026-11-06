import type { ActionFunctionArgs } from "react-router";
import { checkRules } from "app/services/lens-rules";
import { loadLensCatalog } from "app/services/lens-catalog.server";
import { getAuthenticatedShopCurrency } from "app/services/shop-currency.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const body = await request.json().catch(() => null)
    const { selection } = body ?? {}
    if (typeof selection?.lensTypeCode !== "string" || !Array.isArray(selection?.optionCodes)) {
        return Response.json(
            { error: "selection needs lensTypeCode and optionCodes[]" },
            { status: 400 },
        );
    }

    try {
        const currencyCode = await getAuthenticatedShopCurrency(request);
        const { rules } = await loadLensCatalog(currencyCode)
        return Response.json(checkRules(rules, selection))
    } catch (error) {
        if (error instanceof Response) throw error;
        console.error("Lens compatibility lookup failed:", error);
        return Response.json(
            { error: "Lens compatibility is temporarily unavailable." },
            { status: 503 },
        );
    }
}