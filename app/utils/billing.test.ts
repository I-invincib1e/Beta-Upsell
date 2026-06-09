/**
 * FunnelX — Billing Utility Tests (expanded)
 *
 * Tests for plan resolution, config retrieval, and trial day calculation.
 */

import { describe, test, expect, vi } from "vitest";
import {
  resolveActivePlan,
  getPlanConfig,
  calculateRemainingTrialDays,
  PLANS,
  SHOPIFY_PLAN_NAMES,
} from "./billing";

describe("resolveActivePlan", () => {
  test("null subscription resolves to free tier", () => {
    const result = resolveActivePlan(null);
    expect(result.tier).toBe("free");
    expect(result.isLegacy).toBe(false);
  });

  test("undefined subscription resolves to free tier", () => {
    const result = resolveActivePlan(undefined);
    expect(result.tier).toBe("free");
  });

  test("Growth Plan resolves correctly", () => {
    const result = resolveActivePlan("Growth Plan");
    expect(result.tier).toBe("growth");
    expect(result.isLegacy).toBe(false);
    expect(result.planName).toBe("Growth Plan");
  });

  test("FunnelX Pro resolves correctly", () => {
    const result = resolveActivePlan("FunnelX Pro");
    expect(result.tier).toBe("pro");
    expect(result.isLegacy).toBe(false);
  });

  test("Legacy 'Pro Plan' maps to Pro tier with isLegacy=true", () => {
    const result = resolveActivePlan("Pro Plan");
    expect(result.tier).toBe("pro");
    expect(result.isLegacy).toBe(true);
    expect(result.planName).toContain("Legacy");
  });

  test("Unknown plan defaults to free with console warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = resolveActivePlan("Some Random Plan");
    expect(result.tier).toBe("free");
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

describe("getPlanConfig", () => {
  test("free tier has correct limits", () => {
    const config = getPlanConfig("free");
    expect(config.funnelLimit).toBe(1);
    expect(config.abTesting).toBe(false);
    expect(config.checkoutUpsell).toBe(true); // wedge
    expect(config.price).toBe(0);
  });

  test("growth tier has correct limits", () => {
    const config = getPlanConfig("growth");
    expect(config.funnelLimit).toBe(5);
    expect(config.abTesting).toBe(true);
    expect(config.price).toBe(6.99);
  });

  test("pro tier has unlimited funnels", () => {
    const config = getPlanConfig("pro");
    expect(config.funnelLimit).toBeNull();
    expect(config.monthlyOrderLimit).toBeNull();
    expect(config.abTesting).toBe(true);
    expect(config.price).toBe(19.99);
  });
});

describe("calculateRemainingTrialDays", () => {
  test("returns 0 when no existing subscription", () => {
    expect(calculateRemainingTrialDays("Growth Plan", undefined, undefined, undefined)).toBe(0);
  });

  test("returns 0 when re-subscribing to same plan", () => {
    expect(
      calculateRemainingTrialDays("Growth Plan", "Growth Plan", 7, new Date().toISOString())
    ).toBe(0);
  });

  test("returns remaining days when upgrading mid-trial", () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const remaining = calculateRemainingTrialDays(
      "FunnelX Pro",
      "Growth Plan",
      7,
      twoDaysAgo.toISOString()
    );
    expect(remaining).toBe(5);
  });

  test("returns 0 when trial has fully elapsed", () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const remaining = calculateRemainingTrialDays(
      "FunnelX Pro",
      "Growth Plan",
      7,
      tenDaysAgo.toISOString()
    );
    expect(remaining).toBe(0);
  });

  test("never returns negative values", () => {
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 100);
    const remaining = calculateRemainingTrialDays(
      "FunnelX Pro",
      "Growth Plan",
      7,
      longAgo.toISOString()
    );
    expect(remaining).toBeGreaterThanOrEqual(0);
  });
});

describe("PLANS constants", () => {
  test("all plans have checkoutUpsell = true (wedge strategy)", () => {
    expect(PLANS.FREE.checkoutUpsell).toBe(true);
    expect(PLANS.GROWTH.checkoutUpsell).toBe(true);
    expect(PLANS.PRO.checkoutUpsell).toBe(true);
  });

  test("SHOPIFY_PLAN_NAMES are distinct", () => {
    const names = Object.values(SHOPIFY_PLAN_NAMES);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
