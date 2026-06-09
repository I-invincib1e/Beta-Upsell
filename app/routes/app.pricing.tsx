import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData, useRouteLoaderData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Button, Grid, Badge, List, Banner, InlineStack, Modal } from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { calculateRemainingTrialDays, PLAN_CONFIG, resolveActivePlan, SHOPIFY_PLAN_NAMES } from "../utils/billing";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const billingCheck = await billing.check({
    // @ts-ignore
    plans: [SHOPIFY_PLAN_NAMES.GROWTH, SHOPIFY_PLAN_NAMES.PRO, SHOPIFY_PLAN_NAMES.LEGACY_PRO],
    isTest: true,
  });

  const subscriptionName = billingCheck.hasActivePayment
    ? billingCheck.appSubscriptions[0].name
    : null;

  const { planName, tier, isLegacy } = resolveActivePlan(subscriptionName);

  return json({ activePlan: planName, planTier: tier, isLegacy });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { billing, session } = await authenticate.admin(request);
    const formData = await request.formData();
    const planToSelect = formData.get("plan") as string;

    const validPlans = ["Free Plan", "Growth Plan", "FunnelX Pro"];
    if (!validPlans.includes(planToSelect)) {
      return json({ error: "Invalid plan selected" }, { status: 400 });
    }

    const billingCheck = await billing.check({
      // @ts-ignore
      plans: [SHOPIFY_PLAN_NAMES.GROWTH, SHOPIFY_PLAN_NAMES.PRO, SHOPIFY_PLAN_NAMES.LEGACY_PRO],
      isTest: true,
    });

    // Handle downgrading to Free Plan — §1.2.3 compliance: merchants must be able to self-serve downgrades
    if (planToSelect === "Free Plan") {
      if (billingCheck.hasActivePayment) {
        await billing.cancel({
          subscriptionId: billingCheck.appSubscriptions[0].id,
          isTest: true,
          prorate: true,
        });
      }
      return json({ success: true, message: "Successfully downgraded to Free Plan." });
    }

    // Robust Trial Logic — §4.2.1 compliance: trial days must match listing
    let trialDaysOverride: number | undefined = undefined;

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
      ...(trialDaysOverride !== undefined ? { trialDays: trialDaysOverride } : {}),
    });

    return null;
  } catch (error) {
    console.error("Billing action error:", error);
    throw error;
  }
};

export default function Pricing() {
  const { activePlan, planTier, isLegacy } = useLoaderData<typeof loader>();
  const actionData = useActionData<any>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showDowngradeConfirm, setShowDowngradeConfirm] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState("Free Plan");

  const handleSelectPlan = useCallback((plan: string) => {
    // Downgrade confirmation
    const tierOrder = { free: 0, growth: 1, pro: 2 };
    const targetTier = plan === "Free Plan" ? "free" : plan === "Growth Plan" ? "growth" : "pro";
    if (tierOrder[targetTier] < tierOrder[planTier as keyof typeof tierOrder]) {
      setDowngradeTarget(plan);
      setShowDowngradeConfirm(true);
      return;
    }

    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  }, [planTier, submit]);

  const confirmDowngrade = useCallback(() => {
    setShowDowngradeConfirm(false);
    const formData = new FormData();
    formData.append("plan", downgradeTarget);
    submit(formData, { method: "post" });
  }, [downgradeTarget, submit]);

  const isPlanActive = (plan: string) => activePlan === plan || (isLegacy && plan === "FunnelX Pro");

  return (
    <Page title="Plans & Pricing">
      <BlockStack gap="500">
        {/* Current plan banner */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Text as="span" variant="headingMd">Your current plan:</Text>
              <Badge tone={planTier === "free" ? "info" : "success"} size="large">
                {activePlan}
              </Badge>
              {isLegacy && (
                <Badge tone="attention">Grandfathered</Badge>
              )}
            </InlineStack>
            <Text as="span" variant="bodySm" tone="subdued">
              You can upgrade or downgrade at any time. Changes take effect immediately.
            </Text>
          </InlineStack>
        </Card>

        {/* Zero rev share banner */}
        <Banner title="Zero Revenue Share — Always" tone="success">
          <p>
            Unlike other upsell apps that charge 0.75% of your upsell revenue,
            FunnelX charges a flat monthly fee. No surprises, no hidden costs.
            A store doing $50K/month in upsell revenue pays $19.99 — not $375.
          </p>
        </Banner>

        {/* Success/error banners */}
        {actionData?.success && (
          <Banner title={actionData.message || "Plan updated successfully!"} tone="success" />
        )}
        {actionData?.error && (
          <Banner title={actionData.error} tone="critical" />
        )}

        <Grid>
          {/* FREE PLAN */}
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <div className="pricing-card-wrapper">
              <Card>
                <div className="pricing-card-content">
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingLg">Free</Text>
                    <Text as="h3" variant="heading3xl">
                      $0 <Text as="span" variant="bodyMd" tone="subdued">/month</Text>
                    </Text>
                    {planTier === "free" && <Badge tone="success">Active Plan</Badge>}

                    <List>
                      <List.Item>100 monthly orders</List.Item>
                      <List.Item>1 active funnel</List.Item>
                      <List.Item>✅ Checkout upsell included</List.Item>
                      <List.Item>All 5 placement types</List.Item>
                      <List.Item>Basic analytics</List.Item>
                      <List.Item>Community support</List.Item>
                    </List>
                  </BlockStack>
                  <div style={{ marginTop: "24px" }}>
                    <Button
                      size="large"
                      fullWidth
                      disabled={planTier === "free" || isSubmitting}
                      onClick={() => handleSelectPlan("Free Plan")}
                      loading={isSubmitting}
                    >
                      {planTier === "free" ? "Current Plan" : "Downgrade to Free"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Grid.Cell>

          {/* GROWTH PLAN */}
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <div className="pricing-card-wrapper">
              <Card background="bg-surface-active">
                <div className="pricing-card-content">
                  <BlockStack gap="400">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingLg">Growth</Text>
                      <Badge tone="attention">Most Popular</Badge>
                    </InlineStack>
                    <Text as="h3" variant="heading3xl">
                      $6.99 <Text as="span" variant="bodyMd" tone="subdued">/month</Text>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">7-day free trial included</Text>
                    {activePlan === "Growth Plan" && <Badge tone="success">Active Plan</Badge>}

                    <List>
                      <List.Item>1,000 monthly orders</List.Item>
                      <List.Item>5 active funnels</List.Item>
                      <List.Item>✅ Checkout upsell included</List.Item>
                      <List.Item>All 5 placement types</List.Item>
                      <List.Item>A/B testing</List.Item>
                      <List.Item>Advanced analytics</List.Item>
                      <List.Item>Email support</List.Item>
                    </List>
                  </BlockStack>
                  <div style={{ marginTop: "24px" }}>
                    <Button
                      variant="primary"
                      size="large"
                      fullWidth
                      disabled={activePlan === "Growth Plan" || isSubmitting}
                      onClick={() => handleSelectPlan("Growth Plan")}
                      loading={isSubmitting}
                    >
                      {activePlan === "Growth Plan" ? "Current Plan" : planTier === "pro" ? "Downgrade to Growth" : "Start Free Trial"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Grid.Cell>

          {/* PRO PLAN */}
          <Grid.Cell columnSpan={{ xs: 6, sm: 2, md: 2, lg: 4, xl: 4 }}>
            <div className="pricing-card-wrapper">
              <Card>
                <div className="pricing-card-content">
                  <BlockStack gap="400">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingLg">Pro</Text>
                      {isLegacy && <Badge tone="attention">Legacy: $29/mo</Badge>}
                    </InlineStack>
                    <Text as="h3" variant="heading3xl">
                      $19.99 <Text as="span" variant="bodyMd" tone="subdued">/month</Text>
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">7-day free trial included</Text>
                    {(planTier === "pro") && <Badge tone="success">Active Plan</Badge>}

                    <List>
                      <List.Item>Unlimited monthly orders</List.Item>
                      <List.Item>Unlimited active funnels</List.Item>
                      <List.Item>✅ Checkout upsell included</List.Item>
                      <List.Item>All 5 placement types</List.Item>
                      <List.Item>A/B testing</List.Item>
                      <List.Item>Advanced analytics + date range</List.Item>
                      <List.Item>Priority support</List.Item>
                      <List.Item>Pro widgets (loyalty, reorder, etc.)</List.Item>
                    </List>
                  </BlockStack>
                  <div style={{ marginTop: "24px" }}>
                    <Button
                      variant="primary"
                      size="large"
                      fullWidth
                      disabled={planTier === "pro" || isSubmitting}
                      onClick={() => handleSelectPlan("FunnelX Pro")}
                      loading={isSubmitting}
                    >
                      {planTier === "pro"
                        ? isLegacy ? "Legacy Plan Active" : "Current Plan"
                        : "Upgrade to Pro"}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </Grid.Cell>
        </Grid>

        {/* Downgrade confirmation modal */}
        <Modal
          open={showDowngradeConfirm}
          onClose={() => setShowDowngradeConfirm(false)}
          title={`Downgrade to ${downgradeTarget}?`}
          primaryAction={{
            content: "Confirm Downgrade",
            onAction: confirmDowngrade,
            destructive: true,
            loading: isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowDowngradeConfirm(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                Are you sure you want to downgrade? You may lose access to:
              </Text>
              <List>
                {downgradeTarget === "Free Plan" && (
                  <>
                    <List.Item>Active funnels beyond the free limit (1)</List.Item>
                    <List.Item>A/B testing</List.Item>
                    <List.Item>Advanced analytics</List.Item>
                    <List.Item>Priority support</List.Item>
                  </>
                )}
                {downgradeTarget === "Growth Plan" && (
                  <>
                    <List.Item>Unlimited funnels (limited to 5)</List.Item>
                    <List.Item>Pro widgets</List.Item>
                    <List.Item>Priority support</List.Item>
                  </>
                )}
              </List>
              <Text as="p" variant="bodyMd">
                Funnels beyond the new limit will be paused. You can upgrade again at any time.
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}
