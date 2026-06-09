/**
 * FunnelX — Analytics Event API
 *
 * Receives events from extensions (impression, click, conversion).
 * Supports both legacy offerId-based events AND new funnelId/stepId events.
 * Aggregates into AnalyticsDaily for real-time dashboard.
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

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

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return corsResponse({});
  }

  if (request.method !== "POST") {
    return corsResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await request.json();
    const {
      shop,
      offerId,
      funnelId,
      stepId,
      variantKey,
      eventType,
      upsellRevenue = 0,
      orderId = null,
      customerId = null,
    } = body;

    if (!shop || !eventType) {
      return corsResponse({ error: "Missing required fields (shop, eventType)" }, 400);
    }

    if (!offerId && !funnelId) {
      return corsResponse({ error: "Must provide offerId or funnelId" }, 400);
    }

    const store = await prisma.store.findUnique({ where: { shopDomain: shop } });
    if (!store) {
      return corsResponse({ error: "Store not found" }, 404);
    }

    // Determine the offerId for backward compat
    // If funnelId is provided, use it as the offerId in AnalyticsDaily
    // (the offerId field will be repurposed to accept funnel IDs too)
    const effectiveOfferId = offerId || funnelId;

    // Record the raw event in OfferEvent (legacy table, still useful for audit)
    try {
      await prisma.offerEvent.create({
        data: {
          storeId: store.id,
          offerId: effectiveOfferId,
          eventType,
          upsellRevenue: parseFloat(String(upsellRevenue)) || 0,
          orderId,
          customerId,
          sessionData: {
            funnelId: funnelId || null,
            stepId: stepId || null,
            variantKey: variantKey || null,
          },
        },
      });
    } catch (err) {
      // OfferEvent creation can fail if offerId doesn't match an Offer.
      // This is expected for funnel-based events. Log but don't fail.
      console.warn("OfferEvent creation skipped (likely funnel-based event):", err);
    }

    // Upsert the AnalyticsDaily aggregation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const analyticsUpdate: any = {};
    if (eventType === "shown") {
      analyticsUpdate.impressions = { increment: 1 };
    } else if (eventType === "accepted") {
      analyticsUpdate.accepts = { increment: 1 };
      analyticsUpdate.totalUpsellRevenue = {
        increment: parseFloat(String(upsellRevenue)) || 0,
      };
    } else if (eventType === "declined") {
      analyticsUpdate.declines = { increment: 1 };
    }

    await prisma.analyticsDaily.upsert({
      where: {
        storeId_offerId_date: {
          storeId: store.id,
          offerId: effectiveOfferId,
          date: today,
        },
      },
      update: {
        ...analyticsUpdate,
        // Update funnel-scoped fields if provided
        ...(funnelId ? { funnelId } : {}),
        ...(stepId ? { stepId } : {}),
        ...(variantKey ? { variantKey } : {}),
      },
      create: {
        storeId: store.id,
        offerId: effectiveOfferId,
        date: today,
        impressions: eventType === "shown" ? 1 : 0,
        accepts: eventType === "accepted" ? 1 : 0,
        declines: eventType === "declined" ? 1 : 0,
        totalUpsellRevenue:
          eventType === "accepted"
            ? parseFloat(String(upsellRevenue)) || 0
            : 0,
        funnelId: funnelId || null,
        stepId: stepId || null,
        variantKey: variantKey || null,
      },
    });

    return corsResponse({ success: true });
  } catch (err: any) {
    console.error("Analytics event error:", err);
    return corsResponse({ error: err.message }, 500);
  }
};

export const loader = async () => {
  return corsResponse({ error: "Use POST for analytics events" }, 405);
};
