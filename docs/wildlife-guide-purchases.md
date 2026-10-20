# Buying a Wildlife Guide on the website

Server side: migration `20261020100000_wildlife_guide_purchases.sql` (AnimalDex repo). Guide prices are USD cents (`guide_listings.amount_minor`), so card checkout charges that amount in USD.

## Flows

| Who | How | Route |
| --- | --- | --- |
| Signed in | Credits (`purchase_wildlife_guide_with_credits`, one idempotency key per page) | `POST /api/app/wildlife-guides/{id}/purchase` |
| Signed in or guest | Card (Paddle overlay) | `POST /api/wildlife-guides/{id}/checkout` |
| Buyer | Ask for a refund (`request_wildlife_guide_refund`) | `POST /api/app/wildlife-guides/{id}/refund` |
| Guest buyer | Email me a new sign-in link | `POST /api/wildlife-guides/{id}/access-link` |
| VM timer | Send queued card refunds to Paddle | `POST /api/cron/wildlife-guide-refunds` |

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

## Card refunds

Refunds are decided in the database (no reply within 48 hours, a buyer's request within 7 days, a duplicate purchase). Credits refunds are immediate; a card refund is queued (`status = refunded`, `refund_status = processing`) until the website sends it to Paddle. `POST /api/cron/wildlife-guide-refunds`:

- reads `wildlife_guide_web_refunds_due(limit)` (default 20, `?limit=` up to 100);
- for each, reuses a refund adjustment Paddle already has for the transaction, or creates a full refund (`POST /adjustments`, `action: refund`, `type: full`);
- marks it sent (`mark_wildlife_guide_web_refund_sent`), and returns `{due, sent, failed, results}`. Failures stay queued for the next run.

### Schedule it on the VM (not installed)

Same pattern as `scripts/install-identity-review-timer.sh`. Every 10 minutes is enough (the database sweep that queues no-reply refunds runs every 10 minutes too).

```bash
# 1. CRON_SECRET must be in /opt/animaldex/shared/app.env (the identity-review installer adds it).
grep -q '^CRON_SECRET=' /opt/animaldex/shared/app.env || echo "CRON_SECRET=$(openssl rand -hex 32)" >> /opt/animaldex/shared/app.env
# (live in the container after the next deploy-selfhost.sh)

# 2. Runner
sudo tee /usr/local/bin/animaldex-guide-refunds.sh > /dev/null <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
SECRET=$(grep '^CRON_SECRET=' /opt/animaldex/shared/app.env | cut -d= -f2-)
RESULT=$(curl -sS -m 120 -X POST -H "Authorization: Bearer $SECRET" 'http://127.0.0.1:3001/api/cron/wildlife-guide-refunds' 2>&1)
echo "$(date -u +%FT%TZ) $RESULT" >> /var/log/animaldex-guide-refunds.log
EOF
sudo chmod 755 /usr/local/bin/animaldex-guide-refunds.sh
sudo touch /var/log/animaldex-guide-refunds.log && sudo chown "$(id -un)" /var/log/animaldex-guide-refunds.log

# 3. Service + timer
sudo tee /etc/systemd/system/animaldex-guide-refunds.service > /dev/null <<EOF
[Unit]
Description=AnimalDex Wildlife Guide card refunds
After=docker.service

[Service]
Type=oneshot
User=$(id -un)
ExecStart=/usr/local/bin/animaldex-guide-refunds.sh
EOF
sudo tee /etc/systemd/system/animaldex-guide-refunds.timer > /dev/null <<'EOF'
[Unit]
Description=Wildlife Guide card refunds every 10 minutes

[Timer]
OnCalendar=*:5/10
RandomizedDelaySec=60
Persistent=true

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now animaldex-guide-refunds.timer
systemctl list-timers --no-pager | grep animaldex-guide-refunds
```

Check it by hand: `curl -sS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3001/api/cron/wildlife-guide-refunds` should answer `{"ok":true,"due":0,…}`.

A card payment reversed **after** the author's share was released is left with `refund_status = review` by the database; recover the share with an Earnings adjustment.
