import { loadLensCatalog } from "app/services/lens-catalog.server";
import { getAuthenticatedShopCurrency } from "app/services/shop-currency.server";
import type { LoaderFunctionArgs } from "react-router"

export const loader = async ({ request }: LoaderFunctionArgs) => {
    try {
        const currencyCode = await getAuthenticatedShopCurrency(request);
        return Response.json(await loadLensCatalog(currencyCode))
    } catch (error) {
        if (error instanceof Response) throw error;
        console.error("Lens catalog API lookup failed:", error);
        return Response.json(
            { error: "Lens catalog is temporarily unavailable." },
            { status: 503 },
        );
    }
}