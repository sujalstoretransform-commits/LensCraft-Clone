import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { get } from "@vercel/blob";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response("Prescription ID is required", { status: 400 });

  const prescription = await db.savedPrescription.findFirst({
    where: { id, shop: session.shop },
    select: { fileKey: true, fileName: true, fileType: true },
  });
  if (!prescription?.fileKey || !prescription.fileType) {
    return new Response("Prescription file not found", { status: 404 });
  }

  const blob = await get(prescription.fileKey, { access: "private" });
  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return new Response("Prescription file not found", { status: 404 });
  }
  const safeName = (prescription.fileName ?? "prescription").replace(/[\r\n"\\]/g, "_");
  return new Response(blob.stream, {
    headers: {
      "Content-Type": prescription.fileType,
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
