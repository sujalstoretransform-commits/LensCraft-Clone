const DETAIL_ATTRIBUTES = {
  lens: "Lens",
  lensType: "Lens Type",
  lensOption: "Lens Option",
  lensIndex: "Lens Index",
  refractiveIndex: "Refractive Index",
  rightSph: "Right SPH",
  rightCyl: "Right CYL",
  rightAxis: "Right Axis",
  leftSph: "Left SPH",
  leftCyl: "Left CYL",
  leftAxis: "Left Axis",
  selectedCoating: "Selected Coating",
  selectedTechnology: "Selected Technology",
  selectedTechnologyColor: "Selected Technology Color",
  lensPriceBreakdown: "Lens price breakdown",
  prescriptionImage: "Prescription Image",
  pd: "PD",
};

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

    const attributes = Object.entries(DETAIL_ATTRIBUTES)
      .map(([alias, key]) => {
        const value = parentLine[alias]?.value;
        return value != null ? { key, value } : null;
      })
      .filter((attribute) => attribute !== null);

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
