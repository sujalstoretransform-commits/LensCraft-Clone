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
    code: "tinted",
    name: "Tinted",
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

  console.log("Lens options seeded successfully.");
}

seedLensOptions()
  .catch((error) => {
    console.error("Failed to seed lens options:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
