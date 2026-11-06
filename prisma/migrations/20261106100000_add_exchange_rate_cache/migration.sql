CREATE TABLE "ExchangeRateCache" (
    "currencyCode" VARCHAR(3) NOT NULL,
    "usdRate" DECIMAL(30,18) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "providerTimestamp" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExchangeRateCache_pkey" PRIMARY KEY ("currencyCode")
);
