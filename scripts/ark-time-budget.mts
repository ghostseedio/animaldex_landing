#!/usr/bin/env -S npx tsx
/**
 * The movement audit's time budget (lane MA, 2026-11-13; docs/ark/movement-audit-2026-11-13.md): how each species of a
 * snapshot spends a day on the behaviour schedule (in the air, on the water, on land, up on a perch), how often it
 * takes off, lands, goes into the water and comes out, and how fast its air legs fly against L2's own cruise speed.
 * Birds that live on the ground or the water (a coot, a swan) should spend almost none of the day in the air; the owner
 * saw coots "flying off the ground".
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-time-budget.mts <snapshot.json | --validator>
 *       [--islands <routing.json>] [--world v1|v2] [--hours 10.5] [--step 5] [--species a,b] [--json out.json]
 *       [--events <epoch> --span 1800] [--record <lane>]
 *
 * The island's hours follow the real clock: twelve 10-minute windows, one every two hours. `--hours` pins the hour (the
 * recorder's page pins 10.5). `--islands` merges the development page's routing and keeps the wild island's animals
 * (else: the animals with no `area`). `--events` lists each watched animal's take-offs, landings and water crossings.
 * A snapshot holds real usernames: read it in place, never copy it. Only species slugs, ids and counts are printed.
 * Pure schedule (the same for every viewer); no browser.
 *
 * The audit's CI numbers (MA4) are printed as a last `metrics` line and, under the motion summary
 * (`scripts/ark-motion-ci.mts` sets `ARK_MOTION_METRICS_DIR`), recorded with `recordMotionMetric` under `--record <lane>`
 * (`tests/ark-motion/metrics.json`, check `ma4-time-budget`, runs it on the validator's animals):
 *   air_speed_ratio_median / _p10 / species_under_035: each flying bird's and bat's median air-leg speed over L2's cruise
 *     (`flightPaces`), the median and tenth percentile over species, and how many species fly under 0.35 of it (the
 *     audit's 0.20 / 91 of 98 species; insects keep their old pace, decision 282 row 7, and are left out);
 *   ground_birds_air_share_worst / ground_birds_takeoffs_worst: over birds that walk or swim first and can fly (a coot,
 *     a duck, a swan, a peafowl, a pigeon), the worst share of the day aloft and take-offs per awake hour;
 *   coot_water_share, grebe_water_share: the eurasian coot's and the great crested grebe's share of the day on the water.
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
const {inDepthBand, onBehaviourSchedule} = await import("../src/ark-scene/schedule-water.ts");
const {speciesDepth} = await import("../src/ark-scene/sea-depth.ts");
const {worldSampler} = await import("../src/ark-scene/world-sampler.ts");
const {heightAt, ZONE_SITES} = await import("../src/ark-scene/world.ts");
const {islandHours} = await import("../src/lib/ark-clock.ts");
const {freshWaterAt, freshLevelAt} = await import("../src/ark-scene/water-level.ts");
const {modelBase} = await import("../src/ark-scene/grounding/base.ts");
const {flightSpec} = await import("../src/ark-scene/locomotion/flight.ts");

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
const source = args[0];
if (!source) throw new Error("usage: ark-time-budget.mts <snapshot.json | --validator> [--world v2] [--step 10] [--json out.json]");
let animals: ArkAnimal[];
if (source === "--validator") animals = validatorAnimals();
else {
    // `--islands <routing.json>`: the development page's merge (`/ark?snapshot=…&islands=…`), then the wild island's own animals.
    const routingPath = value("--islands");
    let raw: unknown = JSON.parse(readFileSync(source, "utf8"));
    if (routingPath) raw = (await import("../src/lib/ark-islands-local.ts")).mergeArkIslandsRouting(raw, JSON.parse(readFileSync(routingPath, "utf8"))).merged;
    const local = (await import("../src/lib/ark-local-snapshot.ts")).arkLocalSnapshotOf(raw);
    const snapshot = local?.snapshot ?? decodeArkSnapshot(raw);
    if (!snapshot) throw new Error("not a snapshot");
    animals = routingPath ? (await import("../src/lib/ark-islands.ts")).arkIslandSnapshot(snapshot, "wild").animals : snapshot.animals.filter((a) => !(a as {area?: string | null}).area);
}
/** `--hours 10.5`: the island hour pinned (the recorder's page pins 10.5), else the real clock's. */
const fixedHours = value("--hours") ? Number(value("--hours")) : null;
/** `--events <epoch>`: list each watched animal's take-offs, landings and water crossings over the next `--span` s. */
const eventsFrom = value("--events") ? Number(value("--events")) : null;
const eventSpan = Number(value("--span") ?? "1800");
const only = value("--species")?.split(",");
const step = Number(value("--step") ?? "10");
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);

const sampler = worldSampler();
const world = sched.scheduleWorld(sampler);
const places = placeAnimals(animals);
type Subject = {animal: ArkAnimal; place: ReturnType<typeof places.get> & object; length: number; sched: {profile: ReturnType<typeof behaviourProfile>; animal: import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal; trip: import("../src/ark-scene/behaviour-schedule.ts").Trip | null} | null};
const subjects: Subject[] = animals.map((animal) => {
    const place = places.get(animal.id)!;
    const plan = modelBase(animal.model_slug)?.plan ?? null;
    const body = arkBody(animal, plan);
    const on = onSchedule(place, animal.model_slug) && onBehaviourSchedule(animal.model_slug);
    return {
        animal,
        place,
        length: body.display,
        sched: on
            ? {
                  profile: behaviourProfile(animal.model_slug, plan),
                  animal: sched.withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length: body.display, sea: ZONE_SITES[animal.zone]?.kind === "sea"}, () => scheduleRoost(place, animal.zone)),
                  trip: null
              }
            : null
    };
});
// The scene's wiring (as `grounding/audit.ts` wire): groups, spaced homes, threats, recipes.
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

type Budget = {animals: number; samples: number; air: number; water: number; land: number; raised: number; awakeSamples: number; takeoffs: number; landings: number; enters: number; exits: number; airFromWater: number; landOnWater: number; beats: Record<string, number>; doings: Record<string, number>; airSpeeds: number[]; cruise: number | null; move: string; moves: string; flyWeight: number; swimWeight: number; perchWeight: number};
const bySpecies = new Map<string, Budget>();
const start = Date.UTC(2026, 10, 12) / 1000;
// The island's hours follow the real clock (`islandHours`): twelve 10-minute windows, one every two hours of a day.
const WINDOWS = Array.from({length: 12}, (_, i) => start + i * 7200);
const WINDOW = 600;
const hoursAt = (epoch: number) => fixedHours ?? islandHours(epoch * 1000, 0);
if (eventsFrom !== null) {
    for (const s of subjects) {
        if (!s.sched || (only && !only.includes(s.animal.model_slug))) continue;
        const depth = speciesDepth(s.animal.model_slug, s.animal.zone);
        const list: string[] = [];
        let was = "";
        for (let t = 0; t < eventSpan; t += 1) {
            const epoch = eventsFrom + t;
            const own = s.sched;
            if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = sched.tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, own.trip);
            const at = sched.poseOnTrip(world, own.trip, epoch);
            const ground = heightAt(at.x, at.z);
            const fresh = freshWaterAt(at.x, at.z) >= 0.5 && freshLevelAt(at.x, at.z) > ground + 0.02;
            const where = at.aloft ? "air" : inDepthBand(depth, at, ground) || ground < 0 || fresh ? "water" : "land";
            if (was && where !== was) list.push(`${epoch} ${was}->${where} (${own.trip.doing}, beat ${at.beat ?? "-"}, ${at.x.toFixed(1)},${at.y.toFixed(2)},${at.z.toFixed(1)})`);
            was = where;
        }
        console.log(`${s.animal.model_slug} ${s.animal.id}: ${list.length} changes`);
        for (const line of list.slice(0, 8)) console.log(`   ${line}`);
    }
    process.exit(0);
}
const started = Date.now();
for (const s of subjects) {
    if (!s.sched) continue;
    const slug = s.animal.model_slug;
    if (only && !only.includes(slug)) continue;
    const p = s.sched.profile;
    const b = bySpecies.get(slug) ?? {animals: 0, samples: 0, air: 0, water: 0, land: 0, raised: 0, awakeSamples: 0, takeoffs: 0, landings: 0, enters: 0, exits: 0, airFromWater: 0, landOnWater: 0, beats: {}, doings: {}, airSpeeds: [], cruise: flightSpec(slug, s.length, modelBase(slug)?.plan ?? null)?.cruise ?? null, move: p.move, moves: p.moves.join(","), flyWeight: p.weights.fly ?? 0, swimWeight: p.weights.swim ?? 0, perchWeight: p.weights.perch ?? 0};
    b.animals++;
    bySpecies.set(slug, b);
    const depth = speciesDepth(slug, s.animal.zone);
    let was: "air" | "water" | "land" | "raised" | null = null;
    for (const from of WINDOWS) for (let t = 0; t < WINDOW; t += step) {
        const epoch = from + t;
        if (t === 0) was = null;
        const own = s.sched;
        if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) {
            own.trip = sched.tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, own.trip);
            for (const leg of own.trip.legs) if (leg.mode === "air" && leg.seconds > 0) b.airSpeeds.push(leg.length / leg.seconds);
        }
        const at = sched.poseOnTrip(world, own.trip, epoch);
        const ground = heightAt(at.x, at.z);
        // In the water: the sea (ground under 0), or v2's lake and river (fresh water drawn there, its surface over the ground).
        const fresh = freshWaterAt(at.x, at.z) >= 0.5 && freshLevelAt(at.x, at.z) > ground + 0.02;
        const where: "air" | "water" | "land" | "raised" = at.aloft ? "air" : inDepthBand(depth, at, ground) || ground < 0 || fresh ? "water" : at.y > Math.max(ground, 0) + 0.3 || at.ny < 0.95 ? "raised" : "land";
        b.samples++;
        b[where]++;
        const doing = own.trip.doing;
        if (doing !== "sleep") b.awakeSamples++;
        b.doings[doing] = (b.doings[doing] ?? 0) + 1;
        const beat = at.beat ?? "none";
        b.beats[beat] = (b.beats[beat] ?? 0) + 1;
        if (was && was !== "air" && where === "air") {
            b.takeoffs++;
            if (was === "water") b.airFromWater++;
        }
        if (was === "air" && where !== "air") {
            b.landings++;
            if (where === "water") b.landOnWater++;
        }
        if (was && was !== "water" && where === "water") b.enters++;
        if (was === "water" && where !== "water" && where !== "air") b.exits++;
        was = where;
    }
}
const rows = Array.from(bySpecies.entries()).map(([slug, b]) => {
    const sorted = [...b.airSpeeds].sort((x, y) => x - y);
    return {slug, ...b, airSpeed: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null};
});
console.log(`${rows.reduce((n, r) => n + r.animals, 0)} animals, ${rows.length} species, step ${step} s (${((Date.now() - started) / 1000).toFixed(0)} s)`);
const pct = (n: number, d: number) => `${((100 * n) / Math.max(d, 1)).toFixed(0)}%`;
for (const r of rows.sort((a, b) => b.air / b.samples - a.air / a.samples)) {
    if (!r.flyWeight && !r.swimWeight && !r.move.includes("fly") && !r.moves.includes("fly") && !r.moves.includes("swim") && r.move !== "swim") continue;
    const hours = Math.max((r.awakeSamples * step) / 3600, 1e-6);
    console.log(`${r.slug.padEnd(32)} n=${String(r.animals).padStart(2)} ${r.move}|${r.moves} air ${pct(r.air, r.samples).padStart(4)} water ${pct(r.water, r.samples).padStart(4)} land ${pct(r.land, r.samples).padStart(4)} raised ${pct(r.raised, r.samples).padStart(4)}  takeoffs per awake hour ${(r.takeoffs / hours).toFixed(1)} (from water ${r.airFromWater}) landings on water ${r.landOnWater}/${r.landings}  into/out of water ${r.enters}/${r.exits}  air speed ${r.airSpeed === null ? "-" : r.airSpeed.toFixed(2)} m/s (L2 cruise ${r.cruise === null ? "-" : r.cruise.toFixed(1)})  beats ${Object.entries(r.beats).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${pct(v, r.samples)}`).join(" ")}`);
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));

// The audit's CI numbers (MA4): see the header.
{
    const median = (list: number[]) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : NaN);
    const quantile = (list: number[], q: number) => (list.length ? [...list].sort((a, b) => a - b)[Math.min(Math.floor(list.length * q), list.length - 1)] : NaN);
    const flyers = rows.filter((r) => r.cruise !== null && r.airSpeed !== null && flightSpec(r.slug, 1, modelBase(r.slug)?.plan ?? null)?.kind !== "insect");
    const ratios = flyers.map((r) => r.airSpeed! / r.cruise!);
    const ground = rows.filter((r) => modelBase(r.slug)?.plan === "bird" && (r.move === "walk" || r.move === "swim") && r.moves.split(",").includes("fly"));
    const share = (slug: string) => {
        const r = rows.find((x) => x.slug === slug);
        return r ? r.water / Math.max(r.samples, 1) : NaN;
    };
    const metrics: Record<string, number> = {
        air_speed_ratio_median: median(ratios),
        air_speed_ratio_p10: quantile(ratios, 0.1),
        species_under_035: ratios.filter((x) => x < 0.35).length,
        flying_species: ratios.length,
        ground_birds_air_share_worst: Math.max(0, ...ground.map((r) => r.air / Math.max(r.samples, 1))),
        ground_birds_takeoffs_worst: Math.max(0, ...ground.map((r) => r.takeoffs / Math.max((r.awakeSamples * step) / 3600, 1e-6))),
        ground_birds: ground.length,
        coot_water_share: share("eurasian-coot"),
        grebe_water_share: share("great-crested-grebe")
    };
    console.log(`metrics ${JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, Math.round(v * 1000) / 1000])))}`);
    const lane = value("--record");
    if (lane) {
        const {recordMotionMetric} = await import("../src/lib/ark-motion-metrics.ts");
        for (const [id, v] of Object.entries(metrics)) recordMotionMetric(lane, id, v);
    }
}
