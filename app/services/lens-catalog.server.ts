import prisma from "../db.server";
import type { PrescriptionMethodCode } from "../components/PrescriptionSelection";

const priceFields = {
    code: true,
    kind: true,
    amountMinor: true,
    currencyCode: true,
};

const getLensTypes = (currencyCode: string) => {
    return prisma.lensType.findMany({
        where: { active: true },
        select: {
            code: true,
            name: true,
            family: true,
            description: true,
            prices: {
                where: { active: true, currencyCode },
                select: { ...priceFields, lensIndex: { select: { code: true } } },
            },
        },
    });
}

const getLensIndices = (currencyCode: string) => {
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

            prices: {
                where: {
                    active: true,
                    currencyCode: currencyCode,
                },
                select: {
                    code: true,
                    kind: true,
                    amountMinor: true,
                    currencyCode: true,
                    lensType: {
                        select: { code: true }
                    }
                },
                orderBy: { amountMinor: "asc" }
            }
        },
        orderBy: { refractiveIndex: "asc" }
    });
}

const getLensOptions = (currencyCode: string) => {
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
            prices: {
                where: {
                    active: true,
                    currencyCode,
                },
                select: priceFields,
            },
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
                            lensPrices: {
                                where: {
                                    active: true,
                                    currencyCode,
                                },
                                select: priceFields,
                            },
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
            lensPrices: {
                where: { active: true, },
                select: priceFields,
            },
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


export const loadLensCatalog = async (currencyCode: string) => {
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
        getLensTypes(currencyCode),
        getLensIndices(currencyCode),
        getLensOptions(currencyCode),
        getRules(),
        getLensIndexCompatibilities(),
        getLensTechnologies(),
        getLensTechnologyIndexCompatibility(),
        getPrescriptionMethods(),
    ]);

    return {
        lensTypes,
        lensIndices,
        lensOptions,
        rules,
        lensIndexCompatibilities,
        lensTechnologies,
        lensTechnologyIndexCompatibility,
        prescriptionMethods,
    };
}
