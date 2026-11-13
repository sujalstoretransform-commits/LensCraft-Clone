import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, redirect, useLoaderData } from "react-router";
import { authenticate, createDefaultLensProduct } from "../shopify.server";
import db from "../db.server";
import { cleanupExpiredGuestPrescriptions } from "../services/saved-prescription.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session, admin } = await authenticate.admin(request);
  let lensProductSetupFailed = false;
  try {
    await createDefaultLensProduct(admin);
  } catch (error) {
    console.error("Default lens product setup failed from the app home:", error);
    lensProductSetupFailed = true;
  }
  await cleanupExpiredGuestPrescriptions(session.shop);
  const selectedCustomerId = new URL(request.url).searchParams.get("customerId");
  const savedPrescriptions = await db.savedPrescription.findMany({
    where: { shop: session.shop, ...(selectedCustomerId ? { customerId: selectedCustomerId } : {}) },
    orderBy: { updatedAt: "desc" },
    ...(selectedCustomerId ? {} : { take: 100 }),
    select: {
      id: true, customerId: true, name: true,
      rightSph: true, rightCyl: true, rightAxis: true,
      leftSph: true, leftCyl: true, leftAxis: true, pd: true,
      fileName: true, createdAt: true,
    },
  });
  const privacyRequests = await db.privacyDataRequest.findMany({
    where: { shop: session.shop },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });
  return {
    shop: session.shop,
    lensProductSetupFailed,
    selectedCustomerId,
    privacyRequests,
    savedPrescriptions: savedPrescriptions.map((prescription) => ({
      ...prescription,
      rightSph: prescription.rightSph?.toString() ?? null,
      rightCyl: prescription.rightCyl?.toString() ?? null,
      leftSph: prescription.leftSph?.toString() ?? null,
      leftCyl: prescription.leftCyl?.toString() ?? null,
      pd: prescription.pd?.toString() ?? null,
    })),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return new Response("Request ID is required", { status: 400 });
  await db.privacyDataRequest.updateMany({
    where: { shop: session.shop, requestId },
    data: { fulfilledAt: new Date() },
  });
  return redirect("/app");
}

export default function AppHome() {
  const { shop, savedPrescriptions, privacyRequests, selectedCustomerId, lensProductSetupFailed } = useLoaderData<typeof loader>();
  const editorUrl = `https://${shop}/admin/themes/current/editor?context=apps`;

  return (
    <main className="mx-auto max-w-4xl p-8 text-slate-900">
      <h1 className="text-3xl font-semibold">Set up LensCraft Studio</h1>
      {lensProductSetupFailed && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Lens catalog setup failed. Check the app server logs for the Shopify error, then reload this page to retry.
        </p>
      )}
      <p className="mt-3 text-slate-600">
        Add the LensCraft configurator to your storefront, then connect your lens-upgrade variants.
      </p>

      <section className="mt-8 rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-semibold">1. Add the storefront block</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-slate-700">
          <li>Open the theme editor and choose the product template used for frames.</li>
          <li>Add the LensCraft Studio app block to the product information section.</li>
          <li>Save and preview a frame product to confirm the Customize button appears.</li>
        </ol>
        <a className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-medium text-white" href={editorUrl} target="_top">
          Open theme editor
        </a>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-semibold">2. Configure lens prices</h2>
        <p className="mt-2 text-slate-700">
          Open the Lens Catalog product. Each variant represents one catalog item, and its SKU matches that item’s catalog code. Set the variant price and image in Shopify; the configurator reads them by SKU. Publish the product to the Online Store sales channel so its variants can be added to cart.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Missing or duplicate SKU codes prevent the matching option from showing a price.
        </p>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-semibold">Customer data requests</h2>
        <p className="mt-2 text-sm text-slate-600">Open the matching prescription records, provide the requested information to the store owner, then mark the request complete.</p>
        <div className="mt-4 space-y-3">
          {privacyRequests.length === 0 ? <p className="text-sm text-slate-500">No customer data requests received.</p> : privacyRequests.map((privacyRequest) => (
            <div key={privacyRequest.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4">
              <div>
                <p className="font-medium">Customer {privacyRequest.customerId}</p>
                <p className="text-sm text-slate-500">Received {new Date(privacyRequest.requestedAt).toLocaleString()} · {privacyRequest.fulfilledAt ? "Completed" : "Pending"}</p>
              </div>
              <div className="flex gap-3">
                <a className="text-blue-700 underline" href={`/app?customerId=${encodeURIComponent(privacyRequest.customerId)}`}>View records</a>
                {!privacyRequest.fulfilledAt && <Form method="post"><input type="hidden" name="requestId" value={privacyRequest.requestId} /><button className="text-blue-700 underline" type="submit">Mark complete</button></Form>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 p-6">
        <h2 className="text-xl font-semibold">3. Review saved prescriptions</h2>
        <p className="mt-2 text-slate-700">
          Customers can save prescriptions in the configurator. Treat prescription details and uploaded files as sensitive customer information and handle customer privacy requests promptly.
        </p>
        <div className="mt-5 space-y-3">
          {selectedCustomerId && <p className="text-sm font-medium">Showing records for customer {selectedCustomerId}. <a className="text-blue-700 underline" href="/app">Clear filter</a></p>}
          {savedPrescriptions.length === 0 ? (
            <p className="text-sm text-slate-500">No saved prescriptions yet.</p>
          ) : savedPrescriptions.map((prescription) => (
            <details key={prescription.id} className="rounded-lg border border-slate-200 p-4">
              <summary className="cursor-pointer font-medium">
                {prescription.name} · {prescription.customerId ? `Customer ${prescription.customerId}` : "Guest customer"} · {new Date(prescription.createdAt).toLocaleDateString()}
              </summary>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
                <dt>Right SPH / CYL / Axis</dt><dd>{prescription.rightSph ?? "—"} / {prescription.rightCyl ?? "—"} / {prescription.rightAxis ?? "—"}</dd>
                <dt>Left SPH / CYL / Axis</dt><dd>{prescription.leftSph ?? "—"} / {prescription.leftCyl ?? "—"} / {prescription.leftAxis ?? "—"}</dd>
                <dt>PD</dt><dd>{prescription.pd ?? "—"}</dd>
                {prescription.fileName && <><dt>Prescription file</dt><dd><a className="text-blue-700 underline" href={`/app/prescription-file?id=${encodeURIComponent(prescription.id)}`}>{prescription.fileName}</a></dd></>}
              </dl>
            </details>
          ))}
          {savedPrescriptions.length === 100 && <p className="text-xs text-slate-500">Showing the 100 most recently updated records.</p>}
        </div>
      </section>
    </main>
  );
}
