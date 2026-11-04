import { useEffect, useState } from "react";
import type { PrescriptionData } from "./PrescriptionForm";

type SavedPrescription = {
    id: string;
    name: string;

    rightSph: string | null;
    rightCyl: string | null;
    rightAxis: number | null;

    leftSph: string | null;
    leftCyl: string | null;
    leftAxis: number | null;

    pd: string | null;

    fileUrl: string | null;
    fileName: string | null;
    fileType: string | null;

    prescribedAt: string | null;
    expiresAt: string | null;
};

type Props = {
    proxyPathPrefix: string | null;
    onBack: () => void;
    onUseManual: () => void;
    errors: string[];
    onSelectionChange: () => void;
    onContinue: (
        prescription: PrescriptionData,
        image?: File,
        fileUrl?: string,
        fileName?: string,
    ) => void;
    requirePrescriptionImage: boolean;
};

export default function SavedPrescriptionSelector({
    proxyPathPrefix,
    onBack,
    onUseManual,
    errors,
    onSelectionChange,
    onContinue,
    requirePrescriptionImage,
}: Props) {
    const [prescriptions, setPrescriptions] = useState<SavedPrescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [validationError, setValidationError] = useState("");

    const [selectedPrescription, setSelectedPrescription] = useState<SavedPrescription | null>(null);


    const onHandleContinue = () => {
        if (!selectedPrescription) {
            setValidationError("Please select a saved prescription.");
            return
        }

        if (!selectedPrescription.fileUrl && requirePrescriptionImage) {
            setValidationError(
                "This prescription has no attached file. Please enter your prescription manually."
            );
            return;
        }

        onContinue(
            {
                rightSph: selectedPrescription.rightSph ?? "",
                rightCyl: selectedPrescription.rightCyl ?? "",
                rightAxis: selectedPrescription.rightAxis?.toString() ?? "",
                leftSph: selectedPrescription.leftSph ?? "",
                leftCyl: selectedPrescription.leftCyl ?? "",
                leftAxis: selectedPrescription.leftAxis?.toString() ?? "",
                pd: selectedPrescription.pd ?? "",
            },
            undefined,
            selectedPrescription.fileUrl ?? undefined,
            selectedPrescription.fileName ?? undefined,
        )
    }


    useEffect(() => {
        const controller = new AbortController();

        async function loadPrescriptions() {
            try {
                if (!proxyPathPrefix?.startsWith("/") || proxyPathPrefix.startsWith("//")) {
                    throw new Error("Saved prescriptions are only available through the Shopify app proxy.");
                }

                const endpoint = new URL(
                    `${proxyPathPrefix}/lens-saved-prescriptions`,
                    window.location.origin,
                );
                const response = await fetch(endpoint, {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error("Unable to load saved prescriptions.");
                }

                const data: unknown = await response.json();

                if (
                    typeof data !== "object" ||
                    data === null ||
                    !("savedPrescriptions" in data) ||
                    !Array.isArray(data.savedPrescriptions)
                ) {
                    throw new Error("Invalid saved prescriptions response.");
                }

                setPrescriptions(data.savedPrescriptions as SavedPrescription[]);
            } catch (err) {
                if (err instanceof Error && err.name !== "AbortError") {
                    setError(err.message);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadPrescriptions();

        return () => controller.abort();
    }, [proxyPathPrefix]);

    return (
        <section className="w-full bg-white px-6 py-6 md:px-12">
            <div className="mb-4">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Choose a saved prescription
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    Select a prescription saved to your customer account.
                </p>

                {loading && (
                    <p className="mt-6 text-sm text-slate-500">
                        Loading prescriptions…
                    </p>
                )}

                {error && (
                    <p role="alert" className="mt-6 text-sm text-red-600">
                        {error}
                    </p>
                )}

                {!loading && !error && prescriptions.length === 0 && (
                    <div className="mt-8 rounded-xl border border-slate-200 p-6">
                        <p className="font-medium text-slate-900">
                            No saved prescriptions found
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                            Enter your prescription manually to continue.
                        </p>
                        <button
                            type="button"
                            onClick={onUseManual}
                            className="mt-5 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white"
                        >
                            Enter prescription manually
                        </button>
                    </div>
                )}

                <div className="mt-6 grid gap-4">
                    {prescriptions.map((prescription) => (
                        <button
                            key={prescription.id}
                            type="button"
                            onClick={() => {
                                setSelectedPrescription(prescription)
                                setValidationError("")
                                onSelectionChange()
                            }}
                            className={`group w-full rounded-xl border p-5 text-left transition-all duration-200 ${selectedPrescription?.id === prescription.id
                                ? "border-blue-600 bg-blue-50"
                                : "border-slate-200 bg-white hover:border-blue-400"
                                }`
                            }
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-slate-900">
                                    {prescription.name}
                                </h3>

                                <span className="text-sm font-medium text-blue-600 opacity-0 transition group-hover:opacity-100">
                                    Select →
                                </span>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">
                                        Right eye (OD)
                                    </p>

                                    <p className="mt-1.5 text-sm text-slate-500">
                                        SPH: <span className="font-medium text-slate-700">{prescription.rightSph ?? "—"}</span>
                                        {" · "}
                                        CYL: <span className="font-medium text-slate-700">{prescription.rightCyl ?? "—"}</span>
                                        {" · "}
                                        Axis: <span className="font-medium text-slate-700">{prescription.rightAxis ?? "—"}</span>
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-slate-800">
                                        Left eye (OS)
                                    </p>

                                    <p className="mt-1.5 text-sm text-slate-500">
                                        SPH: <span className="font-medium text-slate-700">{prescription.leftSph ?? "—"}</span>
                                        {" · "}
                                        CYL: <span className="font-medium text-slate-700">{prescription.leftCyl ?? "—"}</span>
                                        {" · "}
                                        Axis: <span className="font-medium text-slate-700">{prescription.leftAxis ?? "—"}</span>
                                    </p>
                                </div>
                            </div>

                            <p className="mt-4 text-sm text-slate-500">
                                PD: <span className="font-semibold text-slate-800">{prescription.pd ?? "—"} mm</span>
                            </p>

                            {prescription.fileUrl && (
                                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-sm font-semibold text-slate-800">
                                        Attached prescription
                                    </p>

                                    <a
                                        href={prescription.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(event) => event.stopPropagation}
                                        className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                                    >
                                        View {prescription.fileName || "prescription file"}
                                        <span aria-hidden="true">↗</span>
                                    </a>
                                </div>
                            )}

                            <p className="mt-4 text-sm font-semibold text-blue-600 transition group-hover:text-blue-700">
                                Use this prescription →
                            </p>
                        </button>
                    ))}
                </div>

                {!loading && prescriptions.length > 0 && (
                    <button
                        type="button"
                        onClick={onUseManual}
                        className="mt-6 text-sm font-medium text-slate-700 underline"
                    >
                        Enter a different prescription manually
                    </button>
                )}

                {validationError && (
                    <p role="alert" className="mt-4 text-sm font-medium text-red-600">
                        {validationError}
                    </p>
                )}
                {errors.length > 0 && (
                    <ul role="alert" className="mt-4 space-y-1 text-sm font-medium text-red-600">
                        {errors.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                )}
            </div>

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
                    onClick={onHandleContinue}
                    className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                >
                    Continue
                </button>
            </div>
        </section>
    );
}