export function cartTransformRun(input) {
  const operations = [];

  for (const line of input.cart.lines) {
    const raw = line.lensPrice?.value;
    if (!raw) continue;

    const lensMinor = parseInt(raw, 10);
    if (!Number.isInteger(lensMinor) || lensMinor <= 0 || lensMinor > 100000)
      continue;

    const base = parseFloat(line.cost.amountPerQuantity.amount);
    const newPrice = (base + lensMinor / 100).toFixed(2);

    operations.push({
      lineUpdate: {
        cartLineId: line.id,
        price: {
          adjustment: {
            fixedPricePerUnit: { amount: newPrice },
          },
        },
      },
    });
  }

  return { operations };
}
