import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  IndexTable,
  Badge,
  EmptyState,
  BlockStack,
  InlineStack,
  Filters,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateStore, deleteFunnel } from "../utils/funnel.server";
import { AbTestBadge } from "../components/AbTestBadge";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const store = await getOrCreateStore(shopDomain, session.accessToken);

  const funnels = await prisma.funnel.findMany({
    where: { storeId: store.id },
    include: {
      steps: {
        include: { widget: true },
        orderBy: { position: "asc" },
      },
      abTests: {
        where: { status: "running" },
        take: 1,
        orderBy: { startedAt: "desc" },
      },
      _count: {
        select: { steps: true, abTests: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return json({ funnels });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const formData = await request.formData();

  if (request.method === "DELETE") {
    const funnelId = formData.get("funnelId") as string;
    if (!funnelId) return json({ error: "Missing funnelId" }, { status: 400 });

    try {
      await deleteFunnel(funnelId);
      return json({ success: true });
    } catch (error) {
      return json({ error: "Failed to delete funnel" }, { status: 500 });
    }
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};

export default function FunnelsIndex() {
  const { funnels } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const statusTone = (status: string) => {
    switch (status) {
      case "active": return "success" as const;
      case "paused": return "warning" as const;
      default: return "info" as const;
    }
  };

  const placementBadges = (steps: any[]) => {
    const placements = [...new Set(steps.map((s: any) => s.placement))];
    return placements.map((p: string) => (
      <Badge key={p} tone="info">
        {p.replace(/_/g, " ")}
      </Badge>
    ));
  };

  const rowMarkup = funnels.map((funnel: any, index: number) => (
    <IndexTable.Row
      id={funnel.id}
      key={funnel.id}
      position={index}
      onClick={() => navigate(`/app/funnels/${funnel.id}`)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {funnel.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={statusTone(funnel.status)}>
          {funnel.status.charAt(0).toUpperCase() + funnel.status.slice(1)}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100">
          {placementBadges(funnel.steps)}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {funnel._count.steps} step{funnel._count.steps !== 1 ? "s" : ""}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {funnel.abTests && funnel.abTests.length > 0 ? (
          <AbTestBadge
            testName={funnel.abTests[0].name}
            testStatus={funnel.abTests[0].status}
          />
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">—</Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {funnel.triggerType.replace(/_/g, " ")}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          tone="critical"
          variant="plain"
          onClick={() => {
            if (confirm("Are you sure you want to delete this funnel? This cannot be undone.")) {
              const formData = new FormData();
              formData.append("funnelId", funnel.id);
              submit(formData, { method: "delete" });
            }
          }}
        >
          Delete
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Funnels"
      primaryAction={
        <Button variant="primary" onClick={() => navigate("/app/funnels/new")}>
          Create Funnel
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {funnels.length === 0 ? (
              <EmptyState
                heading="Build your first upsell funnel"
                action={{
                  content: "Create Funnel",
                  onAction: () => navigate("/app/funnels/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <BlockStack gap="400">
                  <Text as="p" variant="bodyMd">
                    A <b>Funnel</b> is a sequence of upsell steps that trigger at
                    different points in the customer journey — from product page
                    to post-purchase.
                  </Text>
                  <div
                    style={{
                      textAlign: "left",
                      display: "inline-block",
                      margin: "0 auto",
                    }}
                  >
                    <ul
                      style={{
                        paddingLeft: "20px",
                        margin: 0,
                        color: "var(--p-color-text-subdued)",
                      }}
                    >
                      <li>
                        <b>Widgets:</b> Reusable upsell components (product
                        upsell, timer, bundle, etc.)
                      </li>
                      <li>
                        <b>Steps:</b> Place widgets at checkout, post-purchase,
                        thank-you page, etc.
                      </li>
                      <li>
                        <b>Triggers:</b> Control which products, collections, or
                        cart values activate the funnel.
                      </li>
                    </ul>
                  </div>
                </BlockStack>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: "funnel", plural: "funnels" }}
                itemCount={funnels.length}
                headings={[
                  { title: "Name" },
                  { title: "Status" },
                  { title: "Placements" },
                  { title: "Steps" },
                  { title: "A/B Test" },
                  { title: "Trigger" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
