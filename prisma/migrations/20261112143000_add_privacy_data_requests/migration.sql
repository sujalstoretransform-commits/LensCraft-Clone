CREATE TABLE "PrivacyDataRequest" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilledAt" TIMESTAMP(3),
    CONSTRAINT "PrivacyDataRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyDataRequest_shop_requestId_key" ON "PrivacyDataRequest"("shop", "requestId");
CREATE INDEX "PrivacyDataRequest_shop_fulfilledAt_requestedAt_idx" ON "PrivacyDataRequest"("shop", "fulfilledAt", "requestedAt");
