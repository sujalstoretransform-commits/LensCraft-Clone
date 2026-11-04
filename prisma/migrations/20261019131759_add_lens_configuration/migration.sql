-- CreateTable
CREATE TABLE "LensConfiguration" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "lensType" TEXT NOT NULL,
    "lensIndex" TEXT NOT NULL,
    "prescriptionMethod" TEXT NOT NULL,
    "prescription" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LensConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LensConfiguration_shop_createdAt_idx" ON "LensConfiguration"("shop", "createdAt");
