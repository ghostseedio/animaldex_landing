/**
 * PERF-WEB audit, FRAME-3 identity check (frameloop area, 2026-11-27). Untracked helper; not part of the tree.
 * Setup copied from `.audit-f2verify-spacing.mts` and `.audit-frameloop-verify1.mts` (index.ts setSnapshot ->
 * runtime.outside -> makeSched -> wireSchedules, rule E wired as index.ts:9588 wires it).
 *
 * Question: does the tier (and the order of tier changes) reach what the drawn animals do? FRAME-3 proposes to call
 * applyTier(lowerTier(tier)) early, before paceSettled (index.ts:11702), i.e. possibly before the behaviour world is built.
 *
 * Rosters at epoch T (no resting answers, as at a layout before the world is built):
 *   Rh: high   (ARK_HERD_LIVE 24, budget 1200, the town's held animals pinned: index.ts:3577)
 *   Rm: medium (ARK_HERD_LIVE 24, budget 400, held pinned)
 *   Rl: low    (lite: ARK_HERD_LIVE_LITE 12, budget 200, no held pins)
 * Histories (each a fresh set of entries; an entry's sched survives a re-layout as index.ts:3590 keeps it):
 *   TODAY:  wire(Rh) applied, then wire(Rm) applied, then wire(Rl) applied (desktop: first wiring at the start tier).
 *   TODAY2: the same again (determinism control).
 *   EARLY:  wire(Rl) only (two early drops before the world was built: pendingWire keeps only the latest list).
 *   EARLY2: wire(Rm) applied, then wire(Rl) applied (one early drop before the world, one after).
 *   HIGH:   wire(Rh) only (what today draws during the window).
 * Outputs: per-animal wiring (home, range, prey, group leader/size/rank, led, threats, mates) compared; the low-tier
 * resting answers at T's step asked with each history's scheds (index.ts restingFor: the entry's sched, else a fresh one)
 * and arkOutside(200) from them; a pose fingerprint (tripFor as index.ts asks it, pose every 2 s) of the wild entries.
 * Cadence control: the same fingerprint with the holder stepped at 1/7 s and 1/60 s between the 2 s samples.
 *
 *   npx tsx scripts/.audit-frameloop-f3id.mts [--snapshot <voyage.json>] [--from <epoch s>] [--seconds 160] [--json out]
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
const {forgetSchedules, groupSpread, rangeReach, scheduleWorld, spaceHomes, tripAt, poseOnTrip, wireThreats, withLazyRoost} = sched;
const {restingAtRoost} = sched as unknown as {restingAtRoost: (w: unknown, p: unknown, a: unknown, t: number, h: unknown, act?: unknown) => {resting: boolean}};
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
const {arkRepresentatives, ARK_HERD_LIVE, ARK_HERD_LIVE_LITE} = await import("@/ark-scene/herds");
const liveBudget = await import("@/ark-scene/live-budget");
const {ARK_LIVE_BUDGET, arkOutside, arkWithinCapacity, arkZoneCapacity} = liveBudget;
const {wireZoneCapacity} = await import("@/ark-scene/map/capacity");
wireZoneCapacity(liveBudget as never);

type ArkAnimal = import("@/ark-scene/types").ArkAnimal;
type ScheduleAnimal = import("@/ark-scene/behaviour-schedule").ScheduleAnimal;
type Profile = import("@/ark-scene/behaviour-profile").ArkBehaviourProfile;
type ScheduleWorld = import("@/ark-scene/behaviour-schedule").ScheduleWorld;
type ScheduleGroup = import("@/ark-scene/behaviour-schedule").ScheduleGroup;
type Trip = import("@/ark-scene/behaviour-schedule").Trip;

const raw = JSON.parse(readFileSync(arg("snapshot", "/Users/lennybeadle/AnimalDex-work/ark-perf-web/real/voyage.json"), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw)!;
const T = Number(arg("from", String(Math.floor(Date.UTC(2026, 10, 27, 3, 0, 0) / 1000))));
const SECONDS = Number(arg("seconds", "160"));
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
const hours = (epoch: number) => islandHours(epoch * 1000, 0); // index.ts:453 ISLAND_OFFSET_HOURS = 0

const wildAnimals = arkIslandSnapshot(snapshot, "wild").animals;
const townAnimals = arkIslandSnapshot(snapshot, "town").animals;
const townIds = new Set(townAnimals.map((a) => a.id));

// ---- Both islands' worlds ----
const tw0 = performance.now();
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
const worldsMs = performance.now() - tw0;
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
const heldTown = (id: string) => {
    const info = towned.get(id);
    return Boolean(info && (info.tank || info.display || info.where === "indoor" || info.where === "window"));
};
const matesOf = (id: string): string[] => {
    const info = towned.get(id);
    const e = info?.enclosure;
    if (!e || info?.area !== "zoo" || info.enclosureMargin === undefined) return [];
    const list: string[] = [];
    towned.forEach((o, other) => {
        if (o.area === "zoo" && o.enclosure?.id === e.id && o.enclosureMargin !== undefined && !o.still) list.push(other);
    });
    return list;
};
const worldOf = (animal: {id: string}): ScheduleWorld => (townIds.has(animal.id) ? townWorld : wildWorld);
type Place = {x: number; z: number; ground: number; leader?: string | null; rank?: number};
const allPlaces = new Map<string, Place>();
wildPlaces.forEach((p, id) => allPlaces.set(id, p));
placed.places.forEach((p, id) => allPlaces.set(id, {...p, x: p.x + origin.x, z: p.z + origin.z}));
const snapshotById = new Map(snapshot.animals.map((a) => [a.id, a]));

// ---- The rosters (index.ts setSnapshot 3567-3601: representatives, rule E, the tier's budget) ----
type Tier = "high" | "medium" | "low";
const capacity = snapshot.animals.length >= 1000 ? arkZoneCapacity() : null;
const heldPins = new Set<string>(snapshot.animals.filter((a) => townIds.has(a.id) && heldTown(a.id)).map((a) => a.id));
const noPins = new Set<string>();
const candidatesFor = (tier: Tier) => {
    const lite = tier === "low";
    const reps = arkRepresentatives(snapshot.animals, {pinned: noPins, live: lite ? ARK_HERD_LIVE_LITE : ARK_HERD_LIVE});
    return {reps, cands: snapshot.animals.filter((a) => reps.live.has(a.id)).map((a) => ({id: a.id, group: a.species_profile_id || `slug:${a.model_slug}`, zone: townIds.has(a.id) ? "town" : a.zone}))};
};
const rosterOf = (tier: Tier, resting?: (c: {id: string}) => boolean): ArkAnimal[] => {
    const {reps, cands} = candidatesFor(tier);
    const pins = tier === "low" ? noPins : heldPins;
    const within = capacity ? arkWithinCapacity(cands, capacity, T, pins, resting as never) : cands;
    const out = arkOutside(within, ARK_LIVE_BUDGET[tier], T, pins, resting as never);
    return snapshot.animals.filter((a) => reps.live.has(a.id) && out.has(a.id));
};

// ---- Entries kept across wirings, as setSnapshot keeps them (the sched object survives: index.ts:3590) ----
type Sched = {animal: ScheduleAnimal; profile: Profile; trip: Trip | null};
type Entry = {animal: ArkAnimal; place: Place; length: number; sched: Sched | null; leader: Entry | null};
type State = {name: string; entryById: Map<string, Entry>; list: Entry[]};
const makeSched = (animal: ArkAnimal, place: Place, length: number, state: State | null): Sched | null => {
    if (!onSchedule(place as never, animal.model_slug) || !onBehaviourSchedule(animal.model_slug)) return null;
    const inTown = townIds.has(animal.id);
    if (inTown && !townScheduled(animal.id)) return null;
    const sea = !inTown && ZONE_SITES[animal.zone]?.kind === "sea";
    const info = towned.get(animal.id);
    const keep = inTown ? (info?.pen ? penKeep(info.pen, info.penMargin ?? 0, origin.x, origin.z) : info?.enclosure?.mask && info.enclosureMargin !== undefined ? penKeep(maskBox(info.enclosure.mask), info.enclosureMargin, origin.x, origin.z) : null) : null;
    const mateIds = inTown ? matesOf(animal.id) : [];
    return {
        animal: withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea, thrive: arkThriveOf(animal), sleep: arkSleepOf(animal), condition: animal.condition ?? null, ...(inTown ? {range: info ? Math.max(info.range, 0.6) * 1.5 : null, kept: true, keep, bed: beds.get(animal.id) ?? null, mates: () => mateIds.flatMap((id) => {
            // (index.ts makeSched: the mates are the DRAWN ones, `entryById.get(id)?.sched`.)
            const m = state?.entryById.get(id);
            return m?.sched ? [{animal: m.sched.animal, profile: m.sched.profile, activity: m.animal.activity}] : [];
        })} : {})} as never, () => (inTown ? null : scheduleRoost(place as never, animal.zone))),
        profile: behaviourProfile(animal.model_slug, planOf(animal.model_slug)),
        trip: null
    };
};
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const newState = (name: string): State => ({name, entryById: new Map(), list: []});
let spacingMs = 0;
let spacings = 0;
/** setSnapshot (entries) + wireSchedules (index.ts:2242-2370) for a roster, its spacing applied. */
const wire = (state: State, roster: ArkAnimal[]) => {
    const next = new Map<string, Entry>();
    for (const animal of roster) {
        const place = allPlaces.get(animal.id);
        if (!place) continue;
        const before = state.entryById.get(animal.id);
        if (before) {
            before.animal = animal;
            before.place = place;
            next.set(animal.id, before);
            continue;
        }
        const body = arkBody(animal, planOf(animal.model_slug));
        next.set(animal.id, {animal, place, length: body.display * sexLook(animal.id, animal.model_slug).scale, sched: null, leader: null});
    }
    state.entryById = next;
    next.forEach((e) => {
        if (!e.sched) e.sched = makeSched(e.animal, e.place, arkBody(e.animal, planOf(e.animal.model_slug)).display, state);
    });
    next.forEach((e) => (e.leader = e.place.leader && e.place.leader !== e.animal.id ? next.get(e.place.leader) ?? null : null));
    state.list = Array.from(next.values());
    const onIt = state.list.filter((e) => e.sched);
    const sizes = new Map<Entry, number>();
    for (const e of onIt) if (e.leader?.sched) sizes.set(e.leader, (sizes.get(e.leader) ?? 1) + 1);
    const keptTown = (e: Entry) => townIds.has(e.animal.id) && kept(e.animal.id);
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
        const out = next.get(id);
        if (out?.sched) return {animal: out.sched.animal, profile: out.sched.profile, activity: out.animal.activity};
        const animal = snapshotById.get(id);
        const place = allPlaces.get(id);
        if (!animal || !place) return null;
        let s = standIns.get(id);
        if (s === undefined) standIns.set(id, (s = makeSched(animal, place, arkBody(animal, planOf(animal.model_slug)).display, state)));
        return s ? {animal: s.animal, profile: s.profile, activity: animal.activity} : null;
    };
    const groups = new Map<Entry, ScheduleGroup | null>();
    for (const e of onIt) {
        const own = e.sched!;
        const grouped = GROUPED.has(own.profile.social) || groupLives(e.animal.model_slug);
        const k = grouped ? keptLeader(e) : null;
        if (k && snapshotById.get(e.place.leader!)?.model_slug === e.animal.model_slug) {
            groups.set(e, {leader: k.animal, profile: k.profile, activity: k.activity, rank: Math.max(e.place.rank ?? 1, 1), size: Math.max(keptSizes.get(e.place.leader!) ?? 2, 2)} as ScheduleGroup);
            continue;
        }
        const leader = e.leader && e.leader.sched && e.leader.animal.model_slug === e.animal.model_slug && grouped ? e.leader : null;
        groups.set(e, leader ? ({leader: leader.sched!.animal, profile: leader.sched!.profile, activity: leader.animal.activity, rank: Math.max(e.place.rank ?? 1, 1), size: sizes.get(leader) ?? 2} as ScheduleGroup) : null);
    }
    const ledOf = new Map<ScheduleAnimal, number>();
    groups.forEach((g) => g && ledOf.set(g.leader, (ledOf.get(g.leader) ?? 1) + 1));
    const radius = new Map(onIt.map((e) => [e.animal.id, rangeReach(e.sched!.profile, e.sched!.animal) + (sizes.has(e) ? groupSpread(e.length, sizes.get(e)!) : 0)]));
    const t = performance.now();
    const spaced = spaceHomes(
        onIt.filter((e) => !groups.get(e) && !keptTown(e)).map((e) => {
            const nav = worldOf(e.sched!.animal).nav;
            const inTown = townIds.has(e.animal.id);
            const habitat = (x: number, z: number) => inTown || mapHabitatAt(e.animal, x, z, 5);
            const p = e.sched!.profile;
            return {id: e.animal.id, slug: e.animal.model_slug, home: {x: e.sched!.animal.home.x, z: e.sched!.animal.home.z}, length: e.length, walkable: (x: number, z: number) => (p.move === "swim" || p.seabed ? nav.swimmable(x, z, 0.5) : p.move === "fly" ? worldOf(e.animal).sampler.heightAt(x, z) > 0.05 && habitat(x, z) : nav.walkable(x, z) && habitat(x, z))};
        }),
        eats,
        (id) => radius.get(id) ?? 3
    );
    spacingMs += performance.now() - t;
    spacings++;
    // apply (index.ts:2316-2364)
    for (const e of onIt) {
        const own = e.sched!;
        own.animal.group = groups.get(e) ?? null;
        own.animal.led = ledOf.get(own.animal) ?? 0;
        const age = typeof snapshot.ark_day === "number" && typeof e.animal.born_ark_day === "number" ? snapshot.ark_day - e.animal.born_ark_day : null;
        own.animal.young = e.animal.origin === "born" && age !== null && age < 90;
    }
    for (const e of onIt) {
        const own = e.sched!;
        const moved = spaced.get(e.animal.id);
        if (moved) {
            own.animal.home = {x: moved.home.x, y: Math.max(worldOf(e.animal).sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
            own.animal.range = moved.range === null ? null : sizes.has(e) ? moved.range / 2 : moved.range;
            own.animal.prey = moved.prey;
        }
        own.trip = null;
    }
    for (const e of onIt) {
        const lead = e.sched!.animal.group?.leader;
        if (!lead || !e.leader || !spaced.has(e.leader.animal.id)) continue;
        e.sched!.animal.home = {...lead.home};
        e.sched!.animal.range = lead.range;
    }
    wireThreats(onIt.map((e) => ({slug: e.animal.model_slug, animal: e.sched!.animal, profile: e.sched!.profile, activity: e.animal.activity})), eats);
    forgetSchedules();
    wireRecipes(onIt.map((e) => ({animal: e.sched!.animal, profile: e.sched!.profile, slug: e.animal.model_slug, activity: e.animal.activity})));
};
/** Re-arm a state's global wiring (recipes are module state) before asking its schedules. */
const rearm = (state: State) => {
    forgetSchedules();
    const onIt = state.list.filter((e) => e.sched);
    wireRecipes(onIt.map((e) => ({animal: e.sched!.animal, profile: e.sched!.profile, slug: e.animal.model_slug, activity: e.animal.activity})));
    for (const e of onIt) e.sched!.trip = null;
};

// ---- Per-animal wiring as the schedule reads it ----
const r = (v: number | null | undefined) => (v === null || v === undefined ? String(v) : v.toString());
const wiringOf = (state: State) => {
    const out = new Map<string, Record<string, string>>();
    state.entryById.forEach((e, id) => {
        if (!e.sched) return;
        const a = e.sched.animal as ScheduleAnimal & {threats?: Array<{animal: {id: string}}> | null; group?: ScheduleGroup | null; led?: number; prey?: {x: number; z: number} | null; mates?: () => Array<{animal: {id: string}}>};
        out.set(id, {
            home: `${r(a.home.x)},${r(a.home.z)}`,
            range: r(a.range as number | null | undefined),
            prey: a.prey ? `${r(a.prey.x)},${r(a.prey.z)}` : "none",
            group: a.group ? `${(a.group.leader as {id: string}).id}/${a.group.size}/${a.group.rank}` : "none",
            led: String(a.led ?? 0),
            threats: a.threats ? a.threats.map((t) => t.animal.id).sort().join(",") : "none",
            mates: a.mates ? a.mates().map((m) => m.animal.id).sort().join(",") : "none"
        });
    });
    return out;
};
const FIELDS = ["home", "range", "prey", "group", "led", "threats", "mates"];
const compare = (a: Map<string, Record<string, string>>, b: Map<string, Record<string, string>>, only?: (id: string) => boolean) => {
    let inBoth = 0, anyDiff = 0, wildDiff = 0, townDiff = 0;
    const byField: Record<string, number> = Object.fromEntries(FIELDS.map((f) => [f, 0]));
    const kinds = new Map<string, number>();
    let maxHomeM = 0;
    a.forEach((wa, id) => {
        const wb = b.get(id);
        if (!wb || (only && !only(id))) return;
        inBoth++;
        let d = false;
        for (const f of FIELDS) if (wa[f] !== wb[f]) {
            byField[f]++;
            d = true;
        }
        if (wa.home !== wb.home) {
            const [ax, az] = wa.home.split(",").map(Number);
            const [bx, bz] = wb.home.split(",").map(Number);
            maxHomeM = Math.max(maxHomeM, Math.hypot(ax - bx, az - bz));
        }
        if (d) {
            anyDiff++;
            if (townIds.has(id)) townDiff++;
            else wildDiff++;
            const slug = snapshotById.get(id)!.model_slug;
            kinds.set(slug, (kinds.get(slug) ?? 0) + 1);
        }
    });
    return {inBoth, anyDiff, wildDiff, townDiff, byField, maxHomeMetres: +maxHomeM.toFixed(2), kinds: Array.from(kinds.entries()).sort((x, y) => y[1] - x[1]).slice(0, 10)};
};

// ---- Poses: tripFor as index.ts:2209 asks it for a wild animal (the trip held for its slot, the previous handed on) ----
/** (`--diagnose`: each new trip and each sample written down per animal, during the very pass that hashes it.) */
let TRACE: Map<string, Array<{t: number; line: string; x?: number; z?: number}>> | null = null;
const {slotOffset} = sched as unknown as {slotOffset: (id: string) => number};
const offGrid = (id: string, trip: Trip) => (trip.start + slotOffset(id)) % 80 !== 0 || trip.end - trip.start !== 80;
const tripOf = (holder: Sched, e: Entry, epoch: number): Trip => {
    let trip = holder.trip;
    if (!trip || epoch < trip.start || epoch >= trip.end) {
        const previous = trip;
        holder.trip = trip = tripAt(worldOf(e.animal), holder.profile, holder.animal, epoch, hours, e.animal.activity, previous);
        if (TRACE) {
            let list = TRACE.get(e.animal.id);
            if (!list) TRACE.set(e.animal.id, (list = []));
            const f = (trip as unknown as {finish?: {x: number; z: number}}).finish;
            list.push({t: epoch, line: `trip asked t=${(epoch - T).toFixed(3)} slot=${trip.slot} [${trip.start - T},${trip.end - T}) prev=${previous ? previous.slot : "-"}${previous && previous.slot !== trip.slot - 1 ? "(not slot-1)" : ""} doing=${trip.doing} offGrid=${offGrid(e.animal.id, trip)} finish=${f ? `${f.x},${f.z}` : "?"}`});
        }
    }
    return trip;
};
const num = (v: unknown) => (typeof v === "number" ? (Object.is(v, -0) ? "-0" : v.toString()) : JSON.stringify(v ?? null));
const poseKey = (p: Record<string, unknown>) => Object.keys(p).sort().map((k) => `${k}=${typeof p[k] === "object" && p[k] !== null ? JSON.stringify(p[k]) : num(p[k])}`).join(";");
/** One hash per entry over its trips' slots/doings and its pose every 2 s; `step`: how often the holder is stepped between samples.
 * `stress`: before every 20th sample (from the 10th), 70 other slots of the same animal asked (far back), so its memo (`remember`: over 64
 * slots, the least lately asked dropped to 48) evicts what the samples use: the same hashes if eviction never changes an answer. */
const fingerprint = (state: State, ids: string[], step: number, stress = false) => {
    rearm(state);
    const out = new Map<string, string>();
    // The frames' moments and the 2 s samples merged in order (a sample is a frame that lands exactly on it), so the
    // holder only ever moves forward, as the scene's frames do.
    const times: Array<{t: number; sample: boolean}> = [];
    const nSteps = Math.floor(SECONDS / step + 1e-9);
    const nSamples = Math.floor(SECONDS / 2 + 1e-9);
    for (let k = 0, j = 0; k <= nSteps || j <= nSamples; ) {
        const a = k <= nSteps ? T + k * step : Infinity;
        const b = j <= nSamples ? T + 2 * j : Infinity;
        if (b <= a) {
            times.push({t: b, sample: true});
            if (a === b) k++;
            j++;
        } else {
            times.push({t: a, sample: false});
            k++;
        }
    }
    for (const id of ids) {
        const e = state.entryById.get(id);
        if (!e?.sched) continue;
        const h = createHash("sha256");
        let samples = 0;
        for (const {t, sample} of times) {
            if (stress && sample && samples % 20 === 10) {
                // (70 consecutive slots about 4.5 to 6 hours back, oldest first: each finds the one before it remembered.)
                for (let k = 0; k < 70; k++) tripAt(worldOf(e.animal), e.sched.profile, e.sched.animal, T - (270 - k) * 80, hours, e.animal.activity, null);
            }
            if (sample) samples++;
            const trip = tripOf(e.sched, e, t);
            if (!sample) continue;
            const pose = poseOnTrip(worldOf(e.animal), trip, t) as unknown as Record<string, unknown>;
            h.update(`${trip.slot}|${trip.doing}|${trip.start}|${trip.end}|${poseKey(pose)}\n`);
            if (TRACE) {
                let list = TRACE.get(id);
                if (!list) TRACE.set(id, (list = []));
                list.push({t, line: `sample t=${(t - T).toFixed(0)} slot=${trip.slot} doing=${trip.doing} x=${pose.x} z=${pose.z} yaw=${pose.yaw}`, x: pose.x as number, z: pose.z as number});
            }
        }
        out.set(id, h.digest("hex"));
    }
    return out;
};
/** Each entry's pose every 2 s (x, y, z, yaw), the trips asked as `fingerprint` asks them at the 2 s cadence. */
const posesOf = (state: State, ids: string[]) => {
    rearm(state);
    const out = new Map<string, Array<{x: number; y: number; z: number; yaw: number; doing: string}>>();
    for (const id of ids) {
        const e = state.entryById.get(id);
        if (!e?.sched) continue;
        const list: Array<{x: number; y: number; z: number; yaw: number; doing: string}> = [];
        for (let j = 0; j <= Math.floor(SECONDS / 2 + 1e-9); j++) {
            const t = T + 2 * j;
            const trip = tripOf(e.sched, e, t);
            const p = poseOnTrip(worldOf(e.animal), trip, t) as unknown as {x: number; y: number; z: number; yaw: number};
            list.push({x: p.x, y: p.y, z: p.z, yaw: p.yaw, doing: String(trip.doing)});
        }
        out.set(id, list);
    }
    return out;
};
/** How far apart the same animal stands at the same moments in two states (m): per animal the most, over those that differ. */
const poseGaps = (a: ReturnType<typeof posesOf>, b: ReturnType<typeof posesOf>) => {
    const most: number[] = [];
    let doingDiffers = 0;
    a.forEach((la, id) => {
        const lb = b.get(id);
        if (!lb) return;
        let m = 0;
        let d = false;
        la.forEach((p, k) => {
            const q = lb[k];
            m = Math.max(m, Math.hypot(p.x - q.x, p.z - q.z));
            if (p.doing !== q.doing) d = true;
        });
        if (m > 0) most.push(m);
        if (d) doingDiffers++;
    });
    most.sort((x, y) => x - y);
    return {animalsApart: most.length, doingDiffers, medianMostMetres: most.length ? +most[Math.floor(most.length / 2)].toFixed(2) : 0, mostMetres: most.length ? +most[most.length - 1].toFixed(2) : 0};
};
const diffCount = (a: Map<string, string>, b: Map<string, string>) => {
    let both = 0, diff = 0;
    a.forEach((v, id) => {
        const w = b.get(id);
        if (w === undefined) return;
        both++;
        if (v !== w) diff++;
    });
    return {both, diff};
};

// ---- Run ----
const t0 = performance.now();
const Rh = rosterOf("high");
const Rm = rosterOf("medium");
const Rl = rosterOf("low");
const ids = (list: ArkAnimal[]) => new Set(list.map((a) => a.id));
const RhI = ids(Rh), RmI = ids(Rm), RlI = ids(Rl);
const overlap = (a: Set<string>, b: Set<string>) => Array.from(a).filter((id) => b.has(id)).length;

const TODAY = newState("TODAY");
wire(TODAY, Rh);
const todayAfterHigh = wiringOf(TODAY);
wire(TODAY, Rm);
const todayAfterMedium = wiringOf(TODAY);
// (The low tier's resting answers at T's step, asked with TODAY's scheds after the medium wiring, as restingFor asks:
// the entry's sched when drawn, else a fresh one from its place.)
const askResting = (state: State, id: string): boolean => {
    const animal = snapshotById.get(id)!;
    const place = allPlaces.get(id);
    if (!place) return false;
    const s = state.entryById.get(id)?.sched ?? makeSched(animal, place, arkBody(animal, planOf(animal.model_slug)).display, state);
    return s ? restingAtRoost(worldOf(s.animal), s.profile, s.animal, Math.floor(T / 300) * 300, hours, animal.activity).resting : false;
};
const liteCands = candidatesFor("low").cands;
rearm(TODAY);
const restToday = new Map(liteCands.map((c) => [c.id, askResting(TODAY, c.id)]));
wire(TODAY, Rl);
const todayFinal = wiringOf(TODAY);

const TODAY2 = newState("TODAY2");
wire(TODAY2, Rh);
wire(TODAY2, Rm);
wire(TODAY2, Rl);
const today2Final = wiringOf(TODAY2);

const EARLY = newState("EARLY");
wire(EARLY, Rl);
const earlyFinal = wiringOf(EARLY);
rearm(EARLY);
const restEarly = new Map(liteCands.map((c) => [c.id, askResting(EARLY, c.id)]));

const EARLY2 = newState("EARLY2");
wire(EARLY2, Rm);
wire(EARLY2, Rl);
const early2Final = wiringOf(EARLY2);

const HIGH = newState("HIGH");
wire(HIGH, Rh);
const highOnly = wiringOf(HIGH);
const wiredMs = performance.now() - t0;

// Resting answers -> the low tier's drawn set.
let restDiff = 0;
restToday.forEach((v, id) => {
    if (restEarly.get(id) !== v) restDiff++;
});
const outFrom = (answers: Map<string, boolean>) => {
    const resting = (c: {id: string}) => answers.get(c.id) === true;
    const within = capacity ? arkWithinCapacity(liteCands, capacity, T, noPins, resting as never) : liteCands;
    return arkOutside(within, ARK_LIVE_BUDGET.low, T, noPins, resting as never);
};
const outToday = outFrom(restToday);
const outEarly = outFrom(restEarly);
const outSym = Array.from(outToday).filter((id) => !outEarly.has(id)).length + Array.from(outEarly).filter((id) => !outToday.has(id)).length;

// Fingerprints of the wild entries drawn at the low tier (and, for the window, of the wild entries drawn at both high and low).
const wildLow = Array.from(RlI).filter((id) => !townIds.has(id)).sort();
const tf0 = performance.now();
const fpToday = fingerprint(TODAY, wildLow, 2);
const fpToday2 = fingerprint(TODAY2, wildLow, 2);
const fpEarly = fingerprint(EARLY, wildLow, 2);
const fpEarly2 = fingerprint(EARLY2, wildLow, 2);
const fpHigh = fingerprint(HIGH, wildLow.filter((id) => RhI.has(id)), 2);
// Cadence control (the frame rate an early GPU relief changes): the same samples, the holder stepped at ~7 fps and 60 fps.
const cadenceIds = wildLow.slice(0, Number(arg("cadence", "80")));
const fpCad2 = fingerprint(TODAY, cadenceIds, 2);
const fpCad7 = fingerprint(TODAY, cadenceIds, 1 / 7);
const fpCad60 = fingerprint(TODAY, cadenceIds, 1 / 60);
// Memo eviction control: the first 20 of those, their memos forced to evict between samples.
const stressIds = cadenceIds.slice(0, 20);
const fpStress = fingerprint(TODAY, stressIds, 2, true);
// How far apart: the same wild low-tier animals, TODAY vs EARLY (after) and HIGH vs EARLY (the window).
const pToday = posesOf(TODAY, wildLow);
const pEarly = posesOf(EARLY, wildLow);
const pHigh = posesOf(HIGH, wildLow.filter((id) => RhI.has(id)));
const gapsAfter = poseGaps(pToday, pEarly);
const gapsWindow = poseGaps(pHigh, pEarly);
// (`--cadence-high`: the same cadence and eviction controls over every wild scheduled entry of the high roster.)
let cadenceHigh: Record<string, unknown> | null = null;
if (argv.includes("--cadence-high")) {
    const highWild = Array.from(HIGH.entryById.keys()).filter((id) => !townIds.has(id) && HIGH.entryById.get(id)!.sched).sort();
    const a = fingerprint(HIGH, highWild, 2);
    const b = fingerprint(HIGH, highWild, 1 / 7);
    const c = fingerprint(HIGH, highWild, 1 / 60);
    const s = fingerprint(HIGH, highWild.slice(0, Number(arg("stress", "150"))), 2, true);
    cadenceHigh = {wildScheduledEntries: highWild.length, vs7fps: diffCount(a, b), vs60fps: diffCount(a, c), evictionStress: diffCount(a, s)};
    if (argv.includes("--diagnose")) {
        type Tr = NonNullable<typeof TRACE>;
        const traced = (step: number, stress: boolean, ids: string[]): {h: Map<string, string>; tr: Tr} => {
            TRACE = new Map();
            const h = fingerprint(HIGH, ids, step, stress);
            const tr = TRACE;
            TRACE = null;
            return {h, tr};
        };
        const report = (label: string, A: {h: Map<string, string>; tr: Tr}, B: {h: Map<string, string>; tr: Tr}) => {
            const rows: unknown[] = [];
            A.h.forEach((v, id) => {
                if (B.h.get(id) === undefined || B.h.get(id) === v) return;
                const la = A.tr.get(id) ?? [], lb = B.tr.get(id) ?? [];
                // The samples side by side: how far apart, from when.
                const sa = la.filter((r) => r.x !== undefined), sb = lb.filter((r) => r.x !== undefined);
                let most = 0, firstApart: number | null = null, apartSamples = 0;
                sa.forEach((r, k) => {
                    const q = sb[k];
                    if (!q) return;
                    const d = Math.hypot(r.x! - q.x!, r.z! - q.z!);
                    if (d > 0) {
                        apartSamples++;
                        if (firstApart === null) firstApart = r.t - T;
                    }
                    most = Math.max(most, d);
                });
                // The trips asked (not the samples), in order, for both: the first that differs.
                const ta = la.filter((r) => r.x === undefined).map((r) => r.line.replace(/ t=[-0-9.]+/, ""));
                const tb = lb.filter((r) => r.x === undefined).map((r) => r.line.replace(/ t=[-0-9.]+/, ""));
                let k = 0;
                while (k < ta.length && k < tb.length && ta[k] === tb[k]) k++;
                rows.push({id, slug: snapshotById.get(id)!.model_slug, group: (HIGH.entryById.get(id)!.sched!.animal as {group?: unknown}).group ? "follower" : "own", mostApartMetres: +most.toFixed(3), firstApartAtS: firstApart, apartSamples, samples: sa.length, tripsA: la.filter((r) => r.x === undefined).map((r) => r.line), tripsB: lb.filter((r) => r.x === undefined).map((r) => r.line), firstTripDiffIndex: k});
            });
            return {label, rows};
        };
        // A fresh wiring of the high roster: its FIRST pass (nothing asked yet since `wire`) against its second.
        const HIGH2 = newState("HIGH2");
        wire(HIGH2, Rh);
        const highWild2 = Array.from(HIGH2.entryById.keys()).filter((id) => !townIds.has(id) && HIGH2.entryById.get(id)!.sched).sort();
        const tracedOn = (state: State, ids: string[]) => {
            TRACE = new Map();
            const h = fingerprint(state, ids, 2);
            const tr = TRACE;
            TRACE = null;
            return {h, tr};
        };
        const P1 = tracedOn(HIGH2, highWild2);
        const P2 = tracedOn(HIGH2, highWild2);
        const P3 = tracedOn(HIGH2, highWild2);
        const firstVsSecond = report("fresh wiring: first pass vs second pass", P1, P2);
        const secondVsThird = report("fresh wiring: second pass vs third pass", P2, P3);
        // (Which animals differ, and their kinds' profiles: what they are, what they did.)
        const who = firstVsSecond.rows.map((row) => {
            const id = (row as {id: string}).id;
            const e = HIGH2.entryById.get(id)!;
            const p = e.sched!.profile as unknown as Record<string, unknown>;
            return {id, slug: e.animal.model_slug, zone: e.animal.zone, move: p.move, social: p.social, roost: p.roost, activity: e.animal.activity, threats: ((e.sched!.animal as {threats?: unknown[] | null}).threats ?? []).length, group: Boolean((e.sched!.animal as {group?: unknown}).group), led: (e.sched!.animal as {led?: number}).led};
        });
        writeFileSync(arg("diag-first", "/Users/lennybeadle/AnimalDex-work/ark-perf-web/scratch/frameloop-verify-frame3-identity/diagnose-first.json"), JSON.stringify({firstVsSecond, secondVsThird, who}, null, 1));
        (cadenceHigh as Record<string, unknown>).firstPass = {entries: highWild2.length, firstVsSecond: diffCount(P1.h, P2.h), secondVsThird: diffCount(P2.h, P3.h), who};
        const A2 = traced(2, false, highWild);
        const A60 = traced(1 / 60, false, highWild);
        const sIds = highWild.slice(0, Number(arg("stress", "150")));
        const S2 = traced(2, false, sIds);
        const Sx = traced(2, true, sIds);
        const diag = [report("cadence 2s vs 60fps", A2, A60), report("eviction plain vs stress", S2, Sx)];
        writeFileSync(arg("diag", "/Users/lennybeadle/AnimalDex-work/ark-perf-web/scratch/frameloop-verify-frame3-identity/diagnose.json"), JSON.stringify(diag, null, 1));
        // How many trips of the high roster's wild entries are off the slot grid at all (2 s pass).
        let trips = 0, off = 0;
        A2.tr.forEach((list) => list.forEach((r) => {
            if (r.x !== undefined) return;
            trips++;
            if (r.line.includes("offGrid=true")) off++;
        }));
        (cadenceHigh as Record<string, unknown>).diagnose = {tripsAsked: trips, offGrid: off, cadenceDiffering: diag[0].rows.length, evictionDiffering: diag[1].rows.length};
    }
}
const fpMs = performance.now() - tf0;

const result = {
    snapshot: {animals: snapshot.animals.length, wild: wildAnimals.length, town: townAnimals.length},
    from: T,
    seconds: SECONDS,
    worldsBuildMs: Math.round(worldsMs),
    wiringMs: Math.round(wiredMs),
    spacingMsEach: +(spacingMs / Math.max(spacings, 1)).toFixed(1),
    rosters: {high: Rh.length, medium: Rm.length, low: Rl.length, highAndLow: overlap(RhI, RlI), highAndMedium: overlap(RhI, RmI), mediumAndLow: overlap(RmI, RlI), lowNotInHigh: Rl.length - overlap(RhI, RlI), heldPins: heldPins.size, ruleE: Boolean(capacity)},
    window_HIGHwiring_vs_EARLYlowWiring: compare(highOnly, earlyFinal),
    after_TODAYfinal_vs_EARLYfinal: compare(todayFinal, earlyFinal),
    after_TODAYfinal_vs_EARLY2final: compare(todayFinal, early2Final),
    control_TODAY_vs_TODAY2: compare(todayFinal, today2Final),
    todayHigh_vs_todayMedium_sameAnimals: compare(todayAfterHigh, todayAfterMedium),
    restingAtLowStep: {asked: restToday.size, answersDiffer: restDiff, restingToday: Array.from(restToday.values()).filter(Boolean).length, restingEarly: Array.from(restEarly.values()).filter(Boolean).length, outsideToday: outToday.size, outsideEarly: outEarly.size, outsideSymmetricDiff: outSym},
    poses: {
        wildLowEntries: wildLow.length,
        control_TODAY_vs_TODAY2: diffCount(fpToday, fpToday2),
        after_TODAY_vs_EARLY: diffCount(fpToday, fpEarly),
        after_TODAY_vs_EARLY2: diffCount(fpToday, fpEarly2),
        window_HIGH_vs_EARLY: diffCount(fpHigh, fpEarly),
        cadence_2s_vs_7fps: diffCount(fpCad2, fpCad7),
        cadence_2s_vs_60fps: diffCount(fpCad2, fpCad60),
        evictionStress_vs_plain: diffCount(fpCad2, fpStress),
        cadenceHigh,
        gapsAfter_TODAY_vs_EARLY: gapsAfter,
        gapsWindow_HIGH_vs_EARLY: gapsWindow,
        fingerprintMs: Math.round(fpMs)
    }
};
console.log(JSON.stringify(result, null, 1));
const jsonOut = arg("json", "");
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 1));
