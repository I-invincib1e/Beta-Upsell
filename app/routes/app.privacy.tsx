import { Page, Layout, Card, BlockStack, Text, List, Link } from "@shopify/polaris";

const SUPPORT_EMAIL = "hello@adloomx.com";

export default function PrivacyPolicyPage() {
  return (
    <Page title="Privacy Policy">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="p" variant="bodyMd">
                This privacy policy describes how Beta-Upsell (&quot;we&quot;, &quot;the app&quot;)
                collects, uses, and deletes data when merchants install the app on their Shopify
                store.
              </Text>

              <Text as="h2" variant="headingMd">
                Data we collect
              </Text>
              <List>
                <List.Item>
                  Shop domain and OAuth session data required to operate the embedded app.
                </List.Item>
                <List.Item>
                  Offer configuration you create (products, discounts, placement settings).
                </List.Item>
                <List.Item>
                  Aggregated upsell analytics (impressions, accepts, declines, revenue estimates).
                </List.Item>
                <List.Item>
                  Optional customer and order identifiers on offer events when storefront
                  extensions report interactions.
                </List.Item>
              </List>

              <Text as="h2" variant="headingMd">
                How we use data
              </Text>
              <Text as="p" variant="bodyMd">
                Data is used only to provide upsell functionality, analytics in the admin, and
                billing for paid plans. We do not sell merchant or customer data.
              </Text>

              <Text as="h2" variant="headingMd">
                Data retention and deletion
              </Text>
              <Text as="p" variant="bodyMd">
                When you uninstall the app, we delete shop sessions and merchant app data associated
                with your store. Customer data requests and redactions are processed via Shopify
                mandatory compliance webhooks.
              </Text>

              <Text as="h2" variant="headingMd">
                Contact
              </Text>
              <Text as="p" variant="bodyMd">
                Questions about privacy or data requests:{" "}
                <Link url={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>
              </Text>

              <Text as="p" variant="bodySm" tone="subdued">
                Last updated: June 2026
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
