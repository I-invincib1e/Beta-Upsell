/**
 * FunnelX — Funnel CRUD Server Utility
 *
 * All database operations for the Funnel, FunnelStep, and Widget models.
 * Used by route loaders/actions to manage funnels.
 */

import prisma from "../db.server";
import type { WidgetType, WidgetConfig } from "../types/widgets";

// ============================================================
// Funnel CRUD
// ============================================================

/**
 * Create a new funnel for a shop.
 */
export async function createFunnel(storeId: string, data: {
  name: string;
  triggerType: string;
  triggerValue?: any;
  status?: string;
}) {
  return prisma.funnel.create({
    data: {
      storeId,
      name: data.name,
      triggerType: data.triggerType,
      triggerValue: data.triggerValue ?? undefined,
      status: data.status ?? "draft",
    },
    include: {
      steps: {
        include: { widget: true },
        orderBy: { position: "asc" },
      },
    },
  });
}

/**
 * List all funnels for a shop with step counts and basic stats.
 */
export async function getFunnels(storeId: string) {
  return prisma.funnel.findMany({
    where: { storeId },
    include: {
      steps: {
        include: { widget: true },
        orderBy: { position: "asc" },
      },
      _count: {
        select: { steps: true, abTests: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Get a single funnel by ID with all steps, widgets, and A/B tests.
 */
export async function getFunnel(funnelId: string) {
  return prisma.funnel.findUnique({
    where: { id: funnelId },
    include: {
      steps: {
        include: { widget: true },
        orderBy: { position: "asc" },
      },
      abTests: {
        orderBy: { startedAt: "desc" },
      },
    },
  });
}

/**
 * Update a funnel's config (name, status, trigger, etc.)
 */
export async function updateFunnel(funnelId: string, data: {
  name?: string;
  status?: string;
  triggerType?: string;
  triggerValue?: any;
}) {
  return prisma.funnel.update({
    where: { id: funnelId },
    data,
    include: {
      steps: {
        include: { widget: true },
        orderBy: { position: "asc" },
      },
    },
  });
}

/**
 * Delete a funnel and cascade-delete all its steps.
 * (AbTests also cascade due to onDelete: Cascade in schema.)
 */
export async function deleteFunnel(funnelId: string) {
  return prisma.funnel.delete({
    where: { id: funnelId },
  });
}

// ============================================================
// Widget CRUD
// ============================================================

/**
 * Create a new reusable widget.
 */
export async function createWidget(storeId: string, data: {
  type: WidgetType;
  name: string;
  config: WidgetConfig;
}) {
  return prisma.widget.create({
    data: {
      storeId,
      type: data.type,
      name: data.name,
      config: data.config as any,
    },
  });
}

/**
 * List all widgets for a shop.
 */
export async function getWidgets(storeId: string, type?: WidgetType) {
  return prisma.widget.findMany({
    where: {
      storeId,
      ...(type ? { type } : {}),
    },
    include: {
      _count: {
        select: { steps: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Get a single widget by ID.
 */
export async function getWidget(widgetId: string) {
  return prisma.widget.findUnique({
    where: { id: widgetId },
    include: {
      steps: {
        include: { funnel: true },
      },
    },
  });
}

/**
 * Update a widget's config.
 */
export async function updateWidget(widgetId: string, data: {
  name?: string;
  config?: WidgetConfig;
}) {
  return prisma.widget.update({
    where: { id: widgetId },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.config ? { config: data.config as any } : {}),
    },
  });
}

/**
 * Delete a widget. Will fail if it's used in any funnel steps.
 * Caller should check step count first and prompt user.
 */
export async function deleteWidget(widgetId: string) {
  // Check if widget is in use
  const stepCount = await prisma.funnelStep.count({
    where: { widgetId },
  });

  if (stepCount > 0) {
    throw new Error(
      `Cannot delete widget: it is used in ${stepCount} funnel step(s). Remove it from all funnels first.`
    );
  }

  return prisma.widget.delete({
    where: { id: widgetId },
  });
}

// ============================================================
// FunnelStep CRUD
// ============================================================

/**
 * Add a step to a funnel.
 */
export async function addStepToFunnel(data: {
  funnelId: string;
  widgetId: string;
  placement: string;
  position: number;
  config?: any;
}) {
  return prisma.funnelStep.create({
    data: {
      funnelId: data.funnelId,
      widgetId: data.widgetId,
      placement: data.placement,
      position: data.position,
      config: data.config ?? undefined,
    },
    include: { widget: true },
  });
}

/**
 * Remove a step from a funnel. Does NOT delete the widget.
 */
export async function removeStepFromFunnel(stepId: string) {
  const step = await prisma.funnelStep.findUnique({
    where: { id: stepId },
  });

  if (!step) {
    throw new Error("Step not found");
  }

  await prisma.funnelStep.delete({
    where: { id: stepId },
  });

  // Re-index remaining steps to close the gap
  const remainingSteps = await prisma.funnelStep.findMany({
    where: { funnelId: step.funnelId },
    orderBy: { position: "asc" },
  });

  await Promise.all(
    remainingSteps.map((s, index) =>
      prisma.funnelStep.update({
        where: { id: s.id },
        data: { position: index },
      })
    )
  );
}

/**
 * Reorder steps within a funnel.
 * @param stepIds - Array of step IDs in the desired order.
 */
export async function reorderSteps(funnelId: string, stepIds: string[]) {
  // Validate all step IDs belong to this funnel
  const existingSteps = await prisma.funnelStep.findMany({
    where: { funnelId },
    select: { id: true },
  });

  const existingIds = new Set(existingSteps.map((s) => s.id));
  const invalidIds = stepIds.filter((id) => !existingIds.has(id));

  if (invalidIds.length > 0) {
    throw new Error(`Steps not found in this funnel: ${invalidIds.join(", ")}`);
  }

  // Update positions
  await Promise.all(
    stepIds.map((id, index) =>
      prisma.funnelStep.update({
        where: { id },
        data: { position: index },
      })
    )
  );
}

/**
 * Update a step's config overrides.
 */
export async function updateStep(stepId: string, data: {
  placement?: string;
  config?: any;
}) {
  return prisma.funnelStep.update({
    where: { id: stepId },
    data,
    include: { widget: true },
  });
}

// ============================================================
// Helpers
// ============================================================

/**
 * Get the Store record for a shop domain, creating it if needed.
 */
export async function getOrCreateStore(shopDomain: string, accessToken?: string) {
  let store = await prisma.store.findUnique({
    where: { shopDomain },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        shopDomain,
        accessToken: accessToken ?? null,
      },
    });
  }

  return store;
}

/**
 * Count active funnels for a shop (for plan limit checks).
 */
export async function getActiveFunnelCount(storeId: string) {
  return prisma.funnel.count({
    where: { storeId, status: "active" },
  });
}
