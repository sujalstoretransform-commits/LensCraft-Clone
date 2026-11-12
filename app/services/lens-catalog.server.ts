import prisma from "../db.server";
import type { PrescriptionMethodCode } from "../components/PrescriptionSelection";

export const LENS_CURRENCY_CODE = "USD";

type CatalogPrice = {
    code: string;
    kind: string;
    amountMinor: number;
    currencyCode: string;
    lensIndex?: { code: string } | null;
    lensType?: { code: string } | null;
};

const getLensTypes = () => {
    return prisma.lensType.findMany({
        where: { active: true },
        select: {
            code: true,
            name: true,
            family: true,
            description: true,
        },
    });
}

const getLensIndices = () => {
    return prisma.lensIndex.findMany({
        where: { active: true },
        select: {
            code: true,
            displayName: true,
            refractiveIndex: true,

            supplierMappings: {
                where: { active: true },
                select: {
                    lensType: {
                        select: {
                            code: true
                        }
                    }
                }
            },

        },
        orderBy: { refractiveIndex: "asc" }
    });
}

const getLensOptions = () => {
    return prisma.lensOption.findMany({
        where: {
            active: true,
            category: {
                in: ["add_on", "lens_type"]
            }
        },
        select: {
            code: true,
            name: true,
            category: true,
            description: true,
            rules: {
                where: {
                    active: true,
                },
                select: {
                    code: true,
                    kind: true,
                    message: true,
                },
            },
            lensTechnologyOptions: {
                where: {
                    active: true,
                    lensTechnology: {
                        active: true,
                    }
                },
                select: {
                    lensType: {
                        select: {
                            code: true,
                        },
                    },
                    lensTechnology: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            description: true,
                            sortOrder: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            name: "asc",
        },
    });
};

const getRules = () => {
    return prisma.lensCompatibilityRule.findMany({
        where: { active: true },
        select: {
            code: true,
            kind: true,
            lensType: { select: { code: true } },
            lensIndex: { select: { code: true } },
            lensOption: { select: { code: true } },
            relatedOptionCode: true,
            limitValue: true,
            minimumFrameHeightMm: true,
            message: true,
        },
    });
}

const getLensIndexCompatibilities = () => {
    return prisma.lensIndexCompatibility.findMany({
        where: {
            active: true,
            lensTechnologyId: null,
            lensType: { active: true },
            lensOption: { active: true },
            lensIndex: { active: true },
        },
        select: {
            lensType: { select: { code: true } },
            lensOption: { select: { code: true } },
            lensIndex: { select: { code: true } },
        },
    });
}

const getLensTechnologyIndexCompatibility = () => {
    return prisma.lensIndexCompatibility.findMany({
        where: {
            active: true,
            lensTechnologyId: { not: null },
            lensType: { active: true },
            lensOption: { active: true },
            lensTechnology: { active: true },
            lensIndex: { active: true },
        },
        select: {
            lensIndex: { select: { code: true } },
            lensTechnology: { select: { code: true } },
            lensType: { select: { code: true } },
            lensOption: { select: { code: true } },
        },
    });
}

const getLensTechnologies = () => {
    return prisma.lensTechnology.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
            id: true,
            code: true,
            name: true,
            description: true,
            sortOrder: true,
        },
    });
}

const isPrescriptionMethodCode = (
    code: string,
): code is PrescriptionMethodCode => {
    return ["manual", "upload", "saved", "later"].includes(code);
};

const getPrescriptionMethods = async () => {
    const prescriptionMethods = await prisma.prescriptionMethod.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: {
            code: true,
            name: true,
            description: true,
        }
    });

    return prescriptionMethods.filter(
        (method): method is typeof method & { code: PrescriptionMethodCode } =>
            isPrescriptionMethodCode(method.code),
    );
}


export const loadLensCatalog = async (currencyCode = LENS_CURRENCY_CODE) => {
    const targetCurrencyCode = currencyCode.toUpperCase();
    const [
        lensTypes,
        lensIndices,
        lensOptions,
        rules,
        lensIndexCompatibilities,
        lensTechnologies,
        lensTechnologyIndexCompatibility,
        prescriptionMethods,
    ] = await Promise.all([
        getLensTypes(),
        getLensIndices(),
        getLensOptions(),
        getRules(),
        getLensIndexCompatibilities(),
        getLensTechnologies(),
        getLensTechnologyIndexCompatibility(),
        getPrescriptionMethods(),
    ]);

    return {
        currencyCode: targetCurrencyCode,
        pricingAvailable: true,
        lensTypes: lensTypes.map((lensType) => ({
            ...lensType,
            prices: [] as CatalogPrice[],
        })),
        lensIndices: lensIndices.map((lensIndex) => ({
            ...lensIndex,
            prices: [] as CatalogPrice[],
        })),
        lensOptions: lensOptions.map((lensOption) => ({
            ...lensOption,
            prices: [] as CatalogPrice[],
            lensTechnologyOptions: lensOption.lensTechnologyOptions.map(
                (mapping) => ({
                    ...mapping,
                    lensTechnology: {
                        ...mapping.lensTechnology,
                        lensPrices: [] as CatalogPrice[],
                    },
                }),
            ),
        })),
        rules,
        lensIndexCompatibilities,
        lensTechnologies: lensTechnologies.map((technology) => ({
            ...technology,
            lensPrices: [] as CatalogPrice[],
        })),
        lensTechnologyIndexCompatibility,
        prescriptionMethods,
    };
}
