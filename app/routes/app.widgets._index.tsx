/**
 * Widget Library Page
 *
 * Browse all widget types, view existing widgets, create new reusable widgets.
 * Grouped by category with search + filter. Shows usage count per widget.
 */

import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Grid,
  Tabs,
  BlockStack,
  InlineStack,
  Badge,
  IndexTable,
  Button,
  TextField,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrCreateStore, getWidgets, createWidget, deleteWidget } from "../utils/funnel.server";
import { WIDGET_TYPE_REGISTRY, getDefaultConfig } from "../types/widgets";
import type { WidgetType } from "../types/widgets";
import { WidgetTypeCard } from "../components/WidgetLibrary";
import { useState, useCallback } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await getOrCreateStore(session.shop, session.accessToken);
  const widgets = await getWidgets(store.id);
  return json({ widgets, plan: store.plan });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  try {
    const store = await getOrCreateStore(session.shop, session.accessToken);

    switch (intent) {
      case "create_widget": {
        const widgetType = formData.get("widgetType") as WidgetType;
        const name = formData.get("name") as string || `${widgetType.replace(/_/g, " ")} widget`;
        const defaultConfig = getDefaultConfig(widgetType);
        await createWidget(store.id, {
          type: widgetType,
          name,
          config: defaultConfig,
        });
        return json({ success: true });
      }

      case "delete_widget": {
        const widgetId = formData.get("widgetId") as string;
        await deleteWidget(widgetId);
        return json({ success: true });
      }

      default:
        return json({ error: `Unknown intent: ${intent}` }, { status: 400 });
    }
  } catch (error: any) {
    return json({ error: error.message || "Operation failed" }, { status: 500 });
  }
};

export default function WidgetsIndex() {
  const { widgets, plan } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [selectedTab, setSelectedTab] = useState(0);
  const [search, setSearch] = useState("");

  const tabs = [
    { id: "all", content: "All Types", panelID: "all" },
    { id: "core", content: "⚡ Core", panelID: "core" },
    { id: "depth", content: "📈 Growth", panelID: "depth" },
    { id: "power", content: "🚀 Pro", panelID: "power" },
    { id: "my_widgets", content: "My Widgets", panelID: "my_widgets" },
  ];

  const category = tabs[selectedTab].id;

  // Count widgets per type
  const widgetCountByType: Record<string, number> = {};
  (widgets || []).forEach((w: any) => {
    widgetCountByType[w.type] = (widgetCountByType[w.type] || 0) + 1;
  });

  // Filter widget types
  const filteredTypes = WIDGET_TYPE_REGISTRY.filter((meta) => {
    if (category !== "all" && category !== "my_widgets" && meta.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        meta.label.toLowerCase().includes(q) ||
        meta.description.toLowerCase().includes(q) ||
        meta.type.includes(q)
      );
    }
    return true;
  });

  const handleCreateWidget = useCallback((type: string) => {
    const fd = new FormData();
    fd.append("intent", "create_widget");
    fd.append("widgetType", type);
    submit(fd, { method: "post" });
  }, [submit]);

  const handleDeleteWidget = useCallback((widgetId: string) => {
    if (!confirm("Delete this widget? It will fail if used in any funnel.")) return;
    const fd = new FormData();
    fd.append("intent", "delete_widget");
    fd.append("widgetId", widgetId);
    submit(fd, { method: "post" });
  }, [submit]);

  return (
    <Page
      title="Widget Library"
      subtitle="Browse, create, and manage reusable upsell widgets"
    >
      <TitleBar title="Widget Library" />

      <Layout>
        {/* Tabs + Search */}
        <Layout.Section>
          <Card padding="0">
            <div style={{ padding: "16px 16px 0" }}>
              <InlineStack align="space-between" blockAlign="center">
                <Tabs
                  tabs={tabs}
                  selected={selectedTab}
                  onSelect={setSelectedTab}
                  fitted={false}
                />
                <div style={{ width: "240px" }}>
                  <TextField
                    label="Search"
                    labelHidden
                    value={search}
                    onChange={setSearch}
                    placeholder="Search widgets..."
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setSearch("")}
                  />
                </div>
              </InlineStack>
            </div>
          </Card>
        </Layout.Section>

        {/* Widget Type Grid (Browse) */}
        {category !== "my_widgets" && (
          <Layout.Section>
            <Grid>
              {filteredTypes.map((meta) => (
                <Grid.Cell
                  key={meta.type}
                  columnSpan={{ xs: 6, sm: 3, md: 3, lg: 4, xl: 4 }}
                >
                  <WidgetTypeCard
                    meta={meta}
                    widgetCount={widgetCountByType[meta.type] || 0}
                    onCreateWidget={handleCreateWidget}
                    currentTier={plan}
                  />
                </Grid.Cell>
              ))}
            </Grid>
            {filteredTypes.length === 0 && (
              <Card>
                <Text as="p" tone="subdued" alignment="center">
                  No widget types match your search.
                </Text>
              </Card>
            )}
          </Layout.Section>
        )}

        {/* My Widgets Table */}
        {category === "my_widgets" && (
          <Layout.Section>
            <Card padding="0">
              {(widgets || []).length === 0 ? (
                <EmptyState
                  heading="No widgets created yet"
                  action={{
                    content: "Browse Widget Types",
                    onAction: () => setSelectedTab(0),
                  }}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <Text as="p" variant="bodyMd">
                    Create your first widget from the widget type catalog, then
                    add it to any funnel.
                  </Text>
                </EmptyState>
              ) : (
                <IndexTable
                  resourceName={{ singular: "widget", plural: "widgets" }}
                  itemCount={(widgets || []).length}
                  headings={[
                    { title: "Name" },
                    { title: "Type" },
                    { title: "Used In" },
                    { title: "Created" },
                    { title: "Actions" },
                  ]}
                  selectable={false}
                >
                  {(widgets || []).map((widget: any, index: number) => (
                    <IndexTable.Row
                      id={widget.id}
                      key={widget.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Text variant="bodyMd" fontWeight="bold" as="span">
                          {widget.name}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone="info">
                          {widget.type.replace(/_/g, " ")}
                        </Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {widget._count?.steps > 0
                          ? `${widget._count.steps} funnel${widget._count.steps !== 1 ? "s" : ""}`
                          : "Not used"}
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {new Date(widget.createdAt).toLocaleDateString()}
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Button
                          tone="critical"
                          variant="plain"
                          onClick={() => handleDeleteWidget(widget.id)}
                        >
                          Delete
                        </Button>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        )}

        {/* Stats Summary */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text as="h3" variant="headingSm">Quick Stats</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {`${(widgets || []).length} widgets created · ${WIDGET_TYPE_REGISTRY.length} types available · Plan: ${plan}`}
                </Text>
              </BlockStack>
              <Button onClick={() => navigate("/app/funnels")}>
                Go to Funnels →
              </Button>
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
