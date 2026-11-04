import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import "@shopify/app-bridge-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Storefront request coming through the app proxy (/apps/lenscraft).
  // Shopify adds a `signature` param, so verify it instead of using Admin auth.
  if (new URL(request.url).searchParams.has("signature")) {
    await authenticate.public.appProxy(request);
    return { apiKey: "", isProxy: true };
  }

  // Normal Admin visit (embedded app)
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "", isProxy: false };
};

export default function App() {
  const { apiKey, isProxy } = useLoaderData<typeof loader>();

  // Storefront: render the same page, without App Bridge or the admin nav.
  if (isProxy) {
    return <Outlet />;
  }

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};