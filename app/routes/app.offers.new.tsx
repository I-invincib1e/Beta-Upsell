import { useState, useCallback, useEffect } from "react";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
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
  Badge,
  Banner,
  List,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useNavigate, useSubmit, useActionData, useNavigation, useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getRecommendationsForProduct } from "../recommendations.server";
import { billingIsTest } from "../utils/billing-env.server";
import { getMerchantPlan, canCreateOffer } from "../utils/merchant-plan.server";
import { syncOfferDiscountCode } from "../utils/discount-codes.server";
import { isThemePlacement, syncThemeOffersMetafield } from "../utils/metafields.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing, admin, session } = await authenticate.admin(request);
  
  // 1. Remove forced billing for Freemium model

  const { plan, displayName } = await getMerchantPlan(session.shop, billing);

  // 2. Fetch recommendations if triggerProductId is provided
  const url = new URL(request.url);
  const triggerProductId = url.searchParams.get("triggerProductId");
  
  let recommendations = [];
  if (triggerProductId) {
    recommendations = await getRecommendationsForProduct(admin, triggerProductId);
  }

  // 3. Check active offer count
  const shopDomain = session.shop;
  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { offers: { where: { isActive: true } } }
  });
  
  const activeOfferCount = store?.offers.length || 0;

  return json({ recommendations, plan, activePlan: displayName, activeOfferCount });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const formData = await request.formData();
  const offerName = formData.get("offerName") as string;
  const placement = formData.get("placement") as string;
  const triggerType = formData.get("triggerType") as string;
  const triggerProductIdsStr = formData.get("triggerProductIds") as string;
  const upsellProductIdsStr = formData.get("upsellProductIds") as string;
  const discountType = formData.get("discountType") as string;
  const discountValue = parseFloat(formData.get("discountValue") as string) || 0;

  const triggerProductIds = JSON.parse(triggerProductIdsStr || "[]");
  const upsellProductIds = JSON.parse(upsellProductIdsStr || "[]");

  if (!offerName || upsellProductIds.length === 0) {
    return json({ error: "Offer name and at least one Upsell Product are required." }, { status: 400 });
  }

  if (discountValue < 0) {
    return json({ error: "Discount value cannot be negative." }, { status: 400 });
  }

  if (discountType === "percentage" && discountValue > 100) {
    return json({ error: "Percentage discount cannot exceed 100%." }, { status: 400 });
  }

  const { plan } = await getMerchantPlan(shopDomain, billing);

  let store = await prisma.store.findUnique({
    where: { shopDomain },
    include: { offers: { where: { isActive: true } } },
  });

  const gate = canCreateOffer(plan, placement, store?.offers.length ?? 0);
  if (!gate.ok) {
    return json({ error: gate.error }, { status: 403 });
  }
  if (!store) {
    store = await prisma.store.create({
      data: {
        shopDomain,
        accessToken: session.accessToken,
      },
      include: { offers: true },
    });
  }

  const created = await prisma.offer.create({
    data: {
      storeId: store.id,
      name: offerName,
      type: placement,
      triggerType: triggerType || "SPECIFIC_PRODUCTS",
      triggerProductIds,
      upsellProductIds,
      discountType,
      discountValue,
      isActive: true,
      healthStatus: "ok",
    },
  });

  const needsDiscountCode = ["checkout", "cart", "thank_you", "product_page"].includes(placement);
  if (needsDiscountCode) {
    try {
      const discountCode = await syncOfferDiscountCode(admin, {
        id: created.id,
        name: offerName,
        discountType,
        discountValue,
        upsellProductIds,
        discountCode: null,
      });
      await prisma.offer.update({
        where: { id: created.id },
        data: { discountCode, healthStatus: "ok" },
      });
    } catch (e) {
      console.error("discount sync failed", e);
      await prisma.offer.update({
        where: { id: created.id },
        data: { healthStatus: "needs_sync" },
      });
    }
  }

  if (isThemePlacement(placement)) {
    await syncThemeOffersMetafield(admin, store.id);
  }

  return redirect("/app/offers");
};

export default function NewOffer() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData<any>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const fetcher = useFetcher<typeof loader>();

  const [offerName, setOfferName] = useState("");
  const [placement, setPlacement] = useState("cart");
  
  const [triggerType, setTriggerType] = useState("SPECIFIC_PRODUCTS"); // SPECIFIC_PRODUCTS, SPECIFIC_COLLECTIONS, ALL_PRODUCTS
  const [triggerItems, setTriggerItems] = useState<{id: string, title: string}[]>([]);
  const [upsellItems, setUpsellItems] = useState<{id: string, title: string}[]>([]);

  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");

  const selectResource = async (type: 'product' | 'collection', setterItems: (items: any[]) => void) => {
    // @ts-ignore
    const selected = await shopify.resourcePicker({ type, multiple: true, action: 'select' });
    if (selected && selected.length > 0) {
      setterItems(selected.map((item: any) => ({ id: item.id, title: item.title })));
    }
  };

  // Recommendations: For V2, if multiple triggers, we could just fetch for the first one, or skip.
  const firstTriggerId = triggerItems.length > 0 ? triggerItems[0].id : null;
  useEffect(() => {
    if (triggerType === "SPECIFIC_PRODUCTS" && firstTriggerId && firstTriggerId.includes("gid://shopify/Product/")) {
      const timeoutId = setTimeout(() => {
        fetcher.load(`?triggerProductId=${encodeURIComponent(firstTriggerId)}`);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [firstTriggerId, triggerType]);

  const loaderData = useLoaderData<typeof loader>();
  const data: any = fetcher.data || loaderData;
  const recommendations = data?.recommendations || [];
  const activePlan = data?.activePlan;
  const plan = data?.plan ?? "free";
  const activeOfferCount = data?.activeOfferCount || 0;

  const isLimitReached = plan === "free" && activeOfferCount >= 1;

  const placementOptions = [
    { label: "Cart Drawer", value: "cart" },
    { label: "Product Page FBT", value: "product_page" },
    { 
      label: activePlan === null ? "Post-Purchase (Pro Only)" : "Post-Purchase (1-Click)", 
      value: "post_purchase", 
      disabled: activePlan === null
    },
    { 
      label: activePlan === null ? "Inline Checkout (Pro Only)" : "Inline Checkout", 
      value: "checkout", 
      disabled: activePlan === null
    },
    { 
      label: activePlan === null ? "Thank You Page (Pro Only)" : "Thank You Page", 
      value: "thank_you", 
      disabled: activePlan === null
    }
  ];

  const [formErrors, setFormErrors] = useState<string[]>([]);

  const handleSave = useCallback(() => {
    const errors: string[] = [];
    if (!offerName) errors.push("Offer Name is required.");
    if (triggerType !== "ALL_PRODUCTS" && triggerItems.length === 0) errors.push("At least one trigger item is required, or select All Products.");
    if (upsellItems.length === 0) errors.push("At least one Upsell Product is required.");
    
    const parsedDiscount = parseFloat(discountValue);
    if (isNaN(parsedDiscount) || parsedDiscount < 0) errors.push("Discount must be a positive number.");
    if (discountType === "percentage" && parsedDiscount > 100) errors.push("Percentage discount cannot exceed 100%.");

    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors([]);

    const formData = new FormData();
    formData.append("offerName", offerName);
    formData.append("placement", placement);
    formData.append("triggerType", triggerType);
    formData.append("triggerProductIds", JSON.stringify(triggerItems.map(i => i.id)));
    formData.append("upsellProductIds", JSON.stringify(upsellItems.map(i => i.id)));
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);

    submit(formData, { method: "post" });
  }, [offerName, placement, triggerType, triggerItems, upsellItems, discountType, discountValue, submit]);

  return (
    <Page
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      title="Create New Offer"
    >
      <TitleBar title="Create New Offer">
        <button variant="primary" onClick={handleSave} disabled={isSaving || isLimitReached}>
          {isSaving ? "Saving..." : "Save Offer"}
        </button>
      </TitleBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {isLimitReached && (
              <Banner title="Offer Limit Reached" tone="warning" action={{ content: "Upgrade Plan", onAction: () => navigate("/app/pricing") }}>
                <p>
                  You have reached the maximum number of active offers for the Free Plan (1 offer). 
                  Please upgrade your plan to create more.
                </p>
              </Banner>
            )}

            {(actionData?.error || formErrors.length > 0) && (
              <Banner title="Please fix the following errors:" tone="critical">
                <List>
                  {actionData?.error && <List.Item>{actionData.error}</List.Item>}
                  {formErrors.map((err, i) => <List.Item key={i}>{err}</List.Item>)}
                </List>
              </Banner>
            )}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Offer Details
                </Text>
                <TextField
                  label="Offer Name"
                  value={offerName}
                  onChange={setOfferName}
                  autoComplete="off"
                  helpText="Internal name to identify this offer."
                />
                <Select
                  label="Placement"
                  options={placementOptions}
                  value={placement}
                  onChange={setPlacement}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Trigger Conditions
                </Text>
                
                <Select
                  label="When should this offer be shown?"
                  options={[
                    { label: "When specific products are in the cart", value: "SPECIFIC_PRODUCTS" },
                    { label: "When items from specific collections are in the cart", value: "SPECIFIC_COLLECTIONS" },
                    { label: "For any product (Storewide)", value: "ALL_PRODUCTS" },
                  ]}
                  value={triggerType}
                  onChange={(val) => {
                    setTriggerType(val);
                    setTriggerItems([]); // Reset items on switch
                  }}
                />

                {triggerType !== "ALL_PRODUCTS" && (
                  <BlockStack gap="200">
                    <InlineStack gap="400" align="start">
                      <Button onClick={() => selectResource(triggerType === 'SPECIFIC_COLLECTIONS' ? 'collection' : 'product', setTriggerItems)}>
                        {triggerItems.length > 0 ? "Edit Selection" : `Browse ${triggerType === 'SPECIFIC_COLLECTIONS' ? 'Collections' : 'Products'}`}
                      </Button>
                    </InlineStack>
                    
                    {triggerItems.length > 0 && (
                      <InlineStack gap="200">
                        {triggerItems.map(item => (
                          <Badge tone="info" key={item.id}>{item.title}</Badge>
                        ))}
                      </InlineStack>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Upsell Products
                </Text>
                
                {recommendations.length > 0 && triggerType === "SPECIFIC_PRODUCTS" && (
                  <BlockStack gap="200">
                    <Text as="p" tone="subdued">AI Suggested Upsells for the first trigger product:</Text>
                    <InlineStack gap="200">
                      {recommendations.map((rec: any) => {
                        const isSelected = upsellItems.some(item => item.id === rec.id);
                        return (
                          <Button 
                            key={rec.id} 
                            onClick={() => {
                              if (isSelected) {
                                setUpsellItems(upsellItems.filter(item => item.id !== rec.id));
                              } else {
                                setUpsellItems([...upsellItems, { id: rec.id, title: rec.title }]);
                              }
                            }}
                            pressed={isSelected}
                          >
                            {rec.title} (Score: {rec.score})
                          </Button>
                        )
                      })}
                    </InlineStack>
                  </BlockStack>
                )}

                <BlockStack gap="200">
                  <Text as="p" tone="subdued">Select one or more products you want to offer as upsells.</Text>
                  <InlineStack gap="400" align="start">
                    <Button onClick={() => selectResource('product', setUpsellItems)} variant="primary">
                      {upsellItems.length > 0 ? "Edit Upsell Products" : "Browse Upsell Products"}
                    </Button>
                  </InlineStack>
                  {upsellItems.length > 0 && (
                    <InlineStack gap="200">
                      {upsellItems.map(item => (
                        <Badge tone="success" key={item.id}>{item.title}</Badge>
                      ))}
                    </InlineStack>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Discount Configuration
                </Text>
                <InlineStack gap="400">
                  <Select
                    label="Discount Type"
                    options={[
                      { label: "Percentage (%)", value: "percentage" },
                      { label: "Fixed Amount ($)", value: "fixed_amount" },
                    ]}
                    value={discountType}
                    onChange={setDiscountType}
                  />
                  <TextField
                    label="Discount Value"
                    type="number"
                    value={discountValue}
                    onChange={setDiscountValue}
                    autoComplete="off"
                  />
                </InlineStack>
              </BlockStack>
            </Card>

            <InlineStack align="end">
              <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={isLimitReached}>
                Save Offer
              </Button>
            </InlineStack>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
