import { describe, expect, it } from "vitest";
import { buildEventIdempotencyKey } from "./events-idempotency.server";

describe("buildEventIdempotencyKey", () => {
  it("keys accepted events per order and product", () => {
    const key = buildEventIdempotencyKey({
      offerId: "offer-1",
      eventType: "accepted",
      orderId: "1001",
      productId: "prod-9",
    });
    expect(key).toBe("accepted:offer-1:order:1001:prod-9");
  });

  it("keys shown events per session", () => {
    const key = buildEventIdempotencyKey({
      offerId: "offer-1",
      eventType: "shown",
      sessionId: "sess-abc",
    });
    expect(key).toBe("shown:offer-1:session:sess-abc");
  });
});
