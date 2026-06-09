/**
 * AbTestBadge — Badge component showing A/B test status on funnels
 *
 * Also includes the AbTestCreator modal for creating new tests.
 */

import { useState, useCallback } from "react";
import {
  Badge,
  Modal,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  RangeSlider,
  Button,
  Card,
  Banner,
  Divider,
} from "@shopify/polaris";

// ============================================================
// AbTestBadge — shows test status inline
// ============================================================

interface AbTestBadgeProps {
  testName?: string;
  testStatus?: string;
  onClick?: () => void;
}

export function AbTestBadge({ testName, testStatus, onClick }: AbTestBadgeProps) {
  if (!testName || !testStatus) {
    return null;
  }

  const tone =
    testStatus === "running"
      ? ("success" as const)
      : testStatus === "paused"
      ? ("warning" as const)
      : ("info" as const);

  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        cursor: onClick ? "pointer" : "default",
        padding: 0,
      }}
    >
      <InlineStack gap="100" blockAlign="center">
        <Badge tone={tone}>A/B</Badge>
        <Text as="span" variant="bodySm" tone="subdued">
          {testName} ({testStatus})
        </Text>
      </InlineStack>
    </button>
  );
}

// ============================================================
// AbTestCreator — modal for creating a new A/B test
// ============================================================

interface AbTestCreatorProps {
  funnelId: string;
  funnelName: string;
  currentConfig: any; // current widget config (becomes variant A)
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    variantA: any;
    variantB: any;
    splitPct: number;
  }) => void;
}

export function AbTestCreator({
  funnelId,
  funnelName,
  currentConfig,
  onClose,
  onSubmit,
}: AbTestCreatorProps) {
  const [testName, setTestName] = useState(`${funnelName} — A/B Test`);
  const [splitPct, setSplitPct] = useState(50);
  const [variantBChanges, setVariantBChanges] = useState("");

  const handleCreate = useCallback(() => {
    // Variant A = current config (control)
    // Variant B = modified config (specified changes)
    const variantB = { ...currentConfig };

    // Parse simple key=value changes
    if (variantBChanges.trim()) {
      const lines = variantBChanges.split("\n");
      for (const line of lines) {
        const [key, ...valueParts] = line.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim();
          // Try to parse as number, boolean, or keep as string
          if (value === "true") variantB[key.trim()] = true;
          else if (value === "false") variantB[key.trim()] = false;
          else if (!isNaN(Number(value))) variantB[key.trim()] = Number(value);
          else variantB[key.trim()] = value;
        }
      }
    }

    onSubmit({
      name: testName,
      variantA: currentConfig,
      variantB,
      splitPct,
    });
  }, [testName, splitPct, variantBChanges, currentConfig, onSubmit]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Create A/B Test"
      primaryAction={{
        content: "Start Test",
        onAction: handleCreate,
      }}
      secondaryActions={[
        { content: "Cancel", onAction: onClose },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Banner tone="info">
            <p>
              <b>Variant A</b> = current config (control). <b>Variant B</b> = your
              changes. Visitors are deterministically assigned — same customer
              always sees the same variant.
            </p>
          </Banner>

          <TextField
            label="Test Name"
            value={testName}
            onChange={setTestName}
            autoComplete="off"
          />

          <div>
            <Text as="p" variant="bodySm" fontWeight="semibold">
              Traffic Split: {splitPct}% A / {100 - splitPct}% B
            </Text>
            <RangeSlider
              label="Split"
              labelHidden
              value={splitPct}
              onChange={(val) => setSplitPct(val as number)}
              min={10}
              max={90}
              step={5}
              output
            />
          </div>

          <Divider />

          {/* Variant A (Control) */}
          <Card>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="success">Variant A — Control</Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Uses the current widget configuration. No changes needed.
              </Text>
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  maxHeight: "100px",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(currentConfig, null, 2).slice(0, 300)}
                {JSON.stringify(currentConfig, null, 2).length > 300 ? "..." : ""}
              </div>
            </BlockStack>
          </Card>

          {/* Variant B (Test) */}
          <Card>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Badge tone="info">Variant B — Test</Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Enter changes as key=value pairs (one per line). Only changed
                fields are overridden.
              </Text>
              <TextField
                label="Variant B Changes"
                labelHidden
                value={variantBChanges}
                onChange={setVariantBChanges}
                autoComplete="off"
                multiline={4}
                placeholder={[
                  "heading=🔥 Limited Time Offer!",
                  "discountValue=20",
                  "acceptButtonText=Yes, Add It!",
                ].join("\n")}
              />
            </BlockStack>
          </Card>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// ============================================================
// AbTestResults — inline results display
// ============================================================

interface AbTestResultsProps {
  significance: {
    isSignificant: boolean;
    confidence: number;
    winner: "A" | "B" | "none";
    uplift: number;
    pValue: number;
    variantA: { cvr: number; sampleSize: number };
    variantB: { cvr: number; sampleSize: number };
  };
  statsA: { impressions: number; conversions: number; revenue: number };
  statsB: { impressions: number; conversions: number; revenue: number };
  testName: string;
}

export function AbTestResults({
  significance,
  statsA,
  statsB,
  testName,
}: AbTestResultsProps) {
  const { isSignificant, confidence, winner, uplift, pValue } = significance;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingMd">
            A/B Test: {testName}
          </Text>
          {isSignificant ? (
            <Badge tone="success">
              {`Winner: Variant ${winner} (+${uplift}%)`}
            </Badge>
          ) : (
            <Badge tone="attention">No clear winner yet</Badge>
          )}
        </InlineStack>

        {/* Confidence bar */}
        <BlockStack gap="100">
          <InlineStack align="space-between">
            <Text as="span" variant="bodySm" tone="subdued">
              Statistical Confidence
            </Text>
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {confidence}%
            </Text>
          </InlineStack>
          <div
            style={{
              height: "8px",
              borderRadius: "4px",
              backgroundColor: "#f0f0f5",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(confidence, 100)}%`,
                borderRadius: "4px",
                background:
                  confidence >= 95
                    ? "linear-gradient(90deg, #16a34a, #22c55e)"
                    : confidence >= 80
                    ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                    : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <Text as="p" variant="bodySm" tone="subdued">
            {confidence >= 95
              ? "✅ Result is statistically significant (p < 0.05)"
              : confidence >= 80
              ? "⚠️ Trending but not yet significant — collect more data"
              : `📊 Collecting data... (p = ${pValue})`}
          </Text>
        </BlockStack>

        {/* Variant comparison */}
        <div style={{ display: "flex", gap: "12px" }}>
          <VariantCard
            label="A"
            isWinner={winner === "A"}
            cvr={significance.variantA.cvr}
            impressions={statsA.impressions}
            conversions={statsA.conversions}
            revenue={statsA.revenue}
          />
          <VariantCard
            label="B"
            isWinner={winner === "B"}
            cvr={significance.variantB.cvr}
            impressions={statsB.impressions}
            conversions={statsB.conversions}
            revenue={statsB.revenue}
          />
        </div>
      </BlockStack>
    </Card>
  );
}

function VariantCard({
  label,
  isWinner,
  cvr,
  impressions,
  conversions,
  revenue,
}: {
  label: string;
  isWinner: boolean;
  cvr: number;
  impressions: number;
  conversions: number;
  revenue: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        padding: "16px",
        borderRadius: "8px",
        border: isWinner
          ? "2px solid #16a34a"
          : "1px solid var(--p-color-border)",
        backgroundColor: isWinner ? "rgba(22, 163, 74, 0.04)" : "transparent",
      }}
    >
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <Badge tone={isWinner ? "success" : "info"}>
            {`Variant ${label}`}
          </Badge>
          {isWinner && (
            <Text as="span" variant="bodySm" fontWeight="semibold" tone="success">
              🏆 Winner
            </Text>
          )}
        </InlineStack>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          <div>
            <Text as="p" variant="bodySm" tone="subdued">CVR</Text>
            <Text as="p" variant="headingLg">{cvr}%</Text>
          </div>
          <div>
            <Text as="p" variant="bodySm" tone="subdued">Revenue</Text>
            <Text as="p" variant="headingLg">${revenue.toFixed(2)}</Text>
          </div>
          <div>
            <Text as="p" variant="bodySm" tone="subdued">Views</Text>
            <Text as="p" variant="bodyMd">{impressions.toLocaleString()}</Text>
          </div>
          <div>
            <Text as="p" variant="bodySm" tone="subdued">Converts</Text>
            <Text as="p" variant="bodyMd">{conversions}</Text>
          </div>
        </div>
      </BlockStack>
    </div>
  );
}
