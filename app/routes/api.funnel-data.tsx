/**
 * FunnelX — Funnel Data API
 *
 * Serves step config to extensions (replaces api.offer-data / api.offers).
 * Extensions call this to get the active widget config for a given
 * shop + placement + product context.
 *
 * This is the bridge between the admin funnel builder and the
 * storefront extensions.
 */

import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";
import { corsResponse } from "../utils/cors.server";

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
  });

  if (!store) {
    return corsResponse({ offer: null, funnel: null });
  }

  // Find active funnels with steps at the requested placement
  const funnels = await prisma.funnel.findMany({
    where: {
      storeId: store.id,
      status: "active",
      steps: {
        some: { placement },
      },
    },
    include: {
      steps: {
        where: { placement },
        include: { widget: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (funnels.length === 0) {
    // Fallback: check legacy Offer table for backward compat
    return await fallbackToLegacyOffers(store, shop, placement, cartProductIds);
  }

  // Match funnel by trigger rules
  const matchedFunnel = funnels.find((funnel) => {
    if (funnel.triggerType === "all") return true;

    if (funnel.triggerType === "product" && funnel.triggerValue) {
      const triggerProductIds = (funnel.triggerValue as any).productIds || [];
      const normalizedCartIds = cartProductIds.map(id => id.split("/").pop());
      const normalizedTriggerIds = triggerProductIds.map((id: string) => id.split("/").pop());
      return normalizedCartIds.some(id => id && normalizedTriggerIds.includes(id));
    }

    if (funnel.triggerType === "cart_value" && funnel.triggerValue) {
      // Cart value triggers would need cart total — not available from product IDs alone
      // For now, match all cart_value triggers (extensions can pass cart total later)
      return true;
    }

    if (funnel.triggerType === "collection" && funnel.triggerValue) {
      // Collection matching requires GraphQL — defer to extension-side filtering
      return true;
    }

    return false;
  });

  if (!matchedFunnel || matchedFunnel.steps.length === 0) {
    return corsResponse({ offer: null, funnel: null });
  }

  // Get the first step's widget for this placement
  const step = matchedFunnel.steps[0];
  const widget = step.widget;
  const widgetConfig = widget.config as any;

  // Enrich with product data if it's a product-based widget
  const productId = widgetConfig?.productId;
  const productIds = widgetConfig?.productIds || (productId ? [productId] : []);

  if (productIds.length > 0) {
    try {
      const { admin } = await unauthenticated.admin(shop);
      const gids = productIds.map((id: string) =>
        id.includes("gid://") ? id : `gid://shopify/Product/${id}`
      );

      const response = await admin.graphql(
        `query getProductData($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Product {
              id
              title
              handle
              featuredImage { url }
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
        { variables: { ids: gids } }
      );

      const data = await response.json();
      const products = (data.data?.nodes || []).filter(Boolean).map((product: any) => {
        const variant = product.variants.edges[0]?.node;
        return {
          id: product.id?.split("/").pop(),
          title: product.title,
          handle: product.handle,
          image: product.featuredImage?.url || null,
          variantId: variant?.id?.split("/").pop(),
          originalPrice: variant?.price,
        };
      });

      // Build backward-compatible response shape
      // Extensions currently expect { offer: { id, discountType, discountValue, upsellProducts } }
      const offer = {
        id: matchedFunnel.id,
        name: matchedFunnel.name,
        discountType: widgetConfig.discountType || "percentage",
        discountValue: widgetConfig.discountValue || 0,
        upsellProducts: products,
        // New fields for extensions that want richer data
        widgetType: widget.type,
        widgetConfig,
        stepId: step.id,
        funnelId: matchedFunnel.id,
      };

      return corsResponse({
        offer,
        funnel: {
          id: matchedFunnel.id,
          name: matchedFunnel.name,
          steps: matchedFunnel.steps.map((s) => ({
            id: s.id,
            placement: s.placement,
            position: s.position,
            widgetType: s.widget.type,
            widgetName: s.widget.name,
          })),
        },
      });
    } catch (error) {
      console.error("Error enriching funnel data:", error);
    }
  }

  // Return without product enrichment (timer, survey, etc.)
  const offer = {
    id: matchedFunnel.id,
    name: matchedFunnel.name,
    discountType: widgetConfig.discountType || "none",
    discountValue: widgetConfig.discountValue || 0,
    upsellProducts: [],
    widgetType: widget.type,
    widgetConfig,
    stepId: step.id,
    funnelId: matchedFunnel.id,
  };

  return corsResponse({
    offer,
    funnel: {
      id: matchedFunnel.id,
      name: matchedFunnel.name,
      steps: matchedFunnel.steps.map((s) => ({
        id: s.id,
        placement: s.placement,
        position: s.position,
        widgetType: s.widget.type,
        widgetName: s.widget.name,
        widgetConfig: s.widget.config,
      })),
    },
  });
};

/**
 * Backward compat: if no funnels found, check the legacy Offer table.
 * This ensures existing merchants on the old system still work during transition.
 */
async function fallbackToLegacyOffers(
  store: any,
  shop: string,
  placement: string,
  cartProductIds: string[]
) {
  const offers = await prisma.offer.findMany({
    where: {
      storeId: store.id,
      type: placement,
      isActive: true,
    },
    orderBy: { priority: "desc" },
  });

  if (offers.length === 0) {
    return corsResponse({ offer: null, funnel: null });
  }

  // Simple trigger matching (same logic as old api.offers.ts)
  const matched = offers.find((offer) => {
    if (offer.triggerType === "ALL_PRODUCTS") return true;
    if (offer.triggerType === "SPECIFIC_PRODUCTS") {
      const normalizedCartIds = cartProductIds.map(id => id.split("/").pop());
      const normalizedTriggerIds = offer.triggerProductIds.map(id => id.split("/").pop());
      return normalizedCartIds.some(id => id && normalizedTriggerIds.includes(id));
    }
    return false;
  });

  if (!matched) {
    return corsResponse({ offer: null, funnel: null });
  }

  // Enrich legacy offer
  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(
      `query getProductData($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            handle
            featuredImage { url }
            variants(first: 1) {
              edges { node { id price } }
            }
          }
        }
      }`,
      { variables: { ids: matched.upsellProductIds } }
    );

    const data = await response.json();
    const products = (data.data?.nodes || []).filter(Boolean).map((product: any) => {
      const variant = product.variants.edges[0]?.node;
      return {
        id: product.id?.split("/").pop(),
        title: product.title,
        handle: product.handle,
        image: product.featuredImage?.url || null,
        variantId: variant?.id?.split("/").pop(),
        originalPrice: variant?.price,
      };
    });

    return corsResponse({
      offer: { ...matched, upsellProducts: products },
      funnel: null,
    });
  } catch (error) {
    console.error("Error enriching legacy offer:", error);
    return corsResponse({ offer: matched, funnel: null });
  }
}

// Handle preflight requests
export const action = async () => {
  return corsResponse({});
};
