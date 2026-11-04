-- CreateEnum
CREATE TYPE "LensOptionCategory" AS ENUM ('progressive_design', 'bifocal_design', 'coating', 'add_on');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LensRuleKind" ADD VALUE 'minimum_sph';
ALTER TYPE "LensRuleKind" ADD VALUE 'minimum_cyl';
ALTER TYPE "LensRuleKind" ADD VALUE 'minimum_add';

-- DropIndex
DROP INDEX "LensCompatibilityRule_lensTypeId_lensIndexId_active_idx";

-- AlterTable
ALTER TABLE "LensCompatibilityRule" ADD COLUMN     "lensOptionId" TEXT;

-- AlterTable
ALTER TABLE "LensPrice" ADD COLUMN     "lensOptionId" TEXT;

-- CreateTable
CREATE TABLE "LensOption" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "LensOptionCategory" NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LensOption_code_key" ON "LensOption"("code");

-- CreateIndex
CREATE INDEX "LensOption_category_active_idx" ON "LensOption"("category", "active");

-- CreateIndex
CREATE INDEX "LensCompatibilityRule_lensTypeId_lensIndexId_lensOptionId_a_idx" ON "LensCompatibilityRule"("lensTypeId", "lensIndexId", "lensOptionId", "active");

-- CreateIndex
CREATE INDEX "LensPrice_lensOptionId_currencyCode_active_idx" ON "LensPrice"("lensOptionId", "currencyCode", "active");

-- AddForeignKey
ALTER TABLE "LensPrice" ADD CONSTRAINT "LensPrice_lensOptionId_fkey" FOREIGN KEY ("lensOptionId") REFERENCES "LensOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensCompatibilityRule" ADD CONSTRAINT "LensCompatibilityRule_lensOptionId_fkey" FOREIGN KEY ("lensOptionId") REFERENCES "LensOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
