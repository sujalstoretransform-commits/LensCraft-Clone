-- CreateTable
CREATE TABLE "LensTechnologyIndexCompatibility" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lensTechnologyId" TEXT NOT NULL,
    "lensIndexId" TEXT NOT NULL,

    CONSTRAINT "LensTechnologyIndexCompatibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LensTechnologyIndexCompatibility_lensTechnologyId_lensIndex_key" ON "LensTechnologyIndexCompatibility"("lensTechnologyId", "lensIndexId");

-- AddForeignKey
ALTER TABLE "LensTechnologyIndexCompatibility" ADD CONSTRAINT "LensTechnologyIndexCompatibility_lensTechnologyId_fkey" FOREIGN KEY ("lensTechnologyId") REFERENCES "LensTechnology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensTechnologyIndexCompatibility" ADD CONSTRAINT "LensTechnologyIndexCompatibility_lensIndexId_fkey" FOREIGN KEY ("lensIndexId") REFERENCES "LensIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;
