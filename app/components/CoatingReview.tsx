import { Check, ShieldCheck } from "lucide-react";
import { useState } from "react";

export type CoatingSelection = string[];

type LensOption = {
    code: string;
    name: string;
    description: string | null;
    category: "add_on";
    prices: {
        code: string;
        kind: string;
        amountMinor: number;
        currencyCode: string;
    }[];
    rules: {
        code: string;
        kind: string;
        message: string;
    }[];
};

type CoatingReviewProps = {
    lensOptions: LensOption[];
    lensOptionCode: string;
    initialSelection?: CoatingSelection;
    selectedTechnologyCode: string;
    onBack: () => void;
    onContinue: (selection: CoatingSelection) => void;
};

const includedCoatings = [
    "Anti-reflective (anti-glare)",
    "Scratch-resistant hard coat",
    "100% UV400 protection",
    "Water- and smudge-repellent easy-clean coating",
];

export default function CoatingReview({
    lensOptions,
    lensOptionCode,
    initialSelection,
    selectedTechnologyCode,
    onBack,
    onContinue,
}: CoatingReviewProps) {
    const [selection, setSelection] = useState<CoatingSelection>(
        initialSelection ?? [],
    );

    const toggleOption = (code: string) => {
        setSelection((current) =>
            current.includes(code)
                ? current.filter((selectedCode) => selectedCode !== code)
                : [...current, code],
        );
    };

    const showBlueLightCoating =
        lensOptionCode === "clear" ||
        (lensOptionCode === "light_adaptive" &&
            selectedTechnologyCode !== "standard_light_adaptive_blue_light" &&
            selectedTechnologyCode !== "in_car_light_adaptive_blue_light"
        );

    const visibleOptions = lensOptions.filter((option) => {
        if (option.code === "blue_light_coating") {
            return showBlueLightCoating;
        }

        return true;
    });

    function getOptionPrice(option: LensOption) {
        const price = option.prices.find(
            (item) => item.kind === "add_on",
        );

        if (!price) {
            return null;
        }

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: price.currencyCode,
        }).format(price.amountMinor / 100);
    }

    return (
        <section className="w-full bg-white px-5 py-8 md:px-12">
            <div className="w-full">
                <div className="mb-8">
                    <p className="mb-2 text-sm font-semibold text-blue-600">
                        LENS CONFIGURATION
                    </p>

                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                        Coating &amp; Review
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
                        Every pair includes essential protective coatings.
                        Choose any optional add-ons you need.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 p-5 sm:p-6">
                        <div className="mb-5 flex items-center gap-3">
                            <span className="flex size-11 items-center justify-center rounded-lg bg-green-50 text-green-700">
                                <ShieldCheck size={24} />
                            </span>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Included with every pair
                                </h3>

                                <p className="mt-1 text-sm text-slate-500">
                                    No additional selection required
                                </p>
                            </div>
                        </div>

                        <ul className="space-y-4">
                            {includedCoatings.map((coating) => (
                                <li
                                    key={coating}
                                    className="flex items-start gap-3"
                                >
                                    <Check
                                        size={18}
                                        className="mt-0.5 shrink-0 text-green-600"
                                        aria-hidden="true"
                                    />

                                    <span className="text-sm leading-6 text-slate-700">
                                        {coating}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-5 sm:p-6">
                        <h3 className="font-semibold text-slate-900">
                            Optional add-ons
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Select any additional coatings you want.
                        </p>

                        <div className="mt-5 space-y-4">
                            {visibleOptions.map((option) => {
                                const isSelected = selection.includes(option.code);

                                const price = getOptionPrice(option);

                                return (
                                    <label
                                        key={option.code}
                                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${isSelected
                                            ? "border-blue-500 bg-blue-50/50"
                                            : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() =>
                                                toggleOption(option.code)
                                            }
                                            className="mt-1 size-4 accent-blue-600"
                                        />

                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="font-medium text-slate-800">
                                                    {option.name}
                                                </span>

                                                <span className="text-sm font-semibold text-blue-600">
                                                    {price ?? "Price unavailable"}
                                                </span>
                                            </span>

                                            {option.description && (
                                                <span className="mt-1 block text-sm leading-5 text-slate-500">
                                                    {option.description}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}

                            {visibleOptions.length === 0 && (
                                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                                    No optional coatings are available.
                                </p>
                            )}
                        </div>
                    </div>
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
                        onClick={() => onContinue(selection)}
                        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </section>
    );
}