/**
 * Where each town animal stands (brief Part C, "Animals on the town island"; islands plan §3–§5): on the town's
 * placement spots (`areas.ts`), by the server's `area` and `enclosure`, and for wildlife by its kind's town niche.
 *
 * - **House** (pets, protected): its household (`householdOf`, a rendezvous hash: adding animals never moves anyone),
 *   one of that home's outdoor spots (garden, yard, balcony, the block's courtyard), or its window when it is kept
 *   indoors (fish, caged birds, small reptiles and rodents, invertebrates).
 * - **Farm** (livestock, protected): its farm (`farmOf`), the paddock for grazers, the run for poultry, else the yard.
 * - **Zoo** (protected): its enclosure's spots inside the mask (`zooSpotsFor` for the open enclosures), the pool for
 *   swimmers; an enclosure past every plot shares its type's last plot (decision 23).
 * - **Town wildlife** (area null): its kind's niche (`urbanNiche`: peregrines on the tall tops, rats at bins and drains,
 *   gulls on roofs and the quay, ducks on the canal…, else by its zone), a cluster per the server's zone slot (a group
 *   species' members about its first), spots by body size.
 *
 * Every spot is chosen by a rendezvous hash of the animal's id (a cluster's key for wildlife) over the candidates, so a
 * spot is a pure function of the plan, the animal and its server fields: the same for every viewer, never moved by
 * who else is aboard. The result is the scene's own `Placement` (the same schedule and motion pass as the wild
 * island), with the town's facts beside it (`TownPlace`) for the schedule's range and the zoo's hard bounds.
 */

import {arkBody} from "@/ark-scene/stats";
import type {Placement} from "@/ark-scene/placement";
import type {ArkAnimal} from "@/ark-scene/types";
import {hashText, hashTextOn, hashTextPrefix, inPoly, type Poly} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townHouseholds, farmOf, householdOf, urbanNiche, zooLayout, zooSpotsFor, townAreas, type Household, type SpotWhere, type TownSpot, type ZooEnclosure, type TownArea} from "@/ark-scene/islands/town/areas";
import {launchEnclosures, enclosuresIn} from "@/ark-scene/islands/town/areas";
import {ZOO_ENCLOSURE_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";
import {zooTypeOfSlug} from "@/ark-scene/islands/routing";
import {modelBase} from "@/ark-scene/grounding/base";
import {aquariumTankOf, aquariumTanks, displaySpot, displayTank, homeKeeping, homeSiteFootprints, homeSites, inTownSolid as inBuilding, nearTownSolids as nearSolids, perchesInCage, zooHouseFrame, ZOO_HOUSE_TYPES, type HomeDisplay, type HomeKeeping, type Tank} from "@/ark-scene/islands/town/tanks";
import {inBox, toLocal, type Box} from "@/ark-scene/islands/town/geom";

/** The town's facts about a placed animal: its area, the spot's kind, the home, farm or enclosure, and its bounds. */
export type TownPlace = {
    area: TownArea;
    where: SpotWhere;
    /** The household, farm, enclosure or habitat it belongs to. */
    place: string;
    /** In the zoo: its enclosure (hard bounds: the mask, 0.4 m inside the fence). */
    enclosure: ZooEnclosure | null;
    /** How far from its spot it may roam (m): a garden, a paddock, the enclosure's inner radius. */
    range: number;
    /** Kept still at its spot (indoors behind a window or the glass, a tank, a high perch). */
    still: boolean;
    /** Lane TB: the tank it swims in (an aquarium's, a home's or a garden pond: `tanks.ts` tankPose). */
    tank?: Tank;
    /** Lane TB: a home pet's display (its tank, cage, vivarium or pond in the garden room, on the balcony or patio). */
    display?: HomeDisplay;
    /** Lane TB: how a home's pet is kept (`tanks.ts` homeKeeping). */
    keeping?: HomeKeeping;
};

export type TownPlacements = {places: Map<string, Placement>; town: Map<string, TownPlace>; open: string[]};

const SWIMMER = /fish|shark|(^|-)ray(-|$)|manta|herring|salmon|trout|carp|koi|goldfish|betta|guppy|tetra|cichlid|molly|platy|danio|barb|gourami|pleco|loach|oscar|discus|arowana|clownfish|tang|wrasse|eel|octopus|squid|jellyfish|seahorse|dolphin|seal|sea-lion|penguin|otter|turtle|axolotl|newt|frog|toad|shrimp|crab|lobster|snail|whale|dugong|manatee/;
const POULTRY = /chicken|duck|goose|turkey|quail|guinea-?fowl|pigeon|peafowl/;
const GRAZER = /cow|cattle|horse|donkey|pony|sheep|goat|alpaca|llama|buffalo|yak|pig|deer|camel/;

function sizeOf(length: number): "small" | "medium" | "large" {
    return length < 0.35 ? "small" : length < 1.5 ? "medium" : "large";
}

/** The rendezvous pick: the candidate with the highest hash of (key, its index). Stable as candidates are added elsewhere. */
function pick<T>(list: readonly T[], key: string, label: (item: T, index: number) => string): T | null {
    let best: T | null = null;
    let bestScore = -1;
    // (`hashText(`${key}|${label}`)`, the key's part hashed once.)
    const prefix = hashTextPrefix(`${key}|`);
    list.forEach((item, index) => {
        const score = hashTextOn(prefix, label(item, index));
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    });
    return best;
}

/** A small seeded step off a shared spot (m), so animals sharing one stand side by side, never in one another. */
function offset(id: string, length: number, rank: number): {dx: number; dz: number} {
    const h = hashText(`${id}#off`);
    const a = ((h >>> 3) % 6283) / 1000;
    const r = rank === 0 && (h & 7) < 3 ? 0 : Math.max(length * 1.1, 0.35) * (0.8 + ((h >>> 11) % 100) / 120) * Math.sqrt(Math.max(rank, 1));
    return {dx: Math.cos(a) * r, dz: Math.sin(a) * r};
}

/** A point kept inside a polygon (pulled back towards its centre until inside). */
function inside(poly: Poly | null, x: number, z: number, cx: number, cz: number): {x: number; z: number} {
    if (!poly || inPoly(poly, x, z)) return {x, z};
    for (let t = 0.8; t > 0; t -= 0.2) {
        const px = cx + (x - cx) * t;
        const pz = cz + (z - cz) * t;
        if (inPoly(poly, px, pz)) return {x: px, z: pz};
    }
    return {x: cx, z: cz};
}

function inradius(poly: Poly): number {
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const p of poly) {
        x0 = Math.min(x0, p.x);
        z0 = Math.min(z0, p.z);
        x1 = Math.max(x1, p.x);
        z1 = Math.max(z1, p.z);
    }
    // (Masks are boxes, maybe turned: half the shorter side of the axis box is near enough, and never more.)
    const a = Math.hypot(poly[1].x - poly[0].x, poly[1].z - poly[0].z);
    const b = Math.hypot(poly[2].x - poly[1].x, poly[2].z - poly[1].z);
    return Math.max(Math.min(a, b, x1 - x0, z1 - z0) / 2 - 0.4, 0.6);
}

const WATER_WHERE = new Set<SpotWhere>(["canal", "millpond", "farm_pond", "pool"]);
const HIGH_WHERE = new Set<SpotWhere>(["roof", "eave", "ledge", "tall", "belfry", "balcony", "window", "lamp_wall"]);

/**
 * Every town animal's place. `animals` is the town island's slice of the read (`voyage_public_v3('town')`); the open
 * enclosures are the snapshot's own names (the plan's 26 at launch until the server sends any).
 */
/** Each animal's own spot and step off it, by its fields and the open enclosures (remembered across snapshots). */
const MEMO = new Map<string, {placement: Placement; info: TownPlace; rank: number}>();

/** Placements worked out elsewhere (the town's prebuild worker, decision 153), for exactly this list. */
let primed: {key: string; result: TownPlacements} | null = null;
export function townPlacementKey(animals: readonly ArkAnimal[]): string {
    return animals.map((a) => `${a.id}|${a.area ?? ""}|${a.enclosure ?? ""}|${a.slot ?? ""}|${a.slot_rank ?? ""}|${a.zone}|${a.model_slug}`).join("\n");
}
export function primeTownPlacements(key: string, result: TownPlacements, animals?: readonly ArkAnimal[]): void {
    primed = {key, result};
    // Each animal's own spot remembered too, so any part of the list (the town's animals joining a few at a time) is free.
    if (!animals) return;
    const openKey = result.open.join(",");
    for (const animal of animals) {
        const placement = result.places.get(animal.id);
        const info = result.town.get(animal.id);
        if (!placement || !info) continue;
        const own = hashText(animal.id);
        const rank = animal.area === "zoo" ? 1 + ((own >>> 7) % 4) : !animal.area ? animal.slot_rank ?? 0 : (own >>> 9) % 3;
        const core: Placement = {...placement};
        delete core.leader;
        delete core.rank;
        MEMO.set(`${openKey}|${animal.id}|${animal.area ?? ""}|${animal.enclosure ?? ""}|${animal.slot ?? ""}|${animal.slot_rank ?? ""}|${animal.zone}|${animal.model_slug}`, {placement: core, info, rank});
    }
}

export function placeTownAnimals(animals: readonly ArkAnimal[], openAs?: readonly string[]): TownPlacements {
    if (primed) {
        const hit = primed.key === townPlacementKey(animals) ? primed.result : null;
        if (hit) {
            primed = null;
            return hit;
        }
    }
    // (`openAs`: the enclosures open for the whole town while only some of its animals are laid out: they join a few at a time.)
    const open = openAs ? [...openAs] : enclosuresIn(animals);
    const openNames = open.length ? open : launchEnclosures();
    const layout = zooLayout(openNames);
    const enclosures = new Map(layout.enclosures.map((e) => [e.id, e] as [string, ZooEnclosure]));
    const zooSpots = new Map<string, TownSpot[]>();
    for (const s of zooSpotsFor(openNames)) {
        let list = zooSpots.get(s.place);
        if (!list) zooSpots.set(s.place, (list = []));
        list.push(s);
    }
    const all = townAreas().spots;
    const byPlace = new Map<string, TownSpot[]>();
    const byWhere = new Map<SpotWhere, TownSpot[]>();
    for (const s of all) {
        if (s.area === "zoo") continue;
        let list = byPlace.get(s.place);
        if (!list) byPlace.set(s.place, (list = []));
        list.push(s);
        if (s.area === "garden_wildlife" || s.area === "urban_wildlife") {
            let w = byWhere.get(s.where);
            if (!w) byWhere.set(s.where, (w = []));
            w.push(s);
        }
    }
    const households: Household[] = townHouseholds();
    const places = new Map<string, Placement>();
    const town = new Map<string, TownPlace>();
    // The town's wildlife clusters (the server's zone slot): the first one's spot, the rest about it.
    const clusters = new Map<string, {leader: string; rank: number; count: number}>();
    for (const animal of animals) {
        if (animal.area) continue;
        const key = clusterKey(animal);
        const rank = animal.slot_rank ?? 0;
        const c = clusters.get(key);
        if (!c) clusters.set(key, {leader: animal.id, rank, count: 1});
        else {
            c.count++;
            if (rank < c.rank || (rank === c.rank && animal.id < c.leader)) Object.assign(c, {leader: animal.id, rank});
        }
    }
    // A zoo enclosure's kinds: the first of each kind leads the rest of its kind there.
    const zooLeads = new Map<string, {leader: string; at: string; count: number}>();
    for (const animal of animals) {
        if (animal.area !== "zoo") continue;
        const key = `${animal.enclosure ?? ""}|${animal.kind_species_profile_id ?? animal.species_profile_id}`;
        const c = zooLeads.get(key);
        if (!c) zooLeads.set(key, {leader: animal.id, at: animal.arrived_at, count: 1});
        else {
            c.count++;
            if (animal.arrived_at < c.at || (animal.arrived_at === c.at && animal.id < c.leader)) Object.assign(c, {leader: animal.id, at: animal.arrived_at});
        }
    }
    const clusterSpots = new Map<string, TownSpot | null>();
    const openKey = openNames.join(",");
    if (MEMO.size > 20000) MEMO.clear();
    for (const animal of animals) {
        // Who it keeps to (a zoo kind's first in its enclosure; a wildlife cluster's first): the only part that depends on
        // who else is aboard, worked out fresh. Its spot and its step off it are its own (remembered across snapshots).
        let leader: string | undefined;
        if (animal.area === "zoo") {
            const lead = zooLeads.get(`${animal.enclosure ?? ""}|${animal.kind_species_profile_id ?? animal.species_profile_id}`);
            if (lead && lead.count > 1) leader = lead.leader;
        } else if (!animal.area) {
            const cluster = clusters.get(clusterKey(animal));
            if (cluster && cluster.count > 1) leader = cluster.leader;
        }
        const memoKey = `${openKey}|${animal.id}|${animal.area ?? ""}|${animal.enclosure ?? ""}|${animal.slot ?? ""}|${animal.slot_rank ?? ""}|${animal.zone}|${animal.model_slug}`;
        const hit = MEMO.get(memoKey);
        if (hit) {
            const placement: Placement = {...hit.placement};
            if (leader) {
                placement.leader = leader;
                placement.rank = leader === animal.id ? 0 : hit.rank;
            }
            places.set(animal.id, placement);
            town.set(animal.id, hit.info);
            continue;
        }
        const length = arkBody(animal).metres;
        const size = sizeOf(length);
        const slug = animal.model_slug;
        const own = hashText(animal.id);
        const yaw = ((own >>> 4) % 6283) / 1000;
        let spot: TownSpot | null = null;
        let info: TownPlace;
        let rank = 0;
        let held: {x: number; z: number; y: number; yaw: number} | null = null;
        const plan = modelBase(slug)?.plan ?? null;
        const keeping: HomeKeeping | null = animal.area === "house" ? homeKeeping(slug, animal.zone, length, plan) : null;
        if (animal.area === "house" && keeping !== "livery") {
            // Lane TB: how it is kept (`tanks.ts` homeKeeping). A pond is a house's; a long pet's vivarium or tank a house's
            // or a terrace home's (a flat's are small); a cage, a small vivarium or tank may be a flat's.
            const display = keeping === "tank" || keeping === "cage" || keeping === "vivarium" || keeping === "pond";
            const flatOk = display && keeping !== "pond" && length < 0.55;
            // (Its display at a home: the pond, else the tank; the cage or vivarium only where it fits in, body and all.)
            const displayAt = (h: Household): HomeDisplay | null => {
                const site = homeSitesNow().get(h.id);
                if (!site) return null;
                const want = keeping === "pond" ? site.displays.pond ?? site.displays.tank : site.displays[keeping as "tank" | "cage" | "vivarium"];
                return want && length + (want.form === "tank" || want.form === "pond" ? 0.12 : 0.04) <= want.w ? want : null;
            };
            // (The rendezvous order of homes, the first where its display holds it: the same for every viewer, never moved by others.)
            const home = display ? homeInOrder(animal.id, flatOk, households, (h) => displayAt(h) !== null) : householdOf(animal.id, false, households);
            const shown = display ? displayAt(home) : null;
            if (shown) {
                const perched = shown.form === "cage" && perchesInCage(slug, plan);
                held = shown.form === "tank" || shown.form === "pond" ? {x: shown.x, z: shown.z, y: shown.floor, yaw} : displaySpot(shown, animal, length, perched);
                info = {area: "house", where: "window", place: home.id, enclosure: null, range: 0, still: true, display: shown, keeping: keeping!, ...(shown.form === "tank" || shown.form === "pond" ? {tank: displayTank(shown)} : {})};
                rank = 0;
            } else {
                // Outdoors: the home's garden, yard, balcony or courtyard (never in its garden room's or pond's footprint).
                const homeSpots = (byPlace.get(home.id) ?? []).concat(home.kind === "flat" ? byPlace.get(home.building) ?? [] : []).filter((s) => s.area === "house" && !inSite(s.x, s.z) && (s.where === "balcony" || !inBuilding(s.x, s.z, 0.3)));
                const list = homeSpots.filter((s) => s.where !== "window");
                spot = pick(list.length ? list : homeSpots, animal.id, (s, i) => `${s.where}${i}`);
                info = {area: "house", where: spot?.where ?? "lawn", place: home.id, enclosure: null, range: spot?.where === "balcony" ? 0.6 : spot?.where === "yard" ? 2.5 : 5, still: false, keeping: keeping ?? "outdoors"};
                rank = (own >>> 9) % 3;
            }
        } else if (animal.area === "farm" || keeping === "livery") {
            const farm = farmOf(animal.id);
            const farmSpots = (byPlace.get(farm) ?? []).filter((s) => s.area === "farm" && !inBuilding(s.x, s.z, 0.3));
            const want: SpotWhere = POULTRY.test(slug) ? "run" : GRAZER.test(slug) || size === "large" ? "paddock" : "farmyard";
            const list = farmSpots.filter((s) => s.where === want);
            spot = pick(list.length ? list : farmSpots, animal.id, (s, i) => `${s.where}${i}`);
            // (Lane TB: a horse, a cow, a donkey or a pig routed to a home is kept at a farm's paddock: livery.)
            info = {area: "farm", where: spot?.where ?? want, place: farm, enclosure: null, range: want === "paddock" ? 9 : want === "run" ? 3 : 5, still: false, ...(keeping === "livery" ? {keeping} : {})};
            rank = (own >>> 9) % 3;
        } else if (animal.area === "zoo") {
            const type = enclosureTypeOf(animal);
            const named = animal.enclosure && enclosures.get(animal.enclosure);
            const enclosure = named || layout.enclosures.find((e) => e.type === type) || null;
            const host = enclosure ? (enclosure.shared ? layout.enclosures.find((e) => !e.shared && e.slot.id === enclosure.slot.id) ?? enclosure : enclosure) : null;
            const inner = host ? zooSpots.get(host.id) ?? [] : [];
            const swims = SWIMMER.test(slug);
            const list = inner.filter((s) => (swims && host?.pool ? s.where === "pool" : s.where !== "pool" || !host?.pool));
            spot = pick(list.length ? list : inner, animal.id, (s, i) => `${s.where}${i}`);
            // (Its step off the spot never depends on who leads: a leader leaving moves nobody.)
            rank = 1 + ((own >>> 7) % 4);
            info = {area: "zoo", where: spot?.where ?? "enclosure", place: enclosure?.id ?? `${type}-1`, enclosure: host, range: host ? inradius(host.mask) : 2, still: Boolean(host?.indoor) && length < 0.25};
            if (host && host.type === "aquarium") {
                // Lane TB: an aquarium resident swims in its tank (`tanks.ts`), never on the hall's floor.
                const tank = aquariumTankOf(animal, length, tanksOf(host));
                if (tank) {
                    info = {...info, where: "indoor", still: true, tank};
                    held = {x: tank.x, z: tank.z, y: tank.floor, yaw};
                }
            } else if (host && host.indoor && ZOO_HOUSE_TYPES.has(host.type) && spot) {
                // Lane TB: inside a zoo house, on its floor, its whole body within the walls (half its length in from them).
                const f = zooHouseFrame(host);
                const at = keepInside(f.inner, spot.x, spot.z, Math.min(length * 0.5 + 0.15, Math.min(f.inner.w, f.inner.d) / 2 - 0.05));
                held = {x: at.x, z: at.z, y: f.floor, yaw};
                info = {...info, where: "indoor", still: true};
            }
        } else {
            const key = clusterKey(animal);
            const wheres = urbanNiche(slug, animal.zone);
            // (Lane TB: a spot on the ground never in a building's footprint: some gardens and bins lie under a block of flats.)
            const onGround = (s: TownSpot) => HIGH_WHERE.has(s.where) || !inBuilding(s.x, s.z, 0.3);
            const candidates = wheres.flatMap((w) => byWhere.get(w) ?? []).filter((s) => s.sizes.includes(size) && onGround(s));
            const list = candidates.length ? candidates : wheres.flatMap((w) => byWhere.get(w) ?? []).filter(onGround);
            // The cluster's members share their first one's spot (the server's slot): picked by the cluster's key.
            const memo = `${key}|${slug}|${size}`;
            if (!clusterSpots.has(memo)) clusterSpots.set(memo, pick(list, `${key}|${slug}`, (s, i) => `${s.place}${s.where}${i}`));
            spot = clusterSpots.get(memo)!;
            // (Its place in its cluster is the server's rank, whoever else is there.)
            rank = animal.slot_rank ?? 0;
            const area: TownArea = spot?.area ?? "garden_wildlife";
            info = {area, where: spot?.where ?? "park", place: spot?.place ?? "park", enclosure: null, range: HIGH_WHERE.has(spot?.where ?? "park") ? 1.5 : 8, still: false};
        }
        const base = held ? {x: held.x, y: held.y, z: held.z, where: info.where} : spot ?? {x: 0, y: 2.6, z: 0, where: "park" as SpotWhere};
        const off = held || info.still || HIGH_WHERE.has(base.where) ? {dx: 0, dz: 0} : offset(animal.id, length, rank);
        const bound = held ? null : info.enclosure?.mask ?? null;
        let at = inside(bound, base.x + off.dx, base.z + off.dz, base.x, base.z);
        // (Lane TB: on the ground, its body clear of every building's wall and every garden room and pond.)
        if (!held && !HIGH_WHERE.has(base.where) && base.where !== "pool") at = inside(bound, ...clearOf(at.x, at.z, Math.min(Math.max(length * 0.45, 0.12), 1.6)), base.x, base.z);
        // (In the town every water is above the sea: a pool, the canal, a pond. The scene's water pose works from the sea's
        // level, so a swimmer here floats at its spot's surface, on its own ground: `water` stays false.)
        // (A raised pool's water is 0.45 m over the highest ground at its rim: a swimmer floats there, not under the rim.)
        const pool = base.where === "pool" && info.enclosure?.pool ? Math.max(...info.enclosure.pool.map((q) => townHeight(q.x, q.z))) + 0.45 : null;
        const placement: Placement = {x: at.x, z: at.z, ground: pool ?? base.y, yaw: held ? held.yaw : yaw, water: false, sea: false};
        MEMO.set(memoKey, {placement: {...placement}, info, rank});
        void WATER_WHERE;
        if (leader && leader !== animal.id) {
            placement.leader = leader;
            placement.rank = rank;
        } else if (leader) {
            placement.leader = leader;
            placement.rank = 0;
        }
        places.set(animal.id, placement);
        town.set(animal.id, info);
    }
    return {places, town, open: openNames};
}

function clusterKey(animal: ArkAnimal): string {
    return typeof animal.slot === "number" ? `${animal.zone}#${animal.slot}` : `id#${animal.id}`;
}

function enclosureTypeOf(animal: ArkAnimal): ZooEnclosureType {
    const named = animal.enclosure ? animal.enclosure.slice(0, animal.enclosure.lastIndexOf("-")) : "";
    return (ZOO_ENCLOSURE_TYPES as readonly string[]).includes(named) ? (named as ZooEnclosureType) : zooTypeOfSlug(animal.model_slug);
}

// MARK: - Lane TB: tanks, displays, the zoo houses

const tankMemo = new Map<string, Tank[]>();
/** An aquarium enclosure's tanks (memo by its id and plot). */
function tanksOf(e: ZooEnclosure): Tank[] {
    const key = `${e.id}|${e.slot.id}`;
    let tanks = tankMemo.get(key);
    if (!tanks) tankMemo.set(key, (tanks = aquariumTanks(e)));
    return tanks;
}

let sitesMemo: ReturnType<typeof homeSites> | null = null;
let footprints: Box[] | null = null;
function homeSitesNow(): ReturnType<typeof homeSites> {
    return (sitesMemo ??= homeSites(townHouseholds()));
}
/** Within a garden room's or a garden pond's footprint (the plan's, whether or not anyone lives in it). */
function inSite(x: number, z: number): boolean {
    footprints ??= homeSiteFootprints(townHouseholds());
    for (const b of footprints) if (inBox(b, x, z, 0.35)) return true;
    return false;
}

/** A point kept inside a box, `margin` in from its sides. */
function keepInside(b: Box, x: number, z: number, margin: number): {x: number; z: number} {
    const l = toLocal(b, x, z);
    const hx = Math.max(b.w / 2 - margin, 0);
    const hz = Math.max(b.d / 2 - margin, 0);
    const lx = Math.min(Math.max(l.x, -hx), hx);
    const lz = Math.min(Math.max(l.z, -hz), hz);
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    return {x: b.x + lx * c - lz * s, z: b.z + lx * s + lz * c};
}

/** The first home in the animal's rendezvous order (`householdOf`'s hash) that `ok` accepts; else its first. */
function homeInOrder(animalId: string, flatsToo: boolean, households: Household[], ok: (h: Household) => boolean): Household {
    const prefix = hashTextPrefix(`${animalId}|`);
    const ranked = households.filter((h) => flatsToo || h.kind !== "flat").map((h) => ({h, score: hashTextOn(prefix, h.id)}));
    ranked.sort((a, b) => b.score - a.score);
    for (const {h} of ranked) if (ok(h)) return h;
    return ranked[0]?.h ?? households[0];
}

/** A point pushed out until it is `radius` clear of every building, garden room and pond (out the nearest side). */
function clearOf(x: number, z: number, radius: number): [number, number] {
    let px = x;
    let pz = z;
    for (let round = 0; round < 3; round++) {
        let moved = false;
        for (const b of nearSolids(px, pz)) {
            const l = toLocal(b, px, pz);
            const qx = Math.abs(l.x) - b.w / 2;
            const qz = Math.abs(l.z) - b.d / 2;
            if (qx >= radius || qz >= radius) continue;
            // Out through the side it is nearest.
            let lx = l.x;
            let lz = l.z;
            if (qx > qz) lx = Math.sign(l.x || 1) * (b.w / 2 + radius + 0.01);
            else lz = Math.sign(l.z || 1) * (b.d / 2 + radius + 0.01);
            const c = Math.cos(b.rot);
            const s = Math.sin(b.rot);
            px = b.x + lx * c - lz * s;
            pz = b.z + lx * s + lz * c;
            moved = true;
        }
        if (!moved) break;
    }
    return [px, pz];
}
