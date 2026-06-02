import { describe, expect, it } from "vitest";
import {
  canCreateOffer,
  placementRequiresPro,
  planFromBillingCheck,
} from "./merchant-plan.server";

describe("merchant-plan", () => {
  it("detects pro-only placements", () => {
    expect(placementRequiresPro("post_purchase")).toBe(true);
    expect(placementRequiresPro("cart")).toBe(false);
  });

  it("blocks pro placement on free plan", () => {
    const result = canCreateOffer("free", "checkout", 0);
    expect(result.ok).toBe(false);
  });

  it("blocks second active offer on free", () => {
    const result = canCreateOffer("free", "cart", 1);
    expect(result.ok).toBe(false);
  });

  it("allows unlimited on pro", () => {
    const result = canCreateOffer("pro", "checkout", 10);
    expect(result.ok).toBe(true);
  });

  it("maps billing check to plan", () => {
    expect(
      planFromBillingCheck({ hasActivePayment: true, appSubscriptions: [] }),
    ).toBe("pro");
    expect(
      planFromBillingCheck({ hasActivePayment: false, appSubscriptions: [] }),
    ).toBe("free");
  });
});
