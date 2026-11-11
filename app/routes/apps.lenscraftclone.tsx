import { useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import LensConfiguratorPage from "app/components/LensConfiguratorPage";
import LensConfiguratorError from "app/components/LensConfiguratorError";
import { loadLensConfiguratorPage } from "app/services/lens-configurator-page.server";

function parseNumericId(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const match = val.match(/\d{1,20}$/);
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
  try {
    const formData = await request.formData();
    const productId = parseNumericId(formData.get("productId"));
    const variantId = parseNumericId(formData.get("variantId"));

    if (productId && variantId) {
      return await loadLensConfiguratorPage(
        request,
        { productId, variantId },
        "appProxy",
      );
    }

    return await loadLensConfiguratorPage(request, undefined, "appProxy");
  } catch (error) {
    console.error("App proxy configurator action failed:", error);
    try {
      return await loadLensConfiguratorPage(request, undefined, "appProxy");
    } catch (fallbackError) {
      console.error("Fallback configurator action failed:", fallbackError);
      throw error;
    }
  }
}

export default function AppProxyClonePage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const data = actionData ?? loaderData;
  return <LensConfiguratorPage data={data} />;
}

export function ErrorBoundary() {
  return <LensConfiguratorError />;
}
