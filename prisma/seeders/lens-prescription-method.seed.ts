import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const prescriptionMethods = [
    {
        code: "manual",
        name: "Fill it out myself",
        description:
            "Type the numbers from your prescription. About a minute.",
        sortOrder: 1,
    },
    {
        code: "upload",
        name: "Upload a photo or PDF",
        description: "Snap a picture — we'll enter it for you.",
        sortOrder: 2,
    },
    {
        code: "saved",
        name: "Use a saved prescription",
        description: "From your last order.",
        sortOrder: 3,
    },
    {
        code: "later",
        name: "Send it later",
        description: "Order now, send it within 14 days.",
        sortOrder: 4,
    },
];

for (const method of prescriptionMethods) {
    await prisma.prescriptionMethod.upsert({
        where: { code: method.code },
        update: {
            name: method.name,
            description: method.description,
            sortOrder: method.sortOrder,
            active: true,
        },
        create: method,
    });
}