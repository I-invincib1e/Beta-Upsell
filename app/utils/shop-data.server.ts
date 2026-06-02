import prisma from "../db.server";

/**
 * Deletes all app-owned merchant data for a shop (offers, events, analytics, store).
 * Sessions are deleted separately when a Session shop value is available.
 */
export async function deleteAllShopAppData(shopDomain: string): Promise<void> {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return;

  await prisma.offerEvent.deleteMany({ where: { storeId: store.id } });
  await prisma.analyticsDaily.deleteMany({ where: { storeId: store.id } });
  await prisma.offer.deleteMany({ where: { storeId: store.id } });
  await prisma.store.delete({ where: { id: store.id } });
}

export async function deleteAllSessionsForShop(shop: string): Promise<void> {
  await prisma.session.deleteMany({ where: { shop } });
}

export type CustomerDataExport = {
  shopDomain: string;
  customerId: string;
  exportedAt: string;
  offerEvents: Array<{
    id: string;
    offerId: string;
    orderId: string | null;
    eventType: string;
    upsellRevenue: number;
    originalOrderValue: number;
    sessionData: unknown;
    createdAt: string;
  }>;
};

/**
 * Collects customer-related records stored by this app for GDPR data requests.
 * Merchants receive this payload per Shopify's mandatory compliance webhook process.
 */
export async function exportCustomerData(
  shopDomain: string,
  customerId: string,
): Promise<CustomerDataExport> {
  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    return {
      shopDomain,
      customerId,
      exportedAt: new Date().toISOString(),
      offerEvents: [],
    };
  }

  const events = await prisma.offerEvent.findMany({
    where: {
      storeId: store.id,
      customerId,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    shopDomain,
    customerId,
    exportedAt: new Date().toISOString(),
    offerEvents: events.map((e) => ({
      id: e.id,
      offerId: e.offerId,
      orderId: e.orderId,
      eventType: e.eventType,
      upsellRevenue: e.upsellRevenue,
      originalOrderValue: e.originalOrderValue,
      sessionData: e.sessionData,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
