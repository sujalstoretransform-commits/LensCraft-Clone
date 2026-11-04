import { useRef, useState } from "react";

type PrescriptionUploadProps = {
    proxyPathPrefix: string | null;
    onBack: () => void;
    onContinue: (file: File, fileName: string) => void;
};

export default function PrescriptionUpload({
    proxyPathPrefix,
    onBack,
    onContinue
}: PrescriptionUploadProps
) {
    const fileInputRef = useRef<HTMLInputElement>(null)

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

        setError("")

        if (!allowedTypes.includes(selectedFile.type)) {
            setError("Please upload a JPG, PNG, WEBP or PDF file.");
            return;
        }
        if (selectedFile.size > 5 * 1024 * 1024) {
            setError("File size must be 5MB or smaller.");
            return;
        }
        setFile(selectedFile);
    }

    const handleUpload = async () => {
        if (!file) {
            setError("Please select your prescription first.");
            return;
        }

        if (!proxyPathPrefix || !proxyPathPrefix.startsWith("/") || proxyPathPrefix.startsWith("//")) {
            setError("Upload service is not configured.");
            return;
        }

        setIsUploading(true)
        setError("")

        try {
            const endpoint = new URL(`${proxyPathPrefix}/lens-saved-prescriptions`, window.location.origin)

            const formData = new FormData();

            formData.append("name", "Uploaded Prescription");
            formData.append("prescriptionImage", file);

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json"
                },
                body: formData
            })

            const responseText = await response.text();
            let result: unknown = null;
            try {
                result = JSON.parse(responseText);
            } catch {
                if (!response.ok) {
                    throw new Error(
                        `Upload failed (HTTP ${response.status} ${response.statusText}). The app proxy returned a non-JSON response.`,
                    );
                }
            }

            if (!response.ok) {
                const message =
                    typeof result === "object" &&
                    result !== null &&
                    "error" in result &&
                    typeof result.error === "string"
                        ? result.error
                        : `Unable to upload prescription (HTTP ${response.status}).`;
                throw new Error(message);
            }

            if (result === null) {
                throw new Error("The upload endpoint returned an invalid response.");
            }

            onContinue(file, file.name)
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to upload prescription.",
            );
        } finally {
            setIsUploading(false);
        }
    }

    return (
        <section className="w-full bg-white px-5 py-8 md:px-12">
            <div className="w-full">
                <div className="mb-8">
                    <h2 className="text-2xl font-semibold text-slate-900">
                        Upload your prescription
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                        Upload a clear photo or PDF of your latest prescription.
                    </p>
                </div>

                <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                        event.preventDefault();
                        handleFileChange(event.dataTransfer.files[0])
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-slate-500"
                >
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

                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                        ↑
                    </div>

                    <p className="font-semibold text-slate-800">
                        Drop your file here or browse
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                        JPG, PNG, WEBP or PDF · Maximum 5MB
                    </p>
                </div>

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
                            onClick={() => setFile(null)}
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
                        disabled={!file || isUploading}
                        onClick={handleUpload}
                        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                        {isUploading ? "Uploading" : "Continue"}
                    </button>
                </div>
            </div>
        </section >
    )
}
