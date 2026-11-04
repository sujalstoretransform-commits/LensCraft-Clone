-- CreateTable
CREATE TABLE "priscriptionMethod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "priscriptionMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "priscriptionMethod_code_key" ON "priscriptionMethod"("code");

-- CreateIndex
CREATE INDEX "priscriptionMethod_active_sortOrder_idx" ON "priscriptionMethod"("active", "sortOrder");
