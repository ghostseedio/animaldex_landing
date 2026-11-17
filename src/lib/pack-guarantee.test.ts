import assert from "node:assert/strict";
import test from "node:test";

import {
    comparePackBuilderCaptures,
    PACK_MIN_RARITY,
    packBuilderPill,
    packGuaranteeBadge,
    packRarityRequirementMessage,
    parsePackGuarantee,
    rarityTierLabel
} from "@/lib/pack-guarantee";

test("the rarity tier follows the iOS thresholds at every boundary", () => {
    const cases: Array<[number, string]> = [
        [0, "Common"], [9, "Common"], [10, "Uncommon"], [24, "Uncommon"], [25, "Rare"], [44, "Rare"],
        [45, "Epic"], [64, "Epic"], [65, "Legendary"], [89, "Legendary"], [90, "Mythic"], [100, "Mythic"]
    ];
    for (const [score, tier] of cases) assert.equal(rarityTierLabel(score), tier, `rarity ${score}`);
    assert.equal(rarityTierLabel(null), null);
});

test("a pack guarantee reads rarity tiers and the legacy battle tier", () => {
    assert.deepEqual(parsePackGuarantee("Epic"), {kind: "rarity", tier: "Epic"});
    assert.deepEqual(parsePackGuarantee("Uncommon"), {kind: "rarity", tier: "Uncommon"});
    assert.deepEqual(parsePackGuarantee(" Mythic "), {kind: "rarity", tier: "Mythic"});
    // Sealed under the old battle rule: stored "B", keeps its promise.
    assert.deepEqual(parsePackGuarantee("B"), {kind: "legacyBattleTier", tier: "B"});
    // Common is never a promise; anything unreadable falls back to the old label.
    assert.deepEqual(parsePackGuarantee("Common"), {kind: "legacyBattleTier", tier: "B"});
    assert.deepEqual(parsePackGuarantee(null), {kind: "legacyBattleTier", tier: "B"});
});

test("the badge names the rarity, not a battle tier", () => {
    assert.equal(packGuaranteeBadge("Epic"), "Epic or better guaranteed");
    assert.equal(packGuaranteeBadge("Legendary"), "Legendary or better guaranteed");
    assert.equal(packGuaranteeBadge("B"), "Tier B+ guaranteed");
});

test("the builder words the current minimum rarity", () => {
    assert.equal(PACK_MIN_RARITY, "Epic");
    assert.equal(packBuilderPill(), "Epic+");
    assert.equal(packRarityRequirementMessage(), "Your pack needs at least 1 animal of Epic rarity or better.");
});

test("the builder lists the rarest captures first, then value, then newest", () => {
    const common = {rarity: 5, tradeValue: 90, capturedAt: "2026-11-01"};
    const epic = {rarity: 55, tradeValue: 10, capturedAt: "2026-10-01"};
    const rare = {rarity: 30, tradeValue: 50, capturedAt: "2026-11-02"};
    const rareNewer = {rarity: 30, tradeValue: 50, capturedAt: "2026-11-09"};
    assert.deepEqual([common, rare, epic].sort(comparePackBuilderCaptures), [epic, rare, common]);
    assert.deepEqual([rare, rareNewer].sort(comparePackBuilderCaptures), [rareNewer, rare]);
});
