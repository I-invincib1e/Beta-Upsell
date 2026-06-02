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

  useEffect(() => {
    async function fetchOffer() {
      try {
        const productIds = order?.lines?.map((line: any) => line.merchandise?.product?.id?.split('/')?.pop())?.filter(Boolean)?.join(',') || '';
        const res = await fetch(`${appUrl}/offers?shop=${shopDomain}&placement=thank_you&productIds=${encodeURIComponent(productIds)}`);
        const data = await res.json();
        
        if (data && data.offer && data.offer.upsellProducts && data.offer.upsellProducts.length > 0) {
          setOffer(data.offer);
        }
      } catch (err) {
        console.error("Failed to fetch thank you offer", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOffer();
  }, [shopDomain, appUrl]);

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
          device: 'unknown'
        })
      }).catch(console.error);
    }
  }, [offer, impressionTracked, appUrl, shopDomain]);

  if (loading || !offer) return null;

  const handleAcceptOffer = (product: any) => {
    // Track click
    fetch(`${appUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shop: shopDomain,
        offerId: offer.id,
        eventType: 'accepted',
        upsellRevenue: product.originalPrice
      })
    }).catch(console.error);
    
    // Redirect to product page 
    // @ts-ignore
    window.open(`https://${shopDomain}/products/${product.handle || product.id}`, '_blank');
  };

  return (
    <BlockStack spacing="loose" padding="tight" border="base" cornerRadius="base">
      <Text size="base" emphasis="bold">Special Thank You Offer!</Text>
      
      {offer.upsellProducts.map((product: any) => (
        <InlineLayout
          key={product.id}
          spacing="base"
          columns={['20%', 'fill', 'auto']}
          blockAlignment="center"
        >
          {product.image && (
            <Image source={product.image} />
          )}
          
          <BlockStack spacing="none">
            <Text size="base" emphasis="bold">{product.title}</Text>
            <Text size="small" appearance="subdued">
              {offer.discountType === 'percentage' 
                ? `Save ${offer.discountValue}% instantly!` 
                : `Save $${offer.discountValue} instantly!`}
            </Text>
          </BlockStack>
          
          <Button onPress={() => handleAcceptOffer(product)}>
            Claim Offer
          </Button>
        </InlineLayout>
      ))}
    </BlockStack>
  );
}
