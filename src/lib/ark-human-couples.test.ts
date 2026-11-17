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
    assert.deepEqual(Array.from(seen).sort(), ["bench", "dinner", "walk"]);
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
    assert.deepEqual(Array.from(with_).sort(), [A, B]);
    assert.equal(isGrown(null, "arrived", 100), true);
    assert.equal(isGrown(650, "born", 700), false);
    assert.equal(isGrown(650, "born", 650 + GROWN_DAYS), true);
});

// MARK: - In the town

const ROSTER = Array.from({length: 20}, (_, i) => ({id: `0000beef-0000-4000-8000-${i.toString(16).padStart(12, "0")}`}));
const [P, Q, R, S] = ROSTER.map((h) => h.id);
const KID = "0000beef-0000-4000-8000-0000000000ff";
/** The island clock's epoch (ms) for a town day and hour (`townClockAt`: day = floor(hours since epoch / 24) + 4). */
const at = (day: number, hours: number) => ((day - 4) * 24 + hours) * 3600 * 1000;
/** Rooms on a row: a sofa for two before a TV, a table with two chairs, a double bed (two spots). */
const HOST = {
    rooms: () =>
        Array.from({length: 14}, (_, i) => ({
            id: `room-${i}`,
            floor: 10,
            seats: [{x: i * 10, y: 10.45, z: 0, yaw: 0}, {x: i * 10 + 0.6, y: 10.45, z: 0, yaw: 0}],
            tv: {x: i * 10 + 0.3, y: 11, z: 3, yaw: Math.PI},
            chairs: [{x: i * 10 + 3, y: 10.45, z: 0, yaw: 0}, {x: i * 10 + 3, y: 10.45, z: 1.4, yaw: Math.PI}],
            beds: [{x: i * 10 + 6, y: 10.5, z: 0, yaw: 0}, {x: i * 10 + 6.8, y: 10.5, z: 0, yaw: 0}]
        }))
};

test("in the town: a dating pair is drawn together on its dates and apart otherwise; a couple shares one home", async () => {
    const {TownHumans, townClockAt} = await import("@/ark-scene/humans/town-humans");
    const town = new TownHumans({origin: {x: 0, z: 0}});
    town.setRoster(ROSTER);
    town.setRoomHost(HOST);
    const dating: HumanBond = {a: P, b: Q, stage: "dating", since: 100, home: null, expectingUntil: null};
    const home: HumanBond = {a: R, b: S, stage: "together", since: 100, home: S, expectingUntil: null};
    town.setBonds({bonds: [dating, home], children: []});
    const find = (list: ReadonlyArray<{id: string}>, id: string) => list.find((h) => h.id === id) as {id: string; x: number; y: number; z: number; what: string; pose: string} | undefined;
    const seen = new Set<string>();
    for (let day = 20411; day < 20431; day++) {
        for (let h = 9; h < 23; h += 0.5) {
            const ms = at(day, h);
            const out = town.frame(ms, null, 0);
            assert.equal(new Set(out.map((x) => x.id)).size, out.length, "someone drawn twice");
            const now = togetherNow(dating, townClockAt(ms));
            const p = find(out, P), q = find(out, Q);
            if (now && p && q && p.what === q.what) {
                // Together: within a table's width of each other, and nobody else on their spots.
                const d = Math.hypot(p.x - q.x, p.z - q.z);
                if (now.kind === "walk" && p.pose === "walk") {
                    assert.ok(d > 0.5 && d < 0.8, `walking ${d.toFixed(2)} m apart`);
                    seen.add("walk");
                } else if (now.kind === "bench" && p.what === "bench") {
                    assert.ok(d > 0.3 && d < 2.2, `on one bench, ${d.toFixed(2)} m apart`);
                    seen.add("bench");
                } else if (now.kind === "dinner" && p.what === "home") {
                    assert.ok(d > 0.5 && d < 2, `at one table, ${d.toFixed(2)} m apart`);
                    seen.add("dinner");
                }
                for (const o of out) if (o.id !== P && o.id !== Q) assert.ok(Math.hypot(o.x - p.x, o.z - p.z) > 0.25 && Math.hypot(o.x - q.x, o.z - q.z) > 0.25, `${o.id} on the couple's spot (${now.kind})`);
            }
            // The couple at home: the same room in the evening, on its sofa or at its table.
            const r = find(out, R), s = find(out, S);
            const evening = togetherNow(home, townClockAt(ms));
            if (evening && (evening.kind === "dinner" || evening.kind === "sofa") && r && s) {
                assert.ok(Math.hypot(r.x - s.x, r.z - s.z) < 2, "the couple in two rooms");
                seen.add(evening.kind === "sofa" ? "sofa" : "home-dinner");
                if (evening.kind === "sofa") assert.ok(town.tvs.length >= 1, "their TV is off");
            }
        }
        // Asleep in one room, two bed spots.
        const night = town.frame(at(day, 3.5), null, 0);
        const r = find(night, R), s = find(night, S);
        if (r && s) assert.ok(Math.hypot(r.x - s.x, r.z - s.z) > 0.5 && Math.hypot(r.x - s.x, r.z - s.z) < 1.2, "the couple's beds");
    }
    assert.deepEqual(Array.from(seen).sort(), ["bench", "dinner", "home-dinner", "sofa", "walk"]);
});

test("in the town: a child is small, with a parent, never alone; grown it keeps its own day", async () => {
    const {TownHumans} = await import("@/ark-scene/humans/town-humans");
    const town = new TownHumans({origin: {x: 0, z: 0}});
    town.setRoster([...ROSTER, {id: KID, origin: "born", born_ark_day: 1000}]);
    town.setRoomHost(HOST);
    town.setBonds({bonds: [{a: R, b: S, stage: "together", since: 100, home: R, expectingUntil: null}], children: [{id: KID, parents: [R, S], born: 1000}]});
    assert.equal(town.count, ROSTER.length + 1);
    for (const [age, baby] of [[30, true], [2500, false]] as const) {
        town.setArkDay(1000 + age);
        let drawn = 0;
        for (let day = 20411; day < 20418; day++) {
            for (let h = 0; h < 24; h += 0.5) {
                const out = town.frame(at(day, h), null, 0);
                const kid = out.find((x) => x.id === KID);
                if (!kid) continue;
                drawn++;
                assert.ok(kid.look.child);
                const size = (kid.scale ?? 1) * kid.look.height;
                assert.ok(baby ? size < 0.62 : size > 0.9 && size < 1.3, `a child ${size.toFixed(2)} m tall at ${age} days`);
                const parents = out.filter((x) => x.id === R || x.id === S);
                const near = Math.min(...parents.map((p) => Math.hypot(p.x - kid.x, p.z - kid.z)));
                assert.ok(near < 0.7, `the child ${near.toFixed(2)} m from a parent`);
                assert.ok(kid.what !== "car" && kid.what !== "boat");
            }
        }
        assert.ok(drawn > 20, `the child drawn ${drawn} times in a week`);
    }
    // Grown: one of the town, on its own day.
    town.setArkDay(1000 + GROWN_DAYS + 1);
    let alone = 0;
    for (let h = 0; h < 24; h += 0.5) {
        const out = town.frame(at(20413, h), null, 0);
        const kid = out.find((x) => x.id === KID);
        if (kid) {
            assert.equal(kid.look.child, false);
            assert.equal(kid.scale ?? 1, 1);
            alone++;
        }
    }
    assert.ok(alone > 0);
});
