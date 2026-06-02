import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Grid, IndexTable, Badge, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: {
      offers: true,
    }
  });

  if (!store) {
    return json({ kpis: null, topOffers: [], placementData: [] });
  }

  // 1. Global KPIs
  const agg = await prisma.analyticsDaily.aggregate({
    where: { storeId: store.id },
    _sum: {
      impressions: true,
      accepts: true,
      totalUpsellRevenue: true,
    }
  });

  const impressions = agg._sum.impressions || 0;
  const accepts = agg._sum.accepts || 0;
  const totalRevenue = agg._sum.totalUpsellRevenue || 0;
  const acceptanceRate = impressions > 0 ? ((accepts / impressions) * 100).toFixed(1) : "0.0";
  const aovLift = accepts > 0 ? (totalRevenue / accepts).toFixed(2) : "0.00";

  // 2. Best Performing Offers
  const analyticsByOffer = await prisma.analyticsDaily.groupBy({
    by: ['offerId'],
    where: { storeId: store.id },
    _sum: {
      totalUpsellRevenue: true,
      accepts: true,
      impressions: true
    },
    orderBy: {
      _sum: {
        totalUpsellRevenue: 'desc'
      }
    },
    take: 10
  });

  // Hydrate with offer details
  const topOffers = analyticsByOffer.map(stat => {
    const offer = store.offers.find(o => o.id === stat.offerId);
    const imp = stat._sum.impressions || 0;
    const acc = stat._sum.accepts || 0;
    const rate = imp > 0 ? ((acc / imp) * 100).toFixed(1) : "0.0";
    return {
      id: stat.offerId,
      name: offer?.name || "Deleted Offer",
      type: offer?.type || "unknown",
      revenue: stat._sum.totalUpsellRevenue || 0,
      accepts: acc,
      rate
    };
  });

  // 3. Placement Performance
  const placementStats: Record<string, number> = {
    post_purchase: 0,
    cart: 0,
    product_page: 0
  };

  const allAnalytics = await prisma.analyticsDaily.findMany({
    where: { storeId: store.id },
    include: { offer: true }
  });

  allAnalytics.forEach(row => {
    if (row.offer && row.offer.type) {
      if (!placementStats[row.offer.type]) placementStats[row.offer.type] = 0;
      placementStats[row.offer.type] += row.totalUpsellRevenue;
    }
  });

  const placementData = Object.keys(placementStats).map(type => ({
    type,
    revenue: placementStats[type]
  })).sort((a, b) => b.revenue - a.revenue);

  return json({
    kpis: {
      totalRevenue: `$${totalRevenue.toFixed(2)}`,
      acceptanceRate: `${acceptanceRate}%`,
      aovLift: `+$${aovLift}`
    },
    topOffers,
    placementData
  });
};

export default function AnalyticsDashboard() {
  const { kpis, topOffers, placementData } = useLoaderData<typeof loader>();

  if (!kpis) return null;

  return (
    <Page title="Advanced Analytics">
      <Layout>
        <Layout.Section>
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
              <div className="beta-kpi-card-1" style={{ height: '100%', borderRadius: '12px' }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Overall Acceptance Rate</Text>
                    <Text as="p" variant="heading3xl">{kpis.acceptanceRate}</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
              <div className="beta-kpi-card-2" style={{ height: '100%', borderRadius: '12px' }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Average Order Value Lift</Text>
                    <Text as="p" variant="heading3xl">{kpis.aovLift}</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
              <div className="beta-kpi-card-3" style={{ height: '100%', borderRadius: '12px' }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm" tone="subdued">Total Upsell Revenue</Text>
                    <Text as="p" variant="heading3xl">{kpis.totalRevenue}</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        <Layout.Section>
          <Grid>
            <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4, lg: 8, xl: 8 }}>
              <Card padding="0">
                <BlockStack gap="400">
                  <div style={{ padding: '16px' }}>
                    <Text as="h2" variant="headingMd">Best Performing Offers</Text>
                  </div>
                  <IndexTable
                    resourceName={{ singular: 'offer', plural: 'offers' }}
                    itemCount={topOffers.length}
                    headings={[
                      { title: 'Offer Name' },
                      { title: 'Placement' },
                      { title: 'Accepts' },
                      { title: 'Conversion Rate' },
                      { title: 'Revenue generated' },
                    ]}
                    selectable={false}
                  >
                    {topOffers.map((offer, index) => (
                      <IndexTable.Row id={offer.id} key={offer.id} position={index}>
                        <IndexTable.Cell><Text variant="bodyMd" fontWeight="bold" as="span">{offer.name}</Text></IndexTable.Cell>
                        <IndexTable.Cell>
                          <Badge>{offer.type.replace('_', ' ')}</Badge>
                        </IndexTable.Cell>
                        <IndexTable.Cell>{offer.accepts}</IndexTable.Cell>
                        <IndexTable.Cell>{offer.rate}%</IndexTable.Cell>
                        <IndexTable.Cell>${offer.revenue.toFixed(2)}</IndexTable.Cell>
                      </IndexTable.Row>
                    ))}
                  </IndexTable>
                  {topOffers.length === 0 && (
                     <div style={{ padding: '16px', textAlign: 'center' }}>
                       <Text as="p" tone="subdued">Not enough data yet. Check back after your first few sales!</Text>
                     </div>
                  )}
                </BlockStack>
              </Card>
            </Grid.Cell>

            <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Revenue by Placement</Text>
                  {placementData.length === 0 ? (
                    <Text as="p" tone="subdued">No placement data available yet.</Text>
                  ) : (
                    <BlockStack gap="300">
                      {placementData.map((p) => (
                        <div key={p.type} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #ebebeb' }}>
                          <span style={{ textTransform: 'capitalize' }}>{p.type.replace('_', ' ')}</span>
                          <span style={{ fontWeight: 'bold' }}>${p.revenue.toFixed(2)}</span>
                        </div>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
