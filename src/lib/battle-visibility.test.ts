import assert from "node:assert/strict";
import test from "node:test";
import {getBattlePower, getBattleTier} from "@/lib/battle-tier";
import {SHOWS_BATTLE_TIER_AND_POWER} from "@/lib/battle-visibility";

// Battles are off, so no battle tier (E to S) or battle power shows. The data stays: the tier and power still
// compute (the admin catalog and the sign-in animation's stats read them). The switch is the one place to turn
// the display back on.
test("battle tier and power are hidden", () => {
    assert.equal(SHOWS_BATTLE_TIER_AND_POWER, false);
});

test("the data is kept: tier and power still compute", () => {
    const stats = {dominance: 95, speed: 90, size: 85, intelligence: 85, rarity: 80};
    assert.ok(getBattlePower(stats) > 0);
    assert.equal(getBattleTier(stats), "S");
    assert.equal(getBattleTier({dominance: 5, speed: 5, size: 5, intelligence: 5, rarity: 5}), "E");
});

test("a battle tier filter on the species directory (?tier=S) is no filter while battles are off", async () => {
    const {isSpeciesDirectoryTierFilter} = await import("@/data/species-directory-options");
    assert.equal(isSpeciesDirectoryTierFilter("all"), true);
    for (const tier of ["S", "A", "B", "C", "D", "E"]) assert.equal(isSpeciesDirectoryTierFilter(tier), SHOWS_BATTLE_TIER_AND_POWER, tier);
});
