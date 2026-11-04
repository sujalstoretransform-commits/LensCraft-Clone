-- CreateTable
CREATE TABLE "LensTechnologyOption" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lensOptionId" TEXT NOT NULL,
    "lensTechnologyId" TEXT NOT NULL,

    CONSTRAINT "LensTechnologyOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LensTechnologyOption_lensOptionId_active_idx" ON "LensTechnologyOption"("lensOptionId", "active");

-- CreateIndex
CREATE INDEX "LensTechnologyOption_lensTechnologyId_active_idx" ON "LensTechnologyOption"("lensTechnologyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "LensTechnologyOption_lensOptionId_lensTechnologyId_key" ON "LensTechnologyOption"("lensOptionId", "lensTechnologyId");

-- AddForeignKey
ALTER TABLE "LensTechnologyOption" ADD CONSTRAINT "LensTechnologyOption_lensOptionId_fkey" FOREIGN KEY ("lensOptionId") REFERENCES "LensOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensTechnologyOption" ADD CONSTRAINT "LensTechnologyOption_lensTechnologyId_fkey" FOREIGN KEY ("lensTechnologyId") REFERENCES "LensTechnology"("id") ON DELETE CASCADE ON UPDATE CASCADE;
