/**
 * PERF-WEB audit (frameloop verifier, FRAME-1), 2026-11-27: the first desktop tier drop's relayout, headless, on the
 * real snapshot. Untracked helper; not part of the tree. Setup copied from `.audit-schedule-rig.mts` (schedule area).
 *
 * Lays the Ark out as the first high-tier layout does (representatives, rule E wired as index.ts wires it, budget 1200,
 * the town's held animals pinned; no resting answers yet: the behaviour world was not built), wires those entries, then
 * asks what the drop to medium asks (`runtime.outside` at 400 with `restingFor`'s answers at the step's instant), each
 * ask timed; then the lite low layout (200, ARK_HERD_LIVE_LITE) with those answers known; then the same answers asked
 * again cold in the warm-up's order (restingAsks rounds, popped from the end) after `forgetSchedules`, to compare.
 *
 *   npx tsx scripts/.audit-frameloop-verify1.mts --snapshot <voyage.json> --from <epoch s> [--json out.json]
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

// ---- FRAME-1 verifier: the scene's candidates (index.ts setSnapshot -> runtime.outside), rule E wired.
const liveBudget = await import("@/ark-scene/live-budget");
const {wireZoneCapacity} = await import("@/ark-scene/map/capacity");
wireZoneCapacity(liveBudget as never);
const {arkRestingAsks} = liveBudget;
const {ARK_HERD_LIVE_LITE} = await import("@/ark-scene/herds");
const heldTown = (a: ArkAnimal) => {
    const info = towned.get(a.id);
    return Boolean(info && (info.tank || info.display || info.where === "indoor" || info.where === "window"));
};
const heldPins = new Set<string>(snapshot.animals.filter((a) => townIds.has(a.id) && heldTown(a)).map((a) => a.id));
const noPins = new Set<string>();
const candOf = (reps: {live: ReadonlySet<string>}) => snapshot.animals.filter((a) => reps.live.has(a.id)).map((a) => ({id: a.id, group: a.species_profile_id || `slug:${a.model_slug}`, zone: townIds.has(a.id) ? "town" : a.zone}));
const capacity = snapshot.animals.length >= 1000 ? arkZoneCapacity() : null;
const repsFull = arkRepresentatives(snapshot.animals, {pinned: noPins, live: ARK_HERD_LIVE});
const candFull = candOf(repsFull);
const outsideOf = (cands: ReturnType<typeof candOf>, budget: number, epoch: number, pinned: ReadonlySet<string>, resting?: (c: {id: string}) => boolean) => {
    const within = capacity ? arkWithinCapacity(cands, capacity, epoch, pinned, resting as never) : cands;
    return {within: within.length, out: arkOutside(within, budget, epoch, pinned, resting as never)};
};
const first = outsideOf(candFull, ARK_LIVE_BUDGET.high, from, heldPins);
const roster: ArkAnimal[] = snapshot.animals.filter((a) => repsFull.live.has(a.id) && first.out.has(a.id));
const kindsAmong = (cands: ReturnType<typeof candOf>) => new Set(cands.map((c) => c.group)).size;
console.error(`candidates: live ${candFull.length} (kinds ${kindsAmong(candFull)}), after rule E ${first.within}; held town pins ${heldPins.size}; high layout out ${first.out.size}, roster ${roster.length}; capacity ${capacity ? "on" : "off"}`);

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
forgetSchedules();
wireRecipes(onIt.map((e) => ({animal: e.sched!.animal, profile: e.sched!.profile, slug: e.animal.model_slug, activity: e.animal.activity})));
const tWired = performance.now();
// ---- The drop (high -> medium): runtime.outside at 400, restingFor's answers at the step's own instant.
const {restingAtRoost} = sched as unknown as {restingAtRoost: (w: unknown, p: unknown, a: unknown, t: number, h: unknown, act?: unknown) => {resting: boolean}};
const step = Math.floor(from / 300);
type Ask = {id: string; slug: string; area: string; ms: number; value: boolean};
const memo = new Map<string, boolean>();
let log: Ask[] = [];
const askOne = (id: string): boolean => {
    const key = `${id}|${step}`;
    const known = memo.get(key);
    if (known !== undefined) return known;
    const animal = snapshotById.get(id);
    const place = allPlaces.get(id);
    if (!animal || !place) return false;
    const t = performance.now();
    const s = entryById.get(id)?.sched ?? makeSched(animal, place, arkBody(animal, planOf(animal.model_slug)).display);
    const value = s ? restingAtRoost(worldOf(s.animal), s.profile, s.animal, step * 300, hours, animal.activity).resting : false;
    const ms = performance.now() - t;
    memo.set(key, value);
    log.push({id, slug: animal.model_slug, area: towned.get(id)?.area ?? (townIds.has(id) ? "town" : "wild"), ms, value});
    return value;
};
const oracle = (c: {id: string}) => askOne(c.id);
const stats = (asks: Ask[]) => {
    const ms = asks.map((a) => a.ms).sort((a, b) => a - b);
    const q = (p: number) => (ms.length ? +ms[Math.min(ms.length - 1, Math.floor(p * ms.length))].toFixed(2) : 0);
    return {asks: asks.length, totalMs: Math.round(ms.reduce((a, b) => a + b, 0)), p50: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1), over16: ms.filter((m) => m > 16).length, over50: ms.filter((m) => m > 50).length, over100: ms.filter((m) => m > 100).length, resting: asks.filter((a) => a.value).length};
};
// (What each budget's rotation asks first with every answer taken as "not resting": arkRestingAsks, nothing computed.)
const firstAsks = (cands: ReturnType<typeof candOf>, budget: number, pinned: ReadonlySet<string>) => arkRestingAsks(cands, budget, from, pinned, capacity, () => undefined).length;
const preview = {high: firstAsks(candFull, ARK_LIVE_BUDGET.high, heldPins), medium: firstAsks(candFull, ARK_LIVE_BUDGET.medium, heldPins)};
const tDrop = performance.now();
const drop = outsideOf(candFull, ARK_LIVE_BUDGET.medium, from, heldPins, oracle);
const dropWall = performance.now() - tDrop;
const dropLog = log;
log = [];
// ---- Then medium -> low (lite: ARK_HERD_LIVE_LITE representatives, budget 200, no held pins), answers known.
const repsLite = arkRepresentatives(snapshot.animals, {pinned: noPins, live: ARK_HERD_LIVE_LITE});
const candLite = candOf(repsLite);
const tLow = performance.now();
const low = outsideOf(candLite, ARK_LIVE_BUDGET.low, from, noPins, oracle);
const lowWall = performance.now() - tLow;
const lowLog = log;
log = [];
// ---- High -> low at once (the pressure path, governor.onPower -> applyTier("low")): its asks on a cold memo, counted only.
const lowCold = arkRestingAsks(candLite, ARK_LIVE_BUDGET.low, from, noPins, capacity, () => undefined).length;
// ---- The finder's warm-up: rounds of restingAsks (known = the memo), each round's queue popped from the end, on a
// memo and trip memos made cold again (forgetSchedules): same answers? same set?
const dropMemo = new Map(memo);
memo.clear();
forgetSchedules();
for (const e of onIt) e.sched!.trip = null;
const tWarm = performance.now();
let rounds = 0;
for (;;) {
    const queue = arkRestingAsks(candFull, ARK_LIVE_BUDGET.medium, from, heldPins, capacity, (id) => memo.get(`${id}|${step}`));
    if (!queue.length) break;
    rounds++;
    while (queue.length) askOne(queue.pop()!);
}
const warmWall = performance.now() - tWarm;
const warmLog = log;
log = [];
const before = log.length;
const warmed = outsideOf(candFull, ARK_LIVE_BUDGET.medium, from, heldPins, oracle);
const extraAfterWarm = log.length - before;
let differ = 0;
let common = 0;
dropMemo.forEach((v, k) => {
    if (!memo.has(k)) return;
    common++;
    if (memo.get(k) !== v) differ++;
});
const sameSet = warmed.out.size === drop.out.size && Array.from(drop.out).every((id) => warmed.out.has(id));
// ---- Pacing the warm-up's asks as the fix would (its order and its ask times): up to 6 ms a frame, a frame every 1/fps.
const pace = (asks: Ask[], fps: number, budgetMs: number, limitS: number) => {
    let i = 0;
    let frames = 0;
    let worstFrame = 0;
    let held50 = 0;
    while (i < asks.length && frames < limitS * fps) {
        let spent = 0;
        while (i < asks.length && spent < budgetMs) spent += asks[i++].ms;
        frames++;
        worstFrame = Math.max(worstFrame, spent);
        if (spent > 50) held50++;
    }
    const left = asks.slice(i).reduce((a, b) => a + b.ms, 0);
    return {fps, frames, seconds: +(frames / fps).toFixed(1), done: i >= asks.length, leftAsks: asks.length - i, leftMs: Math.round(left), worstFrameMs: +worstFrame.toFixed(1), framesOver50: held50};
};
const summary = {
    from, step, hereHours: hours(from),
    counts: {candidates: candFull.length, kinds: kindsAmong(candFull), afterRuleE: first.within, heldPins: heldPins.size, highOut: first.out.size, roster: roster.length, entries: entries.length, scheduled: onIt.length, mediumOut: drop.out.size, liteCandidates: candLite.length, lowOut: low.out.size},
    build: {wildWorldMs: Math.round(tWild - t0), townWorldMs: Math.round(tTown - tWild), wiredMs: Math.round(tWired - t0)},
    firstRoundAsks: preview,
    drop: {wallMs: Math.round(dropWall), ...stats(dropLog), byArea: Object.fromEntries(["wild", "zoo", "farm", "house", "town"].map((k) => [k, stats(dropLog.filter((a) => a.area === k))])), worst: [...dropLog].sort((a, b) => b.ms - a.ms).slice(0, 12).map((a) => ({slug: a.slug, area: a.area, ms: +a.ms.toFixed(1)}))},
    lowAfterDrop: {wallMs: Math.round(lowWall), ...stats(lowLog)},
    lowColdFirstRoundAsks: lowCold,
    warm: {rounds, wallMs: Math.round(warmWall), ...stats(warmLog), extraAsksAtRelayout: extraAfterWarm, answersCompared: common, answersDiffer: differ, sameOutsideSet: sameSet},
    pacing: [pace(warmLog, 15, 6, 8), pace(warmLog, 30, 6, 8), pace(warmLog, 15, 6, 60), pace(dropLog, 15, 6, 8)]
};
console.log(JSON.stringify(summary, null, 1));
const out = arg("json", "");
if (out) writeFileSync(out, JSON.stringify({summary, dropLog, warmLog, lowLog}, null, 0));
