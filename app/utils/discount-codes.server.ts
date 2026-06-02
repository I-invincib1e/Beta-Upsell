type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export function buildOfferDiscountCode(offerId: string): string {
  return `BETAUP-${offerId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

/**
 * Creates or updates a single-use-style basic discount code for checkout/cart/thank-you flows.
 * Post-purchase continues to apply discounts via changesets.
 */
export async function syncOfferDiscountCode(
  admin: AdminClient,
  offer: {
    id: string;
    name: string;
    discountType: string;
    discountValue: number;
    upsellProductIds: string[];
    discountCode?: string | null;
  },
): Promise<string> {
  const code = offer.discountCode || buildOfferDiscountCode(offer.id);

  const shopRes = await admin.graphql(`{
    shop { currencyCode }
  }`);
  const shopJson = await shopRes.json();
  const currencyCode = shopJson.data?.shop?.currencyCode || "USD";

  const productGids = offer.upsellProductIds.map((id) =>
    id.includes("gid://") ? id : `gid://shopify/Product/${id.split("/").pop()}`,
  );

  const customerGetsValue =
    offer.discountType === "percentage"
      ? { percentage: offer.discountValue / 100 }
      : {
          discountAmount: {
            amount: String(offer.discountValue),
            appliesOnEachItem: false,
          },
        };

  const basicCodeDiscount = {
    title: `Upsell: ${offer.name}`.slice(0, 100),
    code,
    startsAt: new Date().toISOString(),
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: true,
      shippingDiscounts: false,
    },
    customerSelection: { all: true },
    customerGets: {
      value: customerGetsValue,
      items: productGids.length
        ? { products: { productsToAdd: productGids } }
        : { all: true },
    },
  };

  const createMutation = `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message code }
      }
    }
  `;

  const createRes = await admin.graphql(createMutation, {
    variables: { basicCodeDiscount },
  });
  const createJson = await createRes.json();
  const createErrors = createJson.data?.discountCodeBasicCreate?.userErrors || [];

  if (createErrors.length === 0) {
    return code;
  }

  const alreadyExists = createErrors.some(
    (e: { message?: string; code?: string }) =>
      e.message?.toLowerCase().includes("taken") ||
      e.message?.toLowerCase().includes("already") ||
      e.code === "TAKEN",
  );

  if (alreadyExists) {
    return code;
  }

  console.error("syncOfferDiscountCode userErrors:", createErrors);
  return code;
}

export function computeDiscountedPrice(
  originalPrice: number,
  discountType: string,
  discountValue: number,
): number {
  if (discountType === "percentage") {
    return Math.max(0, originalPrice * (1 - discountValue / 100));
  }
  return Math.max(0, originalPrice - discountValue);
}
