# AGENTS.md

## Cursor Cloud specific instructions

### Product

Shopify embedded Remix app (**Upsell**) with PostgreSQL (Prisma), public JSON APIs at `/api/offers` and `/api/events`, and Shopify extensions under `extensions/*`. Full merchant E2E also requires Shopify Partners login, a dev store, and `shopify app dev` (tunnel + OAuth).

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
| Shopify dev (tunnel + extensions) | `pnpm dev` → `shopify app dev` (requires global or `npx @shopify/cli`; interactive Partner login) |

### Env vars for local server (without Shopify CLI)

Minimum to boot `pnpm run start` or `remix vite:dev`:

- `DATABASE_URL` — see above
- `SHOPIFY_API_KEY` — `client_id` in `shopify.app.toml`
- `SHOPIFY_API_SECRET` — Partner Dashboard app secret (not in repo)
- `SHOPIFY_APP_URL` — e.g. `http://localhost:3000`
- `SCOPES` — e.g. `write_products`

Storefront API routes can be smoke-tested without OAuth by seeding `Store` / `Offer` rows and calling e.g. `GET /api/offers?shop=<shopDomain>&placement=cart`.

### Shopify CLI

Not bundled as a project dependency. Install with `npm install -g @shopify/cli@latest` (may need a user-writable prefix if global install is denied) or run via `npx @shopify/cli app dev`. `pnpm dev` expects `shopify` on `PATH`.

### Notes

- README still mentions SQLite; the repo uses **PostgreSQL** only (`prisma/schema.prisma`).
- CI (`.github/workflows/ci.yml`) runs `yarn install` only; local dev uses **pnpm** (no lockfile is committed yet—`pnpm install` resolves deps).
- Enriching offers via Admin GraphQL in `/api/offers` requires a valid shop session; without it the handler still returns the raw Prisma offer.
