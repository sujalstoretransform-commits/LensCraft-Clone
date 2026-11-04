import type { LoaderFunctionArgs } from "react-router";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import stylesheetUrl from "./tailwind.css?url";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  return {
    isAppProxy: url.searchParams.has("signature"),
    assetOrigin: url.origin,
  };
}

export const links = () => [{ rel: "stylesheet", href: stylesheetUrl }];

export default function App() {
  const { isAppProxy, assetOrigin } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {isAppProxy ? <base href={`${assetOrigin}/`} /> : null}
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
