/**
 * FunnelX — A/B Test Utility Tests
 *
 * Tests for deterministic variant assignment and statistical significance.
 */

import { describe, test, expect } from "vitest";
import { assignVariant, calculateSignificance } from "./abtest.server";

describe("assignVariant", () => {
  test("returns same variant for same customer+test combination", () => {
    const v1 = assignVariant("customer-123", "test-abc");
    const v2 = assignVariant("customer-123", "test-abc");
    const v3 = assignVariant("customer-123", "test-abc");
    expect(v1).toBe(v2);
    expect(v2).toBe(v3);
  });

  test("returns either 'A' or 'B'", () => {
    const variant = assignVariant("customer-456", "test-xyz");
    expect(["A", "B"]).toContain(variant);
  });

  test("different customers get different variants (distribution check)", () => {
    const results: Record<string, number> = { A: 0, B: 0 };
    for (let i = 0; i < 1000; i++) {
      const variant = assignVariant(`customer-${i}`, "test-distribution");
      results[variant]++;
    }
    // With 50/50 split, expect roughly equal distribution (within 10%)
    expect(results.A).toBeGreaterThan(350);
    expect(results.A).toBeLessThan(650);
    expect(results.B).toBeGreaterThan(350);
    expect(results.B).toBeLessThan(650);
  });

  test("different testIds produce different assignments for same customer", () => {
    // Run multiple customers and check that changing testId changes some assignments
    let differentCount = 0;
    for (let i = 0; i < 1000; i++) {
      const v1 = assignVariant(`customer-${i}`, "test-alpha-1");
      const v2 = assignVariant(`customer-${i}`, "test-beta-2");
      if (v1 !== v2) differentCount++;
    }
    // With different test IDs, a meaningful portion should get different variants
    expect(differentCount).toBeGreaterThan(5);
  });

  test("respects custom split percentage", () => {
    const results: Record<string, number> = { A: 0, B: 0 };
    for (let i = 0; i < 1000; i++) {
      const variant = assignVariant(`customer-${i}`, "test-80-20", 80);
      results[variant]++;
    }
    // 80/20 split — A should get ~80% (within tolerance)
    expect(results.A).toBeGreaterThan(650);
    expect(results.B).toBeLessThan(350);
  });

  test("splitPct=0 gives all B, splitPct=100 gives all A", () => {
    const allB = Array.from({ length: 100 }, (_, i) =>
      assignVariant(`c-${i}`, "test-0", 0)
    );
    expect(allB.every((v) => v === "B")).toBe(true);

    const allA = Array.from({ length: 100 }, (_, i) =>
      assignVariant(`c-${i}`, "test-100", 100)
    );
    expect(allA.every((v) => v === "A")).toBe(true);
  });

  test("handles anonymous visitor IDs", () => {
    const variant = assignVariant("anon_123456_abc", "test-anon");
    expect(["A", "B"]).toContain(variant);
  });
});

describe("calculateSignificance", () => {
  test("returns not significant for small sample sizes (n < 30)", () => {
    const result = calculateSignificance(
      { impressions: 20, conversions: 5, revenue: 50 },
      { impressions: 25, conversions: 8, revenue: 80 }
    );
    expect(result.isSignificant).toBe(false);
    expect(result.winner).toBe("none");
    expect(result.pValue).toBe(1);
  });

  test("returns not significant for identical conversion rates", () => {
    const result = calculateSignificance(
      { impressions: 100, conversions: 10, revenue: 100 },
      { impressions: 100, conversions: 10, revenue: 100 }
    );
    expect(result.isSignificant).toBe(false);
    expect(result.winner).toBe("none");
  });

  test("detects significant difference with large sample + big gap", () => {
    // A: 5% CVR, B: 15% CVR — should be highly significant
    const result = calculateSignificance(
      { impressions: 500, conversions: 25, revenue: 250 },
      { impressions: 500, conversions: 75, revenue: 750 }
    );
    expect(result.isSignificant).toBe(true);
    expect(result.winner).toBe("B");
    expect(result.uplift).toBeGreaterThan(0);
    expect(result.pValue).toBeLessThan(0.05);
  });

  test("declares A as winner when A has higher CVR", () => {
    const result = calculateSignificance(
      { impressions: 1000, conversions: 150, revenue: 1500 },
      { impressions: 1000, conversions: 50, revenue: 500 }
    );
    expect(result.isSignificant).toBe(true);
    expect(result.winner).toBe("A");
  });

  test("returns correct CVR values", () => {
    const result = calculateSignificance(
      { impressions: 200, conversions: 20, revenue: 200 },
      { impressions: 200, conversions: 30, revenue: 300 }
    );
    expect(result.variantA.cvr).toBeCloseTo(10, 0);
    expect(result.variantB.cvr).toBeCloseTo(15, 0);
    expect(result.variantA.sampleSize).toBe(200);
    expect(result.variantB.sampleSize).toBe(200);
  });

  test("handles zero conversions in both variants", () => {
    const result = calculateSignificance(
      { impressions: 100, conversions: 0, revenue: 0 },
      { impressions: 100, conversions: 0, revenue: 0 }
    );
    expect(result.isSignificant).toBe(false);
    expect(result.winner).toBe("none");
  });

  test("confidence is between 0 and 100", () => {
    const result = calculateSignificance(
      { impressions: 500, conversions: 25, revenue: 250 },
      { impressions: 500, conversions: 75, revenue: 750 }
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
});
