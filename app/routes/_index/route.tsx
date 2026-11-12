import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8 text-center">
      <div className="max-w-xl">
        <h1 className="text-3xl font-semibold">LensCraft Studio</h1>
        <p className="mt-4 text-slate-600">
          Configure prescription lens options, prices, and saved prescriptions for your eyewear storefront.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Install LensCraft Studio from the Shopify App Store to connect it to your store.
        </p>
      </div>
    </main>
  );
}
