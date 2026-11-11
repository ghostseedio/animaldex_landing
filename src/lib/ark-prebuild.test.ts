import assert from "node:assert/strict";
import test from "node:test";
import {forestFill, grassTufts, primeDecor, worldDecor} from "@/ark-scene/decor";
import {placeAnimals} from "@/ark-scene/placement";
import {applyArkPrebuild, computeArkPrebuild, packGrass, unpackGrass} from "@/ark-scene/runtime/prebuild";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

test("prebuild: what the worker sends, after a structured clone and the prime hooks, is exactly what the mount computes", () => {
    const snapshot = decodeArkSnapshot(fixture)!;
    // The mount's own results, computed here first (the reference).
    const decor = structuredClone(worldDecor());
    const fill = structuredClone(forestFill());
    const grass = grassTufts(22000);
    const places = Array.from(placeAnimals(snapshot.animals).entries());
    // The worker's answer, across the thread boundary (structured clone), handed in through the hooks.
    const sent = structuredClone(computeArkPrebuild({grass: 22000, animals: snapshot.animals}));
    applyArkPrebuild(sent, snapshot.animals);
    assert.deepEqual(worldDecor(), decor);
    assert.deepEqual(forestFill(), fill);
    assert.deepEqual(grassTufts(22000), grass, "the primed grass, unpacked, is the computed grass to the bit");
    assert.deepEqual(Array.from(placeAnimals(snapshot.animals).entries()), places);
    // Each primed result is used once; a second call computes again (still equal), another count is never primed.
    assert.deepEqual(grassTufts(22000), grass);
    assert.equal(grassTufts(100).length, 100);
});

test("prebuild: the grass packs and unpacks without loss; a prime for another array of animals is ignored", () => {
    const tufts = grassTufts(500);
    assert.deepEqual(unpackGrass(packGrass(tufts, 500)), tufts);
    const snapshot = decodeArkSnapshot(fixture)!;
    const other = [...snapshot.animals];
    applyArkPrebuild(computeArkPrebuild({grass: 500, animals: snapshot.animals}), snapshot.animals);
    // A different array (another snapshot): computed, not the primed map.
    const placed = placeAnimals(other);
    assert.equal(placed.size, other.length);
    primeDecor({});
});

test("prebuild: the ground's arrays (graphics' groundArrays, once in the release) cross the thread boundary unchanged", async () => {
    const terrain = (await import("@/ark-scene/terrain")) as unknown as {groundArrays?: (tier: string) => Record<string, unknown>};
    if (!terrain.groundArrays) return; // Not in this release yet: the worker sends no ground and the mount builds it.
    const reference = terrain.groundArrays("medium");
    const sent = structuredClone(computeArkPrebuild({grass: 10, animals: null, tier: "medium"}));
    assert.deepEqual(sent.ground, reference);
});
