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
import {hashText, inPoly, type Poly} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townHouseholds, farmOf, householdOf, urbanNiche, zooLayout, zooSpotsFor, townAreas, type Household, type SpotWhere, type TownSpot, type ZooEnclosure, type TownArea} from "@/ark-scene/islands/town/areas";
import {launchEnclosures, enclosuresIn} from "@/ark-scene/islands/town/areas";
import {ZOO_ENCLOSURE_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";
import {zooTypeOfSlug} from "@/ark-scene/islands/routing";

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
};

export type TownPlacements = {places: Map<string, Placement>; town: Map<string, TownPlace>; open: string[]};

const SWIMMER = /fish|shark|(^|-)ray(-|$)|manta|herring|salmon|trout|carp|koi|goldfish|betta|guppy|tetra|cichlid|molly|platy|danio|barb|gourami|pleco|loach|oscar|discus|arowana|clownfish|tang|wrasse|eel|octopus|squid|jellyfish|seahorse|dolphin|seal|sea-lion|penguin|otter|turtle|axolotl|newt|frog|toad|shrimp|crab|lobster|snail|whale|dugong|manatee/;
const KEPT_INDOORS = /fish|goldfish|betta|guppy|tetra|cichlid|molly|platy|danio|gourami|pleco|loach|koi|axolotl|budgerigar|budgie|canary|cockatiel|parakeet|lovebird|finch|parrot|conure|macaw|hamster|gerbil|mouse|(^|-)rat(-|$)|chinchilla|degu|gecko|bearded-dragon|dragon|chameleon|snake|python|corn-snake|tortoise|turtle|terrapin|tarantula|spider|scorpion|mantis|stick-insect|snail|shrimp|crab|frog|toad|newt|salamander|hermit/;
const POULTRY = /chicken|duck|goose|turkey|quail|guinea-?fowl|pigeon|peafowl/;
const GRAZER = /cow|cattle|horse|donkey|pony|sheep|goat|alpaca|llama|buffalo|yak|pig|deer|camel/;

function sizeOf(length: number): "small" | "medium" | "large" {
    return length < 0.35 ? "small" : length < 1.5 ? "medium" : "large";
}

/** The rendezvous pick: the candidate with the highest hash of (key, its index). Stable as candidates are added elsewhere. */
function pick<T>(list: readonly T[], key: string, label: (item: T, index: number) => string): T | null {
    let best: T | null = null;
    let bestScore = -1;
    list.forEach((item, index) => {
        const score = hashText(`${key}|${label(item, index)}`);
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
        if (animal.area === "house") {
            const indoors = KEPT_INDOORS.test(slug) && length < 0.6;
            const home = householdOf(animal.id, indoors, households);
            // (A home's own spots only: a bin by the house shares the household's name.)
            const homeSpots = (byPlace.get(home.id) ?? []).concat(home.kind === "flat" ? byPlace.get(home.building) ?? [] : []).filter((s) => s.area === "house");
            const list = homeSpots.filter((s) => (indoors ? s.where === "window" : s.where !== "window"));
            spot = pick(list.length ? list : homeSpots, animal.id, (s, i) => `${s.where}${i}`);
            info = {area: "house", where: spot?.where ?? "lawn", place: home.id, enclosure: null, range: indoors ? 0 : spot?.where === "balcony" ? 0.6 : spot?.where === "yard" ? 2.5 : 5, still: indoors};
            rank = (own >>> 9) % 3;
        } else if (animal.area === "farm") {
            const farm = farmOf(animal.id);
            const farmSpots = (byPlace.get(farm) ?? []).filter((s) => s.area === "farm");
            const want: SpotWhere = POULTRY.test(slug) ? "run" : GRAZER.test(slug) || size === "large" ? "paddock" : "farmyard";
            const list = farmSpots.filter((s) => s.where === want);
            spot = pick(list.length ? list : farmSpots, animal.id, (s, i) => `${s.where}${i}`);
            info = {area: "farm", where: spot?.where ?? want, place: farm, enclosure: null, range: want === "paddock" ? 9 : want === "run" ? 3 : 5, still: false};
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
        } else {
            const key = clusterKey(animal);
            const wheres = urbanNiche(slug, animal.zone);
            const candidates = wheres.flatMap((w) => byWhere.get(w) ?? []).filter((s) => s.sizes.includes(size));
            const list = candidates.length ? candidates : wheres.flatMap((w) => byWhere.get(w) ?? []);
            // The cluster's members share their first one's spot (the server's slot): picked by the cluster's key.
            const memo = `${key}|${slug}|${size}`;
            if (!clusterSpots.has(memo)) clusterSpots.set(memo, pick(list, `${key}|${slug}`, (s, i) => `${s.place}${s.where}${i}`));
            spot = clusterSpots.get(memo)!;
            // (Its place in its cluster is the server's rank, whoever else is there.)
            rank = animal.slot_rank ?? 0;
            const area: TownArea = spot?.area ?? "garden_wildlife";
            info = {area, where: spot?.where ?? "park", place: spot?.place ?? "park", enclosure: null, range: HIGH_WHERE.has(spot?.where ?? "park") ? 1.5 : 8, still: false};
        }
        const base = spot ?? {x: 0, y: 2.6, z: 0, where: "park" as SpotWhere};
        const off = info.still || HIGH_WHERE.has(base.where) ? {dx: 0, dz: 0} : offset(animal.id, length, rank);
        const bound = info.enclosure?.mask ?? null;
        const at = inside(bound, base.x + off.dx, base.z + off.dz, base.x, base.z);
        // (In the town every water is above the sea: a pool, the canal, a pond. The scene's water pose works from the sea's
        // level, so a swimmer here floats at its spot's surface, on its own ground: `water` stays false.)
        // (A raised pool's water is 0.45 m over the highest ground at its rim: a swimmer floats there, not under the rim.)
        const pool = base.where === "pool" && info.enclosure?.pool ? Math.max(...info.enclosure.pool.map((q) => townHeight(q.x, q.z))) + 0.45 : null;
        const placement: Placement = {x: at.x, z: at.z, ground: pool ?? base.y, yaw, water: false, sea: false};
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
