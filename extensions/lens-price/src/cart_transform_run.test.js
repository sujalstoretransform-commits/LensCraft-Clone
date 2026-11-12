import { describe, expect, it } from "vitest";
import { cartTransformRun } from "./cart_transform_run.js";

const makeLine = ({ id, parent = false, details, group = "group-1" }) => ({
  id,
  quantity: 1,
  lensGroup: { value: group },
  lensParent: { value: parent ? "true" : "false" },
  lensDetails: { value: details },
  merchandise: { __typename: "ProductVariant", id: `gid://shopify/ProductVariant/${id}` },
});

describe("cartTransformRun", () => {
  it("merges the frame and its paid lens lines into one parent line with lens details", () => {
    const result = cartTransformRun({
      cart: {
        lines: [
          makeLine({ id: "frame", parent: true, details: JSON.stringify({ Lens: "Single Vision" }) }),
          makeLine({ id: "lens-type" }),
          makeLine({ id: "index" }),
          makeLine({ id: "unrelated", group: "another-group" }),
        ],
      },
    });

    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].linesMerge).toMatchObject({
      parentVariantId: "gid://shopify/ProductVariant/frame",
      cartLines: [
        { cartLineId: "frame", quantity: 1 },
        { cartLineId: "lens-type", quantity: 1 },
        { cartLineId: "index", quantity: 1 },
      ],
      attributes: [{ key: "Lens", value: "Single Vision" }],
    });
  });

  it("does not merge groups without a marked parent frame", () => {
    const result = cartTransformRun({
      cart: { lines: [makeLine({ id: "lens-a" }), makeLine({ id: "lens-b" })] },
    });

    expect(result.operations).toEqual([]);
  });
});
