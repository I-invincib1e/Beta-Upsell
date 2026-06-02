# App Review — Week 1 compliance changes

After merging, run **`pnpm run deploy`** so `shopify.app.toml` updates webhooks and app proxy on Partners.

## Partner Dashboard listing

Set **Privacy policy URL** to:

`https://beta-upsell-production.up.railway.app/app/privacy`

(Requires merchant to be logged into the embedded app, or use a public route if you add one later.)

## Railway production env

- `NODE_ENV=production` — billing uses **live** charges (`isTest: false`)
- Optional: `SHOPIFY_BILLING_TEST=true` to force test charges on production for QA

## App proxy

Configured in `shopify.app.toml`:

- Storefront: `https://{shop}.myshopify.com/apps/beta-upsell/api/*`
- Backend: `{application_url}/api/*`

Verify in **Settings → Apps and sales channels → Develop apps → your app → App proxy** after deploy.
