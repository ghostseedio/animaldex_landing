import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260827120000_sponsored_campaign_cash_rewards.sql",
  ),
  "utf8",
);
const api = readFileSync(
  join(process.cwd(), "src/app/api/admin/sponsored-challenges/route.ts"),
  "utf8",
);
const imageApi = readFileSync(
  join(process.cwd(), "src/app/api/admin/sponsored-challenges/image/route.ts"),
  "utf8",
);

test("cash completion posts once to fiat Earnings and never Credits", () => {
  assert.match(migration, /campaign_reward_grants_one_cash_per_user unique/);
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /public\.post_pending_earning/);
  assert.match(migration, /p_source_type => 'campaign_reward'/);
  assert.doesNotMatch(
    migration,
    /credit_balances|credit_transactions|grant.*credit/i,
  );
});

test("cash inventory is fixed, fully funded, and deterministic", () => {
  assert.match(migration, /amount_minor > 0/);
  assert.match(migration, /max_recipients > 0/);
  assert.match(migration, /funding_must_equal_campaign_total/);
  assert.match(migration, /cash_campaign_funding_not_confirmed/);
  assert.match(migration, /v_count >= v_reward\.max_recipients/);
  assert.doesNotMatch(
    migration,
    /random\(|lottery|winner selection|stake_amount/i,
  );
});

test("admin exposes structured cash funding and controlled campaign artwork", () => {
  assert.match(api, /admin_set_campaign_cash_reward/);
  assert.match(api, /admin_confirm_campaign_cash_funding/);
  assert.match(imageApi, /image\/jpeg/);
  assert.match(imageApi, /image\/png/);
  assert.match(imageApi, /image\/webp/);
  assert.match(imageApi, /MAX_BYTES = 8 \* 1024 \* 1024/);
  assert.match(imageApi, /admin_set_sponsored_campaign_thumbnail/);
});
