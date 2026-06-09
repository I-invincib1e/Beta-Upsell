/**
 * StepConfigPanel — Right sidebar panel for configuring a selected step's widget
 *
 * Shows widget-specific config fields based on widget type.
 * Sprint 2 MVP: product_upsell + discount_timer config.
 * Other widget types show a placeholder.
 */

import { useState, useEffect } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Select,
  Button,
  Badge,
  Divider,
} from "@shopify/polaris";
import type { FunnelStep } from "./index";

interface StepConfigPanelProps {
  step: FunnelStep;
  onUpdateConfig: (config: any) => void;
  onClose: () => void;
}

export function StepConfigPanel({ step, onUpdateConfig, onClose }: StepConfigPanelProps) {
  const widgetType = step.widget?.type || "unknown";
  const widgetConfig = { ...(step.widget?.config || {}), ...(step.config || {}) };

  const [config, setConfig] = useState<any>(widgetConfig);
  const [isDirty, setIsDirty] = useState(false);

  // Reset when step changes
  useEffect(() => {
    const merged = { ...(step.widget?.config || {}), ...(step.config || {}) };
    setConfig(merged);
    setIsDirty(false);
  }, [step.id]);

  const updateField = (field: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    onUpdateConfig(config);
    setIsDirty(false);
  };

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header */}
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="h3" variant="headingMd">
              Configure Widget
            </Text>
            <Badge>{widgetType.replace(/_/g, " ")}</Badge>
          </BlockStack>
          <Button variant="plain" onClick={onClose}>
            ✕
          </Button>
        </InlineStack>

        <Divider />

        {/* Widget-specific config */}
        {widgetType === "product_upsell" && (
          <ProductUpsellConfig config={config} onChange={updateField} />
        )}

        {widgetType === "discount_timer" && (
          <DiscountTimerConfig config={config} onChange={updateField} />
        )}

        {widgetType === "cross_sell" && (
          <CrossSellConfig config={config} onChange={updateField} />
        )}

        {widgetType === "order_bump" && (
          <OrderBumpConfig config={config} onChange={updateField} />
        )}

        {!["product_upsell", "discount_timer", "cross_sell", "order_bump"].includes(widgetType) && (
          <BlockStack gap="200">
            <Text as="p" tone="subdued">
              Configuration for "{widgetType.replace(/_/g, " ")}" widgets will be
              available in a future sprint.
            </Text>
            <TextField
              label="Widget Name"
              value={config.heading || ""}
              onChange={(val) => updateField("heading", val)}
              autoComplete="off"
            />
          </BlockStack>
        )}

        <Divider />

        {/* Save button */}
        <InlineStack align="end">
          <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
            {isDirty ? "Save Changes" : "Saved"}
          </Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

// ============================================================
// Widget-specific config forms
// ============================================================

function ProductUpsellConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <BlockStack gap="300">
      <TextField
        label="Heading"
        value={config.heading || ""}
        onChange={(val) => onChange("heading", val)}
        autoComplete="off"
      />
      <TextField
        label="Description"
        value={config.description || ""}
        onChange={(val) => onChange("description", val)}
        autoComplete="off"
        multiline={2}
      />
      <TextField
        label="Accept Button Text"
        value={config.acceptButtonText || ""}
        onChange={(val) => onChange("acceptButtonText", val)}
        autoComplete="off"
      />
      <TextField
        label="Decline Button Text"
        value={config.declineButtonText || ""}
        onChange={(val) => onChange("declineButtonText", val)}
        autoComplete="off"
      />
      <Select
        label="Discount Type"
        options={[
          { label: "Percentage (%)", value: "percentage" },
          { label: "Fixed Amount ($)", value: "fixed_amount" },
          { label: "No Discount", value: "none" },
        ]}
        value={config.discountType || "percentage"}
        onChange={(val) => onChange("discountType", val)}
      />
      {config.discountType !== "none" && (
        <TextField
          label="Discount Value"
          type="number"
          value={String(config.discountValue || "")}
          onChange={(val) => onChange("discountValue", parseFloat(val) || 0)}
          autoComplete="off"
          suffix={config.discountType === "percentage" ? "%" : "$"}
        />
      )}
      <Text as="p" variant="bodySm" tone="subdued">
        Product selection will use Shopify's resource picker in the full canvas
        (Sprint 2 polish).
      </Text>
    </BlockStack>
  );
}

function DiscountTimerConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <BlockStack gap="300">
      <TextField
        label="Heading"
        value={config.heading || ""}
        onChange={(val) => onChange("heading", val)}
        autoComplete="off"
      />
      <TextField
        label="Urgency Text"
        value={config.urgencyText || ""}
        onChange={(val) => onChange("urgencyText", val)}
        autoComplete="off"
        helpText="Text shown above the countdown timer"
      />
      <TextField
        label="Expired Text"
        value={config.expiredText || ""}
        onChange={(val) => onChange("expiredText", val)}
        autoComplete="off"
        helpText="Text shown when the timer expires"
      />
      <TextField
        label="Duration (minutes)"
        type="number"
        value={String(config.durationMinutes || "")}
        onChange={(val) => onChange("durationMinutes", parseInt(val) || 15)}
        autoComplete="off"
      />
      <TextField
        label="Discount Code"
        value={config.discountCode || ""}
        onChange={(val) => onChange("discountCode", val)}
        autoComplete="off"
        helpText="Shopify discount code to auto-apply"
      />
      <Select
        label="Discount Type"
        options={[
          { label: "Percentage (%)", value: "percentage" },
          { label: "Fixed Amount ($)", value: "fixed_amount" },
        ]}
        value={config.discountType || "percentage"}
        onChange={(val) => onChange("discountType", val)}
      />
      <TextField
        label="Discount Value"
        type="number"
        value={String(config.discountValue || "")}
        onChange={(val) => onChange("discountValue", parseFloat(val) || 0)}
        autoComplete="off"
      />
    </BlockStack>
  );
}

function CrossSellConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <BlockStack gap="300">
      <TextField
        label="Heading"
        value={config.heading || ""}
        onChange={(val) => onChange("heading", val)}
        autoComplete="off"
      />
      <TextField
        label="Description"
        value={config.description || ""}
        onChange={(val) => onChange("description", val)}
        autoComplete="off"
        multiline={2}
      />
      <Select
        label="Layout"
        options={[
          { label: "Carousel", value: "carousel" },
          { label: "Grid", value: "grid" },
          { label: "List", value: "list" },
        ]}
        value={config.layout || "carousel"}
        onChange={(val) => onChange("layout", val)}
      />
      <TextField
        label="Max Items"
        type="number"
        value={String(config.maxItems || "")}
        onChange={(val) => onChange("maxItems", parseInt(val) || 3)}
        autoComplete="off"
      />
      <Select
        label="Discount Type"
        options={[
          { label: "Percentage (%)", value: "percentage" },
          { label: "Fixed Amount ($)", value: "fixed_amount" },
          { label: "No Discount", value: "none" },
        ]}
        value={config.discountType || "none"}
        onChange={(val) => onChange("discountType", val)}
      />
      {config.discountType !== "none" && (
        <TextField
          label="Discount Value"
          type="number"
          value={String(config.discountValue || "")}
          onChange={(val) => onChange("discountValue", parseFloat(val) || 0)}
          autoComplete="off"
        />
      )}
    </BlockStack>
  );
}

function OrderBumpConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <BlockStack gap="300">
      <TextField
        label="Checkbox Label"
        value={config.checkboxLabel || ""}
        onChange={(val) => onChange("checkboxLabel", val)}
        autoComplete="off"
        helpText='Text next to the checkbox, e.g. "Add this to my order"'
      />
      <TextField
        label="Description"
        value={config.description || ""}
        onChange={(val) => onChange("description", val)}
        autoComplete="off"
        multiline={2}
      />
      <Select
        label="Discount Type"
        options={[
          { label: "Percentage (%)", value: "percentage" },
          { label: "Fixed Amount ($)", value: "fixed_amount" },
          { label: "No Discount", value: "none" },
        ]}
        value={config.discountType || "percentage"}
        onChange={(val) => onChange("discountType", val)}
      />
      {config.discountType !== "none" && (
        <TextField
          label="Discount Value"
          type="number"
          value={String(config.discountValue || "")}
          onChange={(val) => onChange("discountValue", parseFloat(val) || 0)}
          autoComplete="off"
        />
      )}
    </BlockStack>
  );
}
