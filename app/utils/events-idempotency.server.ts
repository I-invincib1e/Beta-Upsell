/**
 * Builds a stable idempotency key so duplicate extension/analytics calls
 * do not inflate impressions or revenue.
 */
export function buildEventIdempotencyKey(params: {
  offerId: string;
  eventType: string;
  orderId?: string | null;
  sessionId?: string | null;
  productId?: string | null;
}): string {
  const { offerId, eventType, orderId, sessionId, productId } = params;

  if (orderId) {
    const suffix = productId ? `:${productId}` : "";
    return `${eventType}:${offerId}:order:${orderId}${suffix}`;
  }

  if (sessionId) {
    return `${eventType}:${offerId}:session:${sessionId}`;
  }

  const day = new Date().toISOString().slice(0, 10);
  return `${eventType}:${offerId}:day:${day}`;
}
