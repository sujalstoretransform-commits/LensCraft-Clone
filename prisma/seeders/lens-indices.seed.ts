import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const lensIndices = [
  {
    code: "index_150",
    displayName: "Standard 1.50",
    refractiveIndex: "1.50",
  },
  {
    code: "index_156",
    displayName: "Thin 1.56",
    refractiveIndex: "1.56",
  },
  {
    code: "index_159",
    displayName: "Thin 1.59",
    refractiveIndex: "1.59",
  },
  {
    code: "index_160",
    displayName: "Thin 1.60",
    refractiveIndex: "1.60",
  },
  {
    code: "index_161",
    displayName: "Thin 1.61",
    refractiveIndex: "1.61",
  },
  {
    code: "index_167",
    displayName: "Extra Thin 1.67",
    refractiveIndex: "1.67",
  },
  {
    code: "index_174",
    displayName: "Ultra Thin 1.74",
    refractiveIndex: "1.74",
  },
] as const;

async function main() {
  for (const index of lensIndices) {
    await prisma.lensIndex.upsert({
      where: { code: index.code },
      update: {
        displayName: index.displayName,
        refractiveIndex: index.refractiveIndex,
        active: true,
      },
      create: {
        code: index.code,
        displayName: index.displayName,
        refractiveIndex: index.refractiveIndex,
        active: true,
      },
    });
  }

  console.log(`Seeded ${lensIndices.length} lens indices.`);
}

main()
  .catch((error) => {
    console.error("Failed to seed lens indices:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });