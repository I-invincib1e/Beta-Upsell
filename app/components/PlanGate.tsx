/**
 * PlanGate — Wrap plan-gated features with an upgrade CTA
 *
 * Shows children if the merchant's plan meets the required tier.
 * Otherwise shows a locked state with upgrade button.
 */

import { Card, BlockStack, InlineStack, Text, Button, Badge, Banner } from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";

interface PlanGateProps {
  /** The minimum tier required to access this feature */
  requiredTier: "free" | "growth" | "pro";
  /** The merchant's current tier */
  currentTier: "free" | "growth" | "pro";
  /** Feature name for the upgrade CTA */
  featureName: string;
  /** Children to render when plan requirement is met */
  children: React.ReactNode;
  /** Optional: inline mode (no card wrapper) */
  inline?: boolean;
}

const TIER_ORDER = { free: 0, growth: 1, pro: 2 };

const TIER_NAMES: Record<string, string> = {
  free: "Free",
  growth: "Growth",
  pro: "Pro",
};

export function PlanGate({
  requiredTier,
  currentTier,
  featureName,
  children,
  inline = false,
}: PlanGateProps) {
  const navigate = useNavigate();
  const hasAccess = TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (inline) {
    return (
      <InlineStack gap="200" blockAlign="center">
        <Badge tone="attention">{`${TIER_NAMES[requiredTier]}+`}</Badge>
        <Text as="span" variant="bodySm" tone="subdued">
          {featureName} requires the {TIER_NAMES[requiredTier]} plan or higher.
        </Text>
        <Button size="slim" onClick={() => navigate("/app/pricing")}>
          Upgrade
        </Button>
      </InlineStack>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="span" variant="headingLg">🔒</Text>
            <Text as="h3" variant="headingMd">
              {featureName}
            </Text>
          </InlineStack>
          <Badge tone="attention">{`${TIER_NAMES[requiredTier]}+ Plan Required`}</Badge>
        </InlineStack>
        <Text as="p" variant="bodyMd" tone="subdued">
          This feature is available on the <b>{TIER_NAMES[requiredTier]}</b> plan
          and above. Upgrade to unlock {featureName.toLowerCase()} and other
          premium features.
        </Text>
        <InlineStack align="end">
          <Button variant="primary" onClick={() => navigate("/app/pricing")}>
            Upgrade to {TIER_NAMES[requiredTier]}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
