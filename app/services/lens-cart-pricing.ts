export type LensCartPriceItem = {
  code: string;
  label: string;
  amountMinor: number;
};

export type MappedLensCartPriceItem = {
  item: LensCartPriceItem;
  variantId: string;
};

export function mapLensCartPriceItems(
  priceItems: LensCartPriceItem[],
  lensVariantId: string | undefined,
  lensTotalMinor: number,
): MappedLensCartPriceItem[] {
  if (!Number.isSafeInteger(lensTotalMinor) || lensTotalMinor < 0) {
    throw new RangeError("Lens total must be a non-negative minor-unit amount.");
  }

  if (
    priceItems.some(
      (item) => !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0,
    )
  ) {
    throw new RangeError("Lens price components must be non-negative minor units.");
  }

  const calculatedTotal = priceItems.reduce(
    (sum, item) => sum + item.amountMinor,
    0,
  );
  if (calculatedTotal !== lensTotalMinor) {
    throw new Error("Lens price components do not match the lens total.");
  }

  if (lensTotalMinor === 0) return [];
  if (!lensVariantId) {
    throw new Error("No lens-upgrade variant matches the lens total.");
  }

  return [
    {
      item: {
        code: "lens-upgrade-total",
        label: "Lens upgrade",
        amountMinor: lensTotalMinor,
      },
      variantId: lensVariantId,
    },
  ];
}
