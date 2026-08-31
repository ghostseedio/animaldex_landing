# AnimalDex web billing: Paddle live

Status: live implementation is ready in code. Checkout stays fail-closed until live Paddle account approval, `animaldex.app` checkout-domain approval, live catalog, live env, and production billing/import migrations are in place. Do not enable `NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE` until controlled live Credit and Pro purchases pass.

Sandbox credentials must never be substituted into production.

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

```dotenv
PADDLE_ENVIRONMENT=production
PADDLE_API_KEY=pdl_live_apikey_...
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_...
PADDLE_WEBHOOK_SECRET=pdl_ntfset_...
PADDLE_PRICE_CREDITS_25=pri_...
PADDLE_PRICE_CREDITS_100=pri_...
PADDLE_PRICE_PRO_MONTHLY=pri_...
```

`PADDLE_API_KEY` and `PADDLE_WEBHOOK_SECRET` are server-only. Only the limited client-side token is exposed.

Runtime guards:

- `animaldex.app` / Vercel production require `PADDLE_ENVIRONMENT=production`
- live API key must start `pdl_live_`
- live client token must start `live_`
- sandbox keys/tokens are rejected on the production host
- missing or mismatched config returns 503 and does not open checkout

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
   - `transaction.completed`
   - `subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.trialing`
   - `subscription.past_due`, `subscription.paused`, `subscription.resumed`, `subscription.canceled`
   - `adjustment.created`, `adjustment.updated`
8. Store that destination's secret in production `PADDLE_WEBHOOK_SECRET`.

## Webhook mapping

| Paddle event | AnimalDex action |
| --- | --- |
| `transaction.completed` | Resolve registered purchase; validate one item, quantity, Price ID, purchase/user binding; fulfill once |
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

1. One controlled 25-Credit real purchase.
2. Confirm checkout, payment, signed webhook, one ledger grant of +25, fulfilled-only return, same import resume if started from import.
3. Replay the notification; expect no second grant.
4. One controlled Pro purchase; confirm Paddle source, `profiles.is_pro`, Instagram quote 0, management URL.
5. Mobile Safari / Android Chrome / desktop smoke.
6. Only then consider `NEXT_PUBLIC_INSTAGRAM_WEB_IMPORT_LIVE=true`.
