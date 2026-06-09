import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  InlineStack,
  ProgressBar,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getOrCreateStore } from "../utils/funnel.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const store = await getOrCreateStore(shopDomain, session.accessToken);
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  // Check if onboarding is complete (has at least one funnel)
  const funnelCount = await prisma.funnel.count({
    where: { storeId: store.id },
  });

  return json({
    shopDomain,
    apiKey,
    hasFunnels: funnelCount > 0,
    storeId: store.id,
  });
};

export default function Onboarding() {
  const { shopDomain, apiKey, hasFunnels } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  if (hasFunnels) {
    // Already has funnels — redirect to dashboard
    return (
      <Page title="Setup Complete!">
        <Layout>
          <Layout.Section>
            <Banner title="You're all set!" tone="success">
              <p>
                You already have funnels configured. Head to the dashboard to
                manage them.
              </p>
            </Banner>
            <div style={{ marginTop: "16px" }}>
              <Button variant="primary" onClick={() => navigate("/app")}>
                Go to Dashboard
              </Button>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Welcome to FunnelX! 🚀" narrowWidth>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Step 1 of 3</Text>
                  <Text as="span" variant="bodySm" tone="subdued">Setup Progress</Text>
                </InlineStack>
                <ProgressBar progress={33} size="small" tone="primary" />
              </BlockStack>
            </Card>

            {/* Step 1: Enable App Embed */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="headingLg">🔌</Text>
                  <Text as="h2" variant="headingMd">Enable App Embed</Text>
                </InlineStack>
                <Text as="p" variant="bodyMd">
                  To make your upsells visible to customers, enable the FunnelX
                  app embed in your Shopify Theme Editor. This takes less than 30
                  seconds.
                </Text>
                <Button
                  variant="primary"
                  url={`https://${shopDomain}/admin/themes/current/editor?template=product&addAppBlockId=${apiKey}/product_page_fbt&target=main`}
                  target="_blank"
                >
                  Open Theme Editor →
                </Button>
              </BlockStack>
            </Card>

            {/* Step 2: Create First Funnel */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="headingLg">🎯</Text>
                  <Text as="h2" variant="headingMd">Create Your First Funnel</Text>
                </InlineStack>
                <Text as="p" variant="bodyMd">
                  A funnel is a sequence of upsell widgets that trigger based on
                  what's in the customer's cart. Start with a simple product
                  upsell — you can add more steps later.
                </Text>
                <Button onClick={() => navigate("/app/funnels/new")}>
                  Create Funnel →
                </Button>
              </BlockStack>
            </Card>

            {/* Step 3: Go Live */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="headingLg">🚀</Text>
                  <Text as="h2" variant="headingMd">Go Live</Text>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  After creating your funnel, activate it to start showing upsells
                  to customers. You can monitor performance in the Analytics
                  dashboard.
                </Text>
              </BlockStack>
            </Card>

            {/* Skip onboarding */}
            <InlineStack align="center">
              <Button variant="plain" onClick={() => navigate("/app")}>
                Skip setup — I'll explore on my own
              </Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
