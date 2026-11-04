/*
  Warnings:

  - A unique constraint covering the columns `[lensTypeId,lensOptionId,lensTechnologyId]` on the table `LensTechnologyOption` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LensTechnologyOption_lensOptionId_active_idx";

-- DropIndex
DROP INDEX "LensTechnologyOption_lensOptionId_lensTechnologyId_key";

-- CreateIndex
CREATE INDEX "LensTechnologyOption_lensTypeId_lensOptionId_active_idx" ON "LensTechnologyOption"("lensTypeId", "lensOptionId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LensTechnologyOption_lensTypeId_lensOptionId_lensTechnology_key" ON "LensTechnologyOption"("lensTypeId", "lensOptionId", "lensTechnologyId");
