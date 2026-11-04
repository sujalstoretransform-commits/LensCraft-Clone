-- CreateTable
CREATE TABLE "LensIndexCompatibility" (
    "id" TEXT NOT NULL,
    "lensTypeId" TEXT NOT NULL,
    "lensOptionId" TEXT NOT NULL,
    "lensIndexId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensIndexCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LensIndexCompatibility_lensTypeId_lensOptionId_active_idx" ON "LensIndexCompatibility"("lensTypeId", "lensOptionId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LensIndexCompatibility_lensTypeId_lensOptionId_lensIndexId_key" ON "LensIndexCompatibility"("lensTypeId", "lensOptionId", "lensIndexId");

-- AddForeignKey
ALTER TABLE "LensIndexCompatibility" ADD CONSTRAINT "LensIndexCompatibility_lensTypeId_fkey" FOREIGN KEY ("lensTypeId") REFERENCES "LensType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensIndexCompatibility" ADD CONSTRAINT "LensIndexCompatibility_lensOptionId_fkey" FOREIGN KEY ("lensOptionId") REFERENCES "LensOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensIndexCompatibility" ADD CONSTRAINT "LensIndexCompatibility_lensIndexId_fkey" FOREIGN KEY ("lensIndexId") REFERENCES "LensIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
