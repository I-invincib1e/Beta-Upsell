# Beta-Upsell → [BRAND NAME TBD] Rework Plan
> Full engineering plan to transform the current app into a ReConvert-class upsell platform with a unique wedge.

**Status:** Pre-rework audit complete. ~60% of existing code is salvageable.  
**Stack:** Remix + Polaris + Prisma + PostgreSQL (no migration in V1)  
**Timeline:** 12 weeks / 6 sprints  
**⚠️ Action needed before Sprint 1:** Pick a brand name. Current `"Beta-Upsell"` appears in `package.json`, `shopify.app.toml`, and all extension `toml` files.

---

## 0. North Star

**What we are NOT doing:** Building another no-code upsell form tool.  
**What we ARE doing:** The first upsell app with a visual funnel canvas + flat pricing + checkout upsell on every plan — no rev share, ever.

Wedge vs. ReConvert:
| Feature | ReConvert | Us |
|---|---|---|
| Checkout upsell | Pro only (~$29+) | **All plans including free** |
| Revenue fee | 0.75% on revenue driven | **$0** |
| Funnel builder | Linear form steps | **Visual canvas (drag-drop)** |
| Pricing | Order-count tiers | **Flat tiers, no surprises** |
| Mobile preview | None | **Live side-by-side preview** |
| A/B testing | Paid add-on | **Built-in from Growth** |

---

## 1. What Stays (Do Not Touch)

These files/systems are solid. Keep as-is or with minor edits only.

### Shopify Extensions (all 5 — fully keep)
```
extensions/
  checkout-upsell/          ← Working. Remove Pro-only gate only.
  post-purchase/            ← Working. Keep entirely.
  thank-you-page/           ← Working. Fix redirect → 1-click (Sprint 3).
  order-status-page/        ← Working. Keep entirely.
  product-page-widget/      ← Working. Keep entirely.
```

### Backend Infrastructure
```
app/utils/billing.server.ts           ← Keep. Update plan names/prices only.
app/utils/discount.server.ts          ← Keep entirely.
app/utils/metafields.server.ts        ← Keep entirely.
app/utils/shopify.server.ts           ← Keep entirely.
app/webhooks/                         ← Keep all 4 webhooks. Add shop/redact (Sprint 1).
app/routes/api.webhooks.tsx           ← Keep. Add redact handler.
app/routes/api.validate-session.tsx   ← Keep entirely.
app/routes/api.offer-data.tsx         ← Keep. Will serve widget data from new schema.
prisma/schema.prisma (partial)        ← Keep: Shop, Session, AnalyticsDaily models.
                                         Modify: Offer model. Add: Funnel, FunnelStep, AbTest.
```

### Config
```
shopify.app.toml          ← Keep. Update app name + scopes if needed.
remix.config.js           ← Keep entirely.
package.json              ← Keep deps. Update name field.
```

---

## 2. What Gets Deleted

These files are dead weight, broken, or being replaced by better systems.

```
app/routes/app.additional.tsx         ← Unused template placeholder. Delete.
app/routes/app.offers.new.tsx         ← Replaced by funnel canvas flow.
app/routes/app.offers.$id.edit.tsx    ← Replaced by funnel canvas flow.
app/routes/app.offers._index.tsx      ← Replaced by new funnels list page.
app/components/OfferForm.tsx          ← Replaced by FunnelCanvas component.
app/components/OfferCard.tsx          ← Replaced by FunnelCard component.
```

> **Do NOT delete** `app/routes/app.offers.$id.tsx` — repurpose it as the funnel detail/analytics view.

---

## 3. What Gets Rebuilt (File-by-File)

### 3a. Schema — Prisma (`prisma/schema.prisma`)

**REMOVE from Offer model:**
- `conditions Json?` — dead field, nothing reads it
- `placement String` — flatten into FunnelStep

**RENAME:**
- `Offer` model → `Widget` (represents a single upsell/cross-sell unit)

**ADD models:**

```prisma
model Widget {
  id          String   @id @default(cuid())
  shop        String
  type        String   // "product_upsell" | "cross_sell" | "bundle" | "timer" | "review" | etc.
  config      Json     // widget-specific settings (product, discount, copy, style)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  steps FunnelStep[]

  @@index([shop])
}

model Funnel {
  id          String   @id @default(cuid())
  shop        String
  name        String
  status      String   @default("draft") // "draft" | "active" | "paused"
  triggerType String   // "product" | "cart_value" | "collection" | "all"
  triggerValue Json?   // e.g. { productIds: [...] } or { minCartValue: 50 }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  steps    FunnelStep[]
  abTests  AbTest[]

  @@index([shop])
  @@index([shop, status])
}

model FunnelStep {
  id          String   @id @default(cuid())
  funnelId    String
  widgetId    String
  placement   String   // "checkout" | "post_purchase" | "thank_you" | "order_status" | "product_page"
  position    Int      // order in funnel (0-indexed)
  config      Json?    // step-level overrides on top of widget config

  funnel  Funnel  @relation(fields: [funnelId], references: [id], onDelete: Cascade)
  widget  Widget  @relation(fields: [widgetId], references: [id])

  @@index([funnelId])
}

model AbTest {
  id          String   @id @default(cuid())
  funnelId    String
  name        String
  status      String   @default("running") // "running" | "paused" | "concluded"
  variantA    Json     // widget config snapshot
  variantB    Json     // widget config snapshot
  splitPct    Int      @default(50) // % traffic to variant A
  startedAt   DateTime @default(now())
  concludedAt DateTime?

  funnel  Funnel @relation(fields: [funnelId], references: [id], onDelete: Cascade)

  @@index([funnelId])
}
```

**Also update `AnalyticsDaily`:**
```prisma
// Add funnelId + stepId to scope analytics per funnel step
model AnalyticsDaily {
  // existing fields stay...
  funnelId    String?   // nullable for backward compat
  stepId      String?
  variantKey  String?   // "A" | "B" for A/B tracking
  
  @@index([shop, date, funnelId])
}
```

**Migration steps:**
1. `prisma migrate dev --name rename_offer_to_widget`
2. Write data migration: seed existing `Offer` rows into `Widget` + wrap each in a single-step `Funnel`
3. Keep old `Offer` table around for 1 sprint as backup, then drop

---

### 3b. Billing (`app/utils/billing.server.ts`)

Update plan definitions only — no structural change:

```ts
// REPLACE current plan config with:
export const PLANS = {
  FREE: {
    name: "Free",
    price: 0,
    monthlyOrderLimit: 100,
    funnelLimit: 1,
    abTesting: false,
    checkoutUpsell: true,   // ← WEDGE: free plan gets checkout upsell
  },
  GROWTH: {
    name: "Growth",
    price: 6.99,
    monthlyOrderLimit: 1000,
    funnelLimit: 5,
    abTesting: true,
    checkoutUpsell: true,
  },
  PRO: {
    name: "Pro",
    price: 19.99,
    monthlyOrderLimit: null, // unlimited
    funnelLimit: null,
    abTesting: true,
    checkoutUpsell: true,
  },
}
```

Remove all `checkoutUpsell` gates from extension loader routes.

---

### 3c. Routes (Rebuilt)

#### DELETE and REPLACE with new routes:

| Old Route | New Route | What Changes |
|---|---|---|
| `app.offers._index.tsx` | `app.funnels._index.tsx` | Funnel list with status, revenue, CVR per funnel |
| `app.offers.new.tsx` | `app.funnels.new.tsx` | Triggers onboarding wizard → canvas |
| `app.offers.$id.edit.tsx` | `app.funnels.$id.tsx` | Full funnel canvas builder |
| *(new)* | `app.funnels.$id.analytics.tsx` | Per-funnel analytics: CVR, revenue, A/B results |
| *(new)* | `app.widgets._index.tsx` | Widget library — browse/create reusable widgets |
| *(new)* | `app.onboarding.tsx` | First-run wizard (3 steps) |
| *(new)* | `app.analytics.tsx` | Store-level analytics dashboard |
| `app.additional.tsx` | *(delete)* | — |

#### Keep and modify:
- `app._index.tsx` → redirect to `/app/funnels` if setup complete, else `/app/onboarding`
- `api.offer-data.tsx` → rename to `api.funnel-data.tsx`, serve step config by funnel+placement+product

---

## 4. New Files to Create

### Components
```
app/components/
  FunnelCanvas/
    index.tsx              ← Main canvas wrapper (React DnD or dnd-kit)
    StepCard.tsx           ← Draggable step tile on canvas
    PlacementLane.tsx      ← Visual lane per placement (checkout, post-purchase, etc.)
    WidgetPicker.tsx       ← Modal: pick widget type to add to step
    StepConfigPanel.tsx    ← Right sidebar: config for selected step
  
  WidgetLibrary/
    index.tsx              ← Grid of available widget types
    WidgetTypeCard.tsx     ← Card showing widget type, icon, description
  
  FunnelCard.tsx           ← List item on funnels index (status badge, CVR, revenue)
  FunnelStats.tsx          ← Mini stats strip on funnel detail
  AbTestBadge.tsx          ← Shows A/B test status on funnel card
  MobilePreview.tsx        ← Live side-by-side preview panel (iframe + mock)
  OnboardingWizard.tsx     ← 3-step first-run guide
  AnalyticsDashboard.tsx   ← Store-level analytics (charts via Polaris or recharts)
  DateRangePicker.tsx      ← Reusable date range for analytics (currently missing)
  PlanGate.tsx             ← Wrapper: shows upgrade prompt if feature locked by plan
```

### Server Utilities
```
app/utils/
  funnel.server.ts         ← CRUD for Funnel + FunnelStep + Widget
  analytics.server.ts      ← Read/write AnalyticsDaily, aggregate by funnel/step/variant
  abtest.server.ts         ← A/B assignment logic (deterministic by customer ID hash)
  onboarding.server.ts     ← Track onboarding completion state per shop
```

### API Routes
```
app/routes/
  api.funnel-data.tsx      ← Serves step config to extensions (replaces api.offer-data.tsx)
  api.analytics-event.tsx  ← Receives impression/click/conversion events from extensions
  api.abtest-assign.tsx    ← Returns variant assignment for a customer+funnel combo
```

---

## 5. Widget Library — Types to Implement

This is the product heart. Build in this order (priority order):

### Sprint 2 (Core — must have for launch)
| Widget Type | Description |
|---|---|
| `product_upsell` | Single product recommendation with 1-click add |
| `cross_sell` | Complementary product suggestions |
| `discount_timer` | Countdown + auto-apply discount code |
| `order_bump` | Checkbox add-on at checkout step |

### Sprint 3 (Depth — Growth/Pro differentiation)
| Widget Type | Description |
|---|---|
| `bundle_offer` | Buy X + Y together for $Z |
| `review_request` | Post-purchase review prompt |
| `social_share` | Share order = get discount |
| `survey` | 1-question post-purchase survey |
| `free_shipping_bar` | Progress bar toward free shipping threshold |

### Sprint 4 (Power — Pro only)
| Widget Type | Description |
|---|---|
| `loyalty_points` | Show/award points (Smile.io compatible) |
| `reorder_upsell` | "Buy again" for repeat customers |
| `related_collection` | Collection-based recommendations |
| `birthday_capture` | Capture birthday for CRM |

Widget config stored as JSON in `Widget.config`. Each type has a typed config schema (TypeScript interface) defined in `app/types/widgets.ts`.

---

## 6. Sprint Breakdown

### Sprint 1 (Week 1–2): Foundation
**Goal:** Schema migrated, billing updated, brand name in, Shopify compliance fixed.

- [ ] Pick brand name → update `package.json`, `shopify.app.toml`, all extension `toml` files
- [ ] Prisma migration: add `Funnel`, `FunnelStep`, `Widget`, `AbTest` models
- [ ] Data migration: seed existing `Offer` rows → `Widget` + single-step `Funnel`
- [ ] Update `billing.server.ts` — new plan names + prices
- [ ] Remove checkout upsell plan gate (unlock for all plans)
- [ ] Add `shop/redact` webhook handler (Shopify compliance)
- [ ] Delete dead files: `app.additional.tsx`, `app.offers.new.tsx`, `app.offers.$id.edit.tsx`
- [ ] Stub new routes (empty shells): `app.funnels._index.tsx`, `app.funnels.new.tsx`, `app.funnels.$id.tsx`
- [ ] Create `funnel.server.ts` with basic CRUD

**Deliverable:** App loads, installs, billing works, no compliance failures.

---

### Sprint 2 (Week 3–4): Core Funnel Builder
**Goal:** Merchants can create a funnel with 1–2 steps and activate it.

- [ ] `OnboardingWizard.tsx` — 3-step: connect store → create first funnel → go live
- [ ] `app.onboarding.tsx` route — show wizard on first install
- [ ] `FunnelCanvas/index.tsx` — basic drag-drop canvas with placement lanes
- [ ] `StepCard.tsx` + `WidgetPicker.tsx` — add steps to funnel
- [ ] `StepConfigPanel.tsx` — config sidebar for `product_upsell` + `discount_timer` widgets
- [ ] `app.funnels._index.tsx` — list funnels with status, basic stats
- [ ] `app.funnels.$id.tsx` — render canvas for existing funnel
- [ ] `api.funnel-data.tsx` — serve step config to extensions
- [ ] Update all 5 extensions to call `api.funnel-data` instead of `api.offer-data`
- [ ] `MobilePreview.tsx` — side-by-side preview panel in canvas

**Deliverable:** Merchant can create funnel, preview it, activate it, see it render in checkout.

---

### Sprint 3 (Week 5–6): Analytics + Thank-You Fix + More Widgets
**Goal:** Revenue tracking is real. Thank-you page is 1-click. 5+ widget types live.

- [ ] Fix thank-you page: replace redirect with App Bridge 1-click `addToCart` action
- [ ] `api.analytics-event.tsx` — receive events from extensions (impression, click, conversion)
- [ ] `analytics.server.ts` — aggregate events into `AnalyticsDaily`
- [ ] `AnalyticsDashboard.tsx` — store-level: total revenue, CVR, top funnels
- [ ] `DateRangePicker.tsx` — date range filter (missing entirely right now)
- [ ] `app.funnels.$id.analytics.tsx` — per-funnel analytics page
- [ ] Add widgets: `cross_sell`, `order_bump`, `bundle_offer`, `review_request`, `free_shipping_bar`
- [ ] Fix `app.offers.$id.edit.tsx` → replace with new canvas (product title resolution bug dies here)
- [ ] `PlanGate.tsx` — wrap plan-gated features with upgrade CTA

**Deliverable:** Revenue numbers are trustworthy. Merchants can see per-funnel CVR + revenue.

---

### Sprint 4 (Week 7–8): A/B Testing
**Goal:** Growth/Pro merchants can run A/B tests on funnels.

- [ ] `abtest.server.ts` — deterministic variant assignment by customer ID hash (no cookies)
- [ ] `api.abtest-assign.tsx` — returns "A" or "B" for a customer+funnel
- [ ] Update extensions to check variant assignment before rendering
- [ ] `AbTestBadge.tsx` + A/B test creation UI in funnel canvas
- [ ] A/B results view in `app.funnels.$id.analytics.tsx`
- [ ] `AbTest` model integration — track variant impressions/conversions in `AnalyticsDaily`
- [ ] Statistical significance indicator (simple: 95% confidence threshold)

**Deliverable:** Merchants can split-test two funnel variants and see a winner declared.

---

### Sprint 5 (Week 9–10): Widget Library + Pro Widgets
**Goal:** Full widget library. Pro-tier widgets. Reusable widget system.

- [ ] `app.widgets._index.tsx` — browse all widget types, create reusable widgets
- [ ] `WidgetLibrary/index.tsx` + `WidgetTypeCard.tsx`
- [ ] Add Pro widgets: `loyalty_points`, `reorder_upsell`, `related_collection`, `birthday_capture`
- [ ] Widget templates — pre-built configs for common use cases (e.g. "Black Friday bundle")
- [ ] Funnel templates — 3–4 pre-built funnels by category (first purchase, repeat buyer, high AOV)
- [ ] Revenue attribution: cross-check order webhook data against `AnalyticsDaily` to prevent over-count

**Deliverable:** Full widget library live. Pro plan has clear differentiation.

---

### Sprint 6 (Week 11–12): Polish + App Store Readiness
**Goal:** Pass Shopify review. Ship publicly.

- [ ] Fix all remaining Shopify compliance issues (ref: previous violation #103713)
- [ ] GDPR webhooks: ensure `shop/redact`, `customers/redact`, `customers/data_request` all handled
- [ ] App listing copy + screenshots
- [ ] Onboarding polish — ensure < 5 min time-to-first-funnel
- [ ] Error states + empty states on all pages
- [ ] Loading skeletons everywhere (Polaris `SkeletonPage`)
- [ ] Billing edge cases: trial expiry, plan downgrade with active funnels > new limit
- [ ] Performance: lazy-load canvas components, paginate funnel list
- [ ] Accessibility audit (Polaris is mostly covered, check custom components)
- [ ] Final QA on all 5 placements across Free/Growth/Pro plans

**Deliverable:** App submitted to Shopify App Store.

---

## 7. Unique Differentiators (The "Our Touch")

These are the things ReConvert, Zipify, and AfterSell do NOT have. Build these as marketing pillars.

### 1. Visual Funnel Canvas
Every competitor uses a linear multi-step form. We ship a spatial canvas where merchants drag widgets into placement lanes and see the full funnel topology at a glance. This is the product screenshot that goes on the listing.

### 2. Flat Pricing, Zero Rev Share
Zero % of revenue. Merchants who drive $50K/month through our app pay $19.99/month — not $375/month (ReConvert's 0.75% would cost that). This is the pricing page headline.

### 3. Checkout Upsell on Free Plan
Every app locks checkout upsell behind the highest tier. We ship it on day one for free. This drives installation. Merchants try it, see it work, then upgrade for more funnels + A/B testing.

### 4. Mobile-First Live Preview
The funnel canvas has a live side-by-side mobile/desktop preview. Merchants see exactly what customers see as they configure. Nobody else has this.

### 5. Deterministic A/B Testing (No Cookies)
A/B variant assignment by hashed customer ID — works on Shopify's cookieless checkout, consistent across sessions, GDPR-clean. Competitors use cookie-based splitting which breaks on iOS Safari.

### 6. Funnel Templates by Category
Pre-built funnels for: "First Purchase Recovery", "Repeat Buyer AOV Boost", "High Cart Value Bundle", "Post-Holiday Reorder". Merchants activate in 1 click. Reduces time-to-value from hours to minutes.

---

## 8. Priority Order for V1 Shippable

If you need to cut scope to ship faster, build in this exact order. Stop after any step if time runs out — each step is independently shippable.

**Step 1 (Minimum Viable App — 4 weeks):**
- Schema migrated ✓
- Billing updated ✓  
- Funnel canvas with `product_upsell` widget ✓
- Checkout upsell on all plans ✓
- Basic analytics (impressions + revenue) ✓
- Onboarding wizard ✓

**Step 2 (Competitive — 4 more weeks):**
- 5+ widget types ✓
- Thank-you page 1-click fixed ✓
- Per-funnel analytics with date range ✓
- Funnel templates ✓

**Step 3 (Moat — 4 more weeks):**
- A/B testing ✓
- Full widget library ✓
- Pro widgets ✓
- App Store submission ✓

---

## 9. Known Technical Debt (Don't Ignore These)

| Issue | Where | Fix |
|---|---|---|
| Product title not resolved on offer edit load | `app.offers.$id.edit.tsx` | Dies in Sprint 2 when route is replaced |
| `conditions` field exists but nothing enforces it | `prisma/schema.prisma` | Remove in Sprint 1 migration |
| Revenue can be over-counted (self-reported) | `api.analytics-event.tsx` | Cross-check against order webhook in Sprint 5 |
| Thank-you page uses redirect, not 1-click | `thank-you-page` extension | Fix in Sprint 3 |
| Analytics has no date range filter | `app.analytics.tsx` | Add `DateRangePicker` in Sprint 3 |
| No shop/redact webhook | `app/webhooks/` | Add in Sprint 1 (compliance blocker) |
| No onboarding flow | — | Build in Sprint 2 |
| `app.additional.tsx` is dead | `app/routes/` | Delete in Sprint 1 |

---

## 10. File Tree After Rework (Target State)

```
beta-upsell/  (rename to [brand-name]/)
├── app/
│   ├── routes/
│   │   ├── app._index.tsx                  (modified: redirect logic)
│   │   ├── app.funnels._index.tsx          (new)
│   │   ├── app.funnels.new.tsx             (new)
│   │   ├── app.funnels.$id.tsx             (new: canvas builder)
│   │   ├── app.funnels.$id.analytics.tsx   (new)
│   │   ├── app.widgets._index.tsx          (new)
│   │   ├── app.onboarding.tsx              (new)
│   │   ├── app.analytics.tsx               (modified: date range + real data)
│   │   ├── app.settings.tsx                (keep)
│   │   ├── api.funnel-data.tsx             (replaces api.offer-data.tsx)
│   │   ├── api.analytics-event.tsx         (new)
│   │   ├── api.abtest-assign.tsx           (new)
│   │   ├── api.webhooks.tsx                (modified: add shop/redact)
│   │   └── api.validate-session.tsx        (keep)
│   ├── components/
│   │   ├── FunnelCanvas/                   (new)
│   │   ├── WidgetLibrary/                  (new)
│   │   ├── FunnelCard.tsx                  (new)
│   │   ├── FunnelStats.tsx                 (new)
│   │   ├── AbTestBadge.tsx                 (new)
│   │   ├── MobilePreview.tsx               (new)
│   │   ├── OnboardingWizard.tsx            (new)
│   │   ├── AnalyticsDashboard.tsx          (new)
│   │   ├── DateRangePicker.tsx             (new)
│   │   └── PlanGate.tsx                    (new)
│   ├── utils/
│   │   ├── billing.server.ts               (modified: new plans)
│   │   ├── funnel.server.ts                (new)
│   │   ├── analytics.server.ts             (new)
│   │   ├── abtest.server.ts                (new)
│   │   ├── onboarding.server.ts            (new)
│   │   ├── discount.server.ts              (keep)
│   │   ├── metafields.server.ts            (keep)
│   │   └── shopify.server.ts               (keep)
│   └── types/
│       └── widgets.ts                      (new: typed configs per widget type)
├── extensions/
│   ├── checkout-upsell/                    (keep, remove plan gate)
│   ├── post-purchase/                      (keep)
│   ├── thank-you-page/                     (keep, fix redirect → 1-click)
│   ├── order-status-page/                  (keep)
│   └── product-page-widget/                (keep)
├── prisma/
│   ├── schema.prisma                       (modified)
│   └── migrations/                         (new migration for Sprint 1)
└── shopify.app.toml                        (modified: brand name)
```

---

*Last updated: June 9, 2026*  
*Based on: full codebase audit of `/home/user/beta-upsell/` + ReConvert competitive research*
