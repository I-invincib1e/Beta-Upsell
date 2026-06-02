# Beta-Upsell (Shopify Upsell app)

Remix embedded app with Prisma/PostgreSQL, theme + checkout extensions, and Railway production at `https://beta-upsell-production.up.railway.app`.

## Cursor Cloud specific instructions

### Shopify app versions

- **Active production version (as of 2026-06-02):** `upsell-9` — Week 1/2 App Review changes (GDPR webhooks, app proxy `beta-upsell`, extension API `2025-07`, storefront/proxy security).
- **Do not use** `shopify app release --version <tag>` in CI/non-interactive VMs — it often returns “Version could not be found” even when `app versions list` shows the tag. **Use deploy with auto-release instead:**

  ```bash
  npx @shopify/cli@latest app deploy --allow-updates --version upsell-<N> --message "..."
  ```

  Omit `--no-release`. Network access for `checkout-upsell` and `thank-you-upsell` must be approved under Partner Dashboard → app → **API access** → **Allow network access in checkout UI extensions** before a version can be released.

- **Partners versions UI:** https://dev.shopify.com/dashboard/202009844/apps/371388776449/versions

### Services

| Service | Purpose | How to run (dev) |
|--------|---------|------------------|
| PostgreSQL | Sessions, offers, events | Local: `postgresql://upsell:upsell@localhost:5432/upsell_dev` (if provisioned) |
| Remix app | Admin + APIs + webhooks | `pnpm run dev` (Shopify CLI tunnel) or `pnpm run build && pnpm run start` on port 3000 |
| Shopify CLI | Deploy/release extensions + TOML | `pnpm run deploy` or `npx @shopify/cli@latest app deploy --allow-updates` |

### Lint / test / build

- Tests: `pnpm test` (Vitest, `app/utils/*.test.ts`)
- Build: `pnpm run build`
- Lint: `pnpm run lint` — may report many warnings in extension bundles; focus on `app/` errors if fixing CI

### Production (Railway)

- Set `NODE_ENV=production` so billing uses live mode (`app/utils/billing-env.server.ts`).
- After merging to `main`, redeploy Railway so routes like `/app/privacy` match the released app.
- App listing privacy URL: `https://beta-upsell-production.up.railway.app/app/privacy`

### App proxy (storefront)

Theme and extensions call: `https://{shop}.myshopify.com/apps/beta-upsell/api/offers` and `/api/events`. Production verifies HMAC when `NODE_ENV=production` (`app/utils/app-proxy.server.ts`).

### Docs

- `docs/APP_REVIEW_WEEK1.md` — GDPR, proxy, uninstall, billing (if present on branch)
- `docs/APP_REVIEW_WEEK2.md` — metafields, offer edit, proxy auth (if present on branch)
