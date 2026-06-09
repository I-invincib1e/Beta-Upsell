import {
  reactExtension,
  useApi,
  useCartLines,
  useApplyCartLinesChange,
  Banner,
  BlockStack,
  Button,
  Image,
  InlineLayout,
  Text,
} from '@shopify/ui-extensions-react/checkout';
import { useEffect, useState } from 'react';

export default reactExtension(
  'purchase.checkout.block.render',
  () => <Extension />,
);

function Extension() {
  const { shop } = useApi();
  const applyCartLinesChange = useApplyCartLinesChange();
  const cartLines = useCartLines();

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);

  // Note: For a production app, the shop domain can be retrieved from shop.myshopifyDomain
  const shopDomain = shop.myshopifyDomain;
  // Construct proxy URL or fallback to the app URL
  // We'll use the Shopify App Proxy to hit our backend securely. If proxy isn't set up, we could use an absolute URL.
  const appUrl = `https://${shopDomain}/apps/beta-upsell/api`; 
  // New FunnelX API — falls back to legacy offers if no funnels exist
  const funnelApiUrl = `https://${shopDomain}/apps/beta-upsell/api`;

  useEffect(() => {
    // Check if the cart already has an item with our offer ID property to avoid showing it if already added
    const hasUpsellInCart = cartLines.some(line => 
      line.attributes?.some(attr => attr.key === '_upsell_offer_id')
    );

    if (hasUpsellInCart) {
      setLoading(false);
      return;
    }

    async function fetchOffer() {
      try {
        const productIds = cartLines.map(line => line.merchandise.product?.id || '').filter(Boolean).join(',');
        // Try new funnel-data API first, fall back to legacy offers
        let res;
        try {
          res = await fetch(`${funnelApiUrl}/funnel-data?shop=${shopDomain}&placement=checkout&productIds=${encodeURIComponent(productIds)}`);
        } catch {
          res = await fetch(`${appUrl}/offers?shop=${shopDomain}&placement=checkout&productIds=${encodeURIComponent(productIds)}`);
        }
        const data = await res.json();
        
        if (data && data.offer && data.offer.upsellProducts) {
          // Filter out products already in cart
          const availableUpsells = data.offer.upsellProducts.filter((upsell: any) => 
            !cartLines.some(line => line.merchandise.id.includes(upsell.variantId))
          );
          
          if (availableUpsells.length > 0) {
            setOffer({ ...data.offer, upsellProducts: availableUpsells });
          }
        }
      } catch (err) {
        console.error("Failed to fetch checkout offer", err);
      } finally {
        setLoading(false);
      }
    }

    fetchOffer();
  }, [shopDomain, cartLines, appUrl]);

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
          device: 'unknown' // Checkout UI extensions don't expose device easily
        })
      }).catch(console.error);
    }
  }, [offer, impressionTracked, appUrl, shopDomain]);

  if (loading || !offer) return null;

  async function handleAddOffer(product: any) {
    setAdding(product.id);
    setHasError(false);

    try {
      const result = await applyCartLinesChange({
        type: 'addCartLine',
        merchandiseId: `gid://shopify/ProductVariant/${product.variantId}`,
        quantity: 1,
        attributes: [
          { key: '_upsell_offer_id', value: offer.id }
        ]
      });

      if (result.type === 'error') {
        setHasError(true);
        setAdding(false);
      } else {
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
        
        // Remove the added product from the list of upsells
        const remaining = offer.upsellProducts.filter((p: any) => p.id !== product.id);
        if (remaining.length > 0) {
          setOffer({ ...offer, upsellProducts: remaining });
          setAdding(false);
        } else {
          setOffer(null);
        }
      }
    } catch (err) {
      console.error(err);
      setHasError(true);
      setAdding(false);
    }
  }

  return (
    <BlockStack spacing="loose" padding="tight" border="base" cornerRadius="base">
      <Text size="base" emphasis="bold">Wait! Complete your order with this special offer</Text>
      
      {hasError && (
        <Banner status="critical">
          There was an issue adding this item to your order.
        </Banner>
      )}

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
          
          <Button
            loading={adding === product.id}
            onPress={() => handleAddOffer(product)}
          >
            Add
          </Button>
        </InlineLayout>
      ))}
    </BlockStack>
  );
}
