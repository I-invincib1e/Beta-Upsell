/**
 * FunnelCanvas — Main Canvas Wrapper
 *
 * Visual funnel builder where merchants drag widgets into placement lanes.
 * Uses Polaris components with custom drag-drop via native HTML5 DnD API.
 * (dnd-kit deferred to avoid dep install — HTML5 DnD works fine for MVP)
 */

import { useState, useCallback } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import { StepCard } from "./StepCard";
import { PlacementLane } from "./PlacementLane";
import { WidgetPicker } from "./WidgetPicker";
import { StepConfigPanel } from "./StepConfigPanel";
import type { Placement, WidgetType } from "../../types/widgets";

export interface FunnelStep {
  id: string;
  placement: string;
  position: number;
  widget: {
    id: string;
    type: string;
    name: string;
    config: any;
  };
  config?: any;
}

interface FunnelCanvasProps {
  funnelId: string;
  funnelName: string;
  funnelStatus: string;
  steps: FunnelStep[];
  onAddStep: (placement: string, widgetType: WidgetType) => void;
  onRemoveStep: (stepId: string) => void;
  onReorderSteps: (stepIds: string[]) => void;
  onUpdateStepConfig: (stepId: string, config: any) => void;
  onStatusChange: (status: string) => void;
}

const PLACEMENTS: { value: Placement; label: string; icon: string }[] = [
  { value: "product_page", label: "Product Page", icon: "🛍️" },
  { value: "cart", label: "Cart Drawer", icon: "🛒" },
  { value: "checkout", label: "Checkout", icon: "💳" },
  { value: "post_purchase", label: "Post-Purchase", icon: "📦" },
  { value: "thank_you", label: "Thank You", icon: "🎉" },
];

export function FunnelCanvas({
  funnelId,
  funnelName,
  funnelStatus,
  steps,
  onAddStep,
  onRemoveStep,
  onReorderSteps,
  onUpdateStepConfig,
  onStatusChange,
}: FunnelCanvasProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [pickerPlacement, setPickerPlacement] = useState<string>("checkout");
  const [dragOverPlacement, setDragOverPlacement] = useState<string | null>(null);

  const selectedStep = steps.find((s) => s.id === selectedStepId) || null;

  const handleAddWidget = useCallback(
    (placement: string) => {
      setPickerPlacement(placement);
      setShowWidgetPicker(true);
    },
    []
  );

  const handleWidgetSelected = useCallback(
    (widgetType: WidgetType) => {
      onAddStep(pickerPlacement, widgetType);
      setShowWidgetPicker(false);
    },
    [pickerPlacement, onAddStep]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, stepId: string) => {
      e.dataTransfer.setData("text/plain", stepId);
      e.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, placement: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverPlacement(placement);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverPlacement(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetPlacement: string) => {
      e.preventDefault();
      setDragOverPlacement(null);
      // For MVP: reorder within the same placement only
      // Cross-placement move would need step update + server call
      const stepsInPlacement = steps
        .filter((s) => s.placement === targetPlacement)
        .sort((a, b) => a.position - b.position);
      if (stepsInPlacement.length > 1) {
        onReorderSteps(stepsInPlacement.map((s) => s.id));
      }
    },
    [steps, onReorderSteps]
  );

  const stepsByPlacement = PLACEMENTS.map((p) => ({
    ...p,
    steps: steps
      .filter((s) => s.placement === p.value)
      .sort((a, b) => a.position - b.position),
  }));

  const statusTone =
    funnelStatus === "active" ? "success" : funnelStatus === "paused" ? "warning" : "info";

  return (
    <div style={{ display: "flex", gap: "16px", minHeight: "500px" }}>
      {/* Main Canvas Area */}
      <div style={{ flex: 1 }}>
        <BlockStack gap="400">
          {/* Funnel Header */}
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="300" blockAlign="center">
                <Text as="h2" variant="headingLg">
                  {funnelName}
                </Text>
                <Badge tone={statusTone as any}>
                  {funnelStatus.charAt(0).toUpperCase() + funnelStatus.slice(1)}
                </Badge>
              </InlineStack>
              <InlineStack gap="200">
                {funnelStatus === "draft" && (
                  <Button variant="primary" onClick={() => onStatusChange("active")}>
                    Activate Funnel
                  </Button>
                )}
                {funnelStatus === "active" && (
                  <Button onClick={() => onStatusChange("paused")}>
                    Pause
                  </Button>
                )}
                {funnelStatus === "paused" && (
                  <Button variant="primary" onClick={() => onStatusChange("active")}>
                    Resume
                  </Button>
                )}
              </InlineStack>
            </InlineStack>
          </Card>

          {/* Placement Lanes */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              overflowX: "auto",
              paddingBottom: "8px",
            }}
          >
            {stepsByPlacement.map((lane) => (
              <PlacementLane
                key={lane.value}
                placement={lane.value}
                label={lane.label}
                icon={lane.icon}
                steps={lane.steps}
                isDragOver={dragOverPlacement === lane.value}
                onAddWidget={() => handleAddWidget(lane.value)}
                onDragOver={(e) => handleDragOver(e, lane.value)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, lane.value)}
              >
                {lane.steps.map((step) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    isSelected={selectedStepId === step.id}
                    onSelect={() => setSelectedStepId(step.id)}
                    onRemove={() => onRemoveStep(step.id)}
                    onDragStart={(e) => handleDragStart(e, step.id)}
                  />
                ))}
              </PlacementLane>
            ))}
          </div>

          {steps.length === 0 && (
            <Banner tone="info">
              <p>
                Click the <b>+ Add Widget</b> button in any placement lane to
                start building your funnel. Each lane represents where the widget
                appears in the customer journey.
              </p>
            </Banner>
          )}
        </BlockStack>
      </div>

      {/* Config Sidebar */}
      {selectedStep && (
        <div style={{ width: "360px", flexShrink: 0 }}>
          <StepConfigPanel
            step={selectedStep}
            onUpdateConfig={(config) =>
              onUpdateStepConfig(selectedStep.id, config)
            }
            onClose={() => setSelectedStepId(null)}
          />
        </div>
      )}

      {/* Widget Picker Modal */}
      {showWidgetPicker && (
        <WidgetPicker
          placement={pickerPlacement}
          onSelect={handleWidgetSelected}
          onClose={() => setShowWidgetPicker(false)}
        />
      )}
    </div>
  );
}
