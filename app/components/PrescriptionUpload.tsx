import { useRef, useState } from "react";
import { getGuestPrescriptionToken } from "../utils/guest-prescription-token";
import type { PrescriptionData } from "./PrescriptionForm";

type PrescriptionUploadProps = {
    proxyPathPrefix: string | null;
    errors: string[];
    onSelectionChange: () => void;
    onBack: () => void;
    onContinue: (
        file: File,
        prescription: PrescriptionData,
        fileName: string,
    ) => void;
    // Called when the server could not read all values from the file.
    onNeedsReview: (
        file: File,
        prescription: PrescriptionData,
        message: string,
    ) => void;
};

type UploadResponse = {
    success: boolean;
    prescription: {
        rightSph: string | null;
        rightCyl: string | null;
        rightAxis: number | null;
        leftSph: string | null;
        leftCyl: string | null;
        leftAxis: number | null;
        pd: string | null;
    };
    extractedPrescription: {
        rightSph: string | null;
        rightCyl: string | null;
        rightAxis: string | null;
        leftSph: string | null;
        leftCyl: string | null;
        leftAxis: string | null;
        pd: string | null;
    } | null;
    ocrStatus: "completed" | "not_requested" | "no_text" | "failed";
};

export default function PrescriptionUpload({
    proxyPathPrefix,
    errors,
    onSelectionChange,
    onBack,
    onContinue,
    onNeedsReview,
}: PrescriptionUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
    ];

    const handleFileChange = (selectedFile?: File) => {
        if (!selectedFile) return;

        setError("");
        onSelectionChange();

        if (!allowedTypes.includes(selectedFile.type)) {
            setError("Please upload a JPG, PNG, WEBP or PDF file.");
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            setError("File size must be 5MB or smaller.");
            return;
        }

        setFile(selectedFile);
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Please select your prescription first.");
            return;
        }

        if (
            !proxyPathPrefix ||
            !proxyPathPrefix.startsWith("/") ||
            proxyPathPrefix.startsWith("//")
        ) {
            setError("Upload service is not configured.");
            return;
        }

        setIsUploading(true);
        setError("");

        try {
            const endpoint = new URL(
                `${proxyPathPrefix}/lens-saved-prescriptions`,
                window.location.origin,
            );

            const formData = new FormData();
            formData.append("guestToken", getGuestPrescriptionToken());
            formData.append("name", "Uploaded Prescription");
            formData.append("prescriptionImage", file);

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { Accept: "application/json" },
                body: formData,
            });

            const responseJson = await response.json();

            if (!response.ok) {
                const found = responseJson?.extractedPrescription;

                if (response.status === 422 && found) {
                    onNeedsReview(
                        file,
                        {
                            rightSph: found.rightSph ?? "",
                            rightCyl: found.rightCyl ?? "",
                            rightAxis: found.rightAxis ?? "",
                            leftSph: found.leftSph ?? "",
                            leftCyl: found.leftCyl ?? "",
                            leftAxis: found.leftAxis ?? "",
                            pd: found.pd ?? "",
                        },
                        responseJson.error ??
                        "We couldn't read all values from your file.",
                    );
                    return;
                }

                throw new Error(
                    responseJson?.error ?? "Unable to upload prescription.",
                );
            }

            const saved = (responseJson as UploadResponse).prescription;

            const prescription: PrescriptionData = {
                rightSph: saved.rightSph ?? "",
                rightCyl: saved.rightCyl ?? "",
                rightAxis: saved.rightAxis?.toString() ?? "",
                leftSph: saved.leftSph ?? "",
                leftCyl: saved.leftCyl ?? "",
                leftAxis: saved.leftAxis?.toString() ?? "",
                pd: saved.pd ?? "",
            };

            onContinue(file, prescription, file.name);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to upload prescription.",
            );
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <section className="w-full bg-white px-5 py-8 md:px-12">
            <div className="w-full">

                <div className="mb-8">
                    <p className="text-sm font-semibold text-blue-600">
                        LENS CONFIGURATION
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        Upload Your Prescription
                    </h1>

                    <p className="mt-3 text-slate-600">
                        Upload a clear photo or PDF of your latest prescription.
                    </p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    onChange={(event) => {
                        handleFileChange(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />

                <button
                    type="button"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        handleFileChange(e.dataTransfer.files[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-slate-500"
                >
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                        ↑
                    </div>

                    <p className="font-semibold text-slate-800">
                        Drop your file here or browse
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                        JPG, PNG, WEBP or PDF · Maximum 5MB
                    </p>
                </button>

                {file && (
                    <div className="mt-5 flex items-center justify-between rounded-lg border border-slate-200 p-4">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                                {file.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                                {(file.size / 1024).toFixed(1)} KB
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setFile(null);
                                onSelectionChange();
                            }}
                            className="ml-4 text-sm font-medium text-red-600 hover:text-red-700"
                        >
                            Remove
                        </button>
                    </div>
                )}

                {error && (
                    <p role="alert" className="mt-4 text-sm text-red-600">
                        {error}
                    </p>
                )}

                {errors.length > 0 && (
                    <ul
                        role="alert"
                        className="mt-4 space-y-1 text-sm font-medium text-red-600"
                    >
                        {errors.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                )}

                <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
                    <button
                        type="button"
                        onClick={onBack}
                        className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        Back
                    </button>

                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={isUploading || !file}
                        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isUploading ? "Uploading…" : "Continue"}
                    </button>
                </div>
            </div>
        </section>
    );
}