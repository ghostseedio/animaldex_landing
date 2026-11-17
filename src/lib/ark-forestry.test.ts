/**
 * Logging and replanting on the wild island (p5 humans; AnimalDex decision 379): the shared forestry module's schedule
 * over the real stands (`forest-stands.json`), the trees' fates, the crews, and the deaths it hands the server.
 */
import {test} from "node:test";
import assert from "node:assert/strict";
import stands from "@/ark-scene/positions/forest-stands.json";
import {clearedAt, cutDay, FELL_DAYS, forestDeaths, growthAt, habitatBackDay, HABITAT_GROWTH, inStand, loggingAt, loggingsAround, PERIOD_DAYS, REUSE_DAYS, type ForestHome, type StandTable} from "@/ark-scene/positions/forestry";
import {bareness, FALL_DAYS, saplingSpot, treeFate} from "@/ark-scene/forestry/forest-state";
import {awayInForest, crewAt, crewOf} from "@/ark-scene/forestry/forest-crews";

const table = stands as unknown as StandTable & {forestM2: number};
const FROM = 220;
const DAYS = 3000;

/** A stand's trees on a ring and its middle, as a stand of the real island holds them (6–14). */
function treesOf(k: number) {
    const g = loggingAt(table, FROM, k)!;
    const out: Array<{x: number; z: number; radius: number}> = [];
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + k;
        const r = (0.25 + 0.6 * ((i * 7) % 10) / 10) * g.stand.r;
        // (Feet from a birch's to a buttressed giant's.)
        out.push({x: g.stand.x + Math.cos(a) * r, z: g.stand.z + Math.sin(a) * r, radius: 0.2 + 0.2 * i});
    }
    return {g, trees: out};
}

test("stands: real, apart and in the forest's budget", () => {
    assert.ok(table.stands.length >= 9, `${table.stands.length} stands`);
    for (const a of table.stands) for (const b of table.stands) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= a.r + b.r, "stands overlap");
    const area = Math.PI * table.radius * table.radius;
    assert.ok(area / table.forestM2 < 0.025, `one stand is ${((100 * area) / table.forestM2).toFixed(1)}% of the forest`);
});

test("schedule: deterministic, never more than one stand below habitat, a stand never reused within REUSE_DAYS", () => {
    assert.deepEqual(loggingAt(table, FROM, 7), loggingAt(table, FROM, 7));
    const lastUse = new Map<number, number>();
    for (let k = 0; k * PERIOD_DAYS < DAYS; k++) {
        const g = loggingAt(table, FROM, k)!;
        const prev = lastUse.get(g.stand.id);
        if (prev !== undefined) assert.ok(g.start - prev >= REUSE_DAYS, `stand ${g.stand.id} reused after ${g.start - prev} days`);
        lastUse.set(g.stand.id, g.start);
    }
    let most = 0;
    for (let day = FROM; day < FROM + DAYS; day += 0.25) {
        const below = loggingsAround(table, FROM, day).filter((g) => day < habitatBackDay(g)).length;
        most = Math.max(most, below);
    }
    assert.equal(most, 1);
});

test("trees: stand, fall at the front, lie, stump, then grow back to the full tree in its own place", () => {
    const {g, trees} = treesOf(3);
    for (const t of trees) {
        const cut = cutDay(g, t.x, t.z);
        assert.ok(cut >= g.start && cut <= g.start + FELL_DAYS);
        assert.equal(treeFate(g, t.x, t.z, cut - 0.001).state, "standing");
        assert.equal(treeFate(g, t.x, t.z, cut + FALL_DAYS / 2).state, "falling");
        assert.equal(treeFate(g, t.x, t.z, cut + 0.1).state, "log");
        assert.equal(treeFate(g, t.x, t.z, g.start + 2).state, "stump");
        const grown = treeFate(g, t.x, t.z, g.start + REUSE_DAYS - 0.5);
        assert.equal(grown.state, "sapling");
        assert.equal(grown.state === "sapling" && grown.growth, 1);
        assert.deepEqual(saplingSpot(g, t.x, t.z), {x: t.x, z: t.z});
    }
    // Outside the stand nothing changes.
    assert.equal(treeFate(g, g.stand.x + g.stand.r + 1, g.stand.z, g.start + 2).state, "standing");
    // The ground bares and greens back.
    assert.equal(bareness(g, g.start - 1), 0);
    assert.ok(bareness(g, g.start + 2) > 0.9);
    assert.equal(bareness(g, g.start + REUSE_DAYS - 1), 0);
});

test("habitat: cleared only between the cut and the regrowth threshold; back everywhere by habitatBackDay", () => {
    const {g, trees} = treesOf(5);
    for (const t of trees) {
        assert.equal(clearedAt(g, t.x, t.z, cutDay(g, t.x, t.z) - 1e-4), false);
        assert.equal(clearedAt(g, t.x, t.z, cutDay(g, t.x, t.z) + 1e-4), true);
        assert.equal(clearedAt(g, t.x, t.z, habitatBackDay(g) + 1e-6), false);
        assert.ok(growthAt(g, t.x, t.z, habitatBackDay(g) + 1e-6) >= HABITAT_GROWTH);
    }
});

test("deaths: only Ark-born animals living there before the logging, inside the stand, once, never revived", () => {
    const homes: ForestHome[] = [];
    for (let k = 0; k < 6; k++) {
        const g = loggingAt(table, FROM, k)!;
        homes.push({id: `in-born-${k}`, x: g.stand.x + 2, z: g.stand.z - 3, born: true, since: FROM - 10});
        homes.push({id: `in-card-${k}`, x: g.stand.x - 2, z: g.stand.z, born: false, since: FROM - 10});
        homes.push({id: `in-late-${k}`, x: g.stand.x, z: g.stand.z + 1, born: true, since: g.start + 0.01});
        homes.push({id: `edge-out-${k}`, x: g.stand.x + g.stand.r + 0.5, z: g.stand.z, born: true, since: FROM - 10});
    }
    // Windows of a tick each (the server's), consecutive: every death once, in its window, by its cut.
    const seen = new Map<string, number>();
    let living = homes.slice();
    for (let t = FROM; t < FROM + 6 * PERIOD_DAYS + 2; t += 0.37) {
        for (const d of forestDeaths(table, FROM, living, t, t + 0.37)) {
            assert.ok(!seen.has(d.id), `${d.id} died twice`);
            assert.ok(d.day > t && d.day <= t + 0.37);
            seen.set(d.id, d.day);
        }
        living = living.filter((h) => !seen.has(h.id));
    }
    for (let k = 0; k < 6; k++) {
        assert.ok(seen.has(`in-born-${k}`), `in-born-${k} survived`);
        assert.ok(!seen.has(`in-card-${k}`), "a carded animal died");
        assert.ok(!seen.has(`in-late-${k}`), "a newcomer died of an old logging");
        assert.ok(!seen.has(`edge-out-${k}`), "an animal outside the stand died");
        const g = loggingAt(table, FROM, k)!;
        assert.equal(seen.get(`in-born-${k}`), cutDay(g, g.stand.x + 2, g.stand.z - 3));
    }
    // A big window and many small ones agree.
    const once = forestDeaths(table, FROM, homes, FROM, FROM + 6 * PERIOD_DAYS + 2).map((d) => d.id).sort();
    assert.deepEqual(once, Array.from(seen.keys()).sort());
});

test("crews: from the humans aboard, inside or at the stand, felling then planting; none without humans", () => {
    const humans = Array.from({length: 112}, (_, i) => `human-${i}`);
    const {g, trees} = treesOf(2);
    assert.deepEqual(crewAt(g, trees, [], g.start + 0.5), []);
    assert.deepEqual(crewOf(humans, 2, "fell"), crewOf(humans, 2, "fell"));
    for (let day = g.start; day < g.start + 6; day += 0.01) {
        for (const m of crewAt(g, trees, humans, day)) {
            assert.ok(humans.includes(m.id));
            assert.ok(Math.hypot(m.x - g.stand.x, m.z - g.stand.z) <= g.stand.r + 3, `${m.role} ${m.pose} off the stand`);
            // Nobody works inside a standing tree's foot (walking between them is the scene's, on the cleared ground).
            for (const t of trees) if (m.pose !== "walk" && day < cutDay(g, t.x, t.z)) assert.ok(Math.hypot(m.x - t.x, m.z - t.z) > t.radius + 0.3, `${m.role} inside a trunk`);
            assert.ok(awayInForest([g], humans, m.id, day));
        }
    }
    assert.ok(crewAt(g, trees, humans, g.start + 0.5).some((m) => m.pose === "chop"));
    assert.ok(crewAt(g, trees, humans, g.start + 4.5).some((m) => m.pose === "plant"));
    assert.deepEqual(crewAt(g, trees, humans, g.start + 3), []);
    assert.equal(awayInForest([g], humans, crewOf(humans, 2, "fell")[0], g.start + 3), false);
});

test("log + bodies: a deforested row is said in the owner's words and its body laid at the server's spot", async () => {
    const {forestDeathRecords, forestItems, forestText} = await import("@/ark-scene/live/forest-lines");
    const rows = [
        {id: 7, kind: "deforested", at: "2026-11-20T10:00:00Z", forest: {standId: 3, k: 2, x: -160.25, z: -15.5, until: 250}, animal: {id: "a1", species_profile_id: "sp-bear", name: "Sun Bear", model_slug: "sun-bear", zone: "rainforest", origin: "born", status: "deforested"}},
        {id: 8, kind: "death_old", at: "2026-11-20T10:00:00Z", animal: {id: "a2", species_profile_id: "sp-x", name: "Okapi", model_slug: "okapi", zone: "rainforest"}}
    ];
    const deaths = forestDeathRecords(rows, null, 0);
    assert.equal(deaths.length, 1);
    assert.equal(deaths[0].animal.name, "Sun Bear");
    assert.deepEqual(deaths[0].spot, {x: -160.25, z: -15.5});
    assert.equal(deaths[0].key, "death:7");
    const items = forestItems(rows, null, 0, () => false);
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, "death");
    assert.equal(forestItems(rows, null, 0, (key) => key === "event:7").length, 0);
    assert.equal(forestDeathRecords(rows, null, Date.parse("2026-11-21T00:00:00Z")).length, 0);
    const text = forestText(items[0], {live: {}, replay: {a: "a {animal}", an: "an {animal}"}} as never);
    assert.match(String(text), /Sun Bear died: its forest was cut down/);
});

test("pin: forestry.ts and forest-stands.json are the server's (AnimalDex _shared/ark-positions), byte for byte", async () => {
    const {createHash} = await import("node:crypto");
    const {readFileSync} = await import("node:fs");
    const pin = JSON.parse(readFileSync("src/ark-scene/positions/PIN.json", "utf8")) as {forestry: {sha256: Record<string, string>}};
    for (const [name, sha] of Object.entries(pin.forestry.sha256)) assert.equal(createHash("sha256").update(readFileSync(`src/ark-scene/positions/${name}`)).digest("hex"), sha, `${name} changed: re-pin in both repos`);
});

test("drawn trees: felled, hauled, sapling in its own place; a tree an animal lives in is left standing", async () => {
    const {Matrix4, Vector3, Quaternion} = await import("three");
    const {ForestTrees} = await import("@/ark-scene/forestry/forest-trees");
    const {g, trees} = treesOf(0);
    const built = trees.map((t) => ({x: t.x, y: 3, z: t.z, scale: 2, height: 20, radius: 4, matrix: new Matrix4().compose(new Vector3(t.x, 3, t.z), new Quaternion(), new Vector3(2, 2, 2))}));
    // An animal perched 2 m from the first tree's trunk: inside its crown.
    const forest = new ForestTrees(table, FROM, () => [{x: built[0].x + 2, z: built[0].z}]);
    assert.equal(forest.setDay(g.start + 0.5), true);
    const override = forest.override();
    const marked = built.map((t) => override.covers(t));
    // Kept: exactly the trees whose crown (4 m, and half a metre over) holds the perch.
    const holds = built.map((t) => Math.hypot(t.x - (built[0].x + 2), t.z - built[0].z) <= 4.5);
    assert.equal(marked[0], false, "the perch tree is felled");
    assert.deepEqual(marked, holds.map((h) => !h));
    assert.equal(forest.retained, holds.filter(Boolean).length);
    assert.equal(forest.standTrees(g).length, holds.filter((h) => !h).length);
    const into = new Matrix4();
    const pos = new Vector3(), quat = new Quaternion(), scl = new Vector3();
    for (const t of built.filter((_, i) => !holds[i])) {
        const cut = cutDay(g, t.x, t.z);
        forest.setDay(cut - 0.001);
        assert.equal(override.matrix(t, into), t.matrix, "standing: as built");
        forest.setDay(cut + 0.1);
        const lying = override.matrix(t, into)!;
        lying.decompose(pos, quat, scl);
        // Lying: its up axis nearly level, its foot where it stood.
        assert.ok(Math.abs(new Vector3(0, 1, 0).applyQuaternion(quat).y) < 0.1);
        assert.ok(Math.hypot(pos.x - t.x, pos.z - t.z) < 1e-6);
        forest.setDay(g.start + 2);
        assert.equal(override.matrix(t, into), null, "hauled away: a stump only");
        forest.setDay(g.start + 4 + 1 + 18);
        override.matrix(t, into)!.decompose(pos, quat, scl);
        assert.ok(Math.hypot(pos.x - t.x, pos.z - t.z) < 1e-6 && scl.x > 0.9 && scl.x < 1.2, `a half-grown tree in its place (${scl.x})`);
        forest.setDay(g.start + REUSE_DAYS - 0.01);
        override.matrix(t, into)!.decompose(pos, quat, scl);
        assert.ok(Math.abs(scl.x - 2) < 1e-6, "grown: the tree as built");
    }
    // Past the cycle the stand is out of play: every tree as built again.
    assert.equal(forest.setDay(g.start + REUSE_DAYS + 0.01), true);
    assert.equal(forest.active.some((l) => l.k === g.k), false);
});
