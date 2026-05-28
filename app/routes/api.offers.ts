import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";

function corsResponse(data: any, status = 200) {
  return json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const placement = url.searchParams.get("placement");
  const productIdsParam = url.searchParams.get("productIds");
  const cartProductIds = productIdsParam ? productIdsParam.split(",") : [];

  if (!shop || !placement) {
    return corsResponse({ error: "Missing shop or placement parameter" }, 400);
  }

  const store = await prisma.store.findUnique({
    where: { shopDomain: shop },
    include: {
      offers: {
        where: { type: placement, isActive: true },
        orderBy: { priority: "desc" },
      },
    },
  });

  if (!store || store.offers.length === 0) {
    return corsResponse({ offer: null });
  }

  const hasCollectionTrigger = store.offers.some(o => o.triggerType === "SPECIFIC_COLLECTIONS");
  let cartProductCollections = new Map<string, string[]>();

  if (hasCollectionTrigger && cartProductIds.length > 0) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      if (admin) {
        const productGids = cartProductIds.map(id => id.includes('gid://') ? id : `gid://shopify/Product/${id}`);
        const response = await admin.graphql(
          `query getProductsCollections($ids: [ID!]!) {
            nodes(ids: $ids) {
              ... on Product {
                id
                collections(first: 20) {
                  nodes { id }
                }
              }
            }
          }`,
          { variables: { ids: productGids } }
        );
        const data = await response.json();
        if (data.data?.nodes) {
          data.data.nodes.forEach((node: any) => {
            if (node?.id) {
              const shortId = node.id.split('/').pop() as string;
              const colIds = node.collections?.nodes?.map((c: any) => c.id.split('/').pop() as string) || [];
              cartProductCollections.set(shortId, colIds);
            }
          });
        }
      }
    } catch (e) {
      console.error("Error fetching collections for cart products:", e);
    }
  }

  // Filter offers by trigger rules
  const matchedOffer = store.offers.find((offer) => {
    if (offer.triggerType === "ALL_PRODUCTS") return true;
    if (offer.triggerType === "SPECIFIC_PRODUCTS") {
      const normalizedCartIds = cartProductIds.map(id => id.split('/').pop());
      const normalizedTriggerIds = offer.triggerProductIds.map(id => id.split('/').pop());
      return normalizedCartIds.some(id => id && normalizedTriggerIds.includes(id));
    }
    if (offer.triggerType === "SPECIFIC_COLLECTIONS") {
      const normalizedTriggerIds = offer.triggerProductIds.map(id => id.split('/').pop());
      return cartProductIds.some(cartId => {
        const shortCartId = cartId.split('/').pop();
        if (!shortCartId) return false;
        const colIds = cartProductCollections.get(shortCartId) || [];
        return colIds.some(colId => normalizedTriggerIds.includes(colId));
      });
    }
    return false;
  });

  if (!matchedOffer) {
    return corsResponse({ offer: null });
  }

  const rawOffer = matchedOffer;

  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(
      `query getProductData($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            handle
            featuredImage {
              url
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  price
                }
              }
            }
          }
        }
      }`,
      { variables: { ids: rawOffer.upsellProductIds } }
    );
    const data = await response.json();
    const products = data.data?.nodes || [];
    
    if (products.length > 0) {
      const upsellProducts = products.filter(Boolean).map((product: any) => {
        const variant = product.variants.edges[0]?.node;
        return {
          id: product.id?.split('/').pop(),
          title: product.title,
          handle: product.handle,
          image: product.featuredImage?.url || null,
          variantId: variant?.id?.split('/').pop(),
          originalPrice: variant?.price
        };
      });
      
      const enrichedOffer = {
        ...rawOffer,
        upsellProducts
      };
      return corsResponse({ offer: enrichedOffer });
    }
  } catch (error) {
    console.error("Error enriching offer:", error);
  }

  return corsResponse({ offer: rawOffer });
};

// Handle preflight requests
export const action = async () => {
  return corsResponse({});
};
