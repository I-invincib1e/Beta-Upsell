import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  Grid,
  Badge,
  List,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  calculateRemainingTrialDays,
  DEFAULT_TRIAL_DAYS,
  PRO_PLAN_NAME,
} from "../utils/billing";
import { billingIsTest } from "../utils/billing-env.server";
import { getMerchantPlan } from "../utils/merchant-plan.server";
import { enforceFreePlanLimits } from "../utils/plan-enforcement.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const { displayName, plan } = await getMerchantPlan(session.shop, billing);

  return json({
    activePlan: displayName,
    plan,
    trialDays: DEFAULT_TRIAL_DAYS,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const planToSelect = formData.get("plan") as string;

  if (planToSelect !== "Free Plan" && planToSelect !== PRO_PLAN_NAME) {
    return json({ error: "Invalid plan selected" }, { status: 400 });
  }

  const isTest = billingIsTest();
  const billingCheck = await billing.check({
    // @ts-ignore
    plans: [PRO_PLAN_NAME],
    isTest,
  });

  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
  });

  if (planToSelect === "Free Plan") {
    if (billingCheck.hasActivePayment) {
      await billing.cancel({
        subscriptionId: billingCheck.appSubscriptions[0].id,
        isTest,
        prorate: true,
      });
    }

    if (store) {
      const { deactivatedPro, deactivatedExcess } =
        await enforceFreePlanLimits(store.id, admin);
      await prisma.store.update({
        where: { id: store.id },
        data: { plan: "free", billingStatus: "cancelled" },
      });
      return json({
        success: true,
        downgraded: true,
        deactivatedPro,
        deactivatedExcess,
      });
    }

    return json({ success: true, downgraded: true });
  }

  let trialDaysOverride: number | undefined = DEFAULT_TRIAL_DAYS;

  if (billingCheck.appSubscriptions?.length) {
    const existingSub = billingCheck.appSubscriptions[0];
    trialDaysOverride = calculateRemainingTrialDays(
      planToSelect,
      existingSub.name,
      existingSub.trialDays,
      existingSub.createdAt,
    );
  }

  await billing.request({
    // @ts-ignore
    plan: planToSelect,
    isTest,
    trialDays: trialDaysOverride,
    returnUrl: `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/pricing`,
  });

  return null;
};

export default function Pricing() {
  const { activePlan, trialDays } = useLoaderData<typeof loader>();
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
        <Banner tone="info">
          <p>
            Flat monthly pricing — we never take a percentage of your upsell
            revenue.
          </p>
        </Banner>

        <Text as="p" variant="bodyLg">
          Choose the plan that fits your store. Upgrade or downgrade anytime.
        </Text>

        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Free
                </Text>
                <Text as="h3" variant="heading2xl">
                  $0{" "}
                  <Text as="span" variant="bodyMd" tone="subdued">
                    /month
                  </Text>
                </Text>
                {activePlan === "Free Plan" && (
                  <Badge tone="success">Current plan</Badge>
                )}
                <List>
                  <List.Item>1 active offer</List.Item>
                  <List.Item>Cart drawer + product page (FBT)</List.Item>
                  <List.Item>Basic analytics</List.Item>
                  <List.Item>Auto discount codes</List.Item>
                </List>
                <Button
                  fullWidth
                  disabled={activePlan === "Free Plan" || isSubmitting}
                  onClick={() => handleSelectPlan("Free Plan")}
                  loading={isSubmitting}
                >
                  {activePlan === "Free Plan"
                    ? "Current plan"
                    : "Downgrade to Free"}
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
            <Card background="bg-surface-secondary">
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Pro
                </Text>
                <Text as="h3" variant="heading2xl">
                  $29{" "}
                  <Text as="span" variant="bodyMd" tone="subdued">
                    /month
                  </Text>
                </Text>
                {activePlan === PRO_PLAN_NAME && (
                  <Badge tone="success">Current plan</Badge>
                )}
                <List>
                  <List.Item>{trialDays}-day free trial</List.Item>
                  <List.Item>Unlimited active offers</List.Item>
                  <List.Item>
                    Post-purchase, checkout, thank-you, cart, FBT
                  </List.Item>
                  <List.Item>Product suggestions when creating offers</List.Item>
                  <List.Item>No revenue share — ever</List.Item>
                </List>
                <Button
                  variant="primary"
                  fullWidth
                  disabled={activePlan === PRO_PLAN_NAME || isSubmitting}
                  onClick={() => handleSelectPlan(PRO_PLAN_NAME)}
                  loading={isSubmitting}
                >
                  {activePlan === PRO_PLAN_NAME
                    ? "Current plan"
                    : "Start Pro trial"}
                </Button>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>
      </BlockStack>
    </Page>
  );
}
