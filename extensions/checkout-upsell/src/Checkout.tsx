import {
  reactExtension,
  useApi,
  useCartLines,
  useApplyCartLinesChange,
  useApplyDiscountCodeChange,
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
  const applyDiscountCodeChange = useApplyDiscountCodeChange();
  const cartLines = useCartLines();

  const [offer, setOffer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [impressionTracked, setImpressionTracked] = useState(false);

  const shopDomain = shop.myshopifyDomain;
  const appUrl = `https://${shopDomain}/apps/beta-upsell/api`;
  const sessionId = `checkout-${shopDomain}`;

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
        const res = await fetch(`${appUrl}/offers?shop=${shopDomain}&placement=checkout&productIds=${encodeURIComponent(productIds)}`);
        const data = await res.json();

        if (data && data.offer && data.offer.upsellProducts) {
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
          sessionId,
        })
      }).catch(console.error);
    }
  }, [offer, impressionTracked, appUrl, shopDomain, sessionId]);

  if (loading || !offer) return null;

  async function handleAddOffer(product: any) {
    setAdding(product.id);
    setHasError(false);

    try {
      if (offer.discountCode) {
        const discountResult = await applyDiscountCodeChange({
          type: 'addDiscountCode',
          code: offer.discountCode,
        });
        if (discountResult.type === 'error') {
          console.warn('Discount code could not be applied:', discountResult.message);
        }
      }

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
        const revenue = product.discountedPrice ?? product.originalPrice ?? 0;
        fetch(`${appUrl}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: shopDomain,
            offerId: offer.id,
            eventType: 'accepted',
            upsellRevenue: revenue,
            sessionId,
            productId: product.id,
          })
        }).catch(console.error);

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

  const discountHint = offer.discountCode
    ? (offer.discountType === 'percentage'
      ? `Includes ${offer.discountValue}% off with code ${offer.discountCode}`
      : `Includes $${offer.discountValue} off with code ${offer.discountCode}`)
    : 'Recommended add-on for your order';

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
              {discountHint}
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
