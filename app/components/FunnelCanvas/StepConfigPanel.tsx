/**
 * StepConfigPanel — Right sidebar panel for configuring a selected step's widget
 *
 * Shows widget-specific config fields based on widget type.
 * Sprint 2: product_upsell, discount_timer, cross_sell, order_bump
 * Sprint 3: bundle_offer, review_request, free_shipping_bar, social_share, survey
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
  Checkbox,
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

        {widgetType === "bundle_offer" && (
          <BundleOfferConfig config={config} onChange={updateField} />
        )}

        {widgetType === "review_request" && (
          <ReviewRequestConfig config={config} onChange={updateField} />
        )}

        {widgetType === "free_shipping_bar" && (
          <FreeShippingBarConfig config={config} onChange={updateField} />
        )}

        {widgetType === "social_share" && (
          <SocialShareConfig config={config} onChange={updateField} />
        )}

        {widgetType === "survey" && (
          <SurveyConfig config={config} onChange={updateField} />
        )}

        {!["product_upsell", "discount_timer", "cross_sell", "order_bump",
          "bundle_offer", "review_request", "free_shipping_bar", "social_share", "survey"
        ].includes(widgetType) && (
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

// ============================================================
// Sprint 3 widget config forms
// ============================================================

function BundleOfferConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <BlockStack gap="300">
      <TextField
        label="Bundle Heading"
        value={config.heading || ""}
        onChange={(val) => onChange("heading", val)}
        autoComplete="off"
      />
      <TextField
        label="Bundle Description"
        value={config.description || ""}
        onChange={(val) => onChange("description", val)}
        autoComplete="off"
        multiline={2}
      />
      <TextField
        label="Bundle Label"
        value={config.bundleLabel || ""}
        onChange={(val) => onChange("bundleLabel", val)}
        autoComplete="off"
        helpText='Shown as the bundle name, e.g. "Complete Skincare Kit"'
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
      <Select
        label="Layout"
        options={[
          { label: "Horizontal", value: "horizontal" },
          { label: "Vertical", value: "vertical" },
          { label: "Grid", value: "grid" },
        ]}
        value={config.layout || "horizontal"}
        onChange={(val) => onChange("layout", val)}
      />
      <Checkbox
        label="Show savings badge"
        checked={config.showSavingsBadge !== false}
        onChange={(val) => onChange("showSavingsBadge", val)}
      />
      <Text as="p" variant="bodySm" tone="subdued">
        Product selection for the bundle uses Shopify's resource picker.
      </Text>
    </BlockStack>
  );
}

function ReviewRequestConfig({
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
        label="Review Platform"
        options={[
          { label: "In-App", value: "in_app" },
          { label: "Google Reviews", value: "google" },
          { label: "Trustpilot", value: "trustpilot" },
          { label: "Custom URL", value: "custom" },
        ]}
        value={config.reviewPlatform || "in_app"}
        onChange={(val) => onChange("reviewPlatform", val)}
      />
      {config.reviewPlatform === "custom" && (
        <TextField
          label="Review URL"
          value={config.reviewUrl || ""}
          onChange={(val) => onChange("reviewUrl", val)}
          autoComplete="off"
          helpText="Where to send the customer to leave a review"
        />
      )}
      <TextField
        label="Thank You Message"
        value={config.thankYouMessage || ""}
        onChange={(val) => onChange("thankYouMessage", val)}
        autoComplete="off"
        helpText="Shown after the customer submits a review"
      />
      <Checkbox
        label="Show star rating selector"
        checked={config.showStarRating !== false}
        onChange={(val) => onChange("showStarRating", val)}
      />
      <TextField
        label="Reward Discount Code"
        value={config.rewardCode || ""}
        onChange={(val) => onChange("rewardCode", val)}
        autoComplete="off"
        helpText="Optional: offer a discount code as a thank-you for reviewing"
      />
    </BlockStack>
  );
}

function FreeShippingBarConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <BlockStack gap="300">
      <TextField
        label="Message (under threshold)"
        value={config.belowMessage || ""}
        onChange={(val) => onChange("belowMessage", val)}
        autoComplete="off"
        helpText="Use {remaining} for the amount needed. E.g. 'Add {remaining} more for free shipping!'"
      />
      <TextField
        label="Message (reached threshold)"
        value={config.reachedMessage || ""}
        onChange={(val) => onChange("reachedMessage", val)}
        autoComplete="off"
        helpText="Shown when cart meets the threshold"
      />
      <TextField
        label="Free Shipping Threshold ($)"
        type="number"
        value={String(config.threshold || "")}
        onChange={(val) => onChange("threshold", parseFloat(val) || 0)}
        autoComplete="off"
      />
      <Select
        label="Bar Style"
        options={[
          { label: "Progress Bar", value: "progress" },
          { label: "Announcement Banner", value: "banner" },
          { label: "Floating Bar", value: "floating" },
        ]}
        value={config.barStyle || "progress"}
        onChange={(val) => onChange("barStyle", val)}
      />
      <TextField
        label="Bar Color"
        value={config.barColor || "#6366f1"}
        onChange={(val) => onChange("barColor", val)}
        autoComplete="off"
        helpText="Hex color for the progress bar"
      />
      <TextField
        label="Background Color"
        value={config.bgColor || "#f8f9fa"}
        onChange={(val) => onChange("bgColor", val)}
        autoComplete="off"
      />
      <Checkbox
        label="Show celebration animation when reached"
        checked={config.showCelebration !== false}
        onChange={(val) => onChange("showCelebration", val)}
      />
    </BlockStack>
  );
}

function SocialShareConfig({
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
        label="Share Message"
        value={config.shareMessage || ""}
        onChange={(val) => onChange("shareMessage", val)}
        autoComplete="off"
        helpText="Pre-filled text when sharing. Use {product} for the product name."
        multiline={2}
      />
      <Checkbox
        label="Show Facebook"
        checked={config.showFacebook !== false}
        onChange={(val) => onChange("showFacebook", val)}
      />
      <Checkbox
        label="Show Twitter/X"
        checked={config.showTwitter !== false}
        onChange={(val) => onChange("showTwitter", val)}
      />
      <Checkbox
        label="Show WhatsApp"
        checked={config.showWhatsApp !== false}
        onChange={(val) => onChange("showWhatsApp", val)}
      />
      <Checkbox
        label="Show Email"
        checked={config.showEmail !== false}
        onChange={(val) => onChange("showEmail", val)}
      />
      <Checkbox
        label="Show Copy Link"
        checked={config.showCopyLink !== false}
        onChange={(val) => onChange("showCopyLink", val)}
      />
      <TextField
        label="Share Reward Discount Code"
        value={config.rewardCode || ""}
        onChange={(val) => onChange("rewardCode", val)}
        autoComplete="off"
        helpText="Optional: offer a discount code when they share"
      />
    </BlockStack>
  );
}

function SurveyConfig({
  config,
  onChange,
}: {
  config: any;
  onChange: (field: string, value: any) => void;
}) {
  return (
    <BlockStack gap="300">
      <TextField
        label="Question"
        value={config.question || ""}
        onChange={(val) => onChange("question", val)}
        autoComplete="off"
        helpText="The main survey question"
      />
      <Select
        label="Question Type"
        options={[
          { label: "Multiple Choice", value: "multiple_choice" },
          { label: "Rating (1-5)", value: "rating" },
          { label: "Free Text", value: "free_text" },
          { label: "NPS (0-10)", value: "nps" },
        ]}
        value={config.questionType || "multiple_choice"}
        onChange={(val) => onChange("questionType", val)}
      />
      {config.questionType === "multiple_choice" && (
        <TextField
          label="Options (one per line)"
          value={config.options || ""}
          onChange={(val) => onChange("options", val)}
          autoComplete="off"
          multiline={4}
          helpText="Each line becomes a selectable option"
        />
      )}
      <TextField
        label="Thank You Message"
        value={config.thankYouMessage || ""}
        onChange={(val) => onChange("thankYouMessage", val)}
        autoComplete="off"
      />
      <Checkbox
        label="Allow skip"
        checked={config.allowSkip !== false}
        onChange={(val) => onChange("allowSkip", val)}
      />
      <TextField
        label="Reward Discount Code"
        value={config.rewardCode || ""}
        onChange={(val) => onChange("rewardCode", val)}
        autoComplete="off"
        helpText="Optional: offer a discount code as a thank-you for responding"
      />
    </BlockStack>
  );
}
