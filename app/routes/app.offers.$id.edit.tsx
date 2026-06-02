import { useState, useCallback } from "react";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  json,
  redirect,
} from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Select,
  Button,
  InlineStack,
  Text,
  Banner,
  List,
} from "@shopify/polaris";
import {
  useNavigate,
  useSubmit,
  useActionData,
  useNavigation,
  useLoaderData,
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { billingIsTest } from "../utils/billing-env.server";
import { isThemePlacement, syncThemeOffersMetafield } from "../utils/metafields.server";
import { syncOfferDiscountCode } from "../utils/discount-codes.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const offer = await prisma.offer.findFirst({
    where: {
      id: params.id,
      store: { shopDomain: session.shop },
    },
  });

  if (!offer) {
    throw new Response("Not Found", { status: 404 });
  }

  const billingCheck = await billing.check({
    // @ts-ignore
    plans: ["Pro Plan"],
    isTest: billingIsTest(),
  });
  const activePlan = billingCheck.hasActivePayment
    ? billingCheck.appSubscriptions[0].name
    : null;

  return json({
    offer,
    activePlan,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const existing = await prisma.offer.findFirst({
    where: { id: params.id, store: { shopDomain } },
    include: { store: true },
  });
  if (!existing) {
    return json({ error: "Offer not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const offerName = formData.get("offerName") as string;
  const placement = formData.get("placement") as string;
  const triggerType = formData.get("triggerType") as string;
  const triggerProductIds = JSON.parse(
    (formData.get("triggerProductIds") as string) || "[]",
  );
  const upsellProductIds = JSON.parse(
    (formData.get("upsellProductIds") as string) || "[]",
  );
  const discountType = formData.get("discountType") as string;
  const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
  const isActive = formData.get("isActive") === "true";

  if (!offerName || upsellProductIds.length === 0) {
    return json(
      { error: "Offer name and at least one upsell product are required." },
      { status: 400 },
    );
  }

  await prisma.offer.update({
    where: { id: existing.id },
    data: {
      name: offerName,
      type: placement,
      triggerType: triggerType || "SPECIFIC_PRODUCTS",
      triggerProductIds,
      upsellProductIds,
      discountType,
      discountValue,
      isActive,
    },
  });

  const needsDiscountCode = ["checkout", "cart", "thank_you", "product_page"].includes(
    placement,
  );
  if (needsDiscountCode) {
    const discountCode = await syncOfferDiscountCode(admin, {
      id: existing.id,
      name: offerName,
      discountType,
      discountValue,
      upsellProductIds,
      discountCode: existing.discountCode,
    });
    await prisma.offer.update({
      where: { id: existing.id },
      data: { discountCode },
    });
  }

  if (
    isThemePlacement(placement) ||
    isThemePlacement(existing.type) ||
    existing.type === "cart" ||
    existing.type === "product_page"
  ) {
    await syncThemeOffersMetafield(admin, existing.storeId);
  }

  return redirect("/app/offers");
};

export default function EditOffer() {
  const { offer, activePlan } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<{ error?: string }>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [offerName, setOfferName] = useState(offer.name);
  const [placement, setPlacement] = useState(offer.type);
  const [triggerType, setTriggerType] = useState(offer.triggerType);
  const [triggerItems, setTriggerItems] = useState<{ id: string; title: string }[]>(
    offer.triggerProductIds.map((id) => ({ id, title: id.split("/").pop() || id })),
  );
  const [upsellItems, setUpsellItems] = useState<{ id: string; title: string }[]>(
    offer.upsellProductIds.map((id) => ({ id, title: id.split("/").pop() || id })),
  );
  const [discountType, setDiscountType] = useState(offer.discountType);
  const [discountValue, setDiscountValue] = useState(String(offer.discountValue));
  const [isActive, setIsActive] = useState(offer.isActive);

  const selectResource = async (
    type: "product" | "collection",
    setterItems: (items: { id: string; title: string }[]) => void,
  ) => {
    // @ts-ignore
    const selected = await shopify.resourcePicker({
      type,
      multiple: true,
      action: "select",
    });
    if (selected?.length) {
      setterItems(
        selected.map((item: { id: string; title: string }) => ({
          id: item.id,
          title: item.title,
        })),
      );
    }
  };

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("offerName", offerName);
    formData.append("placement", placement);
    formData.append("triggerType", triggerType);
    formData.append(
      "triggerProductIds",
      JSON.stringify(triggerItems.map((i) => i.id)),
    );
    formData.append(
      "upsellProductIds",
      JSON.stringify(upsellItems.map((i) => i.id)),
    );
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    formData.append("isActive", String(isActive));
    submit(formData, { method: "post" });
  }, [
    offerName,
    placement,
    triggerType,
    triggerItems,
    upsellItems,
    discountType,
    discountValue,
    isActive,
    submit,
  ]);

  const placementOptions = [
    { label: "Cart Drawer", value: "cart" },
    { label: "Product Page FBT", value: "product_page" },
    {
      label: activePlan === null ? "Post-Purchase (Pro Only)" : "Post-Purchase",
      value: "post_purchase",
      disabled: activePlan === null,
    },
    {
      label: activePlan === null ? "Inline Checkout (Pro Only)" : "Checkout",
      value: "checkout",
      disabled: activePlan === null,
    },
    {
      label: activePlan === null ? "Thank You (Pro Only)" : "Thank You",
      value: "thank_you",
      disabled: activePlan === null,
    },
  ];

  return (
    <Page
      backAction={{ content: "Offers", onAction: () => navigate("/app/offers") }}
      title={`Edit: ${offer.name}`}
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {actionData?.error && (
              <Banner tone="critical">
                <p>{actionData.error}</p>
              </Banner>
            )}
            <Card>
              <BlockStack gap="400">
                <TextField label="Offer name" value={offerName} onChange={setOfferName} autoComplete="off" />
                <Select label="Placement" options={placementOptions} value={placement} onChange={setPlacement} />
                <Select
                  label="Status"
                  options={[
                    { label: "Active", value: "true" },
                    { label: "Draft (inactive)", value: "false" },
                  ]}
                  value={isActive ? "true" : "false"}
                  onChange={(v) => setIsActive(v === "true")}
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="400">
                <Select
                  label="Trigger"
                  options={[
                    { label: "Specific products", value: "SPECIFIC_PRODUCTS" },
                    { label: "Specific collections", value: "SPECIFIC_COLLECTIONS" },
                    { label: "All products", value: "ALL_PRODUCTS" },
                  ]}
                  value={triggerType}
                  onChange={setTriggerType}
                />
                {triggerType !== "ALL_PRODUCTS" && (
                  <Button
                    onClick={() =>
                      selectResource(
                        triggerType === "SPECIFIC_COLLECTIONS" ? "collection" : "product",
                        setTriggerItems,
                      )
                    }
                  >
                    Edit triggers
                  </Button>
                )}
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="400">
                <Button onClick={() => selectResource("product", setUpsellItems)}>Edit upsell products</Button>
              </BlockStack>
            </Card>
            <Card>
              <InlineStack gap="400">
                <Select
                  label="Discount type"
                  options={[
                    { label: "Percentage", value: "percentage" },
                    { label: "Fixed amount", value: "fixed_amount" },
                  ]}
                  value={discountType}
                  onChange={setDiscountType}
                />
                <TextField label="Discount value" type="number" value={discountValue} onChange={setDiscountValue} autoComplete="off" />
              </InlineStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
