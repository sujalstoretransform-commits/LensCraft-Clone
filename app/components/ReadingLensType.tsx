import { useState } from "react";

export interface ReadingLensTypeProps {
    lensIndexName: string;
    refractiveIndex: number | null;
    selectedPower: number | null;
    onBack: () => void;
    onContinue: (power: number) => void;
}

export default function ReadingLensType({
    lensIndexName,
    refractiveIndex,
    selectedPower,
    onBack,
    onContinue,
}: ReadingLensTypeProps
) {
    const [selected, setSelected] = useState<string>(
        selectedPower !== null ? selectedPower.toFixed(2) : "",
    );

    const numericValue = selected === "" ? null : Number(selected);

    const isValid =
        numericValue !== null &&
        Number.isFinite(numericValue) &&
        numericValue >= 0.75 &&
        numericValue <= 3.5 &&
        Number.isInteger(numericValue * 4);

    return (
        <section className="w-full bg-white px-5 py-8 md:px-12">
            <div className="w-full">
                <div className="mb-8">
                    <p className="text-sm font-semibold text-blue-600">
                        LENS CONFIGURATION
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        Enter Your Magnification
                    </h1>

                    <p className="mt-3 text-slate-600">
                        Enter the reading power for your glasses.
                    </p>
                </div>

                <div className="mb-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                    Selected lens: <strong>{lensIndexName}</strong> (
                    {refractiveIndex?.toFixed(2)})
                </div>

                <div className="max-w-md">
                    <label
                        htmlFor="reading-power"
                        className="mb-2 block text-sm font-semibold text-slate-900"
                    >
                        Reading Power (Magnification)
                    </label>

                    <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                            +
                        </span>

                        <input
                            id="reading-power"
                            type="number"
                            min="0.75"
                            max="3.5"
                            step="0.25"
                            value={selected}
                            onChange={(event) => setSelected(event.target.value)}
                            placeholder="e.g. 1.50"
                            className="w-full rounded-lg border border-slate-300 py-3 pl-9 pr-4 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                        />
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                        Enter a value between +0.75 and +3.50 in increments of 0.25.
                    </p>

                    {selected !== "" && !isValid && (
                        <p className="mt-2 text-sm text-red-600" role="alert">
                            Please enter a valid reading power between +0.75 and +3.50,
                            using increments of 0.25.
                        </p>
                    )}
                </div>

                <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={onBack}
                        className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        Back
                    </button>

                    <button
                        type="button"
                        disabled={!isValid}
                        onClick={() => {
                            if (isValid && numericValue !== null) {
                                onContinue(numericValue);
                            }
                        }}
                        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </section>
    );
}
