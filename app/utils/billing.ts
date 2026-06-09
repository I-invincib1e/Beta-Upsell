/**
 * FunnelX Billing Configuration
 *
 * 3-tier pricing model with checkout upsell on ALL plans (our wedge).
 * Zero revenue share — flat monthly pricing only.
 */

/**
 * Plan definitions — source of truth for feature gating.
 * These MUST match the Shopify billing config in shopify.server.ts.
 */
export const PLANS = {
  FREE: {
    id: "free",
    name: "Free Plan",
    price: 0,
    monthlyOrderLimit: 100,
    funnelLimit: 1,
    abTesting: false,
    checkoutUpsell: true, // ← WEDGE: free plan gets checkout upsell
    trialDays: 0,
  },
  GROWTH: {
    id: "growth",
    name: "Growth Plan",
    price: 6.99,
    monthlyOrderLimit: 1000,
    funnelLimit: 5,
    abTesting: true,
    checkoutUpsell: true,
    trialDays: 7,
  },
  PRO: {
    id: "pro",
    name: "Pro Plan",
    price: 19.99,
    monthlyOrderLimit: null, // unlimited
    funnelLimit: null, // unlimited
    abTesting: true,
    checkoutUpsell: true,
    trialDays: 7,
  },
} as const;

/**
 * Legacy Pro Plan — grandfathered merchants from before the rework.
 * Maps to Pro-tier feature access. Do NOT remove until all legacy
 * subscribers have migrated or churned.
 */
export const LEGACY_PRO_PLAN = {
  id: "legacy_pro",
  name: "Pro Plan", // Shopify subscription name (matches old config)
  shopifyBillingName: "Pro Plan", // What Shopify returns in billing.check()
  price: 29,
  // Feature access = same as current Pro tier
  monthlyOrderLimit: null,
  funnelLimit: null,
  abTesting: true,
  checkoutUpsell: true,
} as const;

/**
 * All plan names that Shopify billing.check() might return.
 * Used to determine the active plan from subscription data.
 */
export const SHOPIFY_PLAN_NAMES = {
  GROWTH: "Growth Plan",
  PRO: "FunnelX Pro", // New Pro plan name (different from legacy to disambiguate)
  LEGACY_PRO: "Pro Plan", // Old $29 plan
} as const;

/**
 * Resolves a Shopify subscription name to our internal plan tier.
 * Handles the legacy "Pro Plan" ($29) → Pro tier mapping.
 */
export function resolveActivePlan(subscriptionName: string | null | undefined): {
  planName: string;
  tier: "free" | "growth" | "pro";
  isLegacy: boolean;
} {
  if (!subscriptionName) {
    return { planName: "Free Plan", tier: "free", isLegacy: false };
  }

  if (subscriptionName === SHOPIFY_PLAN_NAMES.GROWTH) {
    return { planName: "Growth Plan", tier: "growth", isLegacy: false };
  }

  if (subscriptionName === SHOPIFY_PLAN_NAMES.PRO) {
    return { planName: "FunnelX Pro", tier: "pro", isLegacy: false };
  }

  // Legacy Pro Plan ($29) — grandfathered, maps to Pro tier
  if (subscriptionName === SHOPIFY_PLAN_NAMES.LEGACY_PRO) {
    return { planName: "Pro Plan (Legacy)", tier: "pro", isLegacy: true };
  }

  // Unknown plan — default to free (shouldn't happen)
  console.warn(`Unknown subscription name: "${subscriptionName}". Defaulting to Free.`);
  return { planName: "Free Plan", tier: "free", isLegacy: false };
}

/**
 * Returns the plan config for a given tier.
 */
export function getPlanConfig(tier: "free" | "growth" | "pro") {
  switch (tier) {
    case "free": return PLANS.FREE;
    case "growth": return PLANS.GROWTH;
    case "pro": return PLANS.PRO;
  }
}

/**
 * Default trial days per plan. Must match the App Store listing exactly.
 * §4.2.1 compliance — these values are the source of truth.
 */
export const PLAN_TRIAL_DAYS: Record<string, number> = {
  "Growth Plan": 7,
  "FunnelX Pro": 7,
};

/**
 * Legacy export — kept for backward compat with existing billing test.
 * Maps to new plan structure.
 */
export const PLAN_CONFIG = {
  free: { id: "free", name: "Free Plan", price: 0, trialDays: 0 },
  growth: { id: "growth", name: "Growth Plan", price: 6.99, trialDays: 7 },
  pro: { id: "pro", name: "FunnelX Pro", price: 19.99, trialDays: 7 },
} as const;

/**
 * Calculates the remaining trial days when a merchant is upgrading or downgrading.
 *
 * @param planToSelect - The name of the plan the merchant wants to subscribe to
 * @param existingSubName - The name of the merchant's current/existing subscription
 * @param existingTrialDays - The total trial days initially granted to the existing subscription
 * @param existingCreatedAt - The date the existing subscription was created
 * @returns The number of trial days remaining, or 0 if no trial should be granted.
 */
export function calculateRemainingTrialDays(
  planToSelect: string,
  existingSubName: string | undefined,
  existingTrialDays: number | undefined,
  existingCreatedAt: string | Date | undefined
): number {
  // No existing subscription or no trial was granted — no remaining trial
  if (!existingSubName || !existingTrialDays || existingTrialDays <= 0 || !existingCreatedAt) {
    return 0;
  }

  // Re-subscribing to the same plan — no new trial
  if (planToSelect === existingSubName) {
    return 0;
  }

  // Calculate how many days have elapsed since the subscription was created
  const createdDate = new Date(existingCreatedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - createdDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));

  // Remaining trial days = original trial - days elapsed
  const remaining = existingTrialDays - elapsedDays;

  // Return at least 0 (no negative trial days)
  return Math.max(0, remaining);
}
