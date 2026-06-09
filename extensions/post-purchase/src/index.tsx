// @ts-nocheck
import React, { useState } from 'react';
import {
  extend,
  render,
  BlockStack,
  Button,
  CalloutBanner,
  Heading,
  Image,
  Layout,
  TextBlock,
  TextContainer,
  View,
  useExtensionInput
} from "@shopify/post-purchase-ui-extensions-react";

const APP_URL = "https://beta-upsell-production.up.railway.app";

extend("Checkout::PostPurchase::ShouldRender", async ({ inputData, storage }) => {
  const shopDomain = inputData.shop.domain;
  
  try {
    const productIds = inputData.initialPurchase.lineItems.map((item: any) => item.product.id).join(",");
    // Try new FunnelX API first, fall back to legacy
    let response;
    try {
      response = await fetch(`${APP_URL}/api/funnel-data?shop=${shopDomain}&placement=post_purchase&productIds=${encodeURIComponent(productIds)}`);
    } catch {
      response = await fetch(`${APP_URL}/api/offers?shop=${shopDomain}&placement=post_purchase&productIds=${encodeURIComponent(productIds)}`);
    }
    if (!response.ok) throw new Error("Failed to fetch offer");
    
    const data = await response.json();
    
    if (data.offer && data.offer.upsellProducts && data.offer.upsellProducts.length > 0) {
      let offerData = data.offer;
      let abVariant = "A";
      let abTestId = null;

      // --- A/B Test Assignment ---
      if (data.offer.funnelId) {
        try {
          // Use customer ID for deterministic assignment (available in post-purchase)
          const customerId = inputData.initialPurchase?.customerId
            || inputData.initialPurchase?.lineItems?.[0]?.product?.id
            || `anon_${Date.now()}`;
          
          const abRes = await fetch(
            `${APP_URL}/api/abtest-assign?funnelId=${data.offer.funnelId}&customerId=${encodeURIComponent(String(customerId))}`
          );
          const abData = await abRes.json();

          if (abData.hasAbTest && abData.config) {
            abVariant = abData.variant;
            abTestId = abData.testId;
            // Apply variant config overrides
            const vc = abData.config;
            if (vc.discountType) offerData.discountType = vc.discountType;
            if (vc.discountValue !== undefined) offerData.discountValue = vc.discountValue;
            if (vc.heading) offerData.heading = vc.heading;
            if (vc.acceptButtonText) offerData.acceptButtonText = vc.acceptButtonText;
            if (vc.description) offerData.description = vc.description;
          }
        } catch (abErr) {
          console.error("A/B test assignment failed:", abErr);
        }
      }

      await storage.update({
        offer: offerData,
        abVariant,
        abTestId,
      });
      return { render: true };
    }
  } catch (err) {
    console.error("Error fetching offer:", err);
  }

  return { render: false };
});

render("Checkout::PostPurchase::Render", App);

export function App({ extensionPoint, storage }) {
  const { inputData, calculateChangeset, applyChangeset, done } = useExtensionInput();
  const offer = storage.initialData?.offer;
  const abVariant = storage.initialData?.abVariant || "A";
  const abTestId = storage.initialData?.abTestId || null;
  const shopDomain = inputData.shop.domain;
  
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Send an impression event when the component mounts (with A/B variant info)
  React.useEffect(() => {
    if (offer) {
      fetch(`${APP_URL}/api/analytics-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          funnelId: offer.funnelId || null,
          stepId: offer.stepId || null,
          variantKey: abVariant,
          eventType: "shown",
        })
      }).catch(console.error);
    }
  }, [offer, shopDomain]);

  if (!offer) {
    return null;
  }

  const originalPrice = parseFloat(offer.originalPrice || "0");
  let discountAmount = 0;
  
  if (offer.discountType === "percentage") {
    discountAmount = (originalPrice * offer.discountValue) / 100;
  } else {
    discountAmount = offer.discountValue;
  }
  
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  // Use variant-overridden copy if available
  const heading = offer.heading || "Add to your order";
  const acceptButtonText = offer.acceptButtonText || "Add to Order";
  const description = offer.description || (
    offer.discountType === 'percentage' 
      ? `Get ${offer.discountValue}% off instantly when you add these to your order.` 
      : `Save $${offer.discountValue} instantly when you add these to your order.`
  );

  const handleAccept = async () => {
    setIsAccepting(true);
    setErrorText("");
    
    try {
      const changes = offer.upsellProducts.map((product: any) => ({
        type: "add_variant", 
        variantId: Number(product.variantId), 
        quantity: 1, 
        discount: { 
          value: offer.discountValue, 
          valueType: offer.discountType === "percentage" ? "percentage" : "fixed_amount",
          title: "Special Offer"
        } 
      }));

      const changeset = await calculateChangeset({ changes });

      if (changeset.errors && changeset.errors.length > 0) {
        throw new Error(changeset.errors[0].message);
      }

      const applyResult = await applyChangeset(changeset.calculatedPurchase?.token);
      
      if (applyResult.status === "success") {
        // Track acceptance with A/B variant info
        fetch(`${APP_URL}/api/analytics-event`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: shopDomain,
            offerId: offer.id,
            funnelId: offer.funnelId || null,
            stepId: offer.stepId || null,
            variantKey: abVariant,
            eventType: "accepted",
            upsellRevenue: finalPrice,
          })
        }).catch(e => console.error(e));
        
        done();
      } else {
        throw new Error("Payment could not be processed for the upsell.");
      }
    } catch (err) {
      console.error(err);
      setErrorText("There was an issue processing your request. Please try again.");
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await fetch(`${APP_URL}/api/analytics-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          funnelId: offer.funnelId || null,
          stepId: offer.stepId || null,
          variantKey: abVariant,
          eventType: "declined",
        })
      });
    } catch (err) {
      console.error(err);
    } finally {
      done();
    }
  };

  return (
    <BlockStack spacing="loose">
      <CalloutBanner title="Special One-Time Offer — Just For You!">
        Please review the exclusive offers below.
      </CalloutBanner>
      
      <Layout
        maxInlineSize={0.95}
        media={[
          { viewportSize: 'small', sizes: [1, 0, 1], maxInlineSize: 0.9 },
          { viewportSize: 'medium', sizes: [532, 0, 1], maxInlineSize: 420 },
          { viewportSize: 'large', sizes: [560, 38, 340] },
        ]}
      >
        <View>
          <BlockStack spacing="loose">
            <TextContainer>
              <Heading>{heading}</Heading>
              <TextBlock>{description}</TextBlock>
            </TextContainer>
            <BlockStack spacing="loose">
              {offer.upsellProducts.map((product: any) => (
                <Layout key={product.id} media={[{ viewportSize: 'small', sizes: [100, 1] }]} spacing="base">
                  {product.image && <Image source={product.image} />}
                  <BlockStack spacing="none">
                    <TextBlock>{product.title}</TextBlock>
                    <TextBlock appearance="subdued">
                      ${product.originalPrice}
                    </TextBlock>
                  </BlockStack>
                </Layout>
              ))}
            </BlockStack>
          </BlockStack>
        </View>
        <View />
        <View>
          <BlockStack spacing="base">
            <Button
              onPress={handleAccept}
              submit
              loading={isAccepting}
              disabled={isDeclining}
            >
              {acceptButtonText}
            </Button>
            <Button
              onPress={handleDecline}
              subdued
              loading={isDeclining}
              disabled={isAccepting}
            >
              Decline Offer
            </Button>
            {errorText && (
              <TextBlock appearance="critical">{errorText}</TextBlock>
            )}
          </BlockStack>
        </View>
      </Layout>
    </BlockStack>
  );
}