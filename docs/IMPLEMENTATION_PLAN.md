# Beta-Upsell — All-in-One Implementation Plan

**Audience:** Product, engineering, and App Review prep  
**Perspective:** Shopify store owner (“merchant”) first — trust, predictable bills, offers that work on the storefront, admin that doesn’t waste time  
**Last updated:** 2026-06-02  

This plan ties together **billing**, **plans & pricing**, **offers (multi-product)**, **discount/data integrity**, **admin UI/IA**, and **launch hardening**. Work in phases; do not start App Store marketing until **Phase 0–2** are done.

---

## 1. Merchant north star

A merchant should be able to say:

1. “I know what I pay every month — no surprise fees.”
2. “I created an offer in under 3 minutes and saw it on my store.”
3. “When my customer accepts the upsell, the **price they pay matches** what we showed.”
4. “If I change a product or discount, the storefront updates — nothing stale.”
5. “If I downgrade or uninstall, I’m not charged for Pro features and my data is gone.”

Everything below serves those five statements.

---

## 2. Current state (honest snapshot)

| Area | What works today | What merchants will hate |
|------|------------------|---------------------------|
| **Billing** | Shopify Billing API: single **Pro Plan** $29/mo; Free = no subscription | `Store.plan` in DB **not synced** with Shopify subscription; downgrade to Free **does not** disable Pro offers; `calculateRemainingTrialDays` **always returns 0**; no trial on Pro in config |
| **Plans UI** | `/app/pricing` Free vs Pro cards | Pro lists “Advanced AI” but AI is basic; Free allows cart **only** in copy but code limits **1 active offer** only — not “cart only” |
| **Offers** | Multi-select upsell via Resource Picker; triggers: products / collections / all | List shows only “Post-Purchase” vs “Cart Drawer” — **wrong labels** for checkout/thank-you/FBT; **Edit** exists (`/app/offers/:id/edit`) but **not linked** from list; no **priority** UI; no duplicate offer |
| **Discounts** | Codes created on save (Week 3); checkout applies code; post-purchase uses changeset | **Cart** = display math only + code at checkout; **fixed $ off multiple lines** in post-purchase can be wrong; product delete/price change **does not** refresh codes |
| **Data** | Events + daily analytics; idempotency (Week 3) | Revenue numbers can **over-count** if extensions mis-fire; no link to **real Shopify order** revenue |
| **Admin UI** | Dashboard, Offers, Analytics, Pricing, Settings, Support | No **Privacy** in nav (route may exist); no onboarding checklist after first offer; no “health” banner (theme embed, proxy, scopes) |
| **Storefront** | 5 placements | Theme blocks need Dawn testing; inventory not checked before post-purchase |

---

## 3. Target plans & pricing (merchant-facing)

Align **Shopify Billing**, **in-app copy**, and **enforcement** to one matrix.

### 3.1 Recommended plan matrix (V1.1)

| | **Free** | **Pro** ($29/mo flat) |
|---|----------|------------------------|
| **Price** | $0 | $29 USD / 30 days, **no % of upsell revenue** |
| **Active offers** | 1 | Unlimited |
| **Placements** | Cart + Product page (FBT) | All: cart, FBT, post-purchase, checkout, thank-you |
| **Analytics** | Last 7 days, totals | 90 days, by placement + top offers |
| **Discount codes** | Yes (auto-created) | Yes |
| **Support** | Email / docs | Priority (define SLA in Support page) |
| **Trial** | — | **14-day trial** (recommended for conversion) |

**Positioning line (listing):** *“Flat price. Full funnel. We don’t tax your upsell revenue.”*

### 3.2 Pricing implementation tasks

| ID | Task | Files / notes |
|----|------|----------------|
| P-1 | Add **14-day trial** to `Pro Plan` in `shopify.server.ts` billing config | `trialDays: 14` on plan or `billing.request({ trialDays: 14 })` |
| P-2 | Implement `calculateRemainingTrialDays` for upgrades/downgrades | `app/utils/billing.ts` |
| P-3 | Single source of truth: `getMerchantPlan(session, billing)` → `'free' \| 'pro'` | New `app/utils/merchant-plan.server.ts` |
| P-4 | Persist plan on `Store.plan` on every billing webhook / after `billing.check` in app loader | `app/routes/app.tsx` loader + `APP_SUBSCRIPTIONS_UPDATE` webhook |
| P-5 | Update **Pricing page** copy to match matrix (remove false “Advanced AI” or ship basic AI honestly) | `app/routes/app.pricing.tsx` |
| P-6 | App Store listing pricing section = same matrix | External |

---

## 4. Phase 0 — Billing logic (fix before anything else)

Merchants churn when **paid features work after cancel** or **free limits are unclear**.

### 4.1 Bugs & risks today

1. **Enforcement uses live `billing.check` in some routes, DB `Store.plan` never updated** — inconsistent if webhook delayed.  
2. **Downgrade to Free** (`app.pricing.tsx` cancels subscription) but **does not**:  
   - deactivate offers with `type` in `post_purchase`, `checkout`, `thank_you`  
   - cap active offers at 1 (which one stays?)  
3. **Free limit** counts `store.offers.length` on create in one path vs **active** offers in UI — merchant can be confused by drafts.  
4. **`billingIsTest`**: must be `false` when `NODE_ENV=production` (already in `billing-env.server.ts`) — verify Railway.  
5. **No subscription update webhook** — plan changes outside app (Partner Dashboard) not reflected.

### 4.2 Billing implementation tasks

| ID | Task | Acceptance criteria |
|----|------|---------------------|
| B-1 | **`getMerchantPlan()`** wraps `billing.check({ plans: ['Pro Plan'] })` + maps to `free`/`pro` | All routes use this, not ad-hoc checks |
| B-2 | **`requirePlan(feature)`** helper: throws 403 or returns banner payload | e.g. `post_purchase` requires `pro` |
| B-3 | **On downgrade/cancel**: auto-deactivate Pro-only offers; if active count > 1, deactivate lowest priority / newest until 1 | Merchant sees email or in-app banner listing what was turned off |
| B-4 | **On upgrade**: re-enable previously deactivated-by-downgrade offers (optional flag `deactivatedByPlan`) | No silent re-enable without merchant consent (toggle in banner) |
| B-5 | Webhook **`app_subscriptions/update`** (or Shopify equivalent) → update `Store.plan`, `subscriptionId`, `currentPeriodEnd` | New fields on `Store` |
| B-6 | **Dashboard billing card**: current plan, renewal date, “Manage plan” → Pricing | `app._index.tsx` |
| B-7 | **Tests**: free limit, pro unlimited, downgrade deactivates checkout offer | `app/utils/merchant-plan.test.ts` |

### 4.3 Schema additions (`Store`)

```prisma
plan              String   @default("free")  // free | pro
shopifySubscriptionId String?
billingStatus     String?  // active | cancelled | frozen
trialEndsAt         DateTime?
```

---

## 5. Phase 1 — Discount & price integrity (merchant trust)

**Worst merchant experience:** “Your app showed 20% off but they paid full price.”

### 5.1 Rules by placement

| Placement | How discount must work | Merchant sees |
|-----------|------------------------|---------------|
| **Post-purchase** | Changeset per variant; **%** applies per line; **fixed** = split or per-line rules documented | Preview: “Customer pays ~$X” |
| **Checkout** | `useApplyDiscountCodeChange` + line item; verify code applies | Warning if code rejected |
| **Thank-you** | Link to `/discount/{code}` | Copy: “Code applied on product page” |
| **Cart / FBT** | Show **compare-at** only if code exists; “Use CODE at checkout” | No fake strikethrough without code |
| **All** | On product delete / variant change → **resync or disable offer** | Banner: “Offer X needs attention” |

### 5.2 Data integrity tasks

| ID | Task | Files |
|----|------|--------|
| D-1 | Add `Offer.discountCode` + `Offer.shopifyDiscountId` to schema (if missing) | `prisma/schema.prisma` |
| D-2 | **`syncOfferDiscountCode`** on create/update/delete; **update** Shopify discount when %/$  changes (not only create) | `app/utils/discount-codes.server.ts` |
| D-3 | **Product webhooks** `products/update`, `products/delete` → mark offers stale or re-sync | New routes or single `webhooks.products.tsx` |
| D-4 | **Pre-flight check** before save: variants exist, published, inventory > 0 (configurable) | `app/offers.new.tsx`, edit |
| D-5 | **Post-purchase**: if `fixed_amount` and multiple upsell products → apply fixed to **order total** or **first item only** — document in UI | `extensions/post-purchase/src/index.tsx` |
| D-6 | **Analytics**: store `upsellRevenue` from **Shopify line price** when possible (order webhook) | `orders/paid` or `orders/updated` |
| D-7 | Admin **“Sync all discount codes”** — keep; show last sync time + errors | `app.offers._index.tsx` |
| D-8 | **Offer health** field: `status: ok \| needs_sync \| broken` | Computed in loader |

### 5.3 Merchant-visible “Offer health”

On Offers list, show badges:

- Green: Active, code valid, products OK  
- Yellow: Needs sync (product changed)  
- Red: Broken (product deleted, code missing)

---

## 6. Phase 2 — Offers product (multi-product & details merchants expect)

You already allow **multiple upsell products** in admin (`resourcePicker` multiple). Gaps are **storefront behavior** and **admin clarity**.

### 6.1 Multi-product behavior (define & implement)

| Placement | Current | Target merchant behavior |
|-----------|---------|---------------------------|
| Post-purchase | All upsell products in one page, one Accept | Merchant chooses: **bundle accept** OR **pick one** (setting) |
| Checkout | One product per row, add individually | Max **3** shown; hide already in cart |
| Cart / FBT | Loop handles in theme | Show **up to N** products (setting, default 3) |
| Thank-you | List all | Same + clear code per offer |
| API | Returns all `upsellProducts` | Respect `maxUpsellProducts` on offer |

### 6.2 Offer model enhancements

```prisma
maxUpsellProducts   Int      @default(3)
postPurchaseMode    String   @default("all") // all | single_choice
priority            Int      @default(0)    // already exists — use in matching
deactivatedByPlan   Boolean  @default(false)
discountCode        String?
shopifyDiscountGid  String?
```

### 6.3 Admin offers UX tasks

| ID | Task | Merchant benefit |
|----|------|------------------|
| O-1 | **Offers table**: correct placement labels (cart, FBT, checkout, thank-you, post-purchase) | `app/utils/offers-display.ts` |
| O-2 | **Edit** + **Duplicate** + **Pause** actions on each row | Less recreate pain |
| O-3 | **Upsell products** section: list with thumbnails (GraphQL on edit load) | See what they selected |
| O-4 | **Max upsell products** (1–5) with help text per placement | Control clutter |
| O-5 | **Priority** field + “When multiple offers match, higher priority wins” | Power users |
| O-6 | **Preview panel**: “Customer will see…” mock per placement | Confidence |
| O-7 | **Validation**: at least 1 upsell; trigger rules consistent with placement | Fewer broken offers |
| O-8 | On save: always `syncThemeOffersMetafield` + discount sync for theme placements | No manual sync |
| O-9 | **Collection triggers** on product page: document “evaluated on cart in theme” vs PDP context | Reduce support tickets |

### 6.4 Small details merchants hate (checklist)

- [ ] Saving offer returns to list with **success toast**  
- [ ] Deleting offer removes discount in Shopify (deactivate `discountCodeBasicDelete`)  
- [ ] Changing placement from cart → checkout **re-syncs** and creates code if missing  
- [ ] **Inactive** offers never shown on storefront  
- [ ] Free plan: creating 2nd offer shows **upgrade modal**, not cryptic 403  
- [ ] Resource picker selections **persist** on edit  
- [ ] Percentage > 100 blocked (already)  
- [ ] **Empty state** links to theme editor for app embed blocks  

---

## 7. Phase 3 — Admin UI & information architecture

### 7.1 Recommended navigation

| Nav item | Purpose |
|----------|---------|
| **Home** | KPIs, plan status, setup checklist, health alerts |
| **Offers** | List, create, edit, sync codes |
| **Analytics** | Revenue, conversion, by placement (Pro: longer range) |
| **Pricing** | Plans, upgrade, trial |
| **Settings** | Widget colors/copy (theme) |
| **Support** | FAQ, contact, links to docs |
| **Privacy** | Policy URL for App Store (add to nav) |

Remove or merge `app.additional.tsx` if unused.

### 7.2 Page-by-page spec (merchant-first)

#### Home (`/app`)

- **Top**: Plan badge + renewal / trial days left  
- **KPIs**: Upsell revenue (30d), conversion, active offers  
- **Setup checklist** (until complete):  
  1. Create offer  
  2. Enable theme app embed (deep link)  
  3. Approve scopes (`write_discounts`)  
  4. Test on storefront (link to dev doc)  
- **Alerts**: offers needing sync, billing issue, extension not deployed  

#### Offers (`/app/offers`)

- Index table per §6.3  
- Secondary: **Sync discount codes**  
- Primary: **Create offer**  
- Filters: placement, status, health  

#### Create / Edit offer (`/app/offers/new`, `/app/offers/:id/edit`)

- **Step feel** (single page OK): Details → Trigger → Upsells → Discount → Review  
- **Review card**: placement, trigger summary, product list, discount, estimated customer price  
- **Save** disabled until valid  

#### Analytics (`/app/analytics`)

- Empty state: “Create an offer to see data”  
- Pro gate: 90d vs 7d (enforce in loader)  
- Table: offer name, impressions, accepts, revenue, conversion  

#### Pricing (`/app/pricing`)

- Match §3.1 exactly  
- FAQ accordion: “Will my bill increase if upsells grow?” → **No.**  

#### Settings (`/app/settings`)

- Widget title, colors, button labels  
- **Preview** thumbnail of cart widget  
- Note: “Checkout/post-purchase use extension UI”  

#### Support (`/app/support`)

- Install checklist, troubleshooting, contact email  
- “Checkout not showing?” → Plus / extensibility note  

### 7.3 UI implementation tasks

| ID | Task |
|----|------|
| U-1 | Add **Privacy** to `app.tsx` NavMenu → `app.privacy.tsx` |
| U-2 | Home: plan card + setup checklist component |
| U-3 | Offers list: use `offers-display.ts` for all columns + actions |
| U-4 | Polaris **Toast** on save/delete/sync |
| U-5 | Consistent **Page** titles and back actions |
| U-6 | Mobile-friendly tables (Polaris `IndexTable` scroll) |
| U-7 | Remove template marketing copy on public index if still default |

---

## 8. Phase 4 — Storefront reliability

| ID | Task |
|----|------|
| S-1 | Theme test matrix: **Dawn**, Refresh, Sense — cart + FBT blocks |
| S-2 | Post-purchase: **inventory** check in `ShouldRender` |
| S-3 | Cart liquid: filter `offer.type`; session dedupe for `shown` |
| S-4 | Document **Shopify Plus** requirement for checkout extension |
| S-5 | `shouldRender` & API routes < 500ms (cache offer config in Redis optional) |

---

## 9. Phase 5 — Compliance & launch (App Store)

| ID | Task |
|----|------|
| L-1 | GDPR `customers/data_request`: export JSON of `OfferEvent` for customer |
| L-2 | Uninstall: `deleteAllShopAppData` (verify on prod) |
| L-3 | Listing: 5 screenshots, setup video, test store steps for reviewer |
| L-4 | 10–30 beta merchants + review velocity |

---

## 10. Suggested execution order (sprints)

### Sprint A — Trust & money (1–2 weeks)

1. Phase 0: B-1–B-7, P-1–P-4  
2. Phase 1: D-1–D-4, D-7–D-8  

**Exit:** Downgrade works; discounts sync on save; plan shown on dashboard.

### Sprint B — Offers merchants love (1–2 weeks)

1. Phase 2: O-1–O-9  
2. Phase 1: D-5–D-6  
3. Phase 3: U-1–U-4  

**Exit:** Edit from list; correct labels; offer health; multi-product limits.

### Sprint C — Polish & launch (1 week)

1. Phase 3: U-5–U-7  
2. Phase 4: S-1–S-5  
3. Phase 5: L-1–L-4  
4. P-5–P-6  

**Exit:** App Review resubmit.

---

## 11. Success metrics (merchant outcomes)

| Metric | Target |
|--------|--------|
| Install → first active offer | < 10 min median |
| Offer save → visible on storefront | < 5 min (with theme embed) |
| Billing support tickets | < 5% of installs |
| “Wrong price” tickets | 0 after Phase 1 |
| App Review approval | Pass on resubmit |
| Free → Pro conversion | Track; aim 8–15% in 60 days |

---

## 12. Out of scope (V2+)

Do **not** block V1 launch for:

- A/B testing, visual funnel builder  
- Revenue-share pricing  
- Full ML recommendations  
- Multi-language / Markets  
- SMS/WhatsApp upsell  

---

## 13. File map (quick reference)

| Concern | Primary files |
|---------|----------------|
| Billing config | `app/shopify.server.ts`, `app/routes/app.pricing.tsx` |
| Plan enforcement | `app/routes/app.offers.new.tsx`, `app.offers.$id.edit.tsx` |
| Discounts | `app/utils/discount-codes.server.ts`, `app/routes/api.offers.ts` |
| Metafields | `app/utils/metafields.server.ts` |
| Extensions | `extensions/*` |
| Analytics | `app/routes/api.events.ts`, `app/routes/app.analytics.tsx` |
| Store data | `app/utils/shop-data.server.ts`, `app/routes/webhooks.*` |

---

## 14. Decision log (record when implementing)

| Decision | Options | Recommendation |
|----------|---------|----------------|
| Free placements | Cart only vs cart+FBT | **Cart + FBT** (more value, still gated Pro for 1-click) |
| Pro trial | 0 vs 14 days | **14 days** |
| Fixed discount + multiple PP products | Per line vs once per order | **Per line %**; **fixed applies once** on bundle total — show in UI |
| Downgrade excess offers | Auto-pause vs force pick | **Auto-pause newest** + notify |

---

*This document is the single roadmap for billing, pricing, offers, data integrity, and admin UX. Update it when phases complete.*
