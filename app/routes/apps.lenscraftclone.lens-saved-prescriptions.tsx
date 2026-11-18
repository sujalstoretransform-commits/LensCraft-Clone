/* eslint-disable @typescript-eslint/no-explicit-any */
import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs } from "react-router";
import {
  createSavedPrescription,
  getSavedPrescriptionFile,
  getSavedPrescriptions,
  cleanupExpiredGuestPrescriptions,
} from "../services/saved-prescription.server";
import { del, get, put } from "@vercel/blob";
import { validatePrescription } from "app/services/prescription";

import { extractPrescription } from "app/services/prescription-ocr.server";


const GUEST_EXPIRY_DAYS = 30;
const GUEST_EXPIRY_SECONDS = GUEST_EXPIRY_DAYS * 24 * 60 * 60;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

function isValidGuestToken(token: string | null): token is string {
  return Boolean(token && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token));
}

function guestExpiryDate() {
  return new Date(Date.now() + GUEST_EXPIRY_SECONDS * 1000);
}

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function getOptionalNumber(formData: FormData, key: string) {
  const value = getOptionalString(formData, key);

  if (value === null) return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : NaN;
}

function parseOcrAxis(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getPrescriptionOwner(customerId: string | null, guestToken: string | null) {
  return customerId
    ? { customerId }
    : { guestToken: guestToken! };
}

export async function loader() {
  return Response.json({ error: "POST required" }, { status: 405, headers: { Allow: "POST" } });
}

export async function action({ request }: ActionFunctionArgs) {
  let uploadedPathname: string | null = null;

  try {
    const { session } = await authenticate.public.appProxy(request);

    if (!session) {
      return Response.json(
        { error: "Invalid Shopify session" },
        { status: 401 },
      );
    }

    await cleanupExpiredGuestPrescriptions(session.shop);

    const url = new URL(request.url);
    const customerId = url.searchParams.get("logged_in_customer_id");

    const formData = await request.formData();
    const intent = String(formData.get("intent") ?? "");
    const rawGuestToken = String(formData.get("guestToken") ?? "");
    const guestToken = isValidGuestToken(rawGuestToken) ? rawGuestToken : null;

    if (!customerId && !guestToken) {
      return Response.json({ error: "Guest session is missing. Refresh and try again." }, { status: 400 });
    }

    if (intent === "list") {
      const savedPrescriptions = await getSavedPrescriptions({
        shop: session.shop,
        ...getPrescriptionOwner(customerId, guestToken),
      });
      return Response.json({
        savedPrescriptions: savedPrescriptions.map((prescription: any) => ({
          ...prescription,
          hasFile: Boolean(prescription.fileKey),
          rightSph: prescription.rightSph?.toString() ?? null,
          rightCyl: prescription.rightCyl?.toString() ?? null,
          leftSph: prescription.leftSph?.toString() ?? null,
          leftCyl: prescription.leftCyl?.toString() ?? null,
          pd: prescription.pd?.toString() ?? null,
        })),
      });
    }

    if (intent === "get-file") {
      const fileId = String(formData.get("fileId") ?? "").trim();

      if (!fileId) {
        return Response.json(
          { error: "Prescription ID is required" },
          { status: 400 },
        );
      }

      const owner = getPrescriptionOwner(customerId, guestToken!);

      const prescription = await getSavedPrescriptionFile({
        id: fileId,
        shop: session.shop,
        ...owner,
      });

      if (!prescription?.fileKey || !prescription.fileType) {
        return Response.json(
          { error: "Prescription file not found" },
          { status: 404 },
        );
      }

      const blob = await get(prescription.fileKey, {
        access: "private",
      });

      if (!blob || blob.statusCode !== 200 || !blob.stream) {
        return Response.json(
          { error: "Prescription file not found" },
          { status: 404 },
        );
      }

      const headers = new Headers({
        "Content-Type": prescription.fileType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });

      return new Response(blob.stream, { headers });
    }

    const name = String(formData.get("name") ?? "").trim();
    const rightSph = String(formData.get("rightSph") ?? "").trim();
    const leftSph = String(formData.get("leftSph") ?? "").trim();
    const pd = String(formData.get("pd") ?? "").trim();

    const prescriptionImage = formData.get("prescriptionImage");
    const hasFile =
      prescriptionImage instanceof File && prescriptionImage.size > 0;

    let uploadedFile: {
      pathname: string;
      contentType: string;
      size: number;
      originalName: string;
    } | null = null;

    if (hasFile) {
      const file = prescriptionImage as File;

      if (!ALLOWED_TYPES.includes(file.type)) {
        return Response.json(
          { error: "Only JPG, PNG, WEBP, and PDF files are allowed" },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: "Prescription file must be 5MB or smaller" },
          { status: 400 },
        );
      }
    }

    if (!name || (!prescriptionImage && (!rightSph || !leftSph || !pd))) {
      return Response.json(
        {
          error: !name
            ? "Prescription name is required"
            : "Right SPH, left SPH, and PD are required unless a prescription file is uploaded",
        },
        { status: 400 },
      );
    }

    const rightAxis = getOptionalNumber(formData, "rightAxis");
    const leftAxis = getOptionalNumber(formData, "leftAxis");

    if (Number.isNaN(rightAxis) || Number.isNaN(leftAxis)) {
      return Response.json(
        { error: "Invalid prescription axis value" },
        { status: 400 },
      );
    }

    const extraction = hasFile
      ? await extractPrescription(prescriptionImage as File)
      : null;
    const extracted = extraction?.prescription ?? null;

    const finalRightSph = extracted?.rightSph ?? (rightSph || null);
    const finalLeftSph = extracted?.leftSph ?? (leftSph || null);
    const finalPd = extracted?.pd ?? (pd || null);

    if (hasFile && (!finalRightSph || !finalLeftSph || !finalPd)) {
      return Response.json(
        {
          error:
            extraction?.status === "failed"
              ? "We couldn't read your file. Please enter or check the values below."
              : "We couldn't read all values from your file. Please check the values below.",
          extractedPrescription: extracted,
          ocrStatus: extraction?.status,
        },
        { status: 422 },
      );
    }

    if (hasFile) {
      const file = prescriptionImage as File;

      const extensionByType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
      };

      const pathname = `prescriptions/${crypto.randomUUID()}.${extensionByType[file.type]}`;

      const blob = await put(pathname, file, {
        access: "private",
        addRandomSuffix: true,
        contentType: file.type,
      });

      uploadedPathname = blob.pathname;

      uploadedFile = {
        pathname: blob.pathname,
        contentType: file.type,
        size: file.size,
        originalName: file.name,
      };
    }

    if (extracted) {
      const num = (v: string | null) => (v ? Number(v) : undefined);

      const check = validatePrescription({
        right: {
          sph: num(extracted.rightSph),
          cyl: num(extracted.rightCyl),
          axis: num(extracted.rightAxis),
        },
        left: {
          sph: num(extracted.leftSph),
          cyl: num(extracted.leftCyl),
          axis: num(extracted.leftAxis),
        },
        pd: { single: num(extracted.pd) },
      })

      if (!check.valid) {
        if (uploadedPathname) {
          await del(uploadedPathname).catch(() => { })
        }
        return Response.json({ error: check.errors.join(" ") }, { status: 400 })
      }

    }

    const prescription = await createSavedPrescription({
      shop: session.shop,

      ...(customerId
        ? { customerId }
        : {
          guestToken: guestToken!,
          guestExpiresAt: guestExpiryDate(),
        }),

      name,
      rightSph: finalRightSph,
      rightCyl: extracted?.rightCyl ?? getOptionalString(formData, "rightCyl"),
      rightAxis: parseOcrAxis(extracted?.rightAxis ?? null) ?? rightAxis,
      leftSph: finalLeftSph,
      leftCyl: extracted?.leftCyl ?? getOptionalString(formData, "leftCyl"),
      leftAxis: parseOcrAxis(extracted?.leftAxis ?? null) ?? leftAxis,
      pd: finalPd,

      prescribedAt: null,
      expiresAt: null,

      fileKey: uploadedFile?.pathname ?? null,
      fileName: uploadedFile?.originalName ?? null,
      fileType: uploadedFile?.contentType ?? null,
      fileSize: uploadedFile?.size ?? null,
    });

    return Response.json(
      {
        success: true,
        prescription,
        extractedPrescription: extracted,
        ocrStatus: extraction?.status ?? "not_requested",
      },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedPathname) {
      try {
        await del(uploadedPathname);
      } catch (cleanupError) {
        console.error(
          "Prescription blob cleanup failed:",
          cleanupError,
        );
      }
    }

    if (error instanceof Response) throw error;

    console.error("Save prescription failed:", error);
    return Response.json(
      { error: "Prescription storage is temporarily unavailable." },
      { status: 503 },
    );
  }
}