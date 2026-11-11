const DETAIL_ATTRIBUTES = [
  "lens",
  "lensType",
  "lensOption",
  "lensIndex",
  "refractiveIndex",
  "rightSph",
  "rightCyl",
  "rightAxis",
  "leftSph",
  "leftCyl",
  "leftAxis",
  "selectedCoating",
  "selectedTechnology",
  "selectedTechnologyColor",
  "lensPriceBreakdown",
  "prescriptionImage",
  "pd",
];

export function cartTransformRun(input) {
  const groups = new Map();

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;
    const groupId = line.lensGroup?.value;
    if (!groupId) continue;

    const group = groups.get(groupId) ?? [];
    group.push(line);
    groups.set(groupId, group);
  }

  const operations = [];

  for (const lines of groups.values()) {
    const parentLine = lines.find((line) => line.lensParent?.value === "true");
    if (!parentLine || lines.length < 2) continue;

    const quantity = Math.min(...lines.map((line) => line.quantity));
    if (quantity < 1) continue;

    const attributes = DETAIL_ATTRIBUTES.map((key) => parentLine[key])
      .filter((attribute) => attribute?.value != null)
      .map(({ key, value }) => ({ key, value }));

    operations.push({
      linesMerge: {
        cartLines: lines.map((line) => ({
          cartLineId: line.id,
          quantity,
        })),
        parentVariantId: parentLine.merchandise.id,
        attributes,
      },
    });
  }

  return { operations };
}
