import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {captureBattlePower, captureBattleTier, captureBattleTierFromPower} from "@/lib/capture-battle-tier";

// The same 501 vectors AnimalDex's supabase/functions/_shared/battle-tier.test.ts uses:
// [dominance, speed, size, intelligence, rarity, power, tier], where power and tier were
// computed by production's public.capture_battle_power and public.capture_tier_label
// (read-only query, 2026-11-19, GRADING-2). Copy the file again if AnimalDex regenerates it.
const vectors: [number, number, number, number, number, number, string][] = JSON.parse(
    readFileSync(new URL("./capture-battle-tier.test-vectors.json", import.meta.url), "utf8")
);

test("capture-battle-tier matches capture_battle_power + capture_tier_label on every SQL vector", () => {
    assert.equal(vectors.length, 501);
    for (const [dominance, speed, size, intelligence, rarity, power, tier] of vectors) {
        const label = `${[dominance, speed, size, intelligence, rarity]}`;
        const got = captureBattlePower({dominance, speed, size, intelligence, rarity});
        assert.equal(got, power, `power ${label}`);
        assert.equal(captureBattleTierFromPower(got), tier, `tier ${label}`);
    }
});

test("capture-battle-tier band edges", () => {
    assert.deepEqual(
        [13, 14, 26, 27, 35, 36, 44, 45, 56, 57].map(captureBattleTierFromPower),
        ["E", "D", "D", "C", "C", "B", "B", "A", "A", "S"]
    );
    assert.equal(captureBattlePower({dominance: 100, speed: 100, size: 100, intelligence: 100, rarity: 100}), 100);
    assert.equal(captureBattlePower({}), 0);
});

test("GRADING-3: server tier wins; else placeholder E and the one-band ceiling", () => {
    assert.equal(captureBattleTier({serverTier: "b", baseStats: {}}), "B");
    assert.equal(captureBattleTier({baseStats: {dominance: 50, speed: 50, size: 50, intelligence: 50, rarity: 90}}), "E");
    const base = {dominance: 30, speed: 30, size: 30, intelligence: 30, rarity: 30}; // power 30 -> C
    assert.equal(captureBattleTier({baseStats: base}), "C");
    assert.equal(captureBattleTier({baseStats: base, effectiveStats: {dominance: 100, speed: 100, size: 100, intelligence: 100, rarity: 100}}), "B");
    assert.equal(captureBattleTier({baseStats: base, effectiveStats: {...base, rarity: 100}}), "C");
});
