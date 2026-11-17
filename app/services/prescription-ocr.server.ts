import { createWorker, OEM, PSM } from "tesseract.js";
import { extractText, getDocumentProxy } from "unpdf";
import sharp from 'sharp'
import path from "path";

export type ExtractedPrescription = {
    rightSph: string | null;
    rightCyl: string | null;
    rightAxis: string | null;
    leftSph: string | null;
    leftCyl: string | null;
    leftAxis: string | null;
    pd: string | null;
};

export type OcrStatus = "completed" | "no_text" | "failed";

export type ExtractionResult = {
    prescription: ExtractedPrescription;
    status: OcrStatus;
};

function extractValue(line: string, label: RegExp): string | null {
    const match = line.match(label);
    return match?.[1]?.trim() || null;
}

function emptyPrescription(): ExtractedPrescription {
    return {
        rightSph: null,
        rightCyl: null,
        rightAxis: null,
        leftSph: null,
        leftCyl: null,
        leftAxis: null,
        pd: null,
    };
}

function hasAnyValue(prescription: ExtractedPrescription): boolean {
    return Object.values(prescription).some((value) => value !== null);
}

function parsePrescriptionText(rawText: string): ExtractedPrescription {
    const result = emptyPrescription();

    const lines = rawText
        .replace(/[−–—]/g, "-")
        .replace(/[+]/g, "+")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        if (result.rightSph === null) {
            result.rightSph = extractValue(
                line,
                /(?:right\s*)?(?:od|r)\s*(?:sph)?[:\s=]*([-+]?\d+(?:\.\d+)?)/i,
            );
        }

        if (result.rightCyl === null) {
            result.rightCyl = extractValue(
                line,
                /(?:right\s*)?(?:od|r)\s*(?:cyl)[:\s=]*([-+]?\d+(?:\.\d+)?)/i,
            );
        }

        if (result.rightAxis === null) {
            result.rightAxis = extractValue(
                line,
                /(?:right\s*)?(?:od|r)\s*(?:axis)[:\s=]*(\d{1,3})/i,
            );
        }

        if (result.leftSph === null) {
            result.leftSph = extractValue(
                line,
                /(?:left\s*)?(?:os|l)\s*(?:sph)?[:\s=]*([-+]?\d+(?:\.\d+)?)/i,
            );
        }

        if (result.leftCyl === null) {
            result.leftCyl = extractValue(
                line,
                /(?:left\s*)?(?:os|l)\s*(?:cyl)[:\s=]*([-+]?\d+(?:\.\d+)?)/i,
            );
        }

        if (result.leftAxis === null) {
            result.leftAxis = extractValue(
                line,
                /(?:left\s*)?(?:os|l)\s*(?:axis)[:\s=]*(\d{1,3})/i,
            );
        }

        if (result.pd === null) {
            result.pd = extractValue(
                line,
                /\b(?:pd|p\.d\.|pupillary\s+distance)[:\s=]*(\d{2}(?:\.\d+)?)/i,
            );
        }

        if (result.rightSph === null) {
            result.rightSph = extractValue(
                line,
                /right\s*sph[:\s=]*([-+]?\d+(?:\.\d+)?)/i,
            );
        }

        if (result.rightCyl === null) {
            result.rightCyl = extractValue(
                line,
                /right\s*cyl[:\s=]*([-+]?\d+(?:\.\d+)?)/i,
            );
        }

        if (result.rightAxis === null) {
            result.rightAxis = extractValue(
                line,
                /right\s*axis[:\s=]*(\d{1,3})/i,
            );
        }

        if (result.leftSph === null) {
            result.leftSph = extractValue(
                line,
                /left\s*sph[:\s=]*([-+]?\d+(?:\.\d+)?)/i,
            );
        }

        if (result.leftCyl === null) {
            result.leftCyl = extractValue(
                line,
                /left\s*cyl[:\s=]*([-+]?\d+(?:\.\d+)?)/i,
            );
        }

        if (result.leftAxis === null) {
            result.leftAxis = extractValue(
                line,
                /left\s*axis[:\s=]*(\d{1,3})/i,
            );
        }
    }

    return result;
}

async function ocrImage(buffer: Buffer): Promise<string> {
    let worker: Awaited<ReturnType<typeof createWorker>> | undefined;

    try {
        console.time("createWorker");
        worker = await createWorker("eng", OEM.LSTM_ONLY, {
            langPath: path.join(process.cwd(), "tessdata"),
            cachePath: "/tmp",
        });
        console.timeEnd("createWorker");

        await worker.setParameters({
            tessedit_ocr_engine_mode: OEM.LSTM_ONLY,
            tessedit_pageseg_mode: PSM.AUTO,
        });

        console.time("recognize");
        const { data } = await worker.recognize(buffer);
        console.timeEnd("recognize");

        return data.text;
    } finally {
        if (worker) {
            await worker.terminate();
        }
    }
}

async function extractFromPdf(file: File): Promise<ExtractedPrescription> {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));

    const { text } = await extractText(pdf, { mergePages: true });
    console.info("PDF raw text:", text);

    return parsePrescriptionText(text);
}

export async function extractPrescription(
    file: File,
): Promise<ExtractionResult> {
    try {
        let prescription: ExtractedPrescription;

        if (file.type === "application/pdf") {
            prescription = await extractFromPdf(file);
        } else if (
            ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        ) {
            const buffer = Buffer.from(await file.arrayBuffer());

            const resized = await sharp(buffer)
                .rotate()
                .resize({ width: 1800, withoutEnlargement: true })
                .grayscale()
                .toBuffer();

            prescription = parsePrescriptionText(await ocrImage(resized));
        } else {
            throw new Error("Unsupported prescription file type.");
        }

        console.info("Extracted prescription:", prescription);

        return {
            prescription,
            status: hasAnyValue(prescription) ? "completed" : "no_text",
        };
    } catch (error) {
        console.error("Prescription extraction failed:", error);
        return { prescription: emptyPrescription(), status: "failed" };
    }
}