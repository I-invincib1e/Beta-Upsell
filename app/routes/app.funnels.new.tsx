import { useState, useCallback } from "react";
import { json, ActionFunctionArgs, LoaderFunctionArgs, redirect } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Select,
  Button,
  InlineStack,
  Text,
  Banner,
  List,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate, useSubmit, useActionData, useNavigation, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { getOrCreateStore, createFunnel, createWidget, addStepToFunnel, getActiveFunnelCount } from "../utils/funnel.server";
import { resolveActivePlan, getPlanConfig } from "../utils/billing";
import { getDefaultConfig } from "../types/widgets";
import type { WidgetType } from "../types/widgets";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await getOrCreateStore(session.shop, session.accessToken);
  const activeFunnelCount = await getActiveFunnelCount(store.id);

  return json({ activeFunnelCount, storeId: store.id });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const triggerType = formData.get("triggerType") as string;
  const widgetType = (formData.get("widgetType") as WidgetType) || "product_upsell";
  const placement = formData.get("placement") as string;

  if (!name) {
    return json({ error: "Funnel name is required." }, { status: 400 });
  }

  const store = await getOrCreateStore(session.shop, session.accessToken);

  // Server-side plan limit enforcement
  const plansToCheck: string[] = ["Growth Plan", "FunnelX Pro", "Pro Plan"];
  const billingCheck = await billing.check({ plans: plansToCheck as any, isTest: true });
  const subscriptionName = billingCheck.hasActivePayment
    ? billingCheck.appSubscriptions[0].name
    : null;
  const { tier } = resolveActivePlan(subscriptionName);
  const planConfig = getPlanConfig(tier);
  const activeFunnelCount = await getActiveFunnelCount(store.id);

  if (planConfig.funnelLimit !== null && activeFunnelCount >= planConfig.funnelLimit) {
    return json(
      { error: `You've reached the ${planConfig.funnelLimit}-funnel limit on your ${planConfig.name}. Upgrade to create more.` },
      { status: 403 }
    );
  }

  try {
    // Create the funnel
    const funnel = await createFunnel(store.id, {
      name,
      triggerType: triggerType || "all",
    });

    // Create a default widget and add it as the first step
    const defaultConfig = getDefaultConfig(widgetType);
    const widget = await createWidget(store.id, {
      type: widgetType,
      name: `${name} — ${widgetType.replace(/_/g, " ")}`,
      config: defaultConfig,
    });

    await addStepToFunnel({
      funnelId: funnel.id,
      widgetId: widget.id,
      placement: placement || "checkout",
      position: 0,
    });

    return redirect(`/app/funnels/${funnel.id}`);
  } catch (error) {
    console.error("Funnel creation error:", error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return json({ error: `Failed to create funnel: ${message}` }, { status: 500 });
  }
};

export default function NewFunnel() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<any>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const { activeFunnelCount } = useLoaderData<typeof loader>();
  const rootData = useRouteLoaderData<{ activePlan: string; planTier: string }>("routes/app");
  const planTier = (rootData?.planTier || "free") as "free" | "growth" | "pro";
  const planConfig = getPlanConfig(planTier);

  const isLimitReached = planConfig.funnelLimit !== null && activeFunnelCount >= planConfig.funnelLimit;

  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("all");
  const [widgetType, setWidgetType] = useState<WidgetType>("product_upsell");
  const [placement, setPlacement] = useState("checkout");

  const handleSave = useCallback(() => {
    if (!name) return;

    const formData = new FormData();
    formData.append("name", name);
    formData.append("triggerType", triggerType);
    formData.append("widgetType", widgetType);
    formData.append("placement", placement);

    submit(formData, { method: "post" });
  }, [name, triggerType, widgetType, placement, submit]);

  return (
    <Page
      backAction={{ content: "Funnels", onAction: () => navigate("/app/funnels") }}
      title="Create New Funnel"
    >
      <TitleBar title="Create New Funnel">
        <button variant="primary" onClick={handleSave} disabled={isSaving || isLimitReached}>
          {isSaving ? "Creating..." : "Create Funnel"}
        </button>
      </TitleBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {isLimitReached && (
              <Banner
                title="Funnel Limit Reached"
                tone="warning"
                action={{ content: "Upgrade Plan", onAction: () => navigate("/app/pricing") }}
              >
                <p>
                  You have reached the maximum number of active funnels for your plan
                  ({planConfig.funnelLimit} funnel{planConfig.funnelLimit !== 1 ? "s" : ""}).
                  Upgrade to create more.
                </p>
              </Banner>
            )}

            {actionData?.error && (
              <Banner title="Error" tone="critical">
                <p>{actionData.error}</p>
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Funnel Details</Text>
                <TextField
                  label="Funnel Name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                  helpText="Internal name to identify this funnel (e.g. 'Black Friday Bundle', 'First Purchase Upsell')."
                />
                <Select
                  label="Trigger"
                  options={[
                    { label: "All products (storewide)", value: "all" },
                    { label: "Specific products", value: "product" },
                    { label: "Specific collections", value: "collection" },
                    { label: "Cart value threshold", value: "cart_value" },
                  ]}
                  value={triggerType}
                  onChange={setTriggerType}
                  helpText="When should this funnel activate?"
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">First Widget</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Every funnel starts with at least one widget. You can add more after creation in the funnel canvas.
                </Text>
                <Select
                  label="Widget Type"
                  options={[
                    // Core (Free)
                    { label: "Product Upsell — recommend a single product", value: "product_upsell" },
                    { label: "Cross-Sell — suggest complementary products", value: "cross_sell" },
                    { label: "Discount Timer — countdown with auto-apply code", value: "discount_timer" },
                    { label: "Order Bump — checkbox add-on at checkout", value: "order_bump" },
                    // Depth (Growth)
                    { label: "📦 Bundle Offer — buy X+Y together [Growth]", value: "bundle_offer" },
                    { label: "⭐ Review Request — post-purchase reviews [Growth]", value: "review_request" },
                    { label: "📱 Social Share — share for discount [Growth]", value: "social_share" },
                    { label: "📋 Survey — 1-question feedback [Growth]", value: "survey" },
                    { label: "🚚 Free Shipping Bar — progress bar [Growth]", value: "free_shipping_bar" },
                    // Power (Pro)
                    { label: "💎 Loyalty Points — Smile.io compatible [Pro]", value: "loyalty_points" },
                    { label: "🔄 Reorder Upsell — buy again for repeats [Pro]", value: "reorder_upsell" },
                    { label: "🗂️ Related Collection — collection recs [Pro]", value: "related_collection" },
                    { label: "🎂 Birthday Capture — CRM birthday [Pro]", value: "birthday_capture" },
                  ]}
                  value={widgetType}
                  onChange={(val) => setWidgetType(val as WidgetType)}
                />
                <Select
                  label="Placement"
                  options={[
                    { label: "Checkout", value: "checkout" },
                    { label: "Post-Purchase", value: "post_purchase" },
                    { label: "Thank You Page", value: "thank_you" },
                    { label: "Product Page", value: "product_page" },
                    { label: "Cart Drawer", value: "cart" },
                  ]}
                  value={placement}
                  onChange={setPlacement}
                  helpText="Where in the customer journey should this widget appear?"
                />
              </BlockStack>
            </Card>

            <InlineStack align="end">
              <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isLimitReached}>
                Create Funnel
              </Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
