import { json, LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
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
  InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncThemeOffersMetafield } from "../utils/metafields.server";
import { formatDiscount, formatPlacementLabel } from "../utils/offers-display";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const store = await prisma.store.findUnique({
    where: { shopDomain: session.shop },
    include: {
      offers: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return json({ offers: store?.offers || [] });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();

  if (request.method === "DELETE") {
    const offerId = formData.get("offerId") as string;

    const offer = await prisma.offer.findFirst({
      where: {
        id: offerId,
        store: { shopDomain: session.shop },
      },
      include: { store: true },
    });
    if (!offer) {
      return json({ success: false, error: "Offer not found" }, { status: 404 });
    }

    await prisma.offerEvent.deleteMany({ where: { offerId } });
    await prisma.analyticsDaily.deleteMany({ where: { offerId } });
    await prisma.offer.delete({ where: { id: offerId } });

    if (offer.type === "cart" || offer.type === "product_page") {
      await syncThemeOffersMetafield(admin, offer.storeId);
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
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{formatPlacementLabel(type)}</IndexTable.Cell>
        <IndexTable.Cell>
          {formatDiscount(discountType, discountValue)}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={isActive ? "success" : "critical"}>
            {isActive ? "Active" : "Draft"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button variant="plain" onClick={() => navigate(`/app/offers/${id}/edit`)}>
              Edit
            </Button>
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
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page
      title="Upsell Offers"
      primaryAction={{
        content: "Create Offer",
        onAction: () => navigate("/app/offers/new"),
      }}
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
                    An <b>Offer</b> is a pairing of products designed to increase
                    your Average Order Value.
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
