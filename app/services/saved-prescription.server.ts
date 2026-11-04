import prisma from "../db.server";

export const getSavedPrescriptions = async ({
    shop,
    customerId,
}: {
    shop: string;
    customerId: string;
}) => {
    return prisma.savedPrescription.findMany({
        where: {
            shop,
            customerId,
        },
        orderBy: {
            updatedAt: "desc",
        },
        select: {
            id: true,
            name: true,

            rightSph: true,
            rightCyl: true,
            rightAxis: true,

            leftSph: true,
            leftCyl: true,
            leftAxis: true,

            pd: true,

            prescribedAt: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,

            fileKey: true,
            fileName: true,
            fileType: true,
            fileSize: true,
        },
    });
};

export const getSavedPrescriptionFile = async ({
    id,
    shop,
    customerId,
}: {
    id: string;
    shop: string;
    customerId: string;
}) => {
    return prisma.savedPrescription.findFirst({
        where: {
            id,
            shop,
            customerId,
        },
        select: {
            fileKey: true,
            fileName: true,
            fileType: true,
        },
    });
};


type InputPrescription = {
    shop: string;
    customerId: string;
    name: string;
    rightSph?: string | null;
    rightCyl?: string | null;
    rightAxis?: number | null;
    leftSph?: string | null;
    leftCyl?: string | null;
    leftAxis?: number | null;
    pd?: string | null;
    prescribedAt?: Date | null;
    expiresAt?: Date | null;
    fileKey?: string | null;
    fileName?: string | null;
    fileType?: string | null;
    fileSize?: number | null;
}

export const createSavedPrescription = async (input: InputPrescription) => {
    return prisma.savedPrescription.create({
        data: {
            shop: input.shop,
            customerId: input.customerId,
            name: input.name,
            rightSph: input.rightSph ?? null,
            rightCyl: input.rightCyl ?? null,
            rightAxis: input.rightAxis ?? null,
            leftSph: input.leftSph ?? null,
            leftCyl: input.leftCyl ?? null,
            leftAxis: input.leftAxis ?? null,
            pd: input.pd ?? null,
            prescribedAt: input.prescribedAt ?? null,
            expiresAt: input.expiresAt ?? null,
            fileKey: input.fileKey ?? null,
            fileName: input.fileName ?? null,
            fileType: input.fileType ?? null,
            fileSize: input.fileSize ?? null,
        },
        select: {
            id: true,
            name: true,
            rightSph: true,
            rightCyl: true,
            rightAxis: true,
            leftSph: true,
            leftCyl: true,
            leftAxis: true,
            pd: true,
            prescribedAt: true,
            expiresAt: true,
            createdAt: true,
            fileKey: true,
            fileName: true,
            fileType: true,
            fileSize: true,
        }
    })
}