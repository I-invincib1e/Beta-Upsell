/**
 * WidgetPicker — Modal to pick a widget type when adding to a funnel step
 *
 * Shows available widget types filtered by placement and plan tier.
 */

import { Modal, BlockStack, InlineStack, Text, Button, Badge, Card } from "@shopify/polaris";
import { WIDGET_TYPE_REGISTRY } from "../../types/widgets";
import type { WidgetType, Placement } from "../../types/widgets";

interface WidgetPickerProps {
  placement: string;
  onSelect: (widgetType: WidgetType) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core Widgets",
  depth: "Growth Widgets",
  power: "Pro Widgets",
};

const TIER_BADGES: Record<string, { label: string; tone: any }> = {
  free: { label: "Free", tone: "success" },
  growth: { label: "Growth+", tone: "info" },
  pro: { label: "Pro Only", tone: "attention" },
};

export function WidgetPicker({ placement, onSelect, onClose }: WidgetPickerProps) {
  // Filter widgets available for this placement
  const availableWidgets = WIDGET_TYPE_REGISTRY.filter((w) =>
    w.availablePlacements.includes(placement as Placement)
  );

  // Group by category
  const categories = ["core", "depth", "power"];
  const grouped = categories
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      widgets: availableWidgets.filter((w) => w.category === cat),
    }))
    .filter((g) => g.widgets.length > 0);

  return (
    <Modal open onClose={onClose} title={`Add Widget to ${placement.replace(/_/g, " ")}`}>
      <Modal.Section>
        <BlockStack gap="500">
          {grouped.map((group) => (
            <BlockStack key={group.category} gap="300">
              <Text as="h3" variant="headingSm">
                {group.label}
              </Text>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "12px",
                }}
              >
                {group.widgets.map((widget) => {
                  const tierInfo = TIER_BADGES[widget.requiredTier];
                  return (
                    <div
                      key={widget.type}
                      onClick={() => onSelect(widget.type)}
                      style={{
                        cursor: "pointer",
                        padding: "16px",
                        borderRadius: "8px",
                        border: "1px solid var(--p-color-border)",
                        backgroundColor: "var(--p-color-bg-surface)",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
                        (e.currentTarget as HTMLElement).style.boxShadow =
                          "0 2px 8px rgba(99, 102, 241, 0.15)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor =
                          "var(--p-color-border)";
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                      }}
                    >
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="span" variant="headingSm">
                            {widget.label}
                          </Text>
                          {widget.requiredTier !== "free" && (
                            <Badge tone={tierInfo.tone}>{tierInfo.label}</Badge>
                          )}
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {widget.description}
                        </Text>
                      </BlockStack>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          ))}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
