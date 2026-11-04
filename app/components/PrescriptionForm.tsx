import { useState } from "react";

type PrescriptionFormProps = {
    lensIndexName: string;
    refractiveIndex: number | null;
    proxyPathPrefix: string | null;
    onBack: () => void;
    onContinue: (prescription: PrescriptionData, prescriptionImage?: File) => void;
    initialValues?: PrescriptionData;
    errors?: string[];
    requirePrescriptionImage?: boolean;
};

export type PrescriptionData = {
    rightSph: string;
    rightCyl: string;
    rightAxis: string;
    leftSph: string;
    leftCyl: string;
    leftAxis: string;
    pd: string;
};


export default function PrescriptionForm(
    {
        lensIndexName,
        refractiveIndex,
        proxyPathPrefix,
        onBack,
        onContinue,
        initialValues,
        errors,
        requirePrescriptionImage = false,
    }: PrescriptionFormProps
) {
    const [prescription, setPrescription] = useState<PrescriptionData>(
        initialValues ?? {
            rightSph: "",
            rightCyl: "",
            rightAxis: "",
            leftSph: "",
            leftCyl: "",
            leftAxis: "",
            pd: "",
        },
    );

    const [prescriptionImage, setPrescriptionImage] = useState<File | null>(null);
    const [imageError, setImageError] = useState("");

    const [saveError, setSaveError] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    const updateField = (field: keyof PrescriptionData, value: string) => {
        setPrescription((current) => ({
            ...current,
            [field]: value
        }))
    }

    const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

    const handleContinue = async () => {
        if (requirePrescriptionImage && !prescriptionImage) {
            setImageError("Prescription image is required.");
            return;
        }

        setIsSaving(true)
        setSaveError("")

        try {
            if (!proxyPathPrefix?.startsWith("/") || proxyPathPrefix.startsWith("//")) {
                throw new Error("Prescription saving is only available through the Shopify app proxy.");
            }

            const endpoint = new URL(`${proxyPathPrefix}/lens-saved-prescriptions`, window.location.origin,);

            const formData = new FormData();

            formData.append("name", "My Prescription")

            Object.entries(prescription).forEach(([Key, value]) => {
                formData.append(Key, value)
            })

            if (prescriptionImage) {
                formData.append("prescriptionImage", prescriptionImage)
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                },
                body: formData
            });

            const result: unknown = await response.json().catch(() => null);

            const errorMessage =
                typeof result === "object" &&
                    result !== null &&
                    "error" in result &&
                    typeof result.error === "string"
                    ? result.error
                    : `Unable to save prescription (HTTP ${response.status}).`;

            if (!response.ok) {
                throw new Error(errorMessage);
            }

            onContinue(prescription, prescriptionImage ?? undefined);
        } catch (error) {
            setSaveError(
                error instanceof Error ? error.message : "Unable to save prescription.",
            );
        }
        finally {
            setIsSaving(false)
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
                        Enter Your Prescription
                    </h1>

                    <p className="mt-3 text-slate-600">
                        Enter the prescription values provided by your optician.
                    </p>
                </div>

                <div className="mb-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                    Selected lens: <strong>{lensIndexName}</strong> (
                    {refractiveIndex?.toFixed(2)})
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[680px] table-fixed text-left">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="w-36 p-4 text-sm font-semibold">Eye</th>
                                <th className="w-44 p-4 text-sm font-semibold">SPH</th>
                                <th className="w-44 p-4 text-sm font-semibold">CYL</th>
                                <th className="w-44 p-4 text-sm font-semibold">Axis</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr className="border-t">
                                <th className="p-4 text-sm font-medium">Right (OD)</th>
                                <td className="p-2">
                                    <input
                                        aria-label="Right eye SPH"
                                        className={inputClass}
                                        type="number"
                                        step="0.25"
                                        value={prescription.rightSph}
                                        placeholder="-2.00"
                                        min='-15'
                                        max='10'
                                        onChange={(event) => updateField("rightSph", event.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <input
                                        aria-label="Right eye CYL"
                                        className={inputClass}
                                        type="number"
                                        step="0.25"
                                        value={prescription.rightCyl}
                                        placeholder="-0.50"
                                        min='-6'
                                        max='6'
                                        onChange={(event) => updateField("rightCyl", event.target.value)}

                                    />
                                </td>
                                <td className="p-2">
                                    <input
                                        aria-label="Right eye Axis"
                                        className={inputClass}
                                        type="number"
                                        min="1"
                                        max="180"
                                        value={prescription.rightAxis}
                                        placeholder="90"
                                        onChange={(event) => updateField("rightAxis", event.target.value)}
                                    />
                                </td>
                            </tr>

                            <tr className="border-t">
                                <th className="p-4 text-sm font-medium">Left (OD)</th>
                                <td className="p-2">
                                    <input
                                        aria-label="Left eye SPH"
                                        className={inputClass}
                                        type="number"
                                        step="0.25"
                                        value={prescription.leftSph}
                                        placeholder="-1.50"
                                        min='-15'
                                        max='10'
                                        onChange={(event) => updateField("leftSph", event.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <input
                                        aria-label="Left eye CYL"
                                        className={inputClass}
                                        type="number"
                                        step="0.25"
                                        value={prescription.leftCyl}
                                        placeholder="-0.25"
                                        min='-6'
                                        max='6'
                                        onChange={(event) => updateField("leftCyl", event.target.value)}
                                    />
                                </td>
                                <td className="p-2">
                                    <input
                                        aria-label="Left eye Axis"
                                        className={inputClass}
                                        type="number"
                                        min="1"
                                        max="180"
                                        value={prescription.leftAxis}
                                        placeholder="90"
                                        onChange={(event) => updateField("leftAxis", event.target.value)}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 max-w-sm">
                    <label
                        htmlFor="prescription-pd"
                        className="mb-2 block text-sm font-semibold text-slate-900"
                    >
                        Pupillary Distance (PD), mm
                    </label>

                    <input
                        type="number"
                        className={inputClass}
                        id="prescription-pd"
                        min='50'
                        max='78'
                        step='0.5'
                        value={prescription.pd}
                        onChange={(event) => updateField("pd", event.target.value)}
                        placeholder="e.g. 63"
                    />
                </div>

                {requirePrescriptionImage && (
                    <div className="mt-6 max-w-xl">
                        <label
                            htmlFor="prescription-image"
                            className="mb-2 block text-sm font-semibold text-slate-900"
                        >
                            Prescription Image
                            <span className="ml-1 text-red-600">*</span>
                        </label>

                        <p className="mb-3 text-sm text-slate-600">
                            Must send a picture of prescription.
                            Upload a clear image of your prescription.
                        </p>

                        <input
                            id="prescription-image"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            required
                            onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;

                                setPrescriptionImage(file);
                                setImageError("");
                            }}
                            className={inputClass}
                        />

                        {prescriptionImage && (
                            <p className="mt-2 text-sm text-slate-700">
                                Selected file: {prescriptionImage.name}
                            </p>
                        )}

                        {imageError && (
                            <p className="mt-2 text-sm text-red-600">
                                {imageError}
                            </p>
                        )}
                    </div>
                )}

                {errors && errors.length > 0 && (
                    <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                        <ul className="list-disc space-y-1 pl-5">
                            {errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {saveError && (
                    <p className="mt-3 text-sm text-red-600" role="alert">
                        {saveError}
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
                        onClick={handleContinue}
                        disabled={isSaving}
                        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
                    >
                        {isSaving ? "Saving..." : "Continue"}
                    </button>
                </div>

            </div>
        </section>
    )
}
