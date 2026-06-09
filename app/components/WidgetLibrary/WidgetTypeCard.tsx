/**
 * WidgetTypeCard — Card showing widget type, icon, description, and tier badge.
 * Used in the Widget Library grid.
 */

import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
} from "@shopify/polaris";
import type { WidgetTypeMeta } from "../../types/widgets";

const TIER_COLORS: Record<string, "success" | "info" | "attention"> = {
  free: "success",
  growth: "info",
  pro: "attention",
};

const CATEGORY_EMOJI: Record<string, string> = {
  core: "⚡",
  depth: "📈",
  power: "🚀",
};

const ICON_EMOJI: Record<string, string> = {
  ProductIcon: "🛍️",
  CollectionIcon: "📦",
  ClockIcon: "⏰",
  PlusCircleIcon: "➕",
  InventoryIcon: "🎁",
  StarIcon: "⭐",
  ShareIcon: "🔗",
  QuestionCircleIcon: "❓",
  DeliveryIcon: "🚚",
  GiftCardIcon: "💎",
  RefreshIcon: "🔄",
  CalendarIcon: "🎂",
};

interface WidgetTypeCardProps {
  meta: WidgetTypeMeta;
  widgetCount: number;
  onCreateWidget: (type: string) => void;
  currentTier: string;
}

export function WidgetTypeCard({
  meta,
  widgetCount,
  onCreateWidget,
  currentTier,
}: WidgetTypeCardProps) {
  const isLocked =
    (meta.requiredTier === "growth" && currentTier === "free") ||
    (meta.requiredTier === "pro" && currentTier !== "pro");

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                background:
                  meta.category === "core"
                    ? "linear-gradient(135deg, #e0f2fe, #bfdbfe)"
                    : meta.category === "depth"
                    ? "linear-gradient(135deg, #fef3c7, #fde68a)"
                    : "linear-gradient(135deg, #ede9fe, #ddd6fe)",
              }}
            >
              {ICON_EMOJI[meta.icon] || "🔧"}
            </div>
            <BlockStack gap="0">
              <Text as="span" variant="bodyMd" fontWeight="bold">
                {meta.label}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {CATEGORY_EMOJI[meta.category]} {meta.category}
              </Text>
            </BlockStack>
          </InlineStack>

          <Badge tone={TIER_COLORS[meta.requiredTier]}>
            {meta.requiredTier}
          </Badge>
        </InlineStack>

        <Text as="p" variant="bodySm" tone="subdued">
          {meta.description}
        </Text>

        <InlineStack gap="100" wrap>
          {meta.availablePlacements.slice(0, 3).map((p) => (
            <Badge key={p} tone="info">
              {p.replace(/_/g, " ")}
            </Badge>
          ))}
          {meta.availablePlacements.length > 3 && (
            <Badge>{`+${meta.availablePlacements.length - 3}`}</Badge>
          )}
        </InlineStack>

        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" variant="bodySm" tone="subdued">
            {widgetCount > 0
              ? `${widgetCount} widget${widgetCount !== 1 ? "s" : ""} created`
              : "No widgets yet"}
          </Text>
          <Button
            variant={isLocked ? "secondary" : "primary"}
            size="slim"
            disabled={isLocked}
            onClick={() => onCreateWidget(meta.type)}
          >
            {isLocked ? "🔒 Upgrade" : "Create"}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
