# App Review — Week 3

Week 3 focuses on **honest discounts**, **analytics integrity**, and **storefront security** after Week 1 (compliance) and Week 2 (proxy, metafields, offers UX).

## Shipped in Week 3

### Discount codes (checkout, cart, thank-you, product page)

- On offer create/edit, the app creates a Shopify **basic discount code** (`write_discounts` scope) limited to upsell products.
- Code stored on `Offer.discountCode` (e.g. `BETAUP-…`).
- **Checkout extension** applies the code via `useApplyDiscountCodeChange` before adding the line.
- **Thank-you extension** links to `/discount/{code}?redirect=/products/{handle}`.
- **Cart / FBT theme blocks** show “Use code … at checkout” (cart cannot auto-apply checkout discounts).

### Event idempotency

- `OfferEvent.idempotencyKey` with unique `(storeId, idempotencyKey)`.
- API dedupes before incrementing `AnalyticsDaily`.
- Extensions send `orderId`, `sessionId`, or `productId` where available.
- Cart `shown` uses `sessionStorage` to avoid one impression per page load.

### API security

- `api.events` enforces `assertStorefrontApiAccess` (app proxy HMAC in production).
- Post-purchase uses **shop app proxy** URLs (`https://{shop}/apps/beta-upsell/api/…`) instead of hardcoded Railway host.

### Post-purchase

- Revenue based on sum of upsell variant prices (not `offer.originalPrice`).
- `orderId` on all analytics events.
- Double-submit guard on accept/decline.

### Theme

- Cart offers filtered by `type: cart`; product page by `type: product_page`.
- `img_url` → `image_url` in theme blocks.
- Cart add uses `routes.cart_add_url`; `accepted` event on form submit.

### Config

- `shopify.app.toml`: `write_discounts` scope (merchants must re-approve scopes after deploy).
- Removed orphan webhook registrations from `shopify.server.ts` (TOML is source of truth).

## Deploy checklist

1. Merge PR and redeploy **Railway** (`NODE_ENV=production`).
2. `pnpm run deploy` / release new Shopify version (scope change triggers re-auth).
3. Merchants reinstall or approve **discount** scope in admin.
4. Re-save active offers (or edit once) so discount codes are created in Shopify.

## Still out of scope (future)

- Automatic cart-line discounts without checkout (Shopify Function / Cart Transform).
- Per-order discount caps and usage limits on codes.
- Full GDPR data-request export payload to merchant email.
