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

function shopApiBase(shopDomain: string) {
  return `https://${shopDomain}/apps/beta-upsell/api`;
}

function sumOriginalPrice(offer: { upsellProducts?: { originalPrice?: string | number }[] }) {
  return (offer.upsellProducts || []).reduce((sum, product) => {
    return sum + parseFloat(String(product.originalPrice || 0));
  }, 0);
}

function computeFinalPrice(offer: { discountType: string; discountValue: number; upsellProducts?: { originalPrice?: string | number }[] }) {
  const originalPrice = sumOriginalPrice(offer);
  if (offer.discountType === "percentage") {
    return Math.max(0, originalPrice * (1 - offer.discountValue / 100));
  }
  return Math.max(0, originalPrice - offer.discountValue);
}

extend("Checkout::PostPurchase::ShouldRender", async ({ inputData, storage }) => {
  const shopDomain = inputData.shop.domain;
  const orderId = inputData.initialPurchase?.referenceId || inputData.initialPurchase?.order?.id || null;

  try {
    const productIds = inputData.initialPurchase.lineItems.map((item: any) => item.product.id).join(",");
    const response = await fetch(
      `${shopApiBase(shopDomain)}/offers?shop=${encodeURIComponent(shopDomain)}&placement=post_purchase&productIds=${encodeURIComponent(productIds)}`
    );
    if (!response.ok) throw new Error("Failed to fetch offer");

    const data = await response.json();

    if (data.offer && data.offer.upsellProducts && data.offer.upsellProducts.length > 0) {
      await storage.update({ offer: data.offer, orderId });
      return { render: true };
    }
  } catch (err) {
    console.error("Error fetching offer:", err);
  }

  return { render: false };
});

render("Checkout::PostPurchase::Render", App);

export function App({ storage }) {
  const { inputData, calculateChangeset, applyChangeset, done } = useExtensionInput();
  const offer = storage.initialData?.offer;
  const orderId = storage.initialData?.orderId || inputData.initialPurchase?.referenceId || null;
  const shopDomain = inputData.shop.domain;
  const apiBase = shopApiBase(shopDomain);

  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [impressionTracked, setImpressionTracked] = useState(false);

  React.useEffect(() => {
    if (offer && !impressionTracked) {
      setImpressionTracked(true);
      fetch(`${apiBase}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: "shown",
          orderId,
        })
      }).catch(console.error);
    }
  }, [offer, impressionTracked, apiBase, shopDomain, orderId]);

  if (!offer) {
    return null;
  }

  const finalPrice = computeFinalPrice(offer);

  const handleAccept = async () => {
    if (isAccepting) return;
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
        fetch(`${apiBase}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop: shopDomain,
            offerId: offer.id,
            eventType: "accepted",
            upsellRevenue: finalPrice,
            orderId,
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
    if (isDeclining) return;
    setIsDeclining(true);
    try {
      await fetch(`${apiBase}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: "declined",
          orderId,
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
                  ? `Get ${offer.discountValue}% off when you add these items now.`
                  : `Save $${offer.discountValue} when you add these items now.`}
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
              Add to Order — ${finalPrice.toFixed(2)}
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
