/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `SavedPrescription` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SavedPrescription" DROP COLUMN "fileUrl",
ADD COLUMN     "fileKey" TEXT;
