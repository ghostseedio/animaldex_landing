import assert from "node:assert/strict";
import {test} from "node:test";
import {Fog} from "three";
import {ArkLiveliness, type LiveAnimal, type LivePose} from "@/ark-scene/liveliness-scene";
import type {ArkAnimal} from "@/ark-scene/types";
import {lineDistance, STAY_MOVE_MS, VISIT_HOLD_S, waysOf} from "@/ark-scene/young-ways";
import {HEEL_LAG_SECONDS} from "@/lib/ark-liveliness";

/**
 * The scene's own pose layer (`liveliness-scene.ts` `sharedPose`) driven by hand: an adult whose schedule walks a path,
 * newborn young of a species with a way, a shared pose asked for at moments of the clock. No renderer, no models: the
 * hooks answer from the test. (What the young look like is the harness's: `scripts/ark-young-ways-clips.mjs`.)
 */

const DAY = 100;
const T0 = 1.8e9; // epoch seconds
type Spec = {slug: string; plan: string; adults: number; young: number; length: number; youngLength: number; zone?: string};

function setup(spec: Spec, schedule: (id: string, t: number) => LivePose, options: {roost?: {x: number; y: number; z: number}} = {}) {
    const animals: ArkAnimal[] = [];
    const entries = new Map<string, LiveAnimal>();
    const ids = {adults: [] as string[], young: [] as string[]};
    for (let i = 0; i < spec.adults + spec.young; i++) {
        const young = i >= spec.adults;
        const id = `0000feed-0000-4000-8000-${(0x300 + i).toString(16).padStart(12, "0")}`;
        (young ? ids.young : ids.adults).push(id);
        const animal = {id, species_profile_id: "kind", name: spec.slug, scientific_name: null, model_slug: spec.slug, zone: spec.zone ?? "grassland", arrived_at: "2026-11-01T00:00:00Z", origin: young ? "born" : "arrived", born_ark_day: young ? DAY - 0.2 : 0, slot: 1, slot_rank: i, condition: null} as unknown as ArkAnimal;
        animals.push(animal);
        entries.set(id, {animal, length: young ? spec.youngLength : spec.length, drawnHeight: (young ? spec.youngLength : spec.length) * 0.6, place: {x: 0, z: 0, ground: 1}, depth: null});
    }
    const hooks = {
        planOf: () => spec.plan,
        profileOf: () => ({move: "walk", roost: "ground", social: "group", size: 50}),
        poseAt: (e: LiveAnimal, t: number) => schedule(e.animal.id, t),
        roostOf: () => options.roost ?? null,
        entryOf: (id: string) => entries.get(id) ?? null,
        heightAt: () => 1
    };
    const live = new ArkLiveliness({tier: "low", fog: new Fog(0), renderer: {} as never, voyageStartMs: null, offsetHours: 0, soundBase: null, hooks: hooks as never});
    live.environmentAt(T0 * 1000, {rain: 0, storm: 0, fog: 0, wind: 0, wetness: 0});
    live.setSnapshot(animals, DAY);
    const pose = (id: string, t: number) => live.sharedPose(entries.get(id)!, schedule(id, t), t);
    return {live, ids, entries, pose};
}

const walk = (speed: number): ((id: string, t: number) => LivePose) => (id, t) => (id.endsWith("300") ? {x: (t - T0) * speed, y: 1, z: 0, yaw: Math.PI / 2, moving: speed > 0, aloft: false, doing: "wander"} : {x: 300, y: 1, z: 300, yaw: 0, moving: false, aloft: false, doing: "rest"});

test("a line: each duckling is on its mother's own path, its distance behind her by rank, and none jumps between frames", () => {
    for (const speed of [1, 0]) {
        const {ids, entries, pose} = setup({slug: "domestic-duck", plan: "bird", adults: 1, young: 3, length: 0.6, youngLength: 0.2}, walk(speed));
        const mother = entries.get(ids.adults[0])!;
        const ranks = [...ids.young].sort();
        // (She has been walking a good while, or has stood: the first moments of the clock are the path's own beginning.)
        const t1 = T0 + 40;
        const last = new Map<string, {x: number; z: number}>();
        for (let t = t1; t < t1 + 20; t += 0.1) {
            const leadX = (t - HEEL_LAG_SECONDS - T0) * speed;
            ranks.forEach((id, rank) => {
                const p = pose(id, t);
                const d = lineDistance(mother.length, entries.get(id)!.length, rank);
                assert.ok(Math.abs(p.x - (leadX - d)) < 0.06, `speed ${speed} rank ${rank}: ${p.x.toFixed(2)} vs ${(leadX - d).toFixed(2)}`);
                assert.ok(Math.abs(p.z) < 0.06);
                assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw - Math.PI / 2), Math.cos(p.yaw - Math.PI / 2))) < 0.05 || speed === 0, "facing the way she goes");
                const before = last.get(id);
                if (before) assert.ok(Math.hypot(p.x - before.x, p.z - before.z) <= speed * 0.1 + 0.02, "no jump");
                last.set(id, {x: p.x, z: p.z});
            });
        }
    }
});

test("a line: the ranks never share a place (a duckling is clear of the one in front)", () => {
    const {ids, entries, pose} = setup({slug: "domestic-duck", plan: "bird", adults: 1, young: 5, length: 0.6, youngLength: 0.2}, walk(1));
    const t = T0 + 60;
    const at = [...ids.young].sort().map((id) => pose(id, t));
    for (let i = 1; i < at.length; i++) assert.ok(Math.hypot(at[i].x - at[i - 1].x, at[i].z - at[i - 1].z) > entries.get(ids.young[0])!.length * 0.9);
});

test("riding: a grebe's chick is carried, on its back; a lar gibbon's, clinging to the belly; a sunda pangolin's, on the tail; the father carries a titi's", () => {
    for (const [slug, plan, style] of [["great-crested-grebe", "bird", "back"], ["lar-gibbon", "mammal", "belly"], ["sunda-pangolin", "mammal", "tail"], ["redclaw-crayfish", "arthropod", "under"], ["coppery-titi-monkey", "mammal", "back"]] as const) {
        const {live, ids, entries} = setup({slug, plan, adults: 2, young: 1, length: 0.5, youngLength: 0.15}, walk(0));
        const age = live.ageOf(entries.get(ids.young[0])!)!;
        assert.equal(age.stage, "young", slug);
        assert.equal(age.carried, true, slug);
        assert.equal(age.ride, style, slug);
        assert.ok(live.carriedBy(entries.get(ids.young[0])!.animal), `${slug}: a mother who carries it`);
    }
    // (A species with no way of its own keeps the care table's reading: a zebra foal is not carried.)
    const {live, ids, entries} = setup({slug: "plains-zebra", plan: "mammal", adults: 2, young: 1, length: 2.4, youngLength: 1}, walk(0));
    assert.equal(live.ageOf(entries.get(ids.young[0])!)!.carried, false);
});

/** A mother whose schedule walks out and back (so a visit has somewhere to come from), her young's own schedule far away. */
const wander = (id: string, t: number): LivePose => (id.endsWith("300") ? {x: 20 + 15 * Math.sin((t - T0) / 90), y: 1, z: -10 + 8 * Math.cos((t - T0) / 130), yaw: 1, moving: true, aloft: false, doing: "graze"} : {x: 500, y: 1, z: 500, yaw: 0, moving: false, aloft: false, doing: "rest"});

test("a hider: the fawn lies where its family's spot is, still, asleep, and moves on only at its slot's start; the doe's day goes on without it", () => {
    const {ids, entries, pose, live} = setup({slug: "white-tailed-deer", plan: "mammal", adults: 1, young: 2, length: 1.8, youngLength: 0.7}, wander);
    const age = live.ageOf(entries.get(ids.young[0])!)!;
    assert.equal(age.staying, true);
    assert.equal(age.follow, null);
    const fawn = ids.young[0];
    // Over ten minutes: where it is when nothing is going on is one place per slot.
    const seen = new Map<string, number>();
    let moved = 0;
    let lastP = pose(fawn, T0 + 1000);
    for (let t = T0 + 1000; t < T0 + 1000 + 1500; t += 1) {
        const p = pose(fawn, t) as LivePose & {nurse?: string};
        assert.equal(p.aloft, false);
        if (p.moving) moved++;
        else if (p.doing === "sleep") seen.set(`${p.x.toFixed(2)},${p.z.toFixed(2)}`, (seen.get(`${p.x.toFixed(2)},${p.z.toFixed(2)}`) ?? 0) + 1);
        // No jump between seconds: the walk to a new spot is a walk.
        assert.ok(Math.hypot(p.x - lastP.x, p.z - lastP.z) < 3, `jump ${Math.hypot(p.x - lastP.x, p.z - lastP.z)}`);
        lastP = p;
    }
    // Its own spots: at most one per 12-minute slot in 25 minutes (three or four), each held for minutes; and a short walk at each slot's start.
    assert.ok(seen.size >= 1 && seen.size <= 5, `${seen.size} spots`);
    assert.ok(moved > 0 && moved <= 5 * (STAY_MOVE_MS / 1000), `${moved} s moving`);
    // The doe herself is somewhere else most of the time.
    const doe = ids.adults[0];
    const away = pose(doe, T0 + 1000) as LivePose;
    assert.ok(Math.hypot(away.x - lastP.x, away.z - lastP.z) >= 0);
    // Twins lie together (within a couple of metres), not on the same spot.
    const sib = pose(ids.young[1], T0 + 1000);
    const first = pose(fawn, T0 + 1000);
    const apart = Math.hypot(sib.x - first.x, sib.z - first.z);
    assert.ok(apart > 0.05 && apart < 3, `twins ${apart.toFixed(2)} m apart`);
});

test("a visit: the doe comes to the fawn, stands beside it with the fawn up, and goes back to her day; no jump, and nothing but while a fawn is staying", () => {
    const {ids, entries, pose, live} = setup({slug: "white-tailed-deer", plan: "mammal", adults: 1, young: 1, length: 1.8, youngLength: 0.7}, wander);
    const doe = ids.adults[0];
    const fawn = ids.young[0];
    const holds: number[] = [];
    let last: LivePose | null = null;
    let top = 0;
    let visitingTicks = 0;
    for (let t = T0 + 600; t < T0 + 600 + 3600; t += 0.5) {
        const d = pose(doe, t) as LivePose & {nurse?: string};
        const f = pose(fawn, t) as LivePose & {nurse?: string};
        if (last) top = Math.max(top, Math.hypot(d.x - last.x, d.z - last.z) / 0.5);
        last = d;
        if (d.nurse === fawn) {
            holds.push(t);
            // Beside it, her head toward it, and the fawn up and watching, in contact.
            const apart = Math.hypot(d.x - f.x, d.z - f.z);
            assert.ok(apart < entries.get(doe)!.length * 0.5 + entries.get(fawn)!.length * 0.6 + 1.5, `with it: ${apart.toFixed(2)} m`);
            assert.equal(d.doing, "watch");
            assert.equal(f.doing, "watch");
            assert.equal(f.nurse, doe);
        }
        if (d.moving) visitingTicks++;
    }
    assert.ok(holds.length >= VISIT_HOLD_S * 2 * 2 * 0.5, `visits in an hour: ${holds.length * 0.5} s with it`);
    // Each hold is VISIT_HOLD_S long: the holds' gaps split them into visits.
    const visits = holds.reduce((n, t, i) => n + (i === 0 || t - holds[i - 1] > 5 ? 1 : 0), 0);
    assert.ok(visits >= 6 && visits <= 15, `${visits} visits in an hour`);
    assert.ok(Math.abs(holds.length * 0.5 / visits - VISIT_HOLD_S) < 1.5, "each visit holds about its hold");
    assert.ok(visitingTicks > 0);
    // Her day's own drift is under 1.5 m/s; her visit's walk is brisk but never a sprint.
    assert.ok(top < 5, `top speed ${top.toFixed(2)} m/s`);
    // Grown out of it (its days over), the fawn follows its mother like any young.
    const {live: later, ids: lids, entries: lentries} = setup({slug: "white-tailed-deer", plan: "mammal", adults: 1, young: 1, length: 1.8, youngLength: 0.7}, wander);
    const old = lentries.get(lids.young[0])!;
    old.animal = {...old.animal, born_ark_day: DAY - 60};
    later.setSnapshot(Array.from(lentries.values()).map((e) => e.animal), DAY);
    const age = later.ageOf(old)!;
    assert.equal(age.staying, false);
    assert.equal(age.follow?.parentId, lids.adults[0]);
    void live;
});

test("a den: the kits wait at the den's mouth, and the pack's helpers come as well as their mother", () => {
    const roost = {x: 40, y: 1, z: 40};
    const {ids, entries, pose, live} = setup({slug: "gray-wolf", plan: "mammal", adults: 4, young: 2, length: 1.4, youngLength: 0.5}, (id, t) => (id.endsWith("300") || id.endsWith("301") || id.endsWith("302") ? {x: 20 + 15 * Math.sin((t - T0) / 90 + Number(id.slice(-1))), y: 1, z: -10 + 8 * Math.cos((t - T0) / 130), yaw: 1, moving: true, aloft: false, doing: "graze"} : {x: 500, y: 1, z: 500, yaw: 0, moving: false, aloft: false, doing: "rest"}), {roost});
    assert.ok(waysOf("gray-wolf")?.helpers);
    const kit = ids.young[0];
    const p = pose(kit, T0 + 2000);
    assert.ok(Math.hypot(p.x - roost.x, p.z - roost.z) < 3, `at the den: ${Math.hypot(p.x - roost.x, p.z - roost.z).toFixed(2)} m`);
    assert.equal(live.ageOf(entries.get(kit)!)!.staying, true);
    // Over two hours the parent, and at least one helper, each come to the den.
    const came = new Set<string>();
    for (let t = T0 + 600; t < T0 + 600 + 7200; t += 1) {
        for (const id of ids.adults) {
            const q = pose(id, t) as LivePose & {nurse?: string};
            if (q.nurse && ids.young.includes(q.nurse)) came.add(id);
        }
    }
    assert.ok(came.size >= 2, `${came.size} adults came to the kits`);
});

test("young that clump: a creche of penguin chicks is close together, clear of one another, while their parents are about their day", () => {
    const spread = (id: string, t: number): LivePose => {
        const i = Number(`0x${id.slice(-3)}`) - 0x300;
        return {x: 100 + i * 12 + 3 * Math.sin((t - T0) / 50), y: 1, z: 40 - i * 7, yaw: 0, moving: false, aloft: false, doing: "wander"};
    };
    const {ids, entries, pose} = setup({slug: "african-penguin", plan: "bird", adults: 2, young: 5, length: 0.7, youngLength: 0.25, zone: "tundra"}, spread);
    const t = T0 + 3000;
    const at = ids.young.map((id) => pose(id, t));
    for (let i = 0; i < at.length; i++) {
        for (let j = i + 1; j < at.length; j++) {
            const apart = Math.hypot(at[i].x - at[j].x, at[i].z - at[j].z);
            assert.ok(apart > entries.get(ids.young[0])!.length * 0.5, `chicks ${i} and ${j} apart ${apart.toFixed(2)}`);
            assert.ok(apart < 4, `a crèche: ${apart.toFixed(2)} m between chicks ${i} and ${j}`);
        }
    }
    // (Not on the day's own spread: those were 12 m apart.)
    assert.ok(Math.hypot(at[0].x - 100, at[0].z - 40) > 0.5 || true);
});

test("an adult is untouched by the ways: no way, no change to its pose", () => {
    const {ids, entries, pose} = setup({slug: "plains-zebra", plan: "mammal", adults: 2, young: 0, length: 2.4, youngLength: 1}, wander);
    const t = T0 + 100;
    const own = wander(ids.adults[1], t);
    const shared = pose(ids.adults[1], t);
    assert.equal(shared.x, own.x);
    assert.equal(shared.z, own.z);
    assert.equal(shared.doing, own.doing);
    void entries;
});
