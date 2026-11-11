import assert from "node:assert/strict";
import test from "node:test";
import {ARK_LIVE_BUDGET, ARK_REST_STEP_SECONDS, arkOutside, arkQuotas, type ArkLiveCandidate} from "@/ark-scene/live-budget";

/** A population like the backfill's: a few big kinds, many with one or two. */
function population(): ArkLiveCandidate[] {
    const out: ArkLiveCandidate[] = [];
    let n = 0;
    const add = (group: string, count: number) => {
        for (let i = 0; i < count; i++) out.push({id: `a${n++}`, group});
    };
    for (let k = 0; k < 6; k++) add(`big${k}`, 24);
    for (let k = 0; k < 60; k++) add(`mid${k}`, 6);
    for (let k = 0; k < 300; k++) add(`small${k}`, 1 + (k % 2));
    return out;
}

const T = 1_800_000_000;

test("live budget: at most the budget out, every kind keeps one, the rest by size", () => {
    const all = population();
    const out = arkOutside(all, 400, T);
    // At most the budget; the proportional share rounds down (monotone across tiers), so a few places stay free.
    assert.ok(out.size <= 400 && out.size >= 380, String(out.size));
    const kinds = new Set(all.map((c) => c.group));
    const outKinds = new Set(all.filter((c) => out.has(c.id)).map((c) => c.group));
    assert.equal(outKinds.size, kinds.size, "every kind has one outside");
    const count = (group: string) => all.filter((c) => c.group === group && out.has(c.id)).length;
    assert.ok(count("big0") > count("mid0") && count("mid0") >= count("small1"));
    // Under the budget: everyone.
    assert.equal(arkOutside(all.slice(0, 100), 400, T).size, 100);
});

test("live budget: the same for every viewer (time and ids only), nested across tiers, pins on top", () => {
    const all = population();
    const a = arkOutside(all, 400, T + 10);
    const b = arkOutside([...all].reverse(), 400, T + 200);
    assert.deepEqual([...a].sort(), [...b].sort(), "same step, any order: the same animals");
    const low = arkOutside(all, ARK_LIVE_BUDGET.low, T);
    const medium = arkOutside(all, ARK_LIVE_BUDGET.medium, T);
    const high = arkOutside(all, ARK_LIVE_BUDGET.high, T);
    for (const id of low) assert.ok(medium.has(id), `low ⊂ medium: ${id}`);
    for (const id of medium) assert.ok(high.has(id), `medium ⊂ high: ${id}`);
    const pinned = arkOutside(all, 400, T, new Set(["a5", "a7"]));
    assert.ok(pinned.has("a5") && pinned.has("a7"));
    assert.ok(pinned.size <= 402);
});

test("live budget: each step one animal per crowded kind goes in to rest and the next comes out; all take turns", () => {
    const all = population();
    const one = arkOutside(all, 400, T);
    const next = arkOutside(all, 400, T + ARK_REST_STEP_SECONDS);
    const big = all.filter((c) => c.group === "big0");
    const left = big.filter((c) => one.has(c.id) && !next.has(c.id));
    const came = big.filter((c) => !one.has(c.id) && next.has(c.id));
    assert.equal(left.length, 1);
    assert.equal(came.length, 1);
    // Over a whole turn of the ring every animal of the kind has been outside.
    const seen = new Set<string>();
    for (let s = 0; s < 24; s++) for (const id of arkOutside(all, 400, T + s * ARK_REST_STEP_SECONDS)) seen.add(id);
    for (const c of big) assert.ok(seen.has(c.id), c.id);
});

test("live budget: more kinds than the budget, the kinds take turns; quotas grow with the budget", () => {
    const many: ArkLiveCandidate[] = Array.from({length: 500}, (_, i) => ({id: `k${i}`, group: `g${i}`}));
    const out = arkOutside(many, 200, T);
    assert.equal(out.size, 200);
    const sizes = new Map([["a", 30], ["b", 5], ["c", 1]]);
    let before = new Map<string, number>();
    for (let budget = 3; budget <= 36; budget++) {
        const q = arkQuotas(sizes, budget);
        let sum = 0;
        q.forEach((v, k) => {
            sum += v;
            assert.ok(v >= (before.get(k) ?? 0), `monotone ${k} at ${budget}`);
        });
        assert.ok(sum <= budget);
        before = q;
    }
});
