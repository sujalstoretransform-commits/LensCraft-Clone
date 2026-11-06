import { useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import LensConfiguratorPage from "app/components/LensConfiguratorPage";
import LensConfiguratorError from "app/components/LensConfiguratorError";
import { loadLensConfiguratorPage } from "app/services/lens-configurator-page.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)

  const productId = url.searchParams.get("productId")
  const variantId = url.searchParams.get("variantId")

  if (!productId && !variantId) {
    return loadLensConfiguratorPage(request)
  }

  if (
    !productId ||
    !/^\d{1,20}$/.test(productId) ||
    !variantId ||
    !/^\d{1,20}$/.test(variantId)
  ) {
    throw new Response(
      "Invalid product or variant information.",
      { status: 400 }
    )
  }

  return loadLensConfiguratorPage(request, {
    productId,
    variantId
  });
}

export async function action({ request }: ActionFunctionArgs) {
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

  return loadLensConfiguratorPage(request, { productId, variantId });
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
