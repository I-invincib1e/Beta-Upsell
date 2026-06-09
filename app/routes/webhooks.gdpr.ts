import { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, payload } = await authenticate.webhook(request);

  // Shopify Mandatory GDPR Webhooks
  // Since we only store essential order data tied to upsells, 
  // we log the request but typically no manual redaction is needed 
  // for this specific app's schema.
  
  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Shopify asks for the data of a specific customer.
      console.log("GDPR: Customer data requested", payload);
      break;
    case "CUSTOMERS_REDACT":
      // Shopify asks to delete a specific customer's data.
      console.log("GDPR: Customer redaction requested", payload);
      if (payload.customer?.id) {
        // Redact customerId from OfferEvents (legacy)
        await prisma.offerEvent.updateMany({
          where: { customerId: String(payload.customer.id) },
          data: { customerId: null },
        });
      }
      break;
    case "SHOP_REDACT":
      // Shopify asks to delete all data for a specific shop.
      console.log("GDPR: Shop redaction requested", payload);
      const shopDomain = payload.shop_domain;
      if (shopDomain) {
        // Find store
        const store = await prisma.store.findUnique({ where: { shopDomain } });
        if (store) {
          // Delete new models first (FunnelStep cascades from Funnel, AbTest cascades from Funnel)
          // But Widget doesn't cascade from Store automatically if steps reference it,
          // so we delete steps first, then widgets.
          const funnels = await prisma.funnel.findMany({ where: { storeId: store.id }, select: { id: true } });
          const funnelIds = funnels.map(f => f.id);

          // Delete AbTests (cascades from Funnel, but be explicit)
          await prisma.abTest.deleteMany({ where: { funnelId: { in: funnelIds } } });

          // Delete FunnelSteps (cascades from Funnel, but be explicit)
          await prisma.funnelStep.deleteMany({ where: { funnelId: { in: funnelIds } } });

          // Delete Funnels
          await prisma.funnel.deleteMany({ where: { storeId: store.id } });

          // Delete Widgets
          await prisma.widget.deleteMany({ where: { storeId: store.id } });

          // Delete legacy models
          await prisma.offerEvent.deleteMany({ where: { storeId: store.id } });
          await prisma.analyticsDaily.deleteMany({ where: { storeId: store.id } });
          await prisma.offer.deleteMany({ where: { storeId: store.id } });

          // Finally delete the store
          await prisma.store.delete({ where: { id: store.id } });
        }
      }
      break;
    default:
      console.log("Unhandled GDPR webhook topic:", topic);
  }

  // Always return a 200 OK so Shopify knows we received it
  return new Response("OK", { status: 200 });
};
