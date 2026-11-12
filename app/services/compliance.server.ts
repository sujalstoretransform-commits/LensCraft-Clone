import { del } from "@vercel/blob";
import db from "../db.server";

type CompliancePayload = {
  customer?: { id?: number | string };
  data_request?: { id?: number | string };
};

async function deletePrescriptionFiles(shop: string, customerId?: string) {
  const prescriptions = await db.savedPrescription.findMany({
    where: { shop, ...(customerId ? { customerId } : {}) },
    select: { fileKey: true },
  });
  const keys = prescriptions.flatMap((item) => item.fileKey ? [item.fileKey] : []);
  if (keys.length) await del(keys);
}

export async function handleComplianceWebhook(
  topic: string,
  shop: string,
  payload: CompliancePayload,
) {
  if (topic === "CUSTOMERS_DATA_REQUEST") {
    const customerId = payload.customer?.id?.toString();
    const count = customerId
      ? await db.savedPrescription.count({ where: { shop, customerId } })
      : 0;
    if (customerId) {
      const requestId = payload.data_request?.id?.toString() ?? crypto.randomUUID();
      await db.privacyDataRequest.upsert({
        where: { shop_requestId: { shop, requestId } },
        create: { shop, requestId, customerId },
        update: {},
      });
    }
    console.info("Customer data request received", { shop, customerId, savedPrescriptionCount: count });
    return;
  }

  if (topic === "CUSTOMERS_REDACT") {
    const customerId = payload.customer?.id?.toString();
    if (!customerId) return;
    await deletePrescriptionFiles(shop, customerId);
    await db.savedPrescription.deleteMany({ where: { shop, customerId } });
    await db.privacyDataRequest.deleteMany({ where: { shop, customerId } });
    return;
  }

  if (topic === "SHOP_REDACT") {
    await deletePrescriptionFiles(shop);
    await db.savedPrescription.deleteMany({ where: { shop } });
    await db.privacyDataRequest.deleteMany({ where: { shop } });
    await db.lensConfiguration.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
  }
}
