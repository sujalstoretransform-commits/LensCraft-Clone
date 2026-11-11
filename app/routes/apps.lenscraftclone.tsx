import { redirect, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import LensConfiguratorPage from "app/components/LensConfiguratorPage";
import LensConfiguratorError from "app/components/LensConfiguratorError";
import { loadLensConfiguratorPage } from "app/services/lens-configurator-page.server";
import { authenticate } from "../shopify.server";

function parseNumericId(val: unknown): string | null {
  if (typeof val !== "string" && typeof val !== "number") return null;
  const match = String(val).match(/\d{1,20}$/);
  return match ? match[0] : null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const productId = parseNumericId(url.searchParams.get("productId"));
    const variantId = parseNumericId(url.searchParams.get("variantId"));

    if (productId && variantId) {
      return await loadLensConfiguratorPage(
        request,
        { productId, variantId },
        "appProxy",
      );
    }

    return await loadLensConfiguratorPage(request, undefined, "appProxy");
  } catch (error) {
    console.error("App proxy configurator load failed:", error);
    try {
      return await loadLensConfiguratorPage(request, undefined, "appProxy");
    } catch (fallbackError) {
      console.error("Fallback configurator load failed:", fallbackError);
      throw error;
    }
  }
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.public.appProxy(request);

  const formData = await request.formData();
  const productId = parseNumericId(formData.get("productId"));
  const variantId = parseNumericId(formData.get("variantId"));
  const params = new URLSearchParams();

  if (productId && variantId) {
    params.set("productId", productId);
    params.set("variantId", variantId);
  }

  const query = params.toString();
  return redirect(`/apps/lenscraftclone${query ? `?${query}` : ""}`);
}

export default function AppProxyClonePage() {
  const loaderData = useLoaderData<typeof loader>();
  return <LensConfiguratorPage data={loaderData} />;
}

export function ErrorBoundary() {
  return <LensConfiguratorError />;
}
