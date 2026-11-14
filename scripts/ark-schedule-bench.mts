#!/usr/bin/env -S npx tsx
/**
 * The shared schedule's cost in node, no browser (behaviours pass 2026-11, lane BP perf;
 * docs/ark/behaviour-pass-2026-11/perf.md): what the scene pays to build the behaviour world, to wire a snapshot's
 * animals, to work out a trip, to pose the drawn animals each frame, and what it keeps in memory for them. The same
 * script runs on any tree (it reads only what the schedule exports), so two trees are measured the same way.
 *
 *   node --expose-gc --max-semi-space-size=256 --import tsx scripts/ark-schedule-bench.mts <snapshot.json>
 *       --islands <routing.json> [--island wild|town] [--part build,trips,alone,frame,hunt,heap,poses] [--world v2]
 *       [--classes-out <file>] [--classes-in <file>] [--json <file>] [--poses-out <file>] [--windows 12]
 *       [--alone-every 6] [--cpuprofile <file>]
 *
 * Parts:
 *   build   the behaviour world in 6 ms slices as the scene builds it (the places, then the walk grid), then the
 *           wiring (placement, profiles, the homes' spacing, threats, recipes). Always run: the other parts need it.
 *   trips   every scheduled animal's trip at twelve hours of a day: worked out cold in the snapshot's order (after
 *           `forgetSchedules`, so a leader's or a predator's slot is paid for by whoever asks first), asked again
 *           (the memo), and the next three slots as the scene asks for them (its last trip known). Per class of
 *           animal: median, 95th percentile, worst, and the sum.
 *   alone   one animal's trip with nothing remembered (`forgetSchedules` before each): what a single animal costs the
 *           frame it first comes near. Every `--alone-every`th animal, three hours of the day.
 *   frame   the pose refresh: `poseOnTrip` for every scheduled animal over 600 frames at 60 a second, trips turning
 *           over as they end; a frame's time for the whole population and per 100 animals.
 *   hunt    a hunter on its foray (`hunting.ts` pose), every predator taken as due, 600 frames.
 *   counts  what the trips and poses ask of the world (the ground's height, the water, what is solid, the walk grid's
 *           paths and clear runs), counted per class: exact and the same under any load. Run it alone.
 *   heap    what the schedule keeps: the heap after a collection with the world built, with every animal's first
 *           trip, and after 40 slots each (the memo full); and bytes allocated per cold trip.
 *   poses   the identity check: every scheduled animal's trip at 36 moments of a day, whole (every leg, path, beat and
 *           height), and nine poses on it, as exact text (every number as the shortest text that reads back to the
 *           same double), hashed per animal (`--poses-out`). Two runs' files compare with `cmp`: a change that keeps
 *           what every animal does gives the same bytes.
 *
 * `--island town`: the town's animals on the town's own behaviour world, wired as the town's validator wires them
 * (`islands/town/validate-animals.ts`: each on its own range, no groups and no spacing; threats and recipes as the
 * scene's). Most of the real Ark lives there.
 *
 * Classes come from the tree's own ways of life where it has them (`--classes-out`); a tree without them (main) takes
 * the other's list (`--classes-in`), so both report the same animals under the same names.
 * A snapshot holds real usernames: read in place, never copied. Only species slugs, ids and counts are printed.
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import os from "node:os";
import {setArkWorld} from "../src/ark-scene/world.ts";

const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
setArkWorld((value("--world") ?? "v2") as "v1" | "v2");
const parts = new Set((value("--part") ?? "build,trips,frame").split(","));
const gc = (globalThis as {gc?: () => void}).gc;
const load = () => os.loadavg().map((n) => n.toFixed(1)).join(" ");
const cpuNow = () => {
    const c = process.cpuUsage();
    return (c.user + c.system) / 1000;
};
/** Wall and CPU time of a piece of work (ms): on a shared machine the CPU time is the steadier of the two. */
const timed = <T,>(body: () => T): {value: T; wall: number; cpu: number; main: number} => {
    const c = cpuNow();
    const t = performance.now();
    const made = body();
    const wall = performance.now() - t;
    const cpu = cpuNow() - c;
    return {value: made, wall, cpu, main: Math.min(wall, cpu)};
};
/**
 * A stopwatch for one call's main-thread time (ms): the lesser of its wall time (longer when another process had the
 * core: the machine is shared) and the process's CPU time (longer when a collector or compiler thread ran beside it).
 */
const stopwatch = () => {
    const c = process.cpuUsage();
    const t = performance.now();
    return () => {
        const wall = performance.now() - t;
        const used = process.cpuUsage(c);
        return Math.min(wall, (used.user + used.system) / 1000);
    };
};
const out: Record<string, unknown> = {load: load(), node: process.version};
console.log(`load ${load()}  node ${process.version}`);

const profilePath = value("--cpuprofile");
let session: import("node:inspector").Session | null = null;
if (profilePath) {
    const inspector = await import("node:inspector");
    session = new inspector.Session();
    session.connect();
}

const {decodeArkSnapshot} = await import("../src/ark-scene/snapshot.ts");
const {arkBody} = await import("../src/ark-scene/stats.ts");
const {behaviourProfile} = await import("../src/ark-scene/behaviour-profile.ts");
const sched = await import("../src/ark-scene/behaviour-schedule.ts");
const {wireRecipes} = await import("../src/ark-scene/behaviour-recipes.ts");
const {eats, preyOf} = await import("../src/ark-scene/food-links.ts");
const {mapHabitatAt, onSchedule, scheduleRoost} = await import("../src/ark-scene/map/place.ts");
const {placeAnimals} = await import("../src/ark-scene/placement.ts");
const {onBehaviourSchedule} = await import("../src/ark-scene/schedule-water.ts");
const {worldSampler, worldSamplerBuild} = await import("../src/ark-scene/world-sampler.ts");
const {navGridBuild} = await import("../src/ark-scene/behaviour-nav.ts");
const {heightAt, ZONE_SITES} = await import("../src/ark-scene/world.ts");
const {islandHours} = await import("../src/lib/ark-clock.ts");
const {modelBase} = await import("../src/ark-scene/grounding/base.ts");

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
type Trip = import("../src/ark-scene/behaviour-schedule.ts").Trip;
type ScheduleAnimal = import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal;
const source = args[0];
if (!source || source.startsWith("--")) throw new Error("usage: ark-schedule-bench.mts <snapshot.json> --islands <routing.json> [--part build,trips,alone,frame,hunt,heap,poses]");
const routingPath = value("--islands");
let raw: unknown = JSON.parse(readFileSync(source, "utf8"));
const voyageStart = Date.parse(String((raw as {voyage?: {started_at?: string}}).voyage?.started_at ?? ""));
if (routingPath) raw = (await import("../src/lib/ark-islands-local.ts")).mergeArkIslandsRouting(raw, JSON.parse(readFileSync(routingPath, "utf8"))).merged;
const local = (await import("../src/lib/ark-local-snapshot.ts")).arkLocalSnapshotOf(raw);
const snapshot = local?.snapshot ?? decodeArkSnapshot(raw);
if (!snapshot) throw new Error("not a snapshot");
const town = value("--island") === "town";
if (town && !routingPath) throw new Error("--island town needs --islands <routing.json>");
const animals: ArkAnimal[] = routingPath ? (await import("../src/lib/ark-islands.ts")).arkIslandSnapshot(snapshot, town ? "town" : "wild").animals : snapshot.animals.filter((a) => !(a as {area?: string | null}).area);

// MARK: The world's build

const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const build: Record<string, number | string> = {};
type TownPlaces = ReturnType<typeof import("../src/ark-scene/islands/town/placement.ts").placeTownAnimals>;
let townPlaced: TownPlaces | null = null;
let townSampler: import("../src/ark-scene/world-sampler.ts").ArkWorldSampler | null = null;
if (town) {
    // The town's own world, as its validator builds it (the scene's `island.sampler()`; here at the origin).
    const {placeTownAnimals} = await import("../src/ark-scene/islands/town/placement.ts");
    const {townWorldSampler} = await import("../src/ark-scene/islands/town/sampler.ts");
    const {townSurfacesFor} = await import("../src/ark-scene/islands/town/validate-animals.ts");
    const {townHouseholds} = await import("../src/ark-scene/islands/town/areas.ts");
    const {townPlan} = await import("../src/ark-scene/islands/town/plan.ts");
    const {homeSites} = await import("../src/ark-scene/islands/town/tanks.ts");
    const {setTownWalkSurfaces, townWaterLevel, townWaterSurface} = await import("../src/ark-scene/islands/town/drawn-ground.ts");
    const {setIslandWater} = await import("../src/ark-scene/water-level.ts");
    const laid = timed(() => placeTownAnimals(animals));
    build.placeWall = laid.wall;
    build.placeCpu = laid.cpu;
    townPlaced = laid.value;
    const plan = townPlan();
    const sites = homeSites(townHouseholds(plan), plan);
    const byHousehold = new Map<string, Set<string>>();
    townPlaced.town.forEach((info) => {
        if (!info.display) return;
        const set = byHousehold.get(info.display.household) ?? new Set<string>();
        set.add(info.display.id);
        byHousehold.set(info.display.household, set);
    });
    const used = Array.from(byHousehold.entries()).flatMap(([h, displays]) => (sites.get(h) ? [{site: sites.get(h)!, displays}] : []));
    setTownWalkSurfaces(townSurfacesFor(townPlaced.open, used));
    setIslandWater({level: townWaterLevel, surface: townWaterSurface});
    const open = townPlaced.open;
    const places = timed(() => townWorldSampler(open));
    build.samplerWall = places.wall;
    build.samplerCpu = places.cpu;
    townSampler = places.value;
} else {
    // The map's own tables first (the scene has them before the first frame), so the build's time is the build's.
    const map = timed(() => heightAt(0, 0));
    build.mapWall = map.wall;
    // In 6 ms slices, as the scene builds it a slice a drawn frame (`BUILD_SLICE_MS`): the places, then the walk grid
    // (`ScheduleWorldBuild` is these two one after the other).
    const slicedRun = (job: {step: (ms: number) => unknown; spentMs: number; slices: number}) => {
        const c = cpuNow();
        let longest = 0;
        for (;;) {
            const t = performance.now();
            const done = job.step(6);
            longest = Math.max(longest, performance.now() - t);
            if (done) break;
        }
        const cpu = cpuNow() - c;
        return {work: Math.min(job.spentMs, cpu), slices: job.slices, longest, cpu};
    };
    const placesBuild = slicedRun(worldSamplerBuild());
    build.samplerWall = placesBuild.work;
    build.samplerCpu = placesBuild.cpu;
    build.samplerSlices = placesBuild.slices;
    build.samplerLongest = placesBuild.longest;
    const gridBuild = slicedRun(navGridBuild(worldSampler()));
    build.navWall = gridBuild.work;
    build.navCpu = gridBuild.cpu;
    build.navSlices = gridBuild.slices;
    build.navLongest = gridBuild.longest;
}
const sampler = townSampler ?? worldSampler();
if (town) {
    const grid = timed(() => navGridBuild(sampler).run());
    build.navWall = grid.wall;
    build.navCpu = grid.cpu;
}
if (gc) gc();
const heapWorld0 = process.memoryUsage().heapUsed;
const world = sched.scheduleWorld(sampler);
const placed = townPlaced ? null : timed(() => placeAnimals(animals));
if (placed) {
    build.placeWall = placed.wall;
    build.placeCpu = placed.cpu;
}
const places = townPlaced ? townPlaced.places : placed!.value;
type Own = {profile: ReturnType<typeof behaviourProfile>; animal: ScheduleAnimal; trip: Trip | null};
type Subject = {animal: ArkAnimal; place: NonNullable<ReturnType<typeof places.get>>; length: number; sched: Own | null; cls: string};
const made = timed(() =>
    animals.map((animal): Subject => {
        const place = places.get(animal.id)!;
        const plan = modelBase(animal.model_slug)?.plan ?? null;
        const body = arkBody(animal, plan);
        const info = townPlaced ? townPlaced.town.get(animal.id) ?? null : null;
        // (The town: as its validator and the scene's `island.scheduled`: not one kept still, at a window, indoors, in a pool, a tank or a display.)
        const on = Boolean(place) && (!townPlaced || (info !== null && !info.still && !info.tank && !info.display && !["window", "indoor", "pool", "roof", "eave", "ledge", "tall", "belfry", "balcony", "lamp_wall"].includes(info.where))) && onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
        return {
            animal,
            place,
            length: body.display,
            cls: "",
            sched: on
                ? {
                      profile: behaviourProfile(animal.model_slug, plan),
                      animal: info
                          ? sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null)
                          : sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone)),
                      trip: null
                  }
                : null
        };
    })
);
build.subjectsWall = made.wall;
build.subjectsCpu = made.cpu;
const subjects = made.value;
const onIt = subjects.filter((s) => s.sched);
// The scene's wiring (as `scripts/ark-time-budget.mts`): groups, spaced homes, threats, recipes.
{
    const byId = new Map(subjects.map((s) => [s.animal.id, s]));
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
    if (town) groups.clear();
    const spacing = timed(() =>
        sched.spaceHomes(
            town ? [] : onIt.filter((s) => !groups.get(s)).map((s) => ({id: s.animal.id, slug: s.animal.model_slug, home: {x: s.sched!.animal.home.x, z: s.sched!.animal.home.z}, length: s.length, walkable: (x: number, z: number) => (s.sched!.profile.move === "swim" || s.sched!.profile.seabed ? nav.swimmable(x, z, 0.5) : s.sched!.profile.move === "fly" ? heightAt(x, z) > 0.05 && mapHabitatAt(s.animal, x, z, 5) : nav.walkable(x, z) && mapHabitatAt(s.animal, x, z, 5))})),
            eats,
            (id) => radius.get(id) ?? 3
        )
    );
    build.spaceWall = spacing.wall;
    build.spaceCpu = spacing.cpu;
    const spaced = spacing.value;
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
    const threats = timed(() => sched.wireThreats(list, eats));
    build.threatsWall = threats.wall;
    build.threatsCpu = threats.cpu;
    sched.forgetSchedules();
    const recipes = timed(() => wireRecipes(list.map((w) => ({animal: w.animal, profile: w.profile, slug: w.slug, activity: w.activity}))));
    build.recipesWall = recipes.wall;
    build.recipesCpu = recipes.cpu;
}
out.build = build;
out.animals = animals.length;
out.scheduled = onIt.length;
const f1 = (n: number) => n.toFixed(1);
console.log(`${animals.length} animals of the ${town ? "town" : "wild island"}, ${onIt.length} on the schedule, ${new Set(onIt.map((s) => s.animal.model_slug)).size} species`);
console.log(
    town
        ? `build (the town's world, at once): places ${f1(build.samplerWall as number)} ms (cpu ${f1(build.samplerCpu as number)}), walk grid ${f1(build.navWall as number)} (cpu ${f1(build.navCpu as number)})`
        : `build (6 ms slices; the map's tables ${f1(build.mapWall as number)} ms before it): places ${f1(build.samplerWall as number)} ms of work in ${build.samplerSlices} slices (cpu ${f1(build.samplerCpu as number)}, longest ${f1(build.samplerLongest as number)}), walk grid ${f1(build.navWall as number)} ms in ${build.navSlices} slices (cpu ${f1(build.navCpu as number)}, longest ${f1(build.navLongest as number)})`
);
console.log(`wiring: placement ${f1(build.placeWall as number)} (cpu ${f1(build.placeCpu as number)}), profiles ${f1(build.subjectsWall as number)}, spacing ${f1(build.spaceWall as number)} (cpu ${f1(build.spaceCpu as number)}), threats ${f1(build.threatsWall as number)}, recipes ${f1(build.recipesWall as number)}`);

// MARK: Classes

const classesIn = value("--classes-in");
const classes: Record<string, string> = classesIn && existsSync(classesIn) ? JSON.parse(readFileSync(classesIn, "utf8")) : {};
if (!classesIn) {
    // This tree's own ways of life (the merged tree has them; main does not, and takes the merged tree's list).
    const flight = (await import("../src/ark-scene/locomotion/flight.ts")) as unknown as {flightWay?: (slug: string) => string | null; FLIGHT_WAYS?: Record<string, {bout: number; aloft?: {kind: string}}>};
    const water = (await import("../src/ark-scene/water-life.ts").catch(() => null)) as null | {waterLife: (slug: string, profile: unknown) => string | null; patrolRule: (life: string | null) => unknown};
    for (const s of onIt) {
        const p = s.sched!.profile;
        const flies = p.move === "fly";
        const swimsFirst = p.move === "swim" || p.seabed;
        const way = flies ? flight.flightWay?.(s.animal.model_slug) ?? null : null;
        const rule = way ? flight.FLIGHT_WAYS?.[way] ?? null : null;
        const life = water ? water.waterLife(s.animal.model_slug, p) : null;
        let cls = "walker";
        if (flies) cls = rule?.aloft?.kind === "thermal" ? "flyer: soarer" : rule?.aloft?.kind === "hawk" ? "flyer: on the wing" : rule && rule.bout > 0 ? "flyer: station" : "flyer: other";
        else if (life === "cetacean") cls = "swimmer: whale or dolphin";
        else if (swimsFirst && p.social === "school") cls = "swimmer: schooling fish";
        else if (life && water!.patrolRule(life)) cls = "swimmer: patrol";
        else if (swimsFirst) cls = "swimmer: other";
        else if (p.moves.includes("swim") && life) cls = "shore animal";
        classes[s.animal.id] = cls;
    }
    const classesOut = value("--classes-out");
    if (classesOut) writeFileSync(classesOut, JSON.stringify(classes));
}
for (const s of onIt) s.cls = classes[s.animal.id] ?? "unclassed";
const classNames = [...new Set(onIt.map((s) => s.cls))].sort();
console.log(`classes: ${classNames.map((name) => `${name} ${onIt.filter((s) => s.cls === name).length}`).join(", ")}`);

const start = Date.UTC(2026, 10, 12) / 1000;
const windows = Number(value("--windows") ?? "12");
const WINDOWS = Array.from({length: windows}, (_, i) => start + i * (86400 / windows));
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const quantile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(Math.floor(sorted.length * q), sorted.length - 1)] : NaN);
type Row = {n: number; median: number; p95: number; worst: number; sum: number};
const rowOf = (list: number[]): Row => {
    const sorted = [...list].sort((a, b) => a - b);
    return {n: sorted.length, median: quantile(sorted, 0.5), p95: quantile(sorted, 0.95), worst: sorted[sorted.length - 1] ?? NaN, sum: sorted.reduce((a, b) => a + b, 0)};
};
const show = (title: string, by: Map<string, number[]>) => {
    console.log(title);
    const table: Record<string, Row> = {};
    const all: number[] = [];
    for (const name of [...by.keys()].sort()) {
        const row = rowOf(by.get(name)!);
        table[name] = row;
        all.push(...by.get(name)!);
        console.log(`   ${name.padEnd(28)} n ${String(row.n).padStart(6)}  median ${row.median.toFixed(3).padStart(8)}  p95 ${row.p95.toFixed(2).padStart(8)}  worst ${row.worst.toFixed(1).padStart(7)}  sum ${row.sum.toFixed(0).padStart(7)} ms`);
    }
    const row = rowOf(all);
    table.all = row;
    console.log(`   ${"all".padEnd(28)} n ${String(row.n).padStart(6)}  median ${row.median.toFixed(3).padStart(8)}  p95 ${row.p95.toFixed(2).padStart(8)}  worst ${row.worst.toFixed(1).padStart(7)}  sum ${row.sum.toFixed(0).padStart(7)} ms`);
    return table;
};
const push = (by: Map<string, number[]>, key: string, ms: number) => {
    const list = by.get(key);
    if (list) list.push(ms);
    else by.set(key, [ms]);
};
const trip = (s: Subject, epoch: number, previous: Trip | null) => sched.tripAt(world, s.sched!.profile, s.sched!.animal, epoch, hoursAt, s.animal.activity, previous);

if (session) await new Promise<void>((resolve) => session!.post("Profiler.enable", () => session!.post("Profiler.start", () => resolve())));

// MARK: Trips

if (parts.has("trips")) {
    const cold = new Map<string, number[]>();
    const warm = new Map<string, number[]>();
    const next = new Map<string, number[]>();
    const c0 = cpuNow();
    const t0 = performance.now();
    let coldCpu = 0;
    for (const from of WINDOWS) {
        sched.forgetSchedules();
        for (const s of onIt) s.sched!.trip = null;
        const c = cpuNow();
        for (const s of onIt) {
            const took = stopwatch();
            s.sched!.trip = trip(s, from, null);
            push(cold, s.cls, took());
        }
        coldCpu += cpuNow() - c;
        for (const s of onIt) {
            const took = stopwatch();
            for (let i = 0; i < 20; i++) trip(s, from, null);
            push(warm, s.cls, took() / 20);
        }
        for (let k = 1; k <= 3; k++) {
            for (const s of onIt) {
                const took = stopwatch();
                s.sched!.trip = trip(s, from + k * sched.SLOT_SECONDS, s.sched!.trip);
                push(next, s.cls, took());
            }
        }
    }
    console.log(`trips: ${windows} hours of a day, wall ${(performance.now() - t0).toFixed(0)} ms, cpu ${(cpuNow() - c0).toFixed(0)} ms (cold passes' cpu ${coldCpu.toFixed(0)} ms); load ${load()}`);
    out.trips = {
        coldCpu,
        cold: show("cold trip (ms), in the snapshot's order after forgetSchedules", cold),
        next: show("the next slot's trip (ms), the last one known", next),
        warm: show("the same trip asked again (ms)", warm)
    };
}

// MARK: One animal alone

if (parts.has("alone")) {
    const every = Number(value("--alone-every") ?? "6");
    const alone = new Map<string, number[]>();
    const picks = onIt.filter((_, i) => i % every === 0);
    const c0 = cpuNow();
    for (const from of [WINDOWS[Math.floor(windows * 0.125)], WINDOWS[Math.floor(windows * 0.5)], WINDOWS[Math.floor(windows * 0.8)]]) {
        for (const s of picks) {
            sched.forgetSchedules();
            const took = stopwatch();
            trip(s, from, null);
            push(alone, s.cls, took());
        }
    }
    console.log(`alone: ${picks.length} animals at three hours, cpu ${(cpuNow() - c0).toFixed(0)} ms; load ${load()}`);
    out.alone = show("one animal's trip with nothing remembered (ms)", alone);
}

// MARK: A frame's poses

if (parts.has("frame")) {
    const frames: number[] = [];
    const posing: number[] = [];
    const turning: number[] = [];
    const perClass = new Map<string, number[]>();
    let poses = 0;
    let turned = 0;
    for (const from of [WINDOWS[Math.floor(windows * 0.125)], WINDOWS[Math.floor(windows * 0.5)], WINDOWS[Math.floor(windows * 0.8)]]) {
        sched.forgetSchedules();
        for (const s of onIt) s.sched!.trip = trip(s, from, null);
        // Per class, the pose alone: 200 moments of the trip it is on.
        for (const s of onIt) {
            const own = s.sched!;
            const took = stopwatch();
            for (let i = 0; i < 200; i++) sched.poseOnTrip(world, own.trip!, own.trip!.start + (i / 200) * sched.SLOT_SECONDS);
            push(perClass, s.cls, (took() / 200) * 1000);
        }
        for (let f = 0; f < 600; f++) {
            const epoch = from + 40 + f / 60;
            const frame = stopwatch();
            let spent = 0;
            for (const s of onIt) {
                const own = s.sched!;
                if (epoch < own.trip!.start || epoch >= own.trip!.end) {
                    const took = stopwatch();
                    own.trip = trip(s, epoch, own.trip);
                    spent += took();
                    turned++;
                }
                sched.poseOnTrip(world, own.trip!, epoch);
                poses++;
            }
            const whole = Math.max(frame(), spent);
            frames.push(whole);
            posing.push(whole - spent);
            if (spent > 0) turning.push(spent);
        }
    }
    const fr = rowOf(frames);
    const po = rowOf(posing);
    const tu = rowOf(turning);
    console.log(`frame: ${onIt.length} animals posed 60 times a second for 30 s (${poses} poses, ${turned} trips turned over); load ${load()}`);
    console.log(`   poses alone, a frame: median ${po.median.toFixed(3)} ms, p95 ${po.p95.toFixed(3)}, worst ${po.worst.toFixed(2)}; per 100 animals ${((po.median / onIt.length) * 100).toFixed(4)} ms`);
    console.log(`   a frame with its new trips: median ${fr.median.toFixed(3)} ms, p95 ${fr.p95.toFixed(2)}, worst ${fr.worst.toFixed(1)}; new trips in a frame: median ${tu.median.toFixed(2)} ms, p95 ${tu.p95.toFixed(1)}, worst ${tu.worst.toFixed(1)}, ${tu.n} frames had one, ${tu.sum.toFixed(0)} ms in all`);
    out.frame = {animals: onIt.length, poses: po, whole: fr, turning: tu, perPoseMicros: show("one pose (microseconds), by class", perClass)};
}

// MARK: A hunter on its foray

if (parts.has("hunt")) {
    const hunt = await import("../src/ark-scene/hunting.ts");
    const positions = await import("../src/ark-scene/positions/positions.ts");
    const atlas = positions.decodeAtlas(JSON.parse(readFileSync(new URL("../src/ark-scene/positions/atlas.json", import.meta.url), "utf8")));
    const startedAtMs = Number.isFinite(voyageStart) ? voyageStart : Date.UTC(2026, 10, 8, 21, 45, 21);
    const layer = new hunt.HuntingLayer();
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
    const predators = onIt.filter((s) => preyOf(s.animal.model_slug).size > 0 && typeof s.animal.slot === "number" && s.animal.species_profile_id);
    layer.set({hunting: "encounter", startedAtMs, arkDay: null, tickedTo: null, predators: new Map(predators.map((s) => [s.animal.id, 0])), meals: []} as never, atlas, startedAtMs);
    const schedulePose = (s: Subject, epoch: number) => {
        const own = s.sched!;
        if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = trip(s, epoch, own.trip);
        return {...sched.poseOnTrip(world, own.trip, epoch), doing: own.trip.doing};
    };
    const poseOf = (s: Subject, epoch: number) => (layer.pose as (...a: unknown[]) => unknown)(s.animal, epoch, s.length, heightAt, () => schedulePose(s, epoch), huntWorld);
    const first = new Map<string, number[]>();
    const steady = new Map<string, number[]>();
    const frames: number[] = [];
    let out0 = 0;
    for (const from of [WINDOWS[Math.floor(windows * 0.125)], WINDOWS[Math.floor(windows * 0.5)], WINDOWS[Math.floor(windows * 0.8)]]) {
        sched.forgetSchedules();
        for (const s of predators) s.sched!.trip = trip(s, from, null);
        for (const s of predators) {
            const took = stopwatch();
            if (poseOf(s, from + 40)) out0++;
            push(first, s.cls, took());
        }
        for (let f = 1; f <= 600; f++) {
            const epoch = from + 40 + f / 60;
            const frame = stopwatch();
            for (const s of predators) {
                if (f % 30 === 0) {
                    const took = stopwatch();
                    poseOf(s, epoch);
                    push(steady, s.cls, took() * 1000);
                } else poseOf(s, epoch);
            }
            frames.push(frame());
        }
    }
    const fr = rowOf(frames);
    console.log(`hunt: ${predators.length} predators taken as due, ${out0} foray poses of ${predators.length * 3} first asks; a frame for all of them: median ${fr.median.toFixed(3)} ms, p95 ${fr.p95.toFixed(2)}, worst ${fr.worst.toFixed(1)}; per hunter ${((fr.median / Math.max(predators.length, 1)) * 1000).toFixed(2)} microseconds; load ${load()}`);
    out.hunt = {predators: predators.length, frame: fr, first: show("a hunter's first foray pose (ms)", first), steady: show("a hunter's pose in a later frame (microseconds)", steady)};
}

// MARK: Work counted, not timed

if (parts.has("counts")) {
    // What a trip and a pose ask of the world, counted: the same on any machine under any load, so two trees compare
    // exactly where a shared machine's clock does not. (The counting slows the calls: this part is never timed.)
    const tally: Record<string, number> = {};
    const wrap = (target: object, names: string[], prefix: string) => {
        for (const name of names) {
            const own = (target as Record<string, unknown>)[name];
            if (typeof own !== "function") continue;
            const key = `${prefix}.${name}`;
            tally[key] = 0;
            Object.defineProperty(target, name, {
                configurable: true,
                writable: true,
                value: function (this: unknown, ...rest: unknown[]) {
                    tally[key]++;
                    return (own as (...a: unknown[]) => unknown).apply(this, rest);
                }
            });
        }
    };
    // (How often the ground's height is asked at the very point it was asked before: what a table of the last answers
    // would save, by its size. Counted on the calls as they come, trips and poses together.)
    const REPEAT_SIZES = [1024, 16384, 262144];
    const repeats = REPEAT_SIZES.map((size) => ({size, xs: new Float64Array(size).fill(NaN), zs: new Float64Array(size).fill(NaN), hits: 0}));
    let heightsAsked = 0;
    const cell = new Float64Array(2);
    const bits = new Uint32Array(cell.buffer);
    {
        const own = world.sampler.heightAt;
        Object.defineProperty(world.sampler, "heightAt", {
            configurable: true,
            writable: true,
            value: function (this: unknown, x: number, z: number) {
                heightsAsked++;
                cell[0] = x;
                cell[1] = z;
                const hash = (Math.imul(bits[0] ^ bits[1], 0x9e3779b1) ^ Math.imul(bits[2] ^ bits[3], 0x85ebca6b)) >>> 0;
                for (const table of repeats) {
                    const k = hash % table.size;
                    if (table.xs[k] === x && table.zs[k] === z) table.hits++;
                    else {
                        table.xs[k] = x;
                        table.zs[k] = z;
                    }
                }
                return own.call(this, x, z);
            }
        });
    }
    wrap(world.sampler, ["heightAt", "waterSurface", "waterDepth", "blocked", "attachPoints", "canopyTop", "flightFloor", "zoneAt", "surfaceAt", "slopeAt"], "sampler");
    wrap(world.nav, ["path", "nearest", "clear", "walkable", "swimmable", "region", "wayClear", "groundAt", "runClear", "reachable"], "nav");
    if (world.sampler.colliders) wrap(world.sampler.colliders, ["near", "distance", "blocked", "segmentClear"], "colliders");
    const zero = () => {
        for (const key of Object.keys(tally)) tally[key] = 0;
    };
    const take = () => ({...tally});
    const sum = (into: Record<string, number>, from: Record<string, number>) => {
        for (const [key, n] of Object.entries(from)) into[key] = (into[key] ?? 0) + n;
    };
    const cold: Record<string, Record<string, number>> = {};
    const next: Record<string, Record<string, number>> = {};
    const posed: Record<string, Record<string, number>> = {};
    let trips = 0;
    let poses = 0;
    for (const from of WINDOWS) {
        sched.forgetSchedules();
        for (const s of onIt) {
            zero();
            s.sched!.trip = trip(s, from, null);
            sum((cold[s.cls] ??= {}), take());
            trips++;
        }
        for (let k = 1; k <= 3; k++) {
            for (const s of onIt) {
                zero();
                s.sched!.trip = trip(s, from + k * sched.SLOT_SECONDS, s.sched!.trip);
                sum((next[s.cls] ??= {}), take());
            }
        }
        for (const s of onIt) {
            zero();
            const own = s.sched!;
            for (let i = 0; i < 40; i++) sched.poseOnTrip(world, own.trip!, own.trip!.start + (i / 40) * sched.SLOT_SECONDS);
            sum((posed[s.cls] ??= {}), take());
            poses += 40;
        }
    }
    const total = (by: Record<string, Record<string, number>>) => {
        const all: Record<string, number> = {};
        for (const row of Object.values(by)) sum(all, row);
        return all;
    };
    const line = (row: Record<string, number>) => Object.entries(row).filter(([, n]) => n > 0).map(([key, n]) => `${key} ${n}`).join(", ");
    console.log(`counts: what ${trips} cold trips, ${trips * 3} next trips and ${poses} poses asked of the world`);
    console.log(`   cold trips: ${line(total(cold))}`);
    console.log(`   next trips: ${line(total(next))}`);
    console.log(`   poses: ${line(total(posed))}`);
    console.log(`   the ground's height asked ${heightsAsked} times; at a point still in a table of the last answers: ${repeats.map((table) => `${table.size} places ${((table.hits / Math.max(heightsAsked, 1)) * 100).toFixed(1)}%`).join(", ")}`);
    out.counts = {heightsAsked, repeats: repeats.map((table) => ({size: table.size, hits: table.hits})), trips, poses, cold: {...cold, all: total(cold)}, next: {...next, all: total(next)}, posed: {...posed, all: total(posed)}};
    // (The wrappers stay on: nothing after this part is timed in the same run.)
    if (["trips", "alone", "frame", "hunt"].some((name) => parts.has(name))) console.log("counts: run alone, the other parts' times in this run include the counting");
}

// MARK: The heap

if (parts.has("heap")) {
    if (!gc) console.log("heap: run node with --expose-gc");
    else {
        const used = () => {
            gc();
            gc();
            return process.memoryUsage().heapUsed;
        };
        sched.forgetSchedules();
        for (const s of onIt) s.sched!.trip = null;
        const base = used();
        // Allocation per cold trip: the heap's growth with no collection between (a big young generation:
        // --max-semi-space-size), in batches small enough to stay inside it.
        const from = WINDOWS[Math.floor(windows * 0.5)];
        let allocated = 0;
        let counted = 0;
        for (let i = 0; i < onIt.length; i += 40) {
            const before = process.memoryUsage().heapUsed;
            for (const s of onIt.slice(i, i + 40)) s.sched!.trip = trip(s, from, null);
            const grew = process.memoryUsage().heapUsed - before;
            if (grew > 0) {
                allocated += grew;
                counted += Math.min(40, onIt.length - i);
            }
        }
        const first = used();
        // (Five minutes of slots: the scene forgets every schedule at each resting rotation, `index.ts` wireSchedules, so
        // this is the most a session holds; 40 slots is the memo full, which only a page with no rotation would reach.)
        for (let k = 1; k <= 4; k++) for (const s of onIt) s.sched!.trip = trip(s, from + k * sched.SLOT_SECONDS, s.sched!.trip);
        const rotation = used();
        for (let k = 5; k <= 40; k++) for (const s of onIt) s.sched!.trip = trip(s, from + k * sched.SLOT_SECONDS, s.sched!.trip);
        const full = used();
        const mb = (n: number) => (n / 1048576).toFixed(1);
        console.log(`heap: the built world and wiring ${mb(base - heapWorld0)} MB over the process before them (${mb(base)} MB in all); every animal's first trip +${mb(first - base)} MB (${((first - base) / onIt.length / 1024).toFixed(1)} KB an animal); after five minutes of slots +${mb(rotation - base)} MB (${((rotation - base) / onIt.length / 1024).toFixed(1)} KB an animal); after 40 slots each +${mb(full - base)} MB (${((full - base) / onIt.length / 1024).toFixed(1)} KB an animal); allocated per cold trip ${(allocated / Math.max(counted, 1) / 1024).toFixed(0)} KB (${counted} trips counted)`);
        out.heap = {world: base - heapWorld0, total: base, firstTrips: first - base, rotation: rotation - base, perAnimalRotation: (rotation - base) / onIt.length, fullMemo: full - base, perAnimalFull: (full - base) / onIt.length, allocatedPerColdTrip: allocated / Math.max(counted, 1), counted};
    }
}

// MARK: The identity check

if (parts.has("poses")) {
    /**
     * Exact text of a value, by its values alone: numbers as the shortest text that reads back to the same double (and
     * -0 as itself), typed arrays in full, objects by their keys in order. Never by identity: whether two trips share
     * one spot object or hold two equal ones depends on what was remembered when they were made, and draws the same.
     */
    const onPath = new Set<object>();
    const text = (v: unknown, depth: number): string => {
        if (v === null || v === undefined) return "null";
        if (typeof v === "number") return Object.is(v, -0) ? "-0" : String(v);
        if (typeof v === "string") return JSON.stringify(v);
        if (typeof v === "boolean") return v ? "true" : "false";
        if (typeof v === "function") return "fn";
        if (ArrayBuffer.isView(v)) return `[${Array.from(v as unknown as ArrayLike<number>).join(",")}]`;
        if (typeof v !== "object") return String(v);
        if (onPath.has(v as object)) return "cycle";
        if (depth > 12) return "deep";
        onPath.add(v as object);
        let made: string;
        if (Array.isArray(v)) made = `[${v.map((item) => text(item, depth + 1)).join(",")}]`;
        else {
            const keys = Object.keys(v as object).filter((key) => key !== "owner").sort();
            made = `{${keys.map((key) => `${key}:${text((v as Record<string, unknown>)[key], depth + 1)}`).join(",")}}`;
        }
        onPath.delete(v as object);
        return made;
    };
    const lines: string[] = [];
    const whole = createHash("sha256");
    let count = 0;
    let tripsSeen = 0;
    // `--dump <slug> --dump-out <file>`: that species' text in full, a value a line (to read two runs' difference).
    const dumpSlug = value("--dump");
    const dumped: string[] = [];
    const THROUGH = [0, 0.04, 0.13, 0.29, 0.47, 0.66, 0.84, 0.9875];
    sched.forgetSchedules();
    for (const s of onIt) s.sched!.trip = null;
    const perAnimal = new Map<string, ReturnType<typeof createHash>>(onIt.map((s) => [s.animal.id, createHash("sha256")]));
    for (const from of WINDOWS) {
        for (const off of [0, 37, 263]) {
            const epoch = from + off;
            for (const s of onIt) {
                const own = s.sched!;
                if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = trip(s, epoch, own.trip);
                let line = text(own.trip, 0);
                // Its pose at the moment asked, and at eight more through its slot (its way there, its stay, its last second).
                for (const at of [epoch, ...THROUGH.map((share) => own.trip!.start + share * sched.SLOT_SECONDS)]) {
                    line += `|${JSON.stringify(sched.poseOnTrip(world, own.trip, at), (_k, n) => (typeof n === "number" && Object.is(n, -0) ? "-0" : ArrayBuffer.isView(n) ? Array.from(n as unknown as ArrayLike<number>) : n))}`;
                    count++;
                }
                perAnimal.get(s.animal.id)!.update(line);
                whole.update(line);
                tripsSeen++;
                if (dumpSlug && s.animal.model_slug === dumpSlug) dumped.push(`${s.animal.id} ${epoch}\n${line.replace(/([,{[])/g, "$1\n")}`);
            }
        }
    }
    for (const s of onIt) lines.push(`${s.animal.id} ${s.animal.model_slug} ${perAnimal.get(s.animal.id)!.digest("hex").slice(0, 24)}`);
    const digest = whole.digest("hex");
    console.log(`poses: ${count} poses on ${tripsSeen} trips of ${onIt.length} animals at ${windows * 3} moments of a day (each trip whole, and nine poses on it): sha256 ${digest}`);
    out.poses = {count, trips: tripsSeen, sha256: digest};
    if (dumpSlug && value("--dump-out")) writeFileSync(value("--dump-out")!, dumped.join("\n"));
    const posesOut = value("--poses-out");
    if (posesOut) writeFileSync(posesOut, `${lines.join("\n")}\n${digest}\n`);
}

if (session) {
    await new Promise<void>((resolve) =>
        session!.post("Profiler.stop", (_error, result) => {
            writeFileSync(profilePath!, JSON.stringify((result as {profile: unknown}).profile));
            resolve();
        })
    );
}
out.loadEnd = load();
const jsonOut = value("--json");
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 1));
