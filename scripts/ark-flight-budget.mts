#!/usr/bin/env -S npx tsx
/**
 * The flight budget (behaviours pass, lane B5 air, 2026-11-14; docs/ark/behaviour-pass-2026-11/air.md): what every
 * animal that flies does in the air and between flights on the behaviour schedule, second by second, so a family can be
 * judged against the real birds, bats and insects. It is the time budget's wiring (`scripts/ark-time-budget.mts`) with a
 * one-second step and a record per flight.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-flight-budget.mts <snapshot.json | --validator>
 *       [--islands <routing.json>] [--world v1|v2] [--windows 12] [--window 900] [--species a,b] [--json out.json]
 *       [--flights out.jsonl] [--record <lane>] [--quiet]
 *
 * Per flying species: flights per awake hour; a flight's length in seconds and metres (median, the longest); its height
 * over what is under it; the shares of its flights that are hops, perch to perch, up to a perch, long ways, rounds,
 * soars, hawking and a flock member's flight with its leader; the hours of the day flown; how far a flock's members are
 * from their leader in the air and how many are up with it; and the beat that follows a landing. By way of life
 * (`flightWay`) the medians are printed first. A snapshot holds real usernames: read it in place, never copy it. Only
 * species slugs, ids and counts are printed. Pure schedule (the same for every viewer); no browser.
 *
 * The windows are `--windows` of `--window` seconds, spread evenly over a day from 2026-11-12 00:00 UTC (the island's
 * hours follow the real clock).
 *
 * The lane's CI numbers are printed as a last `metrics` line and, under the motion summary (`scripts/ark-motion-ci.mts`
 * sets `ARK_MOTION_METRICS_DIR`), recorded with `recordMotionMetric` under `--record <lane>`.
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
const {arkBody} = await import("../src/ark-scene/stats.ts");
const {behaviourProfile} = await import("../src/ark-scene/behaviour-profile.ts");
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
const {topOf} = await import("../src/ark-scene/behaviour-water.ts");
const flightModule = await import("../src/ark-scene/locomotion/flight.ts");
const {flightSpec} = flightModule;
/** Its way of life in the air (`locomotion/flight.ts` flightWay), where this tree has it; else "-". */
const wayOf: (slug: string) => string = (flightModule as unknown as {flightWay?: (slug: string) => string | null}).flightWay ? (slug) => (flightModule as unknown as {flightWay: (slug: string) => string | null}).flightWay(slug) ?? "-" : () => "-";

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
type Trip = import("../src/ark-scene/behaviour-schedule.ts").Trip;
const source = args[0];
if (!source) throw new Error("usage: ark-flight-budget.mts <snapshot.json | --validator> [--islands routing.json] [--world v2] [--json out.json]");
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
const only = value("--species")?.split(",");
const windows = Number(value("--windows") ?? "12");
const windowSeconds = Number(value("--window") ?? "900");
const quiet = args.includes("--quiet");
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const families = (() => {
    try {
        const table = JSON.parse(readFileSync(new URL("../data/ark/locomotion-styles.json", import.meta.url), "utf8")) as {species: Record<string, {flight?: {why: string}}>};
        return (slug: string) => table.species[slug]?.flight?.why.split(":")[0].trim() ?? "?";
    } catch {
        return () => "?";
    }
})();

const sampler = worldSampler();
const world = sched.scheduleWorld(sampler);
const places = placeAnimals(animals);
type Own = {profile: ReturnType<typeof behaviourProfile>; animal: import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal; trip: Trip | null};
type Subject = {animal: ArkAnimal; place: ReturnType<typeof places.get> & object; length: number; sched: Own | null; leader: Subject | null};
const subjects: Subject[] = animals.map((animal) => {
    const place = places.get(animal.id)!;
    const plan = modelBase(animal.model_slug)?.plan ?? null;
    const body = arkBody(animal, plan);
    const on = onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
    return {
        animal,
        place,
        length: body.display,
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
// The scene's wiring (as `scripts/ark-time-budget.mts`): groups, spaced homes, threats, recipes.
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

// MARK: Sampling

type Surface = "ground" | "perch" | "water";
type Flight = {slug: string; id: string; t0: number; hour: number; seconds: number; metres: number; across: number; agl: number; turned: number; doing: string; recipe: string | null; flock: boolean; from: Surface; to: Surface | null; after: string | null; kind: string};
type Row = {
    slug: string; family: string; way: string; move: string; plan: string; animals: number; awake: number; asleep: number; air: number; takeoffs: number; flights: Flight[]; hours: number[]; awakeHours: number[]; agls: number[];
    woods: number; inCrown: number; sits: number[]; flockLeadAir: number; flockUpWith: number; flockMembers: number; flockDist: number[]; memberAlone: number; cruise: number | null; weights: string; airStay: number; nightAir: number; dayAir: number; shadowDown: number; shadowFloat: number;
};
/** The socials whose members fly with their leader (`behaviour-schedule.ts` FLOCKING), and a colony's. */
const FLOCKS = new Set(["flock", "swarm", "colony"]);
const HAWKING = new Set(["aerial_hawk", "hawk_insects", "bat_hawk", "hover_drop", "air_stay", "sally", "hover_feed", "murmuration"]);
const flyers = subjects.filter((s) => s.sched && (s.sched.profile.move === "fly" || s.sched.profile.moves.includes("fly")) && (!only || only.includes(s.animal.model_slug)));
const rows = new Map<string, Row>();
const start = Date.UTC(2026, 10, 12) / 1000;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const top = (x: number, z: number) => topOf(sampler, x, z);
const wetAt = (x: number, z: number) => sampler.heightAt(x, z) < top(x, z) - 0.01;
const surfaceOfPose = (p: {x: number; y: number; z: number}): Surface => (p.y > top(p.x, p.z) + 0.4 ? "perch" : wetAt(p.x, p.z) ? "water" : "ground");
type Live = {was: {x: number; y: number; z: number; aloft: boolean} | null; flight: (Flight & {x0: number; z0: number; heading: number | null}) | null; landed: {flight: Flight; at: number} | null; sat: number; pose: {x: number; y: number; z: number; aloft: boolean} | null};
const live = new Map<Subject, Live>();
const flockPending = new Map<Subject, {flight: {metres: number}; air: number; up: number; dists: number[]}>();
const started = Date.now();
const flightsOut: Flight[] = [];
// `--trips <slug>`: each slot's trip of that species' animals over an hour from `--from` (island hour, default 12): for finding out why something flies.
const tripsOf = value("--trips");
if (tripsOf) {
    const from = start + Number(value("--from") ?? "12") * 3600;
    for (const s of flyers.filter((x) => x.animal.model_slug === tripsOf).slice(0, 2)) {
        const own = s.sched!;
        console.log(`${tripsOf} ${s.animal.id.slice(0, 8)} home ${own.animal.home.x.toFixed(0)},${own.animal.home.z.toFixed(0)} range ${own.animal.range ?? "-"} group ${own.animal.group ? `rank ${own.animal.group.rank}` : "-"}`);
        let trip = sched.tripAt(world, own.profile, own.animal, from, hoursAt, s.animal.activity);
        for (let k = 0; k < 45; k++) {
            const f = trip.from;
            const t = trip.to;
            console.log(`  slot ${trip.slot} ${trip.doing.padEnd(8)} ${trip.mode.padEnd(6)} ${trip.recipe ?? ""}${trip.shadow ? " follows" : ""} from ${f.x.toFixed(1)},${f.y.toFixed(1)},${f.z.toFixed(1)} (${surfaceOfPose(f)}) to ${t.x.toFixed(1)},${t.y.toFixed(1)},${t.z.toFixed(1)} (${surfaceOfPose(t)}) ${Math.hypot(t.x - f.x, t.z - f.z).toFixed(1)} m | ${trip.legs.map((leg) => `${leg.mode} ${leg.length.toFixed(1)} m ${leg.seconds.toFixed(1)} s`).join(", ")}`);
            trip = sched.tripAt(world, own.profile, own.animal, trip.end + 0.01, hoursAt, s.animal.activity, trip);
        }
    }
    process.exit(0);
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
for (let w = 0; w < windows; w++) {
    const from = start + Math.round((w * 86400) / windows);
    for (const s of flyers) live.set(s, {was: null, flight: null, landed: null, sat: 0, pose: null});
    for (let t = 0; t < windowSeconds; t++) {
        const epoch = from + t;
        const hour = hoursAt(epoch);
        for (const s of flyers) {
            const own = s.sched!;
            const slug = s.animal.model_slug;
            let row = rows.get(slug);
            if (!row) {
                const plan = modelBase(slug)?.plan ?? "?";
                rows.set(slug, (row = {slug, family: families(slug), way: wayOf(slug), move: own.profile.move, plan, animals: 0, awake: 0, asleep: 0, air: 0, takeoffs: 0, flights: [], hours: new Array(24).fill(0), awakeHours: new Array(24).fill(0), agls: [], woods: 0, inCrown: 0, sits: [], flockLeadAir: 0, flockUpWith: 0, flockMembers: 0, flockDist: [], memberAlone: 0, cruise: flightSpec(slug, s.length, plan)?.cruise ?? null, weights: Object.entries(own.profile.weights).filter(([k]) => ["fly", "soar", "perch", "forage", "rest", "wander"].includes(k)).map(([k, v]) => `${k} ${(v as number).toFixed(2)}`).join(" "), airStay: 0, nightAir: 0, dayAir: 0, shadowDown: 0, shadowFloat: 0}));
            }
            if (w === 0 && t === 0) row.animals++;
            if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = sched.tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, own.trip);
            const trip = own.trip;
            const at = sched.poseOnTrip(world, trip, epoch);
            const state = live.get(s)!;
            state.pose = {x: at.x, y: at.y, z: at.z, aloft: at.aloft};
            const asleep = trip.doing === "sleep";
            if (asleep) row.asleep++;
            else {
                row.awake++;
                row.awakeHours[Math.floor(hour) % 24]++;
            }
            const recipe = at.act?.recipe ?? trip.recipe ?? null;
            if (at.aloft) {
                row.air++;
                row.hours[Math.floor(hour) % 24]++;
                if (hour < 5 || hour >= 20) row.nightAir++;
                else row.dayAir++;
                const under = top(at.x, at.z);
                const agl = at.y - under;
                if (row.agls.length < 20000) row.agls.push(agl);
                const crown = sampler.canopyTop ? sampler.canopyTop(at.x, at.z) : -Infinity;
                if (crown > under + 2) {
                    row.woods++;
                    if (at.y < crown && sampler.canopyBase && at.y > sampler.canopyBase(at.x, at.z)) row.inCrown++;
                }
                if (recipe === "air_stay") row.airStay++;
                if (!state.flight) {
                    row.takeoffs++;
                    if (state.sat > 0) row.sits.push(state.sat);
                    state.sat = 0;
                    const before = state.was ?? at;
                    state.flight = {slug, id: s.animal.id, t0: epoch, hour, seconds: 0, metres: 0, across: 0, agl: 0, turned: 0, doing: trip.doing, recipe, flock: Boolean(trip.shadow), from: surfaceOfPose(before), to: null, after: null, kind: "", x0: before.x, z0: before.z, heading: null};
                }
                const f = state.flight;
                f.seconds++;
                f.agl = Math.max(f.agl, agl);
                if (recipe && !f.recipe) f.recipe = recipe;
                if (trip.shadow) f.flock = true;
                if (trip.doing === "soar") f.doing = "soar";
                if (state.was) {
                    const dx = at.x - state.was.x;
                    const dz = at.z - state.was.z;
                    const step = Math.hypot(dx, dz);
                    f.metres += step;
                    if (step > 0.05) {
                        const h = Math.atan2(dx, dz);
                        if (f.heading !== null) f.turned += Math.abs(wrap(h - f.heading));
                        f.heading = h;
                    }
                }
                f.across = Math.hypot(at.x - f.x0, at.z - f.z0);
            } else {
                // A flock member beside its leader while neither is up: is it on something, or hanging in the air by a perch?
                if (trip.shadow && !asleep) {
                    row.shadowDown++;
                    // (Not where it waits for its leader's take-off, nor where it has come down: up off the ground between.)
                    if (at.y > top(at.x, at.z) + 0.5 && Math.hypot(at.x - trip.to.x, at.z - trip.to.z) > 0.3 && Math.hypot(at.x - trip.from.x, at.z - trip.from.z) > 0.3) row.shadowFloat++;
                }
                if (state.flight) {
                    const f = state.flight;
                    f.to = surfaceOfPose(at);
                    const hop = Math.max(12, s.length * 25);
                    f.kind = f.recipe && HAWKING.has(f.recipe) ? "hawk" : f.flock ? "flock" : f.doing === "soar" ? "soar" : f.metres < hop ? (f.from === "perch" && f.to === "perch" ? "hop_perch" : "hop") : f.across < 0.4 * f.metres ? "round" : f.from === "perch" && f.to === "perch" ? "perch_perch" : f.to === "perch" ? "to_perch" : f.from === "perch" ? "off_perch" : f.to === "water" || f.from === "water" ? "water" : "ground";
                    const {x0: _x0, z0: _z0, heading: _h, ...plain} = f;
                    void _x0;
                    void _z0;
                    void _h;
                    row.flights.push(plain);
                    flightsOut.push(plain);
                    state.landed = {flight: plain, at: epoch};
                    state.flight = null;
                }
                if (state.landed && epoch - state.landed.at === 4) {
                    state.landed.flight.after = `${trip.doing}/${at.beat}`;
                    state.landed = null;
                }
                if (!asleep) state.sat++;
            }
            state.was = {x: at.x, y: at.y, z: at.z, aloft: at.aloft};
        }
        // A flock's members against their leader this second, over its leader's flights that go somewhere (15 m and
        // more of path: not a hop to the next twig, which each bird makes on its own).
        for (const s of flyers) {
            if (!s.leader || !FLOCKS.has(s.sched!.profile.social)) continue;
            const leadState = live.get(s.leader);
            const lead = leadState?.pose;
            const mine = live.get(s)!.pose!;
            const row = rows.get(s.animal.model_slug)!;
            let pending = flockPending.get(s);
            const flight = leadState?.flight ?? null;
            if (pending && pending.flight !== flight) {
                if (pending.flight.metres >= 15) {
                    row.flockLeadAir += pending.air;
                    row.flockUpWith += pending.up;
                    for (const d of pending.dists) if (row.flockDist.length < 20000) row.flockDist.push(d);
                }
                flockPending.delete(s);
                pending = undefined;
            }
            if (lead?.aloft && flight) {
                if (!pending) flockPending.set(s, (pending = {flight, air: 0, up: 0, dists: []}));
                pending.air++;
                if (mine.aloft) {
                    pending.up++;
                    pending.dists.push(Math.hypot(mine.x - lead.x, mine.y - lead.y, mine.z - lead.z) / Math.max(s.length, 0.05));
                }
            } else if (mine.aloft) row.memberAlone++;
            row.flockMembers++;
        }
    }
    // (A flight still up at the window's end is counted with what it has.)
    for (const s of flyers) {
        const state = live.get(s)!;
        if (state.flight) {
            const f = state.flight;
            f.kind = f.recipe && HAWKING.has(f.recipe) ? "hawk" : f.flock ? "flock" : f.doing === "soar" ? "soar" : "cut";
            const {x0: _x0, z0: _z0, heading: _h, ...plain} = f;
            void _x0;
            void _z0;
            void _h;
            rows.get(s.animal.model_slug)!.flights.push(plain);
            flightsOut.push(plain);
        } else if (state.sat > 0) rows.get(s.animal.model_slug)!.sits.push(state.sat);
    }
}
// MARK: Report

const median = (list: number[]) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : NaN);
const quantile = (list: number[], q: number) => (list.length ? [...list].sort((a, b) => a - b)[Math.min(Math.floor(list.length * q), list.length - 1)] : NaN);
const f1 = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : "-");
const f0 = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : "-");
const pct = (n: number, d: number) => (d > 0 ? `${((100 * n) / d).toFixed(0)}%` : "-");
type Summary = ReturnType<typeof summarise>;
function summarise(r: Row) {
    const awakeHours = r.awake / 3600;
    const kinds: Record<string, number> = {};
    for (const f of r.flights) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
    const after: Record<string, number> = {};
    for (const f of r.flights) if (f.after) after[f.after] = (after[f.after] ?? 0) + 1;
    const whole = r.flights.filter((f) => f.kind !== "cut");
    const peak = r.hours.map((n, h) => (r.awakeHours[h] > 0 ? n / r.awakeHours[h] : 0));
    const warm = [10, 11, 12, 13, 14, 15].reduce((sum, h) => sum + r.hours[h], 0);
    const warmAwake = [10, 11, 12, 13, 14, 15].reduce((sum, h) => sum + r.awakeHours[h], 0);
    const cool = [6, 7, 8, 17, 18].reduce((sum, h) => sum + r.hours[h], 0);
    const coolAwake = [6, 7, 8, 17, 18].reduce((sum, h) => sum + r.awakeHours[h], 0);
    return {
        slug: r.slug, family: r.family, way: r.way, move: r.move, plan: r.plan, animals: r.animals, weights: r.weights,
        awakeHours,
        airShare: r.awake > 0 ? r.air / r.awake : 0,
        perHour: awakeHours > 0 ? r.takeoffs / awakeHours : NaN,
        flights: r.flights.length,
        secondsMedian: median(whole.map((f) => f.seconds)),
        secondsMost: Math.max(0, ...r.flights.map((f) => f.seconds)),
        metresMedian: median(whole.map((f) => f.metres)),
        metresMost: Math.max(0, ...r.flights.map((f) => f.metres)),
        lengthsMedian: median(whole.map((f) => f.metres)) / Math.max(r.cruise ?? 1, 1e-6),
        aglMedian: median(r.agls),
        aglP90: quantile(r.agls, 0.9),
        overWoods: r.air > 0 ? r.woods / r.air : 0,
        inCrown: r.woods > 0 ? r.inCrown / r.woods : 0,
        sitMedian: median(r.sits),
        sitMost: Math.max(0, ...r.sits),
        kinds,
        after,
        hours: r.hours,
        peakHour: peak.indexOf(Math.max(...peak)),
        warmShare: warmAwake > 0 ? warm / warmAwake : NaN,
        coolShare: coolAwake > 0 ? cool / coolAwake : NaN,
        nightShare: r.air > 0 ? r.nightAir / r.air : NaN,
        turnsPerAirMinute: r.air > 0 ? r.flights.reduce((sum, f) => sum + f.turned, 0) / (2 * Math.PI) / (r.air / 60) : NaN,
        flockUp: r.flockLeadAir > 0 ? r.flockUpWith / r.flockLeadAir : NaN,
        flockDist: median(r.flockDist),
        flockDistP90: quantile(r.flockDist, 0.9),
        memberAlone: r.flockMembers > 0 ? r.memberAlone / r.flockMembers : NaN,
        airStay: r.air > 0 ? r.airStay / r.air : 0,
        shadowFloat: r.shadowDown > 0 ? r.shadowFloat / r.shadowDown : NaN,
        shadowDown: r.awake > 0 ? r.shadowDown / r.awake : 0
    };
}
const summaries = Array.from(rows.values()).map(summarise);
const kindsLine = (k: Record<string, number>) => {
    const total = Object.values(k).reduce((a, b) => a + b, 0);
    return Object.entries(k).sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ${pct(n, total)}`).join(" ");
};
console.log(`${flyers.length} flying animals, ${summaries.length} species, ${windows} windows of ${windowSeconds} s, step 1 s (${((Date.now() - started) / 1000).toFixed(0)} s)`);
// By way of life (or by family where this tree has no ways): medians over species.
const groupBy = (key: (s: Summary) => string) => {
    const groups = new Map<string, Summary[]>();
    for (const s of summaries) groups.set(key(s), [...(groups.get(key(s)) ?? []), s]);
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
};
const groupLine = (name: string, list: Summary[]) => {
    const kinds: Record<string, number> = {};
    for (const s of list) for (const [k, n] of Object.entries(s.kinds)) kinds[k] = (kinds[k] ?? 0) + n;
    return `${name.padEnd(26)} species ${String(list.length).padStart(3)}  flights/awake h ${f1(median(list.map((s) => s.perHour))).padStart(5)} (${f1(Math.min(...list.map((s) => s.perHour)))}–${f1(Math.max(...list.map((s) => s.perHour)))})  aloft ${(100 * median(list.map((s) => s.airShare))).toFixed(1).padStart(5)}%  flight ${f0(median(list.map((s) => s.secondsMedian)))} s / ${f0(median(list.map((s) => s.metresMedian)))} m (longest ${f0(Math.max(...list.map((s) => s.secondsMost)))} s)  height ${f1(median(list.map((s) => s.aglMedian)))} m  sits ${f0(median(list.map((s) => s.sitMedian)))} s  warm/cool ${f1(100 * median(list.map((s) => s.warmShare)))}/${f1(100 * median(list.map((s) => s.coolShare)))}%  turns/min ${f1(median(list.map((s) => s.turnsPerAirMinute)))}  ${kindsLine(kinds)}`;
};
const hasWays = summaries.some((s) => s.way !== "-");
console.log(hasWays ? "\nBy way of life (medians over species):" : "\nBy family (medians over species; 3 species or more):");
for (const [name, list] of groupBy((s) => (hasWays ? s.way : s.family))) if (hasWays || list.length >= 3) console.log(groupLine(name, list));
if (!quiet) {
    console.log("\nBy species:");
    for (const s of summaries.sort((a, b) => (a.way + a.family).localeCompare(b.way + b.family) || b.perHour - a.perHour)) {
        console.log(`${s.slug.padEnd(34)} ${(s.way !== "-" ? s.way : "").padEnd(10)} ${s.family.slice(0, 22).padEnd(22)} n=${String(s.animals).padStart(2)} ${s.move.padEnd(5)} flights/h ${f1(s.perHour).padStart(5)} aloft ${(100 * s.airShare).toFixed(1).padStart(5)}% flight ${f0(s.secondsMedian).padStart(3)} s ${f0(s.metresMedian).padStart(4)} m (most ${f0(s.secondsMost)} s ${f0(s.metresMost)} m) height ${f1(s.aglMedian)}/${f1(s.aglP90)} m in crowns ${pct(s.inCrown * 100, 100)} sits ${f0(s.sitMedian)}/${f0(s.sitMost)} s night ${f0(100 * s.nightShare)}% turns/min ${f1(s.turnsPerAirMinute)}${Number.isFinite(s.flockUp) ? ` flock up ${f0(100 * s.flockUp)}% at ${f1(s.flockDist)} lengths (p90 ${f1(s.flockDistP90)}), alone ${f1(100 * s.memberAlone)}%, beside its leader down ${f1(100 * s.shadowDown)}% of awake (hanging in the air ${f0(100 * s.shadowFloat)}%)` : ""} | ${kindsLine(s.kinds)} | then ${Object.entries(s.after).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ${n}`).join(" ")} | ${s.weights}`);
    }
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify(summaries, null, 1));
const flightsPath = value("--flights");
if (flightsPath) writeFileSync(flightsPath, flightsOut.map((f) => JSON.stringify(f)).join("\n"));

// The lane's CI numbers: see the header and docs/ark/behaviour-pass-2026-11/air.md.
{
    const of = (way: string) => summaries.filter((s) => s.way === way && s.awakeHours > 0.2);
    const med = (list: Summary[], pick: (s: Summary) => number) => median(list.map(pick).filter((v) => Number.isFinite(v)));
    const metrics: Record<string, number> = {flying_species: summaries.filter((s) => s.flights > 0).length, species: summaries.length};
    for (const way of Array.from(new Set(summaries.map((s) => s.way))).filter((x) => x !== "-")) {
        metrics[`${way}_flights_per_hour`] = med(of(way), (s) => s.perHour);
        metrics[`${way}_air_share`] = med(of(way), (s) => s.airShare);
        metrics[`${way}_species`] = of(way).length;
    }
    const flocks = summaries.filter((s) => Number.isFinite(s.flockUp));
    metrics.flock_up_with_leader = med(flocks, (s) => s.flockUp);
    metrics.flock_distance_lengths = med(flocks, (s) => s.flockDist);
    metrics.flock_hanging_share = Math.max(0, ...flocks.map((s) => (Number.isFinite(s.shadowFloat) ? s.shadowFloat * s.shadowDown : 0)));
    console.log(`metrics ${JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, Math.round(v * 1000) / 1000])))}`);
    const lane = value("--record");
    if (lane) {
        const {recordMotionMetric} = await import("../src/lib/ark-motion-metrics.ts");
        for (const [id, v] of Object.entries(metrics)) if (Number.isFinite(v)) recordMotionMetric(lane, id, v);
    }
}
