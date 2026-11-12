import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { handleComplianceWebhook } from "../services/compliance.server";

export async function action({ request }: ActionFunctionArgs) {
  const { shop, topic, payload } = await authenticate.webhook(request);
  await handleComplianceWebhook(topic, shop, payload);
  return new Response(null, { status: 200 });
}
