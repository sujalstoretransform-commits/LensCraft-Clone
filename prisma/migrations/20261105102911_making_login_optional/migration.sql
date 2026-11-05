-- AlterTable
ALTER TABLE "SavedPrescription" ADD COLUMN     "guestExpiresAt" TIMESTAMP(3),
ADD COLUMN     "guestToken" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "SavedPrescription_shop_guestToken_idx" ON "SavedPrescription"("shop", "guestToken");

-- CreateIndex
CREATE INDEX "SavedPrescription_guestExpiresAt_idx" ON "SavedPrescription"("guestExpiresAt");
