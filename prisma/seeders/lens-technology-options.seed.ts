import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const technologyOptionMappings = {
  single_vision_distance: {
    light_adaptive: [
      "standard_light_adaptive",
      "standard_light_adaptive_blue_light",
      "transitions_gen_s",
      "transitions_xtractive",
      "in_car_light_adaptive_blue_light",
    ],

    sunglasses_tinted: [
      "sunglasses_tinted",
      "sunglasses_tinted_blue_light",
    ],

    sunglasses_polarized: [
      "sunglasses_solid_polarized",
      "sunglasses_mirror_polarized",
    ],
  },

  single_vision_reading: {
    light_adaptive: [
      "standard_light_adaptive",
      "standard_light_adaptive_blue_light",
      "transitions_gen_s",
      "transitions_xtractive",
      "in_car_light_adaptive_blue_light",
    ],

    sunglasses_tinted: [
      "sunglasses_tinted",
      "sunglasses_tinted_blue_light",
    ],

    sunglasses_polarized: [
      "sunglasses_solid_polarized",
      "sunglasses_mirror_polarized",
    ],
  },

  progressive: {
    light_adaptive: [
      "standard_light_adaptive",
      "standard_light_adaptive_blue_light",
      "transitions_gen_s",
      "transitions_xtractive",
    ],

    sunglasses_tinted: [
      "sunglasses_tinted",
      "sunglasses_tinted_blue_light",
    ],

    sunglasses_polarized: [
      "sunglasses_solid_polarized",
      "sunglasses_mirror_polarized",
    ],
  },
} as const;

async function main() {
  console.log("Seeding lens technology-option mappings...");

  // Resolve all configured lens types.
  const lensTypeCodes = Object.keys(technologyOptionMappings);

  const lensTypes = await prisma.lensType.findMany({
    where: {
      code: {
        in: lensTypeCodes,
      },
    },
    select: {
      id: true,
      code: true,
    },
  });

  const lensTypeByCode = new Map(
    lensTypes.map((lensType) => [lensType.code, lensType]),
  );

  for (const lensTypeCode of lensTypeCodes) {
    if (!lensTypeByCode.has(lensTypeCode)) {
      throw new Error(`LensType not found: ${lensTypeCode}`);
    }
  }

  // Process every lens type -> lens option -> technology combination.
  for (const [lensTypeCode, optionMappings] of Object.entries(
    technologyOptionMappings,
  )) {
    const lensType = lensTypeByCode.get(lensTypeCode);

    if (!lensType) {
      throw new Error(`LensType not found: ${lensTypeCode}`);
    }

    for (const [optionCode, technologyCodes] of Object.entries(
      optionMappings,
    )) {
      const lensOption = await prisma.lensOption.findUnique({
        where: {
          code: optionCode,
        },
        select: {
          id: true,
          code: true,
        },
      });

      if (!lensOption) {
        throw new Error(`LensOption not found: ${optionCode}`);
      }

      // Fetch the technologies required by this configuration.
      const technologies = await prisma.lensTechnology.findMany({
        where: {
          code: {
            in: [...technologyCodes],
          },
        },
        select: {
          id: true,
          code: true,
        },
      });

      const technologyByCode = new Map(
        technologies.map((technology) => [
          technology.code,
          technology,
        ]),
      );

      // Validate all configured technologies before writing mappings.
      for (const technologyCode of technologyCodes) {
        if (!technologyByCode.has(technologyCode)) {
          throw new Error(
            `LensTechnology not found: ${technologyCode}`,
          );
        }
      }

      // Deactivate mappings that are no longer configured.
      await prisma.lensTechnologyOption.updateMany({
        where: {
          lensTypeId: lensType.id,
          lensOptionId: lensOption.id,
          lensTechnology: {
            code: {
              notIn: [...technologyCodes],
            },
          },
        },
        data: {
          active: false,
        },
      });

      // Create or reactivate the configured mappings.
      for (const technologyCode of technologyCodes) {
        const technology = technologyByCode.get(technologyCode);

        if (!technology) {
          throw new Error(
            `LensTechnology not found: ${technologyCode}`,
          );
        }

        await prisma.lensTechnologyOption.upsert({
          where: {
            lensTypeId_lensOptionId_lensTechnologyId: {
              lensTypeId: lensType.id,
              lensOptionId: lensOption.id,
              lensTechnologyId: technology.id,
            },
          },
          update: {
            active: true,
          },
          create: {
            lensTypeId: lensType.id,
            lensOptionId: lensOption.id,
            lensTechnologyId: technology.id,
            active: true,
          },
        });
      }

      console.log(
        `Mapped ${lensTypeCode} -> ${optionCode}: ${technologyCodes.length} technologies`,
      );
    }
  }

  const activeMappingCount = await prisma.lensTechnologyOption.count({
    where: {
      active: true,
      lensType: {
        code: {
          in: lensTypeCodes,
        },
      },
    },
  });

  console.log(
    `Seeding completed. Active mappings for configured lens types: ${activeMappingCount}`,
  );
}

main()
  .catch((error) => {
    console.error(
      "Lens technology-option seeding failed:",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });