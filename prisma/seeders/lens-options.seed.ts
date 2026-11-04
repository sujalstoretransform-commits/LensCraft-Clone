import prisma from "app/db.server";

const lensTypeOptions = [
  {
    code: "clear",
    name: "Clear",
    category: "lens_type" as const,
    description: "Everyday clear lenses for natural vision.",
  },
  {
    code: "blue_light",
    name: "Blue-Light Filtering",
    category: "lens_type" as const,
    description: "Designed to filter some blue light from digital screens.",
  },
  {
    code: "light_adaptive",
    name: "Light-Adaptive",
    category: "lens_type" as const,
    description: "Lenses that adapt to changing light conditions.",
  },
  {
    code: "sunglasses_tinted",
    name: "Sunglasses Tinted",
    category: "lens_type" as const,
    description: "Tinted lenses for your preferred look and light conditions.",
  },
  {
    code: "sunglasses_polarized",
    name: "Sunglasses Polarized",
    category: "lens_type" as const,
    description: "Designed to reduce glare from reflective surfaces.",
  },
  {
    code: "anti_fog",
    name: "Anti-fog coating",
    category: "add_on" as const,
    description: "Helps prevent fogging on lenses.",
  },
  {
    code: "blue_light_coating",
    name: "Blue-light coating",
    category: "add_on" as const,
    description: "Optional blue-light coating for clear lenses.",
  },
];

const optionPrices = [
  { code: "blue_light", amountMinor: 1500 },
  { code: "light_adaptive", amountMinor: 2500 },
  { code: "sunglasses_tinted", amountMinor: 2000 },
  { code: "sunglasses_polarized", amountMinor: 3500 },
  { code: "anti_fog", amountMinor: 500 },
  { code: "blue_light_coating", amountMinor: 1000 },
];

async function seedLensOptions() {
  for (const option of lensTypeOptions) {
    await prisma.lensOption.upsert({
      where: { code: option.code },
      update: {
        name: option.name,
        category: option.category,
        description: option.description,
        active: true,
      },
      create: {
        ...option,
        active: true,
      },
    });
  }

  for (const price of optionPrices) {
    const option = await prisma.lensOption.findUniqueOrThrow({
      where: { code: price.code },
      select: { id: true },
    });

    await prisma.lensPrice.upsert({
      where: {
        code: `option-${price.code}-usd`,
      },
      update: {
        kind: "add_on",
        amountMinor: price.amountMinor,
        currencyCode: "USD",
        lensTypeId: null,
        lensIndexId: null,
        lensOptionId: option.id,
        active: true,
      },
      create: {
        code: `option-${price.code}-usd`,
        kind: "add_on",
        amountMinor: price.amountMinor,
        currencyCode: "USD",
        lensTypeId: null,
        lensIndexId: null,
        lensOptionId: option.id,
        active: true,
      },
    });
  }

  console.log("Lens options and prices seeded successfully.");
}

seedLensOptions()
  .catch((error) => {
    console.error("Failed to seed lens options:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });