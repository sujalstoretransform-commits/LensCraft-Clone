import { redirect, useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import LensConfiguratorPage from "app/components/LensConfiguratorPage";
import LensConfiguratorError from "app/components/LensConfiguratorError";
import { loadLensConfiguratorPage } from "app/services/lens-configurator-page.server";

function parseNumericId(val: unknown): string | null {
  if (typeof val !== "string" && typeof val !== "number") return null;
  const match = String(val).match(/\d{1,20}$/);
  return match ? match[0] : null;
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.substring(name.length + 1));
  } catch {
    return null;
  }
}

function parseFrameCookie(
  raw: string | null,
): { productId: string; variantId: string } | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const productId = parseNumericId(data?.productId);
    const variantId = parseNumericId(data?.variantId);
    if (productId && variantId) {
      return { productId, variantId };
    }
  } catch {
    // Ignore invalid JSON
  }
  return null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);

    // 1. Read selected frame from cookie (clean URL mode)
    const frameCookie = parseFrameCookie(getCookie(request, "lenscraft_frame"));

    // 2. Fall back to searchParams if provided (for backwards compatibility / direct testing)
    const productId =
      frameCookie?.productId || parseNumericId(url.searchParams.get("productId"));
    const variantId =
      frameCookie?.variantId || parseNumericId(url.searchParams.get("variantId"));

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

    const headers = new Headers();
    if (productId && variantId) {
      const frameData = JSON.stringify({ productId, variantId });
      headers.append(
        "Set-Cookie",
        `lenscraft_frame=${encodeURIComponent(frameData)}; Path=/; Max-Age=3600; SameSite=Lax; Secure`,
      );
    }

    return redirect("/apps/lenscraftclone", { headers });
  } catch (error) {
    console.error("App proxy configurator action failed:", error);
    return redirect("/apps/lenscraftclone");
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
