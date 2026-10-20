# Buying a Wildlife Guide on the website

Server side: migrations `20261020100000_wildlife_guide_purchases.sql` and `20261020160000_wildlife_guide_sell_first_pay_after_terms.sql` (AnimalDex repo). Guide prices are USD cents (`guide_listings.amount_minor`), so card checkout charges that amount in USD.

## Selling before the author terms (since 20261020160000)

- A public guide is **for sale whether or not its author accepted the Wildlife Guide Author Terms** (`forSale` = public, purchases on, sales not paused). The terms gate the **payout**: on day 8 the author's 70% goes to Earnings if they have accepted; otherwise it is held (`payout_held_at`) and released the moment they accept.
- **Every purchase needs the buyer's consent** to the Wildlife Guide Buyer Terms (`/legal/wildlife-guide-buyer-terms`). The guide JSON carries `buyerTermsVersion`; the page has a required checkbox and sends it back as `buyerTermsVersion`; both purchase RPCs refuse without the current version (`buyer_terms_required`). It is stored on `guide_purchases.buyer_terms_version` / `buyer_terms_accepted_at`.
- The author is told about each sale in the app, by push and by email, with their earnings and the 48-hour reply deadline, and reminded 12 hours before it. **No reply: the buyer is refunded automatically and the guide keeps its public page (and search traffic) but stops selling** (`sales_paused_at`) until the author presses Resume sales (`resume_my_wildlife_guide_sales`).
- The author's Shop lists their sales (`get_my_wildlife_guides().sales`, `.earnings`): awaiting reply (with hours left and the money at stake), pending payout, held for the terms, paid out, refunded.

## Flows

| Who | How | Route |
| --- | --- | --- |
| Signed in | Credits (`purchase_wildlife_guide_with_credits`, one idempotency key per page) | `POST /api/app/wildlife-guides/{id}/purchase` |
| Signed in or guest | Card (Paddle overlay) | `POST /api/wildlife-guides/{id}/checkout` |
| Buyer | Ask for a refund (`request_wildlife_guide_refund`) | `POST /api/app/wildlife-guides/{id}/refund` |
| Guest buyer | Email me a new sign-in link | `POST /api/wildlife-guides/{id}/access-link` |
| VM timer | Send queued card refunds to Paddle | `POST /api/cron/wildlife-guide-refunds` |
| VM timer | Send queued sales emails (Resend) | `POST /api/cron/wildlife-guide-emails` |
| Author | Resume sales after a missed reply | `POST /api/app/wildlife-guides/{id}/resume-sales` |

### Card checkout

1. The guide page posts the email (guests) or nothing (signed in; the account email and id are used) with a per-page idempotency key.
2. The route creates the purchase row with the service role (`create_wildlife_guide_web_purchase`), then one Paddle transaction for it (non-catalog price, USD, `custom_data = {kind: "wildlife_guide", purchase_id}`), and saves the `txn_…` id on the row so a retry reopens the same transaction.
3. The page opens the Paddle overlay for that transaction. On completion a signed-in buyer's page polls until the purchase shows as paid; a guest sees "Check your email to open your guide".
4. The Paddle webhook (`transaction.completed`, kind `wildlife_guide`) finds the buyer: the signed-in buyer id on the row, else the account with that email (`user_contact_identifiers` hash, confirmed against Auth), else a new account (`auth.admin.createUser`, email confirmed). It calls `mark_wildlife_guide_web_purchase_paid` (opens the buyer→author chat, tells the author; a duplicate purchase is refunded) and emails a guest a one-time sign-in link (Supabase `generateLink`, sent through Resend) to `/auth/confirm`, which signs them in and opens the guide.
5. `transaction.canceled` marks the purchase failed. `transaction.payment_failed` does not: it is a declined attempt inside a checkout that stays open, and the buyer can try another card on the same transaction.
6. `adjustment.created`/`adjustment.updated` with an approved refund or chargeback calls `mark_wildlife_guide_web_purchase_reversed` (a no-op for other transactions and for purchases already refunded).

**Paddle notifications:** besides the events in `paddle-live-billing.md`, subscribe the destination to `transaction.canceled`.

## Environment

| Variable | Used for |
| --- | --- |
| `PADDLE_ENVIRONMENT`, `PADDLE_API_KEY`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`, the three `PADDLE_PRICE_*` | Already required for web billing; card checkout uses the same configuration checks |
| `SUPABASE_SERVICE_ROLE_KEY` (and the Supabase URL/anon key) | Purchase rows, buyer accounts, sign-in links |
| `RESEND_API_KEY` | The guest's sign-in email |
| `SUPPORT_FROM_EMAIL` (optional, default `support@animaldex.app`) | Sender address, shown as "AnimalDex" |
| `CANONICAL_URL` / `NEXT_PUBLIC_SITE_URL` | Absolute sign-in link |
| `CRON_SECRET` | `Authorization: Bearer …` for `/api/cron/wildlife-guide-refunds` (the same secret the identity-review timer uses) |

Supabase Auth: the sign-in link lands on `https://animaldex.app/auth/confirm`; it is built from the hashed token, so no redirect-URL allowlist change is needed. Links expire with the project's email OTP expiry (default one hour); the guide page offers "Email me a new link".

## Emails

The database queues every sales email in `wildlife_guide_email_outbox` (kind + a payload captured at the time); `POST /api/cron/wildlife-guide-emails` claims up to 25 (`claim_wildlife_guide_emails`), renders them (`src/lib/wildlife-guide-emails.ts`), sends through Resend from `SUPPORT_FROM_EMAIL` with reply-to the same address, and finishes each as sent, skipped (`no_address`, unknown kind) or failed (retried with backoff, 8 attempts).

| Kind | To | When |
| --- | --- | --- |
| `seller_sale` | Author | Every paid purchase: buyer, earnings, reply deadline, "accept the terms to be paid" if not accepted |
| `seller_reply_reminder` | Author | 12 hours before the deadline, if no reply |
| `seller_no_reply_refund` | Author | The buyer was refunded; sales paused, guide still public |
| `seller_payout_released` | Author | The share reached Earnings |
| `seller_payout_held` | Author | Day 8 with the author terms not accepted |
| `buyer_purchase` | Buyer | Receipt for Credits and signed-in card purchases (a guest's sign-in email is their receipt) |
| `buyer_refund` | Buyer | Any refund, with why and where the money goes |
| `buyer_refund_review` / `buyer_refund_declined` | Buyer | A second refund in 90 days went to review / was declined (with the operator's reason) |

Pushes for the same events come from the `dispatch-wildlife-guide-push` edge function (trigger on `user_notifications` with `source_key LIKE 'wildlife-guide-%'`); the author's open their Shop.

## Card refunds

Refunds are decided in the database (no reply within 48 hours, a buyer's request within 7 days, a duplicate purchase). Credits refunds are immediate; a card refund is queued (`status = refunded`, `refund_status = processing`) until the website sends it to Paddle. `POST /api/cron/wildlife-guide-refunds`:

- reads `wildlife_guide_web_refunds_due(limit)` (default 20, `?limit=` up to 100);
- for each, reuses a refund adjustment Paddle already has for the transaction, or creates a full refund (`POST /adjustments`, `action: refund`, `type: full`);
- marks it sent (`mark_wildlife_guide_web_refund_sent`), and returns `{due, sent, failed, results}`. Failures stay queued for the next run.

### Schedule it on the VM (not installed)

One timer runs the card refunds and the emails every 10 minutes. On the VM, from the repo checkout:

```bash
bash scripts/install-wildlife-guide-timer.sh
```

It adds `CRON_SECRET` to `/opt/animaldex/shared/app.env` if missing (live in the container after the next `deploy-selfhost.sh`), writes `/usr/local/bin/animaldex-wildlife-guides.sh` and enables `animaldex-wildlife-guides.timer`. Log: `/var/log/animaldex-wildlife-guides.log`.

Check it by hand: `curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3001/api/cron/wildlife-guide-refunds` should answer `{"ok":true,"due":0,…}`, and `…/api/cron/wildlife-guide-emails` `{"ok":true,"claimed":0,…}`.

A card payment reversed **after** the author's share was released is left with `refund_status = review` by the database; recover the share with an Earnings adjustment.
