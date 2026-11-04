import singleVisionDistancePhoto from '../assets/single_vision_lens.png'
import bifocalPhoto from "../assets/bifocal_lens.png"
import progressivePhoto from '../assets/progressive_lens.png'
import singleVisionReadingPhoto from '../assets/single_vision_reading.png'
import readingPhoto from '../assets/reading_lens.png'
import nonPrescriptionPhoto from '../assets/non-prescription_lens.png'

type LensType = {
    code: string;
    name: string;
    description: string | null;
    startingPrice: number | null;
};

type LensTypeSelectorProps = {
    selectedLensTypeCode: string;
    lensTypes: LensType[];
    onSelectLensType: (lensTypeCode: string) => void;
    onContinue: () => void;
}

const lensImages: Record<string, string> = {
    single_vision_distance: singleVisionDistancePhoto,
    single_vision_reading: singleVisionReadingPhoto,
    bifocal: bifocalPhoto,
    progressive: progressivePhoto,
    reading_glasses: readingPhoto,
    non_prescription: nonPrescriptionPhoto
};

export default function LensTypeSelector({
    selectedLensTypeCode,
    lensTypes,
    onSelectLensType,
    onContinue,
}: LensTypeSelectorProps
) {
    return (
        <section className="w-full bg-white px-6 py-6 md:px-12">
            <div className="mb-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                    Select Lens Type
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                    Choose the type of lenses that best fits your vision needs.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {lensTypes.map((lens) => {
                    const isSelected = selectedLensTypeCode === lens.code;
                    const image = lensImages[lens.code]

                    return (
                        <button
                            key={lens.code}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                                onSelectLensType(lens.code)
                            }}
                            className={`relative flex min-h-48 flex-col items-start rounded-lg border p-5 text-left transition-colors ${isSelected
                                ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                                }`}
                        >
                            {isSelected && (
                                <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                                    ✓
                                </span>
                            )}

                            <span className="mb-3 flex size-14  items-center justify-center rounded-xl bg-blue-50 text-4xl font-light text-blue-300">
                                {image ? (
                                    <img
                                        src={image}
                                        alt=""
                                        className="size-full rounded-xl object-contain"
                                    />
                                ) : (
                                    <span className="text-xl font-semibold text-blue-400">
                                        {lens.name.charAt(0)}
                                    </span>
                                )}
                            </span>

                            <span className="text-sm font-bold text-slate-900">
                                {lens.name}
                            </span>

                            <span className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-500">
                                {lens.description}
                            </span>

                            <span className="mt-5 text-sm font-semibold text-blue-600">
                                {lens.startingPrice !== null
                                    ? `From ${new Intl.NumberFormat("en-US", {
                                        style: "currency",
                                        currency: "USD",
                                    }).format(lens.startingPrice / 100)}`
                                    : "Price unavailable"}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                <button
                    type="button"
                    onClick={onContinue}
                    disabled={!selectedLensTypeCode}
                    className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Continue
                </button>
            </div>
        </section>
    );
}
