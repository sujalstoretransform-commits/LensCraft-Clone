import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);

  const inputs = [...url.searchParams.entries()]
    .filter(([key]) => key.startsWith("items[") || key === "return_to")
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${esc(key)}" value="${esc(value)}">`,
    )
    .join("\n");

  const html = `<!doctype html>
<html>
  <body>
    <form id="f" method="POST" action="/cart/add" accept-charset="UTF-8">
      ${inputs}
      <noscript><button type="submit">Continue to cart</button></noscript>
    </form>
    <script>document.getElementById("f").submit();</script>
  </body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};