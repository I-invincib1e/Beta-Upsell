import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Grid,
  Box,
  CalloutCard,
  Badge,
  Banner,
  InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getMerchantPlan } from "../utils/merchant-plan.server";
import { computeOfferHealth } from "../utils/offer-health";
import { PRO_PLAN_NAME } from "../utils/billing";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const { plan, displayName } = await getMerchantPlan(shopDomain, billing);

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { offers: true },
  });

  const totalOffers = store?.offers.length || 0;
  const activeOffers = store?.offers.filter(o => o.isActive).length || 0;

  // Aggregate real analytics from the database
  const analyticsData = await prisma.analyticsDaily.aggregate({
    where: { storeId: store?.id },
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

  const needsSyncCount =
    store?.offers.filter((o) => computeOfferHealth(o) === "needs_sync").length ??
    0;

  return json({
    totalOffers,
    activeOffers,
    analytics,
    shopDomain,
    apiKey: process.env.SHOPIFY_API_KEY || "",
    plan,
    planLabel: displayName,
    needsSyncCount,
  });
};

export default function Dashboard() {
  const {
    totalOffers,
    activeOffers,
    analytics,
    shopDomain,
    apiKey,
    plan,
    planLabel,
    needsSyncCount,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  
  const showSetupGuide = totalOffers === 0;

  return (
    <Page
      title="Dashboard Overview"
      primaryAction={<Button variant="primary" onClick={() => navigate("/app/offers/new")}>Create Offer</Button>}
    >
      <Layout>
        {needsSyncCount > 0 && (
          <Layout.Section>
            <Banner
              tone="warning"
              title={`${needsSyncCount} offer(s) need discount sync`}
              action={{
                content: "Go to Offers",
                onAction: () => navigate("/app/offers"),
              }}
            >
              <p>
                Open Offers and run <b>Sync discount codes</b> so storefront discounts match your admin settings.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Your plan
                </Text>
                <Badge tone={plan === "pro" ? "success" : "info"}>{planLabel}</Badge>
              </InlineStack>
              <Text as="p" variant="bodyMd" tone="subdued">
                {plan === "pro"
                  ? "Pro unlocks all placements and unlimited active offers."
                  : "Free includes 1 active offer on cart and product page. Upgrade for checkout, post-purchase, and thank-you."}
              </Text>
              {plan !== "pro" && (
                <Button onClick={() => navigate("/app/pricing")}>
                  Upgrade to {PRO_PLAN_NAME}
                </Button>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {showSetupGuide && (
          <Layout.Section>
            <CalloutCard
              title="Welcome to Beta-Upsell! Let's get you set up. 🚀"
              illustration="https://cdn.shopify.com/s/assets/admin/checkout/settings-customizecart-705f57c725ac05be5a34ec20c05b94298cb8afd100f26ceaf27f6ce7e95ad3e2.svg"
              primaryAction={{
                content: "Enable App Embed in Theme",
                url: `https://${shopDomain}/admin/themes/current/editor?template=product&addAppBlockId=${apiKey}/product_page_fbt&target=main`,
                target: "_blank"
              }}
              secondaryAction={{
                content: "Create your first offer",
                onAction: () => navigate("/app/offers/new")
              }}
            >
              <p>
                To make your upsells visible to customers, you must first enable the Beta-Upsell app embed in your Shopify Theme Editor. 
                Click the button below to automatically open your theme settings.
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

        {totalOffers < 3 && (
          <Layout.Section>
            <Card background="bg-surface-secondary">
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">How Beta-Upsell Works</Text>
                <Grid>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">1. Pick Products</Text>
                      <Text as="p" variant="bodyMd">Choose a high-traffic product and a complementary item to bundle with it.</Text>
                    </BlockStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">2. Display Widget</Text>
                      <Text as="p" variant="bodyMd">We automatically inject a beautiful bundle widget directly on your product page or cart drawer.</Text>
                    </BlockStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
                    <BlockStack gap="200">
                      <Text as="h3" variant="headingMd">3. Increase AOV</Text>
                      <Text as="p" variant="bodyMd">Customers add both items to their cart with one click, instantly increasing your average order value.</Text>
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
              <Text as="h2" variant="headingLg">Your Offers</Text>
              <Box paddingBlockEnd="200">
                <Text as="p" variant="bodyMd">
                  You have {activeOffers} active offers out of {totalOffers} total created.
                </Text>
              </Box>
              <div>
                <Button onClick={() => navigate("/app/offers")}>View All Offers</Button>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card background="bg-surface-secondary">
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Need Help?</Text>
              <Text as="p" variant="bodyMd">
                Our team is here to help you get the most out of Beta-Upsell. We usually respond within 24 hours.
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
