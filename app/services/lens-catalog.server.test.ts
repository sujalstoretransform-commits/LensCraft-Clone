import { beforeEach, describe, expect, it, vi } from "vitest";

const { models, getUsdExchangeRate, CurrencyRateUnavailableError } =
  vi.hoisted(() => ({
    models: {
      lensType: { findMany: vi.fn() },
      lensIndex: { findMany: vi.fn() },
      lensOption: { findMany: vi.fn() },
      lensCompatibilityRule: { findMany: vi.fn() },
      lensIndexCompatibility: { findMany: vi.fn() },
      lensTechnology: { findMany: vi.fn() },
      prescriptionMethod: { findMany: vi.fn() },
    },
    getUsdExchangeRate: vi.fn(),
    CurrencyRateUnavailableError: class extends Error {},
  }));

vi.mock("../db.server", () => ({ default: models }));
vi.mock("./currency-cache.server", () => ({
  CurrencyRateUnavailableError,
  getUsdExchangeRate,
}));

import { loadLensCatalog } from "./lens-catalog.server";

const usdPrice = {
  code: "lens-base",
  kind: "base",
  amountMinor: 100,
  currencyCode: "USD",
};

describe("lens catalog currency conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    models.lensType.findMany.mockResolvedValue([
      {
        code: "single_vision",
        name: "Single vision",
        family: "clear",
        description: null,
        prices: [{ ...usdPrice, lensIndex: null }],
      },
    ]);
    models.lensIndex.findMany.mockResolvedValue([]);
    models.lensOption.findMany.mockResolvedValue([]);
    models.lensCompatibilityRule.findMany.mockResolvedValue([]);
    models.lensIndexCompatibility.findMany.mockResolvedValue([]);
    models.lensTechnology.findMany.mockResolvedValue([]);
    models.prescriptionMethod.findMany.mockResolvedValue([]);
    getUsdExchangeRate.mockResolvedValue({ rate: "83.1234", stale: false });
  });

  it("converts active USD master prices while preserving the catalog shape", async () => {
    const catalog = await loadLensCatalog("INR");

    expect(catalog.pricingAvailable).toBe(true);
    expect(catalog.currencyCode).toBe("INR");
    expect(catalog.lensTypes[0].prices[0]).toMatchObject({
      code: "lens-base",
      amountMinor: 8312,
      currencyCode: "INR",
    });
    expect(usdPrice).toMatchObject({
      amountMinor: 100,
      currencyCode: "USD",
    });
    expect(models.lensType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          prices: expect.objectContaining({
            where: { active: true, currencyCode: "USD" },
          }),
        }),
      }),
    );
  });

  it("keeps the catalog available but removes prices when no rate is usable", async () => {
    getUsdExchangeRate.mockRejectedValue(
      new CurrencyRateUnavailableError("provider unavailable"),
    );

    const catalog = await loadLensCatalog("INR");

    expect(catalog.pricingAvailable).toBe(false);
    expect(catalog.lensTypes[0].code).toBe("single_vision");
    expect(catalog.lensTypes[0].prices).toEqual([]);
  });
});
