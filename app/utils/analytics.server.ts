/**
 * FunnelX — Analytics Server Utility
 *
 * Aggregation functions for the AnalyticsDaily model.
 * Supports querying by date range, funnel, step, and variant.
 */

import prisma from "../db.server";

interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Store-level KPIs for a date range.
 */
export async function getStoreKPIs(storeId: string, dateRange?: DateRange) {
  const where: any = { storeId };
  if (dateRange) {
    where.date = { gte: dateRange.from, lte: dateRange.to };
  }

  const agg = await prisma.analyticsDaily.aggregate({
    where,
    _sum: {
      impressions: true,
      accepts: true,
      declines: true,
      totalUpsellRevenue: true,
    },
  });

  const impressions = agg._sum.impressions || 0;
  const accepts = agg._sum.accepts || 0;
  const declines = agg._sum.declines || 0;
  const revenue = agg._sum.totalUpsellRevenue || 0;
  const cvr = impressions > 0 ? (accepts / impressions) * 100 : 0;
  const aovLift = accepts > 0 ? revenue / accepts : 0;

  return {
    impressions,
    accepts,
    declines,
    revenue,
    cvr: parseFloat(cvr.toFixed(1)),
    aovLift: parseFloat(aovLift.toFixed(2)),
  };
}

/**
 * Top funnels by revenue.
 */
export async function getTopFunnels(storeId: string, limit = 10, dateRange?: DateRange) {
  const where: any = { storeId, funnelId: { not: null } };
  if (dateRange) {
    where.date = { gte: dateRange.from, lte: dateRange.to };
  }

  const grouped = await prisma.analyticsDaily.groupBy({
    by: ["funnelId"],
    where,
    _sum: {
      totalUpsellRevenue: true,
      accepts: true,
      impressions: true,
      declines: true,
    },
    orderBy: { _sum: { totalUpsellRevenue: "desc" } },
    take: limit,
  });

  // Hydrate with funnel names
  const funnelIds = grouped.map((g) => g.funnelId).filter(Boolean) as string[];
  const funnels = await prisma.funnel.findMany({
    where: { id: { in: funnelIds } },
    select: { id: true, name: true, status: true },
  });

  const funnelMap = new Map(funnels.map((f) => [f.id, f]));

  return grouped.map((g) => {
    const funnel = funnelMap.get(g.funnelId || "");
    const imp = g._sum.impressions || 0;
    const acc = g._sum.accepts || 0;
    return {
      funnelId: g.funnelId,
      name: funnel?.name || "Unknown Funnel",
      status: funnel?.status || "unknown",
      revenue: g._sum.totalUpsellRevenue || 0,
      accepts: acc,
      impressions: imp,
      declines: g._sum.declines || 0,
      cvr: imp > 0 ? parseFloat(((acc / imp) * 100).toFixed(1)) : 0,
    };
  });
}

/**
 * Top offers (legacy) by revenue — used alongside funnel data during transition.
 */
export async function getTopOffers(storeId: string, limit = 10, dateRange?: DateRange) {
  const where: any = { storeId };
  if (dateRange) {
    where.date = { gte: dateRange.from, lte: dateRange.to };
  }

  const grouped = await prisma.analyticsDaily.groupBy({
    by: ["offerId"],
    where,
    _sum: {
      totalUpsellRevenue: true,
      accepts: true,
      impressions: true,
    },
    orderBy: { _sum: { totalUpsellRevenue: "desc" } },
    take: limit,
  });

  const offerIds = grouped.map((g) => g.offerId);
  const offers = await prisma.offer.findMany({
    where: { id: { in: offerIds } },
    select: { id: true, name: true, type: true },
  });

  const offerMap = new Map(offers.map((o) => [o.id, o]));

  return grouped.map((g) => {
    const offer = offerMap.get(g.offerId);
    const imp = g._sum.impressions || 0;
    const acc = g._sum.accepts || 0;
    return {
      offerId: g.offerId,
      name: offer?.name || "Deleted Offer",
      type: offer?.type || "unknown",
      revenue: g._sum.totalUpsellRevenue || 0,
      accepts: acc,
      impressions: imp,
      cvr: imp > 0 ? parseFloat(((acc / imp) * 100).toFixed(1)) : 0,
    };
  });
}

/**
 * Revenue by placement.
 */
export async function getPlacementBreakdown(storeId: string, dateRange?: DateRange) {
  const where: any = { storeId, stepId: { not: null } };
  if (dateRange) {
    where.date = { gte: dateRange.from, lte: dateRange.to };
  }

  const grouped = await prisma.analyticsDaily.groupBy({
    by: ["stepId"],
    where,
    _sum: {
      totalUpsellRevenue: true,
      accepts: true,
      impressions: true,
    },
  });

  // Get placements from steps
  const stepIds = grouped.map((g) => g.stepId).filter(Boolean) as string[];
  const steps = await prisma.funnelStep.findMany({
    where: { id: { in: stepIds } },
    select: { id: true, placement: true },
  });

  const stepMap = new Map(steps.map((s) => [s.id, s.placement]));

  // Aggregate by placement
  const placementAgg: Record<string, { revenue: number; accepts: number; impressions: number }> = {};

  for (const g of grouped) {
    const placement = stepMap.get(g.stepId || "") || "unknown";
    if (!placementAgg[placement]) {
      placementAgg[placement] = { revenue: 0, accepts: 0, impressions: 0 };
    }
    placementAgg[placement].revenue += g._sum.totalUpsellRevenue || 0;
    placementAgg[placement].accepts += g._sum.accepts || 0;
    placementAgg[placement].impressions += g._sum.impressions || 0;
  }

  return Object.entries(placementAgg)
    .map(([placement, data]) => ({
      placement,
      ...data,
      cvr: data.impressions > 0 ? parseFloat(((data.accepts / data.impressions) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Per-funnel analytics: step-level breakdown.
 */
export async function getFunnelAnalytics(funnelId: string, dateRange?: DateRange) {
  const where: any = { funnelId };
  if (dateRange) {
    where.date = { gte: dateRange.from, lte: dateRange.to };
  }

  // Overall funnel KPIs
  const agg = await prisma.analyticsDaily.aggregate({
    where,
    _sum: {
      impressions: true,
      accepts: true,
      declines: true,
      totalUpsellRevenue: true,
    },
  });

  // Per-step breakdown
  const stepGrouped = await prisma.analyticsDaily.groupBy({
    by: ["stepId"],
    where,
    _sum: {
      impressions: true,
      accepts: true,
      declines: true,
      totalUpsellRevenue: true,
    },
  });

  const stepIds = stepGrouped.map((g) => g.stepId).filter(Boolean) as string[];
  const steps = await prisma.funnelStep.findMany({
    where: { id: { in: stepIds } },
    include: { widget: { select: { name: true, type: true } } },
  });

  const stepMap = new Map(steps.map((s) => [s.id, s]));

  const stepBreakdown = stepGrouped.map((g) => {
    const step = stepMap.get(g.stepId || "");
    const imp = g._sum.impressions || 0;
    const acc = g._sum.accepts || 0;
    return {
      stepId: g.stepId,
      widgetName: step?.widget?.name || "Unknown",
      widgetType: step?.widget?.type || "unknown",
      placement: step?.placement || "unknown",
      impressions: imp,
      accepts: acc,
      declines: g._sum.declines || 0,
      revenue: g._sum.totalUpsellRevenue || 0,
      cvr: imp > 0 ? parseFloat(((acc / imp) * 100).toFixed(1)) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Per-variant breakdown (for A/B tests)
  const variantGrouped = await prisma.analyticsDaily.groupBy({
    by: ["variantKey"],
    where: { ...where, variantKey: { not: null } },
    _sum: {
      impressions: true,
      accepts: true,
      totalUpsellRevenue: true,
    },
  });

  const variantBreakdown = variantGrouped.map((g) => {
    const imp = g._sum.impressions || 0;
    const acc = g._sum.accepts || 0;
    return {
      variant: g.variantKey || "unknown",
      impressions: imp,
      accepts: acc,
      revenue: g._sum.totalUpsellRevenue || 0,
      cvr: imp > 0 ? parseFloat(((acc / imp) * 100).toFixed(1)) : 0,
    };
  });

  // Daily trend
  const dailyTrend = await prisma.analyticsDaily.findMany({
    where,
    select: {
      date: true,
      impressions: true,
      accepts: true,
      totalUpsellRevenue: true,
    },
    orderBy: { date: "asc" },
  });

  return {
    kpis: {
      impressions: agg._sum.impressions || 0,
      accepts: agg._sum.accepts || 0,
      declines: agg._sum.declines || 0,
      revenue: agg._sum.totalUpsellRevenue || 0,
      cvr: (agg._sum.impressions || 0) > 0
        ? parseFloat((((agg._sum.accepts || 0) / (agg._sum.impressions || 0)) * 100).toFixed(1))
        : 0,
    },
    stepBreakdown,
    variantBreakdown,
    dailyTrend,
  };
}

/**
 * Daily trend data for sparkline charts.
 */
export async function getDailyTrend(storeId: string, days = 30) {
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  fromDate.setHours(0, 0, 0, 0);

  const data = await prisma.analyticsDaily.groupBy({
    by: ["date"],
    where: {
      storeId,
      date: { gte: fromDate },
    },
    _sum: {
      impressions: true,
      accepts: true,
      totalUpsellRevenue: true,
    },
    orderBy: { date: "asc" },
  });

  return data.map((d) => ({
    date: d.date.toISOString().split("T")[0],
    impressions: d._sum.impressions || 0,
    accepts: d._sum.accepts || 0,
    revenue: d._sum.totalUpsellRevenue || 0,
  }));
}
