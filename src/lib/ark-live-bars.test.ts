import assert from "node:assert/strict";
import test from "node:test";
import {arkBarCeiling, arkBars, arkBarShare, arkCountChanges, arkDeltaText, arkPopulationCounts, ARK_BAR_MIN_SHARE} from "./ark-live-bars";
import {arkPopulation} from "./ark-population";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";

test("the scale's top is a round ceiling, never under 5", () => {
    assert.equal(arkBarCeiling(0), 5);
    assert.equal(arkBarCeiling(2), 5);
    assert.equal(arkBarCeiling(5), 5);
    assert.equal(arkBarCeiling(6), 10);
    assert.equal(arkBarCeiling(300), 500);
    assert.equal(arkBarCeiling(1001), 2000);
    assert.equal(arkBarCeiling(70_000), 100_000);
    assert.equal(arkBarCeiling(Number.NaN), 5);
});

test("log scale: one animal and three hundred are both readable, more is always longer", () => {
    const ceiling = arkBarCeiling(300);
    const one = arkBarShare(1, ceiling);
    const three = arkBarShare(300, ceiling);
    assert.ok(one >= 0.1 && one < 0.2, `one animal at ${one}`);
    assert.ok(three > 0.9 && three <= 1, `three hundred at ${three}`);
    let last = 0;
    for (const count of [1, 2, 3, 5, 10, 30, 100, 300, 500]) {
        const share = arkBarShare(count, ceiling);
        assert.ok(share > last, `${count} is longer than the one before`);
        last = share;
    }
    assert.equal(arkBarShare(0, ceiling), 0);
    assert.equal(arkBarShare(-3, ceiling), 0);
    assert.equal(arkBarShare(1, 1_000_000), ARK_BAR_MIN_SHARE, "never a hairline");
    assert.equal(arkBarShare(9999, 10), 1, "never past the end");
});

test("bars of the fixture: every species against its region's biggest, every region against the biggest region", () => {
    const population = arkPopulation(decodeArkSnapshot(fixture));
    const bars = arkBars(population);
    assert.equal(bars.regions.length, population.regions.length);
    const biggest = Math.max(...population.regions.map((r) => r.animals));
    for (const region of bars.regions) {
        const group = population.regions.find((r) => r.region === region.region)!;
        assert.equal(region.rows.length, group.species.length);
        assert.ok(region.share > 0 && region.share <= 1);
        if (group.animals === biggest) assert.ok(region.share >= Math.max(...bars.regions.map((r) => r.share)) - 1e-9);
        const top = Math.max(...group.species.map((s) => s.count));
        const topRow = region.rows.find((row) => row.count === top)!;
        assert.ok(region.rows.every((row) => row.share <= topRow.share + 1e-9), "the biggest kind has the longest bar");
        assert.ok(region.pairShare > 0 && region.pairShare < 1, "the pair line sits inside the bar");
        for (const row of region.rows) {
            if (row.count === 2) assert.equal(row.share, region.pairShare, "a pair reaches exactly the pair line");
        }
    }
});

test("count changes: up, down, new and gone; unchanged left out", () => {
    const before = new Map([["a", 2], ["b", 5], ["c", 1]]);
    const after = new Map([["a", 3], ["b", 5], ["d", 2]]);
    assert.deepEqual(Object.fromEntries(arkCountChanges(before, after)), {a: 1, d: 2, c: -1});
    const population = arkPopulation(decodeArkSnapshot(fixture));
    const counts = arkPopulationCounts(population);
    assert.equal(counts.get(`region:${population.regions[0].region}`), population.regions[0].animals);
    assert.equal(arkCountChanges(counts, counts).size, 0);
});

test("a change as the arrow says it: a plus, or a true minus sign", () => {
    assert.equal(arkDeltaText(2, "en"), "+2");
    assert.equal(arkDeltaText(-1, "en"), "−1");
    assert.equal(arkDeltaText(1200, "en"), "+1,200");
});
