import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors = actionData?.errors;

  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 text-center">
      <div className="grid gap-8">
        <h1 className="m-0 p-0">A short heading about [your app]</h1>
        <p className="m-0 p-0 pb-8 text-[1.2rem]">
          A tagline about [your app] that describes your value proposition.
        </p>
        {showForm && (
          <Form className="mx-auto flex items-center justify-start gap-4" method="post">
            <label className="grid max-w-80 gap-[0.2rem] text-left text-base">
              <span>Shop domain</span>
              <input className="p-1.5" type="text" name="shop" />
              <span>{errors?.shop ?? "e.g: my-shop-domain.myshopify.com"}</span>
            </label>
            <button className="p-1.5" type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className="m-0 flex list-none gap-8 p-0 pt-12 max-[50rem]:block">
          <li className="max-w-80 text-left max-[50rem]:pb-4">
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li className="max-w-80 text-left max-[50rem]:pb-4">
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li className="max-w-80 text-left">
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
        </ul>
      </div>
    </main>
  );
}
