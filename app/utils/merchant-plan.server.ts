import type { Billing } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import { billingIsTest } from "./billing-env.server";
import { PRO_PLAN_NAME } from "./billing";

export type MerchantPlan = "free" | "pro";

export const PRO_ONLY_PLACEMENTS = [
  "post_purchase",
  "checkout",
  "thank_you",
] as const;

export const FREE_ALLOWED_PLACEMENTS = ["cart", "product_page"] as const;

type BillingCheck = Awaited<ReturnType<Billing["check"]>>;

export async function checkBilling(
  billing: Billing,
): Promise<BillingCheck> {
  return billing.check({
    // @ts-ignore Shopify billing plan name
    plans: [PRO_PLAN_NAME],
    isTest: billingIsTest(),
  });
}

export function planFromBillingCheck(
  billingCheck: BillingCheck,
): MerchantPlan {
  return billingCheck.hasActivePayment ? "pro" : "free";
}

export async function getMerchantPlan(
  shopDomain: string,
  billing: Billing,
): Promise<{
  plan: MerchantPlan;
  billingCheck: BillingCheck;
  displayName: string;
}> {
  const billingCheck = await checkBilling(billing);
  const plan = planFromBillingCheck(billingCheck);

  await syncStorePlanFromBilling(shopDomain, plan, billingCheck);

  return {
    plan,
    billingCheck,
    displayName: plan === "pro" ? PRO_PLAN_NAME : "Free Plan",
  };
}

export async function syncStorePlanFromBilling(
  shopDomain: string,
  plan: MerchantPlan,
  billingCheck: BillingCheck,
): Promise<void> {
  const sub = billingCheck.appSubscriptions?.[0];
  await prisma.store.upsert({
    where: { shopDomain },
    create: {
      shopDomain,
      plan,
      shopifySubscriptionId: sub?.id ?? null,
      billingStatus: billingCheck.hasActivePayment ? "active" : "cancelled",
    },
    update: {
      plan,
      shopifySubscriptionId: sub?.id ?? null,
      billingStatus: billingCheck.hasActivePayment ? "active" : "cancelled",
    },
  });
}

export function placementRequiresPro(placement: string): boolean {
  return (PRO_ONLY_PLACEMENTS as readonly string[]).includes(placement);
}

export function canCreateOffer(
  plan: MerchantPlan,
  placement: string,
  activeOfferCount: number,
): { ok: boolean; error?: string } {
  if (placementRequiresPro(placement) && plan !== "pro") {
    return {
      ok: false,
      error:
        "Post-purchase, checkout, and thank-you offers require the Pro plan.",
    };
  }

  if (plan === "free" && activeOfferCount >= 1) {
    return {
      ok: false,
      error:
        "Free plan allows 1 active offer. Upgrade to Pro for unlimited offers.",
    };
  }

  return { ok: true };
}
