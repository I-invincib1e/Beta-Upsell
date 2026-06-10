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

            {/* Step 1: Enable App Extensions */}
            <Card>
              <BlockStack gap="400">
                <InlineStack gap="200" blockAlign="center">
                  <Text as="span" variant="headingLg">🔌</Text>
                  <Text as="h2" variant="headingMd">Enable App Extensions</Text>
                </InlineStack>
                <Text as="p" variant="bodyMd">
                  To make your upsells visible to customers, you need to enable the app extensions in your Shopify store. Depending on where you want the funnels to appear, click the buttons below to open the correct editor.
                </Text>
                
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">Theme App Blocks (Cart/Product Page)</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Add the FunnelX block to your product page or cart drawer.</Text>
                    </BlockStack>
                    <Button
                      variant="primary"
                      url={`https://${shopDomain}/admin/themes/current/editor?context=apps`}
                      target="_blank"
                    >
                      Open Theme Editor
                    </Button>
                  </InlineStack>

                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">Checkout Upsells</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Add the FunnelX block to your checkout flow.</Text>
                    </BlockStack>
                    <Button
                      url={`https://${shopDomain}/admin/settings/checkout/editor`}
                      target="_blank"
                    >
                      Open Checkout Editor
                    </Button>
                  </InlineStack>

                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">Post-Purchase Offers</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Select FunnelX as your Post-Purchase app in checkout settings.</Text>
                    </BlockStack>
                    <Button
                      url={`https://${shopDomain}/admin/settings/checkout`}
                      target="_blank"
                    >
                      Post-Purchase Settings
                    </Button>
                  </InlineStack>
                </BlockStack>
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
