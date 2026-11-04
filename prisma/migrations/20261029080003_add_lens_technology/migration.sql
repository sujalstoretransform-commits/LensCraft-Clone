-- CreateEnum
CREATE TYPE "LensTechnologyColor" AS ENUM ('GREY', 'AMBER');

-- CreateTable
CREATE TABLE "LensTechnology" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensTechnology_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LensTechnology_code_key" ON "LensTechnology"("code");

-- CreateIndex
CREATE INDEX "LensTechnology_active_sortOrder_idx" ON "LensTechnology"("active", "sortOrder");
