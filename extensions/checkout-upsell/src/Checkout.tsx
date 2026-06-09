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
  // A/B test state
  const [abVariant, setAbVariant] = useState<string | null>(null);
  const [abTestId, setAbTestId] = useState<string | null>(null);

  const shopDomain = shop.myshopifyDomain;
  const appUrl = `https://${shopDomain}/apps/beta-upsell/api`;
  const funnelApiUrl = `https://${shopDomain}/apps/beta-upsell/api`;

  useEffect(() => {
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
            const offerData = { ...data.offer, upsellProducts: availableUpsells };

            // --- A/B Test Assignment ---
            // If this is a funnel-based offer, check for running A/B test
            if (data.offer.funnelId) {
              try {
                // Generate a deterministic session ID from cart contents
                const sessionId = cartLines.map(l => l.merchandise.id).sort().join('_');
                const abRes = await fetch(
                  `${funnelApiUrl}/abtest-assign?funnelId=${data.offer.funnelId}&sessionId=${encodeURIComponent(sessionId)}`
                );
                const abData = await abRes.json();

                if (abData.hasAbTest && abData.config) {
                  setAbVariant(abData.variant);
                  setAbTestId(abData.testId);
                  // Apply variant config overrides to the widget config
                  const variantConfig = abData.config;
                  if (variantConfig.discountType) offerData.discountType = variantConfig.discountType;
                  if (variantConfig.discountValue !== undefined) offerData.discountValue = variantConfig.discountValue;
                  if (variantConfig.heading) offerData.heading = variantConfig.heading;
                  if (variantConfig.acceptButtonText) offerData.acceptButtonText = variantConfig.acceptButtonText;
                } else {
                  // No A/B test — default variant A
                  setAbVariant('A');
                }
              } catch (abErr) {
                console.error('A/B test assignment failed, using default:', abErr);
                setAbVariant('A');
              }
            }

            setOffer(offerData);
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

  // Track impression with A/B variant info
  useEffect(() => {
    if (offer && !impressionTracked) {
      setImpressionTracked(true);
      fetch(`${appUrl}/analytics-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: shopDomain,
          offerId: offer.id,
          funnelId: offer.funnelId || null,
          stepId: offer.stepId || null,
          variantKey: abVariant || null,
          eventType: 'shown',
          device: 'unknown',
        })
      }).catch(console.error);
    }
  }, [offer, impressionTracked, appUrl, shopDomain, abVariant]);

  if (loading || !offer) return null;

  // Use variant-overridden heading if available
  const heading = offer.heading || 'Wait! Complete your order with this special offer';
  const acceptButtonText = offer.acceptButtonText || 'Add';

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
        // Track acceptance with A/B variant info
        fetch(`${appUrl}/analytics-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: shopDomain,
            offerId: offer.id,
            funnelId: offer.funnelId || null,
            stepId: offer.stepId || null,
            variantKey: abVariant || null,
            eventType: 'accepted',
            upsellRevenue: product.originalPrice,
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
      <Text size="base" emphasis="bold">{heading}</Text>
      
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
            {acceptButtonText}
          </Button>
        </InlineLayout>
      ))}
    </BlockStack>
  );
}
