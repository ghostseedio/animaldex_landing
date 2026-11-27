/**
 * PERF-WEB audit, FRAME-2 identity check (2026-11-27). Untracked helper; not part of the tree.
 *
 * Question: does the scene's composed state depend on WHEN its sliced jobs finish (the frame budget's only effect)?
 * `index.ts` keeps an entry's `sched` across `setSnapshot` (Object.assign(before, ...)), and `wireSchedules` spaces
 * predators from `e.sched!.animal.home` and reach `rangeReach(profile, sched.animal)` (which reads `animal.range`), both
 * of which an earlier applied spacing wrote. "The latest wiring asked for wins": a spacing superseded before it is
 * applied writes nothing. So the homes after a sequence of wirings could depend on which intermediate spacings landed.
 *
 * Scenarios (tier high, both islands laid out as the schedule rig does):
 *   F  fresh: one wiring of the roster at T (spacing from the placement homes).
 *   I  the same roster wired twice, the first spacing applied (idempotence).
 *   R  the roster at T-300 wired (applied), then the roster at T (the rotation step).
 *   J  the town join, every batch's spacing applied: wild-only, then wild + town[0:450], +900, ..., then all.
 *   J0 the town join, only the wild-only spacing applied (every batch's spacing superseded), then all.
 *   Jb the join with smaller batches (150), every batch applied (a pool-sized join).
 * Plus T1: town places from partial join lists (450 and 150 per batch, sorted by arrived_at as attachIsland does) vs
 * the whole list, after a whole-list placement as the prebuild/first read leaves the memo.
 *
 *   npx tsx scripts/.audit-f2verify-spacing.mts [--snapshot <voyage.json>] [--from <epoch s>] [--town-scheds on|off]
 */
import {readFileSync, existsSync} from "node:fs";
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
const {groupSpread, rangeReach, scheduleWorld, spaceHomes, withLazyRoost} = sched;
const {setRecipeColliders, setRecordedSexes, sexLook} = await import("@/ark-scene/behaviour-recipes");
const {collideBlocked, collideSegmentClear, setIslandColliders} = await import("@/ark-scene/collide");
const {eats} = await import("@/ark-scene/food-links");
const {arkBody} = await import("@/ark-scene/stats");
const {arkThriveOf} = await import("@/ark-scene/thrive");
const {ZONE_SITES} = await import("@/ark-scene/world");
const {arkSleepOf} = await import("@/ark-scene/sleep-hours");
const {groupLives} = await import("@/ark-scene/behaviour-group");
const {placeTownAnimals, maskBox, penKeep} = await import("@/ark-scene/islands/town/placement");
const {townColliderSet} = await import("@/ark-scene/islands/town/colliders");
const {townWorldSampler} = await import("@/ark-scene/islands/town/sampler");
const {townWorldOrigin} = await import("@/ark-scene/islands");
const {townZooBeds} = await import("@/ark-scene/islands/town/zoo-beds");
const {displayLength} = await import("@/ark-scene/sizes");
const {arkRepresentatives, ARK_HERD_LIVE} = await import("@/ark-scene/herds");
const {ARK_LIVE_BUDGET, arkOutside, arkWithinCapacity, arkZoneCapacity} = await import("@/ark-scene/live-budget");

type ArkAnimal = import("@/ark-scene/types").ArkAnimal;
type ScheduleAnimal = import("@/ark-scene/behaviour-schedule").ScheduleAnimal;
type Profile = import("@/ark-scene/behaviour-profile").ArkBehaviourProfile;
type ScheduleWorld = import("@/ark-scene/behaviour-schedule").ScheduleWorld;
type ScheduleGroup = import("@/ark-scene/behaviour-schedule").ScheduleGroup;

const raw = JSON.parse(readFileSync(arg("snapshot", "/Users/lennybeadle/AnimalDex-work/ark-perf-web/real/voyage.json"), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw)!;
const T = Number(arg("from", String(Math.floor(Date.UTC(2026, 10, 27, 3, 0, 0) / 1000))));
const townSchedsOn = arg("town-scheds", "on") === "on";
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

const wildAnimals = arkIslandSnapshot(snapshot, "wild").animals;
const townAnimals = arkIslandSnapshot(snapshot, "town").animals;
const townIds = new Set(townAnimals.map((a) => a.id));

// ---- T1: town places from partial join lists vs the whole list ----
const t1 = (() => {
    const whole = placeTownAnimals(townAnimals);
    const open = whole.open;
    const out: Record<string, {batches: number; animalsCompared: number; placeDiffs: number; infoDiffs: number; maxMetres: number}> = {};
    for (const size of [450, 150]) {
        let compared = 0, placeDiffs = 0, infoDiffs = 0, maxM = 0, batches = 0;
        for (let n = size; n < townAnimals.length; n += size) {
            batches++;
            const part = [...wildAnimals, ...townAnimals.slice(0, n)].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at)).filter((a) => townIds.has(a.id));
            const got = placeTownAnimals(part, open);
            got.places.forEach((p, id) => {
                const w = whole.places.get(id);
                compared++;
                if (!w) {
                    placeDiffs++;
                    return;
                }
                if (p.x !== w.x || p.z !== w.z || p.ground !== w.ground || p.yaw !== w.yaw) {
                    placeDiffs++;
                    maxM = Math.max(maxM, Math.hypot(p.x - w.x, p.z - w.z));
                }
                const a = got.town.get(id), b = whole.town.get(id);
                if (JSON.stringify({r: a?.range, e: a?.enclosure?.id, pen: a?.pen, w: a?.where, s: a?.still}) !== JSON.stringify({r: b?.range, e: b?.enclosure?.id, pen: b?.pen, w: b?.where, s: b?.still})) infoDiffs++;
            });
        }
        out[`batch${size}`] = {batches, animalsCompared: compared, placeDiffs, infoDiffs, maxMetres: +maxM.toFixed(3)};
    }
    return out;
})();

// ---- Both islands' worlds (as the schedule rig builds them) ----
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
const worldOf = (animal: {id: string}): ScheduleWorld => (townIds.has(animal.id) ? townWorld : wildWorld);
type Place = {x: number; z: number; ground: number; leader?: string | null; rank?: number};
const allPlaces = new Map<string, Place>();
wildPlaces.forEach((p, id) => allPlaces.set(id, p));
placed.places.forEach((p, id) => allPlaces.set(id, {...p, x: p.x + origin.x, z: p.z + origin.z}));
const snapshotById = new Map(snapshot.animals.map((a) => [a.id, a]));

// ---- The roster (index.ts setSnapshot: representatives, capacity, the live budget at a step; held town pinned) ----
const rosterOf = (animals: ArkAnimal[], from: number): ArkAnimal[] => {
    const held = (a: ArkAnimal) => {
        const info = towned.get(a.id);
        return Boolean(info && (info.tank || info.display || info.where === "indoor" || info.where === "window"));
    };
    const pins = new Set<string>(animals.filter((a) => townIds.has(a.id) && held(a)).map((a) => a.id));
    const reps = arkRepresentatives(animals, {pinned: pins, live: ARK_HERD_LIVE});
    let candidates = animals.filter((a) => reps.live.has(a.id)).map((a) => ({id: a.id, group: a.species_profile_id || `slug:${a.model_slug}`, zone: townIds.has(a.id) ? "town" : a.zone}));
    const capacity = animals.length >= 1000 ? arkZoneCapacity() : null;
    if (capacity) candidates = arkWithinCapacity(candidates, capacity, from, pins);
    const outside = arkOutside(candidates, ARK_LIVE_BUDGET.high, from, pins);
    return animals.filter((a) => reps.live.has(a.id) && outside.has(a.id));
};

// ---- Entries kept across wirings, as setSnapshot keeps them (the sched object survives) ----
type Sched = {animal: ScheduleAnimal; profile: Profile};
type Entry = {animal: ArkAnimal; place: Place; length: number; sched: Sched | null; leader: Entry | null};
const makeSched = (animal: ArkAnimal, place: Place, length: number, entryById: Map<string, Entry>): Sched | null => {
    if (!onSchedule(place as never, animal.model_slug) || !onBehaviourSchedule(animal.model_slug)) return null;
    const inTown = townIds.has(animal.id);
    if (inTown && (!townSchedsOn || !townScheduled(animal.id))) return null;
    const sea = !inTown && ZONE_SITES[animal.zone]?.kind === "sea";
    const info = towned.get(animal.id);
    const keep = inTown ? (info?.pen ? penKeep(info.pen, info.penMargin ?? 0, origin.x, origin.z) : info?.enclosure?.mask && info.enclosureMargin !== undefined ? penKeep(maskBox(info.enclosure.mask), info.enclosureMargin, origin.x, origin.z) : null) : null;
    return {
        animal: withLazyRoost({id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea, thrive: arkThriveOf(animal), sleep: arkSleepOf(animal), condition: animal.condition ?? null, ...(inTown ? {range: info ? Math.max(info.range, 0.6) * 1.5 : null, kept: true, keep, bed: beds.get(animal.id) ?? null, mates: () => [] as never[]} : {})} as never, () => (inTown ? null : scheduleRoost(place as never, animal.zone))),
        profile: behaviourProfile(animal.model_slug, planOf(animal.model_slug))
    };
};
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
type State = {entryById: Map<string, Entry>; spacingMs: number; spacings: number};
const newState = (): State => ({entryById: new Map(), spacingMs: 0, spacings: 0});
/** setSnapshot + wireSchedules for a roster; `apply` false: the spacing is superseded before it lands (writes nothing). */
const wire = (state: State, roster: ArkAnimal[], apply = true) => {
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
        const e: Entry = {animal, place, length: body.display * sexLook(animal.id, animal.model_slug).scale, sched: null, leader: null};
        next.set(animal.id, e);
    }
    state.entryById = next;
    next.forEach((e) => {
        if (!e.sched) e.sched = makeSched(e.animal, e.place, arkBody(e.animal, planOf(e.animal.model_slug)).display, next);
    });
    next.forEach((e) => (e.leader = e.place.leader && e.place.leader !== e.animal.id ? next.get(e.place.leader) ?? null : null));
    const onIt = Array.from(next.values()).filter((e) => e.sched);
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
        if (s === undefined) standIns.set(id, (s = makeSched(animal, place, arkBody(animal, planOf(animal.model_slug)).display, next)));
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
    state.spacingMs += performance.now() - t;
    state.spacings++;
    if (!apply) return;
    for (const e of onIt) {
        const own = e.sched!;
        own.animal.group = groups.get(e) ?? null;
        const moved = spaced.get(e.animal.id);
        if (moved) {
            own.animal.home = {x: moved.home.x, y: Math.max(worldOf(e.animal).sampler.heightAt(moved.home.x, moved.home.z), 0), z: moved.home.z};
            own.animal.range = moved.range === null ? null : sizes.has(e) ? moved.range / 2 : moved.range;
            own.animal.prey = moved.prey;
        }
    }
    for (const e of onIt) {
        const lead = e.sched!.animal.group?.leader;
        if (!lead || !e.leader || !spaced.has(e.leader.animal.id)) continue;
        e.sched!.animal.home = {...lead.home};
        e.sched!.animal.range = lead.range;
    }
};
type Homes = Map<string, {x: number; z: number; range: number | null | undefined; prey: string}>;
const homesOf = (state: State): Homes => {
    const out: Homes = new Map();
    state.entryById.forEach((e, id) => {
        if (!e.sched) return;
        const a = e.sched.animal;
        out.set(id, {x: a.home.x, z: a.home.z, range: a.range, prey: a.prey ? `${a.prey.x},${a.prey.z}` : ""});
    });
    return out;
};
const compare = (a: Homes, b: Homes) => {
    let both = 0, homeDiffs = 0, rangeDiffs = 0, preyDiffs = 0, maxM = 0;
    const slugs = new Map<string, number>();
    a.forEach((h, id) => {
        const o = b.get(id);
        if (!o) return;
        both++;
        const moved = h.x !== o.x || h.z !== o.z;
        if (moved) {
            homeDiffs++;
            maxM = Math.max(maxM, Math.hypot(h.x - o.x, h.z - o.z));
        }
        if (h.range !== o.range) rangeDiffs++;
        if (h.prey !== o.prey) preyDiffs++;
        if (moved || h.range !== o.range) {
            const slug = snapshotById.get(id)!.model_slug;
            slugs.set(slug, (slugs.get(slug) ?? 0) + 1);
        }
    });
    return {inBoth: both, homeDiffs, rangeDiffs, preyDiffs, maxMetres: +maxM.toFixed(2), kinds: Array.from(slugs.entries()).sort((x, y) => y[1] - x[1]).slice(0, 8)};
};

const all = snapshot.animals;
const RT = rosterOf(all, T);
const RTprev = rosterOf(all, T - 300);
// F
const F = newState();
wire(F, RT);
const hF = homesOf(F);
let shrunk = 0;
hF.forEach((h, id) => {
    if (h.range !== undefined && h.range !== null && !townIds.has(id)) shrunk++;
});
// I
const I = newState();
wire(I, RT);
wire(I, RT);
// R
const R = newState();
wire(R, RTprev);
wire(R, RT);
// Join sequences
const joinPart = (n: number) => [...wildAnimals, ...townAnimals.slice(0, n)].sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));
const joinSeq = (size: number, applyEach: boolean) => {
    const s = newState();
    wire(s, rosterOf(wildAnimals, T));
    for (let n = size; n < townAnimals.length; n += size) wire(s, rosterOf(joinPart(n), T), applyEach);
    wire(s, RT);
    return s;
};
const J = joinSeq(450, true);
const J0 = joinSeq(450, false);
const Jb = joinSeq(150, true);

console.log(JSON.stringify({
    snapshot: {animals: all.length, wild: wildAnimals.length, town: townAnimals.length},
    from: T,
    townScheds: townSchedsOn,
    worldsBuildMs: Math.round(worldsMs),
    rosterAtT: RT.length,
    rosterAtTprev: RTprev.length,
    rosterOverlap: RT.filter((a) => RTprev.some((b) => b.id === a.id)).length,
    spacingMsEach: +(F.spacingMs / F.spacings).toFixed(1),
    predatorsShrunkInF: shrunk,
    T1_townPartialPlaces: t1,
    I_vs_F: compare(homesOf(I), hF),
    R_vs_F: compare(homesOf(R), hF),
    J_vs_F: compare(homesOf(J), hF),
    J0_vs_F: compare(homesOf(J0), hF),
    J_vs_J0: compare(homesOf(J), homesOf(J0)),
    Jb_vs_J: compare(homesOf(Jb), homesOf(J))
}, null, 1));
