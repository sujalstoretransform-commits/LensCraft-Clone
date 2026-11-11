import { getCurrencyMinorUnitDigits } from "app/utils/currency";

export class CurrencyRateUnavailableError extends Error {}

// Comprehensive fallback rates against 1 USD (covers all major Shopify currencies)
export const DEFAULT_RATES: Record<string, number> = {
  USD: 1,
  INR: 86.5,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.38,
  AUD: 1.52,
  JPY: 154,
  AED: 3.67,
  SGD: 1.34,
  NZD: 1.71,
  CHF: 0.88,
  HKD: 7.78,
  SEK: 10.9,
  DKK: 7.02,
  NOK: 11.0,
  PLN: 4.10,
  MXN: 20.3,
  BRL: 5.75,
  ZAR: 18.0,
  SAR: 3.75,
  THB: 34.5,
  MYR: 4.45,
  PHP: 58.5,
  IDR: 15900,
};

// In-memory cache for exchange rates
const cache = new Map<string, { rate: string; timestamp: number }>();
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function clearExchangeRateCache() {
  cache.clear();
}

export async function getUsdExchangeRate(
  currencyCode: string,
  now = new Date(),
): Promise<{ rate: string; stale: boolean; fetchedAt: Date }> {
  const code = (currencyCode || "USD").toUpperCase().trim();
  getCurrencyMinorUnitDigits(code);

  if (code === "USD") {
    return { rate: "1", stale: false, fetchedAt: now };
  }

  const cached = cache.get(code);
  if (cached && now.getTime() - cached.timestamp < CACHE_TTL_MS) {
    return { rate: cached.rate, stale: false, fetchedAt: new Date(cached.timestamp) };
  }

  // Try fetching latest rate from free public API (no API key required)
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/USD`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, unknown> };
      const fetchedRate = data?.rates?.[code];
      if (
        (typeof fetchedRate === "number" || typeof fetchedRate === "string") &&
        Number.isFinite(Number(fetchedRate)) &&
        Number(fetchedRate) > 0
      ) {
        const rateStr = String(fetchedRate);
        cache.set(code, { rate: rateStr, timestamp: now.getTime() });
        return { rate: rateStr, stale: false, fetchedAt: now };
      }
    }
  } catch {
    // Network failure or timeout; continue to fallback
  }

  // Fallback to built-in rate table or safe 1.0 default
  const fallback = DEFAULT_RATES[code] ?? 1;
  const rateStr = String(fallback);
  cache.set(code, { rate: rateStr, timestamp: now.getTime() });
  return { rate: rateStr, stale: true, fetchedAt: now };
}

export function convertUsdMinorToCurrencyMinor(
  usdAmountMinor: number,
  usdToTargetRate: string | number,
  targetCurrencyCode: string,
): number {
  if (!Number.isSafeInteger(usdAmountMinor) || usdAmountMinor < 0) {
    throw new RangeError("USD amount must be a non-negative safe integer.");
  }

  const code = (targetCurrencyCode || "USD").toUpperCase().trim();
  const digits = getCurrencyMinorUnitDigits(code);
  const rate = Number(usdToTargetRate);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new RangeError("Exchange rate must be positive.");
  }

  // usdAmountMinor is in cents (2 decimal digits).
  // Convert cents -> dollars -> target subunits: (cents / 100) * rate * 10^digits
  const targetMinor = Math.round((usdAmountMinor / 100) * rate * 10 ** digits);
  if (!Number.isSafeInteger(targetMinor)) {
    throw new RangeError("Converted amount exceeds the supported range.");
  }
  return targetMinor;
}
