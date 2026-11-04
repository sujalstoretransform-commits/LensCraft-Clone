import {
  ClipboardPenLine,
  FileUp,
  History,
  Clock,
} from "lucide-react";

export type PrescriptionMethodCode = "manual" | "upload" | "saved" | "later";

export type PrescriptionMethodOption = {
  code: PrescriptionMethodCode;
  name: string;
  description: string | null;
};

type PrescriptionSelectionProps = {
  selectedMethod: PrescriptionMethodCode | null;
  methods: PrescriptionMethodOption[];
  onBack: () => void;
  onSelectMethod: (method: PrescriptionMethodCode) => void;
  onContinue: (method: PrescriptionMethodCode) => void;
};

const prescriptionMethodIcons = {
  manual: ClipboardPenLine,
  upload: FileUp,
  saved: History,
  later: Clock,
} satisfies Record<PrescriptionMethodCode, typeof ClipboardPenLine>;



export default function PrescriptionSelection({
  selectedMethod,
  methods,
  onBack,
  onSelectMethod,
  onContinue,
}: PrescriptionSelectionProps) {

  return (
    <section className="w-full px-5 py-8 md:px-12 md:py-12">
      <div className="w-full">
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-blue-600">
            Prescription
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            How would you like to provide your prescription?
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500 md:text-base">
            Choose how you want to share your prescription with us.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {methods.map((method) => {
            const Icon = prescriptionMethodIcons[method.code];
            const isSelected = selectedMethod === method.code;

            return (
              <button
                key={method.code}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectMethod(method.code)}
                className={`group flex w-full items-start gap-4 rounded-xl border p-5 text-left transition ${isSelected
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
                  }`}
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${isSelected
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"
                    }`}
                >
                  <Icon size={23} strokeWidth={1.8} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">
                    {method.name}
                  </span>

                  {method.description && (
                    <span className="mt-1 block text-sm leading-6 text-slate-500">
                      {method.description}
                    </span>
                  )}
                </span>

                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isSelected
                    ? "border-blue-600 bg-blue-600"
                    : "border-slate-300"
                    }`}
                >
                  {isSelected && (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  )}
                </span>
              </button>
            )
          })}
        </div>
        {methods.length === 0 && (
          <p className="rounded-lg border border-slate-200 p-5 text-sm text-slate-500">
            No prescription methods are currently available.
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
            disabled={!selectedMethod}
            onClick={() => {
              if (selectedMethod) {
                onContinue(selectedMethod);
              }
            }}
            className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Continue
          </button>
        </div>
      </div>
    </section>
  );
}