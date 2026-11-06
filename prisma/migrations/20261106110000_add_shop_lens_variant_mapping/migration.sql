CREATE TABLE "ShopLensVariantMapping" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "lensPriceCode" TEXT NOT NULL,
    "productGid" TEXT NOT NULL,
    "variantGid" TEXT NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "syncedAmountMinor" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopLensVariantMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopLensVariantMapping_shop_lensPriceCode_key"
ON "ShopLensVariantMapping"("shop", "lensPriceCode");

CREATE UNIQUE INDEX "ShopLensVariantMapping_shop_variantGid_key"
ON "ShopLensVariantMapping"("shop", "variantGid");

CREATE INDEX "ShopLensVariantMapping_shop_productGid_idx"
ON "ShopLensVariantMapping"("shop", "productGid");
