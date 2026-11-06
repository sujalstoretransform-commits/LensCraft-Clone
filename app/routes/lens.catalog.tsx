import {
    LENS_CURRENCY_CODE,
    loadLensCatalog,
} from "app/services/lens-catalog.server";
import type { LoaderFunctionArgs } from "react-router"

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const currency = new URL(request.url).searchParams.get("currency")?.toUpperCase()

    if (currency && currency !== LENS_CURRENCY_CODE) {
        return Response.json(
            { error: "Only USD lens pricing is supported." },
            { status: 400 },
        );
    }

    try {
        return Response.json(await loadLensCatalog())
    } catch (error) {
        console.error("Lens catalog API lookup failed:", error);
        return Response.json(
            { error: "Lens catalog is temporarily unavailable." },
            { status: 503 },
        );
    }
}