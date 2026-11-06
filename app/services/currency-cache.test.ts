import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("app/db.server", () => ({
  default: {
    exchangeRateCache: {
      findUnique,
      upsert,
    },
  },
}));

import {
  CurrencyRateUnavailableError,
  EXCHANGE_RATE_CACHE_TTL_MS,
  getUsdExchangeRate,
  MAX_STALE_EXCHANGE_RATE_AGE_MS,
} from "./currency-cache.server";

const now = new Date("2026-11-06T00:00:00.000Z");
const cacheEntry = (fetchedAt: Date, providerTimestamp: Date) => ({
  currencyCode: "INR",
  usdRate: { toString: () => "83.125" },
  fetchedAt,
  providerTimestamp,
});

describe("exchange-rate cache", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    vi.stubEnv("OPEN_EXCHANGE_RATES_APP_ID", "test-app-id");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns USD at a fixed 1:1 rate without database or provider calls", async () => {
    await expect(getUsdExchangeRate("USD", now)).resolves.toMatchObject({
      rate: "1",
      stale: false,
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a fresh database rate without calling the provider", async () => {
    findUnique.mockResolvedValue(
      cacheEntry(new Date(now.getTime() - 1000), now),
    );

    await expect(getUsdExchangeRate("INR", now)).resolves.toMatchObject({
      rate: "83.125",
      stale: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes expired cache and persists the provider rate", async () => {
    findUnique.mockResolvedValue(
      cacheEntry(
        new Date(now.getTime() - EXCHANGE_RATE_CACHE_TTL_MS - 1),
        new Date(now.getTime() - EXCHANGE_RATE_CACHE_TTL_MS - 1),
      ),
    );
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        base: "USD",
        timestamp: Math.floor(now.getTime() / 1000),
        rates: { INR: 83.2 },
      }),
    );
    upsert.mockImplementation(async ({ create }) => ({
      ...create,
      usdRate: { toString: () => String(create.usdRate) },
    }));

    await expect(getUsdExchangeRate("INR", now)).resolves.toMatchObject({
      rate: "83.2",
      stale: false,
    });
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][0].create.currencyCode).toBe("INR");
  });

  it("uses an expired rate when the provider fails, within the stale limit", async () => {
    const stale = cacheEntry(
      new Date(now.getTime() - EXCHANGE_RATE_CACHE_TTL_MS - 1000),
      new Date(now.getTime() - EXCHANGE_RATE_CACHE_TTL_MS - 1000),
    );
    findUnique.mockResolvedValue(stale);
    vi.mocked(fetch).mockRejectedValue(new Error("network unavailable"));

    await expect(getUsdExchangeRate("INR", now)).resolves.toMatchObject({
      rate: "83.125",
      stale: true,
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("fails closed when no usable rate exists", async () => {
    findUnique.mockResolvedValue(null);
    vi.mocked(fetch).mockRejectedValue(new Error("network unavailable"));

    await expect(getUsdExchangeRate("INR", now)).rejects.toBeInstanceOf(
      CurrencyRateUnavailableError,
    );
  });

  it("rejects stale fallback beyond the documented maximum age", async () => {
    findUnique.mockResolvedValue(
      cacheEntry(
        new Date(now.getTime() - MAX_STALE_EXCHANGE_RATE_AGE_MS - 1000),
        new Date(now.getTime() - MAX_STALE_EXCHANGE_RATE_AGE_MS - 1000),
      ),
    );
    vi.mocked(fetch).mockRejectedValue(new Error("network unavailable"));

    await expect(getUsdExchangeRate("INR", now)).rejects.toBeInstanceOf(
      CurrencyRateUnavailableError,
    );
  });

  it("rejects unsupported currency codes before fetching", async () => {
    await expect(getUsdExchangeRate("ZZZ", now)).rejects.toThrow(
      "Unsupported currency code",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed or non-USD provider responses", async () => {
    findUnique.mockResolvedValue(null);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        base: "EUR",
        timestamp: Math.floor(now.getTime() / 1000),
        rates: { INR: 90 },
      }),
    );

    await expect(getUsdExchangeRate("INR", now)).rejects.toBeInstanceOf(
      CurrencyRateUnavailableError,
    );
  });
});
