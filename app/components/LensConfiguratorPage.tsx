import { useState, useEffect } from "react";
import type { LensConfiguratorPageData } from "app/services/lens-configurator-page.server";
import LensTypeSelector from "./LensTypeSelector";
import TrustBenefits from "./TrustBenefits";
import PrescriptionForm, { type PrescriptionData } from "./PrescriptionForm";
import LensTypeConfigurator from "./LensTypeConfigurator";
import SelectedFrame from "./SelectedFrame";
import SingleVisionConfigurator from "./SingleVisionConfigurator";
import ConfigurationReview from "./ConfigurationReview";
import { validatePrescription, type Prescription, } from "app/services/prescription";
import {
  calculatePrice,
  PriceError,
} from "app/services/lens-pricing";
import PrescriptionSelection, { type PrescriptionMethodCode } from "./PrescriptionSelection";
import CoatingReview, { type CoatingSelection } from "./CoatingReview";
import LensTechnologySelector from "./LensTechnologySelector";
import SavedPrescriptionSelector from "./SavedPrescriptionSelector";
import PrescriptionUpload from "./PrescriptionUpload";

type PriceResult = {
  items: {
    code: string;
    label: string;
    amountMinor: number;
  }[];
  frameMinor: number;
  lensTotalMinor: number;
  totalMinor: number;
};

export default function LensConfiguratorPage({
  data,
}: {
  data: LensConfiguratorPageData;
}) {
  const {
    currencyCode,
    framePriceMinor,
    product,
    catalog,
    lensIndices,
    pricingAvailable,
    catalogAvailable,
    checkoutPricingReady,
    lensVariantIdByCode,
    proxyPathPrefix,
  } = data;

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>(1);

  // Keep storefront URL completely clean in browser address bar
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search) {
      const url = new URL(window.location.href);
      let changed = false;
      for (const param of ["productId", "variantId", "currency"]) {
        if (url.searchParams.has(param)) {
          url.searchParams.delete(param);
          changed = true;
        }
      }
      if (changed) {
        const cleanUrl = url.pathname + (url.search ? url.search : "");
        window.history.replaceState({}, "", cleanUrl);
      }
    }
  }, []);
  const [prescriptionValues, setPrescriptionValues] = useState<PrescriptionData | undefined>();
  const [prescriptionImage, setPrescriptionImage] = useState<File | null>(null);
  const [prescriptionImageName, setPrescriptionImageName] = useState<string | null>(null);
  const [prescriptionErrors, setPrescriptionErrors] = useState<string[]>([]);
  const [selectedVisionTypeCode, setSelectedVisionTypeCode] = useState("single_vision_distance",);
  const [selectedMethod, setSelectedMethod] = useState<PrescriptionMethodCode | null>("manual");
  const [selectedLensIndexCode, setSelectedLensIndexCode] = useState("");
  const [selectedLensIndex, setSelectedLensIndex] = useState<{
    code: string;
    displayName: string;
    refractiveIndex: number;
  } | null>(null);
  const [selectedLensOptionCode, setSelectedLensOptionCode] = useState("clear");
  const [priceResult, setPriceResult] = useState<PriceResult | null>(null);
  const [priceError, setPriceError] = useState("");
  const [priceUnavailable, setPriceUnavailable] = useState(!pricingAvailable);
  const [prescriptionMethod, setPrescriptionMethod] = useState<PrescriptionMethodCode | null>(null);
  const [coatingSelection, setCoatingSelection] = useState<CoatingSelection>([]);

  const [selectedCoatings, setSelectedCoatings] = useState<string[]>([]);

  const [selectedTechnologyCode, setSelectedTechnologyCode] = useState("");
  const [selectedTechnologyColor, setSelectedTechnologyColor] = useState<"GREY" | "AMBER">("GREY");

  const selectedTechnologyName = catalog.lensTechnology.find((technology) => technology.code === selectedTechnologyCode)?.name

  const [prescriptionStep, setPrescriptionStep] = useState<"saved" | "review" | null>(null);

  const usesLensTechnology = [
    "light_adaptive",
    "sunglasses_tinted",
    "sunglasses_polarized",
  ].includes(selectedLensOptionCode);

  const compatibleIndexCodes =
    usesLensTechnology && selectedTechnologyCode
      ? catalog.lensTechnologyIndexCompatibility
        .filter(
          (compatibility) =>
            compatibility.lensTechnology?.code === selectedTechnologyCode &&
            compatibility.lensType?.code === selectedVisionTypeCode &&
            compatibility.lensOption?.code === selectedLensOptionCode
        )
        .map((compatibility) => compatibility.lensIndex.code)
      : catalog.lensIndexCompatibilities
        .filter(
          (compatibility) =>
            compatibility.lensType?.code === selectedVisionTypeCode &&
            compatibility.lensOption?.code === selectedLensOptionCode,
        )
        .map((compatibility) => compatibility.lensIndex.code);

  const handlePrescriptionContinue = (
    values: PrescriptionData,
    image?: File,
    fileUrl?: string,
    fileName?: string,
  ) => {
    const toNumber = (value: string) => value.trim() === "" ? undefined : Number(value);

    const prescription: Prescription = {
      right: {
        sph: toNumber(values.rightSph),
        cyl: toNumber(values.rightCyl),
        axis: toNumber(values.rightAxis),
      },
      left: {
        sph: toNumber(values.leftSph),
        cyl: toNumber(values.leftCyl),
        axis: toNumber(values.leftAxis),
      },
      pd: { single: toNumber(values.pd) },
    };

    const result = validatePrescription(prescription);
    if (!result.valid) {
      setPrescriptionErrors(result.errors);
      return;
    }

    if (selectedVisionTypeCode === "progressive" && !image && !fileUrl) {
      setPrescriptionErrors(["Prescription image is required for progressive lenses."]);
      return;
    }

    setPrescriptionValues(values);
    setPrescriptionImage(image ?? null);
    setPrescriptionImageName(image?.name ?? fileName ?? null);
    setPrescriptionErrors([]);
    setStep(4);
  };

  const handleUploadContinue = (file: File, fileName: string) => {
    setPrescriptionImage(file);
    setPrescriptionImageName(fileName);
    setPrescriptionValues(undefined);
    setSelectedLensIndex(null);
    setPriceResult(null);
    setPrescriptionErrors([]);
    setStep(8);
  };

  const selectedLensTypeName =
    catalog.lensTypes.find(
      (lensType) => lensType.code === selectedVisionTypeCode,
    )?.name ?? "Single Vision Distance";
  const selectedLensOptionName =
    catalog.lensOptions.find((option) => option.code === selectedLensOptionCode)
      ?.name ?? selectedLensOptionCode;

  const calculateSelectedPrice = (
    lensIndexCode: string,
    optionCodes: string[],
  ): boolean => {
    setPriceError("");
    if (!pricingAvailable) {
      setPriceResult(null);
      setPriceUnavailable(true);
      return true;
    }
    setPriceUnavailable(false);

    try {
      const pricing = calculatePrice(
        catalog,
        {
          lensTypeCode: selectedVisionTypeCode,
          lensIndexCode,
          optionCodes,
          lensTechnologyCode: selectedTechnologyCode || undefined,
        },
        framePriceMinor,
      );

      setPriceResult(pricing);
      setPriceError("");
      return true;
    } catch (error) {
      setPriceResult(null);
      setPriceError(
        error instanceof Error ? error.message : "Unable to calculate price.",
      );
      if (error instanceof PriceError) {
        setPriceUnavailable(true);
        return true;
      }
      return false;
    }
  };

  const lensTypesWithPrices = catalog.lensTypes.map((lensType) => {
    const basePrice = lensType.prices.find((price) => !price.lensIndex);

    return {
      ...lensType,
      startingPrice: basePrice?.amountMinor ?? null,
    };
  });

  return (
    <main className="w-full bg-white font-sans">
      <SelectedFrame
        variantTitle={product.variantTitle}
        image={product.image}
      />
      {(!catalogAvailable || !pricingAvailable) && (
        <p
          role="status"
          className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 md:px-12"
        >
          {!catalogAvailable
            ? "Lens options are temporarily unavailable. You can still view the configurator; please try again later."
            : "Lens prices are temporarily unavailable. You can still configure and review your selection, but checkout is disabled until pricing is available."}
        </p>
      )}

      <section className="border-b border-slate-200 px-5 py-5 md:px-12">
        <div className="w-full">
          <p className="text-sm font-semibold text-slate-500">
            STEP {step} OF 8
          </p>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((progressStep) => (
              <div
                key={progressStep}
                className={`h-1.5 flex-1 rounded-full ${step >= progressStep ? "bg-slate-900" : "bg-slate-200"
                  }`}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="w-full">
        {step === 1 && (
          <LensTypeSelector
            currencyCode={currencyCode}
            selectedLensTypeCode={selectedVisionTypeCode}
            lensTypes={lensTypesWithPrices}
            onSelectLensType={(lensType) => {
              if (lensType !== "single_vision_distance" && lensType !== "single_vision_reading" && lensType !== "progressive") return;
              setSelectedVisionTypeCode(lensType);
              setSelectedLensIndex(null);
              setSelectedLensIndexCode("")
              setPriceResult(null)
              setPriceError("")
              setPriceUnavailable(!pricingAvailable)
              setPrescriptionErrors([]);
            }}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <PrescriptionSelection
            selectedMethod={selectedMethod}
            methods={catalog.prescriptionMethods}
            onBack={() => setStep(1)}
            onSelectMethod={setSelectedMethod}
            onContinue={(method) => {
              setPrescriptionMethod(method)
              setSelectedMethod(method)

              if (method === "manual" || method === 'upload') {
                setPrescriptionStep(null)
                setStep(3);
              }
              else if (method === 'saved') {
                setPrescriptionStep("saved")
                setStep(3)
              }
              else {
                return
              }
            }}
          />
        )}

        {step === 3 && prescriptionMethod !== "manual" && prescriptionStep === "saved" && (
          <SavedPrescriptionSelector
            proxyPathPrefix={proxyPathPrefix}
            errors={prescriptionErrors}
            onSelectionChange={() => setPrescriptionErrors([])}
            onBack={() => {
              setPrescriptionStep(null)
              setPrescriptionErrors([]);
              setStep(2)
            }}
            onUseManual={() => {
              setPrescriptionStep(null)
              setPrescriptionMethod("manual")
            }}
            onContinue={handlePrescriptionContinue}
            requirePrescriptionImage={selectedVisionTypeCode === "progressive"}
          />
        )}

        {step === 3 && prescriptionMethod === 'manual' && (
          <PrescriptionForm
            lensIndexName={selectedLensTypeName}
            proxyPathPrefix={proxyPathPrefix}
            refractiveIndex={
              lensIndices.find((index) => index.code === selectedLensIndexCode)
                ?.refractiveIndex ?? null
            }
            initialValues={prescriptionValues}
            errors={prescriptionErrors}
            onBack={() => {
              setPrescriptionErrors([]);
              setStep(2);
            }}
            onContinue={handlePrescriptionContinue}
            requirePrescriptionImage={selectedVisionTypeCode === "progressive"}
          />
        )}

        {step === 3 && prescriptionMethod === 'upload' && (
          <PrescriptionUpload
            proxyPathPrefix={proxyPathPrefix}
            onBack={() => {
              setPrescriptionErrors([])
              setStep(2)
            }}
            onContinue={handleUploadContinue}
          />
        )}

        {step === 4 && (
          <LensTypeConfigurator
            currencyCode={currencyCode}
            lensOptions={catalog.lensOptions.filter(
              (option): option is typeof option & { category: "lens_type" } => option.category === "lens_type",
            )}
            onBack={() => setStep(3)}
            onContinue={(lensOptionCode) => {
              setSelectedLensOptionCode(lensOptionCode);
              setSelectedLensIndex(null);

              const defaultIndex = lensIndices.find((index) => compatibleIndexCodes.includes(index.code) && Number(index.refractiveIndex) === 1.56)

              setSelectedLensIndexCode(defaultIndex?.code ?? "");

              if (lensOptionCode === 'light_adaptive' || lensOptionCode === 'sunglasses_tinted' || lensOptionCode === 'sunglasses_polarized') {
                setStep(5)
              }
              else {
                setSelectedTechnologyCode("")
                setSelectedTechnologyColor("GREY")
                setStep(6)
              }
            }}
            initialValue={selectedLensOptionCode}
          />
        )}

        {step === 5 && ["light_adaptive", "sunglasses_tinted", "sunglasses_polarized"].includes(selectedLensOptionCode) && (
          <LensTechnologySelector
            currencyCode={currencyCode}
            technologies={
              catalog.lensOptions
                .find((option) => option.code === selectedLensOptionCode)
                ?.lensTechnologyOptions
                .filter(
                  (mapping) =>
                    mapping.lensType.code === selectedVisionTypeCode,
                )
                .map(
                  (mapping) => mapping.lensTechnology
                ) ?? []
            }
            selectedTechnologyCode={selectedTechnologyCode}
            selectedColor={selectedTechnologyColor}
            onSelectTechnology={setSelectedTechnologyCode}
            onSelectColor={setSelectedTechnologyColor}
            onBack={() => setStep(4)}
            onContinue={() => setStep(6)}
          />
        )}

        {(step === 5 || step === 7) && priceError && (
          <p role="alert" className="px-5 text-sm text-red-600 md:px-12">
            {priceError}
          </p>
        )}

        {step === 6 && (
          <SingleVisionConfigurator
            currencyCode={currencyCode}
            lensIndices={lensIndices}
            compatibleIndexCodes={compatibleIndexCodes}
            lensTypeCode={selectedVisionTypeCode}
            lensOptionCode={selectedLensOptionCode}
            onBack={() => {
              if (selectedLensOptionCode === 'light_adaptive' || selectedLensOptionCode === 'sunglasses_tinted' || selectedLensOptionCode === 'sunglasses_polarized') {
                setStep(5)
              }
              else {
                setStep(4)
              }
            }}
            onContinue={(index) => {
              setSelectedLensIndex(index);
              setSelectedLensIndexCode(index.code);
              setStep(7)
            }}
            selectedIndexCode={selectedLensIndexCode}
            onSelectIndex={setSelectedLensIndexCode}
          />
        )}

        {step === 7 && selectedLensIndex && (
          <CoatingReview
            lensOptions={catalog.lensOptions.filter(
              (option): option is typeof option & { category: "add_on" } => option.category === "add_on",
            )}
            lensOptionCode={selectedLensOptionCode}
            initialSelection={coatingSelection}
            selectedTechnologyCode={selectedTechnologyCode}
            onBack={() => setStep(6)}
            onContinue={(selection) => {
              setCoatingSelection(selection)

              const optionCodes = [selectedLensOptionCode, ...selection];

              const coatingNames = catalog.lensOptions
                .filter(
                  (option) =>
                    option.category === 'add_on' &&
                    selection.includes(option.code)
                )
                .map((option) => option.name)

              setSelectedCoatings(coatingNames)

              const priceAvailable = calculateSelectedPrice(
                selectedLensIndex.code,
                optionCodes,
              );
              if (priceAvailable) setStep(8);
            }}
          />
        )}

        {step === 8 && (prescriptionMethod === "upload" || (selectedLensIndex && prescriptionValues)) && (
          <ConfigurationReview
            lensTypeName={selectedLensTypeName}
            lensOptionName={selectedLensOptionName}
            lensIndexName={selectedLensIndex?.displayName ?? ""}
            refractiveIndex={selectedLensIndex?.refractiveIndex ?? 0}
            prescription={prescriptionValues}
            isUploadOnly={prescriptionMethod === "upload"}
            framePriceMinor={framePriceMinor}
            lensVariantIdByCode={lensVariantIdByCode}
            lensTotalMinor={prescriptionMethod === "upload" ? 0 : priceResult?.lensTotalMinor ?? 0}
            totalPriceMinor={prescriptionMethod === "upload" ? framePriceMinor : priceResult?.totalMinor ?? framePriceMinor}
            pricingUnavailable={priceUnavailable}
            checkoutPricingReady={
              pricingAvailable &&
              (prescriptionMethod === "upload" || checkoutPricingReady)
            }
            currencyCode={currencyCode}
            variantId={product.variantId}
            onBack={() => setStep(prescriptionMethod === "upload" ? 3 : 7)}
            priceItems={prescriptionMethod === "upload" ? [] : priceResult?.items ?? []}
            selectedCoatings={prescriptionMethod === "upload" ? [] : selectedCoatings}
            selectedTechnologyName={prescriptionMethod === "upload" ? "" : selectedTechnologyName ?? ""}
            selectedTechnologyColor={selectedTechnologyColor}
            prescriptionImage={prescriptionImage}
            prescriptionImageName={prescriptionImageName}
          />
        )}
      </div>
      <TrustBenefits />
    </main>
  );
}
