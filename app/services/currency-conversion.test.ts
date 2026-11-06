import { describe, expect, it } from "vitest";
import { convertUsdMinorToCurrencyMinor } from "./currency-conversion.server";
import {
  getCurrencyMinorUnitDigits,
  minorUnitsToMajorDecimalString,
  parseMajorToMinorUnits,
} from "app/utils/currency";

describe("currency conversion", () => {
  it("keeps USD master prices unchanged for USD stores", () => {
    expect(convertUsdMinorToCurrencyMinor(1234, "1", "USD")).toBe(1234);
  });

  it("converts USD minor units to INR precision", () => {
    expect(convertUsdMinorToCurrencyMinor(100, "83.1234", "INR")).toBe(8312);
  });

  it("converts USD minor units to EUR precision", () => {
    expect(convertUsdMinorToCurrencyMinor(1999, "0.92", "EUR")).toBe(1839);
  });

  it("supports zero- and three-decimal currencies", () => {
    expect(getCurrencyMinorUnitDigits("JPY")).toBe(0);
    expect(convertUsdMinorToCurrencyMinor(50, "1", "JPY")).toBe(1);
    expect(getCurrencyMinorUnitDigits("BHD")).toBe(3);
    expect(convertUsdMinorToCurrencyMinor(100, "0.376", "BHD")).toBe(376);
  });

  it("rounds exact half values away from zero", () => {
    expect(convertUsdMinorToCurrencyMinor(1, "1.5", "USD")).toBe(2);
    expect(convertUsdMinorToCurrencyMinor(1, "1.49", "USD")).toBe(1);
  });

  it("parses Shopify money values without binary floating-point arithmetic", () => {
    expect(parseMajorToMinorUnits("1299.99", "USD")).toBe(129999);
    expect(parseMajorToMinorUnits("1299", "JPY")).toBe(1299);
    expect(parseMajorToMinorUnits("1.2345", "BHD")).toBe(1235);
  });

  it("serializes minor units to Shopify decimal prices at currency precision", () => {
    expect(minorUnitsToMajorDecimalString(8312, "INR")).toBe("83.12");
    expect(minorUnitsToMajorDecimalString(100, "JPY")).toBe("100");
    expect(minorUnitsToMajorDecimalString(376, "BHD")).toBe("0.376");
  });

  it("rejects unavailable currencies and invalid rates", () => {
    expect(() => convertUsdMinorToCurrencyMinor(100, "1", "ZZZ")).toThrow(
      "Unsupported currency code",
    );
    expect(() => convertUsdMinorToCurrencyMinor(100, "0", "INR")).toThrow(
      "Exchange rate must be positive",
    );
  });
});
