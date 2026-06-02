import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";
import { assertStorefrontApiAccess } from "../utils/app-proxy.server";
import { buildEventIdempotencyKey } from "../utils/events-idempotency.server";

const ALLOWED_EVENT_TYPES = ["shown", "accepted", "declined"] as const;

function corsResponse(data: unknown, status = 200) {
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

  const access = assertStorefrontApiAccess(request);
  if (!access.ok) {
    return corsResponse({ error: access.error ?? "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    const {
      shop,
      offerId,
      eventType,
      upsellRevenue = 0,
      orderId = null,
      customerId = null,
      sessionId = null,
      productId = null,
      idempotencyKey: clientKey = null,
    } = body;

    const shopDomain = shop || access.shop;
    if (!shopDomain || !offerId || !eventType) {
      return corsResponse({ error: "Missing required fields" }, 400);
    }

    if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
      return corsResponse({ error: "Invalid eventType" }, 400);
    }

    const store = await prisma.store.findUnique({ where: { shopDomain } });
    if (!store) {
      return corsResponse({ error: "Store not found" }, 404);
    }

    const offer = await prisma.offer.findFirst({
      where: { id: offerId, storeId: store.id },
    });
    if (!offer) {
      return corsResponse({ error: "Offer not found" }, 404);
    }

    const idempotencyKey =
      clientKey ||
      buildEventIdempotencyKey({
        offerId,
        eventType,
        orderId,
        sessionId,
        productId,
      });

    const existing = await prisma.offerEvent.findUnique({
      where: {
        storeId_idempotencyKey: {
          storeId: store.id,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      return corsResponse({ success: true, duplicate: true });
    }

    await prisma.offerEvent.create({
      data: {
        storeId: store.id,
        offerId,
        eventType,
        upsellRevenue,
        orderId,
        customerId,
        idempotencyKey,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const analyticsUpdate: Record<string, unknown> = {};
    if (eventType === "shown") {
      analyticsUpdate.impressions = { increment: 1 };
    } else if (eventType === "accepted") {
      analyticsUpdate.accepts = { increment: 1 };
      analyticsUpdate.totalUpsellRevenue = { increment: upsellRevenue };
    } else if (eventType === "declined") {
      analyticsUpdate.declines = { increment: 1 };
    }

    await prisma.analyticsDaily.upsert({
      where: {
        storeId_offerId_date: {
          storeId: store.id,
          offerId,
          date: today,
        },
      },
      update: analyticsUpdate,
      create: {
        storeId: store.id,
        offerId,
        date: today,
        impressions: eventType === "shown" ? 1 : 0,
        accepts: eventType === "accepted" ? 1 : 0,
        declines: eventType === "declined" ? 1 : 0,
        totalUpsellRevenue: eventType === "accepted" ? upsellRevenue : 0,
      },
    });

    return corsResponse({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return corsResponse({ error: message }, 500);
  }
};

export const loader = async () => {
  return corsResponse({ error: "Use POST for events" }, 405);
};
