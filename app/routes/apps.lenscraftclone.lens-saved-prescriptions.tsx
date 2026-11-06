import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import {
  createSavedPrescription,
  getSavedPrescriptionFile,
  getSavedPrescriptions,
} from "../services/saved-prescription.server";
import { del, get, put } from "@vercel/blob";

const GUEST_COOKIE = "lenscraft_guest_prescription";
const GUEST_EXPIRY_DAYS = 30;
const GUEST_EXPIRY_SECONDS = GUEST_EXPIRY_DAYS * 24 * 60 * 60;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.substring(name.length + 1));
  } catch {
    return null;
  }
}

function createGuestToken() {
  return crypto.randomUUID();
}

function createGuestCookie(token: string) {
  return [
    `${GUEST_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${GUEST_EXPIRY_SECONDS}`,
  ].join("; ");
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

function getPrescriptionOwner(customerId: string | null, guestToken: string) {
  return customerId
    ? { customerId }
    : { guestToken };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return Response.json(
      { error: "Invalid Shopify session" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id");

  let guestToken = getCookie(request, GUEST_COOKIE);
  let shouldSetCookie = false;

  if (!customerId && !guestToken) {
    guestToken = createGuestToken();
    shouldSetCookie = true;
  }

  const owner = getPrescriptionOwner(customerId, guestToken!);

  const headers = new Headers();

  if (shouldSetCookie) {
    headers.append("Set-Cookie", createGuestCookie(guestToken!));
  }

  try {
    const savedPrescriptions = await getSavedPrescriptions({
      shop: session.shop,
      ...owner,
    });

    return Response.json(
      {
        savedPrescriptions: savedPrescriptions.map(
          ({ fileKey, ...prescription }) => ({
            ...prescription,
            hasFile: Boolean(fileKey),
            rightSph: prescription.rightSph?.toString() ?? null,
            rightCyl: prescription.rightCyl?.toString() ?? null,
            leftSph: prescription.leftSph?.toString() ?? null,
            leftCyl: prescription.leftCyl?.toString() ?? null,
            pd: prescription.pd?.toString() ?? null,
          }),
        ),
      },
      { headers },
    );
  } catch (error) {
    console.error("Load saved prescriptions failed:", error);

    return Response.json(
      { error: "Saved prescriptions are temporarily unavailable." },
      { status: 503, headers },
    );
  }
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

    const url = new URL(request.url);
    const customerId = url.searchParams.get("logged_in_customer_id");

    let guestToken = getCookie(request, GUEST_COOKIE);
    let shouldSetCookie = false;

    if (!customerId && !guestToken) {
      guestToken = createGuestToken();
      shouldSetCookie = true;
    }

    const formData = await request.formData();

    const intent = String(formData.get("intent") ?? "");

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

      if (shouldSetCookie && guestToken) {
        headers.append("Set-Cookie", createGuestCookie(guestToken));
      }

      return new Response(blob.stream, { headers });
    }

    const name = String(formData.get("name") ?? "").trim();
    const rightSph = String(formData.get("rightSph") ?? "").trim();
    const leftSph = String(formData.get("leftSph") ?? "").trim();
    const pd = String(formData.get("pd") ?? "").trim();

    const prescriptionImage = formData.get("prescriptionImage");

    let uploadedFile: {
      pathname: string;
      contentType: string;
      size: number;
      originalName: string;
    } | null = null;

    // Validate the file before uploading.
    if (prescriptionImage instanceof File && prescriptionImage.size > 0) {
      if (!ALLOWED_TYPES.includes(prescriptionImage.type)) {
        return Response.json(
          { error: "Only JPG, PNG, WEBP, and PDF files are allowed" },
          { status: 400 },
        );
      }

      if (prescriptionImage.size > MAX_FILE_SIZE) {
        return Response.json(
          { error: "Prescription file must be 5MB or smaller" },
          { status: 400 },
        );
      }
    }

    // Validate required prescription information before uploading.
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

    // Validate optional numeric fields.
    const rightAxis = getOptionalNumber(formData, "rightAxis");
    const leftAxis = getOptionalNumber(formData, "leftAxis");

    if (Number.isNaN(rightAxis) || Number.isNaN(leftAxis)) {
      return Response.json(
        { error: "Invalid prescription axis value" },
        { status: 400 },
      );
    }

    // Upload the prescription privately to Vercel Blob.
    if (prescriptionImage instanceof File && prescriptionImage.size > 0) {
      const extensionByType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
      };

      const pathname = `prescriptions/${crypto.randomUUID()}.${extensionByType[prescriptionImage.type]}`;

      const blob = await put(pathname, prescriptionImage, {
        access: "private",
        addRandomSuffix: true,
        contentType: prescriptionImage.type,
      });

      uploadedPathname = blob.pathname;

      uploadedFile = {
        pathname: blob.pathname,
        contentType: prescriptionImage.type,
        size: prescriptionImage.size,
        originalName: prescriptionImage.name,
      };
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
      rightSph: rightSph || null,
      rightCyl: getOptionalString(formData, "rightCyl"),
      rightAxis,
      leftSph: leftSph || null,
      leftCyl: getOptionalString(formData, "leftCyl"),
      leftAxis,
      pd: pd || null,

      prescribedAt: null,
      expiresAt: null,

      fileKey: uploadedFile?.pathname ?? null,
      fileName: uploadedFile?.originalName ?? null,
      fileType: uploadedFile?.contentType ?? null,
      fileSize: uploadedFile?.size ?? null,
    });

    const headers = new Headers();

    if (shouldSetCookie && guestToken) {
      headers.append("Set-Cookie", createGuestCookie(guestToken));
    }

    return Response.json(
      { success: true, prescription },
      { status: 201, headers },
    );
  } catch (error) {
    // Remove the uploaded file if database saving fails.
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