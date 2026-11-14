#!/usr/bin/env -S npx tsx
/**
 * The land audit (behaviours pass 2026-11, lane B4; docs/ark/behaviour-pass-2026-11/land.md): how every animal of a
 * snapshot moves over the ground on the behaviour schedule, against how the real animal moves.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-ground-legs.mts <snapshot.json | --validator>
 *       [--islands <routing.json>] [--world v1|v2] [--rigs <rig-info.json>] [--species a,b] [--windows 12] [--kin 2]
 *       [--plans mammal,reptile,turtle,frog,arthropod,snake,bird] [--json out.json] [--record <lane>] [--list] [--trace]
 *       [--jumps] [--amphibious]
 *
 * For each animal with a ground leg, over twelve 10-minute windows of an island day (as `ark-time-budget.mts`):
 *   - every ground leg its trips make, by what the slot is for (wander, forage, graze, drink, to_roost, play, stalk...):
 *     its speed in m/s and body lengths a second, its Froude number on the hip height (the rig's, `--rigs`; else the
 *     plan's share of its length, `hipShare`), the gait the legged driver draws at that speed (`gaitLadder`), its
 *     length, its time, how straight it is (chord over length) and how much it turns;
 *   - its stay steps (a grazing step, a peck's step, play's dashes): how far and how fast;
 *   - sampled at 10 Hz through `--kin` of the windows: how hard it starts and stops (the speed it has a tenth of a
 *     second after setting off, over its cruise), how fast it turns standing and on the move, how tight (the turn's
 *     radius in body lengths), how much it moves against the way it faces, and for a group on the move how its
 *     members stand to each other (the same velocity as their leader, how near, in file or abreast).
 *
 * `--rigs`: a JSON of each rig's plan, pose, leg count and hip height over its length ({slug: {plan, pose, legs, hip,
 * length, height}}), read from the rig files (the lane's `rig-info-v3.json`); without it the plan comes from the model
 * library and the hip from `hipShare`.
 * A snapshot holds real usernames: read it in place, never copy it. Only species slugs, ids and counts are printed.
 * Pure schedule (the same for every viewer); no browser.
 *
 * Its CI numbers are printed as a last `metrics` line and recorded with `recordMotionMetric` under `--record <lane>`
 * (`tests/ark-motion/metrics.json`, check `b4-ground-legs`, on the validator's animals).
 */
import {readFileSync, writeFileSync} from "node:fs";
import {setArkWorld} from "../src/ark-scene/world.ts";

const RESTING = new Set(["rest", "groom", "bask"]);
const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
setArkWorld((value("--world") ?? "v2") as "v1" | "v2");

const {decodeArkSnapshot} = await import("../src/ark-scene/snapshot.ts");
const {validatorAnimals} = await import("../src/ark-scene/map/validate.ts");
const {arkBody} = await import("../src/ark-scene/stats.ts");
const {behaviourProfile, bodyLengthsPerSecond, runFactor} = await import("../src/ark-scene/behaviour-profile.ts");
const sched = await import("../src/ark-scene/behaviour-schedule.ts");
const {wireRecipes} = await import("../src/ark-scene/behaviour-recipes.ts");
const {eats} = await import("../src/ark-scene/food-links.ts");
const {mapHabitatAt, onSchedule, scheduleRoost} = await import("../src/ark-scene/map/place.ts");
const {placeAnimals} = await import("../src/ark-scene/placement.ts");
const {onBehaviourSchedule} = await import("../src/ark-scene/schedule-water.ts");
const {worldSampler} = await import("../src/ark-scene/world-sampler.ts");
const {heightAt, ZONE_SITES} = await import("../src/ark-scene/world.ts");
const {islandHours} = await import("../src/lib/ark-clock.ts");
const {modelBase} = await import("../src/ark-scene/grounding/base.ts");
const {G, gaitFor, gaitLadder, landGait} = await import("../src/ark-scene/locomotion/gaits.ts");
const {hipShare, sprintPace} = await import("../src/ark-scene/locomotion/flee.ts");
const {locoStyle} = await import("../src/ark-scene/locomotion/styles.ts");

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
type Trip = import("../src/ark-scene/behaviour-schedule.ts").Trip;
type RigInfo = {plan: string | null; pose: string | null; legs: number; hip: number; length: number; height: number};

const source = args[0];
if (!source) throw new Error("usage: ark-ground-legs.mts <snapshot.json | --validator> [--islands routing.json] [--rigs rig-info.json] [--json out.json]");
let animals: ArkAnimal[];
if (source === "--validator") animals = validatorAnimals();
else {
    const routingPath = value("--islands");
    let raw: unknown = JSON.parse(readFileSync(source, "utf8"));
    if (routingPath) raw = (await import("../src/lib/ark-islands-local.ts")).mergeArkIslandsRouting(raw, JSON.parse(readFileSync(routingPath, "utf8"))).merged;
    const local = (await import("../src/lib/ark-local-snapshot.ts")).arkLocalSnapshotOf(raw);
    const snapshot = local?.snapshot ?? decodeArkSnapshot(raw);
    if (!snapshot) throw new Error("not a snapshot");
    animals = routingPath ? (await import("../src/lib/ark-islands.ts")).arkIslandSnapshot(snapshot, "wild").animals : snapshot.animals.filter((a) => !(a as {area?: string | null}).area);
}
const rigs: Record<string, RigInfo> = value("--rigs") ? JSON.parse(readFileSync(value("--rigs")!, "utf8")) : {};
const only = value("--species")?.split(",");
/** `--trace`: print every trip's legs (mode, beat, length, time, speed over its walking pace) of the species looked at. */
const trace = args.includes("--trace");
/**
 * `--jumps`: every two seconds through each window, a step no animal makes (over 6 m/s and ten of its lengths a second,
 * neither end in the air) is printed: a jump at a slot's seam, or a flight shorter than the two seconds.
 */
const jumps = args.includes("--jumps");
let jumpCount = 0;
// (`--follows`: a flock member's take-offs with its leader, and those that are no take-off: its leader only hops, or
// is not in the air at all, and the member is eased to its place by it along the ground, however far off it stood.)
const follows = args.includes("--follows");
let takeOffs = 0;
let easedAlong = 0;
let farCount = 0;
/** `--plans`: only species whose model's plan is one of these (the model library's: mammal, bird, reptile, turtle, frog, arthropod, snake...). */
const onlyPlans = value("--plans")?.split(",");
const windows = Number(value("--windows") ?? "12");
const kinWindows = Number(value("--kin") ?? "2");
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

/** The rig plan of a species: its rig's, else from the talking model's plan (bird, snake...). */
const RIG_PLAN: Record<string, string> = {mammal: "quadruped", reptile: "lizard", arthropod: "insect", bird: "flying_bird", snake: "legless", worm: "legless", butterfly: "flying_insect", spider: "arachnid", crab: "crustacean", frog: "amphibian"};
function planOf(slug: string): string {
    const rig = rigs[slug]?.plan;
    if (rig) return rig;
    const plan = modelBase(slug)?.plan ?? "quadruped";
    return RIG_PLAN[plan] ?? plan;
}
/** Its hip height (m) at a drawn length: the rig's own over its mesh, else its plan's share. */
function hipOf(slug: string, length: number): number {
    const rig = rigs[slug];
    if (rig && rig.hip > 0 && rig.legs >= 2) return Math.max(rig.hip * (length / Math.max(rig.length, rig.height, 1e-6)), 0.002);
    return Math.max(hipShare(planOf(slug)) * length, 0.002);
}
const legsOf = (slug: string, plan: string): number => rigs[slug]?.legs ?? (plan === "legless" ? 0 : plan === "insect" ? 6 : plan === "arachnid" || plan === "crustacean" ? 8 : /bird/.test(plan) ? 2 : 4);
function gaitAt(slug: string, plan: string, froude: number): string {
    const legs = legsOf(slug, plan);
    const ladder = gaitLadder({plan: plan as never, slug, legs: Array.from({length: legs}) as never});
    return gaitFor(ladder, froude, null);
}

const sampler = worldSampler();
const world = sched.scheduleWorld(sampler);
const places = placeAnimals(animals);
type Own = {profile: ReturnType<typeof behaviourProfile>; animal: import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal; trip: Trip | null};
type Subject = {animal: ArkAnimal; place: ReturnType<typeof places.get> & object; length: number; plan: string; sched: Own | null; leader: Subject | null};
const subjects: Subject[] = animals.map((animal) => {
    const place = places.get(animal.id)!;
    const plan = modelBase(animal.model_slug)?.plan ?? null;
    const body = arkBody(animal, plan);
    const on = onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
    return {
        animal,
        place,
        length: body.display,
        plan: planOf(animal.model_slug),
        leader: null,
        sched: on
            ? {
                  profile: behaviourProfile(animal.model_slug, plan),
                  animal: sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone)),
                  trip: null
              }
            : null
    };
});
// The scene's wiring (as `ark-time-budget.mts`): groups, spaced homes, threats, recipes.
{
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
        s.leader = ok;
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

const finite = (list: number[]) => list.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
const quantile = (list: number[], q: number) => {
    const sorted = finite(list);
    return sorted.length ? sorted[Math.min(Math.floor(sorted.length * q), sorted.length - 1)] : NaN;
};
const median = (list: number[]) => quantile(list, 0.5);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** One ground leg as the trip made it. */
type LegRow = {doing: string; beat: string; length: number; seconds: number; speed: number; chord: number; turn: number; corners: number; sharpest: number; points: number};
/** A species' tally. */
type Tally = {
    slug: string;
    plan: string;
    sitting: boolean;
    animals: number;
    length: number;
    hip: number;
    walk: number;
    run: number;
    top: number;
    speedStat: number | null;
    move: string;
    social: string;
    legs: LegRow[];
    steps: Array<{beat: string; dist: number; dur: number}>;
    turns: Array<{angle: number; seconds: number}>;
    pauses: number;
    slots: number;
    movingSlots: number;
    /** Kinematics (10 Hz). */
    kin: {samples: number; moving: number; backwards: number; pivots: number; starts: number[]; stops: number[]; speeds: number[]; slip: number[]; standTurn: number[]; moveTurn: number[]; radius: number[]; accel: number[]; lockstep: number; follow: number; nearest: number[]; along: number[]; across: number[]};
};
const tallies = new Map<string, Tally>();
const start = Date.UTC(2026, 10, 12) / 1000;
const WINDOWS = Array.from({length: windows}, (_, i) => start + i * (86400 / windows));
const WINDOW = 600;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const started = Date.now();

function pathStats(path: Array<{x: number; z: number}>): {chord: number; turn: number; corners: number; sharpest: number} {
    let turn = 0;
    let corners = 0;
    let sharpest = 0;
    for (let i = 1; i + 1 < path.length; i++) {
        const a = Math.atan2(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
        const b = Math.atan2(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
        const d = Math.abs(wrap(b - a));
        turn += d;
        if (d > 0.1) corners++;
        sharpest = Math.max(sharpest, d);
    }
    const first = path[0];
    const last = path[path.length - 1];
    return {chord: Math.hypot(last.x - first.x, last.z - first.z), turn, corners, sharpest};
}

const tripOf = (own: Own, activity: ArkAnimal["activity"], epoch: number): Trip => {
    if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = sched.tripAt(world, own.profile, own.animal, epoch, hoursAt, activity, own.trip);
    return own.trip;
};

for (const s of subjects) {
    if (!s.sched) continue;
    const slug = s.animal.model_slug;
    if (only && !only.includes(slug)) continue;
    if (onlyPlans && !onlyPlans.includes(modelBase(slug)?.plan ?? "")) continue;
    // (`--amphibious`: only those that swim and also walk or fly, as the behaviour audit counts its land and water crossings.)
    if (args.includes("--amphibious")) {
        const q = s.sched.profile;
        if (!((q.move === "swim" || q.moves.includes("swim")) && (q.move === "walk" || q.moves.includes("walk") || q.move === "fly" || q.moves.includes("fly")) && !q.seabed)) continue;
    }
    const own = s.sched;
    const p = own.profile;
    const L = Math.max(s.length, 0.05);
    let t = tallies.get(slug);
    if (!t) {
        const hip = hipOf(slug, s.length);
        const walk = bodyLengthsPerSecond(p) * L;
        t = {slug, plan: s.plan, sitting: Boolean(rigs[slug]?.pose), animals: 0, length: s.length, hip, walk, run: walk * runFactor(p), top: sprintPace({plan: s.plan, slug, length: s.length, speedStat: p.speed}), speedStat: p.speed, move: p.move, social: p.social, legs: [], steps: [], turns: [], pauses: 0, slots: 0, movingSlots: 0, restPairs: 0, restPairWalks: 0, kin: {samples: 0, moving: 0, backwards: 0, pivots: 0, starts: [], wayStarts: [] as number[], stepStarts: [] as number[], stops: [], speeds: [], slip: [], standTurn: [], moveTurn: [], radius: [], accel: [], lockstep: 0, follow: 0, nearest: [], along: [], across: []}};
        tallies.set(slug, t);
    }
    t.animals++;
    WINDOWS.forEach((from, w) => {
        let seen: Trip | null = null;
        for (let at = from; at < from + WINDOW; at += 20) {
            const trip = tripOf(own, s.animal.activity, at);
            if (trip === seen) continue;
            const last: Trip | null = seen;
            seen = trip;
            t!.slots++;
            if (trace) console.log(`${slug} ${s.animal.id.slice(0, 8)} slot ${trip.slot} ${trip.doing} mode ${trip.mode}${trip.running ? " running" : ""} recipe ${trip.recipe ?? "-"} from ${trip.from.x.toFixed(1)},${trip.from.z.toFixed(1)} (ground ${heightAt(trip.from.x, trip.from.z).toFixed(2)}) to ${trip.to.x.toFixed(1)},${trip.to.z.toFixed(1)} (ground ${heightAt(trip.to.x, trip.to.z).toFixed(2)}), ${Math.hypot(trip.to.x - trip.from.x, trip.to.z - trip.from.z).toFixed(1)} m straight, travel ${(trip.arrive - trip.start).toFixed(1)} s: ${trip.legs.map((leg) => `${leg.mode}/${leg.beat} ${leg.length.toFixed(2)} m ${leg.seconds.toFixed(1)} s${leg.seconds > 0 && leg.length > 0 ? ` (${(leg.length / leg.seconds / Math.max(t!.walk, 1e-9)).toFixed(2)}x)` : ""}`).join(" | ")}`);
            let groundLegs = 0;
            for (const leg of trip.legs) {
                if (leg.mode === "pause") {
                    if (leg.turn) t!.turns.push({angle: Math.abs(wrap((leg.yaw ?? 0) - (trip.from.yaw ?? leg.yaw ?? 0))), seconds: leg.seconds});
                    else t!.pauses++;
                }
                if (leg.mode !== "ground" || !(leg.seconds > 0) || !(leg.length > 0.01)) continue;
                groundLegs++;
                const stats = pathStats(leg.path ?? [leg.from, leg.to]);
                // (Its speed on the way: its time less half its getting going and its stopping, `leg.shape`.)
                const ramps = leg.shape && !leg.shape.rhythm ? Math.min((leg.shape.start + leg.shape.stop) / 2, leg.seconds / 2) : 0;
                t!.legs.push({doing: trip.doing, beat: leg.beat, length: leg.length, seconds: leg.seconds, speed: leg.length / (leg.seconds - ramps), points: (leg.path ?? []).length, ...stats});
            }
            if (groundLegs) t!.movingSlots++;
            if (follows && s.leader?.sched) {
                let at = trip.start;
                for (const leg of trip.legs) {
                    if (leg.mode === "shadow" && leg.lead0) {
                        takeOffs++;
                        const flat = Math.hypot(leg.lead0.x, leg.lead0.z);
                        const lt = tripOf(s.leader.sched, s.leader.animal.activity, at + 0.01);
                        let la = lt.start;
                        let under: {mode: string; seconds: number; length: number} | null = null;
                        for (const ll of lt.legs) {
                            if (at + 0.01 >= la && at + 0.01 < la + ll.seconds) under = {mode: ll.mode, seconds: ll.seconds, length: ll.length};
                            la += ll.seconds;
                        }
                        if (flat > Math.max(L * 2, 1) && !(under?.mode === "air" && under.seconds >= 3)) {
                            easedAlong++;
                            console.log(`eased ${slug} ${s.animal.id.slice(0, 8)} slot ${trip.slot}: ${flat.toFixed(1)} m from its place by its leader, whose leg then is ${under ? `${under.mode} ${under.length.toFixed(1)} m ${under.seconds.toFixed(1)} s` : "a stay"}`);
                        }
                    }
                    at += leg.seconds;
                }
            }
            // (The merged tree: a rest that follows a rest in the slot before, and whether it walked somewhere for it: a rest
            // keeps its place through its spell, lane B3 needs.)
            if (last && last.slot === trip.slot - 1 && RESTING.has(last.doing) && RESTING.has(trip.doing)) {
                t!.restPairs++;
                if (trip.legs.some((leg) => leg.mode === "ground" && leg.length > Math.max(L * 0.5, 0.1))) t!.restPairWalks++;
            }
            let before = {x: trip.to.x, z: trip.to.z};
            trip.stay.forEach((b) => {
                const dist = Math.hypot(b.x - before.x, b.z - before.z);
                if (dist > 1e-4) t!.steps.push({beat: b.beat, dist, dur: b.dur ?? (b.beat === "play" ? 0.8 : b.beat === "stalk" ? 2.5 : 1.2)});
                before = {x: b.x, z: b.z};
            });
        }
        if (jumps) {
            let before: {x: number; z: number; aloft: boolean; doing: string; slot: number} | null = null;
            // (And the behaviour audit's own measure of a snapped crossing, `ark-audit/metrics.ts`: further in 30 s than
            // 6 m/s or ten lengths a second takes it, neither end in the air: a way squeezed into its slot at a sprint.)
            const trail: Array<{x: number; z: number; aloft: boolean}> = [];
            for (let at = from; at < from + WINDOW; at += 2) {
                const trip = tripOf(own, s.animal.activity, at);
                const pose = sched.poseOnTrip(world, trip, at);
                const now = {x: pose.x, z: pose.z, aloft: Boolean(pose.aloft) || pose.beat === "fly" || pose.beat === "glide", doing: trip.doing, slot: trip.slot};
                if (before && !before.aloft && !now.aloft && Math.hypot(now.x - before.x, now.z - before.z) > Math.max(6, L * 10) * 2) {
                    jumpCount++;
                    console.log(`jump ${slug} ${s.animal.id.slice(0, 8)} at ${at}: ${Math.hypot(now.x - before.x, now.z - before.z).toFixed(1)} m in 2 s, ${before.doing} (slot ${before.slot}) -> ${now.doing} (slot ${now.slot}); legs ${trip.legs.map((leg) => `${leg.mode} ${leg.length.toFixed(1)} m ${leg.seconds.toFixed(1)} s`).join(" | ")}`);
                }
                const ago = trail.length >= 15 ? trail[trail.length - 15] : null;
                if (ago && !ago.aloft && !now.aloft && Math.hypot(now.x - ago.x, now.z - ago.z) > Math.max(6, L * 10) * 30) {
                    farCount++;
                    console.log(`far ${slug} ${s.animal.id.slice(0, 8)} at ${at}: ${Math.hypot(now.x - ago.x, now.z - ago.z).toFixed(0)} m in 30 s, ${trip.doing} mode ${trip.mode}${trip.running ? " running" : ""}; legs ${trip.legs.map((leg) => `${leg.mode}/${leg.beat} ${leg.length.toFixed(1)} m ${leg.seconds.toFixed(1)} s`).join(" | ")}`);
                    trail.length = 0;
                }
                trail.push(now);
                before = now;
            }
        }
        if (w >= kinWindows) return;
        // 10 Hz through the window's moves (each trip's way there and two seconds on, and each step of its stay):
        // starts, stops, turns, backwards, and the group.
        const dt = 0.1;
        // (Each span: from, to, and whether it is a trip's way, not a step of its stay.)
        const spans: Array<[number, number, boolean]> = [];
        for (let at = from; at < from + WINDOW; ) {
            const trip = tripOf(own, s.animal.activity, at);
            const moves = trip.legs.some((leg) => leg.mode === "ground" || leg.mode === "shadow");
            if (moves) spans.push([Math.max(trip.start, from), Math.min(trip.arrive + 2, trip.end, from + WINDOW), true]);
            let before = {x: trip.to.x, z: trip.to.z};
            for (const b of trip.stay) {
                if (Math.hypot(b.x - before.x, b.z - before.z) > 1e-4) spans.push([trip.arrive + b.at - 0.3, Math.min(trip.arrive + b.at + (b.dur ?? 1.2) + 0.5, trip.end), false]);
                before = {x: b.x, z: b.z};
            }
            at = trip.end + 0.001;
        }
        const k = t!.kin;
        for (const [a, b, way] of spans) {
            let prev: {x: number; z: number; yaw: number; v: number; before: number; moving: boolean; aloft: boolean; run: number} | null = null;
            let lead: {x: number; z: number} | null = null;
            for (let epoch = a; epoch <= b; epoch += dt) {
                const trip = tripOf(own, s.animal.activity, epoch);
                const pose = sched.poseOnTrip(world, trip, epoch);
                const wetNow = heightAt(pose.x, pose.z) < 0 || pose.beat === "swim";
                const now = {x: pose.x, z: pose.z, yaw: pose.yaw, v: 0, moving: false, aloft: pose.aloft || wetNow || pose.beat === "fly" || pose.beat === "glide" || pose.beat === "climb", run: 0, before: prev?.v ?? 0};
                let leadNow: {x: number; z: number} | null = null;
                if (s.leader?.sched) {
                    const lt = tripOf(s.leader.sched, s.leader.animal.activity, epoch);
                    const lp = sched.poseOnTrip(world, lt, epoch);
                    leadNow = {x: lp.x, z: lp.z};
                }
                if (prev && !prev.aloft && !now.aloft) {
                    const dx = now.x - prev.x;
                    const dz = now.z - prev.z;
                    const d = Math.hypot(dx, dz);
                    // (A slot's seam or an act's cut is no step.)
                    if (d < Math.max(L * 3, 1.5)) {
                        now.v = d / dt;
                        // (On the move: over a fifth of its walking pace, so a slow walker counts and a flock member's slow
                        // drift by its leader does not.)
                        now.moving = now.v > Math.max(0.02 * L, 0.2 * t!.walk);
                        now.run = now.moving ? prev.run + 1 : 0;
                        k.samples++;
                        const yawRate = Math.abs(wrap(now.yaw - prev.yaw)) / dt;
                        if (now.moving) {
                            k.moving++;
                            const heading = Math.atan2(dx, dz);
                            if (Math.cos(wrap(heading - now.yaw)) < -0.2) k.backwards++;
                            k.slip.push(Math.abs(wrap(heading - now.yaw)));
                            if (yawRate > 0.02) {
                                k.moveTurn.push(yawRate);
                                const radius = now.v / yawRate / L;
                                k.radius.push(radius);
                                // Pivoting at speed: a turn tighter than half its length while at a walk or more.
                                if (radius < 0.5 && now.v > 0.5 * t!.walk) k.pivots++;
                            }
                            // The speed it has in its second tenth of a second on the move (the first is a part of one).
                            if (now.run === 2) {
                                k.starts.push(now.v);
                                (way ? k.wayStarts : k.stepStarts).push(now.v);
                            }
                            k.accel.push(Math.abs(now.v - prev.v) / dt);
                            k.speeds.push(now.v);
                            if (leadNow && lead) {
                                const lvx = (leadNow.x - lead.x) / dt;
                                const lvz = (leadNow.z - lead.z) / dt;
                                const lv = Math.hypot(lvx, lvz);
                                if (lv > 0.05 * L) {
                                    k.follow++;
                                    if (Math.hypot(dx / dt - lvx, dz / dt - lvz) < 0.03 * Math.max(lv, 1e-6)) k.lockstep++;
                                    // Where it is from its leader, along and across the leader's way (body lengths).
                                    const ux = lvx / lv;
                                    const uz = lvz / lv;
                                    const rx = now.x - leadNow.x;
                                    const rz = now.z - leadNow.z;
                                    k.along.push((rx * ux + rz * uz) / L);
                                    k.across.push((rx * uz - rz * ux) / L);
                                }
                            }
                        } else {
                            if (yawRate > 0.02) k.standTurn.push(yawRate);
                            // The speed it had a tenth of a second before its last moving one (that one is a part of one).
                            if (prev.moving && prev.run >= 2) k.stops.push(prev.before);
                        }
                    }
                }
                prev = now;
                lead = leadNow;
            }
        }
    });
}

type Row = ReturnType<typeof rowOf>;
function rowOf(t: Tally) {
    const L = Math.max(t.length, 0.05);
    const fr = (v: number) => (v * v) / (G * t.hip);
    const walkLegs = t.legs.filter((l) => l.beat !== "run");
    const runLegs = t.legs.filter((l) => l.beat === "run");
    const v = median(walkLegs.map((l) => l.speed));
    const vRun = median(runLegs.map((l) => l.speed));
    const byDoing: Record<string, {n: number; speed: number; length: number; seconds: number; straight: number}> = {};
    for (const doing of new Set(t.legs.map((l) => l.doing))) {
        const legs = t.legs.filter((l) => l.doing === doing);
        byDoing[doing] = {n: legs.length, speed: r3(median(legs.map((l) => l.speed))), length: r2(median(legs.map((l) => l.length))), seconds: r2(median(legs.map((l) => l.seconds))), straight: r3(median(legs.map((l) => l.chord / Math.max(l.length, 1e-6))))};
    }
    const stepSpeed = median(t.steps.filter((x) => x.beat === "step").map((x) => x.dist / x.dur));
    const playSpeed = median(t.steps.filter((x) => x.beat === "play").map((x) => x.dist / x.dur));
    return {
        slug: t.slug,
        plan: t.plan,
        sitting: t.sitting,
        animals: t.animals,
        length: r3(t.length),
        hip: r3(t.hip),
        move: t.move,
        social: t.social,
        speedStat: t.speedStat,
        land: landGait(t.slug),
        ground: locoStyle(t.slug, t.plan).ground?.gait ?? null,
        legless: locoStyle(t.slug, t.plan).legless ?? null,
        // The paces the schedule walks and runs it at, and its top speed (allometry and its speed stat).
        walk: r3(t.walk),
        walkBls: r3(t.walk / L),
        walkFroude: r3(fr(t.walk)),
        walkGait: gaitAt(t.slug, t.plan, fr(t.walk)),
        run: r3(t.run),
        runFroude: r3(fr(t.run)),
        runGait: gaitAt(t.slug, t.plan, fr(t.run)),
        top: r3(t.top),
        // What its legs really did.
        legs: t.legs.length,
        legSpeed: r3(v),
        legFroude: r3(fr(v)),
        legGait: Number.isFinite(v) ? gaitAt(t.slug, t.plan, fr(v)) : null,
        runLegs: runLegs.length,
        runLegSpeed: r3(vRun),
        runLegGait: Number.isFinite(vRun) ? gaitAt(t.slug, t.plan, fr(vRun)) : null,
        legLength: r2(median(t.legs.map((l) => l.length))),
        legLengthBody: r2(median(t.legs.map((l) => l.length)) / L),
        legSeconds: r2(median(t.legs.map((l) => l.seconds))),
        legSecondsP90: r2(quantile(t.legs.map((l) => l.seconds), 0.9)),
        // Legs hurried past its pace (a way too long for its slot is squeezed into it): over 1.3 of its walk's (its run's on a run leg).
        // (Legs of two seconds or more: a shorter one is all getting going and stopping.)
        hurried: r3(t.legs.filter((l) => l.seconds >= 2 && l.speed > 1.3 * (l.beat === "run" ? t.run : t.walk)).length / Math.max(t.legs.filter((l) => l.seconds >= 2).length, 1)),
        straight: r3(median(t.legs.map((l) => l.chord / Math.max(l.length, 1e-6)))),
        straightLegs: r3(t.legs.filter((l) => l.points <= 2).length / Math.max(t.legs.length, 1)),
        legTurn: r3(median(t.legs.map((l) => l.turn))),
        sharpest: r3(quantile(t.legs.map((l) => l.sharpest), 0.9)),
        movingSlots: r3(t.movingSlots / Math.max(t.slots, 1)),
        pausesPerLeg: r3(t.pauses / Math.max(t.legs.length, 1)),
        turnLegs: t.turns.length,
        turnRate: r3(median(t.turns.map((x) => x.angle / Math.max(x.seconds, 1e-6)))),
        steps: t.steps.length,
        stepSpeed: r3(stepSpeed),
        stepFroude: r3(fr(stepSpeed)),
        stepDist: r3(median(t.steps.filter((x) => x.beat === "step").map((x) => x.dist)) / L),
        playSpeed: r3(playSpeed),
        playGait: Number.isFinite(playSpeed) ? gaitAt(t.slug, t.plan, fr(playSpeed)) : null,
        byDoing,
        // Kinematics.
        movingShare: r3(t.kin.moving / Math.max(t.kin.samples, 1)),
        backwards: r3(t.kin.backwards / Math.max(t.kin.moving, 1)),
        pivots: r3(t.kin.pivots / Math.max(t.kin.moving, 1)),
        starts: t.kin.starts.length,
        startShare: r3(median(t.kin.starts) / Math.max(quantile(t.kin.speeds, 0.75) || t.walk, 1e-6)),
        // (The merged tree: the same on its ways alone and on the steps of its stays alone, over its walk's pace: a stay's
        // step is short and starts harder, and a day in feeding bouts has more of them.)
        restPairs: t.restPairs,
        restPairWalks: t.restPairWalks,
        wayStarts: t.kin.wayStarts.length,
        stepStarts: t.kin.stepStarts.length,
        wayStartShare: r3(median(t.kin.wayStarts) / Math.max(t.walk, 1e-6)),
        stepStartShare: r3(median(t.kin.stepStarts) / Math.max(t.walk, 1e-6)),
        stopShare: r3(median(t.kin.stops) / Math.max(quantile(t.kin.speeds, 0.75) || t.walk, 1e-6)),
        slipP90: r3(quantile(t.kin.slip, 0.9)),
        accelP99: r2(quantile(t.kin.accel, 0.99)),
        standTurnP90: r2(quantile(t.kin.standTurn, 0.9)),
        moveTurnP90: r2(quantile(t.kin.moveTurn, 0.9)),
        radiusP10: r2(quantile(t.kin.radius, 0.1)),
        follow: t.kin.follow,
        lockstep: r3(t.kin.lockstep / Math.max(t.kin.follow, 1)),
        alongSpread: r2(quantile(t.kin.along.map(Math.abs), 0.5)),
        acrossSpread: r2(quantile(t.kin.across.map(Math.abs), 0.5))
    };
}
const rows = Array.from(tallies.values()).map(rowOf).filter((r) => r.legs > 0 || r.steps > 0);
console.log(`${subjects.filter((s) => s.sched).length} animals on the schedule, ${rows.length} species with ground legs or steps, ${rows.reduce((n, r) => n + r.legs, 0)} ground legs (${((Date.now() - started) / 1000).toFixed(0)} s)`);

// The table by body plan.
const plans = Array.from(new Set(rows.map((r) => r.plan))).sort();
const pad = (v: unknown, n: number) => String(v).padStart(n);
console.log("\nby plan: species | walk m/s (median) | walk Froude p10 / median / p90 | gait drawn at the walk | start share | lockstep");
for (const plan of plans) {
    const of = rows.filter((r) => r.plan === plan && r.legs > 0);
    if (!of.length) continue;
    const gaits: Record<string, number> = {};
    for (const r of of) gaits[r.legGait ?? "-"] = (gaits[r.legGait ?? "-"] ?? 0) + 1;
    console.log(`${plan.padEnd(16)} ${pad(of.length, 4)}  ${pad(r3(median(of.map((r) => r.legSpeed))), 6)}  Fr ${pad(r3(quantile(of.map((r) => r.legFroude), 0.1)), 6)} / ${pad(r3(median(of.map((r) => r.legFroude))), 6)} / ${pad(r3(quantile(of.map((r) => r.legFroude), 0.9)), 6)}  ${JSON.stringify(gaits)}  start ${r2(median(of.map((r) => r.startShare).filter(Number.isFinite)))}  lockstep ${r2(median(of.filter((r) => r.follow > 20).map((r) => r.lockstep)))}`);
}
if (follows) console.log(`follows: ${takeOffs} take-offs with a leader; eased along the ground to a leader that only hops or stands: ${easedAlong}`);
if (jumps) console.log(`jumps: ${jumpCount}; further in 30 s than a sprint takes it: ${farCount}`);
if (args.includes("--list")) {
    console.log("\nper species: slug plan n L hip | walk m/s bls Fr gait | run m/s gait | top | legs: median speed, length (m, body lengths), seconds, straightness | step m/s | start share | backwards | lockstep");
    for (const r of rows.sort((a, b) => (Number.isFinite(b.legFroude) ? b.legFroude : -1) - (Number.isFinite(a.legFroude) ? a.legFroude : -1))) {
        console.log(`${r.slug.padEnd(30)} ${r.plan.padEnd(14)} n=${pad(r.animals, 2)} L ${pad(r.length, 6)} hip ${pad(r.hip, 5)} | walk ${pad(r.walk, 6)} ${pad(r.walkBls, 5)}/s Fr ${pad(r.walkFroude, 6)} ${String(r.walkGait).padEnd(10)} | run ${pad(r.run, 6)} ${String(r.runGait).padEnd(10)} | top ${pad(r.top, 5)} | ${pad(r.legs, 4)} legs ${pad(r.legSpeed, 6)} m/s ${pad(r.legLength, 6)} m (${pad(r.legLengthBody, 5)} L) ${pad(r.legSeconds, 5)} s straight ${pad(r.straight, 5)} | step ${pad(r.stepSpeed, 6)} | start ${pad(r.startShare, 5)} | back ${pad(r.backwards, 5)} | lock ${pad(r.lockstep, 5)}${r.sitting ? " sitting" : ""}`);
    }
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));

// The CI numbers.
{
    const legged = rows.filter((r) => r.legs >= 3 && r.plan !== "legless");
    const walkers = legged.filter((r) => ["quadruped", "primate", "walking_bird", "flightless_bird", "flying_bird", "lizard", "turtle", "amphibian"].includes(r.plan));
    const WALKS = new Set(["walk", "ds_walk", "biped_walk", "waddle", "sprawl", "wave", "amble", "stand", "hop"]);
    const metrics: Record<string, number> = {
        species: legged.length,
        // Species whose everyday walking leg is drawn as a faster gait than a walk (a trot, a pace, a bound, a run).
        // (Not a sitting rig: it goes by its baked bound, whatever its legs' Froude number says.)
        walk_drawn_as_run_species: walkers.filter((r) => !r.sitting && r.legGait !== null && !WALKS.has(r.legGait)).length,
        walk_froude_median: median(walkers.map((r) => r.legFroude)),
        walk_froude_p90: quantile(walkers.map((r) => r.legFroude), 0.9),
        // Walking faster than its own top speed (allometry and its speed stat).
        walk_over_top_species: legged.filter((r) => r.legSpeed > r.top).length,
        // How hard it sets off: the speed a tenth of a second in, over its walking speed (1: at full speed from its first frame).
        start_share_median: median(legged.map((r) => r.startShare).filter(Number.isFinite)),
        stop_share_median: median(legged.map((r) => r.stopShare).filter(Number.isFinite)),
        // The same for animals over a metre long, whose getting going takes more than the two tenths of a second measured.
        start_share_big_median: median(legged.filter((r) => r.length > 1 && r.starts >= 3).map((r) => r.startShare).filter(Number.isFinite)),
        stop_share_big_median: median(legged.filter((r) => r.length > 1 && r.starts >= 3).map((r) => r.stopShare).filter(Number.isFinite)),
        backwards_share: legged.reduce((n, r) => n + r.backwards * r.movingShare, 0) / Math.max(legged.reduce((n, r) => n + r.movingShare, 0), 1e-9),
        pivots_share_worst: Math.max(0, ...legged.map((r) => r.pivots)),
        lockstep_median: median(rows.filter((r) => r.follow > 20).map((r) => r.lockstep)),
        // Ground legs hurried past 1.3 of its pace (squeezed into the slot), over every leg; and the species with over a tenth of theirs so.
        hurried_legs_share: legged.reduce((n, r) => n + r.hurried * r.legs, 0) / Math.max(legged.reduce((n, r) => n + r.legs, 0), 1),
        hurried_species: legged.filter((r) => r.hurried > 0.1).length,
        straight_legs_share: median(legged.map((r) => r.straightLegs)),
        // Of the rests that follow a rest in the slot before, those that walk somewhere for it (over every animal on foot).
        rest_in_a_row_walks_share: rows.reduce((n, r) => n + r.restPairWalks, 0) / Math.max(rows.reduce((n, r) => n + r.restPairs, 0), 1),
        rest_in_a_row_walks_species: rows.filter((r) => r.restPairs >= 5 && r.restPairWalks > 0.2 * r.restPairs).length,
        // Its start on a way and on a step of its stay, apart (animals over a metre long): over its walk's pace.
        way_start_share_big_median: median(legged.filter((r) => r.length > 1 && r.wayStarts >= 3).map((r) => r.wayStartShare).filter(Number.isFinite)),
        step_start_share_big_median: median(legged.filter((r) => r.length > 1 && r.stepStarts >= 3).map((r) => r.stepStartShare).filter(Number.isFinite)),
        step_starts_share_big: legged.filter((r) => r.length > 1).reduce((n, r) => n + r.stepStarts, 0) / Math.max(legged.filter((r) => r.length > 1).reduce((n, r) => n + r.starts, 0), 1)
    };
    console.log(`metrics ${JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, r3(v)])))}`);
    const lane = value("--record");
    if (lane) {
        const {recordMotionMetric} = await import("../src/lib/ark-motion-metrics.ts");
        for (const [id, v] of Object.entries(metrics)) recordMotionMetric(lane, id, v);
    }
}
export type {Row};
