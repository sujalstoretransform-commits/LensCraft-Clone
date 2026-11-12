export function cartTransformRun(input) {
  const groups = new Map();

  // Group frame and lens add-on variants together.
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
    const parentLine = lines.find(
      (line) => line.lensParent?.value === "true"
    );

    if (!parentLine || lines.length < 2) continue;

    const quantity = Math.min(
      ...lines.map((line) => line.quantity)
    );

    if (quantity < 1) continue;

    let lensDetails = {};

    try {
      const rawDetails = parentLine.lensDetails?.value;
      if (rawDetails) {
        const parsed = JSON.parse(rawDetails);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          lensDetails = parsed;
        }
      }
    } catch (error) {
      console.error("Invalid lens details JSON:", error);
      continue;
    }

    const attributes = Object.entries(lensDetails)
      .filter(
        ([key, value]) =>
          typeof key === "string" &&
          typeof value === "string" &&
          value.length > 0
      )
      .map(([key, value]) => ({
        key,
        value,
      }));

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

