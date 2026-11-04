-- CreateTable
CREATE TABLE "SavedPrescription" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rightSph" DECIMAL(5,2),
    "rightCyl" DECIMAL(5,2),
    "rightAxis" INTEGER,
    "leftSph" DECIMAL(5,2),
    "leftCyl" DECIMAL(5,2),
    "leftAxis" INTEGER,
    "pd" DECIMAL(5,2),
    "prescribedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPrescription_shop_customerId_idx" ON "SavedPrescription"("shop", "customerId");

-- CreateIndex
CREATE INDEX "SavedPrescription_shop_customerId_updatedAt_idx" ON "SavedPrescription"("shop", "customerId", "updatedAt");
