import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useNavigate, useRouteLoaderData, useActionData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, TextField, Button, Banner, InlineStack, Badge } from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  let store = await prisma.store.findUnique({
    where: { shopDomain },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        shopDomain,
        accessToken: session.accessToken,
      },
    });
  }

  const defaultSettings = {
    primaryColor: "#000000",
    widgetTitle: "You might also like...",
    acceptButtonText: "Add to Cart",
    declineButtonText: "No Thanks",
  };

  const currentSettings = store.settings as Record<string, string>;

  return json({
    settings: { ...defaultSettings, ...currentSettings },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;
  
  const formData = await request.formData();
  
  const primaryColor = formData.get("primaryColor") as string;
  const widgetTitle = formData.get("widgetTitle") as string;
  const acceptButtonText = formData.get("acceptButtonText") as string;
  const declineButtonText = formData.get("declineButtonText") as string;

  const newSettings = {
    primaryColor,
    widgetTitle,
    acceptButtonText,
    declineButtonText,
  };

  const store = await prisma.store.update({
    where: { shopDomain },
    data: {
      settings: newSettings,
    },
  });

  // Sync settings to Shopify Metafields for the liquid widget
  // IMPORTANT: Keep "beta_upsell" namespace — do NOT rename to "funnelx" in Sprint 1.
  // Existing merchants have data in this namespace. Migrate in Sprint 6.
  const metafieldsSetMutation = `
    mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key value }
      }
    }
  `;

  const shopQuery = await admin.graphql(`{ shop { id } }`);
  const shopData = await shopQuery.json();
  
  await admin.graphql(metafieldsSetMutation, {
    variables: {
      metafields: [
        {
          namespace: "beta_upsell",
          key: "settings",
          type: "json",
          value: JSON.stringify(newSettings),
          ownerId: shopData.data.shop.id
        }
      ]
    }
  });

  return json({ success: true });
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const rootData = useRouteLoaderData<{ activePlan: string }>("routes/app");
  const activePlan = rootData?.activePlan || "Free Plan";
  const isSaving = navigation.state === "submitting";

  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [widgetTitle, setWidgetTitle] = useState(settings.widgetTitle);
  const [acceptButtonText, setAcceptButtonText] = useState(settings.acceptButtonText);
  const [declineButtonText, setDeclineButtonText] = useState(settings.declineButtonText);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("primaryColor", primaryColor);
    formData.append("widgetTitle", widgetTitle);
    formData.append("acceptButtonText", acceptButtonText);
    formData.append("declineButtonText", declineButtonText);
    
    submit(formData, { method: "post" });
  }, [primaryColor, widgetTitle, acceptButtonText, declineButtonText, submit]);
  const actionResult = useActionData<typeof action>();
  const isSuccess = actionResult?.success === true;

  return (
    <Page title="Widget Settings">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {isSuccess && (
              <Banner title="Settings saved successfully!" tone="success" />
            )}
            
            <Banner title="Why customize?" tone="info">
              <p>
                To maximize your conversion rate, we highly recommend setting the <b>Primary Button Color</b> below to exactly match the primary button color used on your store's theme. 
                This makes the upsell widget feel like a native part of your brand.
              </p>
            </Banner>
            
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">FunnelX Cart Drawer Customization</Text>
                
                <TextField
                  label="Widget Title"
                  value={widgetTitle}
                  onChange={setWidgetTitle}
                  autoComplete="off"
                  helpText="The title shown above the upsell offer in the cart drawer."
                />
                
                <TextField
                  label="Accept Button Text"
                  value={acceptButtonText}
                  onChange={setAcceptButtonText}
                  autoComplete="off"
                />
                
                <TextField
                  label="Decline Button Text"
                  value={declineButtonText}
                  onChange={setDeclineButtonText}
                  autoComplete="off"
                />

                <TextField
                  label="Primary Button Color (Hex)"
                  value={primaryColor}
                  onChange={setPrimaryColor}
                  autoComplete="off"
                  helpText="e.g. #000000 or #FF5733"
                />

                <Button variant="primary" onClick={handleSave} loading={isSaving}>
                  Save Settings
                </Button>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Plan & Billing</Text>
                <InlineStack gap="300" blockAlign="center">
                  <Text as="span" variant="bodyMd">Current Plan:</Text>
                  <Badge tone={activePlan === "Free Plan" ? "info" : "success"}>{activePlan}</Badge>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  Upgrade or downgrade your plan at any time — no need to contact support.
                </Text>
                <Button onClick={() => navigate("/app/pricing")}>
                  {activePlan === "Free Plan" ? "View Plans & Upgrade" : "Manage Plan"}
                </Button>
                <Text as="p" variant="bodySm" tone="subdued">
                  FunnelX charges zero revenue share — flat monthly pricing only.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
