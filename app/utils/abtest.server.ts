/**
 * FunnelX — A/B Test Server Utility
 *
 * Deterministic variant assignment by customer ID hash (no cookies needed).
 * CRUD operations for AbTest model.
 * Statistical significance calculator using z-test.
 */

import prisma from "../db.server";

// ============================================================
// Deterministic Variant Assignment
// ============================================================

/**
 * Assign a variant to a customer for a given A/B test.
 * Uses a simple hash of (customerId + testId) for deterministic assignment.
 * No cookies needed — same customer always gets same variant.
 */
export function assignVariant(
  customerId: string,
  testId: string,
  splitPct: number = 50
): "A" | "B" {
  const input = `${customerId}:${testId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0; // Simple DJB2-like hash
  }
  // Normalize to 0-99
  const bucket = Math.abs(hash) % 100;
  return bucket < splitPct ? "A" : "B";
}

// ============================================================
// CRUD
// ============================================================

export async function createAbTest(data: {
  funnelId: string;
  name: string;
  variantA: any;
  variantB: any;
  splitPct?: number;
}) {
  // Ensure no other running tests on this funnel
  const existing = await prisma.abTest.findFirst({
    where: {
      funnelId: data.funnelId,
      status: "running",
    },
  });

  if (existing) {
    throw new Error(
      `Funnel already has a running A/B test: "${existing.name}". ` +
      `Conclude it first before starting a new one.`
    );
  }

  return prisma.abTest.create({
    data: {
      funnelId: data.funnelId,
      name: data.name,
      variantA: data.variantA,
      variantB: data.variantB,
      splitPct: data.splitPct ?? 50,
      status: "running",
    },
  });
}

export async function getAbTest(testId: string) {
  return prisma.abTest.findUnique({
    where: { id: testId },
  });
}

export async function getAbTestsForFunnel(funnelId: string) {
  return prisma.abTest.findMany({
    where: { funnelId },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRunningTestForFunnel(funnelId: string) {
  return prisma.abTest.findFirst({
    where: {
      funnelId,
      status: "running",
    },
  });
}

export async function concludeAbTest(testId: string, winner?: "A" | "B") {
  return prisma.abTest.update({
    where: { id: testId },
    data: {
      status: "concluded",
      concludedAt: new Date(),
    },
  });
}

export async function pauseAbTest(testId: string) {
  return prisma.abTest.update({
    where: { id: testId },
    data: { status: "paused" },
  });
}

export async function resumeAbTest(testId: string) {
  return prisma.abTest.update({
    where: { id: testId },
    data: { status: "running" },
  });
}

export async function deleteAbTest(testId: string) {
  return prisma.abTest.delete({
    where: { id: testId },
  });
}

// ============================================================
// Statistical Significance
// ============================================================

interface VariantStats {
  impressions: number;
  conversions: number;
  revenue: number;
}

interface SignificanceResult {
  isSignificant: boolean;
  confidence: number;
  winner: "A" | "B" | "none";
  uplift: number; // % improvement of winner over loser
  pValue: number;
  variantA: { cvr: number; sampleSize: number };
  variantB: { cvr: number; sampleSize: number };
}

/**
 * Calculate statistical significance using a two-proportion z-test.
 * Returns whether the difference is significant at 95% confidence (p < 0.05).
 */
export function calculateSignificance(
  a: VariantStats,
  b: VariantStats
): SignificanceResult {
  const n1 = a.impressions;
  const n2 = b.impressions;
  const p1 = n1 > 0 ? a.conversions / n1 : 0;
  const p2 = n2 > 0 ? b.conversions / n2 : 0;

  // Need minimum sample size for meaningful results
  if (n1 < 30 || n2 < 30) {
    return {
      isSignificant: false,
      confidence: 0,
      winner: "none",
      uplift: 0,
      pValue: 1,
      variantA: { cvr: parseFloat((p1 * 100).toFixed(2)), sampleSize: n1 },
      variantB: { cvr: parseFloat((p2 * 100).toFixed(2)), sampleSize: n2 },
    };
  }

  // Pooled proportion
  const pPool = (a.conversions + b.conversions) / (n1 + n2);

  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (se === 0) {
    return {
      isSignificant: false,
      confidence: 0,
      winner: "none",
      uplift: 0,
      pValue: 1,
      variantA: { cvr: parseFloat((p1 * 100).toFixed(2)), sampleSize: n1 },
      variantB: { cvr: parseFloat((p2 * 100).toFixed(2)), sampleSize: n2 },
    };
  }

  // Z-score
  const z = Math.abs(p1 - p2) / se;

  // Approximate p-value from z-score (two-tailed)
  // Using simplified approximation for the normal CDF
  const pValue = 2 * (1 - normalCDF(z));

  const isSignificant = pValue < 0.05;
  const confidence = parseFloat(((1 - pValue) * 100).toFixed(1));

  let winner: "A" | "B" | "none" = "none";
  let uplift = 0;

  if (isSignificant) {
    if (p1 > p2) {
      winner = "A";
      uplift = p2 > 0 ? parseFloat((((p1 - p2) / p2) * 100).toFixed(1)) : 100;
    } else {
      winner = "B";
      uplift = p1 > 0 ? parseFloat((((p2 - p1) / p1) * 100).toFixed(1)) : 100;
    }
  }

  return {
    isSignificant,
    confidence,
    winner,
    uplift,
    pValue: parseFloat(pValue.toFixed(4)),
    variantA: { cvr: parseFloat((p1 * 100).toFixed(2)), sampleSize: n1 },
    variantB: { cvr: parseFloat((p2 * 100).toFixed(2)), sampleSize: n2 },
  };
}

/**
 * Standard normal CDF approximation.
 * Abramowitz & Stegun formula 7.1.26.
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Get A/B test results with statistical analysis.
 */
export async function getAbTestResults(testId: string) {
  const test = await prisma.abTest.findUnique({
    where: { id: testId },
  });

  if (!test) return null;

  // Get variant-level analytics using raw SQL to avoid Prisma type issues
  // with the new nullable fields. The analytics-event API stores funnelId
  // in the offerId field (for backward compat) and also in the funnelId field.
  const variantData: any[] = await prisma.$queryRaw`
    SELECT
      "variantKey",
      COALESCE(SUM("impressions"), 0)::int AS "impressions",
      COALESCE(SUM("accepts"), 0)::int AS "accepts",
      COALESCE(SUM("totalUpsellRevenue"), 0)::float AS "totalUpsellRevenue"
    FROM "AnalyticsDaily"
    WHERE ("funnelId" = ${test.funnelId} OR "offerId" = ${test.funnelId})
      AND "variantKey" IN ('A', 'B')
    GROUP BY "variantKey"
  `;

  const getStats = (key: string): VariantStats => {
    const data = variantData.find((d: any) => d.variantKey === key);
    return {
      impressions: data?.impressions || 0,
      conversions: data?.accepts || 0,
      revenue: data?.totalUpsellRevenue || 0,
    };
  };

  const statsA = getStats("A");
  const statsB = getStats("B");
  const significance = calculateSignificance(statsA, statsB);

  return {
    test,
    statsA,
    statsB,
    significance,
  };
}

