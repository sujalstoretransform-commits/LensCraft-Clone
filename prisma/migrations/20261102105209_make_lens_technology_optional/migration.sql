/*
  Warnings:

  - Made the column `lensTypeId` on table `LensIndexCompatibility` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lensOptionId` on table `LensIndexCompatibility` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "LensIndexCompatibility" ALTER COLUMN "lensTypeId" SET NOT NULL,
ALTER COLUMN "lensOptionId" SET NOT NULL;
