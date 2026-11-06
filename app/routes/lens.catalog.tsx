import { LENS_CURRENCY_CODE, loadLensCatalog } from "app/services/lens-catalog.server";
import type { LoaderFunctionArgs } from "react-router"

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const requestedCurrency = new URL(request.url).searchParams.get("currency")
    const currency = requestedCurrency?.toUpperCase() ?? LENS_CURRENCY_CODE;

    if (!/^[A-Z]{3}$/.test(currency)) {
        return Response.json(
            { error: "A valid three-letter currency code is required." },
            { status: 400 },
        );
    }

    try {
        return Response.json(await loadLensCatalog(currency))
    } catch (error) {
        console.error("Lens catalog API lookup failed:", error);
        return Response.json(
            { error: "Lens catalog is temporarily unavailable." },
            { status: 503 },
        );
    }
}