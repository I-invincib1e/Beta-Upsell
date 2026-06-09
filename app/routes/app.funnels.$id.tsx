import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Badge,
  InlineStack,
  Banner,
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  Button,
  IndexTable,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getFunnel, updateFunnel, deleteFunnel } from "../utils/funnel.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const funnelId = params.id;

  if (!funnelId) {
    return json({ funnel: null, error: "Missing funnel ID" }, { status: 400 });
  }

  const funnel = await getFunnel(funnelId);

  if (!funnel) {
    return json({ funnel: null, error: "Funnel not found" }, { status: 404 });
  }

  return json({ funnel, error: null });
};

export default function FunnelDetail() {
  const { funnel, error } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  if (error || !funnel) {
    return (
      <Page
        backAction={{ content: "Funnels", onAction: () => navigate("/app/funnels") }}
        title="Funnel Not Found"
      >
        <Layout>
          <Layout.Section>
            <Banner title="Funnel not found" tone="critical">
              <p>{error || "This funnel does not exist or has been deleted."}</p>
            </Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const statusTone = (status: string) => {
    switch (status) {
      case "active": return "success" as const;
      case "paused": return "warning" as const;
      default: return "info" as const;
    }
  };

  return (
    <Page
      backAction={{ content: "Funnels", onAction: () => navigate("/app/funnels") }}
      title={funnel.name}
      titleMetadata={
        <Badge tone={statusTone(funnel.status)}>
          {funnel.status.charAt(0).toUpperCase() + funnel.status.slice(1)}
        </Badge>
      }
    >
      <TitleBar title={funnel.name} />

      <Layout>
        {/* Funnel Canvas Placeholder — Sprint 2 */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Funnel Canvas</Text>
                <Badge tone="attention">Coming in Sprint 2</Badge>
              </InlineStack>
              <Banner tone="info">
                <p>
                  The visual funnel canvas with drag-and-drop step management is
                  being built in Sprint 2. For now, you can view your funnel
                  steps below.
                </p>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Funnel Steps */}
        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="0">
              <div style={{ padding: "16px" }}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Steps ({funnel.steps.length})
                  </Text>
                </InlineStack>
              </div>
              {funnel.steps.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center" }}>
                  <Text as="p" tone="subdued">
                    No steps yet. Use the canvas (Sprint 2) to add widgets to this funnel.
                  </Text>
                </div>
              ) : (
                <IndexTable
                  resourceName={{ singular: "step", plural: "steps" }}
                  itemCount={funnel.steps.length}
                  headings={[
                    { title: "Position" },
                    { title: "Widget" },
                    { title: "Type" },
                    { title: "Placement" },
                  ]}
                  selectable={false}
                >
                  {funnel.steps.map((step: any, index: number) => (
                    <IndexTable.Row id={step.id} key={step.id} position={index}>
                      <IndexTable.Cell>
                        <Text variant="bodyMd" as="span">#{step.position + 1}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodyMd" fontWeight="bold" as="span">
                          {step.widget?.name || "Unnamed Widget"}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge>
                          {(step.widget?.type || "unknown").replace(/_/g, " ")}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone="info">
                          {step.placement.replace(/_/g, " ")}
                        </Badge>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Funnel Details */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Details</Text>
              <BlockStack gap="200">
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" tone="subdued">Trigger:</Text>
                  <Text as="span" variant="bodySm">{funnel.triggerType.replace(/_/g, " ")}</Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" tone="subdued">Created:</Text>
                  <Text as="span" variant="bodySm">
                    {new Date(funnel.createdAt).toLocaleDateString()}
                  </Text>
                </InlineStack>
                <InlineStack gap="200">
                  <Text as="span" variant="bodySm" tone="subdued">Updated:</Text>
                  <Text as="span" variant="bodySm">
                    {new Date(funnel.updatedAt).toLocaleDateString()}
                  </Text>
                </InlineStack>
                {funnel.abTests && funnel.abTests.length > 0 && (
                  <InlineStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">A/B Tests:</Text>
                    <Badge tone="attention">{funnel.abTests.length} active</Badge>
                  </InlineStack>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
