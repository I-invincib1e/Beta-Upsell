/**
 * FunnelX — Analytics Event API
 *
 * Receives events from extensions (impression, click, conversion).
 * Supports both legacy offerId-based events AND new funnelId/stepId events.
 * Aggregates into AnalyticsDaily for real-time dashboard.
 *
 * Sprint 6: Fixed FK violation for funnel-based events.
 * Legacy events (offerId) → write OfferEvent + upsert AnalyticsDaily by offerId
 * Funnel events (funnelId) → upsert AnalyticsDaily by funnelId (skip OfferEvent)
 */

import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { corsResponse } from "../utils/cors.server";

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

    const revenue = parseFloat(String(upsellRevenue)) || 0;

    // Build the analytics increment
    const analyticsUpdate: any = {};
    if (eventType === "shown") {
      analyticsUpdate.impressions = { increment: 1 };
    } else if (eventType === "accepted") {
      analyticsUpdate.accepts = { increment: 1 };
      analyticsUpdate.totalUpsellRevenue = { increment: revenue };
    } else if (eventType === "declined") {
      analyticsUpdate.declines = { increment: 1 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (offerId && !funnelId) {
      // ── LEGACY PATH: offerId-based event ──
      // Write raw OfferEvent (FK to Offer table)
      try {
        await prisma.offerEvent.create({
          data: {
            storeId: store.id,
            offerId,
            eventType,
            upsellRevenue: revenue,
            orderId,
            customerId,
          },
        });
      } catch (err) {
        console.warn("OfferEvent creation failed (offer may be deleted):", err);
      }

      // Upsert AnalyticsDaily keyed by offerId
      await prisma.analyticsDaily.upsert({
        where: {
          storeId_offerId_funnelId_date_variantKey: {
            storeId: store.id,
            offerId,
            funnelId: null as any,
            date: today,
            variantKey: null as any,
          },
        },
        update: analyticsUpdate,
        create: {
          storeId: store.id,
          offerId,
          funnelId: null,
          date: today,
          impressions: eventType === "shown" ? 1 : 0,
          accepts: eventType === "accepted" ? 1 : 0,
          declines: eventType === "declined" ? 1 : 0,
          totalUpsellRevenue: eventType === "accepted" ? revenue : 0,
          variantKey: null,
        },
      });
    } else {
      // ── FUNNEL PATH: funnelId-based event ──
      // No OfferEvent (no FK constraint to Offer)
      const effectiveVariant = variantKey || null;

      await prisma.analyticsDaily.upsert({
        where: {
          storeId_offerId_funnelId_date_variantKey: {
            storeId: store.id,
            offerId: null as any,
            funnelId: funnelId,
            date: today,
            variantKey: effectiveVariant as any,
          },
        },
        update: {
          ...analyticsUpdate,
          ...(stepId ? { stepId } : {}),
        },
        create: {
          storeId: store.id,
          offerId: null,
          funnelId,
          stepId: stepId || null,
          date: today,
          impressions: eventType === "shown" ? 1 : 0,
          accepts: eventType === "accepted" ? 1 : 0,
          declines: eventType === "declined" ? 1 : 0,
          totalUpsellRevenue: eventType === "accepted" ? revenue : 0,
          variantKey: effectiveVariant,
        },
      });
    }

    return corsResponse({ success: true });
  } catch (err: any) {
    console.error("Analytics event error:", err);
    return corsResponse({ error: err.message }, 500);
  }
};

export const loader = async () => {
  return corsResponse({ error: "Use POST for analytics events" }, 405);
};
