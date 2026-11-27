/**
 * PERF-WEB audit (drag lane, 2026-11-27), untracked helper: what one schedule invalidation costs.
 *
 * Every `setSnapshot` in the scene ends in `wireSchedules` -> spacing -> apply, which sets every drawn animal's trip to
 * null, `warm = false`, and calls `forgetSchedules()` (all memos, all roosts). This rig builds the zoo residents exactly
 * as `scripts/ark-paddock-overlap.ts` does (same placement, colliders, beds, groups, mates), runs them warm at 60 fps,
 * then forgets and measures:
 *   - steady ms a frame (all residents' tripAt, warm);
 *   - the "all at once" cold frame right after a forget (what a recording or the paddock sim's worst frame sees);
 *   - the scene's own gate (index.ts ~6779: first steps until the frame's schedule time passes WARM_MS = 6 ms, the
 *     rest held): frames until all are warm again, ms a frame meanwhile, the costliest single first step.
 * Output only; nothing written.
 *
 *   npx tsx scripts/.audit-drag-forget.mts --snapshot <voyage.json> [--world v2] [--warm 60] [--forgets 3]
 */
import {readFileSync} from "node:fs";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {maskBox, penKeep, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {townWorldOrigin} from "@/ark-scene/islands";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetSchedules, poseOnTrip, scheduleWorld, tripAt, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {displayLength} from "@/ark-scene/sizes";
import {collideBlocked, collideSegmentClear, setIslandColliders} from "@/ark-scene/collide";
import {setRecipeColliders} from "@/ark-scene/behaviour-recipes";
import {townZooBeds} from "@/ark-scene/islands/town/zoo-beds";
import {groupLives} from "@/ark-scene/behaviour-group";
import {setArkWorld} from "@/ark-scene/world";

const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
if (!snapshot) throw new Error("no snapshot");
if (arg("world", "v2") === "v2") setArkWorld("v2");
const fps = 60;
const warmSeconds = Number(arg("warm", "60"));
const forgets = Number(arg("forgets", "3"));
const from = Number(arg("from", "1796032800"));
const WARM_MS = 6;

const origin = townWorldOrigin();
const town = arkIslandSnapshot(snapshot, "town");
const placed = placeTownAnimals(town.animals);
const set = townColliderSet(placed.open, origin);
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
for (const c of set.list) {
    x0 = Math.min(x0, c.cx - c.reach);
    x1 = Math.max(x1, c.cx + c.reach);
    z0 = Math.min(z0, c.cz - c.reach);
    z1 = Math.max(z1, c.cz + c.reach);
}
setIslandColliders({contains: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1, set});
setRecipeColliders({segmentClear: collideSegmentClear, blocked: (x, z, r) => collideBlocked(x, z, r)});
const tBuild = performance.now();
const world = scheduleWorld(townWorldSampler(placed.open, origin, set));
const buildMs = performance.now() - tBuild;
const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;

type Item = {id: string; slug: string; pen: string; sched: ScheduleAnimal; profile: ReturnType<typeof behaviourProfile>};
const items: Item[] = [];
const beds = townZooBeds(placed.town, town.animals.map((a) => ({id: a.id, model_slug: a.model_slug, length: displayLength(a)})), set, origin.x, origin.z);
for (const a of town.animals) {
    const info = placed.town.get(a.id);
    const p = placed.places.get(a.id);
    if (!info || !p || info.area !== "zoo") continue;
    const length = displayLength(a);
    const profile = behaviourProfile(a.model_slug);
    const box = info.pen ?? (info.enclosure && info.enclosureMargin !== undefined ? maskBox(info.enclosure.mask) : undefined);
    const margin = info.pen ? info.penMargin ?? 0 : info.enclosureMargin ?? 0;
    const sched: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x + origin.x, y: p.ground, z: p.z + origin.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5, kept: true, keep: box ? penKeep(box, margin, origin.x, origin.z) : null, bed: beds.get(a.id) ?? null};
    items.push({id: a.id, slug: a.model_slug, pen: info.place, sched, profile});
}
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const byId = new Map(items.map((it) => [it.id, it]));
const slugOf = new Map(town.animals.map((a) => [a.id, a.model_slug]));
for (const it of items) {
    const lead = placed.places.get(it.id)?.leader;
    const leader = lead && lead !== it.id ? byId.get(lead) : undefined;
    if (!leader || leader.slug !== it.slug || !(GROUPED.has(it.profile.social) || groupLives(it.slug))) continue;
    let size = 1;
    placed.places.forEach((p, id) => {
        if (id !== lead && p.leader === lead && slugOf.get(id) === it.slug) size++;
    });
    it.sched.group = {leader: leader.sched, profile: leader.profile, activity: undefined, rank: Math.max(placed.places.get(it.id)?.rank ?? 1, 1), size: Math.max(size, 2)};
}
const led = new Map<ScheduleAnimal, number>();
for (const it of items) if (it.sched.group) led.set(it.sched.group.leader, (led.get(it.sched.group.leader) ?? 1) + 1);
for (const it of items) it.sched.led = led.get(it.sched) ?? 0;
for (const it of items) it.sched.mates = () => items.filter((o) => o.pen === it.pen).map((o) => ({animal: o.sched, profile: o.profile}));

const stepOne = (it: Item, epoch: number) => {
    const trip = tripAt(world, it.profile, it.sched, epoch, hours);
    poseOnTrip(world, trip, epoch);
};
const pct = (list: number[], q: number) => {
    const s = [...list].sort((a, b) => a - b);
    return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
const r1 = (v: number) => Math.round(v * 10) / 10;

// 1. Cold start (as the scene's first wiring), then warm frames.
let f = 0;
const coldStart = performance.now();
for (const it of items) stepOne(it, from);
const coldStartMs = performance.now() - coldStart;
const steady: number[] = [];
for (; f < warmSeconds * fps; f++) {
    const epoch = from + f / fps;
    const t0 = performance.now();
    for (const it of items) stepOne(it, epoch);
    const ms = performance.now() - t0;
    if (f > (warmSeconds - 10) * fps) steady.push(ms);
}
const out: Record<string, unknown> = {
    residents: items.length,
    pens: new Set(items.map((it) => it.pen)).size,
    townWorldBuildMs: Math.round(buildMs),
    coldStartAllAtOnceMs: Math.round(coldStartMs),
    steadyMsPerFrame: {p50: r1(pct(steady, 0.5)), p95: r1(pct(steady, 0.95)), max: r1(pct(steady, 1))}
};

// 2. Forgets: (a) all at once, (b) the scene's warm gate.
const runs: Array<Record<string, unknown>> = [];
for (let k = 0; k < forgets; k++) {
    // a few more warm seconds between forgets (a different slot each time)
    for (let w = 0; w < 20 * fps; w++, f++) for (const it of items) stepOne(it, from + f / fps);
    // (a) all at once
    forgetSchedules();
    const t0 = performance.now();
    for (const it of items) stepOne(it, from + f / fps);
    const allAtOnce = performance.now() - t0;
    f++;
    for (let w = 0; w < 5 * fps; w++, f++) for (const it of items) stepOne(it, from + f / fps);
    // (b) gated as the scene gates first steps
    forgetSchedules();
    const warm = new Set<Item>();
    const frameMs: number[] = [];
    let costliest = 0;
    let frames = 0;
    let total = 0;
    while (warm.size < items.length && frames < 60 * fps) {
        const epoch = from + f / fps;
        let spent = 0;
        const t0f = performance.now();
        for (const it of items) {
            if (warm.has(it)) {
                stepOne(it, epoch);
                continue;
            }
            if (spent > WARM_MS) continue; // held (the scene draws it at its last pose)
            const s = performance.now();
            stepOne(it, epoch);
            const ms = performance.now() - s;
            spent += ms;
            costliest = Math.max(costliest, ms);
            warm.add(it);
        }
        const ms = performance.now() - t0f;
        frameMs.push(ms);
        total += ms;
        frames++;
        f++;
    }
    runs.push({allAtOnceMs: Math.round(allAtOnce), gated: {framesUntilAllWarm: frames, seconds60fps: r1(frames / fps), msPerFrame: {p50: r1(pct(frameMs, 0.5)), p95: r1(pct(frameMs, 0.95)), max: r1(pct(frameMs, 1))}, framesOver16ms: frameMs.filter((v) => v > 16.7).length, framesOver50ms: frameMs.filter((v) => v > 50).length, totalMs: Math.round(total), costliestFirstStepMs: r1(costliest)}});
}
out.forgets = runs;
console.log(JSON.stringify(out, null, 1));
