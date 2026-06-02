import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { Page, Layout, Card, Text, Button, IndexTable, Badge, EmptyState, BlockStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  const shopDomain = session.shop;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: {
      offers: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  return json({ offers: store?.offers || [] });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (formData.get("intent") === "sync-discount-codes") {
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
        data: { discountCode },
      });
      synced += 1;
    }

    if (store.offers.some((o) => isThemePlacement(o.type))) {
      await syncThemeOffersMetafield(admin, store.id);
    }

    return json({ success: true, synced });
  }
  
  if (request.method === "DELETE") {
    const offerId = formData.get("offerId") as string;
    
    // Find the offer first to know its type
    const offer = await prisma.offer.findUnique({ where: { id: offerId } });
    if (!offer) return json({ success: false }, { status: 404 });

    await prisma.offer.delete({ where: { id: offerId } });

    // If it was a cart offer, we must re-sync the active cart offers to Shopify metafields!
    if (offer.type === "cart") {
      const store = await prisma.store.findUnique({ where: { shopDomain: session.shop } });
      if (store) {
        const activeCartOffers = await prisma.offer.findMany({
          where: { storeId: store.id, type: "cart", isActive: true },
          select: { id: true, name: true, triggerType: true, triggerProductIds: true, upsellProductIds: true, discountType: true, discountValue: true }
        });

        const enrichedOffers = await Promise.all(activeCartOffers.map(async (offer) => {
          const response = await admin.graphql(
            `query getProductHandles($ids: [ID!]!) {
              nodes(ids: $ids) {
                ... on Product {
                  id
                  handle
                }
              }
            }`,
            { variables: { ids: offer.upsellProductIds } }
          );
          const data = await response.json();
          const handles = data.data?.nodes?.map((n: any) => n?.handle).filter(Boolean) || [];
          return {
            ...offer,
            handles
          };
        }));

        const metafieldsSetMutation = `
          mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { id key value }
            }
          }
        `;

        const shopQuery = await admin.graphql(`{ shop { id } }`);
        const shopData = await shopQuery.json();
        
        await admin.graphql(metafieldsSetMutation, {
          variables: {
            metafields: [
              {
                namespace: "beta_upsell",
                key: "active_offers",
                type: "json",
                value: JSON.stringify(enrichedOffers),
                ownerId: shopData.data.shop.id
              }
            ]
          }
        });
      }
    }

    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, { status: 405 });
};

export default function OffersIndex() {
  const { offers } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const rowMarkup = offers.map(
    ({ id, name, type, isActive, discountType, discountValue }, index) => (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">{name}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {type === 'post_purchase' ? 'Post-Purchase' : 'Cart Drawer'}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {discountValue} {discountType === 'percentage' ? '%' : '$'}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={isActive ? "success" : "critical"}>
            {isActive ? "Active" : "Draft"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button 
            tone="critical" 
            variant="plain" 
            onClick={() => {
              if (confirm("Are you sure you want to delete this offer?")) {
                const formData = new FormData();
                formData.append("offerId", id);
                submit(formData, { method: "delete" });
              }
            }}
          >
            Delete
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Upsell Offers"
      primaryAction={<Button variant="primary" onClick={() => navigate("/app/offers/new")}>Create Offer</Button>}
    >
      <Layout>
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
                    An <b>Offer</b> is a pairing of two products designed to increase your Average Order Value.
                  </Text>
                  <div style={{ textAlign: 'left', display: 'inline-block', margin: '0 auto' }}>
                    <ul style={{ paddingLeft: '20px', margin: 0, color: 'var(--p-color-text-subdued)' }}>
                      <li><b>Trigger Product:</b> The main item the customer is viewing.</li>
                      <li><b>Upsell Product:</b> A complementary item (like an accessory) offered as a bundle.</li>
                      <li><b>Discount:</b> An optional incentive (like 10% off) if they buy both together.</li>
                    </ul>
                  </div>
                </BlockStack>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: 'offer', plural: 'offers' }}
                itemCount={offers.length}
                headings={[
                  { title: 'Name' },
                  { title: 'Placement' },
                  { title: 'Discount' },
                  { title: 'Status' },
                  { title: 'Actions' },
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
