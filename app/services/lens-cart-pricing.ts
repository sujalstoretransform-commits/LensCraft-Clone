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
  lensVariantIdByCode: Record<string, string>,
  lensTotalMinor: number,
): MappedLensCartPriceItem[] {
  if (!Number.isSafeInteger(lensTotalMinor) || lensTotalMinor < 0) {
    throw new RangeError("Lens total must be a non-negative minor-unit amount.");
  }

  const paidItems = priceItems.filter((item) => item.amountMinor > 0);
  if (
    priceItems.some(
      (item) => !Number.isSafeInteger(item.amountMinor) || item.amountMinor < 0,
    )
  ) {
    throw new RangeError("Lens price components must be non-negative minor units.");
  }

  const mappedItems: MappedLensCartPriceItem[] = [];
  for (const item of paidItems) {
    const variantId = lensVariantIdByCode[item.code];
    if (!variantId) {
      throw new Error("Lens price mapping is incomplete or inconsistent.");
    }
    mappedItems.push({ item, variantId });
  }
  const mappedTotal = mappedItems.reduce(
    (sum, { item }) => sum + item.amountMinor,
    0,
  );
  if (mappedTotal !== lensTotalMinor) {
    throw new Error("Lens price mapping is incomplete or inconsistent.");
  }

  return mappedItems;
}
