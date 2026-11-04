import { PrismaClient, LensFamily } from "@prisma/client";

const prisma = new PrismaClient();

const lensTypes = [
  {
    code: "single_vision_distance",
    name: "Single Vision — Distance",
    family: LensFamily.clear,
    description:
      "Clears far-away vision for everyday wear and driving.",
  },
  {
    code: "single_vision_reading",
    name: "Single Vision — Reading / Computer",
    family: LensFamily.clear,
    description: "One power for close-up work.",
  },
  {
    code: "progressive",
    name: "Progressive (No Line)",
    family: LensFamily.clear,
    description:
      "Distance, computer and reading in one lens with no visible line.",
  },
  {
    code: "reading_glasses",
    name: "Reading Glasses (No Prescription)",
    family: LensFamily.readers,
    description:
      "Reading magnification from +0.75 to +3.50 without a prescription.",
  },
  {
    code: "non_prescription",
    name: "Non-prescription",
    family: LensFamily.non_prescription,
    description:
      "Clear, blue-light or sun lenses without vision correction.",
  },
];

async function main() {
  for (const lensType of lensTypes) {
    await prisma.lensType.upsert({
      where: { code: lensType.code },
      update: {
        name: lensType.name,
        family: lensType.family,
        description: lensType.description,
        active: true,
      },
      create: {
        ...lensType,
        active: true,
      },
    });
  }

  console.log("Step 1 lens types seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Failed to seed Step 1 lens types:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });