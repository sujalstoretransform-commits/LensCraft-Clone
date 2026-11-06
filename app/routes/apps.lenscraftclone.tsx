import { useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import LensConfiguratorPage from "app/components/LensConfiguratorPage";
import LensConfiguratorError from "app/components/LensConfiguratorError";
import { loadLensConfiguratorPage } from "app/services/lens-configurator-page.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");
    const variantId = url.searchParams.get("variantId");

    if (!productId && !variantId) {
      return await loadLensConfiguratorPage(request, undefined, "appProxy");
    }

    if (
      !productId ||
      !/^\d{1,20}$/.test(productId) ||
      !variantId ||
      !/^\d{1,20}$/.test(variantId)
    ) {
      throw new Response("Invalid product or variant information.", {
        status: 400,
      });
    }

    return await loadLensConfiguratorPage(
      request,
      { productId, variantId },
      "appProxy",
    );
  } catch (error) {
    if (error instanceof Response) throw error;

    console.error("App proxy configurator load failed:", error);
    throw new Response(
      "The configurator is temporarily unavailable. Please try again.",
      { status: 503 },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const productId = formData.get("productId");
    const variantId = formData.get("variantId");

    if (
      typeof productId !== "string" ||
      !/^\d{1,20}$/.test(productId) ||
      typeof variantId !== "string" ||
      !/^\d{1,20}$/.test(variantId)
    ) {
      throw new Response(
        "The selected frame is missing valid product or variant information. Please select it again.",
        { status: 400 },
      );
    }

    return await loadLensConfiguratorPage(
      request,
      { productId, variantId },
      "appProxy",
    );
  } catch (error) {
    if (error instanceof Response) throw error;

    console.error("App proxy configurator action failed:", error);
    throw new Response(
      "The configurator is temporarily unavailable. Please try again.",
      { status: 503 },
    );
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
