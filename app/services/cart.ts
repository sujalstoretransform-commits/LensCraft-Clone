export type AddToCartInput = {
    variantId: string;
    quantity?: number;
    properties?: Record<string, string>;
};

export default function addFrameToCart(input: AddToCartInput) {

    if (!input.variantId) {
        throw new Error("Please select a frame variant.");
    }

    return {
        variantId: input.variantId,
        quantity: input.quantity ?? 1,
        properties: input.properties ?? {}
    }
}
