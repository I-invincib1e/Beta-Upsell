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
    const response = await fetch(`${APP_URL}/api/offers?shop=${shopDomain}&placement=post_purchase&productIds=${encodeURIComponent(productIds)}`);
    if (!response.ok) throw new Error("Failed to fetch offer");
    
    const data = await response.json();
    
    if (data.offer && data.offer.upsellProducts && data.offer.upsellProducts.length > 0) {
      await storage.update({ offer: data.offer });
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
  const shopDomain = inputData.shop.domain;
  
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Send an impression event when the component mounts
  React.useEffect(() => {
    if (offer) {
      fetch(`${APP_URL}/api/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: "shown"
        })
      }).catch(console.error);
    }
  }, [offer, shopDomain]);

  if (!offer) {
    return null; // Should not happen since ShouldRender guards this
  }

  const originalPrice = parseFloat(offer.originalPrice || "0");
  let discountAmount = 0;
  
  if (offer.discountType === "percentage") {
    discountAmount = (originalPrice * offer.discountValue) / 100;
  } else {
    discountAmount = offer.discountValue;
  }
  
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  const handleAccept = async () => {
    setIsAccepting(true);
    setErrorText("");
    
    try {
      // Create changes for all upsell products
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

      // 1. Calculate Changeset
      const changeset = await calculateChangeset({ changes });

      if (changeset.errors && changeset.errors.length > 0) {
        throw new Error(changeset.errors[0].message);
      }

      // 2. Apply Changeset (This actually charges the card!)
      const applyResult = await applyChangeset(changeset.calculatedPurchase?.token);
      
      if (applyResult.status === "success") {
        // 3. Track success in our analytics
        fetch(`${APP_URL}/api/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: shopDomain,
            offerId: offer.id,
            eventType: "accepted",
            upsellRevenue: finalPrice
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
      await fetch(`${getStorefrontApiBase(shopDomain)}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: "declined"
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
      <CalloutBanner title="Special One-Time Offer">
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
              <Heading>Add to your order</Heading>
              <TextBlock>
                {offer.discountType === 'percentage' 
                  ? `Get ${offer.discountValue}% off instantly when you add these to your order.` 
                  : `Save $${offer.discountValue} instantly when you add these to your order.`}
              </TextBlock>
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
              Add to Order
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