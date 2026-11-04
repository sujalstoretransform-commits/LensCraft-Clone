/*
  Warnings:

  - A unique constraint covering the columns `[lensTypeId,lensOptionId,lensTechnologyId,lensIndexId]` on the table `LensIndexCompatibility` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "LensIndexCompatibility_lensTechnologyId_lensIndexId_key";

-- DropIndex
DROP INDEX "LensIndexCompatibility_lensTypeId_lensOptionId_lensIndexId_key";

-- CreateIndex
CREATE UNIQUE INDEX "LensIndexCompatibility_lensTypeId_lensOptionId_lensTechnolo_key" ON "LensIndexCompatibility"("lensTypeId", "lensOptionId", "lensTechnologyId", "lensIndexId");
