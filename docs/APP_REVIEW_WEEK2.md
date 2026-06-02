# App Review — Week 2 merchant & storefront fixes

## Deployed to Shopify (version `upsell-5`)

- GDPR webhooks + app proxy from Week 1 (in TOML)
- Checkout/thank-you extensions API `2025-07`
- Thank-you target: `purchase.thank-you.block.render`

**Note:** Partner may still require approving **network access** for checkout/thank-you extensions before they publish to all shops.

## Code changes

| Area | Fix |
|------|-----|
| Theme metafields | Sync **cart + product_page** offers with `type` field |
| Liquid | Filter offers by `type` per block |
| App proxy | HMAC verification on `/api/offers` and `/api/events` in production |
| Offers | Edit route, cascade delete, placement labels, draft toggle |
| Analytics | Empty state when no store data |
| Post-purchase | Uses shop app proxy URL (not hardcoded Railway) |
| Checkout UI | Removed misleading “Save X%” copy (discount not applied at checkout yet) |

## Railway

Ensure `NODE_ENV=production` on the web service after merge.

## Remaining (Week 3+)

- Apply real discounts on checkout/cart/thank-you surfaces
- Event idempotency keys
- Theme check img_url → image_url migration
