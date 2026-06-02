import type { Offer } from "@prisma/client";

export type OfferHealth = "ok" | "needs_sync" | "broken";

export function computeOfferHealth(offer: Offer): OfferHealth {
  if (offer.healthStatus === "broken") {
    return "broken";
  }
  if (offer.healthStatus === "needs_sync") {
    return "needs_sync";
  }
  if (offer.upsellProductIds.length === 0) {
    return "broken";
  }
  const needsCode = ["checkout", "cart", "thank_you", "product_page"].includes(
    offer.type,
  );
  if (needsCode && !offer.discountCode) {
    return "needs_sync";
  }
  return "ok";
}

export function healthBadgeTone(
  health: OfferHealth,
): "success" | "warning" | "critical" {
  if (health === "ok") return "success";
  if (health === "needs_sync") return "warning";
  return "critical";
}

export function healthLabel(health: OfferHealth): string {
  if (health === "ok") return "Healthy";
  if (health === "needs_sync") return "Needs sync";
  return "Broken";
}
