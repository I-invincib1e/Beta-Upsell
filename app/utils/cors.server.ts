/**
 * Shared CORS response helper for unauthenticated API endpoints.
 *
 * Used by: api.analytics-event, api.funnel-data, api.abtest-assign, api.offers
 * These endpoints are called from Shopify checkout/storefront extensions
 * which run in a different origin.
 */

import { json } from "@remix-run/node";

export function corsResponse(data: any, status = 200) {
  return json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
