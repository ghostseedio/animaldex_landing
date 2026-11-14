#!/usr/bin/env -S npx tsx
/**
 * The hunting audit (behaviours pass 2026-11, lane B1; docs/ark/behaviour-pass-2026-11/hunt.md): how predators hunt
 * and eat as the scene draws it, measured from the pure shared layer (no browser), against each animal's own paces.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-hunt-audit.mts <snapshot.json | --validator>
 *       [--islands <routing.json>] [--hunting <voyage_hunting_v1 read.json>] [--part forays,handover,chases,recipes]
 *       [--species a,b] [--step 0.5] [--windows 12] [--per-species 2] [--json out.json] [--record <lane>]
 *
 * Parts:
 *   forays    every predator walking its encounter forays (`hunting.ts`) as if its next hunt had come: its speed along
 *             the foray against its own walk, sprint, cruise; the share of time moving; turns; a flyer's height and a
 *             swimmer's depth; how far it is from the server's waypoint at each step (the encounter's agreement).
 *   handover  (a snapshot only) the step into a hunt and the step out of it, against its schedule's pose: jumps, speed.
 *   chases    a real meal's chase (`acts.ts` mealStage) for every predator and prey pair aboard: length, duration,
 *             speeds, how the stalk closes, where it ends, how long it eats.
 *   recipes   the visual hunts of ambient prey (the recipes with a catch): how many a day, at what hours, how long,
 *             how many come off.
 *
 * `--validator`: a fixture of every catalogue species (the map validator's), one of each. A snapshot holds real
 * usernames: read it in place, never copy it; only species slugs, ids and counts are printed. Every predator is taken
 * as due (its next hunt at Ark day 0), whatever the read says: the read (`--hunting`) only names who hunts.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {setArkWorld} from "../src/ark-scene/world.ts";

const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
setArkWorld((value("--world") ?? "v2") as "v1" | "v2");

const {decodeArkSnapshot} = await import("../src/ark-scene/snapshot.ts");
const {validatorAnimals} = await import("../src/ark-scene/map/validate.ts");
const {arkBody, arkStats} = await import("../src/ark-scene/stats.ts");
const {behaviourProfile, bodyLengthsPerSecond} = await import("../src/ark-scene/behaviour-profile.ts");
const sched = await import("../src/ark-scene/behaviour-schedule.ts");
const {wireRecipes, quarriesOf} = await import("../src/ark-scene/behaviour-recipes.ts");
const {eats, preyOf} = await import("../src/ark-scene/food-links.ts");
const {mapHabitatAt, onSchedule, scheduleRoost} = await import("../src/ark-scene/map/place.ts");
const {placeAnimals} = await import("../src/ark-scene/placement.ts");
const {onBehaviourSchedule} = await import("../src/ark-scene/schedule-water.ts");
const {worldSampler} = await import("../src/ark-scene/world-sampler.ts");
const {heightAt, ZONE_SITES} = await import("../src/ark-scene/world.ts");
const {islandHours} = await import("../src/lib/ark-clock.ts");
const {modelBase} = await import("../src/ark-scene/grounding/base.ts");
const {flightSpec} = await import("../src/ark-scene/locomotion/flight.ts");
const {sprintPace, froudeAt} = await import("../src/ark-scene/locomotion/flee.ts");
const {swimPaces} = await import("../src/ark-scene/locomotion/swim.ts");
const {locoStyle} = await import("../src/ark-scene/locomotion/styles.ts");
const {intelProfile} = await import("../src/ark-scene/intelligence-profile.ts");
const hunt = await import("../src/ark-scene/hunting.ts");
const {HuntingLayer} = hunt;
const {speciesRecipes} = await import("../src/ark-scene/behaviour-recipes.ts");
const acts = await import("../src/ark-scene/acts.ts");
const positions = await import("../src/ark-scene/positions/positions.ts");
const {decodeArkHuntingResponse, decodeArkHunting} = await import("../src/lib/ark-hunting.ts");

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
const source = args[0];
if (!source) throw new Error("usage: ark-hunt-audit.mts <snapshot.json | --validator> [--islands routing.json] [--hunting read.json] [--part forays,handover,chases,recipes]");
const fixture = source === "--validator";
let animals: ArkAnimal[];
let startedAtMs = Date.UTC(2026, 10, 8, 21, 45, 21);
if (fixture) animals = validatorAnimals().filter((a) => a.slot_rank === 0).map((a) => ({...a, island: "wild" as const}));
else {
    const routingPath = value("--islands");
    let raw: unknown = JSON.parse(readFileSync(source, "utf8"));
    const started = Date.parse(String((raw as {voyage?: {started_at?: string}}).voyage?.started_at ?? ""));
    if (Number.isFinite(started)) startedAtMs = started;
    if (routingPath) raw = (await import("../src/lib/ark-islands-local.ts")).mergeArkIslandsRouting(raw, JSON.parse(readFileSync(routingPath, "utf8"))).merged;
    const local = (await import("../src/lib/ark-local-snapshot.ts")).arkLocalSnapshotOf(raw);
    const snapshot = local?.snapshot ?? decodeArkSnapshot(raw);
    if (!snapshot) throw new Error("not a snapshot");
    animals = routingPath ? (await import("../src/lib/ark-islands.ts")).arkIslandSnapshot(snapshot, "wild").animals : snapshot.animals.filter((a) => !(a as {area?: string | null}).area);
}
const parts = new Set((value("--part") ?? (fixture ? "forays,chases" : "forays,handover,chases,recipes")).split(","));
const only = value("--species")?.split(",");
const dt = Number(value("--step") ?? "0.5");
const huntingPath = value("--hunting");
let named: Set<string> | null = null;
if (huntingPath) {
    const body = JSON.parse(readFileSync(huntingPath, "utf8"));
    const read = decodeArkHuntingResponse(body) ?? decodeArkHunting(body);
    if (read) {
        named = new Set(read.predators.keys());
        if (read.startedAtMs !== null) startedAtMs = read.startedAtMs;
    }
}

const atlas = positions.decodeAtlas(JSON.parse(readFileSync(new URL("../src/ark-scene/positions/atlas.json", import.meta.url), "utf8")));
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const sampler = worldSampler();
const world = sched.scheduleWorld(sampler);
const needSchedule = !fixture && (parts.has("handover") || parts.has("recipes") || parts.has("forays"));
const places = placeAnimals(animals);

type Own = {profile: ReturnType<typeof behaviourProfile>; animal: import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal; trip: import("../src/ark-scene/behaviour-schedule.ts").Trip | null};
type Subject = {animal: ArkAnimal; place: NonNullable<ReturnType<typeof places.get>>; length: number; plan: string | null; rigPlan: string; profile: ReturnType<typeof behaviourProfile>; sched: Own | null; home: ReturnType<typeof positions.homeOf>};
const subjects: Subject[] = animals.map((animal) => {
    const place = places.get(animal.id)!;
    const plan = modelBase(animal.model_slug)?.plan ?? null;
    const body = arkBody(animal, plan);
    const profile = behaviourProfile(animal.model_slug, plan);
    const on = needSchedule && onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
    const home = typeof animal.slot === "number" && animal.species_profile_id ? positions.homeOf(atlas, {island: "wild", zone: animal.zone, slug: animal.model_slug, speciesId: animal.species_profile_id, slot: animal.slot, rank: animal.slot_rank ?? 0}) : null;
    return {
        animal,
        place,
        length: body.display,
        plan,
        rigPlan: intelProfile(animal.model_slug, plan).plan,
        profile,
        home,
        sched: on ? {profile, animal: sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone)), trip: null} : null
    };
});
if (needSchedule) {
    // The scene's wiring (as `scripts/ark-time-budget.mts`): groups, spaced homes, threats, recipes.
    const byId = new Map(subjects.map((s) => [s.animal.id, s]));
    const onIt = subjects.filter((s) => s.sched);
    const leaderOf = (s: Subject) => (s.place.leader && s.place.leader !== s.animal.id ? byId.get(s.place.leader) ?? null : null);
    const sizes = new Map<Subject, number>();
    for (const s of onIt) {
        const leader = leaderOf(s);
        if (leader?.sched) sizes.set(leader, (sizes.get(leader) ?? 1) + 1);
    }
    const groups = new Map<Subject, import("../src/ark-scene/behaviour-schedule.ts").ScheduleGroup | null>();
    for (const s of onIt) {
        const leader = leaderOf(s);
        const ok = leader && leader.sched && leader.animal.model_slug === s.animal.model_slug && GROUPED.has(s.sched!.profile.social) ? leader : null;
        groups.set(s, ok ? {leader: ok.sched!.animal, profile: ok.sched!.profile, activity: ok.animal.activity, rank: Math.max(s.place.rank ?? 1, 1), size: sizes.get(ok) ?? 2} : null);
    }
    const nav = world.nav;
    const radius = new Map(onIt.map((s) => [s.animal.id, sched.rangeReach(s.sched!.profile, s.sched!.animal) + (sizes.has(s) ? sched.groupSpread(s.length, sizes.get(s)!) : 0)]));
    const spaced = sched.spaceHomes(
        onIt.filter((s) => !groups.get(s)).map((s) => ({id: s.animal.id, slug: s.animal.model_slug, home: {x: s.sched!.animal.home.x, z: s.sched!.animal.home.z}, length: s.length, walkable: (x: number, z: number) => (s.sched!.profile.move === "swim" || s.sched!.profile.seabed ? nav.swimmable(x, z, 0.5) : s.sched!.profile.move === "fly" ? heightAt(x, z) > 0.05 && mapHabitatAt(s.animal, x, z, 5) : nav.walkable(x, z) && mapHabitatAt(s.animal, x, z, 5))})),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const s of onIt) {
        const own = s.sched!;
        own.animal.group = groups.get(s) ?? null;
        own.animal.young = false;
        const moved = spaced.get(s.animal.id);
        if (moved) {
            own.animal.home = {x: moved.home.x, y: Math.max(heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
            own.animal.range = moved.range === null ? null : sizes.has(s) ? moved.range / 2 : moved.range;
            own.animal.prey = moved.prey;
        }
    }
    for (const s of onIt) {
        const lead = s.sched!.animal.group?.leader;
        const leader = leaderOf(s);
        if (!lead || !leader || !spaced.has(leader.animal.id)) continue;
        s.sched!.animal.home = {...lead.home};
        s.sched!.animal.range = lead.range;
    }
    const list = onIt.map((s) => ({slug: s.animal.model_slug, animal: s.sched!.animal, profile: s.sched!.profile, activity: s.animal.activity}));
    sched.wireThreats(list, eats);
    sched.forgetSchedules();
    wireRecipes(list.map((w) => ({animal: w.animal, profile: w.profile, slug: w.slug, activity: w.activity})));
}

const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const schedulePose = (s: Subject, epoch: number) => {
    const own = s.sched;
    if (!own) return {x: s.place.x, y: Math.max(s.place.ground, 0), z: s.place.z, yaw: 0, moving: false, aloft: false, nx: 0, ny: 1, nz: 0, beat: "rest" as const, doing: "rest" as const};
    if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = sched.tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, own.trip);
    return {...sched.poseOnTrip(world, own.trip, epoch), doing: own.trip.doing};
};

// MARK: Who hunts, and each one's own paces

const isPredator = (s: Subject) => (named ? named.has(s.animal.id) : preyOf(s.animal.model_slug).size > 0);
// (Only the ones the schedule moves: a true micro animal on its leaf, an underground one and one held off the water are
// drawn at their places and never walk a foray, `index.ts` makeSched.)
const drawn = (s: Subject) => onSchedule(s.place, s.animal.model_slug) && onBehaviourSchedule(s.animal.model_slug);
const everyPredator = subjects.filter((s) => s.home && isPredator(s));
const predators = everyPredator.filter((s) => drawn(s) && (!only || only.includes(s.animal.model_slug)));
type Paces = {walk: number; sprint: number; cruise: number | null; swim: number | null};
const pacesOf = (s: Subject): Paces => {
    const stat = arkStats(s.animal).speed;
    return {
        walk: bodyLengthsPerSecond(s.profile) * Math.max(s.length, 0.01),
        sprint: sprintPace({plan: s.rigPlan, slug: s.animal.model_slug, length: s.length, speedStat: stat}),
        cruise: flightSpec(s.animal.model_slug, s.length, s.plan)?.cruise ?? null,
        swim: locoStyle(s.animal.model_slug, s.plan).swim ? swimPaces(s.length, locoStyle(s.animal.model_slug, s.plan).swim!).cruise : null
    };
};
const kindOf = (s: Subject) => (s.home!.sheet.flies ? "flyer" : s.home!.sheet.aquatic && !s.home!.sheet.amphibious ? "swimmer" : "walker");
const median = (list: number[]) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : NaN);
const quantile = (list: number[], q: number) => (list.length ? [...list].sort((a, b) => a - b)[Math.min(Math.floor(list.length * q), list.length - 1)] : NaN);
const f = (n: number | null | undefined, d = 2) => (n === null || n === undefined || !Number.isFinite(n) ? "-" : n.toFixed(d));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const STEP_SECONDS = positions.ARK_DAY_MS / 1000 / positions.STEPS_PER_ARK_DAY;
const dayStart = Date.UTC(2026, 10, 26) / 1000;
const stepAt = (epoch: number) => positions.stepIndex((epoch * 1000 - startedAtMs) / positions.ARK_DAY_MS);
const stepStart = (k: number) => (startedAtMs + (k / positions.STEPS_PER_ARK_DAY) * positions.ARK_DAY_MS) / 1000;

const layer = new HuntingLayer();
/** The scene's hunt world (`index.ts` huntWorld): the water's surface (the lake's and the river's own level), the perches. */
const huntWorld = {
    water: (x: number, z: number) => Math.max(sampler.waterSurface?.(x, z) ?? 0, 0),
    perch: (x: number, z: number, reach: number) => {
        let best: {x: number; y: number; z: number} | null = null;
        let near = reach;
        for (const tag of ["branch", "post", "rock_top"] as const) {
            for (const p of sampler.attachPoints(tag, {x, z, r: near})) {
                const d = Math.hypot(p.x - x, p.z - z);
                if (d <= near) [best, near] = [p, d];
            }
        }
        return best;
    }
};
const poseOf = (s: Subject, epoch: number) => (layer.pose as (...a: unknown[]) => ReturnType<typeof layer.pose>)(s.animal, epoch, s.length, heightAt, () => schedulePose(s, epoch), huntWorld);
const allDue = new Map(predators.map((s) => [s.animal.id, 0]));
layer.set({hunting: "encounter", startedAtMs, arkDay: null, tickedTo: null, predators: allDue, meals: []}, atlas, startedAtMs);
const metrics: Record<string, number> = {};
const out: Record<string, unknown> = {};
console.log(`${animals.length} animals (${fixture ? "fixture: every catalogue species" : "the wild island"}), ${everyPredator.length} predators with a home in the atlas (${named ? "named by the hunting read" : "by the scene's food links"}), ${predators.length} of them on the schedule (the rest are micro or underground: drawn at their places); a step is ${STEP_SECONDS.toFixed(1)} s`);

// MARK: Forays

type ForayRow = {slug: string; kind: string; hunt: string; style: string; n: number; length: number; R: number; samples: number; moving: number; speeds: number[]; turn: number; turnMax: number; agl: number[]; depth: number[]; floor: number[]; off: number[]; doings: Record<string, number>; beats: Record<string, number>; paces: Paces; legSpeeds: number[]; stillRuns: number[]; moveRuns: number[]; accelMax: number};
if (parts.has("forays")) {
    const rows = new Map<string, ForayRow>();
    const started = Date.now();
    // Twelve 10-minute windows, one every two hours of a day (the island's hours follow the real clock).
    // (`--windows 4`: fewer, for the fixture's CI run: one every six hours.)
    const windows = Math.min(Math.max(Number(value("--windows") ?? "12"), 1), 12);
    const WINDOWS = Array.from({length: windows}, (_, i) => dayStart + i * (86400 / windows));
    const styleOf = (layer as unknown as {styleOf?: (animal: ArkAnimal) => string | null}).styleOf?.bind(layer);
    for (const s of predators) {
        const slug = s.animal.model_slug;
        const intel = intelProfile(slug, s.plan);
        const row = rows.get(slug) ?? {slug, kind: kindOf(s), hunt: intel.hunt.join("+") || "-", style: styleOf?.(s.animal) ?? "-", n: 0, length: s.length, R: positions.forayRadius(s.home!.sheet), samples: 0, moving: 0, speeds: [], turn: 0, turnMax: 0, agl: [], depth: [], floor: [], off: [], doings: {}, beats: {}, paces: pacesOf(s), legSpeeds: [], stillRuns: [], moveRuns: [], accelMax: 0};
        row.n++;
        rows.set(slug, row);
        for (const from of WINDOWS) {
            let last: {x: number; y: number; z: number; yaw: number; v: number} | null = null;
            let run = 0;
            let runMoving: boolean | null = null;
            const k0 = stepAt(from);
            for (let t = 0; t < 600; t += dt) {
                const epoch = from + t;
                const pose = poseOf(s, epoch);
                // (Only whole hunting steps here: the hand-overs are measured on their own.)
                const k = stepAt(epoch);
                const whole = pose && layer.hunting(s.animal, stepStart(k) + 0.01) && layer.hunting(s.animal, stepStart(k) - 0.01) && layer.hunting(s.animal, stepStart(k + 1) + 0.01) && layer.hunting(s.animal, stepStart(k + 2) - 0.01);
                if (!pose || !whole) {
                    last = null;
                    if (runMoving !== null) (runMoving ? row.moveRuns : row.stillRuns).push(run);
                    runMoving = null;
                    continue;
                }
                const ground = heightAt(pose.x, pose.z);
                if (last) {
                    const v = Math.hypot(pose.x - last.x, pose.z - last.z) / dt;
                    const moving = v > Math.max(0.02 * s.length, 0.004);
                    row.samples++;
                    if (moving) {
                        row.moving++;
                        row.speeds.push(v);
                    }
                    const turned = Math.abs(wrap(pose.yaw - last.yaw));
                    row.turn += turned;
                    row.turnMax = Math.max(row.turnMax, turned / dt);
                    row.accelMax = Math.max(row.accelMax, Math.abs(v - last.v) / dt);
                    if (runMoving === moving) run += dt;
                    else {
                        if (runMoving !== null) (runMoving ? row.moveRuns : row.stillRuns).push(run);
                        runMoving = moving;
                        run = dt;
                    }
                    row.doings[pose.doing] = (row.doings[pose.doing] ?? 0) + 1;
                    row.beats[pose.beat] = (row.beats[pose.beat] ?? 0) + 1;
                    if (row.kind === "flyer") row.agl.push(pose.y - Math.max(ground, 0));
                    if (row.kind === "swimmer") {
                        row.depth.push(-pose.y);
                        row.floor.push(pose.y - ground);
                    }
                    last = {x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, v};
                } else last = {x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, v: 0};
            }
            if (runMoving !== null) (runMoving ? row.moveRuns : row.stillRuns).push(run);
            // The encounter's agreement: at each step's moment, how far the pose is from the server's waypoint.
            for (let k = k0 + 1; stepStart(k) < from + 600; k++) {
                const epoch = stepStart(k);
                if (!layer.hunting(s.animal, epoch + 0.01) || !layer.hunting(s.animal, epoch - 0.01)) continue;
                const pose = poseOf(s, epoch);
                if (!pose) continue;
                const way = positions.forayAt(atlas, s.home!, s.animal.id, k);
                const next = positions.forayAt(atlas, s.home!, s.animal.id, k + 1);
                row.off.push(Math.hypot(pose.x - way.x, pose.z - way.z));
                row.legSpeeds.push(Math.hypot(next.x - way.x, next.z - way.z) / STEP_SECONDS);
            }
        }
    }
    const list = Array.from(rows.values()).filter((r) => r.samples > 0);
    console.log(`\n== Forays: ${list.length} species hunting in the sampled windows (${((Date.now() - started) / 1000).toFixed(0)} s) ==`);
    console.log("species                          kind    hunt style        n  len    R   moving  speed med/p95 (m/s)  ÷walk  ÷sprint ÷cruise  turn °/min  max °/s  still med/max s  height or depth med (p5–p95)   off-waypoint max   card");
    const ratio = (r: ForayRow) => {
        const v = median(r.speeds);
        const own = r.kind === "flyer" ? r.paces.cruise : r.kind === "swimmer" ? r.paces.swim : r.paces.walk;
        return own ? v / own : NaN;
    };
    for (const r of list.sort((a, b) => a.kind.localeCompare(b.kind) || b.length - a.length)) {
        const minutes = (r.samples * dt) / 60;
        const med = median(r.speeds);
        const high = r.kind === "flyer" ? `${f(median(r.agl), 1)} m up (${f(quantile(r.agl, 0.05), 1)}–${f(quantile(r.agl, 0.95), 1)})` : r.kind === "swimmer" ? `${f(median(r.depth), 1)} m deep (${f(quantile(r.depth, 0.05), 1)}–${f(quantile(r.depth, 0.95), 1)}), ${f(median(r.floor), 1)} off the floor` : "";
        const top = Object.entries(r.doings).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} ${((100 * v) / r.samples).toFixed(0)}%`).join(" ");
        const beats = Object.entries(r.beats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${((100 * v) / r.samples).toFixed(0)}%`).join(" ");
        console.log(`${r.slug.padEnd(32)} ${r.kind.padEnd(7)} ${r.hunt.padEnd(12).slice(0, 12)} ${r.style.padEnd(8)} ${String(r.n).padStart(2)} ${f(r.length).padStart(5)} ${f(r.R, 0).padStart(3)} ${((100 * r.moving) / r.samples).toFixed(0).padStart(5)}%  ${f(med).padStart(6)}/${f(quantile(r.speeds, 0.95)).padEnd(6)}  ${f(med / r.paces.walk, 2).padStart(5)} ${f(med / r.paces.sprint, 2).padStart(6)} ${f(r.paces.cruise ? med / r.paces.cruise : r.paces.swim && r.kind === "swimmer" ? med / r.paces.swim : NaN, 2).padStart(6)}  ${f(((r.turn * 180) / Math.PI) / minutes, 0).padStart(8)} ${f((r.turnMax * 180) / Math.PI, 0).padStart(8)}  ${f(median(r.stillRuns), 1).padStart(6)}/${f(Math.max(0, ...r.stillRuns), 0).padEnd(4)}  ${high.padEnd(34)} ${f(Math.max(0, ...r.off), 2).padStart(6)}   hunting; ${top}; ${beats}`);
    }
    const by = (kind: string) => list.filter((r) => r.kind === kind);
    const summary = (kind: string) => {
        const group = by(kind);
        const ratios = group.map(ratio).filter(Number.isFinite);
        const share = group.map((r) => r.moving / r.samples);
        console.log(`${kind}s: ${group.length} species; speed ÷ own pace median ${f(median(ratios))} (p10 ${f(quantile(ratios, 0.1))}, p90 ${f(quantile(ratios, 0.9))}); moving share median ${f(median(share))} (min ${f(Math.min(...share))}, max ${f(Math.max(...share))}); sharpest turn median ${f(median(group.map((r) => (r.turnMax * 180) / Math.PI)), 0)} °/s`);
    };
    console.log("");
    for (const kind of ["walker", "flyer", "swimmer"]) if (by(kind).length) summary(kind);
    const walkers = by("walker");
    const flyers = by("flyer");
    const swimmers = by("swimmer");
    const styles: Record<string, number> = {};
    for (const r of list) styles[r.style] = (styles[r.style] ?? 0) + 1;
    console.log(`styles: ${Object.entries(styles).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    Object.assign(metrics, {
        foray_species: list.length,
        foray_walker_moving_share_median: median(walkers.map((r) => r.moving / r.samples)),
        foray_walker_moving_share_max: Math.max(0, ...walkers.map((r) => r.moving / r.samples)),
        foray_walker_speed_over_walk_median: median(walkers.map(ratio).filter(Number.isFinite)),
        foray_walker_speed_over_walk_p90: quantile(walkers.map(ratio).filter(Number.isFinite), 0.9),
        foray_walker_p95_over_sprint_max: Math.max(0, ...walkers.map((r) => quantile(r.speeds, 0.95) / r.paces.sprint).filter(Number.isFinite)),
        foray_turn_rate_max_deg: Math.max(0, ...list.map((r) => (r.turnMax * 180) / Math.PI)),
        foray_turn_rate_median_deg: median(list.map((r) => (r.turnMax * 180) / Math.PI)),
        foray_flyer_speed_over_cruise_median: median(flyers.map(ratio).filter(Number.isFinite)),
        foray_flyer_height_distinct: new Set(flyers.map((r) => Math.round(median(r.agl)))).size,
        foray_flyer_height_spread_median: median(flyers.map((r) => quantile(r.agl, 0.95) - quantile(r.agl, 0.05))),
        foray_swimmer_speed_over_cruise_median: median(swimmers.map(ratio).filter(Number.isFinite)),
        foray_off_waypoint_max: Math.max(0, ...list.map((r) => Math.max(0, ...r.off))),
        foray_styles: Object.keys(styles).length
    });
    out.forays = list.map((r) => ({slug: r.slug, kind: r.kind, hunt: r.hunt, style: r.style, n: r.n, length: r.length, R: r.R, moving: r.moving / r.samples, speed: median(r.speeds), speedP95: quantile(r.speeds, 0.95), walk: r.paces.walk, sprint: r.paces.sprint, cruise: r.paces.cruise, swim: r.paces.swim, turnPerMinute: ((r.turn * 180) / Math.PI) / ((r.samples * dt) / 60), turnMax: (r.turnMax * 180) / Math.PI, height: median(r.agl), depth: median(r.depth), off: Math.max(0, ...r.off), doings: r.doings, beats: r.beats}));
}

// MARK: Hand-overs (into a hunt, out of it)

if (parts.has("handover") && !fixture) {
    type Hand = {slug: string; kind: string; way: "into" | "out"; gap: number; speedMax: number; speedMean: number; own: number; sprint: number; jumpIn: number; jumpOut: number};
    const hands: Hand[] = [];
    const k0 = stepAt(dayStart);
    const perDay = Math.round(86400 / STEP_SECONDS);
    for (const s of predators) {
        const activity = s.animal.activity ?? s.home!.sheet.activity ?? null;
        const on = (k: number) => positions.awakeAt(activity, startedAtMs, k / positions.STEPS_PER_ARK_DAY, 0);
        const paces = pacesOf(s);
        const kind = kindOf(s);
        let found = 0;
        for (let k = k0; k < k0 + perDay && found < 2; k++) {
            if (on(k) === on(k + 1)) continue;
            found++;
            const a = stepStart(k);
            const b = stepStart(k + 1);
            const at = (epoch: number) => poseOf(s, epoch) ?? schedulePose(s, epoch);
            // The hand-over's own motion: the pose against its schedule's at the same moment (its schedule's own moves, a
            // flight to its roost at dusk, are its schedule's), from the first step it has left its schedule to the last.
            const off = (epoch: number) => {
                const p = at(epoch);
                const q = schedulePose(s, epoch);
                return {x: p.x - q.x, z: p.z - q.z};
            };
            const lead = hunt.LEAD_STEPS ?? 1;
            const from = on(k + 1) ? stepStart(k + 1 - lead) : a;
            const to = on(k + 1) ? b : stepStart(k + lead);
            let last = off(from);
            let far = 0;
            let gap = 0;
            for (let t = from + dt; t < to - 1e-3; t += dt) {
                const r = off(t);
                far = Math.max(far, Math.hypot(r.x - last.x, r.z - last.z) / dt);
                gap = Math.max(gap, Math.hypot(r.x, r.z));
                last = r;
            }
            const total = gap;
            const first = at(a);
            const before = at(a - 0.02);
            const end = at(b - 0.02);
            const after = at(b + 0.02);
            last = end;
            hands.push({slug: s.animal.model_slug, kind, way: on(k + 1) ? "into" : "out", gap, speedMax: far, speedMean: total / STEP_SECONDS, own: kind === "flyer" ? paces.cruise ?? paces.walk : kind === "swimmer" ? paces.swim ?? paces.walk : paces.walk, sprint: paces.sprint, jumpIn: Math.hypot(first.x - before.x, first.z - before.z), jumpOut: Math.hypot(after.x - last.x, after.z - last.z)});
        }
    }
    console.log(`\n== Hand-overs: ${hands.length} steps into or out of a hunt (the wake and sleep ends of a day) ==`);
    const worst = [...hands].sort((x, y) => y.speedMax / y.own - x.speedMax / x.own).slice(0, 25);
    console.log("the 25 fastest against their own pace:");
    for (const h of worst) console.log(`  ${h.slug.padEnd(30)} ${h.kind.padEnd(7)} ${h.way.padEnd(4)} from ${f(h.gap, 1).padStart(6)} m away; top ${f(h.speedMax)} m/s = ${f(h.speedMax / h.own, 1)}× its own pace (${f(h.own)}), ${f(h.speedMax / h.sprint, 2)}× its sprint; jump at the start ${f(h.jumpIn)} m, at the end ${f(h.jumpOut)} m`);
    for (const kind of ["walker", "flyer", "swimmer"]) {
        const group = hands.filter((h) => h.kind === kind);
        if (!group.length) continue;
        console.log(`${kind}s: ${group.length} hand-overs; gap median ${f(median(group.map((h) => h.gap)), 1)} m (max ${f(Math.max(...group.map((h) => h.gap)), 1)}); top speed ÷ own pace median ${f(median(group.map((h) => h.speedMax / h.own)))}, p90 ${f(quantile(group.map((h) => h.speedMax / h.own), 0.9))}, max ${f(Math.max(...group.map((h) => h.speedMax / h.own)))}; over its sprint: ${group.filter((h) => kind === "walker" && h.speedMax > h.sprint).length}; jumps over 0.5 m: ${group.filter((h) => h.jumpIn > 0.5 || h.jumpOut > 0.5).length}`);
    }
    const walkers = hands.filter((h) => h.kind === "walker");
    Object.assign(metrics, {
        handover_count: hands.length,
        handover_walker_speed_over_walk_p90: quantile(walkers.map((h) => h.speedMax / h.own), 0.9),
        handover_walker_speed_over_walk_max: Math.max(0, ...walkers.map((h) => h.speedMax / h.own)),
        handover_walker_over_sprint: walkers.filter((h) => h.speedMax > h.sprint).length,
        handover_jump_max: Math.max(0, ...hands.map((h) => Math.max(h.jumpIn, h.jumpOut))),
        handover_jumps_over_half_metre: hands.filter((h) => h.jumpIn > 0.5 || h.jumpOut > 0.5).length
    });
    out.handovers = hands;
}

// MARK: Meal chases

if (parts.has("chases")) {
    type Chase = {pred: string; prey: string; kind: string; style: string; lp: number; lq: number; gap: number; seconds: number; catchAt: number; stalk: number; stalkDist: number; stalkSpeed: number; run: number; runDist: number; top: number; sprint: number; eat: number; preyRan: number; ends: number; ratio: number; wait: number};
    const chases: Chase[] = [];
    const bySlug = new Map<string, Subject>();
    for (const s of subjects) if (!bySlug.has(s.animal.model_slug)) bySlug.set(s.animal.model_slug, s);
    acts.setChasePaces({
        sprint: (b) => sprintPace({plan: b.slug ? intelProfile(b.slug).plan : null, slug: b.slug, length: b.length, speedStat: b.speedStat}),
        flee: (b) => sprintPace({plan: b.slug ? intelProfile(b.slug).plan : null, slug: b.slug, length: b.length, speedStat: b.speedStat}) * 0.65,
        burst: (b) => {
            const swim = b.slug ? locoStyle(b.slug, modelBase(b.slug)?.plan ?? null).swim : null;
            return swim ? swimPaces(b.length, swim).burst : null;
        },
        dive: (b) => (b.slug ? flightSpec(b.slug, b.length, modelBase(b.slug)?.plan ?? null)?.dive ?? null : null)
    });
    // (The scene's own wiring, `index.ts` beginAct: where the lane's rules are absent, the build before it, every flying
    // bird stoops and every land chase is a rush.)
    const rules = hunt as unknown as {chaseStyleOf?: (slug: string, pounces: boolean) => "rush" | "pounce" | "course" | "strike"; swoopsOnPrey?: (slug: string, length: number) => {swoops: boolean; low: boolean}};
    const styleFor = rules.chaseStyleOf ? (slug: string) => rules.chaseStyleOf!(slug, speciesRecipes(slug).has.has("pounce")) : null;
    const water = (s: Subject) => s.place.ground < -0.05 || Boolean(s.home?.sheet.aquatic && !s.home?.sheet.amphibious);
    const seen = new Set<string>();
    for (const p of predators) {
        for (const preySlug of preyOf(p.animal.model_slug)) {
            const q = bySlug.get(preySlug);
            const key = `${p.animal.model_slug}>${preySlug}`;
            if (!q || seen.has(key)) continue;
            seen.add(key);
            const fromAir = rules.swoopsOnPrey?.(p.animal.model_slug, p.length);
            const kind = acts.chaseKind({predatorSlug: p.animal.model_slug, predatorPlan: p.plan, predatorWater: water(p), preyWater: water(q), predatorFlies: Boolean(p.home!.sheet.flies) && ZONE_SITES[p.animal.zone]?.kind !== "sea", ...(fromAir ? {swoops: fromAir.swoops, ratio: q.length / Math.max(p.length, 0.01)} : {})} as Parameters<typeof acts.chaseKind>[0]);
            if (kind === "cutaway") {
                chases.push({pred: p.animal.model_slug, prey: preySlug, kind, style: "-", lp: p.length, lq: q.length, gap: 0, seconds: 3.2, catchAt: 1.5, stalk: 0, stalkDist: 0, stalkSpeed: 0, run: 0, runDist: 0, top: 0, sprint: 0, eat: 0, preyRan: 0, ends: 0, ratio: 0, wait: 0});
                continue;
            }
            // Where encounter hunting finds them: the hunter at a waypoint, the prey's disc within its detection range (the
            // harness's median hunter-to-disc-centre is 7.3 m) and the prey somewhere in its disc: here two thirds of the
            // range plus half the prey's disc.
            const gap = Math.max(positions.detectionRange(p.home!.sheet) * 0.66 + (q.home ? q.home.r * 0.5 : 0), p.length + q.length);
            const flat = water(p) && water(q) ? -1.2 : 0;
            const body = (s: Subject, x: number): import("../src/ark-scene/acts.ts").ActBody => ({x, z: 0, base: flat, yaw: 0, length: s.length, height: s.length * 0.5, speedStat: arkStats(s.animal).speed, gait: s.profile.gait ?? null, slug: s.animal.model_slug});
            const flee = acts.preyFleeStyle({preySlug, preyPlan: q.plan, preyWater: water(q), preyFlies: Boolean(q.home?.sheet.flies), speedStat: arkStats(q.animal).speed});
            const style = styleFor?.(p.animal.model_slug);
            const stage = acts.mealStage(kind, body(p, 0), body(q, gap), {seed: key, flee, exact: true, ...(style ? {style, low: fromAir?.low ?? false} : {})} as Parameters<typeof acts.mealStage>[3]);
            let stalk = 0, run = 0, stalkDist = 0, runDist = 0, top = 0, eat = 0, wait = 0;
            let lastP = stage.predator(0)!;
            const q0 = stage.prey(0);
            let lastQ = q0;
            let preyRan = 0;
            const tick = 1 / 30;
            for (let t = tick; t <= stage.seconds + 1e-6; t += tick) {
                const a = stage.predator(t)!;
                const b = stage.prey(t);
                const d = Math.hypot(a.x - lastP.x, a.z - lastP.z);
                if (a.state === "stalk" || a.state === "freeze") {
                    stalk += tick;
                    stalkDist += d;
                    if (d / tick < 0.02 * p.length) wait += tick;
                } else if (a.state === "run" || a.state === "leap" || a.state === "strike" || a.state === "swim" || a.state === "plunge" || a.state === "strike_feet" || a.state === "fly" || a.state === "glide" || a.state === "takeoff") {
                    if (t <= (stage.catchAt ?? stage.seconds)) {
                        run += tick;
                        runDist += d;
                        top = Math.max(top, d / tick);
                    }
                } else if (a.state === "eat") eat += tick;
                preyRan += Math.hypot(b.x - lastQ.x, b.z - lastQ.z);
                lastP = a;
                lastQ = b;
            }
            const sprint = kind === "swoop" ? acts.chasePace(body(p, 0), "dive") : kind === "dart" ? acts.chasePace(body(p, 0), "burst") : acts.chasePace(body(p, 0), "sprint");
            chases.push({pred: p.animal.model_slug, prey: preySlug, kind, style: kind === "glide" || kind === "bound" || kind === "slither" ? style ?? "-" : kind === "swoop" && fromAir ? (fromAir.low ? "low" : "stoop") : "-", lp: p.length, lq: q.length, gap, seconds: stage.seconds, catchAt: stage.catchAt ?? 0, stalk, stalkDist, stalkSpeed: stalkDist / Math.max(stalk - wait, 1e-6), run, runDist, top, sprint, eat, preyRan, ends: Math.hypot(lastP.x, lastP.z), ratio: q.length / p.length, wait});
        }
    }
    console.log(`\n== Meal chases: ${chases.length} predator and prey pairs aboard ==`);
    const kinds = Array.from(new Set(chases.map((c) => `${c.kind}${c.style !== "-" ? ":" + c.style : ""}`))).sort();
    console.log("kind            pairs  whole s  stalk s (still s)  stalk m  stalk m/s  rush s  rush m (max)  top ÷ sprint  eats s   prey ran m   catch from start m");
    for (const k of kinds) {
        const g = chases.filter((c) => `${c.kind}${c.style !== "-" ? ":" + c.style : ""}` === k);
        console.log(`${k.padEnd(15)} ${String(g.length).padStart(5)}  ${f(median(g.map((c) => c.seconds)), 1).padStart(6)}  ${f(median(g.map((c) => c.stalk)), 1).padStart(6)} (${f(median(g.map((c) => c.wait)), 1)})       ${f(median(g.map((c) => c.stalkDist)), 1).padStart(6)}  ${f(median(g.map((c) => c.stalkSpeed)), 2).padStart(8)}  ${f(median(g.map((c) => c.run)), 1).padStart(6)}  ${f(median(g.map((c) => c.runDist)), 1).padStart(6)} (${f(Math.max(...g.map((c) => c.runDist)), 0)})  ${f(median(g.map((c) => (c.sprint ? c.top / c.sprint : NaN)).filter(Number.isFinite)), 2).padStart(8)}  ${f(median(g.map((c) => c.eat)), 1).padStart(6)}   ${f(median(g.map((c) => c.preyRan)), 1).padStart(6)}   ${f(median(g.map((c) => c.ends)), 1).padStart(6)}`);
    }
    const land = chases.filter((c) => c.kind === "glide" || c.kind === "bound");
    const example = (label: string, list: Chase[]) => {
        for (const c of list.slice(0, 6)) console.log(`  ${label}: ${c.pred} (${f(c.lp)} m) on ${c.prey} (${f(c.lq)} m), ${c.kind}${c.style !== "-" ? " " + c.style : ""}: from ${f(c.gap, 1)} m; stalk ${f(c.stalk, 1)} s over ${f(c.stalkDist, 1)} m at ${f(c.stalkSpeed)} m/s; rush ${f(c.run, 1)} s over ${f(c.runDist, 1)} m, top ${f(c.top, 1)} m/s (its sprint ${f(c.sprint, 1)}); eats ${f(c.eat, 1)} s; prey ran ${f(c.preyRan, 1)} m`);
    };
    example("longest rush", [...land].sort((a, b) => b.runDist - a.runDist));
    example("snake", chases.filter((c) => c.kind === "slither").sort((a, b) => b.runDist + b.stalkDist - a.runDist - a.stalkDist));
    example("biggest prey for a raptor", chases.filter((c) => c.kind === "swoop").sort((a, b) => b.ratio - a.ratio));
    const named2 = (slug: string) => chases.filter((c) => c.pred === slug).slice(0, 1);
    for (const slug of ["african-lion", "sumatran-tiger", "eurasian-wolf", "spotted-hyena", "pine-marten", "saltwater-crocodile", "komodo-dragon", "reticulated-python", "american-bullfrog", "veiled-chameleon", "common-buzzard", "red-tailed-hawk", "common-kingfisher", "great-egret", "european-robin", "northern-pike", "bull-shark", "lion", "cheetah", "gray-wolf", "red-fox", "nile-crocodile", "peregrine-falcon", "golden-eagle", "barn-owl", "king-cobra"]) example("named", named2(slug));
    const swoops = chases.filter((c) => c.kind === "swoop");
    Object.assign(metrics, {
        chase_pairs: chases.length,
        chase_land_rush_m_median: median(land.map((c) => c.runDist)),
        chase_land_rush_m_max: Math.max(0, ...land.map((c) => c.runDist)),
        chase_land_eat_s_median: median(land.map((c) => c.eat)),
        chase_land_seconds_median: median(land.map((c) => c.seconds)),
        chase_snake_travel_m_max: Math.max(0, ...chases.filter((c) => c.kind === "slither").map((c) => c.runDist + c.stalkDist)),
        chase_swoop_prey_ratio_max: Math.max(0, ...swoops.map((c) => c.ratio)),
        chase_swoop_carried_over_half: swoops.filter((c) => c.ratio >= 0.5 && c.ratio < 0.75).length,
        chase_cutaways: chases.filter((c) => c.kind === "cutaway").length,
        chase_styles: new Set(chases.map((c) => c.style)).size
    });
    out.chases = chases;
}

// MARK: Recipe hunts (ambient prey)

if (parts.has("recipes") && !fixture) {
    type Hunt = {slug: string; template: string; hour: number; seconds: number; catches: number; ok: number; x: number; z: number};
    const hunts: Hunt[] = [];
    const perSpecies = new Map<string, {animals: Set<string>; awake: number; episodes: number; catches: number; ok: number; seconds: number; hours: number[]; templates: Record<string, number>; stalkSlots: number; stalkStill: number; slots: number}>();
    const started = Date.now();
    const SLOT = sched.SLOT_SECONDS;
    // Who can hunt ambient prey or stalk: a species with a catching recipe or a stalk in its profile; two of each at most
    // (a whole day of every animal's trips is the costly part).
    const CATCHES = new Set(["perch_plunge", "air_plunge", "wade_spear", "pouch_scoop", "surface_dive", "chase_fish", "river_fish", "pounce", "hawk_insects", "aerial_hawk", "hover_drop", "bat_hawk", "bat_trawl", "talon_grab"]);
    const most = Number(value("--per-species") ?? "2");
    for (const s of subjects) {
        if (!s.sched || (only && !only.includes(s.animal.model_slug))) continue;
        const slug = s.animal.model_slug;
        if (!(s.profile.weights.stalk ?? 0) && !speciesRecipes(slug).recipes.some((r) => CATCHES.has(r.id))) continue;
        if ((perSpecies.get(slug)?.animals.size ?? 0) >= most) continue;
        const row = perSpecies.get(slug) ?? {animals: new Set<string>(), awake: 0, episodes: 0, catches: 0, ok: 0, seconds: 0, hours: [], templates: {}, stalkSlots: 0, stalkStill: 0, slots: 0};
        row.animals.add(s.animal.id);
        perSpecies.set(slug, row);
        // A whole day of its own slots (its trips, one after the other).
        let trip: Own["trip"] = null;
        const seen = new Set<string>();
        for (let epoch = dayStart; epoch < dayStart + 86400; ) {
            trip = sched.tripAt(world, s.sched.profile, s.sched.animal, epoch, hoursAt, s.animal.activity, trip);
            const span = Math.max(trip.end - trip.start, 1);
            row.slots += span / SLOT;
            if (trip.doing !== "sleep") row.awake += span;
            if (trip.doing === "stalk") {
                row.stalkSlots += span / SLOT;
                const plan = sched.slotPlanAt(world, s.sched.profile, s.sched.animal, trip.start + 1, hoursAt, s.animal.activity);
                if (plan.still) row.stalkStill += span / SLOT;
            }
            const episode = sched.tripEpisode(world, trip);
            if (episode && !seen.has(episode.id)) {
                seen.add(episode.id);
                const tracks = quarriesOf(world, episode);
                if (tracks.length) {
                    row.episodes++;
                    row.catches += tracks.length;
                    row.ok += tracks.filter((q) => q.ok).length;
                    const seconds = episode.t1 - episode.t0;
                    row.seconds += seconds;
                    row.hours.push(hoursAt(trip.start));
                    row.templates[episode.recipe] = (row.templates[episode.recipe] ?? 0) + 1;
                    hunts.push({slug, template: episode.recipe, hour: hoursAt(trip.start), seconds, catches: tracks.length, ok: tracks.filter((q) => q.ok).length, x: episode.anchor.x, z: episode.anchor.z});
                }
            }
            epoch = trip.end + 0.01;
        }
    }
    const rows = Array.from(perSpecies.entries()).filter(([, r]) => r.episodes > 0 || r.stalkSlots > 0);
    console.log(`\n== Visual hunts of ambient prey and stalk slots: a whole day, ${rows.length} species with either (${((Date.now() - started) / 1000).toFixed(0)} s) ==`);
    console.log("species                          n  hunts/animal/day  per awake hour  strikes/day  caught  median s   hours (night 21–5 / dawn-dusk 5–8,17–21 / day)   templates            stalk slots/day (held still)");
    const band = (h: number) => (h >= 21 || h < 5 ? 0 : h < 8 || h >= 17 ? 1 : 2);
    for (const [slug, r] of rows.sort((a, b) => b[1].episodes / b[1].animals.size - a[1].episodes / a[1].animals.size)) {
        const n = r.animals.size;
        const bands = [0, 0, 0];
        for (const h of r.hours) bands[band(h)]++;
        const own = hunts.filter((h) => h.slug === slug);
        console.log(`${slug.padEnd(32)} ${String(n).padStart(2)}  ${f(r.episodes / n, 1).padStart(8)}  ${f(r.episodes / Math.max(r.awake / 3600, 1e-6), 2).padStart(12)}  ${f(r.catches / n, 1).padStart(10)}  ${r.catches ? ((100 * r.ok) / r.catches).toFixed(0).padStart(4) + "%" : "    -"}  ${f(median(own.map((h) => h.seconds)), 0).padStart(6)}   ${bands.map((b) => (r.hours.length ? ((100 * b) / r.hours.length).toFixed(0) + "%" : "-")).join(" / ").padEnd(16)} ${Object.entries(r.templates).map(([k, v]) => `${k} ${v}`).join(", ").padEnd(28)} ${f(r.stalkSlots / n, 1)} (${f(r.stalkStill / n, 1)})`);
    }
    const byTemplate = new Map<string, Hunt[]>();
    for (const h of hunts) byTemplate.set(h.template, [...(byTemplate.get(h.template) ?? []), h]);
    console.log("\ntemplate          hunts  strikes  caught  median s  night / dawn-dusk / day");
    for (const [template, list] of Array.from(byTemplate.entries()).sort((a, b) => b[1].length - a[1].length)) {
        const bands = [0, 0, 0];
        for (const h of list) bands[band(h.hour)]++;
        const strikes = list.reduce((n, h) => n + h.catches, 0);
        console.log(`${template.padEnd(16)} ${String(list.length).padStart(6)}  ${String(strikes).padStart(7)}  ${((100 * list.reduce((n, h) => n + h.ok, 0)) / Math.max(strikes, 1)).toFixed(0).padStart(5)}%  ${f(median(list.map((h) => h.seconds)), 0).padStart(7)}  ${bands.map((b) => ((100 * b) / list.length).toFixed(0) + "%").join(" / ")}`);
    }
    const perDay = rows.filter(([, r]) => r.episodes > 0).map(([, r]) => r.episodes / r.animals.size);
    const stalkers = rows.filter(([, r]) => r.stalkSlots > 0);
    Object.assign(metrics, {
        recipe_hunt_species: perDay.length,
        recipe_hunts_per_day_median: median(perDay),
        recipe_hunts_per_day_max: Math.max(0, ...perDay),
        recipe_hunts: hunts.length,
        stalk_species: stalkers.length,
        stalk_slots_per_day_median: median(stalkers.map(([, r]) => r.stalkSlots / r.animals.size)),
        stalk_still_share: stalkers.reduce((n, [, r]) => n + r.stalkStill, 0) / Math.max(stalkers.reduce((n, [, r]) => n + r.stalkSlots, 0), 1)
    });
    out.recipes = {species: rows.map(([slug, r]) => ({slug, animals: r.animals.size, episodes: r.episodes, catches: r.catches, ok: r.ok, awakeHours: r.awake / 3600, templates: r.templates, stalkSlots: r.stalkSlots, stalkStill: r.stalkStill})), hunts};
}

console.log(`\nmetrics ${JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, Math.round(v * 1000) / 1000])))}`);
const json = value("--json");
if (json) writeFileSync(json, JSON.stringify({metrics, ...out}, null, 1));
const lane = value("--record");
if (lane) {
    const {recordMotionMetric} = await import("../src/lib/ark-motion-metrics.ts");
    for (const [id, v] of Object.entries(metrics)) recordMotionMetric(lane, id, v);
}
