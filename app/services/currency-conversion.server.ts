import { getCurrencyMinorUnitDigits } from "app/utils/currency";

type DecimalRatio = {
  numerator: bigint;
  denominator: bigint;
};

function parsePositiveDecimal(value: string): DecimalRatio {
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value);
  if (!match) throw new RangeError("Invalid exchange rate.");

  const [, wholePart, fractionPart = "", exponentText = "0"] = match;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) {
    throw new RangeError("Invalid exchange rate exponent.");
  }

  let numerator = BigInt(`${wholePart}${fractionPart}`);
  let denominator = 10n ** BigInt(fractionPart.length);
  if (exponent > 0) numerator *= 10n ** BigInt(exponent);
  if (exponent < 0) denominator *= 10n ** BigInt(-exponent);
  if (numerator <= 0n) throw new RangeError("Exchange rate must be positive.");

  return { numerator, denominator };
}

export function convertUsdMinorToCurrencyMinor(
  usdAmountMinor: number,
  usdToTargetRate: string,
  targetCurrencyCode: string,
): number {
  if (!Number.isSafeInteger(usdAmountMinor) || usdAmountMinor < 0) {
    throw new RangeError("USD amount must be a non-negative safe integer.");
  }

  const fractionDigits = getCurrencyMinorUnitDigits(targetCurrencyCode);
  const rate = parsePositiveDecimal(usdToTargetRate);
  const numerator =
    BigInt(usdAmountMinor) *
    rate.numerator *
    10n ** BigInt(fractionDigits);
  const denominator = rate.denominator * 100n;

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded =
    remainder * 2n >= denominator ? quotient + 1n : quotient;
  const result = Number(rounded);

  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Converted amount exceeds the supported range.");
  }
  return result;
}
