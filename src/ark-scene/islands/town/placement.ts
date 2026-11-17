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
import {safariWaterLevel, townHeight} from "@/ark-scene/islands/town/ground";
import {spreadPerch, townHouseholds, farmOf, householdOf, urbanNiche, zooLayout, zooSpotsFor, townAreas, type Household, type SpotWhere, type TownSpot, type ZooEnclosure, type TownArea} from "@/ark-scene/islands/town/areas";
import {launchEnclosures, enclosuresIn} from "@/ark-scene/islands/town/areas";
import {ZOO_ENCLOSURE_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";
import {domeZoneOf, zooResidents} from "@/ark-scene/islands/town/zoo-homes";
import {DOME, DOME_FLOATERS, DOME_LAGOON, domeKeep, domeZoneAt, intoLagoon} from "@/ark-scene/islands/town/dome";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {stayingSet, ruralPenOf, ruralPondNorm, type RuralPen} from "@/ark-scene/islands/town/rural";
import {zooTypeOfSlug} from "@/ark-scene/islands/routing";
import {modelBase} from "@/ark-scene/grounding/base";
import {aquariumTankOf, aquariumTanks, displaySpot, displayTank, homeKeeping, homeSiteFootprints, homeSites, inTownSolid as inBuilding, nearTownSolids as nearSolids, perchesInCage, zooHouseFrame, ZOO_HOUSE_TYPES, type HomeDisplay, type HomeKeeping, type Tank} from "@/ark-scene/islands/town/tanks";
import {corners, inBox, sub, toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {aquariumHall} from "@/ark-scene/islands/town/aquarium-hall";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townWetlandOf} from "@/ark-scene/islands/town/wetland";
import {gardenRoomOf, homeIndoors, roomCell, towerApartments, type IndoorPlace, type OutdoorPet} from "@/ark-scene/islands/town/home-rooms";

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
    /**
     * gfx (PLACE): the fenced ground a kept animal stays in (a farm's paddock, run or yard; a home's back garden, its
     * terrace yard, its courtyard or front garden), and how far in from its sides its middle keeps (half its body and a
     * hand): its spot and every pose of its day (`islands/scene.ts` bound) are inside it, never on the rails, over the
     * fence in a neighbour's garden, or in the canal.
     */
    pen?: Box;
    penMargin?: number;
    /**
     * p4 (zoolive): an outdoor zoo resident's body clear of its enclosure's fence: how far in from the mask (itself 0.4 m
     * inside the fence) its middle keeps (half its drawn body, a male's size, and a hand); its spot and every pose of its day
     * (`islands/scene.ts` bound) keep to it. Before, only its middle kept inside the mask: a tapir's or an elephant's front
     * half stood through the mesh ("a tapir stuck in the mesh fence").
     */
    enclosureMargin?: number;
    /**
     * p5 (homes): a pet over its garden's cap, indoors (`home-rooms.ts`): its home's glass garden room or a tower
     * apartment, its cell of the room's floor. It walks about its cell on the shared clock (`roomPose`), held there.
     */
    room?: IndoorPlace;
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
/** p2 (land): a wetland spot in the water itself (its surface at least 0.3 m over the bed), not on the bank. */
function inTownWater(s: TownSpot): boolean {
    return WATER_WHERE.has(s.where) && townHeight(s.x, s.z) < s.y - 0.3;
}
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
    const all = zooResidents(animals, result.open);
    planIndoors(all);
    const fieldOf = wholeFields(all);
    for (const animal of all) {
        const placement = result.places.get(animal.id);
        const info = result.town.get(animal.id);
        if (!placement || !info) continue;
        const own = hashText(animal.id);
        const rank = animal.area === "zoo" ? 1 + ((own >>> 7) % 4) : !animal.area ? animal.slot_rank ?? 0 : (own >>> 9) % 3;
        const core: Placement = {...placement};
        delete core.leader;
        delete core.rank;
        MEMO.set(`${openKey}|${animal.id}|${animal.area ?? ""}|${animal.enclosure ?? ""}|${animal.slot ?? ""}|${animal.slot_rank ?? ""}|${animal.zone}|${animal.model_slug}|${fieldOf.get(animal.id)?.id ?? ""}${indoorTag(animal.id)}`, {placement: core, info, rank});
        if (info.pen) SPREAD.set(spreadKey(animal), {x: placement.x, z: placement.z, ground: placement.ground});
    }
}

export function placeTownAnimals(given: readonly ArkAnimal[], openAs?: readonly string[]): TownPlacements {
    if (primed) {
        const hit = primed.key === townPlacementKey(given) ? primed.result : null;
        if (hit) {
            primed = null;
            return hit;
        }
    }
    // p4 (safari), p5 (zoospace): each zoo resident with the enclosure the town draws it in (its safari area, a new
    // home or its type's spread: `zoo-homes.ts`), from its own fields and the open enclosures.
    const animals = zooResidents(given, openAs);
    // p5 (rural): who lives in the countryside's fields (the children's farm keeps a petting set, `rural.ts`). Like the
    // homes' indoor plan below, from the whole list: while the town's animals join a few at a time (`openAs`), the last
    // whole list's fields stand (a part would keep a different few on each farm, and animals would move as the rest
    // came); a part with an animal the whole list never had is worked out on its own, and not kept.
    const fieldOf = !openAs ? wholeFields(animals) : lastFields && animals.every((a) => lastFields!.ids.has(a.id)) ? lastFields.fields : ruralFields(animals);
    // p5 (homes): which of the homes' outdoor pets live indoors (the garden cap), before anyone is placed. (While the
    // town's animals join a few at a time, `openAs`, the whole list's plan stands: from the prebuild's prime or the last
    // whole read; a part of the list would cap each garden by the part, and pets would move as the rest came.)
    if (!openAs) planIndoors(animals);
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
        if (animal.area !== "zoo" || fieldOf.has(animal.id)) continue;
        const key = `${animal.enclosure ?? ""}|${animal.kind_species_profile_id ?? animal.species_profile_id}`;
        const c = zooLeads.get(key);
        if (!c) zooLeads.set(key, {leader: animal.id, at: animal.arrived_at, count: 1});
        else {
            c.count++;
            if (animal.arrived_at < c.at || (animal.arrived_at === c.at && animal.id < c.leader)) Object.assign(c, {leader: animal.id, at: animal.arrived_at});
        }
    }
    const clusterSpots = new Map<string, TownSpot | null>();
    // gfx (PLACE): the animals placed fresh this call (not remembered), remembered after the spread below.
    const fresh: Array<{animal: ArkAnimal; memoKey: string; placement: Placement; info: TownPlace; rank: number; length: number}> = [];
    const openKey = openNames.join(",");
    if (MEMO.size > 20000) MEMO.clear();
    for (const animal of animals) {
        // Who it keeps to (a zoo kind's first in its enclosure; a wildlife cluster's first): the only part that depends on
        // who else is aboard, worked out fresh. Its spot and its step off it are its own (remembered across snapshots).
        let leader: string | undefined;
        if (animal.area === "zoo" && !fieldOf.has(animal.id)) {
            const lead = zooLeads.get(`${animal.enclosure ?? ""}|${animal.kind_species_profile_id ?? animal.species_profile_id}`);
            if (lead && lead.count > 1) leader = lead.leader;
        } else if (!animal.area) {
            const cluster = clusters.get(clusterKey(animal));
            if (cluster && cluster.count > 1) leader = cluster.leader;
        }
        const memoKey = `${openKey}|${animal.id}|${animal.area ?? ""}|${animal.enclosure ?? ""}|${animal.slot ?? ""}|${animal.slot_rank ?? ""}|${animal.zone}|${animal.model_slug}|${fieldOf.get(animal.id)?.id ?? ""}${indoorTag(animal.id)}`;
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
        // p5 (rural): livestock and poultry of the homes, the farms and the children's farm (past its petting set) in
        // the countryside's fields, by their kind (`rural.ts` ruralPenOf).
        const field = fieldOf.get(animal.id);
        if (field) {
            const where: SpotWhere = field.kinds.includes("poultry") ? "run" : field.kinds.length ? "paddock" : "farmyard";
            spot = ruralSpot(field, animal.id, length);
            info = penned({area: "farm", where, place: field.id, enclosure: null, range: 9, still: false}, field.at, length);
            rank = (own >>> 9) % 3;
        } else if (animal.area === "house" && keeping !== "livery") {
            // Lane TB: how it is kept (`tanks.ts` homeKeeping). A pond is a house's; a long pet's vivarium or tank a house's
            // or a terrace home's (a flat's are small); a cage, a small vivarium or tank may be a flat's.
            const display = keeping === "tank" || keeping === "cage" || keeping === "vivarium" || keeping === "pond";
            // gfx (PLACE): a tank fish longer than every home's tank (an arowana, 0.75 m: the tanks hold 0.48-0.73 m) is
            // kept in a garden pond, the only home water that holds it, never left on the lawn ("a random asian arowana in
            // the backyard of a house").
            const pondFish = keeping === "tank" && !tankHolds(length);
            const flatOk = display && keeping !== "pond" && !pondFish && length < 0.55;
            // (Its display at a home: the pond, else the tank; the cage or vivarium only where it fits in, body and all.)
            const displayAt = (h: Household): HomeDisplay | null => displayFor(h, keeping!, length, pondFish);
            // (The rendezvous order of homes, the first where its display holds it: the same for every viewer, never moved by others.)
            // p5 (homes): a turtle or terrapin in a tank its own, never sharing the fish's (`planTurtleTanks`).
            const turtleHome = TURTLE_HOME.get(animal.id);
            const home = turtleHome ?? (display ? homeInOrder(animal.id, flatOk, households, (h) => displayAt(h) !== null) : householdOf(animal.id, false, households));
            const shown = display ? displayAt(home) : null;
            const indoors = INDOORS.get(animal.id);
            if (indoors && !shown) {
                // p5 (homes): over its garden's cap: indoors in its room, its own cell of the floor (`home-rooms.ts`).
                const c = roomCell(indoors);
                held = {x: c.x, z: c.z, y: indoors.room.floor, yaw};
                info = {area: "house", where: "indoor", place: indoors.room.kind === "apartment" ? indoors.room.id : home.id, enclosure: null, range: 0, still: true, keeping: keeping ?? "outdoors", room: indoors};
                rank = 0;
            } else if (shown) {
                const perched = shown.form === "cage" && perchesInCage(slug, plan);
                held = shown.form === "tank" || shown.form === "pond" ? {x: shown.x, z: shown.z, y: shown.floor, yaw} : displaySpot(shown, animal, length, perched);
                info = {area: "house", where: "window", place: home.id, enclosure: null, range: 0, still: true, display: shown, keeping: keeping!, ...(shown.form === "tank" || shown.form === "pond" ? {tank: displayTank(shown)} : {})};
                rank = 0;
            } else {
                // Outdoors: the home's garden, yard, balcony or courtyard (never in its garden room's or pond's footprint).
                const homeSpots = (byPlace.get(home.id) ?? []).concat(home.kind === "flat" ? byPlace.get(home.building) ?? [] : []).filter((s) => s.area === "house" && !inSite(s.x, s.z) && (s.where === "balcony" || !inBuilding(s.x, s.z, 0.3)));
                const list = homeSpots.filter((s) => s.where !== "window");
                // gfx (PLACE): a home whose every garden spot lies under its garden room has its own ground's open points
                // (a terrace yard with a glass room across it); before, its pets fell back to the town's middle, in the
                // canal ("the water canal in the town island has a dog in it").
                const open = list.length ? list : openGround(home);
                spot = pick(open.length ? open : homeSpots, animal.id, (s, i) => `${s.where}${i}`);
                info = {area: "house", where: spot?.where ?? "lawn", place: home.id, enclosure: null, range: spot?.where === "balcony" ? 0.6 : spot?.where === "yard" ? 2.5 : 5, still: false, keeping: keeping ?? "outdoors"};
                rank = (own >>> 9) % 3;
                const pen = spot && spot.where !== "balcony" && spot.where !== "window" ? homePen(home, spot.x, spot.z) : null;
                if (pen) info = penned(info, pen, length);
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
            // gfx (PLACE): its paddock's, run's or yard's rails are its bounds ("horses are in the middle of fences").
            const plot = townPlan().farms.find((f) => f.id === farm);
            const pen = plot ? (info.where === "paddock" ? plot.paddock : info.where === "run" ? plot.run : info.where === "farmyard" ? plot.yard : null) : null;
            if (pen) info = penned(info, pen, length);
        } else if (animal.area === "zoo") {
            const type = enclosureTypeOf(animal);
            const named = animal.enclosure && enclosures.get(animal.enclosure);
            const enclosure = named || layout.enclosures.find((e) => e.type === type) || null;
            const host = enclosure ? (enclosure.shared ? layout.enclosures.find((e) => !e.shared && e.slot.id === enclosure.slot.id) ?? enclosure : enclosure) : null;
            const inner = host ? zooSpots.get(host.id) ?? [] : [];
            const swims = SWIMMER.test(slug);
            // p5 (zoospace): in the free-flight dome, the spots of its zone by the homes rule (`zoo-homes.ts` domeZoneOf: the
            // lagoon's banks, the canopy's trees and snags, the open floor, the cliff's foot); the waterbirds that live on the
            // water (a stored role) on the lagoon itself.
            const dome = host?.slot.annex === "dome";
            const domeZone = dome ? (domeZoneOf(slug) === "lagoon" && DOME_FLOATERS.has(behaviourProfile(slug).water ?? "") ? "pool" : domeZoneOf(slug) ?? "floor") : null;
            const zoned = domeZone ? inner.filter((s) => domeZoneAt(s.x, s.z) === domeZone) : [];
            const list = zoned.length ? zoned : inner.filter((s) => (swims && host?.pool && !dome ? s.where === "pool" : s.where !== "pool" || !host?.pool));
            spot = pick(list.length ? list : inner, animal.id, (s, i) => `${s.where}${i}`);
            // (Its step off the spot never depends on who leads: a leader leaving moves nobody.)
            rank = 1 + ((own >>> 7) % 4);
            info = {area: "zoo", where: spot?.where ?? "enclosure", place: enclosure?.id ?? `${type}-1`, enclosure: host, range: host ? inradius(host.mask) : 2, still: Boolean(host?.indoor) && length < 0.25};
            if (host && host.type === "aquarium") {
                // Lane TB: an aquarium resident swims in its tank (`tanks.ts`), never on the hall's floor.
                const tank = aquariumTankOf(animal, length, tanksOf(host));
                if (tank) {
                    // (p2 (aqua): the one hall spans both aquarium plots (`aquarium-hall.ts`), whether or not the second is open: a
                    // resident's bounds are the open plot its tank stands in, else its own enclosure widened to the hall's inside.)
                    const hall = tank.id.startsWith("aquarium-hall:") ? aquariumHall() : null;
                    if (hall) {
                        const plot = layout.enclosures.find((e) => e.type === "aquarium" && !e.shared && inPoly(e.mask, tank.x, tank.z)) ?? {...host, mask: corners(hall.frame.inner)};
                        info = {...info, enclosure: plot, range: inradius(plot.mask)};
                    }
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
            // p4 (zoolive): outdoors, its whole body inside the enclosure's fence (`enclosureMargin`).
            if (!held && host && !host.indoor) info = {...info, enclosureMargin: zooMargin(host.mask, arkBody(animal).display)};
        } else {
            const key = clusterKey(animal);
            // p2 (land): the town's pond life (its stored water kind or pond habitat) at the town's wetland, a swimmer in the water.
            const wet = townWetlandOf(slug, animal.zone);
            const wheres = wet ? wet.wheres : urbanNiche(slug, animal.zone);
            // (Lane TB: a spot on the ground never in a building's footprint: some gardens and bins lie under a block of flats.)
            const onGround = (s: TownSpot) => (HIGH_WHERE.has(s.where) || !inBuilding(s.x, s.z, 0.3)) && (!wet?.swims || inTownWater(s));
            const candidates = wheres.flatMap((w) => byWhere.get(w) ?? []).filter((s) => s.sizes.includes(size) && onGround(s));
            const list = candidates.length ? candidates : wheres.flatMap((w) => byWhere.get(w) ?? []).filter(onGround);
            // The cluster's members share their first one's spot (the server's slot): picked by the cluster's key.
            const memo = `${key}|${slug}|${size}`;
            if (!clusterSpots.has(memo)) clusterSpots.set(memo, pick(list, `${key}|${slug}`, (s, i) => `${s.place}${s.where}${i}`));
            spot = clusterSpots.get(memo)!;
            // (Its place in its cluster is the server's rank, whoever else is there.)
            rank = animal.slot_rank ?? 0;
            // p5 (census): a roosting cluster side by side along its roof, not all on its first one's spot.
            if (spot) spot = spreadPerch(spot, rank, length);
            const area: TownArea = spot?.area ?? "garden_wildlife";
            info = {area, where: spot?.where ?? "park", place: spot?.place ?? "park", enclosure: null, range: HIGH_WHERE.has(spot?.where ?? "park") ? 1.5 : 8, still: false};
        }
        const base = held ? {x: held.x, y: held.y, z: held.z, where: info.where} : spot ?? {x: 0, y: 2.6, z: 0, where: "park" as SpotWhere};
        const off = held || info.still || HIGH_WHERE.has(base.where) ? {dx: 0, dz: 0} : offset(animal.id, length, rank);
        const bound = held ? null : info.enclosure?.mask ?? null;
        let at = inside(bound, base.x + off.dx, base.z + off.dz, base.x, base.z);
        // (Lane TB: on the ground, its body clear of every building's wall and every garden room and pond.)
        if (!held && !HIGH_WHERE.has(base.where) && base.where !== "pool") at = inside(bound, ...clearOf(at.x, at.z, Math.min(Math.max(length * 0.45, 0.12), 1.6)), base.x, base.z);
        // gfx (PLACE): inside its pen, its body clear of the rails (then clear of any building again, the pen's inside).
        if (info.pen) at = inPen(info.pen, info.penMargin ?? 0, at.x, at.z, length);
        else if (info.enclosureMargin !== undefined && info.enclosure) at = keepInside(maskBox(info.enclosure.mask), at.x, at.z, info.enclosureMargin);
        // (In the town every water is above the sea: a pool, the canal, a pond. The scene's water pose works from the sea's
        // level, so a swimmer here floats at its spot's surface, on its own ground: `water` stays false.)
        // (A raised pool's water is 0.45 m over the highest ground at its rim: a swimmer floats there, not under the rim.)
        // p5 (zoospace): the dome's residents inside its circle (its plot is the square round it); its swimmers on the
        // lagoon's open water, at the lagoon's own level (cut into the ground, `dome.ts`).
        const inDomeHost = info.enclosure?.slot.annex === "dome" && !held;
        if (inDomeHost) {
            const kept = domeKeep(at.x, at.z, 0, 0, Math.min(length * 0.5, 2));
            at = base.where === "pool" ? intoLagoon(kept.x, kept.z) : {x: kept.x, z: kept.z};
        }
        const pool = base.where === "pool" && info.enclosure?.pool ? (inDomeHost ? safariWaterLevel(DOME_LAGOON) : Math.max(...info.enclosure.pool.map((q) => townHeight(q.x, q.z))) + 0.45) : null;
        const placement: Placement = {x: at.x, z: at.z, ground: pool ?? base.y, yaw: held ? held.yaw : yaw, water: false, sea: false};
        fresh.push({animal, memoKey, placement, info, rank, length});
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
    spreadPenned(animals, places, town, fresh);
    spreadZoo(animals, places, town, fresh);
    for (const f of fresh) {
        const core: Placement = {...f.placement};
        delete core.leader;
        delete core.rank;
        MEMO.set(f.memoKey, {placement: core, info: f.info, rank: f.rank});
    }
    return {places, town, open: openNames};
}

// MARK: - p5 (rural): a spot in a countryside field

/** Each town animal the countryside takes, and its field (`rural.ts` ruralPenOf; the children's farm's petting set kept). */
/** The last whole list's fields (p5 (rural)) and who was in it: they stand while a part of the list is laid out. */
let lastFields: {fields: Map<string, RuralPen>; ids: Set<string>} | null = null;
function wholeFields(animals: readonly ArkAnimal[]): Map<string, RuralPen> {
    lastFields = {fields: ruralFields(animals), ids: new Set(animals.map((a) => a.id))};
    return lastFields.fields;
}

export function ruralFields(animals: readonly ArkAnimal[]): Map<string, RuralPen> {
    const plan = townPlan();
    const staying = stayingSet(animals, (id) => {
        const farm = farmOf(id);
        return plan.farms.find((f) => f.id === farm) ?? null;
    });
    const kept = (a: {id: string}) => staying.has(a.id);
    const out = new Map<string, RuralPen>();
    for (const a of animals) {
        const f = ruralPenOf(a, kept);
        if (f) out.set(a.id, f);
    }
    return out;
}

/**
 * A spot in a field: a rendezvous of the animal's id over a 1.5 m grid inside its boundary (half its body and a hand
 * in), on dry ground (never in the duck pond's water: the waterfowl on its banks) and clear of the field's shelters,
 * arks and hen houses. Its height is the ground's there.
 */
const RURAL_SPOTS = new Map<string, TownSpot[]>();
function ruralSpot(field: RuralPen, id: string, length: number): TownSpot | null {
    const m = Math.min(Math.max(length * 0.5 + 0.3, 0.5), Math.min(field.at.w, field.at.d) / 2 - 0.2);
    const key = `${field.id}|${m.toFixed(1)}`;
    let list = RURAL_SPOTS.get(key);
    if (!list) {
        list = [];
        const c = Math.cos(field.at.rot);
        const sn = Math.sin(field.at.rot);
        for (let lx = -field.at.w / 2 + m; lx <= field.at.w / 2 - m; lx += 1.5) {
            for (let lz = -field.at.d / 2 + m; lz <= field.at.d / 2 - m; lz += 1.5) {
                const x = field.at.x + lx * c - lz * sn;
                const z = field.at.z + lx * sn + lz * c;
                if (ruralPondNorm(x, z) < 1.3 || inBuilding(x, z, m + 0.2)) continue;
                list.push({x, z, y: townHeight(x, z), area: "farm", where: "paddock", place: field.id, sizes: ["small", "medium", "large"], protected: true});
            }
        }
        RURAL_SPOTS.set(key, list);
    }
    return pick(list, id, (s, i) => `${field.id}${i}`);
}

// MARK: - gfx (PLACE): pens, and kept animals apart

/**
 * Kept animals in one pen (a paddock, a run, a yard, a garden) stand apart: the owner's "half of a horse's body is half
 * in a cow's". Each newcomer (placed fresh, in order of arrival) keeps clear of everyone already there (remembered or
 * placed before it): its own spot if that is clear, else the nearest clear point on rings about it, inside its pen and
 * clear of buildings. Nobody already placed ever moves, so an arrival or a departure moves no one in a session (the
 * places are remembered); a fresh read lays the pen out as the arrivals came, the same for every viewer.
 */
function spreadPenned(animals: readonly ArkAnimal[], places: Map<string, Placement>, town: Map<string, TownPlace>, fresh: Array<{animal: ArkAnimal; placement: Placement; info: TownPlace; length: number}>): void {
    // (Its place in its pen remembered whatever the zoo has open: a new enclosure redoes everyone's spots, not this.)
    for (const f of fresh) {
        const kept = f.info.pen ? SPREAD.get(spreadKey(f.animal)) : undefined;
        if (!kept) continue;
        f.placement.x = kept.x;
        f.placement.z = kept.z;
        f.placement.ground = kept.ground;
    }
    const newcomers = fresh.filter((f) => f.info.pen && !SPREAD.has(spreadKey(f.animal)));
    if (!newcomers.length) return;
    if (SPREAD.size > 20000) SPREAD.clear();
    const isFresh = new Set(newcomers.map((f) => f.animal.id));
    const groups = new Map<string, Array<{x: number; z: number; length: number}>>();
    const groupOf = (info: TownPlace) => {
        let g = groups.get(info.place);
        if (!g) groups.set(info.place, (g = []));
        return g;
    };
    // (Those already there: remembered from an earlier read.)
    for (const animal of animals) {
        const info = town.get(animal.id);
        if (!info?.pen || isFresh.has(animal.id)) continue;
        const p = places.get(animal.id);
        if (p) groupOf(info).push({x: p.x, z: p.z, length: arkBody(animal).metres});
    }
    newcomers.sort((a, b) => (a.animal.arrived_at < b.animal.arrived_at ? -1 : a.animal.arrived_at > b.animal.arrived_at ? 1 : a.animal.id < b.animal.id ? -1 : 1));
    for (const f of newcomers) {
        const group = groupOf(f.info);
        const at = clearSpot(f.animal.id, f.placement.x, f.placement.z, f.length, f.info, group);
        if (at.x !== f.placement.x || at.z !== f.placement.z) {
            f.placement.x = at.x;
            f.placement.z = at.z;
            f.placement.ground = townHeight(at.x, at.z);
        }
        group.push({x: f.placement.x, z: f.placement.z, length: f.length});
        SPREAD.set(spreadKey(f.animal), {x: f.placement.x, z: f.placement.z, ground: f.placement.ground});
    }
}

/**
 * p5 (zoospace): a zoo enclosure's residents stand apart, as a pen's do (`spreadPenned`): the census of the real record
 * found bodies on one another in the houses and flights (the reptile house's 17 pairs, the primates' 9: two residents
 * of a kind took one spot, `pick` being each one's own draw). Each newcomer (placed fresh, in order of arrival) keeps
 * clear of everyone already in its enclosure: its own spot if clear, else the nearest clear point on rings about it,
 * inside the fence (its body's margin) or the house's walls. Tank swimmers and pool swimmers keep theirs (their tank's
 * loop and the water place them). Nobody already placed moves; the same for every viewer.
 */
function spreadZoo(animals: readonly ArkAnimal[], places: Map<string, Placement>, town: Map<string, TownPlace>, fresh: Array<{animal: ArkAnimal; placement: Placement; info: TownPlace; length: number}>): void {
    const movable = (info: TownPlace | undefined) => Boolean(info && info.area === "zoo" && info.enclosure && !info.tank && info.where !== "pool");
    const newcomers = fresh.filter((f) => movable(f.info));
    if (!newcomers.length) return;
    const isFresh = new Set(newcomers.map((f) => f.animal.id));
    const groups = new Map<string, Array<{x: number; z: number; length: number}>>();
    const groupOf = (info: TownPlace) => {
        let g = groups.get(info.enclosure!.id);
        if (!g) groups.set(info.enclosure!.id, (g = []));
        return g;
    };
    for (const animal of animals) {
        const info = town.get(animal.id);
        if (!movable(info) || isFresh.has(animal.id)) continue;
        const p = places.get(animal.id);
        if (p) groupOf(info!).push({x: p.x, z: p.z, length: arkBody(animal).metres});
    }
    newcomers.sort((a, b) => (a.animal.arrived_at < b.animal.arrived_at ? -1 : a.animal.arrived_at > b.animal.arrived_at ? 1 : a.animal.id < b.animal.id ? -1 : 1));
    for (const f of newcomers) {
        const host = f.info.enclosure!;
        const group = groupOf(f.info);
        const indoor = host.indoor && ZOO_HOUSE_TYPES.has(host.type);
        const frame = indoor ? zooHouseFrame(host) : null;
        const bound = frame ? frame.inner : maskBox(host.mask);
        const margin = frame ? Math.min(f.length * 0.5 + 0.15, Math.min(bound.w, bound.d) / 2 - 0.05) : f.info.enclosureMargin ?? 0;
        const room = (px: number, pz: number) => {
            let worst = Infinity;
            for (const o of group) worst = Math.min(worst, Math.hypot(px - o.x, pz - o.z) / keptGap(f.length, o.length));
            return worst;
        };
        let best = {x: f.placement.x, z: f.placement.z, room: room(f.placement.x, f.placement.z)};
        if (best.room < 1) {
            const step = Math.max(f.length * 0.5, 0.2);
            const turn = (hashText(`${f.animal.id}#zoo-spread`) % 6283) / 1000;
            for (let ring = 1; ring <= 16 && best.room < 1; ring++) {
                const n = 6 + ring * 2;
                for (let k = 0; k < n; k++) {
                    const a = turn + (k / n) * Math.PI * 2;
                    const p = keepInside(bound, f.placement.x + Math.cos(a) * step * ring, f.placement.z + Math.sin(a) * step * ring, margin);
                    const r = room(p.x, p.z);
                    if (r > best.room + 1e-6) best = {x: p.x, z: p.z, room: r};
                }
            }
            if (host.slot.annex === "dome") {
                const kept = domeKeep(best.x, best.z, 0, 0, Math.min(f.length * 0.5, 2));
                best = {x: kept.x, z: kept.z, room: best.room};
            }
            if (best.x !== f.placement.x || best.z !== f.placement.z) {
                f.placement.x = best.x;
                f.placement.z = best.z;
                // (Indoors the house's floor; outdoors the ground there.)
                if (!frame) f.placement.ground = townHeight(best.x, best.z);
            }
        }
        group.push({x: f.placement.x, z: f.placement.z, length: f.length});
    }
}

let domeFloorMemo: number | null = null;
/** The dome's floor level (m): the ground at its middle; the shell's heights are over it (`dome.ts` domeShell). */
export function domeFloor(): number {
    return (domeFloorMemo ??= townHeight(DOME.x, DOME.z));
}

/**
 * p5 (zoospace): a free-flight dome resident's pose kept inside the dome's volume (`dome.ts` domeKeep): on the ground
 * inside its circle, in the air under the shell where it is (its body `length` m: its half length in from the mesh,
 * six tenths of it for its height and wings). The scene's hard bound for the dome's birds (`islands/scene.ts`), and
 * the tests': a 3D bound, not the plot's square.
 */
export function keepInDome(length: number, pose: {x: number; z: number; base?: number}, ox = 0, oz = 0): void {
    const floor = domeFloor();
    const kept = domeKeep(pose.x - ox, pose.z - oz, (pose.base ?? floor) - floor, length * 0.6, Math.min(length * 0.5, 3));
    pose.x = kept.x + ox;
    pose.z = kept.z + oz;
    if (pose.base !== undefined && pose.base - floor > kept.y) pose.base = floor + kept.y;
}

/** A penned animal's place in its pen, by its own fields (not the zoo's open enclosures). */
const SPREAD = new Map<string, {x: number; z: number; ground: number}>();
function spreadKey(animal: ArkAnimal): string {
    return `${animal.id}|${animal.area ?? ""}|${animal.zone}|${animal.model_slug}`;
}

/** How far apart two kept bodies' middles stand at the least (m): nine tenths of their half lengths together. */
export function keptGap(a: number, b: number): number {
    return 0.45 * (a + b);
}

/** The nearest point to (x, z), on rings about it, inside the pen and clear of buildings, apart from everyone in `group`. */
function clearSpot(id: string, x: number, z: number, length: number, info: TownPlace, group: ReadonlyArray<{x: number; z: number; length: number}>): {x: number; z: number} {
    const room = (px: number, pz: number) => {
        let worst = Infinity;
        for (const o of group) worst = Math.min(worst, Math.hypot(px - o.x, pz - o.z) / keptGap(length, o.length));
        return worst;
    };
    let best = {x, z, room: room(x, z)};
    if (best.room >= 1) return best;
    const step = Math.max(length * 0.5, 0.2);
    const turn = (hashText(`${id}#spread`) % 6283) / 1000;
    for (let ring = 1; ring <= 14; ring++) {
        const n = 6 + ring * 2;
        for (let k = 0; k < n; k++) {
            const a = turn + (k / n) * Math.PI * 2;
            const p = inPen(info.pen!, info.penMargin ?? 0, x + Math.cos(a) * step * ring, z + Math.sin(a) * step * ring, length);
            const r = room(p.x, p.z);
            if (r > best.room + 1e-6) best = {x: p.x, z: p.z, room: r};
        }
        if (best.room >= 1) return best;
    }
    return best;
}

/** The fenced ground a home's spot lies in: its back garden, terrace yard, courtyard or front garden. */
function homePen(home: Household, x: number, z: number): Box | null {
    const parcel = parcelOf(home.building);
    if (!parcel) return null;
    if (home.kind === "terrace_home" && parcel.back) {
        const yard = sub(parcel.back, -parcel.back.w / 2 + (parcel.back.w * (home.index + 0.5)) / 4, 0, parcel.back.w / 4, parcel.back.d);
        if (inBox(yard, x, z, 0.3)) return yard;
    }
    if (home.kind !== "terrace_home" && parcel.back && inBox(parcel.back, x, z, 0.3)) return parcel.back;
    if (parcel.front && inBox(parcel.front, x, z, 0.3)) return parcel.front;
    return null;
}

/** A home's own open ground (for a home whose every garden spot is under its garden room): its pen's clear points. */
function openGround(home: Household): TownSpot[] {
    const parcel = parcelOf(home.building);
    const back = parcel?.back;
    if (!back) return [];
    const pen = home.kind === "terrace_home" ? sub(back, -back.w / 2 + (back.w * (home.index + 0.5)) / 4, 0, back.w / 4, back.d) : back;
    const where: SpotWhere = home.kind === "terrace_home" ? "yard" : home.kind === "flat" ? "courtyard" : "lawn";
    const out: TownSpot[] = [];
    for (let lx = -pen.w / 2 + 0.6; lx <= pen.w / 2 - 0.6; lx += 0.8) {
        for (let lz = -pen.d / 2 + 0.6; lz <= pen.d / 2 - 0.6; lz += 0.8) {
            const c = Math.cos(pen.rot);
            const s = Math.sin(pen.rot);
            const x = pen.x + lx * c - lz * s;
            const z = pen.z + lx * s + lz * c;
            if (inSite(x, z) || inBuilding(x, z, 0.3)) continue;
            out.push({x, y: townHeight(x, z), z, area: "house", where, place: home.id, sizes: ["small", "medium"], protected: true});
        }
    }
    return out;
}

// (By the building: parcel ids repeat across streets, a building's is its own.)
let parcels: Map<string, ReturnType<typeof townPlan>["parcels"][number]> | null = null;
function parcelOf(building: string): ReturnType<typeof townPlan>["parcels"][number] | undefined {
    parcels ??= new Map(townPlan().parcels.map((p) => [p.building, p]));
    return parcels.get(building);
}

/** A place with its pen: the margin half its body and a hand, and a roam the pen holds (`rangeOf` takes 1.5 times it). */
function penned(info: TownPlace, pen: Box, length: number): TownPlace {
    const margin = Math.max(Math.min(length * 0.5 + 0.15, pen.w / 2 - 0.05, pen.d / 2 - 0.05), 0);
    const reach = Math.max(Math.min(pen.w, pen.d) / 2 - margin, 0.4);
    return {...info, pen, penMargin: margin, range: Math.min(info.range, Math.max(reach / 1.5, 0.4))};
}

/** p4 (zoolive): an enclosure's mask (the corners of a turned box, `areas.ts` enclosureOn) as that box (memo by the mask). */
const MASK_BOXES = new WeakMap<Poly, Box>();
export function maskBox(mask: Poly): Box {
    let b = MASK_BOXES.get(mask);
    if (!b) {
        const [p0, p1, p2] = mask;
        b = {x: (mask[0].x + mask[2].x) / 2, z: (mask[0].z + mask[2].z) / 2, w: Math.hypot(p1.x - p0.x, p1.z - p0.z), d: Math.hypot(p2.x - p1.x, p2.z - p1.z), rot: Math.atan2(p1.z - p0.z, p1.x - p0.x)};
        MASK_BOXES.set(mask, b);
    }
    return b;
}

/** p4 (zoolive): how far in from an enclosure's mask a resident's middle keeps: half its drawn body at a male's size (1.1) and a hand. */
export function zooMargin(mask: Poly, length: number): number {
    const b = maskBox(mask);
    return Math.max(Math.min(length * 0.55 + 0.15, b.w / 2 - 0.05, b.d / 2 - 0.05), 0);
}

/** A point inside its pen, `margin` in from the rails (the scene's hard bound for a penned animal's every pose). */
/** (A world pose, the island at `ox`, `oz`: moved in place, nothing made, as it runs each frame for each animal.)
 *
 * p3 (solid): with `solid` (the town's colliders, world frame), a pose the pen's rails pulled back onto something solid in
 * the pen (a garden room, a trough, a bush by the rails) goes on to the nearest point in the pen a body of `margin`'s
 * width stands clear at (rings a quarter metre apart, the same for every viewer); none within 3 m: where the rails put it.
 */
export function keepInPen(pen: Box, margin: number, pose: {x: number; z: number}, ox = 0, oz = 0, solid?: {blocked: (x: number, z: number, radius: number) => boolean} | null): void {
    const c = Math.cos(pen.rot);
    const s = Math.sin(pen.rot);
    const dx = pose.x - ox - pen.x;
    const dz = pose.z - oz - pen.z;
    const lx = dx * c + dz * s;
    const lz = -dx * s + dz * c;
    const hx = Math.max(pen.w / 2 - margin, 0);
    const hz = Math.max(pen.d / 2 - margin, 0);
    if (Math.abs(lx) <= hx && Math.abs(lz) <= hz) return;
    const qx = Math.min(Math.max(lx, -hx), hx);
    const qz = Math.min(Math.max(lz, -hz), hz);
    pose.x = ox + pen.x + qx * c - qz * s;
    pose.z = oz + pen.z + qx * s + qz * c;
    if (!solid) return;
    clearWithin(pose, Math.min(Math.max(margin - 0.15, 0.05), 1.2), solid, (x, z) => {
        const ex = x - ox - pen.x;
        const ez = z - oz - pen.z;
        return Math.abs(ex * c + ez * s) <= hx + 1e-6 && Math.abs(-ex * s + ez * c) <= hz + 1e-6;
    });
}

/**
 * p3 (solid): a pose its hard bound (a pen's rails, an enclosure's mask) pulled back onto something solid inside it goes on
 * to the nearest point inside (`inside`) a body of `radius` stands clear at: rings a quarter metre apart out to 3 m, the
 * same for every viewer; none: left where the bound put it. Nothing made: it runs each frame for each bound animal.
 */
export function clearWithin(pose: {x: number; z: number}, radius: number, solid: {blocked: (x: number, z: number, radius: number) => boolean}, inside: (x: number, z: number) => boolean): void {
    if (!solid.blocked(pose.x, pose.z, radius)) return;
    const x0 = pose.x;
    const z0 = pose.z;
    for (let ring = 1; ring <= 12; ring++) {
        const n = 8 + ring * 2;
        for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const wx = x0 + Math.cos(a) * ring * 0.25;
            const wz = z0 + Math.sin(a) * ring * 0.25;
            if (!inside(wx, wz) || solid.blocked(wx, wz, radius)) continue;
            pose.x = wx;
            pose.z = wz;
            return;
        }
    }
}

/** A point inside its pen, `margin` in from the rails, clear of the buildings in it (the rails win). */
export function inPen(pen: Box, margin: number, x: number, z: number, length: number): {x: number; z: number} {
    const a = keepInside(pen, x, z, margin);
    const [cx, cz] = clearOf(a.x, a.z, Math.min(Math.max(length * 0.45, 0.12), 1.6));
    return cx === a.x && cz === a.z ? a : keepInside(pen, cx, cz, margin);
}

/** Whether some home's tank holds a fish this long (with its swim's room). */
let widestTank = -1;
function tankHolds(length: number): boolean {
    if (widestTank < 0) {
        widestTank = 0;
        homeSitesNow().forEach((site) => {
            if (site) widestTank = Math.max(widestTank, site.displays.tank.w);
        });
    }
    return length + 0.12 <= widestTank;
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

// MARK: - p5 (homes): the garden cap

/** Each pet indoors (over its garden's cap), from the last list planned. */
const INDOORS = new Map<string, IndoorPlace>();

function indoorTag(id: string): string {
    const p = INDOORS.get(id);
    const t = TURTLE_HOME.get(id);
    return (p ? `|in:${p.room.id}:${p.cell}/${p.cells}` : "") + (t ? `|tank:${t.id}` : "");
}

/** A home's display for a pet kept this way and this long (null: it does not hold it). */
function displayFor(h: Household, keeping: HomeKeeping, length: number, pondFish: boolean): HomeDisplay | null {
    const site = homeSitesNow().get(h.id);
    if (!site) return null;
    const want = keeping === "pond" ? site.displays.pond ?? site.displays.tank : pondFish ? site.displays.pond : site.displays[keeping as "tank" | "cage" | "vivarium"];
    return want && length + (want.form === "tank" || want.form === "pond" ? 0.12 : 0.04) <= want.w ? want : null;
}

/** p5 (homes): a turtle's or terrapin's home when its own rendezvous home's tank holds fish or another turtle. */
const TURTLE_HOME = new Map<string, Household>();
const TURTLE = /turtle|terrapin|(^|-)slider(-|$)|cooter/;

/**
 * Turtles and terrapins kept in a home's tank each have a tank to themselves (a turtle bites and fouls a fish's water;
 * the census found an Annam pond turtle in a 99 L tank with three fish). The fish keep their rendezvous homes; each
 * turtle, in the order of a hash of its id, keeps its own home if its tank is free, else takes the first home in its
 * rendezvous order whose tank holds it and is unused. Pure in the set of the homes' tank animals.
 */
function planTurtleTanks(animals: readonly ArkAnimal[], households: Household[]): void {
    TURTLE_HOME.clear();
    const used = new Set<string>();
    const turtles: Array<{animal: ArkAnimal; length: number; flatOk: boolean}> = [];
    for (const animal of animals) {
        if (animal.area !== "house") continue;
        const length = arkBody(animal).metres;
        const plan = modelBase(animal.model_slug)?.plan ?? null;
        const keeping = homeKeeping(animal.model_slug, animal.zone, length, plan);
        const turtle = TURTLE.test(animal.model_slug);
        if (keeping === "pond" && turtle) {
            // (A pond turtle at a home with no pond is kept in its tank: that tank must be its own too.)
            const home = homeInOrder(animal.id, false, households, (h) => displayFor(h, "pond", length, false) !== null);
            if (displayFor(home, "pond", length, false)?.form === "tank") turtles.push({animal, length, flatOk: false});
            continue;
        }
        if (keeping !== "tank") continue;
        const pondFish = !tankHolds(length);
        if (pondFish) continue;
        const flatOk = length < 0.55;
        if (turtle) {
            turtles.push({animal, length, flatOk});
            continue;
        }
        const home = homeInOrder(animal.id, flatOk, households, (h) => displayFor(h, keeping, length, false) !== null);
        const d = displayFor(home, keeping, length, false);
        if (d) used.add(d.id);
    }
    turtles.sort((a, b) => hashText(`${a.animal.id}|tank`) - hashText(`${b.animal.id}|tank`) || (a.animal.id < b.animal.id ? -1 : 1));
    for (const t of turtles) {
        const home = homeInOrder(t.animal.id, t.flatOk, households, (h) => {
            const d = displayFor(h, "tank", t.length, false);
            return d !== null && !used.has(d.id);
        });
        const d = displayFor(home, "tank", t.length, false);
        if (!d || used.has(d.id)) continue;
        used.add(d.id);
        TURTLE_HOME.set(t.animal.id, home);
    }
}

/** The homes' outdoor pets (as the house branch places them) and which live indoors (`home-rooms.ts` homeIndoors). */
function planIndoors(animals: readonly ArkAnimal[]): void {
    INDOORS.clear();
    const households = townHouseholds();
    planTurtleTanks(animals, households);
    const pets: OutdoorPet[] = [];
    for (const animal of animals) {
        if (animal.area !== "house") continue;
        const length = arkBody(animal).metres;
        const plan = modelBase(animal.model_slug)?.plan ?? null;
        const keeping = homeKeeping(animal.model_slug, animal.zone, length, plan);
        if (keeping === "livery") continue;
        if (keeping !== "outdoors") {
            // (A pet whose display no home holds lives outdoors at its first home, as the house branch places it: a
            // boa too long for a vivarium. It counts in that garden.)
            if (TURTLE_HOME.has(animal.id)) continue;
            const pondFish = keeping === "tank" && !tankHolds(length);
            const flatOk = keeping !== "pond" && !pondFish && length < 0.55;
            const home = homeInOrder(animal.id, flatOk, households, (h) => displayFor(h, keeping, length, pondFish) !== null);
            if (displayFor(home, keeping, length, pondFish)) continue;
            pets.push({id: animal.id, slug: animal.model_slug, plan, length, home});
            continue;
        }
        pets.push({id: animal.id, slug: animal.model_slug, plan, length, home: householdOf(animal.id, false, households)});
    }
    const sites = homeSitesNow();
    const found = homeIndoors(pets, (home) => {
        const site = sites.get(home.id);
        return site ? gardenRoomOf(site, home.kind) : null;
    }, towerApartments());
    found.forEach((p, id) => INDOORS.set(id, p));
}
