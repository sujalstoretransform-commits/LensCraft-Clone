const INR_PER_USD = 85;

// Demo seed conversion only; replace with merchant-approved prices before production use.
export function usdMinorToInrMinor(usdMinor: number) {
  const inrRupees = (usdMinor / 100) * INR_PER_USD;
  return Math.round(inrRupees / 10) * 1000;
}
