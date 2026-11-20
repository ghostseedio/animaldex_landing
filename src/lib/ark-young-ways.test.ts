import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {test} from "node:test";
import animalLook from "@/ark-scene/animal-look.json";
import rowsFile from "../../data/ark/young-ways-rows.json";
import {
    clumpSpot,
    fatherAmong,
    familyClock,
    familySpot,
    HELPER_CHANCE,
    inVisitHours,
    lineBehind,
    lineDistance,
    moveBlend,
    PARENT_CHANCE,
    siblingOffset,
    stayDaysOf,
    STAY_MOVE_MS,
    STAY_SLOT_MS,
    visitMotion,
    visitPlace,
    visitPlan,
    visitState,
    VISIT_HOLD_S,
    VISIT_SLOT_MS,
    VISIT_WINDOW_S,
    waysOf,
    waysSlugs,
    type Pt
} from "@/ark-scene/young-ways";
import {ageOf, speciesCare} from "@/lib/ark-age";

const slugs = new Set(Object.keys((animalLook as unknown as {species: Record<string, unknown>}).species));
const table = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/ark-scene/young-ways.json"), "utf8")) as {species: Record<string, {name: string; ways: Record<string, unknown>; lines: Record<string, string>}>};
const slugOf = (name: string) => name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

test("every species with a way has a model, a sourced row (id, behaviour, quote) and a line for each way its row says", () => {
    assert.ok(waysSlugs().length >= 90);
    for (const [slug, row] of Object.entries(table.species)) {
        assert.ok(slugs.has(slug), `${slug}: no model`);
        // (Its sourced rows, with the quotes of its own stored text, are in the rows file.)
        const sources = rowsFile.rows.filter((r) => (r.status === "built" || r.status === "part") && slugOf(r.name) === slug);
        assert.ok(sources.length >= 1, `${slug}: no source row`);
        for (const r of sources) {
            assert.match(r.id, /^[0-9a-f-]{36}$/);
            assert.ok(r.behaviour.length > 5 && r.quote.length > 5, `${slug}: the row's words`);
        }
        for (const [way, line] of Object.entries(row.lines)) {
            assert.ok(["ride", "line", "stay", "visit", "cluster"].includes(way), `${slug}: way ${way}`);
            assert.match(line, /^\{(aAnimal|animals)\}/, `${slug}: ${way} line`);
        }
        const keys = Object.keys(row.ways);
        assert.ok(keys.some((k) => ["ride", "line", "stay", "cluster"].includes(k)), `${slug}: no way`);
    }
});

test("every young-care row of the catalogue is accounted for: built, an earlier pass's, the eggs', or held with its reason", () => {
    const counts: Record<string, number> = {};
    for (const r of rowsFile.rows) {
        assert.ok(["built", "part", "already", "eggs", "held"].includes(r.status), r.status);
        assert.ok(r.what.length > 3);
        counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    assert.equal(rowsFile.rows.length, 236);
    assert.deepEqual(counts, rowsFile.counts);
    assert.equal(new Set(rowsFile.rows.map((r) => `${r.id}|${r.behaviour}`)).size, 236, "no row twice");
    // A built row belongs to a species that has the way in the scene's table.
    const bySlug = new Set(waysSlugs());
    for (const r of rowsFile.rows.filter((x) => x.status === "built" || x.status === "part")) {
        const slug = slugOf(r.name);
        assert.ok(bySlug.has(slug), `${r.name}: built but not in the table`);
    }
});

test("the species' own text decides the care: carried (a grebe's chicks), led in a line (ducklings), kept at a spot (a fawn)", () => {
    assert.equal(speciesCare("great-crested-grebe", "bird").kind, "carry");
    assert.equal(speciesCare("great-crested-grebe", "bird").ways?.ride, "back");
    assert.equal(speciesCare("domestic-duck", "bird").ways?.line, true);
    // (A hider keeps the care table's kind: the births' style reads it, and it is the table's reading of the species' notes, not ours.)
    assert.equal(speciesCare("chital", "mammal").kind, "follow");
    assert.equal(speciesCare("white-tailed-deer", "mammal").ways?.stay, "hide");
    assert.equal(speciesCare("red-fox", "mammal").ways?.stay, "den");
    // (No ways: the care table's own reading stands.)
    assert.equal(speciesCare("plains-zebra", "mammal").ways ?? null, null);
    assert.equal(waysOf("plains-zebra"), null);
    assert.equal(waysOf(null), null);
});

const newborn = (id: string, day: number, born: number) => ({id, origin: "born" as const, born_ark_day: born, parents: ["mum"], condition: null, status: "present"}) as Parameters<typeof ageOf>[0] & {status: string};

test("a newborn carrying species is carried the way its text says; a hider stays at its spot, then follows its mother", () => {
    const grebe = ageOf(newborn("a", 100, 99.9), 100, "bird", speciesCare("great-crested-grebe", "bird"));
    assert.equal(grebe.stage, "young");
    assert.equal(grebe.carried, true);
    assert.equal(grebe.ride, "back");
    const hiderCare = speciesCare("white-tailed-deer", "mammal");
    const days = stayDaysOf(waysOf("white-tailed-deer")!, hiderCare.independentDays ?? 150);
    const fawn = ageOf(newborn("b", 100, 99.9), 100, "mammal", hiderCare);
    assert.equal(fawn.staying, true);
    assert.equal(fawn.atHome, true);
    assert.equal(fawn.follow, null);
    const grown = ageOf(newborn("b", 100, 100 - days - 5), 100, "mammal", hiderCare);
    assert.equal(grown.staying, false, "after its days it keeps to its mother's heel");
    assert.equal(grown.follow?.parentId, "mum");
    const duck = ageOf(newborn("c", 100, 99.9), 100, "bird", speciesCare("domestic-duck", "bird"));
    assert.equal(duck.line, true);
    assert.equal(duck.follow?.parentId, "mum");
    // An adult of the same kinds is nothing special.
    const adult = ageOf({id: "d", origin: "arrived", born_ark_day: null, parents: null, condition: null, status: "present"} as Parameters<typeof ageOf>[0], 100, "bird", speciesCare("great-crested-grebe", "bird"));
    assert.equal(adult.carried, false);
    assert.equal(adult.staying, false);
});

const along = (n: number, step: number): Pt[] => Array.from({length: n}, (_, i) => ({x: 0, z: 10 - i * step}));

test("a line: followers sit on the leader's own path at their distance, in order, and a standing leader queues them straight behind her heading", () => {
    // She walks +z; the trail is newest first, 0.5 m apart.
    const trail = along(24, 0.5);
    const a = lineBehind(trail, 2, 0);
    const b = lineBehind(trail, 5, 0);
    assert.ok(Math.abs(a.z - 8) < 1e-9 && Math.abs(a.x) < 1e-9);
    assert.ok(Math.abs(b.z - 5) < 1e-9);
    assert.ok(Math.abs(a.yaw) < 1e-9, "facing the way she walks");
    // Standing: the trail is one place; the queue goes straight back from her heading.
    const still = Array.from({length: 24}, () => ({x: 3, z: 4}));
    const q = lineBehind(still, 3, Math.PI / 2);
    assert.ok(Math.abs(q.x - 0) < 1e-9 && Math.abs(q.z - 4) < 1e-9, "she faces +x, so behind her is -x");
    // Beyond the path's end it carries on straight back along the last stretch.
    const far = lineBehind(trail, 30, 0);
    assert.ok(far.z < trail[trail.length - 1].z && Math.abs(far.x) < 1e-9);
    // Continuity: the leader takes a step, and every follower's place moves by about that step, no more.
    for (const behind of [1, 3, 6, 9]) {
        const now = lineBehind(trail, behind, 0);
        const later = lineBehind([{x: 0, z: 10.2}, ...trail], behind, 0);
        assert.ok(Math.hypot(later.x - now.x, later.z - now.z) <= 0.2 + 1e-9);
    }
    // The ranks are spaced by the young one's own length and never touch.
    assert.ok(lineDistance(1, 0.3, 1) > lineDistance(1, 0.3, 0) + 0.3);
    assert.ok(lineDistance(1, 0.3, 0) >= 0.5 + 0.27);
});

test("the family's clock: the stay slot is three visit slots on one offset, and moving on is a short walk that ends at the new spot", () => {
    assert.equal(STAY_SLOT_MS, 3 * VISIT_SLOT_MS);
    const key = "0000feed-0000-4000-8000-000000000001";
    for (let ms = 1e12; ms < 1e12 + 3 * STAY_SLOT_MS; ms += 37_000) {
        const c = familyClock(key, ms);
        assert.ok(c.stayStart <= ms && ms < c.stayStart + STAY_SLOT_MS);
        assert.ok(c.visitStart <= ms && ms < c.visitStart + VISIT_SLOT_MS);
        assert.equal((c.visitStart - c.offset) % VISIT_SLOT_MS, 0);
        assert.deepEqual(familyClock(key, ms), c);
    }
    const prev: Pt = {x: 0, z: 0};
    const next: Pt = {x: 10, z: 4};
    const first = moveBlend(prev, next, 0);
    assert.deepEqual([first.x, first.z], [0, 0]);
    const mid = moveBlend(prev, next, STAY_MOVE_MS / 2);
    assert.equal(mid.moving, true);
    assert.ok(Math.abs(mid.yaw! - Math.atan2(10, 4)) < 1e-9);
    const last = moveBlend(prev, next, STAY_MOVE_MS);
    assert.deepEqual([last.x, last.z, last.moving, last.yaw], [10, 4, false, null]);
    assert.equal(moveBlend(next, next, 100).moving, false, "no walk to where it already is");
});

test("a visit: planned from ids and the clock, inside its slot and its window, out and back with the hold between, the same on every call", () => {
    const visitor = "0000feed-0000-4000-8000-000000000002";
    const family = "0000feed-0000-4000-8000-000000000001";
    let parentVisits = 0;
    let helperVisits = 0;
    let slots = 0;
    for (let ms = 1.8e12; ms < 1.8e12 + 3000 * VISIT_SLOT_MS; ms += VISIT_SLOT_MS) {
        slots++;
        const p = visitPlan(visitor, family, ms, PARENT_CHANCE);
        const h = visitPlan(visitor, family, ms, HELPER_CHANCE);
        assert.deepEqual(visitPlan(visitor, family, ms, PARENT_CHANCE), p);
        if (h) helperVisits++;
        if (!p) continue;
        parentVisits++;
        const clock = familyClock(family, ms);
        assert.ok(p.start >= clock.visitStart + STAY_MOVE_MS, "never in the young one's move to its new spot");
        assert.ok(p.end <= clock.visitStart + VISIT_SLOT_MS + 1, "inside its own slot");
        assert.equal(p.end - p.start, VISIT_WINDOW_S * 1000);
        // Walk: eased level 0→1, hold 1, back 1→0, nothing outside.
        const go = 11;
        assert.equal(visitState(p, p.start - 1, go), null);
        assert.equal(visitState(p, p.start + 1, go)!.phase, "go");
        const levels: number[] = [];
        for (let s = 0; s < 2 * go + VISIT_HOLD_S; s += 0.5) {
            const st = visitState(p, p.start + s * 1000, go);
            assert.ok(st !== null && st.level >= 0 && st.level <= 1);
            levels.push(st!.level);
            if (s >= go && s < go + VISIT_HOLD_S) assert.equal(st!.phase, "hold");
        }
        assert.ok(levels[0] < 0.01 && Math.max(...levels) === 1);
        assert.equal(visitState(p, p.start + (2 * go + VISIT_HOLD_S) * 1000 + 1, go), null);
        // Her walk is kept inside the window: a far family is a faster walk, never a longer one.
        assert.ok(visitState(p, p.start + (VISIT_WINDOW_S - 1) * 1000, 500) !== null, "a walk longer than the window is held to it: it ends with the window");
        assert.equal(visitState(p, p.start + VISIT_WINDOW_S * 1000 + 1, 500), null);
    }
    assert.ok(Math.abs(parentVisits / slots - PARENT_CHANCE) < 0.05, `parent visits ${parentVisits / slots}`);
    assert.ok(Math.abs(helperVisits / slots - HELPER_CHANCE) < 0.05, `helper visits ${helperVisits / slots}`);
});

test("visiting hours: any hour, or only round dawn and dusk (the cottontail doe)", () => {
    for (const h of [0, 6, 12, 18, 23.5]) assert.equal(inVisitHours(h, undefined), true);
    assert.equal(inVisitHours(6, "dawn_dusk"), true);
    assert.equal(inVisitHours(18, "dawn_dusk"), true);
    assert.equal(inVisitHours(12, "dawn_dusk"), false);
    assert.equal(inVisitHours(2, "dawn_dusk"), false);
});

test("where the young lie and where she stands: near the parent, apart from one another, her head to the young, the same every time", () => {
    const anchor: Pt = {x: 20, z: -8};
    const spots = new Set<string>();
    for (let slot = 0; slot < 40; slot++) {
        const s = familySpot("fam", slot, anchor, 1.8);
        const d = Math.hypot(s.x - anchor.x, s.z - anchor.z);
        assert.ok(d >= 2 + 1.8 * 0.8 - 1e-9 && d <= 2 + 1.8 * 2.2 + 1e-9);
        assert.deepEqual(familySpot("fam", slot, anchor, 1.8), s);
        spots.add(`${s.x.toFixed(2)},${s.z.toFixed(2)}`);
    }
    assert.ok(spots.size > 30, "a new spot each slot");
    const spot: Pt = {x: 5, z: 5};
    const place = visitPlace("mum", spot, 1.6, 0.6);
    const reach = Math.hypot(place.x - spot.x, place.z - spot.z);
    assert.ok(Math.abs(reach - (0.8 + 0.36)) < 1e-9);
    assert.ok(Math.abs(Math.atan2(spot.x - place.x, spot.z - place.z) - place.yaw) < 1e-9, "her head is toward the young");
    for (const id of ["x", "y", "z"]) {
        const o = siblingOffset(id, 0.5);
        assert.ok(Math.hypot(o.x, o.z) <= 0.5 * 1.4 + 1e-9);
    }
});

test("a clump: every young one clear of the others, none farther than its pack allows", () => {
    const centre: Pt = {x: 1, z: 2};
    const L = 0.1;
    const spots = Array.from({length: 12}, (_, i) => clumpSpot(centre, i, 12, L));
    for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) assert.ok(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z) > L * 0.5, `${i} and ${j} apart`);
        assert.ok(Math.hypot(spots[i].x - centre.x, spots[i].z - centre.z) <= L * 0.85 * Math.sqrt(12.6) + 1e-9);
    }
});

test("the father: the recorded parent drawn male and still aboard, else none (the mother's pick stands)", () => {
    const male = (id: string) => ({sire: true, dam: false, who: null}[id as "sire" | "dam" | "who"]);
    assert.equal(fatherAmong(["dam", "sire"], male), "sire");
    assert.equal(fatherAmong(["dam", "who"], male), null);
    assert.equal(fatherAmong(["dam", "sire"], male, (id) => id !== "sire"), null);
});

test("a visit's motion: from where she set off, to the young, and back to where her own day has her, no jump anywhere and no faster than her walk", () => {
    const plan = visitPlan("0000feed-0000-4000-8000-000000000002", "0000feed-0000-4000-8000-000000000001", 1.8e12, 1)!;
    const anchor: Pt = {x: 0, z: 0};
    const place: Pt = {x: 30, z: 40};
    // Her own day's place moves on while she is away.
    const sched = (ms: number): Pt => ({x: 10 + (ms - plan.start) * 0.0004, z: -20 + (ms - plan.start) * 0.0006});
    for (const flies of [false, true]) {
        const go = 20;
        let last: ReturnType<typeof visitMotion> | null = null;
        let lastAt = 0;
        let top = 0;
        for (let ms = plan.start; ms < plan.start + (2 * go + VISIT_HOLD_S) * 1000; ms += 100) {
            const state = visitState(plan, ms, go)!;
            const m = visitMotion(state, anchor, place, sched(ms), flies);
            if (last) {
                // (She and her own day's place both move: the step is her walk plus that.)
                const step = Math.hypot(m.x - last.x, m.z - last.z) / ((ms - lastAt) / 1000);
                top = Math.max(top, step);
            }
            if (state.phase === "hold") {
                assert.equal(m.moving, false);
                assert.ok(Math.hypot(m.x - place.x, m.z - place.z) < 1e-9, "with the young");
                assert.equal(m.lift, 0);
            }
            if (!flies) assert.equal(m.lift, 0);
            last = m;
            lastAt = ms;
        }
        const first = visitMotion(visitState(plan, plan.start + 1, go)!, anchor, place, sched(plan.start), flies);
        assert.ok(Math.hypot(first.x - anchor.x, first.z - anchor.z) < 0.01, "she sets out from where she was");
        const endMs = plan.start + (2 * go + VISIT_HOLD_S) * 1000 - 1;
        const end = visitMotion(visitState(plan, endMs, go)!, anchor, place, sched(endMs), flies);
        const day = sched(endMs);
        assert.ok(Math.hypot(end.x - day.x, end.z - day.z) < 0.01, "and ends where her own day has her");
        // 50 m out in 20 s is 2.5 m/s; her day's drift is under 1 m/s: nothing quicker than the walk and the drift together.
        assert.ok(top < 2.5 * 1.6 + 1, `top speed ${top}`);
    }
});

test("the rows said to be shown by the primates' earlier belly-then-back carry really are: their care is carry", () => {
    const rows = rowsFile.rows.filter((r) => r.status === "already" && /ride/.test(r.what));
    assert.ok(rows.length >= 10);
    for (const r of rows) assert.equal(speciesCare(slugOf(r.name), "mammal").kind, "carry", r.name);
});
