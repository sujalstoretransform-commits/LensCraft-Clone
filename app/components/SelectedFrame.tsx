type Props = {
  variantTitle: string | null;
  image: string | null;
};

export default function SelectedFrame({ variantTitle, image }: Props) {
  return (
    <section className="relative isolate w-full overflow-hidden bg-linear-to-br from-slate-50 via-white to-blue-50">
      <div className="pointer-events-none absolute -top-24 -right-24 -z-10 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 -z-10 h-64 w-64 rounded-full bg-indigo-200/30 blur-3xl" />

      <div className="flex w-full flex-col-reverse items-center gap-8 px-6 py-8 md:flex-row md:justify-between md:px-16 md:py-12 lg:px-24">
        <div className="w-full md:max-w-lg">
          <span className="inline-flex rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-600">
            CUSTOM LENSES. BETTER VISION.
          </span>

          <h1 className="mt-4 text-3xl leading-[1.12] font-bold tracking-tight text-slate-900 md:text-4xl">
            Find the perfect lenses
            <br />
            for your frames
          </h1>

          <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
            Choose your lens type, index, and add-ons to create the perfect
            pair of lenses for your needs.
          </p>

          {variantTitle && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-slate-500">Selected frame</span>
              <span className="font-semibold text-slate-900">
                {variantTitle}
              </span>
            </div>
          )}
        </div>

        {image && (
          <div className="relative w-full md:w-[45%] md:max-w-xl">
            <div className="absolute inset-0 -z-10 translate-x-3 translate-y-3 rounded-3xl bg-blue-100/70" />
            <div className="aspect-[16/10] w-full overflow-hidden rounded-3xl bg-[#f8f8f8] shadow-xl shadow-slate-900/10 ring-1 ring-slate-200">
              <img
                src={image}
                alt={
                  variantTitle
                    ? `Selected frame: ${variantTitle}`
                    : "Selected frame"
                }
                className="h-full w-full scale-[0.92] object-cover object-center"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}