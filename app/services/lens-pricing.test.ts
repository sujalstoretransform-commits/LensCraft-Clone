import { describe, expect, it } from "vitest";
import {
  calculatePrice,
  PriceUnavailableError,
} from "./lens-pricing";

const catalog = {
  lensTypes: [
    {
      code: "single-vision",
      name: "Single vision",
      prices: [{ code: "lens-base", amountMinor: 1200 }],
    },
  ],
  lensOptions: [
    {
      code: "clear",
      name: "Clear",
      category: "lens_type" as const,
      prices: [],
    },
    {
      code: "anti-glare",
      name: "Anti-glare",
      category: "add_on" as const,
      prices: [{ code: "anti-glare-price", amountMinor: 300 }],
    },
  ],
};

const selection = {
  lensTypeCode: "single-vision",
  optionCodes: ["clear"],
};

describe("calculatePrice", () => {
  it("includes the selected paid add-on in the currency-independent total", () => {
    const result = calculatePrice(
      {
        ...catalog,
        lensTypes: [
          {
            ...catalog.lensTypes[0],
            prices: [
              ...catalog.lensTypes[0].prices,
              {
                code: "index-upgrade",
                amountMinor: 500,
                lensIndex: { code: "1.67" },
              },
            ],
          },
        ],
      },
      {
        ...selection,
        optionCodes: ["clear", "anti-glare"],
        lensIndexCode: "1.67",
      },
      1000,
    );

    expect(result.items.map(({ code }) => code)).toEqual([
      "lens-base",
      "index-upgrade",
      "anti-glare-price",
    ]);
    expect(result.lensTotalMinor).toBe(2000);
    expect(result.totalMinor).toBe(3000);
  });

  it("does not silently omit a selected add-on without a price", () => {
    expect(() =>
      calculatePrice(
        {
          ...catalog,
          lensOptions: [
            ...catalog.lensOptions,
            {
              code: "missing-addon",
              name: "Missing add-on",
              category: "add_on",
              prices: [],
            },
          ],
        },
        { ...selection, optionCodes: ["clear", "missing-addon"] },
        0,
      ),
    ).toThrow(PriceUnavailableError);
  });

  it("does not silently omit a selected technology without a price", () => {
    expect(() =>
      calculatePrice(
        {
          ...catalog,
          lensOptions: [
            {
              code: "clear",
              name: "Clear",
              category: "lens_type",
              prices: [],
              lensTechnologyOptions: [
                {
                  lensType: { code: "single-vision" },
                  lensTechnology: {
                    code: "photochromic",
                    name: "Photochromic",
                    lensPrices: [],
                  },
                },
              ],
            },
            catalog.lensOptions[1],
          ],
        },
        { ...selection, lensTechnologyCode: "photochromic" },
        0,
      ),
    ).toThrow(PriceUnavailableError);
  });
});
