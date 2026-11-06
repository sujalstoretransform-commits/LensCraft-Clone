import { beforeEach, describe, expect, it, vi } from "vitest";

const { mappings } = vi.hoisted(() => ({
  mappings: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("app/db.server", () => ({
  default: { shopLensVariantMapping: mappings },
}));

import type { loadLensCatalog } from "./lens-catalog.server";
import { syncShopLensPricing } from "./shopify-lens-pricing.server";

type Catalog = Awaited<ReturnType<typeof loadLensCatalog>>;
type GraphqlResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

const catalog: Catalog = {
  currencyCode: "INR",
  pricingAvailable: true,
  lensTypes: [
    {
      code: "single-vision",
      name: "Single vision",
      family: "clear",
      description: null,
      prices: [
        {
          code: "lens-base",
          kind: "base",
          amountMinor: 100,
          currencyCode: "INR",
          lensIndex: null,
        },
      ],
    },
  ],
  lensIndices: [],
  lensOptions: [],
  lensTechnologies: [],
  rules: [],
  lensIndexCompatibilities: [],
  lensTechnologyIndexCompatibility: [],
  prescriptionMethods: [],
};

function createAdmin(
  variants = [
    {
      id: "gid://shopify/ProductVariant/123",
      sku: "lens-base",
      price: "1.00",
    },
  ],
  productGid = "gid://shopify/Product/456",
  updateErrors: { field: string[] | null; message: string }[] = [],
) {
  const graphql = vi.fn(
    async (query: string): Promise<GraphqlResponse> => {
      if (query.includes("query LensUpgradeProductVariants")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              productByIdentifier: {
                id: productGid,
                variants: {
                  nodes: variants,
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          }),
        };
      }

      const { id, price } = { id: variants[0].id, price: "1.00" };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            productVariantsBulkUpdate: {
              productVariants: [{ id, price }],
              userErrors: updateErrors,
            },
          },
        }),
      };
    },
  );
  return { graphql };
}

describe("Shopify lens variant synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mappings.findMany.mockResolvedValue([]);
    mappings.upsert.mockResolvedValue({});
  });

  it("keeps duplicate synchronization calls idempotent", async () => {
    mappings.findMany.mockResolvedValue([
      {
        lensPriceCode: "lens-base",
        productGid: "gid://shopify/Product/456",
        variantGid: "gid://shopify/ProductVariant/123",
        currencyCode: "INR",
        syncedAmountMinor: 100,
      },
    ]);
    const admin = createAdmin();

    const first = await syncShopLensPricing(
      admin,
      "one.myshopify.com",
      "INR",
      catalog,
    );
    const second = await syncShopLensPricing(
      admin,
      "one.myshopify.com",
      "INR",
      catalog,
    );

    expect(first).toEqual({ "lens-base": "123" });
    expect(second).toEqual(first);
    expect(admin.graphql).toHaveBeenCalledTimes(2);
    expect(mappings.upsert).not.toHaveBeenCalled();
  });

  it("keeps database mappings isolated by authenticated shop", async () => {
    const admin = createAdmin();

    await syncShopLensPricing(admin, "one.myshopify.com", "INR", catalog);
    await syncShopLensPricing(admin, "two.myshopify.com", "INR", catalog);

    expect(mappings.findMany).toHaveBeenNthCalledWith(1, {
      where: { shop: "one.myshopify.com", productGid: "gid://shopify/Product/456" },
    });
    expect(mappings.findMany).toHaveBeenNthCalledWith(2, {
      where: { shop: "two.myshopify.com", productGid: "gid://shopify/Product/456" },
    });
    expect(mappings.upsert).toHaveBeenCalledTimes(2);
    expect(mappings.upsert.mock.calls.map(([call]) => call.where.shop_lensPriceCode.shop))
      .toEqual(["one.myshopify.com", "two.myshopify.com"]);
  });

  it("fails closed when the product has no stable master-price variant mapping", async () => {
    const admin = createAdmin([
      {
        id: "gid://shopify/ProductVariant/123",
        sku: "other-sku",
        price: "1.00",
      },
    ]);

    await expect(
      syncShopLensPricing(admin, "one.myshopify.com", "INR", catalog),
    ).rejects.toThrow("stable master-price SKU mappings");
    expect(mappings.upsert).not.toHaveBeenCalled();
    expect(admin.graphql).toHaveBeenCalledTimes(1);
  });

  it("does not require a cart variant for a zero-priced component", async () => {
    const catalogWithFreeAddon: Catalog = {
      ...catalog,
      lensOptions: [
        {
          code: "included-addon",
          name: "Included add-on",
          category: "add_on",
          description: null,
          prices: [
            {
              code: "free-addon",
              kind: "add_on",
              amountMinor: 0,
              currencyCode: "INR",
            },
          ],
          rules: [],
          lensTechnologyOptions: [],
        },
      ],
    };

    await expect(
      syncShopLensPricing(
        createAdmin(),
        "one.myshopify.com",
        "INR",
        catalogWithFreeAddon,
      ),
    ).resolves.toEqual({ "lens-base": "123" });
  });

  it("does not report readiness when Shopify rejects a price update", async () => {
    const admin = createAdmin(
      [
        {
          id: "gid://shopify/ProductVariant/123",
          sku: "lens-base",
          price: "1.01",
        },
      ],
      "gid://shopify/Product/456",
      [{ field: ["variants"], message: "Price update rejected" }],
    );

    await expect(
      syncShopLensPricing(admin, "one.myshopify.com", "INR", catalog),
    ).rejects.toThrow("could not synchronize");
    expect(mappings.upsert).not.toHaveBeenCalled();
  });
});
