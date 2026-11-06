export class ExchangeRateProviderError extends Error {}

type ProviderResponse = {
  base?: unknown;
  timestamp?: unknown;
  rates?: unknown;
};

export type UsdExchangeRate = {
  rate: string;
  providerTimestamp: Date;
};

export async function fetchUsdExchangeRate(
  currencyCode: string,
): Promise<UsdExchangeRate> {
  const normalizedCode = currencyCode.toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new ExchangeRateProviderError("Unsupported currency code.");
  }
  if (normalizedCode === "USD") {
    return { rate: "1", providerTimestamp: new Date() };
  }

  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) {
    throw new ExchangeRateProviderError(
      "The exchange-rate provider is not configured.",
    );
  }

  const url = new URL("https://openexchangerates.org/api/latest.json");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("symbols", normalizedCode);

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new ExchangeRateProviderError(
      "The exchange-rate provider request failed.",
    );
  }
  if (!response.ok) {
    throw new ExchangeRateProviderError(
      `The exchange-rate provider returned HTTP ${response.status}.`,
    );
  }

  let payload: ProviderResponse;
  try {
    payload = (await response.json()) as ProviderResponse;
  } catch {
    throw new ExchangeRateProviderError(
      "The exchange-rate provider returned invalid JSON.",
    );
  }

  if (
    payload.base !== "USD" ||
    typeof payload.timestamp !== "number" ||
    !Number.isSafeInteger(payload.timestamp) ||
    typeof payload.rates !== "object" ||
    payload.rates === null ||
    !(normalizedCode in payload.rates)
  ) {
    throw new ExchangeRateProviderError(
      "The exchange-rate provider response is incomplete.",
    );
  }

  const rateValue = (payload.rates as Record<string, unknown>)[normalizedCode];
  if (
    (typeof rateValue !== "number" && typeof rateValue !== "string") ||
    !Number.isFinite(Number(rateValue)) ||
    Number(rateValue) <= 0
  ) {
    throw new ExchangeRateProviderError(
      "The exchange-rate provider returned an invalid rate.",
    );
  }

  const providerTimestamp = new Date(payload.timestamp * 1000);
  if (
    Number.isNaN(providerTimestamp.getTime()) ||
    providerTimestamp.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    throw new ExchangeRateProviderError(
      "The exchange-rate provider returned an invalid timestamp.",
    );
  }

  return {
    rate: String(rateValue),
    providerTimestamp,
  };
}
