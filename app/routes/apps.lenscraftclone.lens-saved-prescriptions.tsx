import { authenticate } from "../shopify.server";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { createSavedPrescription, getSavedPrescriptionFile, getSavedPrescriptions, } from "../services/saved-prescription.server";
import { del, get, put } from "@vercel/blob";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id");
  const fileId = url.searchParams.get("fileId");

  if (!session || !customerId) {
    if (fileId) {
      return Response.json({ error: "Customer must be logged in" }, { status: 401 });
    }
    return Response.json({ savedPrescriptions: [] });
  }

  if (fileId) {
    try {
      const prescription = await getSavedPrescriptionFile({
        id: fileId,
        shop: session.shop,
        customerId,
      });

      if (!prescription?.fileKey || !prescription.fileType) {
        return Response.json({ error: "Prescription file not found" }, { status: 404 });
      }

      const blob = await get(prescription.fileKey, { access: "private" });
      if (!blob || blob.statusCode !== 200 || !blob.stream) {
        return Response.json({ error: "Prescription file not found" }, { status: 404 });
      }

      return new Response(blob.stream, {
        headers: {
          "Content-Type": prescription.fileType,
          "Content-Disposition": "inline",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error("Load prescription file failed:", error);
      return Response.json(
        { error: "Unable to load prescription file" },
        { status: 500 },
      );
    }
  }

  const savedPrescriptions = await getSavedPrescriptions({
    shop: session.shop,
    customerId,
  });

  return Response.json({
    savedPrescriptions: savedPrescriptions.map(
      ({ fileKey, ...prescription }) => ({
        ...prescription,
        fileUrl: fileKey
          ? `${url.pathname}?fileId=${encodeURIComponent(prescription.id)}`
          : null,
        rightSph: prescription.rightSph?.toString() ?? null,
        rightCyl: prescription.rightCyl?.toString() ?? null,
        leftSph: prescription.leftSph?.toString() ?? null,
        leftCyl: prescription.leftCyl?.toString() ?? null,
        pd: prescription.pd?.toString() ?? null,
      }),
    ),
  });
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

    if (!customerId) {
      return Response.json(
        { error: "Customer must be logged in" },
        { status: 401 },
      );
    }

    const formData = await request.formData();

    const name = String(formData.get("name") ?? "").trim();
    const rightSph = String(formData.get("rightSph") ?? "").trim();
    const leftSph = String(formData.get("leftSph") ?? "").trim();
    const pd = String(formData.get("pd") ?? "").trim();

    let uploadedFile: {
      pathname: string;
      contentType: string;
      size: number;
      originalName: string;
    } | null = null;

    const prescriptionImage = formData.get("prescriptionImage");

    if (prescriptionImage instanceof File && prescriptionImage.size > 0) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
      ];
      const maxFileSize = 5 * 1024 * 1024;

      if (!allowedTypes.includes(prescriptionImage.type)) {
        return Response.json(
          { error: "Only JPG, PNG, WEBP, and PDF files are allowed" },
          { status: 400 },
        );
      }

      if (prescriptionImage.size > maxFileSize) {
        return Response.json(
          { error: "Prescription file must be 5MB or smaller" },
          { status: 400 },
        );
      }

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

    if (!name || (!uploadedFile && (!rightSph || !leftSph || !pd))) {
      return Response.json(
        {
          error: uploadedFile
            ? "Name is required"
            : "Name, right SPH, left SPH, and PD are required unless a prescription file is uploaded",
        },
        { status: 400 },
      );
    }

    const getOptionalString = (key: string) => {
      const value = String(formData.get(key) ?? "").trim();
      return value || null;
    };

    const getOptionalNumber = (key: string) => {
      const value = getOptionalString(key);
      return value === null ? null : Number(value);
    };

    const prescription = await createSavedPrescription({
      shop: session.shop,
      customerId,
      name,
      rightSph: rightSph || null,
      rightCyl: getOptionalString("rightCyl"),
      rightAxis: getOptionalNumber("rightAxis"),
      leftSph: leftSph || null,
      leftCyl: getOptionalString("leftCyl"),
      leftAxis: getOptionalNumber("leftAxis"),
      pd: pd || null,
      prescribedAt: null,
      expiresAt: null,
      fileKey: uploadedFile?.pathname ?? null,
      fileName: uploadedFile?.originalName ?? null,
      fileType: uploadedFile?.contentType ?? null,
      fileSize: uploadedFile?.size ?? null,
    });

    return Response.json(
      { success: true, prescription },
      { status: 201 },
    );
  } catch (error) {
    console.error("Save prescription failed:", error);

    if (uploadedPathname) {
      try {
        await del(uploadedPathname);
      } catch (cleanupError) {
        console.error("Prescription blob cleanup failed:", cleanupError);
      }
    }

    return Response.json(
      { error: "Unable to save prescription" },
      { status: 500 },
    );
  }
}