import prisma from "app/db.server";
import {
  ExchangeRateProviderError,
  fetchUsdExchangeRate,
} from "./exchange-rate.server";
import { getCurrencyMinorUnitDigits } from "app/utils/currency";

export const EXCHANGE_RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const MAX_STALE_EXCHANGE_RATE_AGE_MS = 72 * 60 * 60 * 1000;

export class CurrencyRateUnavailableError extends Error {}

export type CachedExchangeRate = {
  rate: string;
  stale: boolean;
  fetchedAt: Date;
};

export async function getUsdExchangeRate(
  currencyCode: string,
  now = new Date(),
): Promise<CachedExchangeRate> {
  const normalizedCode = currencyCode.toUpperCase();
  getCurrencyMinorUnitDigits(normalizedCode);
  if (normalizedCode === "USD") {
    return { rate: "1", stale: false, fetchedAt: now };
  }

  let cached:
    | Awaited<ReturnType<typeof prisma.exchangeRateCache.findUnique>>
    | null;
  try {
    cached = await prisma.exchangeRateCache.findUnique({
      where: { currencyCode: normalizedCode },
    });
  } catch (error) {
    console.error("Exchange-rate cache lookup failed:", error);
    throw new CurrencyRateUnavailableError(
      `Exchange rate for ${normalizedCode} is unavailable.`,
    );
  }

  const cacheAge = cached ? now.getTime() - cached.fetchedAt.getTime() : Infinity;
  const rateAge = cached
    ? now.getTime() - cached.providerTimestamp.getTime()
    : Infinity;

  if (
    cached &&
    cacheAge >= 0 &&
    cacheAge < EXCHANGE_RATE_CACHE_TTL_MS &&
    rateAge >= 0 &&
    rateAge <= MAX_STALE_EXCHANGE_RATE_AGE_MS
  ) {
    return {
      rate: cached.usdRate.toString(),
      stale: false,
      fetchedAt: cached.fetchedAt,
    };
  }

  try {
    const fetched = await fetchUsdExchangeRate(normalizedCode);
    const staleRateAge = now.getTime() - fetched.providerTimestamp.getTime();
    if (
      staleRateAge < 0 ||
      staleRateAge > MAX_STALE_EXCHANGE_RATE_AGE_MS
    ) {
      throw new ExchangeRateProviderError(
        "The exchange-rate provider returned an outdated rate.",
      );
    }

    const saved = await prisma.exchangeRateCache.upsert({
      where: { currencyCode: normalizedCode },
      create: {
        currencyCode: normalizedCode,
        usdRate: fetched.rate,
        fetchedAt: now,
        providerTimestamp: fetched.providerTimestamp,
      },
      update: {
        usdRate: fetched.rate,
        fetchedAt: now,
        providerTimestamp: fetched.providerTimestamp,
      },
    });

    return {
      rate: saved.usdRate.toString(),
      stale: false,
      fetchedAt: saved.fetchedAt,
    };
  } catch (error) {
    if (
      cached &&
      rateAge >= 0 &&
      rateAge <= MAX_STALE_EXCHANGE_RATE_AGE_MS
    ) {
      console.warn(
        `Exchange-rate refresh failed for ${normalizedCode}; using a cached rate within the 72-hour stale limit.`,
      );
      return {
        rate: cached.usdRate.toString(),
        stale: true,
        fetchedAt: cached.fetchedAt,
      };
    }

    if (!(error instanceof ExchangeRateProviderError)) {
      console.error(`Exchange-rate refresh failed for ${normalizedCode}.`);
    }
    throw new CurrencyRateUnavailableError(
      `Exchange rate for ${normalizedCode} is unavailable.`,
    );
  }
}
