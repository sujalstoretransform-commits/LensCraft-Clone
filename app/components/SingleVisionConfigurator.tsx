type SingleVisionConfiguratorProps = {
    currencyCode: string;
    lensIndices: {
        code: string;
        displayName: string;
        refractiveIndex: number | string;
        supplierMappings: {
            lensType: {
                code: string;
            };
        }[];
        prices: {
            code: string;
            kind: string;
            amountMinor: number;
            lensType?: {
                code: string;
            } | null;
        }[];
    }[];
    compatibleIndexCodes: string[];
    lensTypeCode: string;
    lensOptionCode: string;
    onBack?: () => void;
    onContinue?: (selectedIndex: {
        code: string;
        displayName: string;
        refractiveIndex: number;
    }) => void;
    selectedIndexCode: string;
    onSelectIndex: (indexCode: string) => void;
}

export default function SingleVisionConfigurator({
    currencyCode,
    lensIndices,
    compatibleIndexCodes,
    lensTypeCode,
    lensOptionCode,
    onBack,
    onContinue,
    selectedIndexCode,
    onSelectIndex,
}: SingleVisionConfiguratorProps
) {
    const availableIndices = lensIndices.filter((index) => compatibleIndexCodes.includes(index.code))

    const selectedIndex = availableIndices.find((index) => index.code === selectedIndexCode)

    const formatPrice = (amountMinor: number) =>
        new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currencyCode,
        }).format(amountMinor / 100);

    return (
        <section className="w-full bg-white px-5 py-8 md:px-12">
            <div className="w-full">
                <div className="mb-8">
                    <p className="text-sm font-semibold text-blue-600">
                        LENS CONFIGURATION
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        Single Vision Lenses
                    </h1>

                    <p className="mt-3 text-slate-600">
                        Choose your lens index to get started.
                    </p>
                </div>

                {availableIndices.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-6">
                        <h2 className="font-semibold text-slate-900">
                            No lens indices available
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            No active index compatibility records were found for the selected
                            vision type ({lensTypeCode}) and lens option ({lensOptionCode}).
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {availableIndices.map((index) => {
                                const isSelected = selectedIndexCode === index.code;

                                const prices = index.prices.filter(
                                    (price) =>
                                        !price.lensType ||
                                        price.lensType.code === lensTypeCode,
                                );

                                return (
                                    <button
                                        key={index.code}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => onSelectIndex(index.code)}
                                        className={`relative rounded-xl border bg-white p-5 text-left transition ${isSelected
                                            ? "border-blue-600 ring-2 ring-blue-100"
                                            : "border-slate-200 hover:border-slate-400"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-2xl font-bold text-slate-900">
                                                {Number(index.refractiveIndex).toFixed(2)}
                                            </span>
                                            {isSelected && (
                                                <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                                                    ✓
                                                </span>
                                            )}
                                        </div>

                                        <h2 className="mt-2 font-semibold text-slate-900">
                                            {index.displayName}
                                        </h2>

                                        <p className="mt-2 text-sm text-slate-600">
                                            {Number(index.refractiveIndex) <= 1.5
                                                ? "Standard lens index."
                                                : Number(index.refractiveIndex) < 1.67
                                                    ? "Thinner lens option."
                                                    : "Higher-index option for thinner lenses."}
                                        </p>

                                        {prices.map((price) => (
                                            <p
                                                key={price.code}
                                                className="mt-5 text-sm font-semibold text-blue-600"
                                            >
                                                {price.kind === "upgrade" ? "Upgrade" : "Price"}:{" "}
                                                {formatPrice(price.amountMinor)}
                                            </p>
                                        ))}
                                    </button>
                                );
                            })}
                        </div>


                    </>
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
                    disabled={!selectedIndex}
                    onClick={() => {
                        if (!selectedIndex) return;

                        onContinue?.({
                            code: selectedIndex.code,
                            displayName: selectedIndex.displayName,
                            refractiveIndex: Number(selectedIndex.refractiveIndex)
                        })
                    }}
                    className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    Continue
                </button>
            </div>
        </section>
    )
}
