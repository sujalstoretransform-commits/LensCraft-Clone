-- AlterTable
ALTER TABLE "LensPrice" ADD COLUMN     "lensTechnologyId" TEXT;

-- AddForeignKey
ALTER TABLE "LensPrice" ADD CONSTRAINT "LensPrice_lensTechnologyId_fkey" FOREIGN KEY ("lensTechnologyId") REFERENCES "LensTechnology"("id") ON DELETE CASCADE ON UPDATE CASCADE;
