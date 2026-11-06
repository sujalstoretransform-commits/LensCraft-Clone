const currencyDigitsCache = new Map<string, number>();
const intlWithSupportedValues = Intl as typeof Intl & {
  supportedValuesOf?: (key: "currency") => string[];
};


//digits after decimal
export function getCurrencyMinorUnitDigits(currencyCode: string): number {
  const normalizedCode = currencyCode.toUpperCase();
  const cachedDigits = currencyDigitsCache.get(normalizedCode);
  if (cachedDigits !== undefined) return cachedDigits;

  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new RangeError(`Unsupported currency code: ${currencyCode}`);
  }

  const supportedCurrencies =
    intlWithSupportedValues.supportedValuesOf?.("currency");
  if (
    supportedCurrencies &&
    !supportedCurrencies.includes(normalizedCode)
  ) {
    throw new RangeError(`Unsupported currency code: ${currencyCode}`);
  }

  let digits: number;
  try {
    const resolvedOptions = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCode,
    }).resolvedOptions();
    if (typeof resolvedOptions.maximumFractionDigits !== "number") {
      throw new RangeError(`Unsupported currency code: ${currencyCode}`);
    }
    digits = resolvedOptions.maximumFractionDigits;
  } catch {
    throw new RangeError(`Unsupported currency code: ${currencyCode}`);
  }

  if (!Number.isInteger(digits) || digits < 0 || digits > 3) {
    throw new RangeError(`Unsupported currency precision: ${normalizedCode}`);
  }

  currencyDigitsCache.set(normalizedCode, digits);
  return digits;
}

// conversion of rupee to paise (ex)
export function formatMinorUnits(
  amountMinor: number,
  currencyCode: string,
): string {
  const digits = getCurrencyMinorUnitDigits(currencyCode);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amountMinor / 10 ** digits);
}

export function minorUnitsToMajorDecimalString(
  amountMinor: number,
  currencyCode: string,
): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("Minor-unit amount must be a non-negative safe integer.");
  }

  const digits = getCurrencyMinorUnitDigits(currencyCode);
  const scale = 10n ** BigInt(digits);
  const amount = BigInt(amountMinor);
  const whole = amount / scale;
  if (digits === 0) return whole.toString();

  const fraction = (amount % scale).toString().padStart(digits, "0");
  return `${whole}.${fraction}`;
}

export function parseMajorToMinorUnits(
  amount: string,
  currencyCode: string,
): number {
  const digits = getCurrencyMinorUnitDigits(currencyCode);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new RangeError("Invalid monetary amount.");

  const [, sign, wholePart, fractionPart = ""] = match;
  const scale = 10n ** BigInt(digits);
  const keptFraction = fractionPart.slice(0, digits).padEnd(digits, "0");
  let minor = BigInt(wholePart) * scale + BigInt(keptFraction || "0");

  if (
    fractionPart.length > digits &&
    Number(fractionPart[digits]) >= 5
  ) {
    minor += 1n;
  }

  if (sign === "-") minor = -minor;
  const result = Number(minor);
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Monetary amount exceeds the supported range.");
  }
  return result;
}
