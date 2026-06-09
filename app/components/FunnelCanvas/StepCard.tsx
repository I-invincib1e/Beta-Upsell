/**
 * StepCard — Draggable step tile on the canvas
 *
 * Shows the widget type, name, and placement for a funnel step.
 * Can be selected, dragged, or removed.
 */

import { Card, BlockStack, InlineStack, Text, Badge, Button } from "@shopify/polaris";
import type { FunnelStep } from "./index";

interface StepCardProps {
  step: FunnelStep;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

const WIDGET_ICONS: Record<string, string> = {
  product_upsell: "🎯",
  cross_sell: "🔀",
  discount_timer: "⏰",
  order_bump: "➕",
  bundle_offer: "📦",
  review_request: "⭐",
  social_share: "📱",
  survey: "📋",
  free_shipping_bar: "🚚",
  loyalty_points: "💎",
  reorder_upsell: "🔄",
  related_collection: "🗂️",
  birthday_capture: "🎂",
};

export function StepCard({
  step,
  isSelected,
  onSelect,
  onRemove,
  onDragStart,
}: StepCardProps) {
  const widgetType = step.widget?.type || "unknown";
  const widgetName = step.widget?.name || "Untitled Widget";
  const icon = WIDGET_ICONS[widgetType] || "📦";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      style={{
        cursor: "grab",
        borderRadius: "8px",
        border: isSelected
          ? "2px solid #6366f1"
          : "1px solid var(--p-color-border)",
        backgroundColor: isSelected
          ? "rgba(99, 102, 241, 0.06)"
          : "var(--p-color-bg-surface)",
        padding: "12px",
        transition: "all 0.15s ease",
        boxShadow: isSelected
          ? "0 0 0 1px rgba(99, 102, 241, 0.3), 0 2px 8px rgba(99, 102, 241, 0.1)"
          : "0 1px 3px rgba(0,0,0,0.08)",
      }}
    >
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="span" variant="bodyMd">
              {icon}
            </Text>
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {widgetName.length > 20
                ? widgetName.slice(0, 20) + "…"
                : widgetName}
            </Text>
          </InlineStack>
          <Button
            variant="plain"
            tone="critical"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            size="slim"
          >
            ✕
          </Button>
        </InlineStack>
        <Badge>
          {widgetType.replace(/_/g, " ")}
        </Badge>
      </BlockStack>
    </div>
  );
}
