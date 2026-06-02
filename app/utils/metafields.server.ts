const THEME_OFFER_TYPES = ["cart", "product_page"] as const;

type ThemeOfferType = (typeof THEME_OFFER_TYPES)[number];

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

export async function syncThemeOffersMetafield(
  admin: AdminClient,
  storeId: string,
): Promise<void> {
  const prisma = (await import("../db.server")).default;

  const activeThemeOffers = await prisma.offer.findMany({
    where: {
      storeId,
      type: { in: [...THEME_OFFER_TYPES] },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
      triggerType: true,
      triggerProductIds: true,
      upsellProductIds: true,
      discountType: true,
      discountValue: true,
      discountCode: true,
    },
  });

  const enrichedOffers = await Promise.all(
    activeThemeOffers.map(async (offer) => {
      const response = await admin.graphql(
        `query getProductHandles($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              handle
            }
          }
        }`,
        { variables: { ids: offer.upsellProductIds } },
      );
      const data = await response.json();
      const handles =
        data.data?.nodes?.map((n: { handle?: string }) => n?.handle).filter(Boolean) ||
        [];
      return { ...offer, handles };
    }),
  );

  const metafieldsSetMutation = `
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key value }
        userErrors { field message }
      }
    }
  `;

  const shopQuery = await admin.graphql(`{ shop { id } }`);
  const shopData = await shopQuery.json();
  const shopId = shopData.data?.shop?.id;
  if (!shopId) {
    console.error("syncThemeOffersMetafield: could not resolve shop id");
    return;
  }

  const result = await admin.graphql(metafieldsSetMutation, {
    variables: {
      metafields: [
        {
          namespace: "beta_upsell",
          key: "active_offers",
          type: "json",
          value: JSON.stringify(enrichedOffers),
          ownerId: shopId,
        },
      ],
    },
  });
  const resultJson = await result.json();
  const userErrors = resultJson.data?.metafieldsSet?.userErrors;
  if (userErrors?.length) {
    console.error("syncThemeOffersMetafield userErrors:", userErrors);
  }
}

export function isThemePlacement(placement: string): placement is ThemeOfferType {
  return THEME_OFFER_TYPES.includes(placement as ThemeOfferType);
}
