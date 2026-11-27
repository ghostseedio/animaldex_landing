/**
 * PERF-WEB audit (schedule area), 2026-11-27: the behaviour schedule's cost as the scene asks it, headless, on a real
 * snapshot. Untracked helper; not part of the tree.
 *
 * The Ark is laid out and wired as `index.ts` lays it out and wires it (both islands, `setSnapshot` -> `makeSched` ->
 * `wireSchedules`: kept town leaders, groups, spacing, threats from the entries on both islands, recipes), then each
 * entry's trip is asked frame by frame the way `stepSchedule` -> `sharedBase` -> `schedulePose` -> `tripFor` asks it
 * (the holder's trip kept for its slot, the zoo's feeding variant, the previous trip handed on), and every top-level
 * `tripAt` call the scene would make is timed one by one.
 *
 *   npx tsx scripts/.audit-schedule-rig.mts --snapshot <voyage.json> [--roster all|high|medium|low] [--scope all|town|wild]
 *        [--from <epoch s>] [--seconds 240] [--fps 30] [--threats on|off] [--order scene|reverse] [--json <out.json>]
 *        [--fingerprint <out.txt>] [--plans <models dir>|none]
 *
 * `--roster`: who the scene draws one by one (its entries): every scheduled animal, or the tier's live budget
 * (`arkRepresentatives` + `arkWithinCapacity` + `arkOutside`, the rotation at `--from`, no resting answers yet, as at the
 * first layout; the town's held animals pinned on high and medium as `setSnapshot` pins them).
 * `--fingerprint`: a hash line per entry over all its trips asked (slot, doing, from, finish, legs) and its pose every
 * 2 s: the identity proof before and after a change.
 */
import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {setArkWorld} from "@/ark-scene/world";

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 && argv[at + 1] !== undefined && !argv[at + 1].startsWith("--") ? argv[at + 1] : fallback;
};
setArkWorld(arg("world", "v2") as "v1" | "v2");

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
// (`--stop-on-cycle`: the instrumented tree throws at the first key asked for again while it is worked out.)
if (process.argv.includes("--stop-on-cycle")) {
    const audit = (globalThis as {__auditSchedule?: {stopOnCycle?: boolean}}).__auditSchedule;
    if (audit) audit.stopOnCycle = true;
}
const {forgetSchedules, groupSpread, rangeReach, scheduleWorld, spaceHomes, tripAt, poseOnTrip, wireThreats, withLazyRoost, SLOT_SECONDS, slotOffset, awakeAt} = sched;
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
const {ARK_LIVE_BUDGET, arkOutside, arkWithinCapacity, arkZoneCapacity} = await import("@/ark-scene/live-budget");

type ArkAnimal = import("@/ark-scene/types").ArkAnimal;
type ScheduleAnimal = import("@/ark-scene/behaviour-schedule").ScheduleAnimal;
type Trip = import("@/ark-scene/behaviour-schedule").Trip;
type Profile = import("@/ark-scene/behaviour-profile").ArkBehaviourProfile;
type ScheduleWorld = import("@/ark-scene/behaviour-schedule").ScheduleWorld;

// (`--navcount`: the walk grid's and the colliders' questions counted, with how many repeat their exact arguments.)
const navCounts: Record<string, {calls: number; ms: number; keys: Map<string, number> | null}> = {};
if (argv.includes("--navcount")) {
    const {NavGrid} = await import("@/ark-scene/behaviour-nav");
    const {ColliderSet} = await import("@/ark-scene/collide/colliders");
    const wrap = (proto: Record<string, unknown>, name: string, label: string, keyed: boolean) => {
        const fn = proto[name] as (...a: unknown[]) => unknown;
        const slot = (navCounts[label] = {calls: 0, ms: 0, keys: keyed ? new Map() : null});
        let depth = 0;
        proto[name] = function (this: unknown, ...a: unknown[]) {
            slot.calls++;
            if (slot.keys) {
                const k = a.map((v) => (v && typeof v === "object" ? `${(v as {x?: number}).x},${(v as {z?: number}).z}` : typeof v === "function" ? "fn" : String(v))).join("|");
                slot.keys.set(k, (slot.keys.get(k) ?? 0) + 1);
            }
            if (depth) return fn.apply(this, a);
            depth++;
            const t = performance.now();
            try {
                return fn.apply(this, a);
            } finally {
                slot.ms += performance.now() - t;
                depth--;
            }
        };
    };
    const nav = NavGrid.prototype as unknown as Record<string, unknown>;
    for (const n of ["fits", "attachable", "path", "region", "nearest", "runClear", "walkable", "localSlope", "clearanceAt"]) wrap(nav, n, `nav.${n}`, ["fits", "attachable", "path", "nearest", "runClear", "localSlope"].includes(n));
    const cs = ColliderSet.prototype as unknown as Record<string, unknown>;
    for (const n of ["sweepAll", "distance", "near", "clearance"]) wrap(cs, n, `colliders.${n}`, false);
}

const raw = JSON.parse(readFileSync(arg("snapshot", "/Users/lennybeadle/AnimalDex-work/ark-perf-web/real/voyage.json"), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw)!;
const rosterMode = arg("roster", "all");
const scope = arg("scope", "all");
const threatsOn = arg("threats", "on") === "on";
const from = Number(arg("from", String(Math.floor(Date.UTC(2026, 10, 27, 3, 0, 0) / 1000))));
const seconds = Number(arg("seconds", "240"));
const fps = Number(arg("fps", "30"));
const order = arg("order", "scene");
const plansDir = arg("plans", path.join(process.env.HOME ?? "", "animaldex-talking-models"));
const planCache = new Map<string, string | undefined>();
const planOf = (slug: string): string | undefined => {
    if (plansDir === "none") return undefined;
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
// (index.ts setSnapshot: the wild island's plots, then its places; `world.ts` v2 has no hamlet.)
const plots = hamletPlotsFor(wildAnimals);
setAttachHomePlots(plots);
setBehaviourHomePlots(plots);
setRecipeColliders({segmentClear: collideSegmentClear, blocked: (x, z, r) => collideBlocked(x, z, r)});
setRecordedSexes(snapshot.animals);
const wildPlaces = placeAnimals(wildAnimals);
const wildWorld = scheduleWorld(worldSampler());
const tWild = performance.now();
// The town (islands/scene.ts place, colliders, sampler).
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
const tTown = performance.now();
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
const townIds = new Set(townAnimals.map((a) => a.id));
const hours = (epoch: number) => islandHours(epoch * 1000, 0);

type Entry = {animal: ArkAnimal; place: {x: number; z: number; ground: number; leader?: string | null; rank?: number}; town: boolean; length: number; sched: {animal: ScheduleAnimal; profile: Profile; trip: Trip | null} | null; leader: Entry | null};
const allPlaces = new Map<string, Entry["place"]>();
wildPlaces.forEach((p, id) => allPlaces.set(id, p));
placed.places.forEach((p, id) => allPlaces.set(id, {...p, x: p.x + origin.x, z: p.z + origin.z}));

// The roster (index.ts setSnapshot: representatives, then the tier's budget; the town's held animals pinned on high/medium).
let roster: ArkAnimal[];
// (`--drop <slug,slug>`: those kinds left out of the roster, as a rotation that sits them out leaves them: who is a top
// predator follows the kinds wired.)
const dropped = new Set(arg("drop", "").split(",").filter(Boolean));
const scoped = snapshot.animals.filter((a) => !dropped.has(a.model_slug) && (scope === "all" ? true : scope === "town" ? townIds.has(a.id) : !townIds.has(a.id)));
if (rosterMode === "all") roster = scoped;
else {
    const tier = rosterMode as "high" | "medium" | "low";
    const held = (a: ArkAnimal) => {
        const info = towned.get(a.id);
        return Boolean(info && (info.tank || info.display || info.where === "indoor" || info.where === "window"));
    };
    const pins = new Set<string>(tier !== "low" ? scoped.filter((a) => townIds.has(a.id) && held(a)).map((a) => a.id) : []);
    const reps = arkRepresentatives(scoped, {pinned: pins, live: ARK_HERD_LIVE});
    let candidates = scoped.filter((a) => reps.live.has(a.id)).map((a) => ({id: a.id, group: a.species_profile_id || `slug:${a.model_slug}`, zone: townIds.has(a.id) ? "town" : a.zone}));
    const capacity = scoped.length >= 1000 ? arkZoneCapacity() : null;
    if (capacity) candidates = arkWithinCapacity(candidates, capacity, from, pins);
    const outside = arkOutside(candidates, ARK_LIVE_BUDGET[tier], from, pins);
    roster = scoped.filter((a) => reps.live.has(a.id) && outside.has(a.id));
}

const entries: Entry[] = [];
const entryById = new Map<string, Entry>();
for (const animal of roster) {
    const place = allPlaces.get(animal.id);
    if (!place) continue;
    const town = townIds.has(animal.id);
    const plan = planOf(animal.model_slug);
    const body = arkBody(animal, plan);
    entries.push({animal, place, town, length: body.display * sexLook(animal.id, animal.model_slug).scale, sched: null, leader: null});
}
for (const e of entries) entryById.set(e.animal.id, e);
// makeSched (index.ts): on the schedule unless micro/underground/held off the water; a town animal only `scheduled` ones.
const makeSched = (animal: ArkAnimal, place: Entry["place"], length: number): Entry["sched"] => {
    if (!onSchedule(place as never, animal.model_slug) || !onBehaviourSchedule(animal.model_slug)) return null;
    const inTown = townIds.has(animal.id);
    if (inTown && !townScheduled(animal.id)) return null;
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
for (const e of entries) e.sched = makeSched(e.animal, e.place, arkBody(e.animal, planOf(e.animal.model_slug)).display);
for (const e of entries) e.leader = e.place.leader && e.place.leader !== e.animal.id ? entryById.get(e.place.leader) ?? null : null;
const worldOf = (animal: {id: string}): ScheduleWorld => (townIds.has(animal.id) ? townWorld : wildWorld);

// wireSchedules (index.ts 2242).
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const onIt = entries.filter((e) => e.sched);
const sizes = new Map<Entry, number>();
for (const e of onIt) if (e.leader?.sched) sizes.set(e.leader, (sizes.get(e.leader) ?? 1) + 1);
const keptTown = (e: Entry) => e.town && kept(e.animal.id);
const snapshotById = new Map(snapshot.animals.map((a) => [a.id, a]));
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
const standIns = new Map<string, Entry["sched"]>();
const keptLeader = (e: Entry) => {
    const id = e.place.leader;
    if (!id || id === e.animal.id || !keptTown(e)) return null;
    const out = entryById.get(id);
    if (out?.sched) return {animal: out.sched.animal, profile: out.sched.profile, activity: out.animal.activity};
    const animal = snapshotById.get(id);
    const place = allPlaces.get(id);
    if (!animal || !place) return null;
    let s = standIns.get(id);
    if (s === undefined) standIns.set(id, (s = makeSched(animal, place, arkBody(animal, planOf(animal.model_slug)).display)));
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
const tSpace0 = performance.now();
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
const tSpace = performance.now() - tSpace0;
for (const e of onIt) {
    const own = e.sched!;
    own.animal.group = groups.get(e) ?? null;
    own.animal.led = ledOf.get(own.animal) ?? 0;
    const age = typeof snapshot.ark_day === "number" && typeof e.animal.born_ark_day === "number" ? snapshot.ark_day - e.animal.born_ark_day : null;
    own.animal.young = e.animal.origin === "born" && age !== null && age < 90;
}
for (const e of onIt) {
    const moved = spaced.get(e.animal.id);
    if (!moved) continue;
    const own = e.sched!;
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
// (`--pairs`: zoo enclosures where one member eats another placed before it (its mate's threat can be itself, a slot
// back each time), and which kinds aboard eat that hunter: while none of those is wired, the hunter is a top predator.)
if (argv.includes("--pairs")) {
    const snapshotById0 = new Map(snapshot.animals.map((a) => [a.id, a]));
    const allSlugs = Array.from(new Set(snapshot.animals.map((a) => a.model_slug)));
    const byEnclosure = new Map<string, Array<{id: string; slug: string}>>();
    towned.forEach((o: {area?: string; enclosure?: {id: string}; enclosureMargin?: number; still?: boolean}, id: string) => {
        if (o.area !== "zoo" || !o.enclosure || o.enclosureMargin === undefined || o.still) return;
        const slug = snapshotById0.get(id)?.model_slug;
        if (!slug) return;
        let list = byEnclosure.get(o.enclosure.id);
        if (!list) byEnclosure.set(o.enclosure.id, (list = []));
        list.push({id, slug});
    });
    const wiredSlugs = new Set(onIt.map((e) => e.animal.model_slug));
    const rows: unknown[] = [];
    byEnclosure.forEach((members, enc) => {
        const kinds = Array.from(new Set(members.map((m) => m.slug)));
        for (const hunter of kinds) for (const prey of kinds) {
            if (hunter === prey || !eats(hunter, prey)) continue;
            const eaters = allSlugs.filter((q) => q !== hunter && eats(q, hunter));
            rows.push({enclosure: enc, hunter, prey, members: members.length, kinds, eatersAboard: eaters, eatersWired: eaters.filter((q) => wiredSlugs.has(q)), hunterTopNow: !eaters.some((q) => wiredSlugs.has(q))});
        }
    });
    console.log(JSON.stringify({pairs: rows}, null, 1));
}
if (threatsOn) wireThreats(onIt.map((e) => ({slug: e.animal.model_slug, animal: e.sched!.animal, profile: e.sched!.profile, activity: e.animal.activity})), eats);
// (`--threat-census`: each prey's threats on its own island and on the other one, with how near the nearest such hunter's
// home is: threatAt works a hunter's trip out in the prey's own world, so one across the strait is a second trip.)
if (argv.includes("--threat-census")) {
    const islandOf = new Map(onIt.map((e) => [e.sched!.animal, e.town]));
    let same = 0;
    let cross = 0;
    let preyCross = 0;
    let nearestCross = Infinity;
    const crossHunters = new Set<string>();
    for (const e of onIt) {
        const list = e.sched!.animal.threats ?? [];
        let any = false;
        for (const t of list) {
            if (islandOf.get(t.animal) === e.town) same++;
            else {
                cross++;
                any = true;
                crossHunters.add(t.profile.slug);
                nearestCross = Math.min(nearestCross, Math.hypot(t.animal.home.x - e.sched!.animal.home.x, t.animal.home.z - e.sched!.animal.home.z));
            }
        }
        if (any) preyCross++;
    }
    console.log(JSON.stringify({threatCensus: {prey: onIt.filter((e) => e.sched!.animal.threats?.length).length, sameIsland: same, crossIsland: cross, preyWithCross: preyCross, nearestCrossHomeM: Math.round(nearestCross), crossHunterKinds: crossHunters.size}}));
}
forgetSchedules();
wireRecipes(onIt.map((e) => ({animal: e.sched!.animal, profile: e.sched!.profile, slug: e.animal.model_slug, activity: e.animal.activity})));
const tWired = performance.now();

// The zoo's feeding variant (islands/scene.ts feedingAnimal), one per animal.
const feeding = new WeakMap<ScheduleAnimal, ScheduleAnimal>();
const clockAt = (ms: number) => townClockAt(ms, 0);
const feedingAnimal = (animal: ScheduleAnimal, epoch: number, rhythm: {activity: string | null | undefined; awake: (t: number) => boolean}): ScheduleAnimal => {
    const enclosure = towned.get(animal.id)?.enclosure;
    if (!enclosure) return animal;
    const offset = slotOffset(animal.id);
    const start = Math.floor((epoch + offset) / SLOT_SECONDS) * SLOT_SECONDS - offset;
    const own = zooRhythm(rhythm.activity as never);
    if (!residentFeeding(enclosure.type, own, clockAt(start * 1000), rhythm.awake(start))) return animal;
    let variant = feeding.get(animal);
    if (!variant) {
        const station = feedingHome(enclosure, townHeight);
        const lead = (base: ScheduleAnimal) => (towned.get(base.id)?.enclosure?.id === enclosure.id ? feeding.get(base) ?? base : base);
        variant = Object.create(animal, {
            home: {value: {x: station.x + origin.x, y: station.y, z: station.z + origin.z}, enumerable: true},
            range: {value: station.range * 1.5, enumerable: true},
            group: {get: () => (animal.group ? {...animal.group, leader: lead(animal.group.leader)} : animal.group), enumerable: true}
        }) as ScheduleAnimal;
        feeding.set(animal, variant);
    }
    return variant;
};
// index.ts tripFor: the holder's trip for its slot; else the feeding variant's, the previous handed on.

// ============================================================================================================
// FRAME-5 identity verifier (PERF-WEB audit, 2026-11-27; untracked helper). The traffic catch-up's car run, worked out
// several ways on the real snapshot, compared tick by tick to the bit (every car's active, s, speed, off, lag, served,
// dwell, braking, x, z, dx, dz and the sim's blockedSeconds, as exact doubles):
//   U2  the frame path at the page's open (its current trips first), then the whole catch-up at once, the traffic on
//       its own "past" holder per entry (fix 3);
//   R   fix 2 + fix 3: a transactional tick (every car field and the sim's own state saved at the tick's start and put
//       back on an abort), the query aborting once the frame's allowance of cold trips is spent (before any pose it
//       does not have), the frame path stepped between frames on its own holders, the pose cache cleared each frame;
//   Rp  as R, but an abort answered with null as the finding specifies it (freeAhead's `soon ... ?? []` turns a null on
//       the second ask into "nothing coming");
//   T1/T2  today: one shared holder per entry for the frame path and the traffic, the catch-up in chunks of 4k ticks
//       (two seeds), the frame path stepped between chunks (the holder thrash);
//   T3  today, the town's schedules wired a few frames after its world is in (the spacing is sliced): until then the
//       traffic sees the animals at their places (index.ts trafficAnimals `entry.sched?.wired ? ... : entry.place`).
// Each run has its own schedule memo (its own clock function object: the memo is keyed by world, clock and animal).
// Then the census: every trip the traffic used in U2 worked out again fresh (no previous trip, own memo, slots in
// reverse) and compared, the order-freedom the finding's identity claim rests on.
// Not emulated (said in the report): liveliness (young at heel, shelter), the cat walls, encounter hunting, model loads.
// ============================================================================================================
{
    const {TrafficSim, townTraffic, TRAFFIC_WINDOW} = await import("@/ark-scene/islands/town/render/vehicles");
    const {townPlan} = await import("@/ark-scene/islands/town/plan");
    const {bodyShape} = await import("@/ark-scene/collide/bodies");
    const {islandHours: hoursOf} = await import("@/lib/ark-clock");
    type Holder = {trip: Trip | null};
    type Clock = (epoch: number) => number;
    const clockFn = (): Clock => (epoch: number) => hoursOf(epoch * 1000, 0);
    const winFrom = Number(arg("win", String(Math.floor(Date.UTC(2026, 10, 27, 10, 0, 0) / 1000))));
    const window0 = Math.floor(winFrom / TRAFFIC_WINDOW) * TRAFFIC_WINDOW;
    const openInto = Number(arg("open", "590"));
    const tOpen = window0 + openInto;
    const seed0 = Number(arg("seed", "7"));
    const maxCold = Number(arg("cold", "3"));
    const only = new Set(arg("runs", "U2,R,Rp,T1,T2,T3").split(","));
    const mulberry = (a: number) => () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const ex = (v: unknown) => String(v);
    const exactTrip = (t: Trip) => `${t.slot}|${t.doing}|${ex(t.start)}|${ex(t.end)}|${ex(t.from.x)},${ex(t.from.y)},${ex(t.from.z)}|${ex(t.to.x)},${ex(t.to.y)},${ex(t.to.z)}|${ex(t.finish.x)},${ex(t.finish.y)},${ex(t.finish.z)},${ex(t.finish.yaw)}|${ex(t.arrive)}|${t.mode}|${t.legs.map((l) => `${l.mode}:${ex(l.seconds)}:${l.path ? l.path.map((p: {x: number; z: number}) => `${ex(p.x)},${ex(p.z)}`).join(";") : ""}`).join("/")}|${(t.stay ?? []).map((b: {at: number; beat: string; x: number; z: number; yaw: number}) => `${ex(b.at)}:${b.beat}:${ex(b.x)},${ex(b.z)},${ex(b.yaw)}`).join("/")}`;
    const townEntries = entries.filter((e) => e.town);
    const townSched = townEntries.filter((e) => e.sched);
    const rangeOfTown = (id: string) => {
        const info = towned.get(id);
        return info ? Math.max(info.range, 0.6) * 1.5 : null;
    };
    const cellOf = (x: number, z: number) => (Math.floor(x / 16) + 4096) * 8192 + (Math.floor(z / 16) + 4096);
    const cells = new Map<number, Entry[]>();
    for (const e of townEntries) {
        const k = cellOf(e.place.x, e.place.z);
        const list = cells.get(k);
        if (list) list.push(e);
        else cells.set(k, [e]);
    }
    // index.ts tripFor (2203) with a given holder and clock.
    type Used = Map<Entry, Map<number, Trip>>;
    const makeTripFor = (hoursAt: Clock, used: Used | null) => (e: Entry, holder: Holder, epoch: number): Trip => {
        const own = e.sched!;
        let trip = holder.trip;
        if (!trip || epoch < trip.start || epoch >= trip.end) {
            const activity = e.animal.activity;
            const profile = own.profile;
            const animal = own.animal;
            const rhythm = {activity: activity ?? profile.activity, awake: (t: number) => awakeAt(profile, activity, hoursAt(t), arkSleepOf(animal as never))};
            const who = feedingAnimal(animal, epoch, rhythm);
            let previous = trip;
            const before = feedingAnimal(animal, epoch - SLOT_SECONDS, rhythm);
            const held = previous && epoch - SLOT_SECONDS >= previous.start && epoch - SLOT_SECONDS < previous.end;
            if (before !== who && !held) previous = tripAt(worldOf(animal), profile, before, epoch - SLOT_SECONDS, hoursAt, activity, null);
            holder.trip = trip = tripAt(worldOf(animal), profile, who, epoch, hoursAt, activity, previous);
        }
        if (used) {
            let m = used.get(e);
            if (!m) used.set(e, (m = new Map()));
            m.set(trip.slot, trip);
        }
        return trip;
    };
    const ABORT = Symbol("abort");
    // index.ts trafficAnimals (2494) through islands/scene.ts setTrafficAnimals (town frame in and out; offset 0).
    // `budget`: an allowance of cold trips a frame (`frame()` starts a frame); past it, any pose not in hand aborts.
    const makeQuery = (o: {tripFor: ReturnType<typeof makeTripFor>; holderOf: (e: Entry) => Holder; budget: (() => number) | null; nullOnAbort: boolean; wired: () => boolean}) => {
        const poses = {at: Number.NaN, map: new Map<Entry, {x: number; z: number; r: number; h: number}>()};
        const stats = {calls: 0, poses: 0, cold: 0, aborts: 0, nulls: 0};
        const coldKeys = new Set<string>();
        let cold = 0;
        let allowance = Infinity;
        const query = (x: number, z: number, radius: number, epoch: number) => {
            stats.calls++;
            const wx = x + origin.x;
            const wz = z + origin.z;
            if (poses.at !== epoch) {
                poses.at = epoch;
                poses.map.clear();
            }
            const out: Array<{x: number; z: number; r: number; h: number}> = [];
            const reach = radius + 18;
            const wired = o.wired();
            for (let i = Math.floor((wx - reach) / 16); i <= Math.floor((wx + reach) / 16); i++) {
                for (let j = Math.floor((wz - reach) / 16); j <= Math.floor((wz + reach) / 16); j++) {
                    for (const e of cells.get((i + 4096) * 8192 + (j + 4096)) ?? []) {
                        const range = rangeOfTown(e.animal.id) ?? 12;
                        if (Math.hypot(e.place.x - wx, e.place.z - wz) > radius + range + 3) continue;
                        let known = poses.map.get(e);
                        if (!known) {
                            if (cold >= allowance) {
                                stats.aborts++;
                                if (o.nullOnAbort) {
                                    stats.nulls++;
                                    return null;
                                }
                                throw ABORT;
                            }
                            stats.poses++;
                            let pose: {x: number; z: number};
                            if (e.sched && wired) {
                                const slot = Math.floor((epoch + slotOffset(e.animal.id)) / SLOT_SECONDS);
                                const key = `${e.animal.id}:${slot}`;
                                const trip = o.tripFor(e, o.holderOf(e), epoch);
                                if (!coldKeys.has(key)) {
                                    coldKeys.add(key);
                                    cold++;
                                    stats.cold++;
                                }
                                pose = poseOnTrip(worldOf(e.sched.animal), trip, epoch);
                            } else pose = e.place;
                            const body = bodyShape(e.animal.model_slug, e.length);
                            known = {x: pose.x, z: pose.z, r: body.radius, h: body.height};
                            poses.map.set(e, known);
                        }
                        if (Math.hypot(known.x - wx, known.z - wz) < radius + known.r) out.push(known);
                    }
                }
            }
            return out.map((a) => ({x: a.x - origin.x, z: a.z - origin.z, r: a.r, h: a.h}));
        };
        return {
            query,
            stats,
            frame: (clear: boolean) => {
                cold = 0;
                allowance = o.budget ? o.budget() : Infinity;
                if (clear) {
                    poses.at = Number.NaN;
                    poses.map.clear();
                }
            }
        };
    };
    type SimInternals = {cars: Array<Record<string, unknown>>; at: number; blockedSeconds: number; heldBy: string[]; asked: unknown[]; tick: () => boolean};
    const carKey = (c: Record<string, unknown>) => ["active", "s", "speed", "off", "lag", "served", "dwell", "braking", "x", "z", "dx", "dz"].map((k) => String(c[k])).join(",");
    const save = (sim: SimInternals) => ({cars: sim.cars.map((c) => ({...c})), blocked: sim.blockedSeconds, held: [...sim.heldBy], asked: [...sim.asked]});
    const restore = (sim: SimInternals, b: ReturnType<typeof save>) => {
        sim.cars.forEach((c, i) => Object.assign(c, b.cars[i]));
        sim.blockedSeconds = b.blocked;
        sim.heldBy.length = 0;
        sim.heldBy.push(...b.held);
        sim.asked = b.asked;
    };
    const runSim = (label: string, q: ReturnType<typeof makeQuery>, transactional: boolean, drive: (sim: InstanceType<typeof TrafficSim>, s: SimInternals) => number) => {
        const sim = new TrafficSim(townTraffic(townPlan()), q.query, 0);
        const s = sim as unknown as SimInternals;
        const ticks: string[] = [];
        const tick = s.tick.bind(sim);
        let restores = 0;
        s.tick = () => {
            const backup = transactional ? save(s) : null;
            try {
                const ok = tick();
                if (ok) ticks.push(`${s.at}|${s.cars.map(carKey).join(";")}|${s.blockedSeconds}`);
                else if (backup) {
                    restore(s, backup);
                    restores++;
                }
                return ok;
            } catch (err) {
                if (err === ABORT && backup) {
                    restore(s, backup);
                    restores++;
                    return false;
                }
                throw err;
            }
        };
        const t0 = performance.now();
        const frames = drive(sim, s);
        const ms = performance.now() - t0;
        const hash = createHash("sha256").update(ticks.join("\n")).digest("hex").slice(0, 16);
        console.error(`${label}: ${ticks.length} ticks, ${frames} frames, hash ${hash}, ${ms.toFixed(0)} ms, query ${JSON.stringify(q.stats)}, restores ${restores}, blocked ${s.blockedSeconds}`);
        return {label, ticks, hash, ms, frames, stats: {...q.stats}, restores};
    };
    // The frame path (stepSchedule -> sharedBase -> schedulePose -> tripFor): every scheduled town entry at the frame's now.
    const framePath = (tf: ReturnType<typeof makeTripFor>, holderOf: (e: Entry) => Holder, now: number) => {
        for (const e of townSched) poseOnTrip(worldOf(e.sched!.animal), tf(e, holderOf(e), now), now);
    };
    const holders = () => {
        const m = new Map<Entry, Holder>();
        return (e: Entry) => {
            let h = m.get(e);
            if (!h) m.set(e, (h = {trip: null}));
            return h;
        };
    };
    console.error(`window ${window0} (${new Date(window0 * 1000).toISOString()}), open at +${openInto} s, town entries ${townEntries.length} (scheduled ${townSched.length}), cold allowance 1-${maxCold}`);
    const results: Array<ReturnType<typeof runSim>> = [];
    // U2: the frame path once at the open, then the catch-up whole on past holders.
    const usedU2: Used = new Map();
    if (only.has("U2")) {
        const h = clockFn();
        const tf = makeTripFor(h, usedU2);
        const frameHolder = holders();
        const pastHolder = holders();
        const q = makeQuery({tripFor: tf, holderOf: pastHolder, budget: null, nullOnAbort: false, wired: () => true});
        results.push(runSim("U2 whole, past holder", q, false, (sim) => {
            framePath(tf, frameHolder, tOpen);
            q.frame(false);
            if (!sim.at_(tOpen)) throw new Error("U2 returned null");
            return 1;
        }));
    }
    // R / Rp: transactional retries, a cold-trip allowance a frame, frame path between frames on its own holders.
    const retryRun = (label: string, nullOnAbort: boolean, seed: number) => {
        const h = clockFn();
        const tf = makeTripFor(h, null);
        const frameHolder = holders();
        const pastHolder = holders();
        const rng = mulberry(seed);
        const q = makeQuery({tripFor: tf, holderOf: pastHolder, budget: () => 1 + Math.floor(rng() * maxCold), nullOnAbort, wired: () => true});
        return runSim(label, q, true, (sim) => {
            framePath(tf, frameHolder, tOpen);
            for (let f = 1; f < 400000; f++) {
                q.frame(true);
                if (sim.at_(tOpen)) return f;
                framePath(tf, frameHolder, tOpen + f / 60);
            }
            throw new Error(`${label} never caught up`);
        });
    };
    if (only.has("R")) results.push(retryRun("R  retry+restore, abort throws (soon null propagated)", false, seed0));
    if (only.has("Rp")) results.push(retryRun("Rp retry+restore, abort returns null (soon ?? [])", true, seed0 + 1));
    // T: today's shape: shared holders, chunks of 4k ticks, the frame path after each chunk (town section, then animals).
    const todayRun = (label: string, seed: number, unwiredChunks: number) => {
        const h = clockFn();
        const tf = makeTripFor(h, null);
        const shared = holders();
        const rng = mulberry(seed);
        let f = 0;
        const q = makeQuery({tripFor: tf, holderOf: shared, budget: null, nullOnAbort: false, wired: () => f > unwiredChunks});
        return runSim(label, q, false, (sim, s) => {
            for (f = 1; f < 400000; f++) {
                q.frame(false);
                const chunk = 4 * (1 + Math.floor(rng() * 10));
                const at = s.at === 0 ? window0 : s.at;
                const target = Math.min(at + chunk * 0.25, tOpen);
                const cars = sim.at_(target);
                if (cars && target >= tOpen) return f;
                if (f > unwiredChunks) framePath(tf, shared, tOpen + f / 60);
            }
            throw new Error(`${label} never caught up`);
        });
    };
    if (only.has("T1")) results.push(todayRun("T1 today: shared holder, chunks", seed0 + 2, 0));
    if (only.has("T2")) results.push(todayRun("T2 today: shared holder, chunks", seed0 + 3, 0));
    if (only.has("T3")) results.push(todayRun("T3 today: wired after 5 chunks", seed0 + 2, 5));
    // Tick-by-tick comparison against the first run.
    const base = results[0];
    const firstDiff = (a: string[], b: string[]) => {
        const n = Math.min(a.length, b.length);
        for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
        return a.length === b.length ? -1 : n;
    };
    const comparisons = results.slice(1).map((r) => {
        const i = firstDiff(base.ticks, r.ticks);
        let detail: unknown = null;
        let differing = 0;
        for (let k = 0; k < Math.min(base.ticks.length, r.ticks.length); k++) if (base.ticks[k] !== r.ticks[k]) differing++;
        if (i >= 0 && i < Math.min(base.ticks.length, r.ticks.length)) {
            const a = base.ticks[i].split("|");
            const b = r.ticks[i].split("|");
            const ca = a[1].split(";");
            const cb = b[1].split(";");
            detail = {tick: i, at: a[0], cars: ca.map((c, k) => (c === cb[k] ? null : {car: k, base: c, run: cb[k]})).filter(Boolean)};
        }
        const lastA = base.ticks[base.ticks.length - 1]?.split("|")[1].split(";") ?? [];
        const lastB = r.ticks[r.ticks.length - 1]?.split("|")[1].split(";") ?? [];
        const endGap = lastA.map((c, k) => {
            const pa = c.split(",");
            const pb = (lastB[k] ?? "").split(",");
            return +Math.hypot(Number(pa[8]) - Number(pb[8]), Number(pa[9]) - Number(pb[9])).toFixed(3);
        });
        return {run: r.label, ticks: r.ticks.length, identical: i < 0, firstDiffTick: i, ticksDiffering: differing, endPositionGapM: endGap, detail};
    });
    // The census: every trip U2's traffic used, fresh (no previous, own memo, slots in reverse), compared exactly.
    const hF = clockFn();
    const tfFresh = makeTripFor(hF, null);
    let tripsChecked = 0;
    let tripsDiffer = 0;
    const differ: Array<Record<string, unknown>> = [];
    const differIds = new Set<string>();
    usedU2.forEach((bySlot, e) => {
        const slots = Array.from(bySlot.keys()).sort((a, b) => b - a);
        for (const slot of slots) {
            const chained = bySlot.get(slot)!;
            const fresh = tfFresh(e, {trip: null}, chained.start + 1);
            tripsChecked++;
            if (exactTrip(fresh) !== exactTrip(chained)) {
                tripsDiffer++;
                differIds.add(e.animal.id);
                const names = ["slot", "doing", "start", "end", "from", "to", "finish", "arrive", "mode", "legs", "stay"];
                const sa = exactTrip(chained).split("|");
                const sb = exactTrip(fresh).split("|");
                const fields = names.filter((_, k) => sa[k] !== sb[k]).map((n) => {
                    const k = names.indexOf(n);
                    return {field: n, chained: sa[k].slice(0, 160), fresh: sb[k].slice(0, 160)};
                });
                const prevSlot = bySlot.get(slot - 1);
                if (differ.length < 30) differ.push({slug: e.animal.model_slug, id: e.animal.id.slice(0, 8), slot, area: towned.get(e.animal.id)?.area ?? "?", doing: `${chained.doing}/${fresh.doing}`, fromGapM: +Math.hypot(fresh.from.x - chained.from.x, fresh.from.z - chained.from.z).toFixed(4), finishGapM: +Math.hypot(fresh.finish.x - chained.finish.x, fresh.finish.z - chained.finish.z).toFixed(4), toGapM: +Math.hypot(fresh.to.x - chained.to.x, fresh.to.z - chained.to.z).toFixed(4), prevInWindow: Boolean(prevSlot), prevDoing: prevSlot?.doing ?? null, prevHasGoal: prevSlot ? exactTrip(prevSlot).split("|")[5] !== exactTrip(prevSlot).split("|")[4] : null, fields});
            }
        }
    });
    const out = {window: window0, iso: new Date(window0 * 1000).toISOString(), openInto, coldAllowance: `1-${maxCold}`, seed: seed0, townEntries: townEntries.length, townScheduled: townSched.length, entriesAskedByTraffic: usedU2.size, runs: results.map((r) => ({label: r.label, ticks: r.ticks.length, frames: r.frames, hash: r.hash, ms: Math.round(r.ms), query: r.stats, restores: r.restores})), comparisons, census: {tripsChecked, tripsDiffer, animalsDiffering: differIds.size, examples: differ}};
    console.log(JSON.stringify(out, null, 1));
    const file = arg("out", "");
    if (file) writeFileSync(file, JSON.stringify(out, null, 1));
}
