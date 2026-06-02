# AGENTS.md

## Cursor Cloud specific instructions

### Product

Shopify embedded Remix app (**Upsell**) with PostgreSQL (Prisma), public JSON APIs at `/api/offers` and `/api/events`, and Shopify extensions under `extensions/*`. Full merchant E2E also requires Shopify Partners login, a dev store, and `shopify app dev` (tunnel + OAuth).

### Primary testing on Railway (team default)

- **App URL:** `https://beta-upsell-production.up.railway.app` (also in `shopify.app.toml` and post-purchase extension `APP_URL`).
- Smoke test: `GET https://beta-upsell-production.up.railway.app/api/offers?shop=<shopDomain>&placement=cart` (expect `{"offer":null}` or an offer object).
- Deploy to Railway after code changes; avoid running **local `pnpm run start` and Railway** against the **same** `DATABASE_URL` at once.
- Linked dev store (from `.shopify/project.json` after Partner login): `test2-nu1dzlri.myshopify.com`.

### Local PostgreSQL (this VM)

A dev database was provisioned for Cloud Agents:

- **URL:** `postgresql://upsell:upsell@localhost:5432/upsell_dev`
- **Start server (if needed):** `sudo pg_ctlcluster 16 main start` (or `sudo service postgresql start`)

Export `DATABASE_URL` before `pnpm run setup`, `pnpm run build`, or `pnpm run start`.

### Commands (see `package.json`)

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| DB schema | `pnpm run setup` (`prisma generate && prisma db push`) |
| Lint | `pnpm run lint` (may report pre-existing unused-import errors in a few routes) |
| Unit tests | `pnpm test` |
| Production build | `pnpm run build` |
| Run built app | `pnpm run start` (port **3000**, needs env vars below) |
| Shopify dev (tunnel + extensions) | `pnpm dev` → `shopify app dev` (use `npx @shopify/cli app dev`; interactive Partner login) |

### Env vars for local server (without Shopify CLI)

Minimum to boot `pnpm run start` or `remix vite:dev`:

- `DATABASE_URL` — see local PostgreSQL above (or omit if only testing Railway)
- `SHOPIFY_API_KEY` — `client_id` in `shopify.app.toml`
- `SHOPIFY_API_SECRET` — Partner Dashboard app secret (set on Railway; optional in VM for API-only checks)
- `SHOPIFY_APP_URL` — e.g. `http://localhost:3000` for local, or Railway URL for hosted tests
- `SCOPES` — e.g. `write_products`

Storefront API routes can be smoke-tested without OAuth by seeding `Store` / `Offer` rows (local DB) or hitting Railway with a real `shop` query param.

### Shopify CLI

Not bundled as a project dependency. Run via `npx @shopify/cli app dev`. Partner login creates `.shopify/project.json` with the linked dev store.

### Notes

- README still mentions SQLite; the repo uses **PostgreSQL** only (`prisma/schema.prisma`).
- CI (`.github/workflows/ci.yml`) runs `yarn install` only; local dev uses **pnpm** (`pnpm-lock.yaml` is gitignored).
- Enriching offers via Admin GraphQL in `/api/offers` requires a valid shop session; without it the handler still returns the raw Prisma offer.
