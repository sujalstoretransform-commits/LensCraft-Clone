import prisma from "../db.server";
import { del } from "@vercel/blob";

export async function cleanupExpiredGuestPrescriptions(shop: string) {
  const where = { shop, guestExpiresAt: { lte: new Date() } };
  const expired = await prisma.savedPrescription.findMany({
    where,
    select: { fileKey: true },
  });
  const fileKeys = expired.flatMap(({ fileKey }) => fileKey ? [fileKey] : []);
  if (fileKeys.length) await del(fileKeys);
  await prisma.savedPrescription.deleteMany({ where });
}

const prescriptionSelect = {
  id: true,
  name: true,
  rightSph: true,
  rightCyl: true,
  rightAxis: true,
  leftSph: true,
  leftCyl: true,
  leftAxis: true,
  pd: true,
  prescribedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  fileKey: true,
  fileName: true,
  fileType: true,
  fileSize: true,
};

type PrescriptionOwner =
  | { customerId: string; guestToken?: never }
  | { customerId?: never; guestToken: string };

export const getSavedPrescriptions = async ({
  shop,
  customerId,
  guestToken,
}: {
  shop: string;
} & PrescriptionOwner) => {
  return prisma.savedPrescription.findMany({
    where: {
      shop,
      ...(customerId
        ? { customerId }
        : {
            guestToken,
            guestExpiresAt: { gt: new Date() },
          }),
    },
    orderBy: { updatedAt: "desc" },
    select: prescriptionSelect,
  });
};

export const getSavedPrescriptionFile = async ({
  id,
  shop,
  customerId,
  guestToken,
}: {
  id: string;
  shop: string;
} & PrescriptionOwner) => {
  return prisma.savedPrescription.findFirst({
    where: {
      id,
      shop,
      ...(customerId
        ? { customerId }
        : {
            guestToken,
            guestExpiresAt: { gt: new Date() },
          }),
    },
    select: {
      fileKey: true,
      fileName: true,
      fileType: true,
    },
  });
};

type InputPrescription = {
  shop: string;
  customerId?: string | null;
  guestToken?: string | null;
  guestExpiresAt?: Date | null;
  name: string;
  rightSph?: string | null;
  rightCyl?: string | null;
  rightAxis?: number | null;
  leftSph?: string | null;
  leftCyl?: string | null;
  leftAxis?: number | null;
  pd?: string | null;
  prescribedAt?: Date | null;
  expiresAt?: Date | null;
  fileKey?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
};

export const createSavedPrescription = async (input: InputPrescription) => {
  const hasCustomer = Boolean(input.customerId);
  const hasGuest = Boolean(input.guestToken);

  if (hasCustomer === hasGuest) {
    throw new Error("Exactly one prescription owner is required.");
  }

  if (!hasCustomer && !input.guestExpiresAt) {
    throw new Error("Guest prescription expiry is required.");
  }

  return prisma.savedPrescription.create({
    data: {
      shop: input.shop,
      customerId: input.customerId ?? null,
      guestToken: input.guestToken ?? null,
      guestExpiresAt: input.guestExpiresAt ?? null,
      name: input.name,
      rightSph: input.rightSph ?? null,
      rightCyl: input.rightCyl ?? null,
      rightAxis: input.rightAxis ?? null,
      leftSph: input.leftSph ?? null,
      leftCyl: input.leftCyl ?? null,
      leftAxis: input.leftAxis ?? null,
      pd: input.pd ?? null,
      prescribedAt: input.prescribedAt ?? null,
      expiresAt: input.expiresAt ?? null,
      fileKey: input.fileKey ?? null,
      fileName: input.fileName ?? null,
      fileType: input.fileType ?? null,
      fileSize: input.fileSize ?? null,
    },
    select: prescriptionSelect,
  });
};
