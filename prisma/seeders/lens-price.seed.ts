import { PrismaClient, LensPriceKind } from "@prisma/client";

const prisma = new PrismaClient();

const CURRENCY_CODE = "USD";

const LENS_TYPE_PRICING = [
  {
    lensTypeCode: "single_vision_distance",
    basePriceMinor: 1000,
  },
  {
    lensTypeCode: "single_vision_reading",
    basePriceMinor: 3000,
  },
  {
    lensTypeCode: "progressive",
    basePriceMinor: 5000,
  },
];

function getIndexUpgradeMinor(refractiveIndex: number): number {
  if (refractiveIndex <= 1.50) return 0;
  if (refractiveIndex <= 1.56) return 500;
  if (refractiveIndex <= 1.59) return 1000;
  if (refractiveIndex <= 1.60) return 1500;
  if (refractiveIndex <= 1.61) return 2000;
  if (refractiveIndex <= 1.67) return 2500;
  if (refractiveIndex <= 1.74) return 3000;
  return 3500;
}

async function seedLensTypePrices(
  lensTypeCode: string,
  basePriceMinor: number,
) {
  const lensType = await prisma.lensType.findUnique({
    where: { code: lensTypeCode },
  });

  if (!lensType) {
    throw new Error(
      `Lens type "${lensTypeCode}" not found. Seed lens types first.`,
    );
  }

  const lensIndices = await prisma.lensIndex.findMany({
    where: { active: true },
    orderBy: { refractiveIndex: "asc" },
  });

  if (lensIndices.length === 0) {
    throw new Error(
      "No active lens indices found. Seed lens indices first.",
    );
  }

  // Create or update the base price for this lens type.
  const baseCode = `test-${lensType.code}-base-usd`;

  await prisma.lensPrice.upsert({
    where: { code: baseCode },
    update: {
      kind: LensPriceKind.base,
      amountMinor: basePriceMinor,
      currencyCode: CURRENCY_CODE,
      lensTypeId: lensType.id,
      lensIndexId: null,
      lensOptionId: null,
      active: true,
    },
    create: {
      code: baseCode,
      kind: LensPriceKind.base,
      amountMinor: basePriceMinor,
      currencyCode: CURRENCY_CODE,
      lensTypeId: lensType.id,
      active: true,
    },
  });

  console.log(
    `${lensType.code}: base price $${(basePriceMinor / 100).toFixed(2)}`,
  );

  // Create or update index-upgrade prices.
  for (const index of lensIndices) {
    const refractiveIndex = Number(index.refractiveIndex);
    const amountMinor = getIndexUpgradeMinor(refractiveIndex);
    const code = `test-${lensType.code}-${index.code}-upgrade-usd`;

    await prisma.lensPrice.upsert({
      where: { code },
      update: {
        kind: LensPriceKind.upgrade,
        amountMinor,
        currencyCode: CURRENCY_CODE,
        lensTypeId: lensType.id,
        lensIndexId: index.id,
        lensOptionId: null,
        active: true,
      },
      create: {
        code,
        kind: LensPriceKind.upgrade,
        amountMinor,
        currencyCode: CURRENCY_CODE,
        lensTypeId: lensType.id,
        lensIndexId: index.id,
        active: true,
      },
    });

    console.log(
      `${lensType.code} | ${index.code} (${refractiveIndex}): $${(
        amountMinor / 100
      ).toFixed(2)} upgrade`,
    );
  }

  console.log(
    `Seeded 1 base price and ${lensIndices.length} index upgrade prices for ${lensType.code}.`,
  );
}

async function main() {
  console.log("Seeding lens prices...");

  for (const pricing of LENS_TYPE_PRICING) {
    await seedLensTypePrices(
      pricing.lensTypeCode,
      pricing.basePriceMinor,
    );
  }

  console.log("Lens price seeding completed.");
}

main()
  .catch((error) => {
    console.error("Lens price seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
