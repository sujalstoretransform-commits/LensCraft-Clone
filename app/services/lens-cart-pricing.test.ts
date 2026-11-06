import { describe, expect, it } from "vitest";
import { mapLensCartPriceItems } from "./lens-cart-pricing";

describe("lens cart price mapping", () => {
  const items = [
    { code: "base", label: "Lens", amountMinor: 8000 },
    { code: "index", label: "Index", amountMinor: 312 },
    { code: "free-addon", label: "Included add-on", amountMinor: 0 },
  ];

  it("maps each paid component and preserves the displayed lens total", () => {
    const mapped = mapLensCartPriceItems(
      items,
      { base: "101", index: "102" },
      8312,
    );

    expect(mapped.map(({ variantId }) => variantId)).toEqual(["101", "102"]);
    expect(mapped.reduce((sum, { item }) => sum + item.amountMinor, 0)).toBe(
      8312,
    );
  });

  it("fails closed when a component mapping is missing or the total differs", () => {
    expect(() =>
      mapLensCartPriceItems(items, { base: "101" }, 8312),
    ).toThrow("incomplete or inconsistent");
    expect(() =>
      mapLensCartPriceItems(items, { base: "101", index: "102" }, 8311),
    ).toThrow("incomplete or inconsistent");
  });
});
