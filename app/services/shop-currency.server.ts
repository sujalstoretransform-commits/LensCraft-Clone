import { authenticate } from "../shopify.server";

type StoreCurrencyResponse = {
  errors?: unknown[];
  data?: {
    shop?: {
      currencyCode?: unknown;
    };
  };
};

const getGraphqlErrors = (body: unknown) => {
  if (typeof body !== "object" || body === null) return [];
  const errors = "errors" in body ? body.errors : undefined;
  return Array.isArray(errors) ? errors : [];
};

export async function getAuthenticatedShopCurrency(
  request: Request,
): Promise<string> {
  const isAppProxy = new URL(request.url).searchParams.has("signature");
  const { admin } = isAppProxy
    ? await authenticate.public.appProxy(request)
    : await authenticate.admin(request);

  if (!admin) {
    throw new Response("Unable to authenticate this Shopify store.", {
      status: 401,
    });
  }

  try {
    const response = await admin.graphql(`#graphql
      query StoreCurrency {
        shop {
          currencyCode
        }
      }`);
    const body = (await response.json()) as StoreCurrencyResponse;
    const errors = getGraphqlErrors(body);
    if (!response.ok || errors.length > 0) {
      console.error(
        "Authenticated shop currency lookup failed:",
        response.status,
        errors,
      );
      throw new Response("Unable to verify this store's currency.", {
        status: 502,
      });
    }

    const currencyCode = body.data?.shop?.currencyCode;
    if (typeof currencyCode !== "string" || !/^[A-Z]{3}$/.test(currencyCode)) {
      throw new Response("Shopify returned an invalid store currency.", {
        status: 502,
      });
    }
    return currencyCode;
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error("Authenticated shop currency lookup failed:", error);
    throw new Response("Unable to verify this store's currency.", {
      status: 502,
    });
  }
}
