#!/usr/bin/env -S npx tsx
/**
 * The water audit (behaviours pass, lane B6 water, 2026-11-14; docs/ark/behaviour-pass-2026-11/water.md): how everything
 * that lives in or uses the water spends a day on the behaviour schedule. A sibling of the movement audit's time budget
 * (`scripts/ark-time-budget.mts`: the same wiring, the same twelve 10-minute windows across a day), read finer (every
 * 2 s) and for the water:
 *
 *   - where it is: swimming, hanging still in mid-water, still on the bottom, at the surface (afloat, or up for air),
 *     wading, ashore, in the air; and the same asleep;
 *   - its speed while it swims, in body lengths a second, against its kind's cruise and burst (`locomotion/swim.ts`);
 *   - its path: metres an hour, how far it ranges from home, how straight each 10 minutes was (net over path);
 *   - schools: nearest-neighbour distance in body lengths, how aligned the headings are (0 every way, 1 all one way),
 *     how often the members move together, how far the school travels;
 *   - air breathers: breaths an hour, the usual gap between two, the share of the time at the surface;
 *   - shore crossings a day (into and out of the water), and at how many places;
 *   - a water-only animal out of the water (must be 0).
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-water-audit.mts <snapshot.json | --validator>
 *       [--islands <routing.json>] [--world v1|v2] [--step 2] [--species a,b] [--taxonomy species.json]
 *       [--school slug:n,slug:n] [--all] [--ci] [--json out.json] [--record <lane>]
 *
 * `--school pilchard:12` adds a school of twelve to the validator's animals (its fixture has two of each species).
 * `--taxonomy` (the catalogue export the profile generator reads) only adds class, order and family to the JSON.
 * `--all` prints every species (else the ones that swim, wade or live in the water).
 * `--ci` is the motion CI's run: the validator's animals, a list of species of every way of life (`CI_SPECIES`) and
 * its schools (`CI_SCHOOLS`), which is what the limits in `tests/ark-motion/metrics.json` were measured on.
 * A snapshot holds real usernames: read it in place, never copy it. Only species slugs, ids and counts are printed.
 * Pure schedule (the same for every viewer); no browser.
 *
 * The CI numbers are printed as a last `metrics` line and recorded under `--record <lane>` (`recordMotionMetric`;
 * `tests/ark-motion/metrics.json`, check `b6-water`, on the validator's animals with its schools).
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
const {swimDepth, waterMotion, waterSurfaceAt, breathAt, depthSeed} = await import("../src/ark-scene/sea-depth.ts");
const {tripBreath} = await import("../src/ark-scene/breath-trip.ts");
const {worldSampler} = await import("../src/ark-scene/world-sampler.ts");
const {heightAt, ZONE_SITES} = await import("../src/ark-scene/world.ts");
const {islandHours} = await import("../src/lib/ark-clock.ts");
const {waterLevelAt} = await import("../src/ark-scene/water-level.ts");
const {modelBase} = await import("../src/ark-scene/grounding/base.ts");
const {locoStyle} = await import("../src/ark-scene/locomotion/styles.ts");
const {swimPaces} = await import("../src/ark-scene/locomotion/swim.ts");
const {waterLife} = await import("../src/ark-scene/water-life.ts");

type ArkAnimal = import("../src/ark-scene/types.ts").ArkAnimal;
type Trip = import("../src/ark-scene/behaviour-schedule.ts").Trip;
/** The motion CI's species (`--ci`): a few of every way of life in the water, and the schools and pods among them. */
const CI_SPECIES = ["european-pilchard", "atlantic-mackerel", "bluefin-tuna", "great-white-shark", "bull-shark", "giant-oceanic-manta-ray", "spinner-dolphin", "humpback-whale", "sperm-whale", "orca", "european-perch", "neon-tetra", "northern-pike", "giant-grouper", "blue-green-chromis", "common-seahorse", "european-plaice", "common-stingray", "moon-jellyfish", "giant-squid", "common-octopus", "american-lobster", "harbor-seal", "california-sea-lion", "green-sea-turtle", "american-crocodile", "saltwater-crocodile", "american-alligator", "red-eared-slider", "common-hippopotamus", "european-otter", "sea-otter", "north-american-beaver", "capybara", "wild-boar", "axolotl", "whirligig-beetle", "danube-river-snail", "emperor-penguin", "dugong"];
const CI_SCHOOLS = "european-pilchard:12,atlantic-mackerel:12,bluefin-tuna:8,spinner-dolphin:6,european-perch:6,neon-tetra:10,blue-green-chromis:8,moon-jellyfish:8";
const ci = args.includes("--ci");
const source = ci ? "--validator" : args[0];
if (!source) throw new Error("usage: ark-water-audit.mts <snapshot.json | --validator> [--islands routing.json] [--school slug:n] [--json out.json]");
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
// `--school slug:n`: a school of n of the species in its own cluster (the validator's own pair of it replaced).
for (const spec of (value("--school") ?? (ci ? CI_SCHOOLS : "")).split(",").filter(Boolean)) {
    const [slug, count] = spec.split(":");
    const like = animals.find((a) => a.model_slug === slug);
    if (!like) continue;
    animals = animals.filter((a) => a.model_slug !== slug);
    for (let rank = 0; rank < Number(count || 8); rank++) animals.push({...like, id: `school-${slug}-${rank}`, sociality: "group", slot_rank: rank});
}
const only = value("--species")?.split(",") ?? (ci ? CI_SPECIES : undefined);
const step = Number(value("--step") ?? "2");
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const taxonomy = new Map<string, {cls: string; order: string; family: string}>();
if (value("--taxonomy")) {
    const exported = JSON.parse(readFileSync(value("--taxonomy")!, "utf8"));
    for (const r of (Array.isArray(exported) ? exported : exported.rows) as Array<{slug: string | null; class_name: string | null; order_name: string | null; family_name: string | null}>) if (r.slug) taxonomy.set(r.slug, {cls: r.class_name ?? "", order: r.order_name ?? "", family: r.family_name ?? ""});
}

const sampler = worldSampler();
const world = sched.scheduleWorld(sampler);
const places = placeAnimals(animals);
type Own = {profile: ReturnType<typeof behaviourProfile>; animal: import("../src/ark-scene/behaviour-schedule.ts").ScheduleAnimal; trip: Trip | null};
type Subject = {animal: ArkAnimal; place: NonNullable<ReturnType<typeof places.get>>; length: number; sched: Own | null; leader: Subject | null};
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

const WHERES = ["swim", "hover", "bottom", "surface", "wade", "ashore", "air"] as const;
type Where = (typeof WHERES)[number];
type Tally = Record<Where, number>;
const tally = (): Tally => ({swim: 0, hover: 0, bottom: 0, surface: 0, wade: 0, ashore: 0, air: 0});
type Budget = {
    slug: string;
    animals: number;
    length: number;
    samples: number;
    awake: Tally;
    awakeSamples: number;
    asleep: Tally;
    asleepSamples: number;
    doings: Record<string, number>;
    beats: Record<string, number>;
    /** Speeds while it swims (body lengths a second), awake and asleep. */
    speeds: number[];
    nightSpeeds: number[];
    /** How fast it turns while it swims (rad/s, over a step). */
    turns: number[];
    metres: number;
    range: number;
    straight: number[];
    breaths: number;
    breathGaps: number[];
    upSamples: number;
    waterSamples: number;
    enters: number;
    exits: number;
    crossSpots: Set<string>;
    dry: number;
    aboveSurface: number;
};
const bySpecies = new Map<string, Budget>();
const watched = subjects.filter((s) => {
    if (!s.sched || (only && !only.includes(s.animal.model_slug))) return false;
    if (args.includes("--all")) return true;
    const p = s.sched.profile;
    return p.move === "swim" || p.moves.includes("swim") || p.seabed || p.water !== null || swimDepth(s.animal.model_slug, s.animal.zone) !== null;
});
const start = Date.UTC(2026, 10, 12) / 1000;
const WINDOWS = Array.from({length: 12}, (_, i) => start + i * 7200);
const WINDOW = 600;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const topAt = (x: number, z: number) => Math.max(waterSurfaceAt(x, z), waterLevelAt(x, z, 0));
const started = Date.now();

type Sample = {x: number; y: number; z: number; yaw: number; moving: boolean; where: Where; water: boolean};
type GroupStat = {slug: string; size: number; nnd: number[]; aligned: number[]; alignedMoving: number[]; together: number; moments: number; movingMoments: number; centroid: number; spread: number[]};
const groupStats = new Map<Subject, GroupStat>();
const membersOf = new Map<Subject, Subject[]>();
for (const s of watched) {
    const lead = s.leader ?? (subjects.some((o) => o.leader === s) ? s : null);
    if (!lead) continue;
    const list = membersOf.get(lead) ?? [];
    list.push(s);
    membersOf.set(lead, list);
}
const state = new Map<Subject, {prev: Sample | null; windowStart: Sample | null; path: number; breathUp: boolean; lastBreath: number | null}>();
for (const s of watched) state.set(s, {prev: null, windowStart: null, path: 0, breathUp: false, lastBreath: null});
const now = new Map<Subject, Sample>();
const centroidWas = new Map<Subject, {x: number; z: number} | null>();

for (const from of WINDOWS) {
    for (const s of watched) {
        const st = state.get(s)!;
        st.prev = null;
        st.windowStart = null;
        st.path = 0;
        st.lastBreath = null;
        st.breathUp = false;
    }
    for (const lead of membersOf.keys()) centroidWas.set(lead, null);
    for (let t = 0; t < WINDOW; t += step) {
        const epoch = from + t;
        for (const s of watched) {
            const own = s.sched!;
            const slug = s.animal.model_slug;
            if (!own.trip || epoch < own.trip.start || epoch >= own.trip.end) own.trip = sched.tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, own.trip);
            const trip = own.trip;
            const at = sched.poseOnTrip(world, trip, epoch);
            const ground = heightAt(at.x, at.z);
            const top = topAt(at.x, at.z);
            const band = swimDepth(slug, s.animal.zone);
            const asleep = trip.doing === "sleep";
            const st = state.get(s)!;
            const prev = st.prev;
            const moved = prev ? Math.hypot(at.x - prev.x, at.z - prev.z) : 0;
            const moving = prev ? moved / step > 0.02 * Math.max(s.length, 0.05) : at.moving;
            const inBand = inDepthBand(band, at, ground, top);
            const wet = !at.aloft && ground < top - 0.02 && at.y <= top + 0.02;
            let where: Where;
            let breath = 0;
            if (at.aloft) where = "air";
            else if (inBand) {
                const motion = waterMotion(band);
                if (band.breathes && motion !== "float") breath = asleep ? breathAt(depthSeed(s.animal.id), epoch, true) : tripBreath(trip, epoch);
                where = motion === "float" || breath > 0.5 ? "surface" : moving ? "swim" : motion === "swim" ? "hover" : "bottom";
            } else if (wet) where = "wade";
            else where = "ashore";
            const b = bySpecies.get(slug) ?? {slug, animals: 0, length: s.length, samples: 0, awake: tally(), awakeSamples: 0, asleep: tally(), asleepSamples: 0, doings: {}, beats: {}, speeds: [], nightSpeeds: [], turns: [], metres: 0, range: 0, straight: [], breaths: 0, breathGaps: [], upSamples: 0, waterSamples: 0, enters: 0, exits: 0, crossSpots: new Set<string>(), dry: 0, aboveSurface: 0};
            if (!bySpecies.has(slug)) bySpecies.set(slug, b);
            if (from === WINDOWS[0] && t === 0) b.animals++;
            b.samples++;
            if (asleep) {
                b.asleep[where]++;
                b.asleepSamples++;
            } else {
                b.awake[where]++;
                b.awakeSamples++;
            }
            b.doings[trip.doing] = (b.doings[trip.doing] ?? 0) + 1;
            const beat = at.beat ?? "none";
            b.beats[beat] = (b.beats[beat] ?? 0) + 1;
            // (In the water, for its share of the day and its shore crossings: afloat or under, or wading a quarter of its
            // length deep at least, 0.3 m at most. A boar walking through a puddle has not crossed a shore.)
            const inWater = (inBand || wet) && top - ground > Math.min(Math.max(s.length * 0.25, 0.03), 0.3);
            if (inWater) b.waterSamples++;
            if (inBand && moving && prev && prev.water) {
                (asleep ? b.nightSpeeds : b.speeds).push(moved / step / Math.max(s.length, 0.01));
                if (prev.moving) b.turns.push(Math.abs(Math.atan2(Math.sin(at.yaw - prev.yaw), Math.cos(at.yaw - prev.yaw))) / step);
            }
            b.metres += moved;
            b.range = Math.max(b.range, Math.hypot(at.x - own.animal.home.x, at.z - own.animal.home.z));
            // A water-only animal out of the water, or one in its band with the schedule's own height over the surface.
            if (sched.aquatic(own.profile) && !sched.amphibious(own.profile) && !at.aloft && ground >= top - 0.02) b.dry++;
            if (inBand && at.y > top + 0.02) b.aboveSurface++;
            if (band?.breathes && inBand) {
                const up = breath > 0.5;
                if (up) b.upSamples++;
                if (up && !st.breathUp) {
                    b.breaths++;
                    if (st.lastBreath !== null) b.breathGaps.push(epoch - st.lastBreath);
                    st.lastBreath = epoch;
                }
                st.breathUp = up;
            }
            if (prev) {
                const was = prev.water;
                if (!was && inWater && prev.where !== "air") {
                    b.enters++;
                    b.crossSpots.add(`${Math.round(at.x / 3)},${Math.round(at.z / 3)}`);
                }
                if (was && !inWater && where !== "air") {
                    b.exits++;
                    b.crossSpots.add(`${Math.round(at.x / 3)},${Math.round(at.z / 3)}`);
                }
            }
            const sample: Sample = {x: at.x, y: at.y, z: at.z, yaw: at.yaw, moving, where, water: inWater};
            st.path += moved;
            st.windowStart ??= sample;
            st.prev = sample;
            now.set(s, sample);
            if (t + step >= WINDOW && st.path > Math.max(s.length, 0.05) * 2) b.straight.push(Math.hypot(at.x - st.windowStart.x, at.z - st.windowStart.z) / st.path);
        }
        // Schools and other groups in the water, this moment.
        for (const [lead, members] of membersOf) {
            if (members.length < 2) continue;
            const inWater = members.map((m) => now.get(m)!).filter((p) => p && p.water);
            if (inWater.length < 2) continue;
            const g = groupStats.get(lead) ?? {slug: lead.animal.model_slug, size: members.length, nnd: [], aligned: [], alignedMoving: [], together: 0, moments: 0, movingMoments: 0, centroid: 0, spread: []};
            groupStats.set(lead, g);
            const L = Math.max(lead.length, 0.01);
            let near = 0;
            let far = 0;
            for (const p of inWater) {
                let best = Infinity;
                for (const q of inWater) if (q !== p) {
                    const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
                    best = Math.min(best, d);
                    far = Math.max(far, d);
                }
                near += best;
            }
            g.nnd.push(near / inWater.length / L);
            g.spread.push(far / L);
            const hx = inWater.reduce((sum, p) => sum + Math.sin(p.yaw), 0) / inWater.length;
            const hz = inWater.reduce((sum, p) => sum + Math.cos(p.yaw), 0) / inWater.length;
            const aligned = Math.hypot(hx, hz);
            g.aligned.push(aligned);
            const movers = inWater.filter((p) => p.moving).length;
            g.moments++;
            if (movers >= Math.ceil(inWater.length / 2)) {
                g.movingMoments++;
                g.alignedMoving.push(aligned);
            }
            // (Together: all of them moving, or none.)
            if (movers === 0 || movers === inWater.length) g.together++;
            const cx = inWater.reduce((sum, p) => sum + p.x, 0) / inWater.length;
            const cz = inWater.reduce((sum, p) => sum + p.z, 0) / inWater.length;
            const was = centroidWas.get(lead);
            if (was) g.centroid += Math.hypot(cx - was.x, cz - was.z);
            centroidWas.set(lead, {x: cx, z: cz});
        }
    }
}

// MARK: The report

const median = (list: number[]) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : NaN);
const quantile = (list: number[], q: number) => (list.length ? [...list].sort((a, b) => a - b)[Math.min(Math.floor(list.length * q), list.length - 1)] : NaN);
const pct = (n: number, d: number) => `${((100 * n) / Math.max(d, 1)).toFixed(0)}%`;
const sampledSeconds = WINDOWS.length * WINDOW;
const perDay = 86400 / sampledSeconds;
const rows = Array.from(bySpecies.values()).map((b) => {
    const profile = behaviourProfile(b.slug);
    const plan = modelBase(b.slug)?.plan ?? null;
    const style = locoStyle(b.slug, plan).swim;
    const paces = style ? swimPaces(b.length, style) : null;
    const life = waterLife(b.slug, profile);
    const share = (t: Tally, n: number) => Object.fromEntries(WHERES.map((w) => [w, t[w] / Math.max(n, 1)])) as Record<Where, number>;
    const tax = taxonomy.get(b.slug) ?? null;
    return {
        slug: b.slug,
        animals: b.animals,
        length: b.length,
        move: profile.move,
        moves: profile.moves.join(","),
        kind: profile.water,
        life,
        social: profile.social,
        style,
        ...(tax ? {class: tax.cls, order: tax.order, family: tax.family} : {}),
        awakeShare: b.awakeSamples / Math.max(b.samples, 1),
        awake: share(b.awake, b.awakeSamples),
        asleep: share(b.asleep, b.asleepSamples),
        speedMedian: median(b.speeds),
        speedP95: quantile(b.speeds, 0.95),
        nightSpeedMedian: median(b.nightSpeeds),
        turnP95: quantile(b.turns, 0.95),
        turnMost: quantile(b.turns, 1),
        cruiseBLs: paces?.cruiseBLs ?? null,
        burstBLs: paces?.burstBLs ?? null,
        metresPerHour: b.metres / b.animals / (sampledSeconds / 3600),
        rangeLengths: b.range / Math.max(b.length, 0.01),
        straightness: median(b.straight),
        breathes: profile.breathes,
        breathsPerHour: b.breaths / b.animals / (sampledSeconds / 3600),
        breathGap: median(b.breathGaps),
        upShare: b.upSamples / Math.max(b.waterSamples, 1),
        waterShare: b.waterSamples / Math.max(b.samples, 1),
        crossingsPerDay: ((b.enters + b.exits) / b.animals) * perDay,
        crossSpots: b.crossSpots.size,
        dry: b.dry,
        aboveSurface: b.aboveSurface,
        doings: Object.fromEntries(Object.entries(b.doings).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, v / b.samples])),
        beats: Object.fromEntries(Object.entries(b.beats).sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, v / b.samples]))
    };
});
console.log(`${watched.length} animals, ${rows.length} species, step ${step} s (${((Date.now() - started) / 1000).toFixed(0)} s)`);
const f = (v: number | null, digits = 2) => (v === null || Number.isNaN(v) ? "-" : v.toFixed(digits));
for (const r of rows.sort((a, b) => (a.life ?? "~").localeCompare(b.life ?? "~") || a.slug.localeCompare(b.slug))) {
    const where = (t: Record<Where, number>) => WHERES.filter((w) => t[w] >= 0.005).map((w) => `${w} ${(100 * t[w]).toFixed(0)}%`).join(" ");
    console.log(
        `${(r.life ?? "-").padEnd(9)} ${r.slug.padEnd(30)} n=${String(r.animals).padStart(2)} ${String(r.kind ?? "-").padEnd(9)} ${String(r.style ?? "-").padEnd(14)} awake ${pct(r.awakeShare, 1).padStart(4)}: ${where(r.awake)} | asleep: ${where(r.asleep)} | speed ${f(r.speedMedian)} (p95 ${f(r.speedP95)}, asleep ${f(r.nightSpeedMedian)}) of cruise ${f(r.cruiseBLs)} burst ${f(r.burstBLs)} L/s turn p95 ${f(r.turnP95)} most ${f(r.turnMost)} rad/s | ${f(r.metresPerHour, 0)} m/h range ${f(r.rangeLengths, 0)} L straight ${f(r.straightness)}` +
            (r.breathes ? ` | breaths ${f(r.breathsPerHour, 1)}/h gap ${f(r.breathGap, 0)} s up ${pct(r.upShare, 1)}` : "") +
            (r.crossingsPerDay ? ` | shore ${f(r.crossingsPerDay, 0)}/day at ${r.crossSpots}` : "") +
            (r.dry || r.aboveSurface ? ` | DRY ${r.dry} ABOVE ${r.aboveSurface}` : "")
    );
}
const groupRows = Array.from(groupStats.values()).map((g) => ({slug: g.slug, size: g.size, life: waterLife(g.slug, behaviourProfile(g.slug)), social: behaviourProfile(g.slug).social, nnd: median(g.nnd), spread: median(g.spread), aligned: median(g.aligned), alignedMoving: median(g.alignedMoving), movingShare: g.movingMoments / Math.max(g.moments, 1), together: g.together / Math.max(g.moments, 1), lengthsPerHour: g.centroid / Math.max(g.moments * step, 1) * 3600 / Math.max(bySpecies.get(g.slug)?.length ?? 1, 0.01)}));
console.log(`\ngroups in the water (${groupRows.length}): nearest neighbour and spread in body lengths, alignment 0-1, share of moments most are moving, all-or-none together, the group's travel`);
for (const g of groupRows.sort((a, b) => b.size - a.size || a.slug.localeCompare(b.slug)).slice(0, args.includes("--all") ? 400 : 60)) {
    console.log(`${(g.life ?? "-").padEnd(9)} ${g.slug.padEnd(30)} n=${String(g.size).padStart(2)} ${g.social.padEnd(8)} nnd ${f(g.nnd)} spread ${f(g.spread, 1)} aligned ${f(g.aligned)} (moving ${f(g.alignedMoving)}) moving ${pct(g.movingShare, 1)} together ${pct(g.together, 1)} travel ${f(g.lengthsPerHour, 0)} L/h`);
}
const out = value("--json");
if (out) writeFileSync(out, JSON.stringify({rows, groups: groupRows}, null, 1));

// The CI numbers: see the header.
{
    const of = (life: string) => rows.filter((r) => r.life === life);
    const awakeSwim = (r: (typeof rows)[number]) => r.awake.swim + (r.awake.surface > 0 && r.breathes ? r.awake.surface : 0);
    const least = (list: number[]) => (list.length ? Math.min(...list) : NaN);
    const most = (list: number[]) => (list.length ? Math.max(...list) : NaN);
    const schools = groupRows.filter((g) => g.social === "school" && g.size >= 6);
    const cruiserSchools = schools.filter((g) => g.life === "cruiser");
    const share = (slug: string, pick: (r: (typeof rows)[number]) => number) => {
        const r = rows.find((x) => x.slug === slug);
        return r ? pick(r) : NaN;
    };
    const metrics: Record<string, number> = {
        water_species: rows.length,
        water_only_dry_samples: rows.reduce((sum, r) => sum + r.dry, 0),
        band_above_surface_samples: rows.reduce((sum, r) => sum + r.aboveSurface, 0),
        cruisers: of("cruiser").length,
        cruiser_swim_share_least: least(of("cruiser").map(awakeSwim)),
        cruiser_swim_share_median: median(of("cruiser").map(awakeSwim)),
        cruiser_asleep_swim_share_least: least(of("cruiser").filter((r) => r.awakeShare < 0.999).map((r) => r.asleep.swim + r.asleep.surface)),
        cruiser_speed_over_cruise_median: median(of("cruiser").filter((r) => r.cruiseBLs).map((r) => r.speedMedian / r.cruiseBLs!)),
        cruiser_turn_rate_p95_most: most(of("cruiser").concat(of("cetacean")).filter((r) => !Number.isNaN(r.turnP95)).map((r) => r.turnP95)),
        swimmer_speed_over_burst_most: most(rows.filter((r) => r.burstBLs && !Number.isNaN(r.speedP95)).map((r) => r.speedP95 / r.burstBLs!)),
        ambush_swim_share_most: most(of("ambush").map((r) => r.awake.swim)),
        school_nnd_median: median(cruiserSchools.map((g) => g.nnd)),
        school_nnd_most: most(cruiserSchools.map((g) => g.nnd)),
        school_alignment_moving_least: least(cruiserSchools.map((g) => g.alignedMoving)),
        school_moving_share_least: least(cruiserSchools.map((g) => g.movingShare)),
        cetacean_breath_gap_median: median(rows.filter((r) => r.life === "cetacean" && !Number.isNaN(r.breathGap)).map((r) => r.breathGap)),
        cetaceans_never_up: rows.filter((r) => r.life === "cetacean" && r.breathsPerHour === 0).length,
        dolphin_breath_gap: share("spinner-dolphin", (r) => r.breathGap),
        rover_swim_share_least: least(of("rover").map(awakeSwim)),
        rover_swim_share_median: median(of("rover").map(awakeSwim)),
        seal_crossings_per_day_most: most(of("seal").map((r) => r.crossingsPerDay)),
        croc_water_share_least: least(of("croc").map((r) => r.waterShare)),
        croc_crossings_per_day_most: most(of("croc").map((r) => r.crossingsPerDay)),
        shore_crossings_per_day_most: most(rows.filter((r) => r.life && r.life !== "walker").map((r) => r.crossingsPerDay)),
        hippo_water_share: share("common-hippopotamus", (r) => r.waterShare),
        pilchard_swim_share: share("european-pilchard", awakeSwim),
        perch_swim_share: share("european-perch", awakeSwim)
    };
    console.log(`metrics ${JSON.stringify(Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, Math.round(v * 1000) / 1000])))}`);
    const lane = value("--record");
    if (lane) {
        const {recordMotionMetric} = await import("../src/lib/ark-motion-metrics.ts");
        for (const [id, v] of Object.entries(metrics)) if (Number.isFinite(v)) recordMotionMetric(lane, id, v);
    }
}
