/**
 * PlacementLane — Visual lane for each placement (checkout, post-purchase, etc.)
 *
 * Each lane represents a point in the customer journey where widgets can be placed.
 * Supports drag-drop to add/reorder steps.
 */

import { ReactNode } from "react";
import { Card, BlockStack, InlineStack, Text, Button, Badge } from "@shopify/polaris";

interface PlacementLaneProps {
  placement: string;
  label: string;
  icon: string;
  steps: any[];
  isDragOver: boolean;
  onAddWidget: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  children: ReactNode;
}

export function PlacementLane({
  placement,
  label,
  icon,
  steps,
  isDragOver,
  onAddWidget,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: PlacementLaneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        flex: "1 1 200px",
        minWidth: "200px",
        maxWidth: "280px",
      }}
    >
      <Card>
        <div
          style={{
            minHeight: "300px",
            transition: "all 0.2s ease",
            borderRadius: "8px",
            border: isDragOver
              ? "2px dashed #6366f1"
              : "2px dashed transparent",
            backgroundColor: isDragOver
              ? "rgba(99, 102, 241, 0.05)"
              : "transparent",
            padding: isDragOver ? "4px" : "0",
          }}
        >
          <BlockStack gap="300">
            {/* Lane Header */}
            <InlineStack align="space-between" blockAlign="center">
              <InlineStack gap="100" blockAlign="center">
                <Text as="span" variant="bodyMd">
                  {icon}
                </Text>
                <Text as="h3" variant="headingSm">
                  {label}
                </Text>
              </InlineStack>
              <Badge tone={steps.length > 0 ? "success" : "new"}>
                {`${steps.length}`}
              </Badge>
            </InlineStack>

            {/* Step Cards */}
            {children}

            {/* Add Widget Button */}
            <Button
              variant="plain"
              onClick={onAddWidget}
              fullWidth
            >
              + Add Widget
            </Button>
          </BlockStack>
        </div>
      </Card>
    </div>
  );
}
