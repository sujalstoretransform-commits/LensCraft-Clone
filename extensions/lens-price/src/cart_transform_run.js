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
    const parentLines = lines.filter(
      (l) => l.lensParent?.value === "true"
    );
    if (parentLines.length === 0) continue;

    for (const parentLine of parentLines) {
      const childLines = lines.filter(
        (l) =>
          l.id !== parentLine.id &&
          l.lensParent?.value !== "true" &&
          l.lensGroup?.value === parentLine.lensGroup?.value
      );
      const groupLines = [parentLine, ...childLines];

      const parentQty = parentLine.quantity;

      let lensDetails = {};
      try {
        const raw = parentLine.lensDetails?.value;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            lensDetails = parsed;
          }
        }
      } catch (e) {
        console.error("Invalid lens details JSON:", e);
        continue;
      }

      const attributes = [
        ...Object.entries(lensDetails)
          .filter(([k, v]) => typeof k === "string" && typeof v === "string" && v.length > 0)
          .map(([k, v]) => ({ key: k, value: v })),
        { key: "_lens_group", value: parentLine.lensGroup.value },
        { key: "_lens_parent", value: "true" },
        { key: "_lens_details", value: parentLine.lensDetails.value },
      ];

      operations.push({
        linesMerge: {
          cartLines: groupLines.map((l) => ({
            cartLineId: l.id,
            quantity: l.quantity === 0 ? 0 : parentQty,
          })),
          parentVariantId: parentLine.merchandise.id,
          attributes,
        },
      });
    }
  }

  return { operations };
}
