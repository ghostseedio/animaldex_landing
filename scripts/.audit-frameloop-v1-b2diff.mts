/**
 * PERF-WEB audit, identity verifier for FRAME-1 (2026-11-27). Untracked helper; not part of the tree.
 *
 * FRAME-1 proposes warming the lower tier's resting answers (`restingAtRoost` at the rotation step's start) ahead of a
 * tier drop. This asks, headless on the real snapshot, the questions its identity rests on:
 *   1. at the high tier, how many animals the 1,200 rotation asks (beyond rule E) and how many the 400 / 200 ones ask,
 *      and whether every one of those is drawn one by one at high (so `restingFor` uses that entry's own schedule);
 *   2. the cold cost of those asks (ms each), as the drop's `setSnapshot` pays it;
 *   3. whether an answer worked out in another state gives the same rotation: before the wiring is applied (homes,
 *      groups, threats), before the town's behaviour world (`makeSched` null: "not resting");
 *   4. whether asking early, before the wiring is applied, changes anything asked AFTER it (answers and every entry's trips
 *      and poses over a window): the first-call caches `homePerches` and `matesBedsMemo` are never forgotten;
 *   5. whether asking them in another order, interleaved with the frames' own trips, within one state, changes anything.
 *
 *   npx tsx scripts/.audit-frameloop-v1-resting.mts --snapshot <voyage.json> [--from <epoch s>] [--window 400] [--every 10]
 *        [--out <dir>]
 */
import {readFileSync, writeFileSync, existsSync, mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {setArkWorld} from "@/ark-scene/world";

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] !== undefined && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
setArkWorld("v2");

const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot} = await import("@/lib/ark-islands");
const {placeAnimals} = await import("@/ark-scene/placement");
const {hamletPlotsFor} = await import("@/ark-scene/map/hamlet");
const {setAttachHomePlots} = await import("@/ark-scene/sampler");
const {setBehaviourHomePlots, worldSampler} = await import("@/ark-scene/world-sampler");
const {mapHabitatAt, onSchedule, scheduleRoost} = await import("@/ark-scene/map/place");
const {onBehaviourSchedule} = await import("@/ark-scene/schedule-water");
const {behaviourProfile} = await import("@/ark-scene/behaviour-profile");
const sched = await import("@/ark-scene/behaviour-schedule");
const {forgetSchedules, groupSpread, rangeReach, scheduleWorld, spaceHomes, tripAt, poseOnTrip, wireThreats, withLazyRoost, SLOT_SECONDS, slotOffset, awakeAt, scheduleGeneration} = sched;
const restingAtRoost = (sched as unknown as {restingAtRoost: (w: unknown, p: unknown, a: unknown, t: number, h: unknown, act?: unknown) => {resting: boolean}}).restingAtRoost;
const {setRecipeColliders, wireRecipes, setRecordedSexes, sexLook} = await import("@/ark-scene/behaviour-recipes");
const {collideBlocked, collideSegmentClear, setIslandColliders} = await import("@/ark-scene/collide");
const {eats} = await import("@/ark-scene/food-links");
const {arkBody} = await import("@/ark-scene/stats");
const {arkThriveOf} = await import("@/ark-scene/thrive");
const {ZONE_SITES} = await import("@/ark-scene/world");
const {islandHours} = await import("@/lib/ark-clock");
const {arkSleepOf} = await import("@/ark-scene/sleep-hours");
const {groupLives} = await import("@/ark-scene/behaviour-group");
const {placeTownAnimals, maskBox, penKeep} = await import("@/ark-scene/islands/town/placement");
const {townColliderSet} = await import("@/ark-scene/islands/town/colliders");
const {townWorldSampler} = await import("@/ark-scene/islands/town/sampler");
const {townWorldOrigin} = await import("@/ark-scene/islands");
const {townZooBeds} = await import("@/ark-scene/islands/town/zoo-beds");
const {displayLength} = await import("@/ark-scene/sizes");
const {residentFeeding, zooRhythm, feedingHome} = await import("@/ark-scene/islands/town/zoo-life");
const {townClockAt} = await import("@/ark-scene/islands/town/people");
const {townHeight} = await import("@/ark-scene/islands/town/ground");
const {arkRepresentatives, ARK_HERD_LIVE} = await import("@/ark-scene/herds");
const liveBudget = await import("@/ark-scene/live-budget");
const {ARK_LIVE_BUDGET, arkOutside, arkWithinCapacity, arkZoneCapacity, arkRestingAsks} = liveBudget;
const {wireZoneCapacity} = await import("@/ark-scene/map/capacity");
const {isHumanAnimal} = await import("@/ark-scene/humans/town-humans");

type ArkAnimal = import("@/ark-scene/types").ArkAnimal;
type ScheduleAnimal = import("@/ark-scene/behaviour-schedule").ScheduleAnimal;
type Trip = import("@/ark-scene/behaviour-schedule").Trip;
type Profile = import("@/ark-scene/behaviour-profile").ArkBehaviourProfile;
type ScheduleWorld = import("@/ark-scene/behaviour-schedule").ScheduleWorld;

const raw = JSON.parse(readFileSync(arg("snapshot", "/Users/lennybeadle/AnimalDex-work/ark-perf-web/real/voyage.json"), "utf8"));
const whole = decodeArkSnapshot(raw.snapshot ?? raw)!;
// (index.ts setSnapshot: humans are never animal entries.)
const snapshot = {...whole, animals: whole.animals.filter((a) => !isHumanAnimal(a))};
const fromArg = Number(arg("from", String(Math.floor(Date.UTC(2026, 10, 27, 3, 0, 0) / 1000))));
const step = Math.floor(fromArg / 300);
const askAt = step * 300;
const from = askAt + 120;
const windowS = Number(arg("window", "400"));
const every = Number(arg("every", "10"));
const outDir = arg("out", "/Users/lennybeadle/AnimalDex-work/ark-perf-web/scratch/frameloop-verify1");
if (!existsSync(outDir)) mkdirSync(outDir, {recursive: true});
const plansDir = path.join(process.env.HOME ?? "", "animaldex-talking-models");
const planCache = new Map<string, string | undefined>();
const planOf = (slug: string): string | undefined => {
    if (!planCache.has(slug)) {
        let plan: string | undefined;
        try {
            const file = path.join(plansDir, "ark", slug, "ark.json");
            if (existsSync(file)) plan = (JSON.parse(readFileSync(file, "utf8")) as {behaviour?: {plan?: string}}).behaviour?.plan;
        } catch {
            plan = undefined;
        }
        planCache.set(slug, plan);
    }
    return planCache.get(slug);
};

const t0 = performance.now();
const wildAnimals = arkIslandSnapshot(snapshot, "wild").animals;
const townAnimals = arkIslandSnapshot(snapshot, "town").animals;
const plots = hamletPlotsFor(wildAnimals);
setAttachHomePlots(plots);
setBehaviourHomePlots(plots);
setRecipeColliders({segmentClear: collideSegmentClear, blocked: (x, z, r) => collideBlocked(x, z, r)});
setRecordedSexes(snapshot.animals);
const wildPlaces = placeAnimals(wildAnimals);
const wildWorld = scheduleWorld(worldSampler());
const origin = townWorldOrigin();
const placed = placeTownAnimals(townAnimals);
const townSet = townColliderSet(placed.open, origin);
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
for (const c of townSet.list) {
    x0 = Math.min(x0, c.cx - c.reach);
    x1 = Math.max(x1, c.cx + c.reach);
    z0 = Math.min(z0, c.cz - c.reach);
    z1 = Math.max(z1, c.cz + c.reach);
}
setIslandColliders({contains: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1, set: townSet});
const townWorld = scheduleWorld(townWorldSampler(placed.open, origin, townSet));
const towned = placed.town;
const beds = townZooBeds(towned, townAnimals.map((a) => ({id: a.id, model_slug: a.model_slug, length: displayLength(a)})), townSet, origin.x, origin.z);
const STILL_WHERE = new Set(["window", "indoor", "pool"]);
const townScheduled = (id: string) => {
    const info = towned.get(id);
    return Boolean(info) && !info!.still && !STILL_WHERE.has(info!.where);
};
const kept = (id: string) => {
    const area = towned.get(id)?.area;
    return area === "house" || area === "farm" || area === "zoo";
};
const held = (id: string) => {
    const info = towned.get(id);
    return Boolean(info && (info.tank || info.display || info.where === "indoor" || info.where === "window"));
};
const townIds = new Set(townAnimals.map((a) => a.id));
const hours = (epoch: number) => islandHours(epoch * 1000, 0);
const allPlaces = new Map<string, {x: number; z: number; ground: number; leader?: string | null; rank?: number}>();
wildPlaces.forEach((p, id) => allPlaces.set(id, p));
placed.places.forEach((p, id) => allPlaces.set(id, {...p, x: p.x + origin.x, z: p.z + origin.z}));
const snapshotById = new Map(snapshot.animals.map((a) => [a.id, a]));
const tBuilt = performance.now();

// 1. The rotation at high (index.ts setSnapshot -> runtime.outside), rule E wired as index.ts wires it.
wireZoneCapacity(liveBudget as never);
const capacity = snapshot.animals.length >= 1000 ? arkZoneCapacity() : null;
const reps = arkRepresentatives(snapshot.animals, {pinned: new Set<string>(), live: ARK_HERD_LIVE});
const livePins = new Set<string>(snapshot.animals.filter((a) => townIds.has(a.id) && held(a.id)).map((a) => a.id));
const candidates = snapshot.animals.filter((a) => reps.live.has(a.id)).map((a) => ({id: a.id, group: a.species_profile_id || `slug:${a.model_slug}`, zone: townIds.has(a.id) ? "town" : a.zone}));
const within = capacity ? arkWithinCapacity(candidates, capacity, askAt, livePins) : candidates;
const out1200 = arkOutside(within, ARK_LIVE_BUDGET.high, askAt, livePins);
const never = () => undefined;
const asks = {
    high: arkRestingAsks(candidates, ARK_LIVE_BUDGET.high, askAt, livePins, capacity, never),
    medium: arkRestingAsks(candidates, ARK_LIVE_BUDGET.medium, askAt, livePins, capacity, never),
    low: arkRestingAsks(candidates, ARK_LIVE_BUDGET.low, askAt, livePins, capacity, never)
};
const ruleEOnly = capacity ? (() => {
    const seen: string[] = [];
    arkWithinCapacity(candidates, capacity, askAt, livePins, (c) => {
        seen.push(c.id);
        return false;
    });
    return seen;
})() : [];
const kinds = new Set(within.map((c) => c.group)).size;
const report: Record<string, unknown> = {
    at: {step, askAt, from, islandHour: +hours(askAt).toFixed(2)},
    rotation: {animals: snapshot.animals.length, live: reps.live.size, candidates: candidates.length, withinCapacity: within.length, kindsWithin: kinds, livePins: livePins.size, out1200: out1200.size, ruleEAsks: ruleEOnly.length, asksHigh: asks.high.length, asksMedium: asks.medium.length, asksLow: asks.low.length, mediumAsksAllOutAtHigh: asks.medium.every((id) => out1200.has(id)), lowAsksInMedium: asks.low.every((id) => asks.medium.includes(id) || asks.high.includes(id)), mediumTown: asks.medium.filter((id) => townIds.has(id)).length, mediumKeptWithMates: 0, mediumFlyers: 0}
};
console.error(`built in ${Math.round(tBuilt - t0)} ms; rotation ${JSON.stringify(report.rotation)}`);

// The scene's entries at high, and its schedules (index.ts makeSched, wireSchedules), one set per experiment.
type Sched = {animal: ScheduleAnimal; profile: Profile; trip: Trip | null};
type Entry = {animal: ArkAnimal; place: {x: number; z: number; ground: number; leader?: string | null; rank?: number}; town: boolean; length: number; sched: Sched | null; leader: Entry | null};
type World = {entries: Entry[]; entryById: Map<string, Entry>; makeSched: (animal: ArkAnimal, place: Entry["place"], length: number) => Sched | null; feeding: WeakMap<ScheduleAnimal, ScheduleAnimal>; townReady: boolean};
const roster = snapshot.animals.filter((a) => reps.live.has(a.id) && out1200.has(a.id));
const worldOf = (animal: {id: string}): ScheduleWorld => (townIds.has(animal.id) ? townWorld : wildWorld);

function buildSet(townReady: boolean): World {
    const entries: Entry[] = [];
    const entryById = new Map<string, Entry>();
    for (const animal of roster) {
        const place = allPlaces.get(animal.id);
        if (!place) continue;
        const body = arkBody(animal, planOf(animal.model_slug));
        entries.push({animal, place, town: townIds.has(animal.id), length: body.display * sexLook(animal.id, animal.model_slug).scale, sched: null, leader: null});
    }
    for (const e of entries) entryById.set(e.animal.id, e);
    const set: World = {entries, entryById, makeSched: () => null, feeding: new WeakMap(), townReady};
    set.makeSched = (animal, place, length) => {
        if (!onSchedule(place as never, animal.model_slug) || !onBehaviourSchedule(animal.model_slug)) return null;
        const inTown = townIds.has(animal.id);
        // (index.ts makeSched: a town animal waits for the town's behaviour world.)
        if (inTown && (!townScheduled(animal.id) || !set.townReady)) return null;
        const sea = !inTown && ZONE_SITES[animal.zone]?.kind === "sea";
        const info = towned.get(animal.id);
        const keep = inTown ? (info?.pen ? penKeep(info.pen, info.penMargin ?? 0, origin.x, origin.z) : info?.enclosure?.mask && info.enclosureMargin !== undefined ? penKeep(maskBox(info.enclosure.mask), info.enclosureMargin, origin.x, origin.z) : null) : null;
        const matesOf = (): string[] => {
            const e = info?.enclosure;
            if (!e || info?.area !== "zoo" || info.enclosureMargin === undefined) return [];
            const list: string[] = [];
            towned.forEach((o, other) => {
                if (o.area === "zoo" && o.enclosure?.id === e.id && o.enclosureMargin !== undefined && !o.still) list.push(other);
            });
            return list;
        };
        const mateIds = inTown ? matesOf() : [];
        return {
            animal: withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea, thrive: arkThriveOf(animal), sleep: arkSleepOf(animal), condition: animal.condition ?? null, ...(inTown ? {range: info ? Math.max(info.range, 0.6) * 1.5 : null, kept: true, keep, bed: beds.get(animal.id) ?? null, mates: () => mateIds.flatMap((id) => {
                const m = entryById.get(id);
                return m?.sched ? [{animal: m.sched.animal, profile: m.sched.profile, activity: m.animal.activity}] : [];
            })} : {})} as never, () => (inTown ? null : scheduleRoost(place as never, animal.zone))),
            profile: behaviourProfile(animal.model_slug, planOf(animal.model_slug)),
            trip: null
        };
    };
    for (const e of entries) e.sched = set.makeSched(e.animal, e.place, arkBody(e.animal, planOf(e.animal.model_slug)).display);
    for (const e of entries) e.leader = e.place.leader && e.place.leader !== e.animal.id ? entryById.get(e.place.leader) ?? null : null;
    return set;
}

/** index.ts wireSchedules + its apply, at once (the scene slices the spacing; the result is the same). */
function wire(set: World): {spacedMoved: number; flyersMoved: number} {
    const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
    const onIt = set.entries.filter((e) => e.sched);
    const sizes = new Map<Entry, number>();
    for (const e of onIt) if (e.leader?.sched) sizes.set(e.leader, (sizes.get(e.leader) ?? 1) + 1);
    const keptTown = (e: Entry) => e.town && kept(e.animal.id);
    const keptSizes = new Map<string, number>();
    for (const e of onIt) {
        const lead = e.place.leader;
        if (!lead || lead === e.animal.id || !keptTown(e) || keptSizes.has(lead)) continue;
        let n = 1;
        allPlaces.forEach((place, id) => {
            if (id !== lead && place.leader === lead && snapshotById.get(id)?.model_slug === e.animal.model_slug) n++;
        });
        keptSizes.set(lead, n);
    }
    const standIns = new Map<string, Sched | null>();
    const keptLeader = (e: Entry) => {
        const id = e.place.leader;
        if (!id || id === e.animal.id || !keptTown(e)) return null;
        const out = set.entryById.get(id);
        if (out?.sched) return {animal: out.sched.animal, profile: out.sched.profile, activity: out.animal.activity};
        const animal = snapshotById.get(id);
        const place = allPlaces.get(id);
        if (!animal || !place) return null;
        let s = standIns.get(id);
        if (s === undefined) standIns.set(id, (s = set.makeSched(animal, place, arkBody(animal, planOf(animal.model_slug)).display)));
        return s ? {animal: s.animal, profile: s.profile, activity: animal.activity} : null;
    };
    const groups = new Map<Entry, import("@/ark-scene/behaviour-schedule").ScheduleGroup | null>();
    for (const e of onIt) {
        const own = e.sched!;
        const grouped = GROUPED.has(own.profile.social) || groupLives(e.animal.model_slug);
        const k = grouped ? keptLeader(e) : null;
        if (k && snapshotById.get(e.place.leader!)?.model_slug === e.animal.model_slug) {
            groups.set(e, {leader: k.animal, profile: k.profile, activity: k.activity, rank: Math.max(e.place.rank ?? 1, 1), size: Math.max(keptSizes.get(e.place.leader!) ?? 2, 2)});
            continue;
        }
        const leader = e.leader && e.leader.sched && e.leader.animal.model_slug === e.animal.model_slug && grouped ? e.leader : null;
        groups.set(e, leader ? {leader: leader.sched!.animal, profile: leader.sched!.profile, activity: leader.animal.activity, rank: Math.max(e.place.rank ?? 1, 1), size: sizes.get(leader) ?? 2} : null);
    }
    const ledOf = new Map<ScheduleAnimal, number>();
    groups.forEach((g) => g && ledOf.set(g.leader, (ledOf.get(g.leader) ?? 1) + 1));
    const radius = new Map(onIt.map((e) => [e.animal.id, rangeReach(e.sched!.profile, e.sched!.animal) + (sizes.has(e) ? groupSpread(e.length, sizes.get(e)!) : 0)]));
    const spaced = spaceHomes(
        onIt.filter((e) => !groups.get(e) && !keptTown(e)).map((e) => {
            const nav = worldOf(e.sched!.animal).nav;
            const habitat = (x: number, z: number) => e.town || mapHabitatAt(e.animal, x, z, 5);
            const p = e.sched!.profile;
            return {id: e.animal.id, slug: e.animal.model_slug, home: {x: e.sched!.animal.home.x, z: e.sched!.animal.home.z}, length: e.length, walkable: (x: number, z: number) => (p.move === "swim" || p.seabed ? nav.swimmable(x, z, 0.5) : p.move === "fly" ? worldOf(e.animal).sampler.heightAt(x, z) > 0.05 && habitat(x, z) : nav.walkable(x, z) && habitat(x, z))};
        }),
        eats,
        (id) => radius.get(id) ?? 3
    );
    for (const e of onIt) {
        const own = e.sched!;
        own.animal.group = groups.get(e) ?? null;
        own.animal.led = ledOf.get(own.animal) ?? 0;
        const age = typeof snapshot.ark_day === "number" && typeof e.animal.born_ark_day === "number" ? snapshot.ark_day - e.animal.born_ark_day : null;
        own.animal.young = e.animal.origin === "born" && age !== null && age < 90;
    }
    let spacedMoved = 0;
    let flyersMoved = 0;
    for (const e of onIt) {
        const moved = spaced.get(e.animal.id);
        if (!moved) continue;
        const own = e.sched!;
        if (moved.home.x !== own.animal.home.x || moved.home.z !== own.animal.home.z) {
            spacedMoved++;
            if (own.profile.move === "fly" || own.profile.moves.includes("fly")) flyersMoved++;
        }
        own.animal.home = {x: moved.home.x, y: Math.max(worldOf(e.animal).sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
        own.animal.range = moved.range === null ? null : sizes.has(e) ? moved.range / 2 : moved.range;
        own.animal.prey = moved.prey;
    }
    for (const e of onIt) {
        const lead = e.sched!.animal.group?.leader;
        if (!lead || !e.leader || !spaced.has(e.leader.animal.id)) continue;
        e.sched!.animal.home = {...lead.home};
        e.sched!.animal.range = lead.range;
    }
    for (const e of onIt) e.sched!.trip = null;
    wireThreats(onIt.map((e) => ({slug: e.animal.model_slug, animal: e.sched!.animal, profile: e.sched!.profile, activity: e.animal.activity})), eats);
    forgetSchedules();
    wireRecipes(onIt.map((e) => ({animal: e.sched!.animal, profile: e.sched!.profile, slug: e.animal.model_slug, activity: e.animal.activity})));
    return {spacedMoved, flyersMoved};
}

/** index.ts restingFor at the step's instant: the entry's own schedule, else one made for it; remembered per id. */
function oracle(set: World, memo: Map<string, boolean>, times?: number[]) {
    return (id: string): boolean => {
        const known = memo.get(id);
        if (known !== undefined) return known;
        const animal = snapshotById.get(id);
        const place = allPlaces.get(id);
        if (!animal || !place) return false;
        const s = set.entryById.get(id)?.sched ?? set.makeSched(animal, place, arkBody(animal, planOf(animal.model_slug)).display);
        const t = performance.now();
        const value = s ? restingAtRoost(worldOf(s.animal), s.profile, s.animal, askAt, hours, animal.activity).resting : false;
        if (times) times.push(performance.now() - t);
        memo.set(id, value);
        return value;
    };
}
/** runtime.outside at the medium budget with these answers (rule E first, as index.ts). */
function outsideWith(isResting: (id: string) => boolean): Set<string> {
    const r = (c: {id: string}) => isResting(c.id);
    const w = capacity ? arkWithinCapacity(candidates, capacity, askAt, livePins, r) : candidates;
    return arkOutside(w, ARK_LIVE_BUDGET.medium, askAt, livePins, r);
}
const diff = (a: Set<string>, b: Set<string>) => {
    let n = 0;
    a.forEach((id) => {
        if (!b.has(id)) n++;
    });
    return n;
};

/** The frames' trips (index.ts tripFor: the holder's trip for its slot, the zoo's feeding variant, the previous handed on). */
function frames(set: World, interleave: string[] | null, ask: ((id: string) => boolean) | null): {hash: string; perEntry: Map<string, string>; trips: number; rawLines: Map<string, string[]>} {
    const clockAt = (ms: number) => townClockAt(ms, 0);
    const feedingAnimal = (animal: ScheduleAnimal, epoch: number, rhythm: {activity: string | null | undefined; awake: (t: number) => boolean}): ScheduleAnimal => {
        const enclosure = towned.get(animal.id)?.enclosure;
        if (!enclosure) return animal;
        const offset = slotOffset(animal.id);
        const start = Math.floor((epoch + offset) / SLOT_SECONDS) * SLOT_SECONDS - offset;
        const own = zooRhythm(rhythm.activity as never);
        if (!residentFeeding(enclosure.type, own, clockAt(start * 1000), rhythm.awake(start))) return animal;
        let variant = set.feeding.get(animal);
        if (!variant) {
            const station = feedingHome(enclosure, townHeight);
            const lead = (base: ScheduleAnimal) => (towned.get(base.id)?.enclosure?.id === enclosure.id ? set.feeding.get(base) ?? base : base);
            variant = Object.create(animal, {
                home: {value: {x: station.x + origin.x, y: station.y, z: station.z + origin.z}, enumerable: true},
                range: {value: station.range * 1.5, enumerable: true},
                group: {get: () => (animal.group ? {...animal.group, leader: lead(animal.group.leader)} : animal.group), enumerable: true}
            }) as ScheduleAnimal;
            set.feeding.set(animal, variant);
        }
        return variant;
    };
    const r6 = (v: number) => (Number.isFinite(v) ? v.toFixed(6) : String(v));
    const tripLine = (t: Trip) => `${t.slot}|${t.doing}|${r6(t.start)}|${r6(t.end)}|${r6(t.from.x)},${r6(t.from.z)}|${r6(t.to.x)},${r6(t.to.y)},${r6(t.to.z)}|${r6(t.finish.x)},${r6(t.finish.y)},${r6(t.finish.z)},${r6(t.finish.yaw ?? NaN)}|${r6(t.arrive)}|${t.legs.map((l) => `${l.mode}:${r6(l.seconds)}:${l.path ? l.path.map((p: {x: number; z: number}) => `${r6(p.x)},${r6(p.z)}`).join(";") : ""}`).join("/")}|${(t.stay ?? []).map((b: {at: number; beat: string; x: number; z: number; yaw: number}) => `${r6(b.at)}:${b.beat}:${r6(b.x)},${r6(b.z)},${r6(b.yaw)}`).join("/")}\n`;
    const hashes = new Map<Entry, ReturnType<typeof createHash>>();
    const rawLines = new Map<string, string[]>();
    const mark = (e: Entry, line: string) => {
        let r = rawLines.get(e.animal.id);
        if (!r) rawLines.set(e.animal.id, (r = []));
        r.push(line);
        let h = hashes.get(e);
        if (!h) hashes.set(e, (h = createHash("sha256")));
        h.update(line);
    };
    const stepped = set.entries.filter((e) => e.sched);
    let trips = 0;
    const queue = interleave ? [...interleave] : [];
    // (Spread over the window's frames so every ask lands between frames' own trips.)
    const per = Math.max(Math.ceil(queue.length / (Math.floor(windowS / every) + 1)), 1);
    for (let t = 0; t <= windowS; t += every) {
        const epoch = from + t;
        // (The warm-up's share this frame, before the frame's own trips, as index.ts frame orders them: popped from the end.)
        for (let k = 0; k < per && ask && queue.length; k++) ask(queue.pop()!);
        for (const e of stepped) {
            const own = e.sched!;
            let trip = own.trip;
            if (!trip || epoch < trip.start || epoch >= trip.end) {
                const activity = e.animal.activity;
                const profile = own.profile;
                const animal = own.animal;
                const rhythm = {activity: activity ?? profile.activity, awake: (x: number) => awakeAt(profile, activity, hours(x), arkSleepOf(animal as never))};
                const who = e.town ? feedingAnimal(animal, epoch, rhythm) : animal;
                let previous = trip;
                if (e.town) {
                    const before = feedingAnimal(animal, epoch - SLOT_SECONDS, rhythm);
                    const kept0 = previous && epoch - SLOT_SECONDS >= previous.start && epoch - SLOT_SECONDS < previous.end;
                    if (before !== who && !kept0) previous = tripAt(worldOf(animal), profile, before, epoch - SLOT_SECONDS, hours, activity, null);
                }
                own.trip = trip = tripAt(worldOf(animal), profile, who, epoch, hours, activity, previous);
                trips++;
                mark(e, tripLine(trip));
            }
            const p = poseOnTrip(worldOf(own.animal), trip, epoch);
            mark(e, `pose ${r6(epoch)} ${r6(p.x)},${r6(p.y)},${r6(p.z)},${r6(p.yaw)},${p.moving ? 1 : 0},${p.aloft ? 1 : 0}\n`);
        }
    }
    const perEntry = new Map<string, string>();
    for (const e of stepped) perEntry.set(e.animal.id, hashes.get(e)?.digest("hex") ?? "-");
    const lines = Array.from(perEntry, ([id, h]) => `${id} ${h}`).sort();
    return {hash: createHash("sha256").update(lines.join("\n")).digest("hex"), perEntry, trips, rawLines};
}
const fpDiff = (a: Map<string, string>, b: Map<string, string>) => {
    const ids: string[] = [];
    a.forEach((h, id) => {
        if (b.get(id) !== h) ids.push(id);
    });
    return ids;
};
const describe = (ids: string[]) => ids.slice(0, 12).map((id) => {
    const a = snapshotById.get(id)!;
    return `${a.model_slug}#${id.slice(0, 8)}${townIds.has(id) ? `@${towned.get(id)?.area ?? "town"}` : ""}`;
});


// B1, B2, B3: today's procedure three times in one process (fresh entries and ScheduleAnimals each time; the worlds,
// samplers, nav grids and every module-level cache shared). B1's hash against run1's B (a fresh process) says whether a
// cold process is deterministic; B1 against B2 whether something a run leaves behind changes the next one.
function runB(label: string) {
    const set = buildSet(true);
    wire(set);
    const memo = new Map<string, boolean>();
    const out = outsideWith(oracle(set, memo));
    const fp = frames(set, null, null);
    console.error(`${label}: hash ${fp.hash.slice(0, 16)} trips ${fp.trips} out ${out.size}`);
    return {set, memo, out, fp};
}
const b1 = runB("B1");
const b2 = runB("B2");
const b3 = runB("B3");
const changed12 = fpDiff(b1.fp.perEntry, b2.fp.perEntry);
const changed23 = fpDiff(b2.fp.perEntry, b3.fp.perEntry);
const firstDiffs = changed12.slice(0, 12).map((id) => {
    const a = b1.fp.rawLines.get(id) ?? [];
    const b = b2.fp.rawLines.get(id) ?? [];
    let k = 0;
    while (k < a.length && k < b.length && a[k] === b[k]) k++;
    const s = b1.set.entryById.get(id)?.sched;
    return {who: describe([id])[0], firstDifferentLine: k, lines: a.length, linesB2: b.length, b1: (a[k] ?? "").slice(0, 900), b2: (b[k] ?? "").slice(0, 900), before: (a[k - 1] ?? "").slice(0, 400), move: s?.profile.move, moves: s?.profile.moves, seabed: s?.profile.seabed, roost: s?.profile.roost, group: Boolean(s?.animal.group), threats: s?.animal.threats?.length ?? 0, answer1: b1.memo.get(id), answer2: b2.memo.get(id)};
});
const out = {hashB1: b1.fp.hash.slice(0, 16), hashB2: b2.fp.hash.slice(0, 16), hashB3: b3.fp.hash.slice(0, 16), run1HashB: "dca06471bc0723e1", changedB1B2: changed12.length, changedB2B3: changed23.length, answersDiffer12: Array.from(b1.memo).filter(([id, v]) => b2.memo.get(id) !== v).length, outDiffers12: diff(b1.out, b2.out) + diff(b2.out, b1.out), firstDiffs, ms: Math.round(performance.now() - t0)};
console.log(JSON.stringify(out, null, 1));
writeFileSync(path.join(outDir, `b2diff-${step}.json`), JSON.stringify(out, null, 1));
