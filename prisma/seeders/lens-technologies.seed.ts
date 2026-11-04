import { PrismaClient, LensPriceKind } from "@prisma/client";

const prisma = new PrismaClient();

const lensTechnologies = [
  {
    code: "standard_light_adaptive",
    name: "Standard light-adaptive",
    description:
      "Light-adaptive lenses that adjust to changing light conditions.",
    sortOrder: 1,
    price: 10000,
  },
  {
    code: "standard_light_adaptive_blue_light",
    name: "Standard light-adaptive + blue-light",
    description:
      "Light-adaptive lenses with blue-light protection included.",
    sortOrder: 2,
    price: 12000,
  },
  {
    code: "transitions_gen_s",
    name: "Transitions® GEN S",
    description: "Transitions GEN S light-adaptive lens technology.",
    sortOrder: 3,
    price: 15000,
  },
  {
    code: "transitions_xtractive",
    name: "Transitions® XTRActive",
    description:
      "Extra-dark light-adaptive lenses designed to work in the car.",
    sortOrder: 4,
    price: 18000,
  },
  {
    code: "in_car_light_adaptive_blue_light",
    name: "In-car light-adaptive + blue-light",
    description:
      "Light-adaptive lenses with blue-light protection for driving.",
    sortOrder: 5,
    price: 20000,
  },
  {
    code: "sunglasses_tinted",
    name: "Sunglasses - Tinted",
    description: "Tinted sunglasses for UV protection.",
    sortOrder: 6,
    price: 10000,
  },
  {
    code: "sunglasses_tinted_blue_light",
    name: "Sunglasses - Tinted + Blue-light filtering",
    description: "Tinted sunglasses with blue-light filtering.",
    sortOrder: 7,
    price: 12000,
  },
  {
    code: "sunglasses_solid_polarized",
    name: "Sunglasses - Solid Polarized",
    description: "Sunglasses with solid polarized lenses.",
    sortOrder: 8,
    price: 15000,
  },
  {
    code: "sunglasses_mirror_polarized",
    name: "Sunglasses - Mirror Polarized",
    description: "Sunglasses with mirror polarized lenses.",
    sortOrder: 9,
    price: 18000,
  },
];

async function main() {
  console.log("Seeding lens technologies and prices...");

  for (const technology of lensTechnologies) {
    const { price, ...technologyData } = technology;

    const result = await prisma.lensTechnology.upsert({
      where: {
        code: technologyData.code,
      },
      update: {
        name: technologyData.name,
        description: technologyData.description,
        sortOrder: technologyData.sortOrder,
        active: true,
      },
      create: {
        ...technologyData,
        active: true,
      },
    });

    await prisma.lensPrice.upsert({
      where: {
        code: `technology-${technologyData.code}-usd`,
      },
      update: {
        kind: LensPriceKind.upgrade,
        amountMinor: price,
        currencyCode: "USD",
        lensTechnologyId: result.id,
        active: true,
      },
      create: {
        code: `technology-${technologyData.code}-usd`,
        kind: LensPriceKind.upgrade,
        amountMinor: price,
        currencyCode: "USD",
        lensTechnologyId: result.id,
        active: true,
      },
    });

    console.log(
      `Seeded: ${result.name} (${result.code}) - $${(price / 100).toFixed(2)}`,
    );
  }

  const technologyCount = await prisma.lensTechnology.count();
  const priceCount = await prisma.lensPrice.count({
    where: {
      code: {
        startsWith: "technology-",
      },
    },
  });

  console.log(
    `Seed completed. Technologies: ${technologyCount}, technology prices: ${priceCount}`,
  );
}

main()
  .catch((error) => {
    console.error("Lens technology seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });