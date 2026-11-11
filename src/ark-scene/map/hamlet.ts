/**
 * The hamlet (owner decision D10, 2026-11-11; AnimalDex
 * docs/ark/captures-backfill-dry-run.md §5.5–5.6): captures bring pets and
 * livestock aboard by the thousand, far more than the home petal's ground
 * holds. They live in plots that grow in steps up to a cap, and only a
 * realistic share of them is outside at once.
 *
 * - **Plots** (`homePlots`): houses `clamp(ceil(house residents / 130), 1, 16)`
 *   and smallholdings `clamp(ceil(farm residents / 50), 1, 6)`, in the props
 *   lane's shape (`props/home-layout.ts` HomePlot). The first two are today's
 *   cottage and barn (`defaultHomePlots`). The rest stand on reserved land
 *   in a fixed order (`hamlet-slots.json`, made by `planHamletSlots`), so plot
 *   k always stands in the same place and adding one never moves another.
 *   The reserved land is kept off the map's spawn cells (`reservedAt`), so
 *   nothing else ever stands there.
 * - **Templates** (`plotSpots`): a house: its door, a window, six lawn spots
 *   in its front garden. A smallholding: the barn's door, the coop's door,
 *   twelve paddock spots inside the props' paddock, six in the yard, six in
 *   the coop's run.
 * - **Residents to plots** (`plotOf`): pets to houses, livestock and poultry
 *   to smallholdings (a farm kind kept as a pet goes to a house), by a
 *   rendezvous hash of the animal's id, so a new plot takes only its own
 *   share (about 1 in n) and nobody else moves.
 * - **Indoors and out** (`hamletState`): by kind and the island hour (dogs by
 *   day, cats at dusk and night, poultry and livestock by day, aquarium fish,
 *   caged birds and reptiles always in), a realistic share of each plot's
 *   residents, never more than its spots, out at once; who is out turns on
 *   the shared clock in the runtime lane's way (`arkOutside`'s contract), with
 *   door beats: an animal walks out of its door to its spot, or back in.
 *
 * Deterministic and shared: the same snapshot and the same clock give the
 * same hamlet for every viewer. Visual only.
 */

import {COTTAGE} from "@/ark-scene/micro-decor";
import {coopSpot, defaultHomePlots, GARDEN, homeObstacles, paddockRect, plotFrame, type HomePlot} from "@/ark-scene/props/home-layout";
import {cropAt} from "@/ark-scene/fields";
import {bodyOf} from "@/ark-scene/map/species";
import slotTable from "@/ark-scene/map/hamlet-slots.json";
import type {ArkAnimal} from "@/ark-scene/types";
import {riverDistance, sampleGround, zoneAt, ZONE_SITES} from "@/ark-scene/world";

export const HOUSE_RESIDENTS_PER_PLOT = 130;
export const FARM_RESIDENTS_PER_PLOT = 50;
export const MAX_HOUSES = 16;
export const MAX_SMALLHOLDINGS = 6;

export function houseCount(residents: number): number {
    return Math.min(Math.max(Math.ceil(residents / HOUSE_RESIDENTS_PER_PLOT), 1), MAX_HOUSES);
}

export function smallholdingCount(residents: number): number {
    return Math.min(Math.max(Math.ceil(residents / FARM_RESIDENTS_PER_PLOT), 1), MAX_SMALLHOLDINGS);
}

// MARK: - Plot slots on reserved land

/** A plot's ground in its own frame (x across, z out the front): the house and its garden; the barn's yard and every paddock the props may fence. */
const FOOTPRINT = {
    house: {x0: -5.6, x1: 5.6, z0: -3.4, z1: 9.6},
    smallholding: {x0: -14.5, x1: 14.5, z0: -13.2, z1: 13.2}
} as const;
/** The part that must be clear of every tree, rock and building: the house, the barn. */
const CORE = {
    house: {x0: -3.6, x1: 3.6, z0: -2.9, z1: 3.2},
    smallholding: {x0: -4.8, x1: 4.8, z0: -3.8, z1: 3.8}
} as const;
/** The plots' fixed order: a smallholding first, then three houses to every smallholding. */
const SLOT_ORDER: Array<HomePlot["kind"]> = ["smallholding", "house", "house", "house", "smallholding", "house", "house", "house", "smallholding", "house", "house", "house", "smallholding", "house", "house", "house", "smallholding", "house", "house", "house"];

type Rect = {x0: number; x1: number; z0: number; z1: number};

/** A plot's ground as an oriented rectangle's four corners (world). */
function corners(plot: HomePlot, rect: Rect): Array<{x: number; z: number}> {
    const frame = plotFrame(plot);
    return [frame.toWorld(rect.x0, rect.z0), frame.toWorld(rect.x1, rect.z0), frame.toWorld(rect.x1, rect.z1), frame.toWorld(rect.x0, rect.z1)];
}

/** Do two convex quadrilaterals overlap (separating axis), with `margin` m between them? */
function overlap(a: Array<{x: number; z: number}>, b: Array<{x: number; z: number}>, margin: number): boolean {
    for (const poly of [a, b]) {
        for (let i = 0; i < poly.length; i++) {
            const p = poly[i];
            const q = poly[(i + 1) % poly.length];
            const nx = q.z - p.z;
            const nz = p.x - q.x;
            const l = Math.hypot(nx, nz) || 1;
            const project = (list: Array<{x: number; z: number}>) => list.map((v) => (v.x * nx + v.z * nz) / l);
            const pa = project(a);
            const pb = project(b);
            if (Math.max(...pa) + margin <= Math.min(...pb) || Math.max(...pb) + margin <= Math.min(...pa)) return false;
        }
    }
    return true;
}

/** A plot's footprint (world corners). */
export function plotFootprint(plot: HomePlot): Array<{x: number; z: number}> {
    if (plot.kind === "smallholding") {
        // The barn's core and the props' own paddock, with a metre round them (their bounding rectangle in the plot's frame).
        const rect = paddockRect(plot);
        const core = CORE.smallholding;
        return corners(plot, {x0: Math.min(core.x0, rect.x0) - 1, x1: Math.max(core.x1, rect.x1) + 1, z0: Math.min(core.z0, rect.z0) - 1, z1: Math.max(core.z1, rect.z1) + 1});
    }
    return corners(plot, FOOTPRINT.house);
}

/** The village's middle: between today's cottage and barn. */
function villageMiddle(): {x: number; z: number} {
    const [house, farm] = defaultHomePlots();
    return farm ? {x: (house.x + farm.x) / 2, z: (house.z + farm.z) / 2} : {x: house.x, z: house.z};
}

const GOOD_ZONES = new Set(["farm_garden", "grassland"]);
/** How far from the village's middle a plot may stand (m), and the turns from facing it that are tried. */
const REACH = 100;
const TURNS = [0, 0.4, -0.4, 0.8, -0.8, Math.PI / 2, -Math.PI / 2];

/** How well a candidate plot fits (lower is better), or null: off dry, gentle land, in a forest, or with something in its core. */
function fitness(plot: HomePlot, middle: {x: number; z: number}): number | null {
    const frame = plotFrame(plot);
    const zone = zoneAt(sampleGround(plot.x, plot.z)) as string;
    if (!GOOD_ZONES.has(zone) && zone !== "desert") return null;
    const land = plot.kind === "house" ? FOOTPRINT.house : (() => {
        const rect = paddockRect(plot);
        const core = CORE.smallholding;
        return {x0: Math.min(core.x0, rect.x0), x1: Math.max(core.x1, rect.x1), z0: Math.min(core.z0, rect.z0), z1: Math.max(core.z1, rect.z1)};
    })();
    let lo = Infinity;
    let hi = -Infinity;
    let crops = 0;
    // Every 2 m across its ground and a metre round it, its edges included.
    const span = (a: number, b: number) => Array.from({length: Math.ceil((b - a + 2) / 2) + 1}, (_, i) => Math.min(a - 1 + i * 2, b + 1));
    for (const lx of span(land.x0, land.x1)) {
        for (const lz of span(land.z0, land.z1)) {
            const w = frame.toWorld(lx, lz);
            const g = sampleGround(w.x, w.z);
            if (g.land < 0.9 || g.height < 0.4 || riverDistance(w.x, w.z) < 3) return null;
            lo = Math.min(lo, g.height);
            hi = Math.max(hi, g.height);
            if (cropAt(w.x, w.z)) crops++;
        }
    }
    if (hi - lo > (plot.kind === "house" ? 2.5 : 3.5)) return null;
    const core = CORE[plot.kind];
    let inside = 0;
    for (const o of homeObstacles()) {
        if (Math.abs(o.x - plot.x) > 20 || Math.abs(o.z - plot.z) > 20) continue;
        const p = frame.toLocal(o.x, o.z);
        if (p.x > core.x0 - o.r && p.x < core.x1 + o.r && p.z > core.z0 - o.r && p.z < core.z1 + o.r) return null;
        if (p.x > land.x0 && p.x < land.x1 && p.z > land.z0 && p.z < land.z1) inside++;
    }
    return Math.hypot(plot.x - middle.x, plot.z - middle.z) + crops * 2 + inside * 1.5 + (hi - lo) * 2 + (GOOD_ZONES.has(zone) ? 0 : 25);
}

/**
 * The reserved plots past today's two, in their fixed order (15 houses and
 * 5 smallholdings): each the best-fitting candidate (on a 3 m grid within
 * 100 m of the village, facing its middle or turned) clear of those before it.
 * Slow (a few seconds): `scripts/ark-map-hamlet.mts` writes it to
 * `hamlet-slots.json`, which the scene reads; a test checks it is fresh.
 */
export function planHamletSlots(): HomePlot[] {
    const middle = villageMiddle();
    const taken = defaultHomePlots().map(plotFootprint);
    const candidates = new Map<HomePlot["kind"], Array<{plot: HomePlot; score: number}>>();
    for (const kind of ["house", "smallholding"] as const) {
        const list: Array<{plot: HomePlot; score: number}> = [];
        for (let x = middle.x - REACH; x <= middle.x + REACH; x += 3) {
            for (let z = middle.z - REACH; z <= middle.z + REACH; z += 3) {
                if (Math.hypot(x - middle.x, z - middle.z) > REACH || Math.hypot(x - middle.x, z - middle.z) < 6) continue;
                const facing = Math.atan2(middle.x - x, middle.z - z);
                for (const turn of TURNS) {
                    // (Each candidate its own id: the props cache a plot's paddock by its id.)
                    const rotation = Math.round((facing + turn) * 1000) / 1000;
                    const plot: HomePlot = {id: `candidate:${kind}:${x}:${z}:${rotation}`, kind, x, z, rotation, ...(kind === "smallholding" ? {barn: true} : {})};
                    const score = fitness(plot, middle);
                    if (score !== null) list.push({plot, score});
                }
            }
        }
        list.sort((a, b) => a.score - b.score || a.plot.x - b.plot.x || a.plot.z - b.plot.z || a.plot.rotation - b.plot.rotation);
        candidates.set(kind, list);
    }
    const out: HomePlot[] = [];
    const counts = {house: 0, smallholding: 0};
    for (const kind of SLOT_ORDER) {
        for (const {plot} of candidates.get(kind)!) {
            // (Its footprint by its candidate id: the props cache a paddock by the plot's id.)
            const footprint = plotFootprint(plot);
            if (taken.some((other) => overlap(footprint, other, 1))) continue;
            const placed: HomePlot = {...plot, id: `${kind}-${counts[kind] + 1}`};
            taken.push(footprint);
            counts[kind]++;
            out.push(placed);
            break;
        }
    }
    return out;
}

const SLOTS = (slotTable as unknown as {plots: HomePlot[]}).plots;

/**
 * The hamlet's plots for this many house and farm residents: today's
 * cottage and barn first (`defaultHomePlots`), then the reserved houses and
 * smallholdings in their fixed order. Append-only: more residents only add
 * plots at the end of each kind's list. Capped by the reserved slots the
 * island's land holds (`hamlet-slots.json`): past them, residents share the
 * plots there are (and fewer of each are out at once).
 */
export function homePlots(houseResidents: number, farmResidents: number): HomePlot[] {
    const houses = houseCount(houseResidents);
    const farms = smallholdingCount(farmResidents);
    const plots = defaultHomePlots();
    plots.push(...SLOTS.filter((plot) => plot.kind === "house").slice(0, houses - 1));
    plots.push(...SLOTS.filter((plot) => plot.kind === "smallholding").slice(0, farms - 1));
    return plots;
}

/** Every reserved plot (today's two and all the slots): their land is kept off the map's spawn cells. */
export function reservedPlots(): HomePlot[] {
    return [...defaultHomePlots(), ...SLOTS];
}

let reserved: Array<{plot: HomePlot; corners: Array<{x: number; z: number}>; box: Rect}> | null = null;

/** Is this point on a reserved plot's land (past today's two: their ground was the map's before)? */
export function reservedAt(x: number, z: number): boolean {
    reserved ??= SLOTS.map((plot) => {
        const c = plotFootprint(plot);
        return {plot, corners: c, box: {x0: Math.min(...c.map((p) => p.x)), x1: Math.max(...c.map((p) => p.x)), z0: Math.min(...c.map((p) => p.z)), z1: Math.max(...c.map((p) => p.z))}};
    });
    for (const r of reserved) {
        if (x < r.box.x0 || x > r.box.x1 || z < r.box.z0 || z > r.box.z1) continue;
        let inside = true;
        for (let i = 0; i < 4 && inside; i++) {
            const p = r.corners[i];
            const q = r.corners[(i + 1) % 4];
            inside = (q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x) <= 0;
        }
        if (inside) return true;
    }
    return false;
}

// MARK: - Templates

export type SpotSize = "small" | "medium" | "large";
export type PlotSpot = {x: number; y: number; z: number; /** Who may stand there: by body. */ sizes: readonly SpotSize[]; where: "lawn" | "paddock" | "yard" | "run"};
export type PlotSpots = {plot: HomePlot; door: {x: number; y: number; z: number}; coopDoor?: {x: number; y: number; z: number}; window?: {x: number; y: number; z: number}; spots: PlotSpot[]};

const spotCache = new Map<string, PlotSpots>();

/** A plot's doors and outdoor spots (world). */
export function plotSpots(plot: HomePlot): PlotSpots {
    const key = `${plot.id}|${plot.x}|${plot.z}|${plot.rotation}`;
    const cached = spotCache.get(key);
    if (cached) return cached;
    const frame = plotFrame(plot);
    const at = (lx: number, lz: number, y?: number) => {
        const w = frame.toWorld(lx, lz);
        return {x: w.x, y: y ?? sampleGround(w.x, w.z).height, z: w.z};
    };
    let out: PlotSpots;
    if (plot.kind === "house") {
        const halfD = COTTAGE.depth / 2;
        // The lawn either side of the path (the gate's gap is near x = 0), inside the picket fence.
        const lawn: Array<[number, number]> = [[-3, halfD + 2], [3, halfD + 2], [-3, halfD + 4], [3, halfD + 4], [-2.2, GARDEN.gateZ - 1.2], [2.2, GARDEN.gateZ - 1.2]];
        out = {
            plot,
            door: at(0, halfD + 0.3, frame.floor),
            window: at(1.6, halfD + 0.05, frame.floor + 1.2),
            spots: lawn.map(([lx, lz]) => ({...at(lx, lz), sizes: ["small", "medium", "large"] as const, where: "lawn" as const}))
        };
    } else {
        const rect = paddockRect(plot);
        const spots: PlotSpot[] = [];
        // The paddock: four by three inside its fence.
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) spots.push({...at(rect.x0 + 1.2 + (i + 0.5) * (rect.x1 - rect.x0 - 2.4) / 4, rect.z0 + 1.1 + (j + 0.5) * (rect.z1 - rect.z0 - 2.2) / 3), sizes: ["medium", "large"], where: "paddock"});
        // The yard: in front of the barn, on the side away from the paddock.
        const yardZ = rect.z0 > 0 ? -5 : 5;
        for (const lx of [-5, -3, -1, 1, 3, 5]) spots.push({...at(lx, yardZ), sizes: ["small", "medium"], where: "yard"});
        // The coop's run: round the coop.
        const coop = coopSpot(plot);
        for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2 + 0.3;
            spots.push({...at(coop.x + Math.cos(a) * 1.5, coop.z + Math.sin(a) * 1.5), sizes: ["small"], where: "run"});
        }
        out = {plot, door: at(0, yardZ > 0 ? 3.4 : -3.4), coopDoor: at(coop.x, coop.z), spots};
    }
    spotCache.set(key, out);
    return out;
}

// MARK: - Residents

export type HamletArea = "house" | "farm";

/** A hamlet resident's area (the server's `voyage_animals.area`, from the capture's setting), or null: placed by the map. */
export function residentArea(animal: Pick<ArkAnimal, "area">): HamletArea | null {
    return animal.area === "house" || animal.area === "farm" ? animal.area : null;
}

/** A stable 32-bit hash (FNV-1a, as `live-budget.ts` arkHash). */
export function hamletHash(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * A resident's plot: of its area's kind (a house for a pet, a smallholding
 * for livestock and poultry), the one with the highest hash of (its id, the
 * plot's id): a new plot takes only the residents it wins.
 */
export function plotOf(animal: Pick<ArkAnimal, "id" | "area">, plots: readonly HomePlot[]): HomePlot | null {
    const area = residentArea(animal);
    if (!area) return null;
    const kind: HomePlot["kind"] = area === "house" ? "house" : "smallholding";
    let best: HomePlot | null = null;
    let score = -1;
    for (const plot of plots) {
        if (plot.kind !== kind) continue;
        const h = hamletHash(`${animal.id}#${plot.id}`);
        if (h > score || (h === score && best && plot.id < best.id)) {
            score = h;
            best = plot;
        }
    }
    return best;
}

/** The plots for a snapshot's residents (its house and farm animals). */
export function hamletPlotsFor(animals: ReadonlyArray<Pick<ArkAnimal, "area">>): HomePlot[] {
    let house = 0;
    let farm = 0;
    for (const animal of animals) {
        const area = residentArea(animal);
        if (area === "house") house++;
        else if (area === "farm") farm++;
    }
    return homePlots(house, farm);
}

// MARK: - Indoors and out

export type OutKind = "dog" | "cat" | "poultry" | "livestock" | "pigeon" | "small_pet" | "indoor" | "other";

const POULTRY = /chicken|(^|-)hen($|-)|junglefowl|duck|goose|turkey|quail|peafowl|peacock|guineafowl|pheasant/;
const LIVESTOCK = /cow|cattle|(^|-)ox($|-)|buffalo|(^|-)bull|horse|pony|donkey|mule|goat|sheep|(^|-)pig($|-)|boar|alpaca|llama|camel|yak|zebu|watusi|bison/;
const DOG = /(^|-)dog($|-)|terrier|retriever|shepherd|hound|poodle|spaniel|bulldog|collie|husky|labrador|beagle|dachshund|pug|chihuahua|corgi|rottweiler|dobermann|doberman|mastiff|schnauzer|setter|pointer/;
const CAT = /(^|-)cat($|-)|kitten|persian|siamese|maine-coon|ragdoll|sphynx|bengal-cat/;
const CAGED = /canary|budgerigar|parakeet|cockatiel|lovebird|zebra-finch|parrot|macaw|cockatoo|conure|hamster|gerbil|chinchilla|(^|-)mouse($|-)|(^|-)rat($|-)/;
const PIGEON = /pigeon|dove/;
const SMALL_PET = /rabbit|guinea-pig|cavy|ferret|tortoise/;

/** How a resident spends its day, by its kind (its kind's slug, else its model's) and body. */
export function outKind(slug: string): OutKind {
    if (DOG.test(slug)) return "dog";
    if (CAT.test(slug) && !/catfish|caterpillar|catshark/.test(slug)) return "cat";
    if (POULTRY.test(slug)) return "poultry";
    if (LIVESTOCK.test(slug)) return "livestock";
    if (CAGED.test(slug)) return "indoor";
    if (PIGEON.test(slug)) return "pigeon";
    if (SMALL_PET.test(slug)) return "small_pet";
    const body = bodyOf(slug);
    // Aquarium fish, vivarium reptiles, amphibians and invertebrates: always indoors (seen through the window, or on tap).
    if (body === "f" || body === "r" || body === "a" || body === "i") return "indoor";
    return "other";
}

/** The share of a kind out at an island hour (0–24): dogs by day, cats at dusk and night, poultry and livestock by day. */
export function outShare(kind: OutKind, hour: number): number {
    const day = hour >= 7 && hour < 19;
    switch (kind) {
        case "dog": return hour >= 7 && hour < 21 ? 0.22 : 0;
        case "cat": return hour >= 18 || hour < 6 ? 0.45 : 0.08;
        case "poultry": return day ? 0.85 : 0;
        case "livestock": return day ? 0.7 : 0.05;
        case "pigeon": return hour >= 7 && hour < 18 ? 0.6 : 0;
        case "small_pet": return hour >= 9 && hour < 17 ? 0.3 : 0;
        case "indoor": return 0;
        default: return day ? 0.3 : 0.05;
    }
}

/** How big a resident is for a spot (true length, m). */
export function spotSize(length: number): SpotSize {
    return length >= 1 ? "large" : length >= 0.35 ? "medium" : "small";
}

/** `live-budget.ts` arkOutside's contract (runtime lane): who of these is out within the budget at this time. */
export type ArkOutsideFn = (candidates: ReadonlyArray<{id: string; group: string}>, budget: number, epochSeconds: number) => Set<string>;

/** The rotation's step (s): `live-budget.ts` ARK_REST_STEP_SECONDS. */
export const HAMLET_STEP_SECONDS = 300;
/** A door beat's length (s): walking out to a spot, or back in. */
export const DOOR_SECONDS = 20;

/**
 * The runtime lane's rotation (`live-budget.ts` arkOutside), for a lane that
 * does not have it merged: within each group a window of its quota on a
 * ring by id hash, moving on one each step; quotas by group size, at least
 * one each. The scene passes the runtime's own function when both are in.
 */
export const ringOutside: ArkOutsideFn = (candidates, budget, epochSeconds) => {
    const out = new Set<string>();
    if (candidates.length <= budget) {
        for (const c of candidates) out.add(c.id);
        return out;
    }
    const groups = new Map<string, Array<{id: string; group: string}>>();
    for (const c of candidates) groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
    const step = Math.floor(epochSeconds / HAMLET_STEP_SECONDS);
    const keys = Array.from(groups.keys()).sort();
    // Quotas: at least one each where the budget allows, the rest by size (largest remainders, by key on ties).
    const total = candidates.length;
    const quota = new Map<string, number>();
    let left = budget;
    for (const key of keys) {
        const q = Math.min(groups.get(key)!.length, Math.floor((groups.get(key)!.length / total) * budget));
        quota.set(key, q);
        left -= q;
    }
    for (const key of keys.sort((a, b) => groups.get(b)!.length - groups.get(a)!.length || (a < b ? -1 : 1))) {
        if (left <= 0) break;
        if (quota.get(key)! < groups.get(key)!.length) {
            quota.set(key, quota.get(key)! + 1);
            left--;
        }
    }
    for (const key of keys) {
        const ring = groups.get(key)!.map((c) => ({id: c.id, h: hamletHash(c.id)})).sort((a, b) => a.h - b.h || (a.id < b.id ? -1 : 1));
        const start = (step + (hamletHash(`phase:${key}`) % ring.length)) % ring.length;
        for (let i = 0; i < quota.get(key)!; i++) out.add(ring[(start + i) % ring.length].id);
    }
    return out;
};

export type HamletResident = {id: string; slug: string; length: number; plot: HomePlot};
export type HamletOut = {plot: HomePlot; spot: number; at: {x: number; y: number; z: number}};
export type HamletBeat = {kind: "out" | "in"; from: {x: number; y: number; z: number}; to: {x: number; y: number; z: number}; t: number};

/** Who is out at a step, and on which spot (per plot: its share now, never more than its spots; each on a spot its size may use). */
function outAtStep(residents: readonly HamletResident[], step: number, hours: (epochSeconds: number) => number, outside: ArkOutsideFn): Map<string, HamletOut> {
    const epoch = step * HAMLET_STEP_SECONDS;
    const hour = hours(epoch);
    const byPlot = new Map<string, HamletResident[]>();
    for (const r of residents) byPlot.set(r.plot.id, [...(byPlot.get(r.plot.id) ?? []), r]);
    const out = new Map<string, HamletOut>();
    for (const list of Array.from(byPlot.values())) {
        const plot = list[0].plot;
        const spots = plotSpots(plot);
        const eligible = list.filter((r) => outShare(outKind(r.slug), hour) > 0);
        const share = eligible.reduce((sum, r) => sum + outShare(outKind(r.slug), hour), 0);
        const budget = Math.min(Math.round(share), spots.spots.length);
        const chosen = outside(eligible.map((r) => ({id: r.id, group: outKind(r.slug)})), budget, epoch);
        // Spots: each in a fixed order (by its id's hash) takes the first free spot its size may use, from its own preferred one.
        const free = spots.spots.map(() => true);
        for (const r of eligible.filter((e) => chosen.has(e.id)).sort((a, b) => hamletHash(a.id) - hamletHash(b.id) || (a.id < b.id ? -1 : 1))) {
            const size = spotSize(r.length);
            const n = spots.spots.length;
            const first = hamletHash(`${r.id}#spot`) % n;
            for (let k = 0; k < n; k++) {
                const i = (first + k) % n;
                if (!free[i] || !spots.spots[i].sizes.includes(size)) continue;
                free[i] = false;
                out.set(r.id, {plot, spot: i, at: spots.spots[i]});
                break;
            }
        }
    }
    return out;
}

const stepCache = new Map<string, Map<string, HamletOut>>();

/**
 * The hamlet now: who is out and where, and the door beats of the step's
 * first `DOOR_SECONDS` (an animal going out walks from its door to its spot;
 * one coming in walks from its spot to its door; one that changed spots
 * walks across). Everyone else of the residents is indoors (not drawn).
 */
export function hamletState(residents: readonly HamletResident[], epochSeconds: number, hours: (epochSeconds: number) => number, outside: ArkOutsideFn = ringOutside): {out: Map<string, HamletOut>; beats: Map<string, HamletBeat>} {
    const step = Math.floor(epochSeconds / HAMLET_STEP_SECONDS);
    const key = (s: number) => `${s}|${residents.length}|${residents[0]?.id ?? ""}|${residents[residents.length - 1]?.id ?? ""}`;
    const at = (s: number) => {
        let m = stepCache.get(key(s));
        if (!m) {
            m = outAtStep(residents, s, hours, outside);
            if (stepCache.size > 8) stepCache.clear();
            stepCache.set(key(s), m);
        }
        return m;
    };
    const now = at(step);
    const into = epochSeconds - step * HAMLET_STEP_SECONDS;
    const beats = new Map<string, HamletBeat>();
    if (into < DOOR_SECONDS) {
        const before = at(step - 1);
        const t = into / DOOR_SECONDS;
        const doorOf = (out: HamletOut, slug: string) => {
            const spots = plotSpots(out.plot);
            return outKind(slug) === "poultry" && spots.coopDoor ? spots.coopDoor : spots.door;
        };
        const slugs = new Map(residents.map((r) => [r.id, r.slug]));
        now.forEach((out, id) => {
            const was = before.get(id);
            if (!was) beats.set(id, {kind: "out", from: doorOf(out, slugs.get(id)!), to: out.at, t});
            else if (was.spot !== out.spot || was.plot.id !== out.plot.id) beats.set(id, {kind: "out", from: was.at, to: out.at, t});
        });
        before.forEach((was, id) => {
            if (!now.has(id) && slugs.has(id)) beats.set(id, {kind: "in", from: was.at, to: doorOf(was, slugs.get(id)!), t});
        });
    }
    return {out: now, beats};
}

/** The village's middle and its reach, for the validator and the reports. */
export function hamletCentre(): {x: number; z: number} {
    return villageMiddle();
}

/** The home zone's site (for reports). */
export const HOME_SITE = ZONE_SITES.farm_garden;
