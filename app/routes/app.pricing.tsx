import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Button, Grid, Badge, List, Box } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { calculateRemainingTrialDays } from "../utils/billing";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const billingCheck = await billing.check({
    // @ts-ignore
    plans: ["Pro Plan"],
    isTest: true,
  });

  const activePlan = billingCheck.hasActivePayment 
    ? billingCheck.appSubscriptions[0].name 
    : "Free Plan";

  return json({ activePlan });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const planToSelect = formData.get("plan") as string;

  if (planToSelect !== "Free Plan" && planToSelect !== "Pro Plan") {
    return json({ error: "Invalid plan selected" }, { status: 400 });
  }

  const billingCheck = await billing.check({
    // @ts-ignore
    plans: ["Pro Plan"],
    isTest: true,
  });

  // Handle downgrading to Free Plan
  if (planToSelect === "Free Plan") {
    if (billingCheck.hasActivePayment) {
      await billing.cancel({
        subscriptionId: billingCheck.appSubscriptions[0].id,
        isTest: true,
        prorate: true,
      });
    }
    return json({ success: true });
  }

  // Robust Trial Logic
  let trialDaysOverride: number | undefined = undefined;

  // If upgrading/downgrading or resubscribing, calculate if they get a trial
  if (billingCheck.appSubscriptions && billingCheck.appSubscriptions.length > 0) {
    const existingSub = billingCheck.appSubscriptions[0];
    trialDaysOverride = calculateRemainingTrialDays(
      planToSelect,
      existingSub.name,
      existingSub.trialDays,
      existingSub.createdAt
    );
  }

  // Request the new charge
  await billing.request({
    // @ts-ignore
    plan: planToSelect,
    isTest: true,
    returnUrl: `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/pricing`,
    ...(trialDaysOverride !== undefined ? { trialDays: trialDaysOverride } : {})
  });

  return null;
};

export default function Pricing() {
  const { activePlan } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const handleSelectPlan = (plan: string) => {
    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Plans & Pricing">
      <BlockStack gap="500">
        <Text as="p" variant="bodyLg">
          Choose the best plan for your store. Upgrade or downgrade at any time.
        </Text>

        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <div className="pricing-card-wrapper">
              <Card>
                <div className="pricing-card-content">
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">Free Plan</Text>
                    <Text as="h3" variant="heading3xl">$0 <Text as="span" variant="bodyMd" tone="subdued">/month</Text></Text>
                    {activePlan === "Free Plan" && <Badge tone="success">Active Plan</Badge>}
                    
                    <List>
                      <List.Item>1 Active Offer Limit</List.Item>
                      <List.Item>Cart Drawer Upsells</List.Item>
                      <List.Item>Basic Analytics</List.Item>
                      <List.Item>Community Support</List.Item>
                    </List>
                  </BlockStack>
                  <div style={{ marginTop: '24px' }}>
                    <Button 
                      size="large" 
                      fullWidth 
                      disabled={activePlan === "Free Plan" || isSubmitting}
                      onClick={() => handleSelectPlan("Free Plan")}
                      loading={isSubmitting}
                    >
                      {activePlan === "Free Plan" ? "Current Plan" : "Downgrade to Free"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <div className="pricing-card-wrapper">
              <Card background="bg-surface-active">
                <div className="pricing-card-content">
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">Pro Plan</Text>
                    <Text as="h3" variant="heading3xl">$29 <Text as="span" variant="bodyMd" tone="subdued">/month</Text></Text>
                    {activePlan === "Pro Plan" && <Badge tone="success">Active Plan</Badge>}
                    
                    <List>
                      <List.Item>Unlimited Active Offers</List.Item>
                      <List.Item>Post-Purchase & Checkout Extension</List.Item>
                      <List.Item>Advanced AI Recommendations</List.Item>
                      <List.Item>Priority Support</List.Item>
                    </List>
                  </BlockStack>
                  <div style={{ marginTop: '24px' }}>
                    <Button 
                      variant="primary" 
                      size="large" 
                      fullWidth 
                      disabled={activePlan === "Pro Plan" || isSubmitting}
                      onClick={() => handleSelectPlan("Pro Plan")}
                      loading={isSubmitting}
                    >
                      {activePlan === "Pro Plan" ? "Current Plan" : "Upgrade to Pro"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Grid.Cell>
        </Grid>
      </BlockStack>
    </Page>
  );
}
