import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useRouteLoaderData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Button, Grid, Box, CalloutCard, Badge, InlineStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateStore } from "../utils/funnel.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const shopDomain = session.shop;
  const store = await getOrCreateStore(shopDomain, session.accessToken);

  // Count funnels (new system)
  const totalFunnels = await prisma.funnel.count({ where: { storeId: store.id } });
  const activeFunnels = await prisma.funnel.count({ where: { storeId: store.id, status: "active" } });

  // Also count legacy offers (for transition period)
  const totalOffers = await prisma.offer.count({ where: { storeId: store.id } });

  // Aggregate real analytics from the database
  const analyticsData = await prisma.analyticsDaily.aggregate({
    where: { storeId: store.id },
    _sum: {
      impressions: true,
      accepts: true,
      totalUpsellRevenue: true,
    }
  });

  const impressions = analyticsData._sum.impressions || 0;
  const accepts = analyticsData._sum.accepts || 0;
  const revenue = analyticsData._sum.totalUpsellRevenue || 0;
  const convRate = impressions > 0 ? ((accepts / impressions) * 100).toFixed(1) : "0.0";

  const analytics = {
    totalRevenue: `$${revenue.toFixed(2)}`,
    conversionRate: `${convRate}%`,
    upsellViews: impressions,
    acceptedOffers: accepts
  };

  return json({ 
    totalFunnels,
    activeFunnels,
    totalOffers,
    analytics, 
    shopDomain,
    apiKey: process.env.SHOPIFY_API_KEY || ""
  });
};


export default function Dashboard() {
  const { totalFunnels, activeFunnels, totalOffers, analytics, shopDomain, apiKey } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const rootData = useRouteLoaderData<{ activePlan: string; planTier: string }>("routes/app");
  const activePlan = rootData?.activePlan || "Free Plan";
  
  const showSetupGuide = totalFunnels === 0 && totalOffers === 0;
  const showMigrationHint = totalOffers > 0 && totalFunnels === 0;

  return (
    <Page
      title="Dashboard Overview"
      primaryAction={<Button variant="primary" onClick={() => navigate("/app/funnels/new")}>Create Funnel</Button>}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="300" blockAlign="center">
                <Text as="span" variant="bodyMd">Current Plan:</Text>
                <Badge tone={activePlan === "Free Plan" ? "info" : "success"}>{activePlan}</Badge>
              </InlineStack>
              {activePlan === "Free Plan" && (
                <Button variant="primary" onClick={() => navigate("/app/pricing")}>Upgrade Plan</Button>
              )}
              {activePlan !== "Free Plan" && (
                <Button onClick={() => navigate("/app/pricing")}>Manage Plan</Button>
              )}
            </InlineStack>
          </Card>
        </Layout.Section>

        {showSetupGuide && (
          <Layout.Section>
            <CalloutCard
              title="Welcome to FunnelX! Let's get you set up. 🚀"
              illustration="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd100f26ceaf27f6ce7e95ad3e2.svg"
              primaryAction={{
                content: "Enable App Embed in Theme",
                url: `https://${shopDomain}/admin/themes/current/editor?template=product&addAppBlockId=${apiKey}/product_page_fbt&target=main`,
                target: "_blank"
              }}
              secondaryAction={{
                content: "Start onboarding",
                onAction: () => navigate("/app/onboarding")
              }}
            >
              <p>
                To make your upsells visible to customers, enable the FunnelX app embed in your Shopify Theme Editor. 
                Then create your first funnel to start increasing your Average Order Value.
              </p>
            </CalloutCard>
          </Layout.Section>
        )}

        {showMigrationHint && (
          <Layout.Section>
            <CalloutCard
              title="Migrate your legacy offers"
              illustration="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd100f26ceaf27f6ce7e95ad3e2.svg"
              primaryAction={{
                content: "Run Migration",
                onAction: () => navigate("/app/migrate-legacy-data")
              }}
            >
              <p>
                You have {totalOffers} legacy offer{totalOffers !== 1 ? "s" : ""} that can be migrated to the new funnel system. 
                The migration will create a funnel for each offer — your existing data is preserved.
              </p>
            </CalloutCard>
          </Layout.Section>
        )}

        <Layout.Section>
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <div className="beta-kpi-card-1" style={{ height: '100%', borderRadius: '12px' }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Extra Revenue</Text>
                    <Text as="p" variant="heading3xl">{analytics.totalRevenue}</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <div className="beta-kpi-card-2" style={{ height: '100%', borderRadius: '12px' }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Conversion Rate</Text>
                    <Text as="p" variant="heading3xl">{analytics.conversionRate}</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <div className="beta-kpi-card-3" style={{ height: '100%', borderRadius: '12px' }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Total Views</Text>
                    <Text as="p" variant="heading3xl">{analytics.upsellViews}</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
              <div className="beta-kpi-card-4" style={{ height: '100%', borderRadius: '12px' }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Accepted Offers</Text>
                    <Text as="p" variant="heading3xl">{analytics.acceptedOffers}</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        {totalFunnels < 3 && totalFunnels > 0 && (
          <Layout.Section>
            <Card background="bg-surface-secondary">
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">How FunnelX Works</Text>
                <Grid>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">1. Build Funnels</Text>
                      <Text as="p" variant="bodyMd">Create funnels with widgets that trigger at different points in the customer journey.</Text>
                    </BlockStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">2. Add Widgets</Text>
                      <Text as="p" variant="bodyMd">Choose from product upsells, cross-sells, timers, order bumps and more — placed at checkout, post-purchase, or thank-you page.</Text>
                    </BlockStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">3. Grow Revenue</Text>
                      <Text as="p" variant="bodyMd">Watch your Average Order Value climb. Track performance with real-time analytics and A/B testing.</Text>
                    </BlockStack>
                  </Grid.Cell>
                </Grid>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Your Funnels</Text>
              <Box paddingBlockEnd="200">
                <Text as="p" variant="bodyMd">
                  You have {activeFunnels} active funnel{activeFunnels !== 1 ? "s" : ""} out of {totalFunnels} total created.
                </Text>
              </Box>
              <div>
                <Button onClick={() => navigate("/app/funnels")}>View All Funnels</Button>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card background="bg-surface-secondary">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Need Help?</Text>
              <Text as="p" variant="bodyMd">
                Our team is here to help you get the most out of FunnelX. We usually respond within 24 hours.
              </Text>
              <Button url="mailto:hello@adloomx.com" target="_blank">
                Email Support (hello@adloomx.com)
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
