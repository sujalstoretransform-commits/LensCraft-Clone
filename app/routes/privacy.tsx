import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Privacy Policy | Lens Option By Storetransform" },
  {
    name: "description",
    content: "How Lens Option By Storetransform collects, uses, stores, and deletes information.",
  },
];

const sections = [
  {
    title: "1. Who we are",
    content: (
      <p>
        Lens Option By Storetransform is provided by its app developer. For privacy questions or requests,
        contact the developer using the support contact on the Lens Option By Storetransform Shopify App Store
        listing. Buyers can also contact the Shopify store where they used the configurator.
      </p>
    ),
  },
  {
    title: "2. What this policy covers",
    content: (
      <p>
        This policy explains what information Lens Option By Storetransform processes from Shopify merchants who
        install the app and from buyers who use the lens configurator or save a prescription on a
        merchant’s store.
      </p>
    ),
  },
  {
    title: "3. Information we process",
    content: (
      <>
        <p>From merchants and Shopify, the app processes:</p>
        <ul>
          <li>Shop domain and app installation/session information provided by Shopify.</li>
          <li>
            Product and variant details needed to match catalog codes to SKUs and read merchant-set
            names, prices, images, and descriptions.
          </li>
        </ul>
        <p>When buyers use the app, it processes:</p>
        <ul>
          <li>
            Lens selections, including lens type, index, technologies, and options. These selections
            and prescription details may be sent to Shopify as cart and order line-item properties.
          </li>
          <li>
            If a buyer saves a prescription: the prescription name, right and left SPH/CYL/axis,
            pupillary distance (PD), an uploaded prescription file if provided, and the Shopify
            customer ID when available.
          </li>
          <li>
            For guest prescriptions, an opaque guest token stored in the browser’s local storage is
            used to retrieve the buyer’s saved records.
          </li>
        </ul>
        <p>
          The app does not request order access through the Shopify Admin API. Shopify processes
          cart and order details when buyers check out.
        </p>
      </>
    ),
  },
  {
    title: "4. How we use information",
    content: (
      <p>
        We use information to provide the lens configurator, read merchant-managed catalog prices
        and details, save and retrieve prescriptions when requested, attach selections to the cart,
        provide support, and meet privacy and security obligations. We do not sell personal
        information or use prescription information for advertising.
      </p>
    ),
  },
  {
    title: "5. Storage and retention",
    content: (
      <>
        <p>
          The app runs on Vercel. Uploaded prescription files are stored privately using Vercel Blob.
          Prescription records and app sessions are stored in a PostgreSQL database configured for
          the app deployment. The database provider and region depend on that deployment. Data may
          be processed in countries where these services operate.
        </p>
        <p>
          Guest prescription records are set to expire after 30 days and are removed during the
          app’s expired-record cleanup. Saved customer prescriptions are retained while needed to
          provide the service and are deleted when we process a customer or shop erasure request.
          App session records are deleted when the app is uninstalled.
        </p>
      </>
    ),
  },
  {
    title: "6. Sharing",
    content: (
      <p>
        The merchant and staff authorized to use the Shopify store can access saved prescriptions
        through the app. Shopify receives cart selections and prescription details attached to cart
        or order line items. Vercel, Vercel Blob, and the configured PostgreSQL provider process
        information to host the app and store its records. We may disclose information when required
        by law. We do not sell personal information.
      </p>
    ),
  },
  {
    title: "7. Security",
    content: (
      <p>
        Prescription uploads are stored privately and served through an authenticated app request.
        The app uses Shopify authentication and access controls to protect merchant and buyer
        information.
      </p>
    ),
  },
  {
    title: "8. Privacy requests",
    content: (
      <p>
        Buyers can ask the store where they used the configurator to access or delete saved
        prescription information. Merchants can contact the app developer through the support
        contact on the Shopify App Store listing. Lens Option By Storetransform processes Shopify customer data
        request, customer erasure, and shop erasure webhooks.
      </p>
    ),
  },
  {
    title: "9. Changes to this policy",
    content: (
      <p>
        We will update this page and its effective date if the app’s data practices change.
      </p>
    ),
  },
  {
    title: "10. Contact",
    content: (
      <p>
        Contact the Lens Option By Storetransform developer using the support contact on the Shopify App Store
        listing. Buyers can also contact the Shopify merchant whose store they used.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Lens Option By Storetransform
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-500">Last updated: November 13, 2026</p>
        <p className="mt-6 leading-7 text-slate-700">
          This policy describes the information Lens Option By Storetransform processes to provide its Shopify
          lens configuration and saved-prescription features.
        </p>
        <div className="mt-8 space-y-8">
          {sections.map(({ title, content }) => (
            <section key={title}>
              <h2 className="text-xl font-semibold">{title}</h2>
              <div className="mt-3 space-y-3 leading-7 text-slate-700 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
                {content}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
