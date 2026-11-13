import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "FAQ | Lens Option By Storetransform" },
  {
    name: "description",
    content: "Setup, pricing, prescriptions, and data questions about Lens Option By Storetransform.",
  },
];

const questions = [
  {
    question: "What does Lens Option By Storetransform do?",
    answer:
      "Lens Option By Storetransform adds a lens configurator to frame product pages. Buyers can choose lens types, indices, technologies, and options before adding their configured frame to the cart.",
  },
  {
    question: "How do I install and set up the app?",
    answer:
      "Install the app, then open it in Shopify Admin. The app creates a Lens Catalog product with one variant per catalog code. Set the variant prices and images, and publish the Lens Catalog product to the Online Store sales channel so its variants can be added to cart. In the theme editor, add the Customize Lens Studio app block to the frame product template, save, and preview a frame product.",
  },
  {
    question: "How do lens prices and images stay in sync?",
    answer:
      "Each Lens Catalog variant uses the matching lens catalog code as its SKU. The configurator looks up the variant by SKU and reads its Shopify price, option value name, and variant image. Keep the SKU unchanged so the app can continue matching the catalog item.",
  },
  {
    question: "Does the app save prescription details?",
    answer:
      "Yes. Buyers can save prescription measurements and optionally upload a prescription image or PDF. Saved files are stored privately. When a buyer adds a configured frame to the cart, selected lens details and prescription measurements are included as cart line-item properties and may appear on the Shopify order.",
  },
  {
    question: "What happens to data if I uninstall the app?",
    answer:
      "The app deletes its Shopify session records on uninstall and processes Shopify customer and shop erasure webhooks. Guest prescription records are set to expire after 30 days and are removed during the app's expired-record cleanup. For privacy questions, use the support contact on the Lens Option By Storetransform Shopify App Store listing.",
  },
];

export default function FrequentlyAskedQuestions() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Lens Option By Storetransform
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Frequently Asked Questions
        </h1>
        <div className="mt-8 divide-y divide-slate-200">
          {questions.map(({ question, answer }) => (
            <section key={question} className="py-6 first:pt-0 last:pb-0">
              <h2 className="text-lg font-semibold">{question}</h2>
              <p className="mt-2 leading-7 text-slate-700">{answer}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
