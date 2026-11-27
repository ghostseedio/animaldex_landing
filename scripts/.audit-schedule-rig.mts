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
const tripForEntry = (e: Entry, epoch: number): {trip: Trip; ms: number; fresh: boolean} => {
    const own = e.sched!;
    let trip = own.trip;
    if (trip && epoch >= trip.start && epoch < trip.end) return {trip, ms: 0, fresh: false};
    const started = performance.now();
    const activity = e.animal.activity;
    const profile = own.profile;
    const animal = own.animal;
    const rhythm = {activity: activity ?? profile.activity, awake: (t: number) => awakeAt(profile, activity, hours(t), arkSleepOf(animal as never))};
    const island = e.town;
    const who = island ? feedingAnimal(animal, epoch, rhythm) : animal;
    let previous = trip;
    if (island) {
        const before = feedingAnimal(animal, epoch - SLOT_SECONDS, rhythm);
        const held = previous && epoch - SLOT_SECONDS >= previous.start && epoch - SLOT_SECONDS < previous.end;
        if (before !== who && !held) previous = tripAt(worldOf(animal), profile, before, epoch - SLOT_SECONDS, hours, activity, null);
    }
    own.trip = trip = tripAt(worldOf(animal), profile, who, epoch, hours, activity, previous);
    return {trip, ms: performance.now() - started, fresh: true};
};

const scheduled = onIt.filter((e) => e.sched);
// (`--only <id prefix>`: only that animal stepped by the frames: whatever its trips ask for is worked out with them.)
const onlyPrefix = arg("only", "");
const stepped0 = onlyPrefix ? scheduled.filter((e) => e.animal.id.startsWith(onlyPrefix)) : scheduled;
const stepped = order === "reverse" ? [...stepped0].reverse() : stepped0;
const counts = {entries: entries.length, scheduled: scheduled.length, town: scheduled.filter((e) => e.town).length, wild: scheduled.filter((e) => !e.town).length, zoo: scheduled.filter((e) => towned.get(e.animal.id)?.area === "zoo").length, farm: scheduled.filter((e) => towned.get(e.animal.id)?.area === "farm").length, house: scheduled.filter((e) => towned.get(e.animal.id)?.area === "house").length, threatened: scheduled.filter((e) => e.sched!.animal.threats?.length).length, withMates: scheduled.filter((e) => e.sched!.animal.mates).length, grouped: scheduled.filter((e) => e.sched!.animal.group).length};
console.error(`built: wild world ${(tWild - t0).toFixed(0)} ms, town world ${(tTown - tWild).toFixed(0)} ms, spacing ${tSpace.toFixed(0)} ms, wired ${(tWired - t0).toFixed(0)} ms all told; ${JSON.stringify(counts)}`);

// The frames.
const calls: Array<{id: string; slug: string; town: boolean; area: string; ms: number; frame: number; epoch: number}> = [];
const frames = Math.round(seconds * fps);
const frameMs: number[] = [];
const hashes = new Map<Entry, ReturnType<typeof createHash>>();
const fp = arg("fingerprint", "");
const mark = (e: Entry, line: string) => {
    let h = hashes.get(e);
    if (!h) hashes.set(e, (h = createHash("sha256")));
    h.update(line);
};
const r6 = (v: number) => (Number.isFinite(v) ? v.toFixed(6) : String(v));
const tripLine = (t: Trip) => `${t.slot}|${t.doing}|${r6(t.start)}|${r6(t.end)}|${r6(t.from.x)},${r6(t.from.z)}|${r6(t.to.x)},${r6(t.to.y)},${r6(t.to.z)}|${r6(t.finish.x)},${r6(t.finish.y)},${r6(t.finish.z)},${r6(t.finish.yaw ?? NaN)}|${r6(t.arrive)}|${t.legs.map((l) => `${l.mode}:${r6(l.seconds)}:${l.path ? l.path.map((p: {x: number; z: number}) => `${r6(p.x)},${r6(p.z)}`).join(";") : ""}`).join("/")}|${(t.stay ?? []).map((b: {at: number; beat: string; x: number; z: number; yaw: number}) => `${r6(b.at)}:${b.beat}:${r6(b.x)},${r6(b.z)},${r6(b.yaw)}`).join("/")}\n`;
const wallStart = performance.now();
// (`--rewire <s>`: at that second, what the scene's wireSchedules apply does with the same wiring: every memo forgotten
// and every held trip dropped, `forgetSchedules` + own.trip = null. `--resting`: at the end, the next rotation step's
// restingAtRoost asked for every scheduled entry, as prewarmResting asks them, each timed.)
const rewireAt = argv.includes("--rewire") ? Math.round(Number(arg("rewire", "10")) * fps) : -1;
const rewireCalls: number[] = [];
const overflows: Array<{id: string; slug: string; area: string; ms: number; frame: number}> = [];
for (let f = 0; f < frames; f++) {
    const epoch = from + f / fps;
    if (f === rewireAt) {
        forgetSchedules();
        for (const e of stepped) e.sched!.trip = null;
    }
    const began = performance.now();
    for (const e of stepped) {
        // (A stack overflow inside the schedule, as the live page throws it: timed, counted, and the animal asked again
        // the next frame, as the scene does. The live page's frame stops at the first; the rig steps the rest.)
        let got: ReturnType<typeof tripForEntry>;
        const tried = performance.now();
        try {
            got = tripForEntry(e, epoch);
        } catch (error) {
            if (!(error instanceof RangeError)) throw error;
            overflows.push({id: e.animal.id, slug: e.animal.model_slug, area: towned.get(e.animal.id)?.area ?? "wild", ms: +(performance.now() - tried).toFixed(1), frame: f});
            continue;
        }
        const {trip, ms, fresh} = got;
        if (fresh) {
            if (rewireAt >= 0 && f >= rewireAt && f < rewireAt + fps) rewireCalls.push(ms);
            calls.push({id: e.animal.id, slug: e.animal.model_slug, town: e.town, area: towned.get(e.animal.id)?.area ?? "wild", ms, frame: f, epoch});
            if (fp) mark(e, tripLine(trip));
        }
        if (fp && f % (2 * fps) === 0) {
            const p = poseOnTrip(worldOf(e.sched!.animal), trip, epoch);
            mark(e, `pose ${r6(epoch)} ${r6(p.x)},${r6(p.y)},${r6(p.z)},${r6(p.yaw)},${p.moving ? 1 : 0},${p.aloft ? 1 : 0}\n`);
        }
    }
    frameMs.push(performance.now() - began);
}
const wallMs = performance.now() - wallStart;
let restingReport: unknown = null;
if (argv.includes("--resting")) {
    const {restingAtRoost} = sched as unknown as {restingAtRoost: (w: unknown, p: unknown, a: unknown, t: number, h: unknown, act?: unknown) => {resting: boolean}};
    const step = Math.floor((from + seconds) / 300) + 1;
    const asks: number[] = [];
    for (const e of stepped) {
        const t = performance.now();
        restingAtRoost(worldOf(e.sched!.animal), e.sched!.profile, e.sched!.animal, step * 300, hours, e.animal.activity);
        asks.push(performance.now() - t);
    }
    const sum0 = asks.reduce((a, b) => a + b, 0);
    const srt = [...asks].sort((a, b) => a - b);
    restingReport = {asks: asks.length, ms: Math.round(sum0), p50: +srt[Math.floor(srt.length * 0.5)].toFixed(3), p95: +srt[Math.floor(srt.length * 0.95)].toFixed(2), worst: +srt[srt.length - 1].toFixed(1), aheadS: Math.round(step * 300 - (from + seconds))};
}
const rewireReport = rewireAt >= 0 ? (() => {
    const srt = [...rewireCalls].sort((a, b) => a - b);
    return {at: rewireAt / fps, calls: rewireCalls.length, ms: Math.round(rewireCalls.reduce((a, b) => a + b, 0)), p50: +(srt[Math.floor(srt.length * 0.5)] ?? 0).toFixed(3), p95: +(srt[Math.floor(srt.length * 0.95)] ?? 0).toFixed(2), worst: +(srt[srt.length - 1] ?? 0).toFixed(1)};
})() : null;
const sorted = [...calls].sort((a, b) => b.ms - a.ms);
const pct = (list: number[], p: number) => {
    if (!list.length) return 0;
    const s = [...list].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const firstSecond = calls.filter((c) => c.frame < fps);
const later = calls.filter((c) => c.frame >= fps && !(rewireAt >= 0 && c.frame >= rewireAt && c.frame < rewireAt + fps));
const sum = (list: Array<{ms: number}>) => list.reduce((n, c) => n + c.ms, 0);
const byArea = new Map<string, {n: number; ms: number; worst: number}>();
for (const c of calls) {
    const k = c.area;
    const s = byArea.get(k) ?? {n: 0, ms: 0, worst: 0};
    s.n++;
    s.ms += c.ms;
    s.worst = Math.max(s.worst, c.ms);
    byArea.set(k, s);
}
const summary = {
    args: {roster: rosterMode, scope, threats: threatsOn, from, seconds, fps, order, plans: plansDir !== "none"},
    counts,
    build: {wildWorldMs: Math.round(tWild - t0), townWorldMs: Math.round(tTown - tWild), spacingMs: Math.round(tSpace)},
    wallMs: Math.round(wallMs),
    calls: calls.length,
    allMs: Math.round(sum(calls)),
    firstFrameMs: Math.round(frameMs[0]),
    firstSecond: {calls: firstSecond.length, ms: Math.round(sum(firstSecond))},
    rewire: rewireReport,
    overflows: overflows.length ? {count: overflows.length, ms: Math.round(overflows.reduce((a, o) => a + o.ms, 0)), animals: Array.from(new Set(overflows.map((o) => `${o.slug}#${o.id}@${o.area}`))), perCallMs: overflows.slice(0, 12).map((o) => o.ms), framesWithOne: new Set(overflows.map((o) => o.frame)).size} : null,
    resting: restingReport,
    after: {calls: later.length, ms: Math.round(sum(later)), perFrameMs: +(sum(later) / Math.max(frames - fps, 1)).toFixed(3), p50: +pct(later.map((c) => c.ms), 0.5).toFixed(3), p95: +pct(later.map((c) => c.ms), 0.95).toFixed(2), p99: +pct(later.map((c) => c.ms), 0.99).toFixed(2), worst: +(later.length ? Math.max(...later.map((c) => c.ms)) : 0).toFixed(1)},
    cold: {p50: +pct(firstSecond.map((c) => c.ms), 0.5).toFixed(3), p95: +pct(firstSecond.map((c) => c.ms), 0.95).toFixed(2), worst: +(firstSecond.length ? Math.max(...firstSecond.map((c) => c.ms)) : 0).toFixed(1)},
    framesOver: {ms16: frameMs.filter((m) => m > 16).length, ms50: frameMs.filter((m) => m > 50).length, ms200: frameMs.filter((m) => m > 200).length},
    worstCalls: sorted.slice(0, 15).map((c) => ({slug: c.slug, id: c.id.slice(0, 8), area: c.area, ms: +c.ms.toFixed(1), frame: c.frame})),
    byArea: Object.fromEntries(Array.from(byArea, ([k, s]) => [k, {n: s.n, ms: Math.round(s.ms), worst: +s.worst.toFixed(1)}]))
};
console.log(JSON.stringify(summary, null, 1));
const out = arg("json", "");
if (out) writeFileSync(out, JSON.stringify({summary, calls}, null, 0));
if (fp) {
    const lines = scheduled.map((e) => `${e.animal.id} ${hashes.get(e)?.digest("hex") ?? "-"}`).sort();
    const all = createHash("sha256").update(lines.join("\n")).digest("hex");
    writeFileSync(fp, `${all}\n${lines.join("\n")}\n`);
    console.error(`fingerprint ${all} (${lines.length} entries) -> ${fp}`);
}
// (The instrumented tree's counters, when it has them.)
const report = (globalThis as {__auditReport?: () => unknown}).__auditReport;
const navReport = Object.fromEntries(Object.entries(navCounts).map(([k, s]) => {
    let distinct = 0;
    let repeats = 0;
    if (s.keys) {
        distinct = s.keys.size;
        repeats = s.calls - distinct;
    }
    return [k, {calls: s.calls, ms: Math.round(s.ms), ...(s.keys ? {distinct, repeatShare: s.calls ? +(repeats / s.calls).toFixed(4) : 0} : {})}];
}));
if (Object.keys(navReport).length) console.log(JSON.stringify({nav: navReport}, null, 1));
if (report) {
    const r = report();
    const file = arg("counters", "");
    if (file) writeFileSync(file, JSON.stringify(r, null, 1));
    else console.log(JSON.stringify(r, null, 1));
}
