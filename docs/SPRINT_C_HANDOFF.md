# Sprint C — Merchant launch handoff (your tasks)

Sprint A (billing integrity, plan enforcement, schema) and Sprint B (offers admin UX, health badges, webhooks) are implemented in the codebase and released as **upsell-12** from this VM when deploy succeeds.

The following cannot be completed inside the Cloud Agent VM and need you on Shopify Partner, Railway, and a real dev store.

## Production deploy (required)

1. **Merge** `main` after the Sprint A+B PR is merged.
2. **Railway** — redeploy `beta-upsell-production` from `main` with `NODE_ENV=production`.
3. **Database** — apply Prisma schema to production Postgres (Railway plugin or `prisma db push` from a machine that can reach `DATABASE_URL`). New columns: `Store.shopifySubscriptionId`, `Store.billingStatus`, `Store.trialEndsAt`, `Offer.discountCode`, `Offer.healthStatus`, `Offer.deactivatedByPlan`, `Offer.maxUpsellProducts`, `OfferEvent.idempotencyKey`.
4. **Shopify** — confirm app version **upsell-12** is active in Partner Dashboard → Apps → Upsell → Versions.
5. **Admin smoke** — open the app on a dev store → **Offers → Sync discount codes** once after deploy.

## App Store & compliance

| Task | Why |
|------|-----|
| Enable GDPR webhooks in `shopify.app.toml` and implement real `customers/data_request` export | Public listing requirement |
| App listing: 5+ screenshots, 60s video, test-store steps | Review rejection without these |
| Re-request scopes if you added `write_discounts` after first install | Merchants must re-approve |
| Theme QA on Dawn, Refresh, Sense | Cart embed + FBT block |
| 10–30 private beta merchants + collect reviews | Social proof before broad launch |

## QA checklist (dev store)

- [ ] Free plan: only 1 active offer; Pro placements blocked with clear message
- [ ] Pro trial / subscribe / downgrade: excess offers paused, Pro placements paused on Free
- [ ] Create cart + product_page offer → discount code created → checkout shows discount
- [ ] Post-purchase / checkout / thank-you extensions (Pro only)
- [ ] `/app/privacy` loads; uninstall webhook clears shop data
- [ ] App proxy: storefront events dedupe with `idempotencyKey`

## Support

- Email: hello@adloomx.com  
- Production URL: https://beta-upsell-production.up.railway.app
