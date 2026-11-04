import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TechnologyMapping = {
  technologyCode: string;
  indexes: string[];
};

type OptionMapping = {
  lensOptionCode: string;
  technologies: TechnologyMapping[];
  indexes?: string[];
};

type LensTypeMapping = {
  lensTypeCode: string;
  options: OptionMapping[];
};

const lensCompatibilityMappings: LensTypeMapping[] = [
  {
    lensTypeCode: "single_vision_distance",
    options: [
      {
        lensOptionCode: "clear",
        technologies: [],
        indexes: ["index_156", "index_159", "index_161", "index_167", "index_174",],
      },
      {
        lensOptionCode: "blue_light",
        technologies: [],
        indexes: ["index_156", "index_159", "index_161", "index_167", "index_174",],
      },
      {
        lensOptionCode: "light_adaptive",
        technologies: [
          {
            technologyCode: "standard_light_adaptive",
            indexes: ["index_156", "index_159", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "standard_light_adaptive_blue_light",
            indexes: ["index_156", "index_159", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "transitions_gen_s",
            indexes: ["index_150", "index_159", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "transitions_xtractive",
            indexes: ["index_150", "index_161", "index_167"],
          },
          {
            technologyCode: "in_car_light_adaptive_blue_light",
            indexes: ["index_161", "index_167"],
          },
        ],
      },
      {
        lensOptionCode: "sunglasses_tinted",
        technologies: [
          {
            technologyCode: "sunglasses_tinted",
            indexes: ["index_161", "index_167"],
          },
          {
            technologyCode: "sunglasses_tinted_blue_light",
            indexes: ["index_161", "index_167"],
          },
        ],
      },
      {
        lensOptionCode: "sunglasses_polarized",
        technologies: [
          {
            technologyCode: "sunglasses_solid_polarized",
            indexes: ["index_156", "index_159", "index_161", "index_167"],
          },
          {
            technologyCode: "sunglasses_mirror_polarized",
            indexes: ["index_156", "index_161", "index_167"],
          },
        ],
      },
    ],
  },

  {
    lensTypeCode: "single_vision_reading",
    options: [
      {
        lensOptionCode: "clear",
        technologies: [],
        indexes: ["index_156", "index_159", "index_161", "index_167", "index_174",],
      },
      {
        lensOptionCode: "blue_light",
        technologies: [],
        indexes: ["index_156", "index_159", "index_161", "index_167", "index_174",],
      },
      {
        lensOptionCode: "light_adaptive",
        technologies: [
          {
            technologyCode: "standard_light_adaptive",
            indexes: ["index_156", "index_159", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "standard_light_adaptive_blue_light",
            indexes: ["index_156", "index_159", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "transitions_gen_s",
            indexes: ["index_150", "index_159", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "transitions_xtractive",
            indexes: ["index_150", "index_161", "index_167"],
          },
          {
            technologyCode: "in_car_light_adaptive_blue_light",
            indexes: ["index_161", "index_167"],
          },
        ],
      },
      {
        lensOptionCode: "sunglasses_tinted",
        technologies: [
          {
            technologyCode: "sunglasses_tinted",
            indexes: ["index_161", "index_167"],
          },
          {
            technologyCode: "sunglasses_tinted_blue_light",
            indexes: ["index_161", "index_167"],
          },
        ],
      },
      {
        lensOptionCode: "sunglasses_polarized",
        technologies: [
          {
            technologyCode: "sunglasses_solid_polarized",
            indexes: ["index_156", "index_159", "index_161", "index_167"],
          },
          {
            technologyCode: "sunglasses_mirror_polarized",
            indexes: ["index_156", "index_161", "index_167"],
          },
        ],
      },
    ],
  },

  {
    lensTypeCode: "progressive",
    options: [
      {
        lensOptionCode: "clear",
        technologies: [],
        indexes: ["index_156", "index_159", "index_161", "index_167", "index_174",],
      },
      {
        lensOptionCode: "blue_light",
        technologies: [],
        indexes: ["index_156", "index_159", "index_161", "index_167", "index_174",],
      },
      {
        lensOptionCode: "light_adaptive",
        technologies: [
          {
            technologyCode: "standard_light_adaptive",
            indexes: ["index_156", "index_159", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "standard_light_adaptive_blue_light",
            indexes: ["index_156", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "transitions_gen_s",
            indexes: ["index_150", "index_159", "index_161", "index_167", "index_174"],
          },
          {
            technologyCode: "transitions_xtractive",
            indexes: ["index_150", "index_161", "index_167"],
          },
        ],
      },
      {
        lensOptionCode: "sunglasses_tinted",
        technologies: [
          {
            technologyCode: "sunglasses_tinted",
            indexes: ["index_156", "index_161", "index_167"],
          },
          {
            technologyCode: "sunglasses_tinted_blue_light",
            indexes: ["index_156", "index_161", "index_167"],
          },
        ],
      },
      {
        lensOptionCode: "sunglasses_polarized",
        technologies: [
          {
            technologyCode: "sunglasses_solid_polarized",
            indexes: ["index_156", "index_159", "index_161", "index_167"],
          },
          {
            technologyCode: "sunglasses_mirror_polarized",
            indexes: ["index_156", "index_161", "index_167"],
          },
        ],
      },
    ],
  },
];

async function seedLensCompatibility() {
  const [lensTypes, lensOptions, lensTechnologies, lensIndices] =
    await Promise.all([
      prisma.lensType.findMany({
        where: { active: true },
        select: { id: true, code: true },
      }),
      prisma.lensOption.findMany({
        select: { id: true, code: true },
      }),
      prisma.lensTechnology.findMany({
        where: { active: true },
        select: { id: true, code: true },
      }),
      prisma.lensIndex.findMany({
        where: { active: true },
        select: { id: true, code: true },
      }),
    ]);

  const lensTypeByCode = new Map(lensTypes.map((x) => [x.code, x]));
  const lensOptionByCode = new Map(lensOptions.map((x) => [x.code, x]));
  const technologyByCode = new Map(lensTechnologies.map((x) => [x.code, x]));
  const indexByCode = new Map(lensIndices.map((x) => [x.code, x]));

  const compatibilityRows: {
    lensTypeId: string;
    lensOptionId: string;
    lensTechnologyId: string | null;
    lensIndexId: string;
    active: boolean;
  }[] = [];

  const technologyOptionRows: {
    lensTypeId: string;
    lensOptionId: string;
    lensTechnologyId: string;
    active: boolean;
  }[] = [];

  const compatibilityKeys = new Set<string>();
  const technologyOptionKeys = new Set<string>();

  for (const typeMapping of lensCompatibilityMappings) {
    const lensType = lensTypeByCode.get(typeMapping.lensTypeCode);

    if (!lensType) {
      throw new Error(`Lens type not found or inactive: ${typeMapping.lensTypeCode}`);
    }

    for (const optionMapping of typeMapping.options) {
      const lensOption = lensOptionByCode.get(optionMapping.lensOptionCode);

      if (!lensOption) {
        throw new Error(`Lens option not found: ${optionMapping.lensOptionCode}`);
      }

      if (optionMapping.technologies.length === 0) {
        for (const indexCode of optionMapping.indexes ?? []) {
          const lensIndex = indexByCode.get(indexCode);

          if (!lensIndex) {
            throw new Error(`Active lens index not found: ${indexCode}`);
          }

          const key = `${lensType.id}:${lensOption.id}:NULL:${lensIndex.id}`;

          if (!compatibilityKeys.has(key)) {
            compatibilityKeys.add(key);
            compatibilityRows.push({
              lensTypeId: lensType.id,
              lensOptionId: lensOption.id,
              lensTechnologyId: null,
              lensIndexId: lensIndex.id,
              active: true,
            });
          }
        }

        continue;
      }

      for (const technologyMapping of optionMapping.technologies) {
        const technology = technologyByCode.get(technologyMapping.technologyCode);

        if (!technology) {
          throw new Error(
            `Active lens technology not found: ${technologyMapping.technologyCode}`,
          );
        }

        const technologyOptionKey =
          `${lensType.id}:${lensOption.id}:${technology.id}`;

        if (!technologyOptionKeys.has(technologyOptionKey)) {
          technologyOptionKeys.add(technologyOptionKey);
          technologyOptionRows.push({
            lensTypeId: lensType.id,
            lensOptionId: lensOption.id,
            lensTechnologyId: technology.id,
            active: true,
          });
        }

        for (const indexCode of technologyMapping.indexes) {
          const lensIndex = indexByCode.get(indexCode);

          if (!lensIndex) {
            throw new Error(`Active lens index not found: ${indexCode}`);
          }

          const key =
            `${lensType.id}:${lensOption.id}:${technology.id}:${lensIndex.id}`;

          if (!compatibilityKeys.has(key)) {
            compatibilityKeys.add(key);
            compatibilityRows.push({
              lensTypeId: lensType.id,
              lensOptionId: lensOption.id,
              lensTechnologyId: technology.id,
              lensIndexId: lensIndex.id,
              active: true,
            });
          }
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.lensIndexCompatibility.deleteMany();
    await tx.lensTechnologyOption.deleteMany();

    if (technologyOptionRows.length) {
      await tx.lensTechnologyOption.createMany({
        data: technologyOptionRows,
      });
    }

    if (compatibilityRows.length) {
      await tx.lensIndexCompatibility.createMany({
        data: compatibilityRows,
      });
    }
  });

  console.log("Lens compatibility seeding completed.");
  console.log(`Technology options: ${technologyOptionRows.length}`);
  console.log(`Index compatibilities: ${compatibilityRows.length}`);
}

seedLensCompatibility()
  .catch((error) => {
    console.error("Lens compatibility seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });