-- CreateEnum
CREATE TYPE "LensFamily" AS ENUM ('clear', 'blue_light', 'light_adaptive', 'tinted', 'polarized', 'readers', 'non_prescription');

-- CreateEnum
CREATE TYPE "LensPriceKind" AS ENUM ('base', 'upgrade', 'add_on');

-- CreateEnum
CREATE TYPE "LensRuleKind" AS ENUM ('requires_option', 'incompatible_option', 'minimum_frame_height', 'maximum_sph', 'maximum_cyl', 'maximum_add');

-- CreateTable
CREATE TABLE "LensType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "LensFamily" NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LensIndex" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "refractiveIndex" DECIMAL(3,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LensPrice" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "LensPriceKind" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "lensTypeId" TEXT,
    "lensIndexId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LensCompatibilityRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "LensRuleKind" NOT NULL,
    "lensTypeId" TEXT,
    "lensIndexId" TEXT,
    "relatedOptionCode" TEXT,
    "limitValue" DECIMAL(6,2),
    "minimumFrameHeightMm" INTEGER,
    "message" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensCompatibilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierLensMapping" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "supplierSku" TEXT NOT NULL,
    "supplierSpecification" TEXT,
    "lensTypeId" TEXT NOT NULL,
    "lensIndexId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierLensMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LensType_code_key" ON "LensType"("code");

-- CreateIndex
CREATE INDEX "LensType_family_active_idx" ON "LensType"("family", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LensIndex_code_key" ON "LensIndex"("code");

-- CreateIndex
CREATE INDEX "LensIndex_active_idx" ON "LensIndex"("active");

-- CreateIndex
CREATE UNIQUE INDEX "LensPrice_code_key" ON "LensPrice"("code");

-- CreateIndex
CREATE INDEX "LensPrice_active_kind_idx" ON "LensPrice"("active", "kind");

-- CreateIndex
CREATE INDEX "LensPrice_lensTypeId_lensIndexId_currencyCode_active_idx" ON "LensPrice"("lensTypeId", "lensIndexId", "currencyCode", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LensCompatibilityRule_code_key" ON "LensCompatibilityRule"("code");

-- CreateIndex
CREATE INDEX "LensCompatibilityRule_active_kind_idx" ON "LensCompatibilityRule"("active", "kind");

-- CreateIndex
CREATE INDEX "LensCompatibilityRule_lensTypeId_lensIndexId_active_idx" ON "LensCompatibilityRule"("lensTypeId", "lensIndexId", "active");

-- CreateIndex
CREATE INDEX "SupplierLensMapping_lensTypeId_lensIndexId_active_idx" ON "SupplierLensMapping"("lensTypeId", "lensIndexId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLensMapping_supplier_supplierSku_key" ON "SupplierLensMapping"("supplier", "supplierSku");

-- AddForeignKey
ALTER TABLE "LensPrice" ADD CONSTRAINT "LensPrice_lensTypeId_fkey" FOREIGN KEY ("lensTypeId") REFERENCES "LensType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensPrice" ADD CONSTRAINT "LensPrice_lensIndexId_fkey" FOREIGN KEY ("lensIndexId") REFERENCES "LensIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensCompatibilityRule" ADD CONSTRAINT "LensCompatibilityRule_lensTypeId_fkey" FOREIGN KEY ("lensTypeId") REFERENCES "LensType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensCompatibilityRule" ADD CONSTRAINT "LensCompatibilityRule_lensIndexId_fkey" FOREIGN KEY ("lensIndexId") REFERENCES "LensIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLensMapping" ADD CONSTRAINT "SupplierLensMapping_lensTypeId_fkey" FOREIGN KEY ("lensTypeId") REFERENCES "LensType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierLensMapping" ADD CONSTRAINT "SupplierLensMapping_lensIndexId_fkey" FOREIGN KEY ("lensIndexId") REFERENCES "LensIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
