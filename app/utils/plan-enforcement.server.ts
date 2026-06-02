import prisma from "../db.server";
import { syncThemeOffersMetafield } from "./metafields.server";
import {
  PRO_ONLY_PLACEMENTS,
  type MerchantPlan,
} from "./merchant-plan.server";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

/**
 * When merchant downgrades to Free: pause Pro-only offers and enforce 1 active offer cap.
 */
export async function enforceFreePlanLimits(
  storeId: string,
  admin?: AdminClient,
): Promise<{ deactivatedPro: number; deactivatedExcess: number }> {
  const proOffers = await prisma.offer.findMany({
    where: {
      storeId,
      isActive: true,
      type: { in: [...PRO_ONLY_PLACEMENTS] },
    },
  });

  if (proOffers.length > 0) {
    await prisma.offer.updateMany({
      where: { id: { in: proOffers.map((o) => o.id) } },
      data: { isActive: false, deactivatedByPlan: true },
    });
  }

  const remainingActive = await prisma.offer.findMany({
    where: { storeId, isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  let deactivatedExcess = 0;
  if (remainingActive.length > 1) {
    const toDeactivate = remainingActive.slice(1);
    await prisma.offer.updateMany({
      where: { id: { in: toDeactivate.map((o) => o.id) } },
      data: { isActive: false, deactivatedByPlan: true },
    });
    deactivatedExcess = toDeactivate.length;
  }

  if (admin) {
    await syncThemeOffersMetafield(admin, storeId);
  }

  return {
    deactivatedPro: proOffers.length,
    deactivatedExcess,
  };
}

export async function reactivatePlanPausedOffers(
  storeId: string,
  plan: MerchantPlan,
): Promise<number> {
  if (plan !== "pro") {
    return 0;
  }

  const result = await prisma.offer.updateMany({
    where: { storeId, deactivatedByPlan: true },
    data: { isActive: true, deactivatedByPlan: false },
  });

  return result.count;
}
