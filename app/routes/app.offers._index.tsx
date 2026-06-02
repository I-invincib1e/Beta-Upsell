import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSubmit,
  useActionData,
} from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  IndexTable,
  Badge,
  EmptyState,
  BlockStack,
  Banner,
  InlineStack,
} from "@shopify/polaris";
import type { Offer } from "@prisma/client";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncOfferDiscountCode } from "../utils/discount-codes.server";
import {
  isThemePlacement,
  syncThemeOffersMetafield,
} from "../utils/metafields.server";
import {
  formatPlacementLabel,
  formatDiscount,
} from "../utils/offers-display";
import {
  computeOfferHealth,
  healthBadgeTone,
  healthLabel,
} from "../utils/offer-health";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: {
      offers: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const offers = store?.offers ?? [];
  const needsSyncCount = offers.filter(
    (o) => computeOfferHealth(o) === "needs_sync",
  ).length;

  return json({ offers, needsSyncCount });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string | null;

  if (intent === "sync-discount-codes") {
    const store = await prisma.store.findUnique({
      where: { shopDomain: session.shop },
      include: {
        offers: {
          where: {
            isActive: true,
            type: { in: ["checkout", "cart", "thank_you", "product_page"] },
          },
        },
      },
    });
    if (!store) {
      return json({ error: "Store not found" }, { status: 404 });
    }

    let synced = 0;
    for (const offer of store.offers) {
      const discountCode = await syncOfferDiscountCode(admin, {
        id: offer.id,
        name: offer.name,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        upsellProductIds: offer.upsellProductIds,
        discountCode: offer.discountCode,
      });
      await prisma.offer.update({
        where: { id: offer.id },
        data: { discountCode, healthStatus: "ok" },
      });
      synced += 1;
    }

    if (store.offers.some((o) => isThemePlacement(o.type))) {
      await syncThemeOffersMetafield(admin, store.id);
    }

    return json({ success: true, synced });
  }

  if (intent === "toggle-active") {
    const offerId = formData.get("offerId") as string;
    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) {
      return json({ error: "Offer not found" }, { status: 404 });
    }

    await prisma.offer.update({
      where: { id: offerId },
      data: { isActive: !offer.isActive },
    });

    const store = await prisma.store.findUnique({
      where: { shopDomain: session.shop },
    });
    if (store && isThemePlacement(offer.type)) {
      await syncThemeOffersMetafield(admin, store.id);
    }

    return json({ success: true });
  }

  if (intent === "duplicate") {
    const offerId = formData.get("offerId") as string;
    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) {
      return json({ error: "Offer not found" }, { status: 404 });
    }

    await prisma.offer.create({
      data: {
        storeId: offer.storeId,
        name: `${offer.name} (copy)`,
        type: offer.type,
        triggerType: offer.triggerType,
        triggerProductIds: offer.triggerProductIds,
        upsellProductIds: offer.upsellProductIds,
        conditions: offer.conditions,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        maxUpsellProducts: offer.maxUpsellProducts,
        isActive: false,
        healthStatus: "needs_sync",
        priority: offer.priority,
      },
    });

    return json({ success: true, duplicated: true });
  }

  if (request.method === "DELETE") {
    const offerId = formData.get("offerId") as string;
    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) {
      return json({ success: false }, { status: 404 });
    }

    await prisma.offer.delete({ where: { id: offerId } });

    const store = await prisma.store.findUnique({
      where: { shopDomain: session.shop },
    });
    if (store && isThemePlacement(offer.type)) {
      await syncThemeOffersMetafield(admin, store.id);
    }

    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};

function OfferRow({
  offer,
  index,
  navigate,
  submit,
}: {
  offer: Offer;
  index: number;
  navigate: ReturnType<typeof useNavigate>;
  submit: ReturnType<typeof useSubmit>;
}) {
  const health = computeOfferHealth(offer);

  return (
    <IndexTable.Row id={offer.id} key={offer.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {offer.name}
        </Text>
        {offer.deactivatedByPlan && (
          <Text as="p" variant="bodySm" tone="subdued">
            Paused by plan downgrade
          </Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>{formatPlacementLabel(offer.type)}</IndexTable.Cell>
      <IndexTable.Cell>
        {formatDiscount(offer.discountType, offer.discountValue)}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={healthBadgeTone(health)}>{healthLabel(health)}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={offer.isActive ? "success" : "critical"}>
          {offer.isActive ? "Active" : "Paused"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="200">
          <Button variant="plain" onClick={() => navigate(`/app/offers/${offer.id}/edit`)}>
            Edit
          </Button>
          <Button
            variant="plain"
            onClick={() => {
              const fd = new FormData();
              fd.append("intent", "toggle-active");
              fd.append("offerId", offer.id);
              submit(fd, { method: "post" });
            }}
          >
            {offer.isActive ? "Pause" : "Activate"}
          </Button>
          <Button
            variant="plain"
            onClick={() => {
              const fd = new FormData();
              fd.append("intent", "duplicate");
              fd.append("offerId", offer.id);
              submit(fd, { method: "post" });
            }}
          >
            Duplicate
          </Button>
          <Button
            tone="critical"
            variant="plain"
            onClick={() => {
              if (confirm("Delete this offer permanently?")) {
                const fd = new FormData();
                fd.append("offerId", offer.id);
                submit(fd, { method: "delete" });
              }
            }}
          >
            Delete
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  );
}

export default function OffersIndex() {
  const { offers, needsSyncCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const rowMarkup = offers.map((offer, index) => (
    <OfferRow
      key={offer.id}
      offer={offer}
      index={index}
      navigate={navigate}
      submit={submit}
    />
  ));

  return (
    <Page
      title="Upsell Offers"
      primaryAction={
        <Button variant="primary" onClick={() => navigate("/app/offers/new")}>
          Create Offer
        </Button>
      }
      secondaryActions={[
        {
          content: "Sync discount codes",
          onAction: () => {
            const fd = new FormData();
            fd.append("intent", "sync-discount-codes");
            submit(fd, { method: "post" });
          },
        },
      ]}
    >
      <Layout>
        {needsSyncCount > 0 && (
          <Layout.Section>
            <Banner
              tone="warning"
              title={`${needsSyncCount} offer(s) need discount sync`}
            >
              <p>
                Run <b>Sync discount codes</b> so checkout and cart upsells apply
                the correct discounts at checkout.
              </p>
            </Banner>
          </Layout.Section>
        )}
        {actionData && "synced" in actionData && (
          <Layout.Section>
            <Banner tone="success">
              Synced discount codes for {actionData.synced} offer(s).
            </Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card padding="0">
            {offers.length === 0 ? (
              <EmptyState
                heading="Create your first Upsell Offer"
                action={{
                  content: "Create Offer",
                  onAction: () => navigate("/app/offers/new"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <BlockStack gap="400">
                  <Text as="p" variant="bodyMd">
                    Pair trigger products with upsells and optional discounts
                    across cart, checkout, post-purchase, and more.
                  </Text>
                </BlockStack>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: "offer", plural: "offers" }}
                itemCount={offers.length}
                headings={[
                  { title: "Name" },
                  { title: "Placement" },
                  { title: "Discount" },
                  { title: "Health" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
