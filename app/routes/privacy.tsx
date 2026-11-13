import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy | LensCraft Studio" },
  {
    name: "description",
    content: "How LensCraft Studio collects, uses, stores, and deletes information.",
  },
];

const sections = [
  {
    title: "Who we are",
    body: (
      <>
        <p>
          LensCraft Studio is operated by its app developer. For privacy questions or requests,
          contact the developer using the support contact shown on the LensCraft Studio Shopify App
          Store listing. Buyers can also contact the Shopify store where they used the configurator.
        </p>
      </>
    ),
  },
  {
    title: "Information we process",
    body: (
      <>
        <p>To provide the lens configurator, LensCraft Studio processes:</p>
        <ul>
          <li>
            <strong>Shop information:</strong> the Shopify shop domain and app session information,
            plus product and variant details needed to match lens catalog codes to SKUs and read
            merchant-managed names, prices, images, and product descriptions.
          </li>
          <li>
            <strong>Buyer information:</strong> for saved prescriptions, the Shopify customer ID
            when available, the prescription name, right and left SPH/CYL/axis values, pupillary
            distance (PD), and any prescription file the buyer uploads. Guest prescription records
            are associated with an opaque token kept in the browser’s local storage.
          </li>
          <li>
            <strong>Configuration and order details:</strong> selected lens options and prescription
            details may be sent to Shopify as cart line-item properties when the buyer adds a
            configured frame to the cart.
          </li>
          <li>
            <strong>Operational information:</strong> limited request and error logs used to operate,
            troubleshoot, and protect the service.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "How we use information",
    body: (
      <p>
        We use this information to display the lens configurator, calculate lens prices from the
        merchant’s Shopify catalog, save and retrieve prescriptions when requested, add the selected
        configuration to the Shopify cart, provide support, and meet privacy and security obligations.
        We do not use prescription information for advertising.
      </p>
    ),
  },
  {
    title: "How information is shared and stored",
    body: (
      <>
        <p>
          The merchant and staff authorized to use the Shopify store can access saved prescriptions
          through the app. Cart and order details are processed by Shopify as part of the store’s
          checkout and order records.
        </p>
        <p>
          The app runs on Vercel. Uploaded prescription files are stored as private files using Vercel
          Blob. Prescription records and app sessions are stored in the app’s PostgreSQL database,
          using the database provider and region configured for the app deployment. Vercel and the
          configured database provider process information to operate the app. Data may therefore be
          processed in countries where those services operate, including outside the buyer’s or
          merchant’s country. Their privacy and security terms also apply to their services.
        </p>
        <p>We do not sell personal information.</p>
      </>
    ),
  },
  {
    title: "Retention and deletion",
    body: (
      <>
        <p>
          Guest prescription records are set to expire after 30 days and are removed when the app
          next performs its expired-record cleanup. Saved customer prescriptions are retained while
          needed to provide the service and are deleted when we process an applicable customer or
          shop data-erasure request. App session records are removed when the app is uninstalled.
        </p>
        <p>
          Buyers can ask the store where they used the configurator to access or delete saved
          prescription information. Merchants can also contact us at the privacy email above. We
          process Shopify privacy webhooks for customer data requests, customer erasure, and shop
          erasure.
        </p>
      </>
    ),
  },
  {
    title: "Security and international processing",
    body: (
      <>
        <p>
          Prescription uploads are stored privately and are served through an authenticated app
          request. We use access controls and service-provider safeguards to protect information.
        </p>
        <p>
          Information may be processed in the countries where Vercel and the configured PostgreSQL
          provider operate, which can include countries outside the merchant’s or buyer’s country.
        </p>
      </>
    ),
  },
  {
    title: "Changes to this policy",
    body: (
      <p>
        We may update this policy when the app’s data practices change. We will update the effective
        date and publish the revised policy at this URL.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          LensCraft Studio
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-500">Effective date: November 13, 2026</p>
        <p className="mt-6 leading-7 text-slate-700">
          This policy explains how LensCraft Studio processes information when a Shopify merchant
          installs the app or a buyer uses its lens configurator and saved-prescription features.
        </p>
        <div className="mt-8 space-y-8">
          {sections.map(({ title, body }) => (
            <section key={title}>
              <h2 className="text-xl font-semibold">{title}</h2>
              <div className="mt-3 space-y-3 leading-7 text-slate-700 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
