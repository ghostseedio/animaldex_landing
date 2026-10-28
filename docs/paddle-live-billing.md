# AnimalDex web billing: Paddle live

Status (2026-10-28): billing is **off** in production. `GET https://animaldex.app/api/webhooks/paddle` answers `PADDLE_ENVIRONMENT must be production.` and `/checkout` says web billing is not enabled. The code is ready; turning it on is the owner checklist below (Paddle dashboard + VM env). Do not enable `NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE` until controlled live Credit and Pro purchases pass.

Sandbox credentials must never be substituted into production.

## Go-live checklist (owner)

Nothing here happens in a deploy by itself. Do it in order; every value must come from the **live** Paddle dashboard (`vendors.paddle.com`), never `sandbox-vendors.paddle.com`.

**1. Paddle dashboard (live)**

1. Live account approved, and `animaldex.app` approved under Checkout → Website approval. If Paddle has not approved it, stop: **BLOCKED BY PADDLE APPROVAL**.
2. Checkout → Checkout settings → default payment link `https://animaldex.app/checkout`.
3. Catalog: the three live prices in [Catalog](#catalog). Copy each **Price ID** (`pri_…`), not the Product ID (`pro_…`).
4. Developer tools → Authentication: a live API key (`pdl_live_apikey_…`) and a live client-side token (`live_…`). If the key is scoped, it needs what the server calls: create transactions (`POST /transactions`, Wildlife Guide card checkout), list and create adjustments (`GET`/`POST /adjustments`, guide refunds) and customer portal sessions (`POST /customers/{id}/portal-sessions`, Manage subscription).
5. Developer tools → Notifications → new destination, URL `https://animaldex.app/api/webhooks/paddle`, with these events:
   - `transaction.completed`
   - `transaction.canceled` (Wildlife Guide card checkouts: marks the purchase failed)
   - `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.trialing`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`, `subscription.canceled`
   - `adjustment.created`, `adjustment.updated`

   `transaction.payment_failed` is optional (handled as a no-op). Copy the destination's secret key (`pdl_ntfset_…`).

**2. VM environment** — `/opt/animaldex/shared/app.env` (`KEY=value` lines, no quotes, `chmod 600`; `scripts/deploy-selfhost.sh` merges it over the running container's env):

```dotenv
PADDLE_ENVIRONMENT=production
PADDLE_API_KEY=pdl_live_apikey_...
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_...
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
PADDLE_PRICE_PRO_MONTHLY=pri_...
PADDLE_PRICE_CREDITS_25=pri_...
PADDLE_PRICE_CREDITS_100=pri_...
```

- All seven are read at runtime, so an env change needs only a redeploy, not a rebuild. On animaldex.app a `pdl_sdbx_` key or `test_` token is refused. A sandbox `pri_` ID looks the same as a live one and is **not** caught by the format check: it fails only when Paddle opens checkout, so copy Price IDs from the live dashboard.
- Each product is on sale on its own Price ID. Leaving a pack's Price ID empty takes only that pack off sale; Pro, the other pack, the webhook and Wildlife Guide card checkout keep working. A value that is not a `pri_` ID, or one Price ID used for two products, takes the whole catalog off sale.
- A product is on sale only when the webhook is configured too (API key + secret), so nothing is sold that could not be fulfilled.
- `NEXT_PUBLIC_SITE_URL` / `SITE_URL` stay `https://animaldex.app` (that is what makes the production guard refuse sandbox values). The Supabase service role key is already set for other features and is what the webhook writes with.
- Images built before the per-product availability change ("Web billing: each Paddle product is on sale on its own Price ID") sent Paddle.js the client token baked in at build time, which is empty unless the GitHub secret `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` was set. Deploy an image that contains that change.

Apply: on the VM run `scripts/deploy-selfhost.sh <sha>` (the same sha redeploys with the new env). Its output lists the keys it took from `app.env`; all seven `PADDLE_*` must be there.

**3. Database** — confirm (read-only) that the [production migrations](#production-migrations) are applied, and that `instagram_import_billing_rollout.enforcement_mode` is still `off`.

**4. Check it before any purchase**

1. `curl -s https://animaldex.app/api/webhooks/paddle` answers `{"ok":true,"service":"paddle-webhook","environment":"production"}`. Any `error` names the first missing or wrong value.
2. `https://animaldex.app/checkout` says "Use this page to complete an AnimalDex Credits or Pro purchase." and then "AnimalDex checkout is ready."
3. Signed in, `/app/credits` shows "Signed in as …", Pro first, and a buy button for every product that has a Price ID; any product without one reads "Not available right now".
4. Paddle → Notifications → the destination → send a simulated `transaction.completed`. It is **expected to be refused with 400** (`paddle_transaction_mismatch` or `paddle_line_item_mismatch`: a simulation belongs to no registered purchase) and is recorded as a failed event; nothing is granted. A 400 with one of those proves the signature verified; `invalid_webhook_signature` means the secret is wrong, a 503 means the env is incomplete.
5. The VM clock is NTP-synced (`timedatectl`: "System clock synchronized: yes"): signatures older than 5 seconds are refused.

**5. Controlled live proof** — then the purchases in [Controlled live proof](#controlled-live-proof).

**Turning it off again:** remove `PADDLE_ENVIRONMENT` from `app.env` and redeploy. Checkout and the webhook answer 503; Paddle keeps retrying undelivered notifications, so purchases already paid are fulfilled once it is back.

**Not billing, same release:** store-link attribution reads `NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN` (App Store Connect → App Analytics → Campaigns provider token) at **build** time: set it as a GitHub Actions variable, then rebuild. Until then App Store links carry `ct=` without `pt=`, which Apple does not attribute. Revenue reaches GA4 as `begin_checkout` and `purchase` only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set at build.

## Architecture

Instagram Import and Credits UI call the provider-neutral AnimalDex web commerce API. The API authenticates the AnimalDex user, validates one canonical product code, and registers a server-owned `web_purchase`. It returns that purchase's single server-approved Paddle Price ID to Paddle.js. A verified Paddle webhook resolves the registered purchase, validates its Price ID and durable identity, and atomically fulfills the canonical Credit ledger or Paddle subscription source. Browser completion is never fulfillment proof.

The provider boundary is:

`Import UI → /api/app/billing/* → web_purchase → Paddle.js → /api/webhooks/paddle → canonical AnimalDex ledger/Pro`

Paddle is a commerce source. `credit_balances`, `credit_transactions`, `subscriber_entitlements`, `user_has_animaldex_pro`, and `profiles.is_pro` remain AnimalDex authority.

iOS remains Apple IAP. Android remains Google Play Billing.

## Catalog

| AnimalDex code | Paddle live product | Billing | Environment mapping | Display fallback |
| --- | --- | --- | --- | --- |
| `purchase_25` | AnimalDex 25 Credits | one-time | `PADDLE_PRICE_CREDITS_25` | $2.99 USD |
| `purchase_100` | AnimalDex 100 Credits | one-time | `PADDLE_PRICE_CREDITS_100` | $7.99 USD |
| `pro_upgrade` | AnimalDex Pro | monthly | `PADDLE_PRICE_PRO_MONTHLY` | $9.99/month |

Do not add annual Pro, discounts, bundles, other pack sizes, or regional packs. Prices are dashboard catalog mappings; the client API accepts only the AnimalDex product code.

## Required environment

The seven variables in the [go-live checklist](#go-live-checklist-owner). `PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` are server-only. Only the limited client-side token is exposed, and the server reads it at runtime.

Runtime guards (`src/lib/paddle-server.ts`):

- `animaldex.app` / Vercel production require `PADDLE_ENVIRONMENT=production`
- live API key must start `pdl_live_`
- live client token must start `live_`
- sandbox keys/tokens are rejected on the production host
- per product (`assertPaddleProductCheckoutConfigured`): Paddle.js, API key and webhook secret configured, the catalog well formed, and that product's own Price ID set; otherwise its checkout returns 503 `product_unavailable` and the UI shows it unavailable (`paddleProductAvailability`)
- the catalog is well formed when every Price ID that is set starts `pri_` and no two products share one
- the webhook (`assertPaddleWebhookConfigured`) needs the environment, API key and secret, no Price ID; each Credits or Pro event's own Price ID must be one of the configured products (a subscription, Pro), or the event is refused (`paddle_unknown_price`) and Paddle retries it. Do not replace a Price ID while subscribers are on the old one: their events would be refused.
- Wildlife Guide card checkout and the `/checkout` payment-link page need no catalog Price ID

API host for production is `https://api.paddle.com`.

## Live Dashboard setup

1. Complete Paddle live account approval. If Paddle blocks the live account, stop: **BLOCKED BY PADDLE APPROVAL**.
2. Under Checkout → Website approval, approve `animaldex.app`. Do not use localhost or a Vercel preview URL as the live default payment link.
3. Set the default payment link to `https://animaldex.app/checkout`. That page initializes Paddle.js.
4. Under Catalog, create exactly three live products/prices:
   - AnimalDex 25 Credits: one-time $2.99 USD unless current approved business pricing differs.
   - AnimalDex 100 Credits: one-time $7.99 USD.
   - AnimalDex Pro: recurring monthly $9.99.
5. Copy each live `pri_...` value into its matching environment variable. Do not use a Product ID as a Price ID.
6. Under Developer tools → Authentication, create a live API key and a live client-side token.
7. Under Developer tools → Notifications, add `https://animaldex.app/api/webhooks/paddle`. Subscribe to:
   - `transaction.completed`, `transaction.canceled`
   - `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.trialing`
   - `subscription.past_due`, `subscription.paused`, `subscription.resumed`, `subscription.canceled`
   - `adjustment.created`, `adjustment.updated`
8. Store that destination's secret in production `PADDLE_WEBHOOK_SECRET`.

## Webhook mapping

| Paddle event | AnimalDex action |
| --- | --- |
| `transaction.completed` | Resolve registered purchase; validate one item, quantity, Price ID (a configured catalog price, and the one registered with the purchase), purchase/user binding; fulfill once. A Wildlife Guide transaction (`custom_data.kind = wildlife_guide`) is fulfilled as a guide purchase instead |
| `transaction.canceled` | Wildlife Guide card checkout only: the purchase is marked failed |
| `subscription.created` / `updated` | Sync the complete Paddle state if the event is not older than stored state |
| `subscription.activated` / `resumed` | `active` |
| `subscription.trialing` | `trialing` |
| `subscription.past_due` | `past_due`, with one seven-day grace window that repeated events cannot extend |
| `subscription.paused` | `paused`, no Paddle Pro |
| `subscription.canceled` | `canceled`, no Paddle Pro |
| `adjustment.created` / `updated` | Persist adjustment; reverse only approved, full Credit-pack refund/credit/chargeback adjustments |

Paddle Billing has no separate `subscription.ended` event. Entitlement ends when Paddle reports `canceled` or `paused`, or when a `past_due` grace window expires.

Signature verification uses the raw request body and `Paddle-Signature`. Missing, invalid, or tampered signatures are rejected. Notification/event IDs are persisted. Duplicate `event_id` values do not grant Credits, change Pro, or apply a second refund.

## Past-due / dunning policy

Current decision: temporary Pro grace during payment recovery. Do not revoke Pro on the first failed renewal. Do not keep grace indefinite.

Exact mapping:

- `active` / `trialing`: Paddle Pro source is active.
- First `past_due`: store `grace_period_end = occurred_at + 7 days`. Canonical Pro remains true while that timestamp is in the future.
- Later `past_due` events do not extend `grace_period_end`.
- If Paddle recovers to `active` or `resumed`: Pro continues; grace is cleared.
- `paused` or `canceled`: Paddle Pro source is removed immediately, even if a grace timestamp remains.
- If Paddle never sends a terminal event, AnimalDex still drops the Paddle source when the stored seven-day grace expires.

Apple or Google remaining active is not clobbered by a Paddle cancellation.

## Refund, dispute, and chargeback policy

Approved full `refund`, `credit`, and `chargeback` adjustments for a Credit pack reverse at most the user's currently unspent Credits and never take the balance below zero. The original grant and reversal stay in `credit_transactions`. Duplicate adjustments are no-ops. Spent/unrecoverable Credits are marked for business review.

Resolution uses stored Paddle transaction IDs (`web_purchases.provider_transaction_id` → adjustment → ledger grant). Optional `custom_data` is not the only lookup key.

Partial adjustments, Pro adjustments, chargeback warnings, and reversal actions are persisted as business-review cases and do not invent a proportional Credit conversion or debt.

## Customer management

An authenticated Paddle subscriber gets a new temporary Paddle customer-portal session. Apple subscribers are directed to App Store management; Google subscribers to Google Play. The website blocks another Pro checkout whenever canonical Pro is already active.

## Merchant of Record

Paddle checkout handles payment collection and its supported tax/compliance, invoice, and customer billing workflows as Merchant of Record. AnimalDex does not calculate sales tax at checkout and has no active Stripe Tax configuration.

AnimalDex remains responsible for product/catalog mapping, account binding, canonical Credits and Pro, webhook security, fulfillment/refund policy, user support, bookkeeping, and completing Paddle's live account/domain/business obligations.

## Production migrations

Required billing/import set, in order:

1. `20260830230000_import_stage_backpressure.sql`
2. `20260830240000_instagram_import_credit_quotes.sql`
3. `20260831140000_instagram_import_economic_concurrency.sql`
4. `20260831150000_paddle_web_commerce.sql`

Do not apply `20260831120000_guide_listing_public_place.sql` in this billing release.

Stripe SQL in `20260831130000_stripe_web_store_and_source_aware_pro.sql` is migration history only. It is not an active checkout path.

Keep `instagram_import_billing_rollout.enforcement_mode = off` during live Paddle configuration.

## Controlled live proof

After live approval, domain approval, catalog, env, webhook destination, and production migrations:

1. One controlled 25-Credit real purchase from `/app/credits`.
2. Confirm checkout, payment, signed webhook, one ledger grant of +25, the return page ("Payment received — your account is updating…") landing back on `/app/credits`, and the same import resume if started from import. GA4 DebugView shows `begin_checkout` and one `purchase` with the checkout's currency.
3. Replay the notification; expect no second grant.
4. One controlled Pro purchase; confirm Paddle source, `profiles.is_pro`, Instagram quote 0, management URL.
5. Mobile Safari / Android Chrome / desktop smoke.
6. Only then consider `NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE=true`.
