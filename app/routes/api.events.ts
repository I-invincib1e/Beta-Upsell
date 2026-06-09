/**
 * Legacy Event API — Redirect Stub
 *
 * This endpoint was the original analytics event handler.
 * It's now replaced by api.analytics-event.tsx which supports both
 * legacy offerId and new funnelId events.
 *
 * Extensions that still hit /api/events are redirected with 307
 * (preserves POST method) to /api/analytics-event.
 *
 * Sprint 6: Replaced duplicate implementation with redirect.
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { corsResponse } from "../utils/cors.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method === "OPTIONS") {
    return corsResponse({});
  }

  // Forward the request body to the new endpoint
  // Use 307 to preserve POST method
  const url = new URL(request.url);
  const newUrl = `${url.origin}/api/analytics-event`;

  try {
    const body = await request.text();
    const response = await fetch(newUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await response.json();
    return corsResponse(data, response.status);
  } catch (err: any) {
    return corsResponse({ error: "Legacy redirect failed", detail: err.message }, 500);
  }
};

export const loader = async () => {
  return corsResponse({ error: "Use POST for events. This endpoint redirects to /api/analytics-event." }, 405);
};
