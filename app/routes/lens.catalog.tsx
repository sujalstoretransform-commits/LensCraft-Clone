import { loadLensCatalog } from "app/services/lens-catalog.server";
import type { LoaderFunctionArgs } from "react-router"

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const currency = new URL(request.url).searchParams.get("currency")?.toUpperCase()

    if (!currency || !/^[A-Z]{3}$/.test(currency)) {
        return Response.json(
            { error: "currency must be a 3-letter code, e.g. USD" },
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