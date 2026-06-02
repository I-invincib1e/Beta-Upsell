// @ts-nocheck
import {
  reactExtension,
  useApi,
  BlockStack,
  Button,
  Image,
  InlineLayout,
  Text,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

export default reactExtension(
  'purchase.thank-you.block.render',
  () => <Extension />,
);

function Extension() {
  const { shop, order } = useApi();

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [impressionTracked, setImpressionTracked] = useState(false);

  const shopDomain = shop.myshopifyDomain;
  const appUrl = `https://${shopDomain}/apps/beta-upsell/api`;
  const orderId = order?.id?.split('/').pop() || null;

  useEffect(() => {
    async function fetchOffer() {
      try {
        const productIds = order?.lines?.map((line: any) => line.merchandise?.product?.id?.split('/')?.pop())?.filter(Boolean)?.join(',') || '';
        const res = await fetch(`${appUrl}/offers?shop=${shopDomain}&placement=thank_you&productIds=${encodeURIComponent(productIds)}`);
        const data = await res.json();

        if (data?.offer?.upsellProducts?.length > 0) {
          setOffer(data.offer);
        }
      } catch (err) {
        console.error("Failed to fetch thank you offer", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOffer();
  }, [shopDomain, appUrl, order]);

  useEffect(() => {
    if (offer && !impressionTracked) {
      setImpressionTracked(true);
      fetch(`${appUrl}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          eventType: 'shown',
          orderId,
        })
      }).catch(console.error);
    }
  }, [offer, impressionTracked, appUrl, shopDomain, orderId]);

  if (loading || !offer) return null;

  return (
    <BlockStack spacing="loose" padding="tight" border="base" cornerRadius="base">
      <Text size="base" emphasis="bold">Special Thank You Offer!</Text>

      {offer.upsellProducts.map((product: any) => {
        const productPath = `/products/${product.handle || product.id}`;
        const href = offer.discountCode
          ? `https://${shopDomain}/discount/${offer.discountCode}?redirect=${encodeURIComponent(productPath)}`
          : `https://${shopDomain}${productPath}`;

        const hint = offer.discountCode
          ? (offer.discountType === 'percentage'
            ? `Use code ${offer.discountCode} for ${offer.discountValue}% off`
            : `Use code ${offer.discountCode} to save $${offer.discountValue}`)
          : 'Shop this recommended product';

        return (
          <InlineLayout
            key={product.id}
            spacing="base"
            columns={['20%', 'fill', 'auto']}
            blockAlignment="center"
          >
            {product.image && <Image source={product.image} />}

            <BlockStack spacing="none">
              <Text size="base" emphasis="bold">{product.title}</Text>
              <Text size="small" appearance="subdued">{hint}</Text>
            </BlockStack>

            <Button
              to={href}
              onPress={() => {
                const revenue = product.discountedPrice ?? product.originalPrice ?? 0;
                fetch(`${appUrl}/events`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    shop: shopDomain,
                    offerId: offer.id,
                    eventType: 'accepted',
                    upsellRevenue: revenue,
                    orderId,
                    productId: product.id,
                  })
                }).catch(console.error);
              }}
            >
              Claim Offer
            </Button>
          </InlineLayout>
        );
      })}
    </BlockStack>
  );
}
