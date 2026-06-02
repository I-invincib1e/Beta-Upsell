import { describe, expect, it } from "vitest";
import {
  buildOfferDiscountCode,
  computeDiscountedPrice,
} from "./discount-codes.server";

describe("discount-codes", () => {
  it("builds stable discount code from offer id", () => {
    expect(buildOfferDiscountCode("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toMatch(
      /^BETAUP-/,
    );
  });

  it("computes percentage and fixed discounts", () => {
    expect(computeDiscountedPrice(100, "percentage", 20)).toBe(80);
    expect(computeDiscountedPrice(50, "fixed_amount", 10)).toBe(40);
  });
});
