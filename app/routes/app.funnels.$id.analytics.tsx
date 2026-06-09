/**
 * Per-Funnel Analytics Page
 *
 * Deep-dive analytics for a single funnel:
 * - Funnel-level KPIs
 * - Per-step breakdown (which widget performs best)
 * - Per-variant breakdown (A/B test results)
 * - Daily trend chart
 */

import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Grid,
  IndexTable,
  Badge,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getFunnelAnalytics } from "../utils/analytics.server";
import { getFunnel } from "../utils/funnel.server";
import { getRunningTestForFunnel, getAbTestResults } from "../utils/abtest.server";
import { DateRangePicker } from "../components/DateRangePicker";
import { AbTestResults } from "../components/AbTestBadge";
import { useCallback } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const funnelId = params.id;

  if (!funnelId) {
    return json({ error: "Missing funnel ID", funnel: null, analytics: null, rangeLabel: "30 days", abTestResults: null });
  }

  const funnel = await getFunnel(funnelId);
  if (!funnel) {
    return json({ error: "Funnel not found", funnel: null, analytics: null, rangeLabel: "30 days", abTestResults: null });
  }

  // Parse date range
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
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    dateRange = { from, to: new Date() };
  }

  const analytics = await getFunnelAnalytics(funnelId, dateRange);

  // Fetch running A/B test results with statistical significance
  let abTestResults = null;
  const runningTest = await getRunningTestForFunnel(funnelId);
  if (runningTest) {
    abTestResults = await getAbTestResults(runningTest.id);
  }

  return json({ funnel, analytics, rangeLabel, error: null, abTestResults });
};

export default function FunnelAnalytics() {
  const { funnel, analytics, rangeLabel, error, abTestResults } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleRangeChange = useCallback(
    (from: string, to: string, label: string) => {
      setSearchParams({ from, to, range: label });
    },
    [setSearchParams]
  );

  if (error || !funnel || !analytics) {
    return (
      <Page
        backAction={{ content: "Funnels", onAction: () => navigate("/app/funnels") }}
        title="Funnel Analytics"
      >
        <Banner title="Error" tone="critical">
          <p>{error || "Could not load analytics."}</p>
        </Banner>
      </Page>
    );
  }

  const { kpis, stepBreakdown, variantBreakdown, dailyTrend } = analytics;

  // Simple trend chart
  const renderTrendChart = () => {
    if (dailyTrend.length === 0) return null;

    const maxRevenue = Math.max(...dailyTrend.map((d: any) => d.totalUpsellRevenue || 0), 1);
    const width = 600;
    const height = 120;

    const points = dailyTrend
      .map((d: any, i: number) => {
        const x = (i / Math.max(dailyTrend.length - 1, 1)) * width;
        const y = height - ((d.totalUpsellRevenue || 0) / maxRevenue) * (height - 8) - 4;
        return `${x},${y}`;
      })
      .join(" ");

    // Area fill
    const areaPoints = `0,${height} ${points} ${width},${height}`;

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon fill="url(#areaGradient)" points={areaPoints} />
        <polyline fill="none" stroke="#6366f1" strokeWidth="2" points={points} />
      </svg>
    );
  };

  const statusTone = funnel.status === "active" ? "success" as const
    : funnel.status === "paused" ? "warning" as const
    : "info" as const;

  return (
    <Page
      backAction={{ content: "Funnel", onAction: () => navigate(`/app/funnels/${funnel.id}`) }}
      title={`${funnel.name} — Analytics`}
      titleMetadata={<Badge tone={statusTone}>{funnel.status}</Badge>}
    >
      <Layout>
        {/* Date Range */}
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
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">Revenue</Text>
                  <Text as="p" variant="heading3xl">${kpis.revenue.toFixed(2)}</Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">Conversion Rate</Text>
                  <Text as="p" variant="heading3xl">{kpis.cvr}%</Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">Impressions</Text>
                  <Text as="p" variant="heading3xl">{kpis.impressions.toLocaleString()}</Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm" tone="subdued">Accepts</Text>
                  <Text as="p" variant="heading3xl">{kpis.accepts}</Text>
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        {/* Revenue Trend */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Revenue Trend</Text>
              {dailyTrend.length > 0 ? (
                <div style={{ width: "100%", overflow: "hidden" }}>
                  {renderTrendChart()}
                </div>
              ) : (
                <Text as="p" tone="subdued">No trend data available for this period.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Step Breakdown */}
        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="0">
              <div style={{ padding: "16px" }}>
                <Text as="h2" variant="headingMd">Per-Step Performance</Text>
              </div>
              {stepBreakdown.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center" }}>
                  <Text as="p" tone="subdued">
                    No step-level data yet. Step analytics are recorded when extensions
                    send events with stepId.
                  </Text>
                </div>
              ) : (
                <IndexTable
                  resourceName={{ singular: "step", plural: "steps" }}
                  itemCount={stepBreakdown.length}
                  headings={[
                    { title: "Widget" },
                    { title: "Placement" },
                    { title: "Impressions" },
                    { title: "Accepts" },
                    { title: "CVR" },
                    { title: "Revenue" },
                  ]}
                  selectable={false}
                >
                  {stepBreakdown.map((step: any, index: number) => (
                    <IndexTable.Row id={step.stepId || String(index)} key={step.stepId || index} position={index}>
                      <IndexTable.Cell>
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="bold" as="span">
                            {step.widgetName}
                          </Text>
                          <Badge>{step.widgetType.replace(/_/g, " ")}</Badge>
                        </BlockStack>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone="info">{step.placement.replace(/_/g, " ")}</Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>{step.impressions.toLocaleString()}</IndexTable.Cell>
                      <IndexTable.Cell>{step.accepts}</IndexTable.Cell>
                      <IndexTable.Cell>{step.cvr}%</IndexTable.Cell>
                      <IndexTable.Cell>${step.revenue.toFixed(2)}</IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* A/B Test Results — Real Significance Analysis */}
        {abTestResults && abTestResults.significance && (
          <Layout.Section>
            <AbTestResults
              significance={abTestResults.significance}
              statsA={abTestResults.statsA}
              statsB={abTestResults.statsB}
              testName={abTestResults.test?.name || "A/B Test"}
            />
          </Layout.Section>
        )}

        {/* Legacy variant breakdown (shown if no active A/B test but variant data exists) */}
        {!abTestResults && variantBreakdown.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Variant Breakdown</Text>
                </InlineStack>
                <Grid>
                  {variantBreakdown.map((v: any) => (
                    <Grid.Cell key={v.variant} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                      <Card>
                        <BlockStack gap="200">
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone={v.variant === "A" ? "success" : "info"}>
                              {`Variant ${v.variant}`}
                            </Badge>
                          </InlineStack>
                          <Grid>
                            <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 3, lg: 4, xl: 4 }}>
                              <Text as="p" variant="bodySm" tone="subdued">CVR</Text>
                              <Text as="p" variant="headingLg">{v.cvr}%</Text>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 3, lg: 4, xl: 4 }}>
                              <Text as="p" variant="bodySm" tone="subdued">Revenue</Text>
                              <Text as="p" variant="headingLg">${v.revenue.toFixed(2)}</Text>
                            </Grid.Cell>
                            <Grid.Cell columnSpan={{ xs: 3, sm: 3, md: 3, lg: 4, xl: 4 }}>
                              <Text as="p" variant="bodySm" tone="subdued">Accepts</Text>
                              <Text as="p" variant="headingLg">{v.accepts}</Text>
                            </Grid.Cell>
                          </Grid>
                        </BlockStack>
                      </Card>
                    </Grid.Cell>
                  ))}
                </Grid>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
