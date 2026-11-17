/**
 * The town's couples and children (p5 humans; AnimalDex decision 380): the record's rows decoded, a couple's dates on the
 * shared island clock, a child's size by its age.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import {BABY_SCALE, GROWN_DAYS, carried, childScale, decodeHumanBonds, isGrown, parentNow, togetherNow, type HumanBond} from "@/ark-scene/humans/couples";

const A = "0000beef-0000-4000-8000-00000000000a";
const B = "0000beef-0000-4000-8000-00000000000b";
const C = "0000beef-0000-4000-8000-00000000000c";
const K = "0000beef-0000-4000-8000-00000000000d";

test("decode: only well-formed rows; a human is in one bond at most; no names pass through", () => {
    const raw = {
        bonds: [
            {a: A, b: B, stage: "together", since: 300, home: B, expecting_until: 700, name: "x"},
            {a: A, b: C, stage: "dating", since: 400},
            {a: C, b: C, stage: "dating", since: 1},
            {a: C, b: "nope", stage: "dating", since: 1},
            {a: C, b: K, stage: "married", since: 1}
        ],
        children: [{id: K, parents: [A, B], born: 650}, {id: C, parents: [A], born: 1}, {id: "x", parents: [A, B], born: 1}]
    };
    const out = decodeHumanBonds(raw);
    assert.deepEqual(out.bonds, [{a: A, b: B, stage: "together", since: 300, home: B, expectingUntil: 700}]);
    assert.deepEqual(out.children, [{id: K, parents: [A, B], born: 650}]);
    assert.deepEqual(decodeHumanBonds(null), {bonds: [], children: []});
    assert.deepEqual(decodeHumanBonds({bonds: "x"}), {bonds: [], children: []});
});

test("dates: the same for every viewer, by day only, over many days; a couple at home dines and sits together", () => {
    const dating: HumanBond = {a: A, b: B, stage: "dating", since: 100, home: null, expectingUntil: null};
    const seen = new Set<string>();
    let dateDays = 0;
    for (let d = 0; d < 60; d++) {
        let any = false;
        for (let h = 0; h < 24; h += 0.25) {
            const now = togetherNow(dating, {hours: h, day: d});
            assert.deepEqual(now, togetherNow({...dating, a: B, b: A}, {hours: h, day: d}), "the pair's order changed the date");
            if (!now) continue;
            any = true;
            seen.add(now.kind);
            assert.ok(h >= 15 && h < 20.5, `a date at ${h}`);
            if (now.kind === "dinner") assert.ok(now.home === A || now.home === B);
            if (now.kind === "walk") assert.ok(now.share >= 0 && now.share < 1);
        }
        if (any) dateDays++;
    }
    assert.deepEqual([...seen].sort(), ["bench", "dinner", "walk"]);
    assert.ok(dateDays > 40 && dateDays < 60, `${dateDays} of 60 days with a date`);
    const home: HumanBond = {a: A, b: B, stage: "together", since: 300, home: B, expectingUntil: null};
    assert.deepEqual(togetherNow(home, {hours: 19, day: 3}), {kind: "dinner", home: B});
    assert.deepEqual(togetherNow(home, {hours: 20, day: 3}), {kind: "sofa", home: B});
    assert.equal(togetherNow(home, {hours: 3, day: 3}), null);
});

test("children: a babe in arms, then growing evenly to grown; with one parent or the other", () => {
    assert.equal(childScale(0), BABY_SCALE);
    assert.equal(childScale(GROWN_DAYS), 1);
    assert.equal(childScale(GROWN_DAYS * 3), 1);
    assert.ok(childScale(GROWN_DAYS / 2) > 0.6 && childScale(GROWN_DAYS / 2) < 0.7);
    assert.equal(carried(10), true);
    assert.equal(carried(2000), false);
    const child = {id: K, parents: [A, B] as [string, string], born: 650};
    const with_ = new Set<string>();
    for (let d = 0; d < 10; d++) for (let h = 0; h < 24; h += 3) with_.add(parentNow(child, {hours: h, day: d}));
    assert.deepEqual([...with_].sort(), [A, B]);
    assert.equal(isGrown(null, "arrived", 100), true);
    assert.equal(isGrown(650, "born", 700), false);
    assert.equal(isGrown(650, "born", 650 + GROWN_DAYS), true);
});
