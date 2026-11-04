/*
  Warnings:

  - A unique constraint covering the columns `[lensTechnologyId,lensIndexId]` on the table `LensIndexCompatibility` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "LensTechnologyIndexCompatibility" DROP CONSTRAINT "LensTechnologyIndexCompatibility_lensIndexId_fkey";

-- DropForeignKey
ALTER TABLE "LensTechnologyIndexCompatibility" DROP CONSTRAINT "LensTechnologyIndexCompatibility_lensTechnologyId_fkey";

-- AlterTable
ALTER TABLE "LensIndexCompatibility" ADD COLUMN     "lensTechnologyId" TEXT,
ALTER COLUMN "lensTypeId" DROP NOT NULL,
ALTER COLUMN "lensOptionId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "LensIndexCompatibility_lensTechnologyId_active_idx" ON "LensIndexCompatibility"("lensTechnologyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LensIndexCompatibility_lensTechnologyId_lensIndexId_key" ON "LensIndexCompatibility"("lensTechnologyId", "lensIndexId");

-- Preserve the technology/index compatibility rows in the unified table.
INSERT INTO "LensIndexCompatibility" (
    "id",
    "active",
    "lensTechnologyId",
    "lensIndexId",
    "createdAt",
    "updatedAt"
)
SELECT
    'techcompat-' || "id",
    "active",
    "lensTechnologyId",
    "lensIndexId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "LensTechnologyIndexCompatibility";

-- Drop the old table after its data has been copied.
DROP TABLE "LensTechnologyIndexCompatibility";

-- AddForeignKey
ALTER TABLE "LensIndexCompatibility" ADD CONSTRAINT "LensIndexCompatibility_lensTechnologyId_fkey" FOREIGN KEY ("lensTechnologyId") REFERENCES "LensTechnology"("id") ON DELETE CASCADE ON UPDATE CASCADE;
