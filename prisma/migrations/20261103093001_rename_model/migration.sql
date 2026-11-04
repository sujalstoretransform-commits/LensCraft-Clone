/*
  Warnings:

  - You are about to drop the `priscriptionMethod` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "priscriptionMethod";

-- CreateTable
CREATE TABLE "prescriptionMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prescriptionMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prescriptionMethod_code_key" ON "prescriptionMethod"("code");

-- CreateIndex
CREATE INDEX "prescriptionMethod_active_sortOrder_idx" ON "prescriptionMethod"("active", "sortOrder");
