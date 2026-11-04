import prisma from "../db.server";

export async function getCompatibleLensIndices(
    lensTypeCode: string,
    lensOptionCode: string,
) {
    const compatibilities = await prisma.lensIndexCompatibility.findMany({
        where: {
            active: true,
            lensType: {
                code: lensTypeCode,
                active: true,
            },
            lensOption: {
                code: lensOptionCode,
                active: true,
            },
            lensIndex: {
                active: true,
            },
        },
        select: {
            lensIndex: {
                select: {
                    code: true,
                    displayName: true,
                    refractiveIndex: true,
                },
            },
        },
        orderBy: {
            lensIndex: {
                refractiveIndex: "asc",
            },
        },
    });

    return compatibilities.map(({ lensIndex }) => ({
        code: lensIndex.code,
        displayName: lensIndex.displayName,
        refractiveIndex: Number(lensIndex.refractiveIndex),
    }));
}