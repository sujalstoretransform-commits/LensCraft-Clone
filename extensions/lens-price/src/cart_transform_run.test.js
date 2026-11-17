import { describe, expect, it } from "vitest";
import { cartTransformRun } from "./cart_transform_run.js";

const makeLine = ({ id, parent = false, details, group = "group-1", quantity = 1 }) => ({
  id,
  quantity,
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
    });

  });

  it("does not merge groups without a marked parent frame", () => {
    const result = cartTransformRun({
      cart: { lines: [makeLine({ id: "lens-a" }), makeLine({ id: "lens-b" })] },
    });
    expect(result.operations).toEqual([]);
  });

  it("removing a parent frame zeroes out its entire group but leaves other groups intact", () => {
    const result = cartTransformRun({
      cart: {
        lines: [
          makeLine({ id: "parent1", parent: true, group: "group-1", quantity: 0, details: JSON.stringify({ Lens: "A" }) }),
          makeLine({ id: "upgrade1", group: "group-1" }),
          makeLine({ id: "parent2", parent: true, group: "group-2", quantity: 1, details: JSON.stringify({ Lens: "B" }) }),
          makeLine({ id: "upgrade2", group: "group-2" }),
        ],
      },
    });
    expect(result.operations).toHaveLength(2);
    const op1 = result.operations.find(o => o.linesMerge.parentVariantId.includes("parent1"));
    const op2 = result.operations.find(o => o.linesMerge.parentVariantId.includes("parent2"));
    expect(op1.linesMerge.cartLines).toEqual([
      { cartLineId: "parent1", quantity: 0 },
      { cartLineId: "upgrade1", quantity: 0 },
    ]);
    expect(op2.linesMerge.cartLines).toEqual([
      { cartLineId: "parent2", quantity: 1 },
      { cartLineId: "upgrade2", quantity: 1 },
    ]);
  });

  it("removing a single upgrade preserves the parent quantity for the rest of the group", () => {
    const result = cartTransformRun({
      cart: {
        lines: [
          makeLine({ id: "parent", parent: true, quantity: 2, details: JSON.stringify({ Lens: "C" }) }),
          makeLine({ id: "upgradeA", quantity: 0 }),
          makeLine({ id: "upgradeB", quantity: 1 }),
        ],
      },
    });
    expect(result.operations).toHaveLength(1);
    const op = result.operations[0].linesMerge;
    expect(op.cartLines).toEqual([
      { cartLineId: "parent", quantity: 2 },
      { cartLineId: "upgradeA", quantity: 0 },
      { cartLineId: "upgradeB", quantity: 2 },
    ]);
  });
});
