const PLACEMENT_LABELS: Record<string, string> = {
  cart: "Cart drawer",
  product_page: "Product page (FBT)",
  checkout: "Checkout",
  post_purchase: "Post-purchase",
  thank_you: "Thank you page",
};

export function formatPlacementLabel(type: string): string {
  return PLACEMENT_LABELS[type] ?? type.replace(/_/g, " ");
}

export function formatDiscount(
  discountType: string,
  discountValue: number,
): string {
  if (discountType === "percentage") {
    return `${discountValue}%`;
  }
  return `$${discountValue}`;
}
