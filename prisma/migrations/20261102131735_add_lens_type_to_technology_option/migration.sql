/*
  Warnings:

  - Added the required column `lensTypeId` to the `LensTechnologyOption` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "LensTechnologyOption" ADD COLUMN     "lensTypeId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "LensTechnologyOption" ADD CONSTRAINT "LensTechnologyOption_lensTypeId_fkey" FOREIGN KEY ("lensTypeId") REFERENCES "LensType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
