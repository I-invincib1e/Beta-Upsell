/**
 * FunnelX — Legacy Data Migration Route
 *
 * One-time API route to migrate existing Offer rows into the new
 * Widget + Funnel + FunnelStep schema.
 *
 * SECURITY: Locked behind process.env.MIGRATION_KEY.
 * Usage: Navigate to /app/migrate-legacy-data?key=YOUR_MIGRATION_KEY
 *
 * What it does:
 * 1. Reads all Offer rows per shop
 * 2. Creates a Widget for each Offer
 * 3. Creates a Funnel wrapping each Widget in a single FunnelStep
 * 4. Does NOT delete Offer rows (kept for rollback)
 * 5. Logs results for audit trail
 */

import { json, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, Text, Banner, List } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  // Security check
  const url = new URL(request.url);
  const providedKey = url.searchParams.get("key");
  const migrationKey = process.env.MIGRATION_KEY;

  if (!migrationKey || providedKey !== migrationKey) {
    return json({
      status: "unauthorized",
      message: "Invalid or missing migration key. Set MIGRATION_KEY in .env and pass ?key=YOUR_KEY",
      results: [],
    });
  }

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { offers: true },
  });

  if (!store) {
    return json({
      status: "error",
      message: "Store not found for this shop.",
      results: [],
    });
  }

  if (store.offers.length === 0) {
    return json({
      status: "success",
      message: "No legacy offers to migrate.",
      results: [],
    });
  }

  // Check if migration was already run (simple: check if any widgets exist)
  const existingWidgets = await prisma.widget.count({
    where: { storeId: store.id },
  });

  if (existingWidgets > 0) {
    return json({
      status: "skipped",
      message: `Migration already run — ${existingWidgets} widget(s) already exist. Delete them first if you want to re-run.`,
      results: [],
    });
  }

  // Run migration
  const results: Array<{
    offerId: string;
    offerName: string;
    widgetId: string;
    funnelId: string;
    stepId: string;
  }> = [];

  for (const offer of store.offers) {
    try {
      // Map old offer type to placement
      const placementMap: Record<string, string> = {
        cart: "cart",
        product_page: "product_page",
        post_purchase: "post_purchase",
        checkout: "checkout",
        thank_you: "thank_you",
      };

      const placement = placementMap[offer.type] || "checkout";

      // Create Widget from Offer
      const widget = await prisma.widget.create({
        data: {
          storeId: store.id,
          type: "product_upsell",
          name: offer.name,
          config: {
            type: "product_upsell",
            productId: offer.upsellProductIds[0] || "",
            discountType: offer.discountType,
            discountValue: offer.discountValue,
            heading: "Complete your order",
            description: "Add this to your order and save!",
            acceptButtonText: "Add to Order",
            declineButtonText: "No Thanks",
            // Preserve legacy data
            _legacyOfferId: offer.id,
            _legacyUpsellProductIds: offer.upsellProductIds,
            _legacyTriggerProductIds: offer.triggerProductIds,
            _legacyTriggerType: offer.triggerType,
          },
        },
      });

      // Map legacy trigger type
      const triggerTypeMap: Record<string, string> = {
        SPECIFIC_PRODUCTS: "product",
        SPECIFIC_COLLECTIONS: "collection",
        ALL_PRODUCTS: "all",
      };

      // Create Funnel wrapping the Widget
      const funnel = await prisma.funnel.create({
        data: {
          storeId: store.id,
          name: `${offer.name} (migrated)`,
          status: offer.isActive ? "active" : "draft",
          triggerType: triggerTypeMap[offer.triggerType] || "all",
          triggerValue: offer.triggerProductIds.length > 0
            ? { productIds: offer.triggerProductIds }
            : undefined,
        },
      });

      // Create FunnelStep linking Widget to Funnel
      const step = await prisma.funnelStep.create({
        data: {
          funnelId: funnel.id,
          widgetId: widget.id,
          placement,
          position: 0,
        },
      });

      results.push({
        offerId: offer.id,
        offerName: offer.name,
        widgetId: widget.id,
        funnelId: funnel.id,
        stepId: step.id,
      });

      console.log(`[MIGRATION] Migrated offer "${offer.name}" (${offer.id}) → Widget ${widget.id} → Funnel ${funnel.id}`);
    } catch (error) {
      console.error(`[MIGRATION] Failed to migrate offer "${offer.name}" (${offer.id}):`, error);
      results.push({
        offerId: offer.id,
        offerName: offer.name,
        widgetId: "FAILED",
        funnelId: "FAILED",
        stepId: "FAILED",
      });
    }
  }

  const successCount = results.filter((r) => r.widgetId !== "FAILED").length;
  const failCount = results.filter((r) => r.widgetId === "FAILED").length;

  return json({
    status: "success",
    message: `Migration complete: ${successCount} migrated, ${failCount} failed out of ${store.offers.length} total offers.`,
    results,
  });
};

export default function MigrateLegacyData() {
  const { status, message, results } = useLoaderData<typeof loader>();

  const bannerTone = status === "success" ? "success" as const
    : status === "skipped" ? "warning" as const
    : status === "unauthorized" ? "critical" as const
    : "critical" as const;

  return (
    <Page title="Legacy Data Migration" narrowWidth>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Banner title="Data Migration Tool" tone={bannerTone}>
              <p>{message}</p>
            </Banner>

            {results.length > 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Migration Results</Text>
                  <List>
                    {results.map((r: any) => (
                      <List.Item key={r.offerId}>
                        <Text as="span" fontWeight="bold">{r.offerName}</Text>
                        {r.widgetId === "FAILED" ? (
                          <Text as="span" tone="critical"> — FAILED</Text>
                        ) : (
                          <Text as="span" tone="subdued">
                            {" → "}Widget {r.widgetId.slice(0, 8)}… → Funnel {r.funnelId.slice(0, 8)}…
                          </Text>
                        )}
                      </List.Item>
                    ))}
                  </List>
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">⚠️ Important Notes</Text>
                <List>
                  <List.Item>Original Offer rows are NOT deleted — they're kept for rollback safety.</List.Item>
                  <List.Item>This migration can only be run once. Delete widgets first to re-run.</List.Item>
                  <List.Item>Legacy widget configs include _legacy* fields for traceability.</List.Item>
                  <List.Item>Migrated funnels inherit the active/draft status of the original offer.</List.Item>
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
