import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Grid, IndexTable, Badge, InlineStack, Button, Divider } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getStoreKPIs, getTopFunnels, getTopOffers, getPlacementBreakdown, getDailyTrend } from "../utils/analytics.server";
import { DateRangePicker } from "../components/DateRangePicker";
import { PlanGate } from "../components/PlanGate";
import { getOrCreateStore } from "../utils/funnel.server";
import { resolveActivePlan, SHOPIFY_PLAN_NAMES } from "../utils/billing";
import { useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const store = await getOrCreateStore(shopDomain, session.accessToken);

  // Parse date range from URL
  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const rangeLabel = url.searchParams.get("range") || "30 days";

  let dateRange: { from: Date; to: Date } | undefined;
  if (fromParam && toParam) {
    dateRange = {
      from: new Date(fromParam),
      to: new Date(toParam + "T23:59:59"),
    };
  } else {
    // Default: last 30 days
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    dateRange = { from, to: new Date() };
  }

  // Get plan tier
  const billingCheck = await billing.check({
    // @ts-ignore
    plans: [SHOPIFY_PLAN_NAMES.GROWTH, SHOPIFY_PLAN_NAMES.PRO, SHOPIFY_PLAN_NAMES.LEGACY_PRO],
    isTest: true,
  });
  const subscriptionName = billingCheck.hasActivePayment
    ? billingCheck.appSubscriptions[0].name
    : null;
  const { tier } = resolveActivePlan(subscriptionName);

  // Fetch analytics data
  const [kpis, topFunnels, topOffers, placementBreakdown, dailyTrend] = await Promise.all([
    getStoreKPIs(store.id, dateRange),
    getTopFunnels(store.id, 10, dateRange),
    getTopOffers(store.id, 10, dateRange),
    getPlacementBreakdown(store.id, dateRange),
    getDailyTrend(store.id, 30),
  ]);

  return json({
    kpis,
    topFunnels,
    topOffers,
    placementBreakdown,
    dailyTrend,
    rangeLabel,
    planTier: tier,
  });
};

export default function AnalyticsDashboard() {
  const { kpis, topFunnels, topOffers, placementBreakdown, dailyTrend, rangeLabel, planTier } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleRangeChange = useCallback(
    (from: string, to: string, label: string) => {
      setSearchParams({ from, to, range: label });
    },
    [setSearchParams]
  );

  // Merge funnel and legacy offer data into a single table
  const combinedPerformers = [
    ...topFunnels.map((f: any) => ({
      id: f.funnelId,
      name: f.name,
      type: "funnel",
      status: f.status,
      revenue: f.revenue,
      accepts: f.accepts,
      impressions: f.impressions,
      cvr: f.cvr,
    })),
    ...topOffers.map((o: any) => ({
      id: o.offerId,
      name: o.name,
      type: o.type,
      status: "legacy",
      revenue: o.revenue,
      accepts: o.accepts,
      impressions: o.impressions,
      cvr: o.cvr,
    })),
  ].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Simple sparkline renderer
  const renderSparkline = (data: any[], key: string) => {
    if (data.length === 0) return null;
    const values = data.map((d: any) => d[key]);
    const max = Math.max(...values, 1);
    const width = Math.min(data.length * 8, 240);
    const height = 40;

    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          points={values
            .map((v: number, i: number) => {
              const x = (i / (values.length - 1)) * width;
              const y = height - (v / max) * (height - 4) - 2;
              return `${x},${y}`;
            })
            .join(" ")}
        />
      </svg>
    );
  };

  const placementLabels: Record<string, string> = {
    checkout: "💳 Checkout",
    post_purchase: "📦 Post-Purchase",
    thank_you: "🎉 Thank You",
    product_page: "🛍️ Product Page",
    cart: "🛒 Cart Drawer",
    order_status: "📋 Order Status",
  };

  return (
    <Page title="FunnelX Analytics">
      <Layout>
        {/* Date Range Picker */}
        <Layout.Section>
          <Card>
            <DateRangePicker
              onRangeChange={handleRangeChange}
              currentLabel={rangeLabel}
            />
          </Card>
        </Layout.Section>

        {/* KPI Cards */}
        <Layout.Section>
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <div className="beta-kpi-card-1" style={{ height: "100%", borderRadius: "12px" }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Upsell Revenue</Text>
                    <Text as="p" variant="heading3xl">${kpis.revenue.toFixed(2)}</Text>
                    {renderSparkline(dailyTrend, "revenue")}
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <div className="beta-kpi-card-2" style={{ height: "100%", borderRadius: "12px" }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Conversion Rate</Text>
                    <Text as="p" variant="heading3xl">{kpis.cvr}%</Text>
                    {renderSparkline(dailyTrend, "accepts")}
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <div className="beta-kpi-card-3" style={{ height: "100%", borderRadius: "12px" }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Total Impressions</Text>
                    <Text as="p" variant="heading3xl">{kpis.impressions.toLocaleString()}</Text>
                    {renderSparkline(dailyTrend, "impressions")}
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <div className="beta-kpi-card-4" style={{ height: "100%", borderRadius: "12px" }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">AOV Lift</Text>
                    <Text as="p" variant="heading3xl">+${kpis.aovLift}</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        {/* Top Performers Table */}
        <Layout.Section>
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 8, xl: 8 }}>
              <Card padding="0">
                <BlockStack gap="0">
                  <div style={{ padding: "16px" }}>
                    <Text as="h2" variant="headingMd">Top Performers</Text>
                  </div>
                  <IndexTable
                    resourceName={{ singular: "funnel", plural: "funnels" }}
                    itemCount={combinedPerformers.length}
                    headings={[
                      { title: "Name" },
                      { title: "Type" },
                      { title: "Impressions" },
                      { title: "Accepts" },
                      { title: "CVR" },
                      { title: "Revenue" },
                    ]}
                    selectable={false}
                  >
                    {combinedPerformers.map((item: any, index: number) => (
                      <IndexTable.Row
                        id={item.id}
                        key={item.id}
                        position={index}
                        onClick={() => {
                          if (item.type === "funnel") {
                            navigate(`/app/funnels/${item.id}/analytics`);
                          }
                        }}
                      >
                        <IndexTable.Cell>
                          <Text variant="bodyMd" fontWeight="bold" as="span">
                            {item.name}
                          </Text>
                        </IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge tone={item.type === "funnel" ? "success" : "info"}>
                            {item.type === "funnel" ? "Funnel" : item.type.replace(/_/g, " ")}
                          </Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>{item.impressions.toLocaleString()}</IndexTable.Cell>
                        <IndexTable.Cell>{item.accepts}</IndexTable.Cell>
                        <IndexTable.Cell>{item.cvr}%</IndexTable.Cell>
                        <IndexTable.Cell>${item.revenue.toFixed(2)}</IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                  {combinedPerformers.length === 0 && (
                    <div style={{ padding: "16px", textAlign: "center" }}>
                      <Text as="p" tone="subdued">
                        Not enough data yet. Create and activate a funnel to start collecting data!
                      </Text>
                    </div>
                  )}
                </BlockStack>
              </Card>
            </Grid.Cell>

            {/* Placement Breakdown */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Revenue by Placement</Text>
                  {placementBreakdown.length === 0 ? (
                    <Text as="p" tone="subdued">
                      Placement data will appear once funnels with step-level tracking are active.
                    </Text>
                  ) : (
                    <BlockStack gap="300">
                      {placementBreakdown.map((p: any) => {
                        const label = placementLabels[p.placement] || p.placement;
                        const maxRevenue = Math.max(...placementBreakdown.map((x: any) => x.revenue), 1);
                        const pct = (p.revenue / maxRevenue) * 100;
                        return (
                          <BlockStack key={p.placement} gap="100">
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodySm">{label}</Text>
                              <Text as="span" variant="bodySm" fontWeight="semibold">
                                ${p.revenue.toFixed(2)}
                              </Text>
                            </InlineStack>
                            <div
                              style={{
                                height: "6px",
                                borderRadius: "3px",
                                backgroundColor: "#f0f0f5",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${pct}%`,
                                  borderRadius: "3px",
                                  background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodySm" tone="subdued">
                                {p.impressions} views
                              </Text>
                              <Text as="span" variant="bodySm" tone="subdued">
                                {p.cvr}% CVR
                              </Text>
                            </InlineStack>
                          </BlockStack>
                        );
                      })}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>

              {/* Advanced Analytics CTA (Growth+ only) */}
              <div style={{ marginTop: "16px" }}>
                <PlanGate
                  requiredTier="growth"
                  currentTier={planTier as "free" | "growth" | "pro"}
                  featureName="Advanced Analytics"
                >
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingSm">🔬 Advanced Analytics</Text>
                      <Text as="p" variant="bodySm" tone="subdued">
                        Date range filtering, per-funnel step breakdowns, and trend
                        charts are available on your plan.
                      </Text>
                    </BlockStack>
                  </Card>
                </PlanGate>
              </div>
            </Grid.Cell>
          </Grid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
