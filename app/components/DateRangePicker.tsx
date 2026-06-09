/**
 * DateRangePicker — Date range filter component for analytics
 *
 * Provides preset ranges (7d, 30d, 90d, All Time) and custom date inputs.
 */

import { useState, useCallback } from "react";
import { InlineStack, Button, Popover, DatePicker, BlockStack, Text } from "@shopify/polaris";

interface DateRangePickerProps {
  onRangeChange: (from: string, to: string, label: string) => void;
  currentLabel?: string;
}

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "All Time", days: 0 },
];

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function DateRangePicker({ onRangeChange, currentLabel = "30 days" }: DateRangePickerProps) {
  const [activePreset, setActivePreset] = useState(currentLabel);

  const handlePreset = useCallback(
    (preset: typeof PRESETS[number]) => {
      setActivePreset(preset.label);

      if (preset.days === 0) {
        // All time — use a very old start date
        onRangeChange("2020-01-01", formatDate(new Date()), preset.label);
      } else {
        const from = new Date();
        from.setDate(from.getDate() - preset.days);
        onRangeChange(formatDate(from), formatDate(new Date()), preset.label);
      }
    },
    [onRangeChange]
  );

  return (
    <InlineStack gap="200" blockAlign="center">
      <Text as="span" variant="bodySm" tone="subdued">Period:</Text>
      {PRESETS.map((preset) => (
        <Button
          key={preset.label}
          variant={activePreset === preset.label ? "primary" : "plain"}
          size="slim"
          onClick={() => handlePreset(preset)}
        >
          {preset.label}
        </Button>
      ))}
    </InlineStack>
  );
}
