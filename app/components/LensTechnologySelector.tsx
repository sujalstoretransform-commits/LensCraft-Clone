export type LensTechnology = {
    id: string,
    code: string;
    name: string;
    description: string | null;
    sortOrder: number;
    lensPrices: {
        code: string;
        kind: string;
        amountMinor: number;
    }[];
};

export type LensTechnologyColor = "GREY" | "AMBER";

type LensTechnologySelectorProps = {
    technologies: LensTechnology[];
    selectedTechnologyCode: string;
    selectedColor: LensTechnologyColor;
    onSelectTechnology: (code: string) => void;
    onSelectColor: (color: LensTechnologyColor) => void;
    onBack: () => void;
    onContinue: () => void;
}

export default function LensTechnologySelector({
    technologies,
    selectedTechnologyCode,
    selectedColor,
    onSelectTechnology,
    onSelectColor,
    onBack,
    onContinue
}: LensTechnologySelectorProps
) {
    const selectedTechnology = technologies.find((technology) => technology.code === selectedTechnologyCode)

    const colors: {
        value: LensTechnologyColor;
        label: string;
        description?: string
        swatch: string
    }[] = [
            {
                value: "GREY",
                label: "Grey",
                description: "A neutral, everyday tint",
                swatch: "bg-slate-500",
            },
            {
                value: "AMBER",
                label: "Amber",
                description: "A warm amber tint",
                swatch: "bg-amber-500",
            },
        ];

    return (
        <section className="w-full bg-white px-5 py-8 md:px-12">
            <div className="w-full">
                <div className="mb-8">
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        Choose your lens technology
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                        Select the light-adaptive technology that best suits your needs.
                    </p>
                </div>

                {technologies.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                        <h2 className="font-medium text-amber-900">
                            No lens technologies available
                        </h2>
                        <p className="mt-1 text-sm text-amber-800">
                            Check that your lens technologies are seeded and active.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {technologies.map((technology) => {
                            const isSelected = selectedTechnologyCode === technology.code

                            return (
                                <button
                                    key={technology.id}
                                    type="button"
                                    onClick={() => onSelectTechnology(technology.code)}
                                    aria-pressed={isSelected}
                                    className={`relative rounded-xl border p-5 text-left transition-colors ${isSelected
                                        ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                                        : "border-slate-200 bg-white hover:border-slate-400"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span
                                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isSelected
                                                ? "border-blue-600 bg-blue-600 text-white"
                                                : "border-slate-300"
                                                }`}

                                            aria-hidden="true"
                                        >
                                            {isSelected && (
                                                <span className="text-xs">✓</span>
                                            )}
                                        </span>

                                        <div className="min-w-0">
                                            <h2 className="font-semibold text-slate-900">
                                                {technology.name}
                                            </h2>

                                            {technology.description && (
                                                <p className="mt-2 text-sm leading-6 text-slate-500">
                                                    {technology.description}
                                                </p>
                                            )}

                                            {technology.lensPrices?.length > 0 && (
                                                <p className="mt-5 text-sm font-semibold text-blue-600">
                                                    From ${(technology.lensPrices[0].amountMinor / 100).toFixed(2)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}

                {selectedTechnology && (
                    <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
                        <h2 className="font-semibold text-slate-900">
                            Choose your lens color
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Select the color you prefer for your light-adaptive lenses.
                        </p>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {colors.map((color) => {
                                const isSelected = selectedColor === color.value

                                return (
                                    <button
                                        key={color.value}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => onSelectColor(color.value)}
                                        className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${isSelected
                                            ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
                                            : "border-slate-200 hover:border-slate-400"
                                            }`}
                                    >
                                        <span
                                            className={`h-8 w-8 shrink-0 rounded-full ${color.swatch}`}
                                            aria-hidden="true"
                                        />

                                        <span>
                                            <span className="block text-sm font-semibold text-slate-900">
                                                {color.label}
                                            </span>
                                            <span className="mt-1 block text-xs text-slate-500">
                                                {color.description}
                                            </span>
                                        </span>

                                        {isSelected && (
                                            <span className="ml-auto text-sm font-semibold text-blue-600">
                                                ✓
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
                <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
                    <button
                        type="button"
                        onClick={onBack}
                        className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Back
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (!selectedTechnology) return;
                            onContinue()
                        }}
                        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </section>
    )
}
