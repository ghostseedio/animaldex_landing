import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    communityStatPoints,
    communitySupportScore,
    communitySupportSenderPoints,
    endorsedStatForSlug,
    giftDisplayName,
    LAUNCH_GIFT_CATALOG
} from "./capture-gifts";
import {
    EARNINGS_ALLOWED_SOURCE_TYPES,
    EARNINGS_FORBIDDEN_SOURCE_TYPES,
    mapEarningsSummaryRow
} from "./earnings";
import {
    creatorRewardGiftPoints,
    creatorRewardRiskMultiplierBps,
    mapCreatorRewardConfig
} from "./creator-rewards";

const here = dirname(fileURLToPath(import.meta.url));
const gradeSource = readFileSync(join(here, "capture-grade.ts"), "utf8");
const guideSource = readFileSync(join(here, "guide-marketplace-core.ts"), "utf8");
const giftSource = readFileSync(join(here, "capture-gifts.ts"), "utf8");
const giftRouteSource = readFileSync(join(here, "../app/api/app/gifts/route.ts"), "utf8");
const catalogRouteSource = readFileSync(join(here, "../app/api/app/gifts/catalog/route.ts"), "utf8");

test("capture grade still lifts from endorsements, not gifts or credits", () => {
    assert.match(gradeSource, /dominance_endorsements/);
    assert.match(gradeSource, /Community endorsements/);
    assert.doesNotMatch(gradeSource, /gift_credit/);
    assert.doesNotMatch(gradeSource, /capture_gift/);
    assert.doesNotMatch(gradeSource, /earning_entr/);
});

test("launch gift catalog is diminishing and never encodes cash", () => {
    const rates = LAUNCH_GIFT_CATALOG.map((item: (typeof LAUNCH_GIFT_CATALOG)[number]) => item.captureXpGrant / item.creditCost);
    for (let index = 1; index < rates.length; index += 1) {
        assert.ok(rates[index] < rates[index - 1]);
    }
    assert.ok(LAUNCH_GIFT_CATALOG[4].captureXpGrant < 20 * LAUNCH_GIFT_CATALOG[0].captureXpGrant);
    assert.doesNotMatch(giftSource, /usd/i);
    assert.doesNotMatch(giftSource, /earning/i);
    assert.doesNotMatch(giftSource, /payout/i);
});

test("community support scoring favors broad support over whales and never uses credit cost", () => {
    assert.equal(communitySupportSenderPoints(20, 1), 10);
    assert.equal(communitySupportSenderPoints(2, 1), 9);
    assert.equal(communitySupportSenderPoints(1, 1), 8);
    assert.equal(communityStatPoints(20), 8);

    const whale = communitySupportScore([{giftCount: 20, captureCount: 1}]);
    const tenSupporters = communitySupportScore(
        Array.from({length: 10}, () => ({giftCount: 2, captureCount: 1}))
    );
    const twentySupporters = communitySupportScore(
        Array.from({length: 20}, () => ({giftCount: 1, captureCount: 1}))
    );
    assert.equal(whale, 10);
    assert.equal(tenSupporters, 90);
    assert.equal(twentySupporters, 160);
    assert.ok(tenSupporters > whale);
    assert.ok(twentySupporters > tenSupporters);
    assert.equal(communitySupportSenderPoints(5, 1), 10);
    assert.doesNotMatch(giftSource, /SUM\(.*credit/i);
});

test("gift slug mapping is Phase 1B canonical", () => {
    assert.equal(giftDisplayName("big_brain"), "Big Brain");
    assert.equal(giftDisplayName("electric_find"), "Lightning Bolt");
    assert.equal(giftDisplayName("great_capture"), "Absolute Unit");
    assert.equal(giftDisplayName("wild"), "Powerhouse");
    assert.equal(giftDisplayName("legendary_capture"), "Legendary");
    assert.equal(endorsedStatForSlug("big_brain"), "intelligence");
    assert.equal(endorsedStatForSlug("electric_find"), "speed");
    assert.equal(endorsedStatForSlug("great_capture"), "size");
    assert.equal(endorsedStatForSlug("wild"), "dominance");
    assert.equal(endorsedStatForSlug("legendary_capture"), "rarity");
});

test("gift API routes use user session client and fail closed", () => {
    assert.match(giftRouteSource, /createSupabaseServerClient/);
    assert.match(catalogRouteSource, /createSupabaseServerClient/);
    assert.doesNotMatch(giftRouteSource, /service_role|getSupabaseServiceKey|SUPABASE_SERVICE/);
    assert.doesNotMatch(catalogRouteSource, /service_role|getSupabaseServiceKey|SUPABASE_SERVICE/);
    assert.match(catalogRouteSource, /enabled: false/);
});

test("guide listed price helpers do not describe credits or earnings ledgers", () => {
    assert.match(guideSource, /amount_minor/);
    assert.match(guideSource, /currency_code/);
    assert.doesNotMatch(guideSource, /credit_balances/);
    assert.doesNotMatch(guideSource, /earning_entries/);
});

test("earnings contract forbids credits gift and pvp sources", () => {
    for (const allowed of EARNINGS_ALLOWED_SOURCE_TYPES) {
        assert.ok(!EARNINGS_FORBIDDEN_SOURCE_TYPES.includes(allowed as never));
    }
    assert.ok(EARNINGS_ALLOWED_SOURCE_TYPES.includes("creator_reward"));
    assert.ok(EARNINGS_ALLOWED_SOURCE_TYPES.includes("guide_settlement"));
    assert.ok(EARNINGS_ALLOWED_SOURCE_TYPES.includes("campaign_reward"));
    assert.ok(EARNINGS_FORBIDDEN_SOURCE_TYPES.includes("credit"));
    assert.ok(EARNINGS_FORBIDDEN_SOURCE_TYPES.includes("gift"));
    assert.ok(EARNINGS_FORBIDDEN_SOURCE_TYPES.includes("pvp"));
});

test("earnings summary mapper keeps currencies as separate minor-unit rows", () => {
    const usd = mapEarningsSummaryRow({
        currency_code: "USD",
        pending_amount_minor: 0,
        available_amount_minor: 4210,
        held_amount_minor: 0,
        paid_amount_minor: 0,
        lifetime_earned_amount_minor: 4210,
    });
    const gbp = mapEarningsSummaryRow({
        currency_code: "GBP",
        pending_amount_minor: 0,
        available_amount_minor: 1825,
        held_amount_minor: 0,
        paid_amount_minor: 0,
        lifetime_earned_amount_minor: 1825,
    });
    assert.equal(usd.currencyCode, "USD");
    assert.equal(usd.availableAmountMinor, 4210);
    assert.equal(gbp.currencyCode, "GBP");
    assert.equal(gbp.availableAmountMinor, 1825);
});

test("creator reward gift points ignore credit cost and default config is fail-closed", () => {
    assert.equal(creatorRewardGiftPoints(1, 2), 1);
    assert.equal(creatorRewardGiftPoints(5, 2), 2);
    assert.equal(creatorRewardRiskMultiplierBps("excluded"), 0);
    assert.equal(creatorRewardRiskMultiplierBps("discounted"), 5_000);
    assert.equal(creatorRewardRiskMultiplierBps("clear"), 10_000);
    const cfg = mapCreatorRewardConfig({enabled: false, auto_post_earnings: false});
    assert.equal(cfg.enabled, false);
    assert.equal(cfg.autoPostEarnings, false);
    assert.equal(cfg.environment, null);
    const withEnv = mapCreatorRewardConfig({
        enabled: false,
        auto_post_earnings: false,
        environment: {
            environment_label: "production",
            supabase_project_ref: "wwhsdzpczekgdlobwaej",
            allow_test_fixtures: false,
            beta_allowlist_required: false,
            is_production: true,
            creator_rewards_enabled: false,
            auto_post_earnings: false,
        },
    });
    assert.equal(withEnv.environment?.isProduction, true);
    assert.equal(withEnv.environment?.environmentLabel, "production");
});
