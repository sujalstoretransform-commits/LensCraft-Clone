import { describe, expect, it } from "vitest";
import { mapLensCartPriceItems } from "./lens-cart-pricing";

describe("mapLensCartPriceItems", () => {
  it("maps exact catalog codes to Shopify variants and preserves the total", () => {
    const result = mapLensCartPriceItems(
      [
        { code: "single_vision_distance", label: "Single Vision — Distance", amountMinor: 100 },
        { code: "index_156", label: "Index 1.56", amountMinor: 500 },
      ],
      {
        single_vision_distance: "6801",
        index_156: "6802",
      },
      600,
    );

    expect(result.map(({ item, variantId }) => [item.code, variantId])).toEqual([
      ["single_vision_distance", "6801"],
      ["index_156", "6802"],
    ]);
  });

  it("excludes zero-price components", () => {
    expect(
      mapLensCartPriceItems(
        [{ code: "clear", label: "Clear", amountMinor: 0 }],
        {},
        0,
      ),
    ).toEqual([]);
  });

  it("rejects incomplete variant mappings", () => {
    expect(() =>
      mapLensCartPriceItems(
        [{ code: "index_156", label: "Index 1.56", amountMinor: 500 }],
        {},
        500,
      ),
    ).toThrow('No Shopify variant is mapped to lens price "Index 1.56".');
  });
});
