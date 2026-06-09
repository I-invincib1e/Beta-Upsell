/**
 * FunnelX — A/B Test Assignment API
 *
 * Called by extensions to get the variant ("A" or "B") for a customer+funnel.
 * Returns the widget config for the assigned variant.
 */

import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { assignVariant, getRunningTestForFunnel } from "../utils/abtest.server";
import { corsResponse } from "../utils/cors.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const funnelId = url.searchParams.get("funnelId");
  const customerId = url.searchParams.get("customerId");

  if (!funnelId) {
    return corsResponse({ error: "Missing funnelId parameter" }, 400);
  }

  // If no customerId, generate a pseudo-random one from the request
  // (This handles anonymous visitors)
  const effectiveCustomerId =
    customerId ||
    url.searchParams.get("sessionId") ||
    `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Check if there's a running A/B test on this funnel
  const runningTest = await getRunningTestForFunnel(funnelId);

  if (!runningTest) {
    // No A/B test — return default (variant A = original)
    return corsResponse({
      variant: "A",
      testId: null,
      hasAbTest: false,
      config: null,
    });
  }

  // Assign deterministic variant
  const variant = assignVariant(
    effectiveCustomerId,
    runningTest.id,
    runningTest.splitPct
  );

  // Return the config for the assigned variant
  const config = variant === "A" ? runningTest.variantA : runningTest.variantB;

  return corsResponse({
    variant,
    testId: runningTest.id,
    hasAbTest: true,
    config,
    splitPct: runningTest.splitPct,
    testName: runningTest.name,
  });
};

// Handle preflight
export const action = async () => {
  return corsResponse({});
};
