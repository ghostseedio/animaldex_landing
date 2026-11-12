#!/usr/bin/env -S npx tsx
/**
 * The positions atlas (encounter hunting; AnimalDex docs/ark/encounter-hunting.md): where every Ark species' clusters
 * stand, from the scene's own population-independent grid (the map's tag cells, attach points, water cells, the lake's
 * and the coasts' spots), so the server's shared position module (`src/ark-scene/positions/positions.ts`, a pinned copy
 * of AnimalDex `supabase/functions/_shared/ark-positions/positions.ts`) finds each home where the scene draws it.
 *
 *   npx tsx scripts/ark-positions-atlas.mts --catalogue <voyage_species.json> --slots <zone-slots.json> --out <part.json> [--shard k/n] [--limit N]
 *   npx tsx scripts/ark-positions-atlas.mts --merge <part.json,part.json,...> --out <atlas.json> [--report <r.json>]
 *
 * - catalogue: [[species_profile_id, model_slug, zone], ...] (production's voyage_species, public catalogue data).
 * - slots: {zone: how many slots to cover} (explicit tables only; the recipes cover every slot).
 *
 * Per species and zone it records a RECIPE (the scene's pick on the same lists, ported in positions.ts), learnt by
 * tracing the scene's placement (`map/place.ts` traceMapPlace), and VERIFIES it on EVERY slot the zone needs (`slots`,
 * about twice today's highest): where the module's home is more than EPS from the scene's own spot (rank 0), that slot
 * gets an override (the scene's spot); a recipe missing on more than a fifth of them is replaced by an explicit table.
 * Past the covered slots the recipe answers alone. Shards run in parallel; --merge joins them and adds the mask.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {placeAnimals, slotKind} from "../src/ark-scene/placement.ts";
import {mapPoints, traceMapPlace, wetOf} from "../src/ark-scene/map/place.ts";
import {mapSpecies} from "../src/ark-scene/map/species.ts";
import {waterClassOf} from "../src/ark-scene/map/water.ts";
import {speciesDepth, waterHomeSpot, inHomeWater, LAKE_SWIM_RADIUS} from "../src/ark-scene/sea-depth.ts";
import {behaviourProfile} from "../src/ark-scene/behaviour-profile.ts";
import {amphibious, aquatic, homeRadius} from "../src/ark-scene/behaviour-schedule.ts";
import {displayLength} from "../src/ark-scene/sizes.ts";
import {arkStats} from "../src/ark-scene/stats.ts";
import {LAKE, ZONE_SITES} from "../src/ark-scene/world.ts";
import {ARK_ZONES, type ArkAnimal, type ArkZone} from "../src/ark-scene/types.ts";
import {decodeAtlas, homeCentre} from "../src/ark-scene/positions/positions.ts";

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
const merging = args.has("merge");
// (Species with no model have no slug: they never come aboard, D1.)
const catalogue = merging ? [] : (JSON.parse(readFileSync(args.get("catalogue")!, "utf8")) as Array<[string, string | null, string]>).filter((r): r is [string, string, string] => typeof r[1] === "string");
const zoneSlots = merging ? {} : (JSON.parse(readFileSync(args.get("slots")!, "utf8")) as Record<string, number>);
const limit = Number(args.get("limit") ?? catalogue.length);
const [shard, shards] = (args.get("shard") ?? "0/1").split("/").map(Number);
/** A recipe's spot this far (m) from the scene's own is overridden (the scene's settle moves a spot up to about 2 m). */
const EPS = Number(args.get("eps") ?? 2.6);
const started = performance.now();

// ---------------------------------------------------------------------------------------------------------------
// Lists (deduplicated by content), int16 decimetres, base64

const lists: string[] = [];
const listIndex = new Map<string, number>();
function listOf(points: ReadonlyArray<{x: number; z: number}>): number {
    const buf = Buffer.alloc(points.length * 4);
    points.forEach((p, i) => {
        buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(p.x * 10))), i * 4);
        buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(p.z * 10))), i * 4 + 2);
    });
    const b64 = buf.toString("base64");
    let id = listIndex.get(b64);
    if (id === undefined) {
        id = lists.length;
        lists.push(b64);
        listIndex.set(b64, id);
    }
    return id;
}

const recipes: unknown[][] = [];
const recipeIndex = new Map<string, number>();
function recipeOf(r: unknown[]): number {
    const key = JSON.stringify(r);
    let id = recipeIndex.get(key);
    if (id === undefined) {
        id = recipes.length;
        recipes.push(r);
        recipeIndex.set(key, id);
    }
    return id;
}

const sheets: unknown[][] = [];
const sheetIndex = new Map<string, number>();
function sheetOf(row: unknown[]): number {
    const key = JSON.stringify(row);
    let id = sheetIndex.get(key);
    if (id === undefined) {
        id = sheets.length;
        sheets.push(row);
        sheetIndex.set(key, id);
    }
    return id;
}

// ---------------------------------------------------------------------------------------------------------------
// The scene's placement, one animal at a time, with its route traced

type Traced = {x: number; z: number; route: string; list: ReadonlyArray<{x: number; z: number}> | null; own: boolean};
let route = "";
let tracedList: ReadonlyArray<{x: number; z: number}> | null = null;
let tracedOwn = false;
traceMapPlace({
    route(name) {
        route = name;
    },
    attach(list, own) {
        tracedList = list;
        tracedOwn = own;
    }
});

function animalFor(id: string, slug: string, zone: ArkZone, slot: number): ArkAnimal {
    return {id: `atlas-${slug}-${zone}-${slot}`, species_profile_id: id, name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-01-01T00:00:00Z", brought_by: {label: "atlas", named: false}, mine: false, slot, slot_rank: 0} as ArkAnimal;
}

function sceneAt(id: string, slug: string, zone: ArkZone, slot: number): Traced {
    route = "";
    tracedList = null;
    tracedOwn = false;
    const a = animalFor(id, slug, zone, slot);
    const p = placeAnimals([a]).get(a.id)!;
    return {x: p.x, z: p.z, route: route || "nomap", list: tracedList, own: tracedOwn};
}

/** Rank-0 spots of many slots at once (no trace): the explicit tables. */
function sceneSpots(id: string, slug: string, zone: ArkZone, slots: number[]): Array<{x: number; z: number}> {
    const animals = slots.map((s) => animalFor(id, slug, zone, s));
    const placed = placeAnimals(animals);
    return animals.map((a) => {
        const p = placed.get(a.id)!;
        return {x: p.x, z: p.z};
    });
}

// ---------------------------------------------------------------------------------------------------------------
// Recipes from the trace

const ENCLOSED = new Set(["den", "burrow", "cave", "tree_hole", "crevice"]);

function tagsToTry(species: NonNullable<ReturnType<typeof mapSpecies>>): string[] {
    return [species.spawn, ...Array.from(species.allowed).filter((tag) => tag !== species.spawn && tag !== species.roost)];
}

function kindRule(id: string, slug: string, zone: ArkZone): unknown[] {
    const site = ZONE_SITES[zone] ?? ZONE_SITES.farm_garden;
    if (site.kind === "shore") return ["plain"];
    const {dominance, rarity} = arkStats({model_slug: slug} as ArkAnimal);
    const rare = rarity - 65;
    const dominant = dominance - 80;
    if (rare >= 0 && rare >= dominant) return ["rare", Math.min(Math.max((rarity - 55) * 1.6, 0), 70), site.kind === "sea" ? 1 : 0];
    void id;
    return [dominant >= 0 && site.kind !== "ring" ? "core" : "plain"];
}

function tagRecipe(id: string, slug: string, zone: ArkZone): unknown[] | null {
    const species = mapSpecies(slug, zone);
    if (!species) return null;
    const all = mapPoints();
    const entries: number[][] = [];
    for (const tag of tagsToTry(species)) {
        const wet = wetOf(species, tag as never);
        const partition = all.partitionOf(tag as never, wet, zone);
        if (!partition.list.length) continue;
        const own = partition.own;
        const n = partition.list.length;
        const borrowers = partition.borrowers ?? ARK_ZONES;
        const entry = [own ? 1 : 0, n, borrowers.length, Math.max(borrowers.indexOf(zone), 0), listOf(partition.list)];
        if (own && n >= 12) for (const k of ["core", "cover", "edge", "plain"] as const) entry.push(listOf(all.kindOf(partition.list, k)));
        entries.push(entry);
    }
    return entries.length ? ["P", kindRule(id, slug, zone), entries] : null;
}

let lakeList: number | null = null;
function lakeRecipe(): unknown[] {
    if (lakeList === null) {
        // sea-depth's lakeSpot base spots (LAKE_SPACING 2.1 on a golden-angle spiral, in the lake's open water).
        const spots: Array<{x: number; z: number}> = [];
        const GOLDEN = Math.PI * (3 - Math.sqrt(5));
        for (let k = 0; ; k++) {
            const radius = (2.1 / Math.sqrt(Math.PI)) * Math.sqrt(k + 0.5);
            if (radius > LAKE_SWIM_RADIUS) break;
            const x = LAKE.x + Math.cos(k * GOLDEN) * radius;
            const z = LAKE.z + Math.sin(k * GOLDEN) * radius;
            if (inHomeWater("lake", x, z)) spots.push({x, z});
        }
        lakeList = listOf(spots);
    }
    return ["L", lakeList, LAKE.x, LAKE.z];
}

const coastLists = new Map<string, number>();
function coastRecipe(zone: ArkZone): unknown[] {
    let id = coastLists.get(zone);
    if (id === undefined) {
        const depth = {band: "mid", water: "salt", home: "coast", breathes: false, crevice: false, deepFloor: false, glow: false, reason: "", source: "default"} as const;
        const n = zoneSlots[zone] ?? 256;
        const spots: Array<{x: number; z: number}> = [];
        for (let s = 0; s < n; s++) {
            const spot = waterHomeSpot(depth as never, zone, s, 0, 0)!;
            spots.push({x: spot.x, z: spot.z});
        }
        id = listOf(spots);
        coastLists.set(zone, id);
    }
    return ["C", id];
}

function waterRecipe(slug: string, zone: ArkZone): unknown[] | null {
    const depth = speciesDepth(slug, zone);
    if (!depth) return null;
    const cls = waterClassOf(depth, zone);
    if (cls === "lake") return lakeRecipe();
    if (cls === "coast") return coastRecipe(zone);
    const {list, own} = mapPoints().water.listFor(cls, zone);
    if (!list.length) return coastRecipe(zone);
    return ["W", listOf(list), own ? 1 : 0];
}

function sheetRow(slug: string, zone: ArkZone): number {
    const profile = behaviourProfile(slug);
    const len = displayLength(slug);
    const hr = homeRadius(profile, {id: slug, zone, home: {x: 0, y: 0, z: 0}, length: len, sea: false, range: null});
    const depth = speciesDepth(slug, zone);
    const flags = (profile.move === "fly" ? 1 : 0) | (aquatic(profile) ? 2 : 0) | (amphibious(profile) ? 4 : 0);
    return sheetOf([profile.move, Math.round(len * 100) / 100, Math.round(hr * 100) / 100, profile.roost, ENCLOSED.has(profile.roost) ? 1 : 0, depth?.band ?? "", depth?.water ?? "", profile.activity, flags]);
}

// ---------------------------------------------------------------------------------------------------------------
// Every slot the zone needs, against the scene

type Part = {sheet: unknown[]; zone: number; recipe: unknown[]; lists: string[]; overrides: [number[], number] | null; route: string; misses: number; checked: number; worst: number};

/** A part's recipe refers to its own `lists` (ids into it); --merge renumbers them. */
function partOf(id: string, slug: string, zone: ArkZone): Part {
    lists.length = 0;
    listIndex.clear();
    lakeList = null;
    coastLists.clear();
    const need = zoneSlots[zone] ?? 256;
    const first = sceneAt(id, slug, zone, 0);
    let recipe: unknown[] | null = null;
    if (first.route === "tag") recipe = tagRecipe(id, slug, zone);
    else if (first.route === "attach" && first.list) recipe = ["I", listOf(first.list), first.own ? 1 : 0];
    else if (first.route === "water") recipe = waterRecipe(slug, zone);
    const sheet = sheets[sheetRow(slug, zone)];
    const slots = Array.from({length: need}, (_, s) => s);
    const truth = sceneSpots(id, slug, zone, slots);
    if (recipe) {
        const atlas = decodeAtlas({v: 1, zones: [...ARK_ZONES], islands: {wild: {mask: {x0: 0, z0: 0, cell: 1, nx: 0, nz: 0, data: ""}, lists, recipes: [recipe], species: {[slug]: [0, ARK_ZONES.indexOf(zone), 0, -1]}, sheets: [sheet], overrides: []}}});
        const missSlots: number[] = [];
        const missSpots: Array<{x: number; z: number}> = [];
        let worst = 0;
        for (const s of slots) {
            const c = homeCentre(atlas, {zone, slug, speciesId: id, slot: s});
            const e = c ? Math.hypot(c.x - truth[s].x, c.z - truth[s].z) : Infinity;
            if (e > EPS) {
                missSlots.push(s);
                missSpots.push(truth[s]);
            } else worst = Math.max(worst, e);
        }
        if (missSlots.length <= 0.2 * slots.length) {
            if (recipe[0] === "P") {
                const rule = recipe[1] as unknown[];
                for (const s of slots.slice(0, 16)) {
                    const k = slotKind(animalFor(id, slug, zone, s), s);
                    if (rule[0] !== "rare" && k !== rule[0]) throw new Error(`kind rule mismatch ${slug} ${zone} ${s}: ${k} vs ${rule[0]}`);
                }
            }
            const overrides: [number[], number] | null = missSlots.length ? [missSlots, listOf(missSpots)] : null;
            return {sheet, zone: ARK_ZONES.indexOf(zone), recipe, lists: [...lists], overrides, route: first.route, misses: missSlots.length, checked: slots.length, worst};
        }
        lists.length = 0;
        listIndex.clear();
    }
    return {sheet, zone: ARK_ZONES.indexOf(zone), recipe: ["X", listOf(truth)], lists: [...lists], overrides: null, route: first.route, misses: 0, checked: slots.length, worst: 0.07};
}

if (!merging) {
    const out: Record<string, Part> = {};
    let done = 0;
    const counts: Record<string, number> = {};
    catalogue.slice(0, limit).forEach(([id, slug, zoneName], index) => {
        if (index % shards !== shard) return;
        const zone = (ARK_ZONES as readonly string[]).includes(zoneName) ? (zoneName as ArkZone) : "farm_garden";
        const part = partOf(id, slug, zone);
        out[slug] = part;
        counts[part.recipe[0] as string] = (counts[part.recipe[0] as string] ?? 0) + 1;
        if (++done % 50 === 0) console.error(`shard ${shard}/${shards}: ${done} species, ${Math.round((performance.now() - started) / 1000)} s, ${JSON.stringify(counts)}`);
    });
    writeFileSync(args.get("out")!, JSON.stringify(out));
    console.log(JSON.stringify({shard, species: done, counts, seconds: Math.round((performance.now() - started) / 1000)}));
} else {
    // ---------------------------------------------------------------------------------------------------------------
    // Merge the parts; the mask: medium per 2 m cell (0 land, 1 fresh water, 2 sea under 1.5 m, 3 deep sea)
    lists.length = 0;
    listIndex.clear();
    const parts: Record<string, Part> = {};
    for (const path of args.get("merge")!.split(",")) Object.assign(parts, JSON.parse(readFileSync(path, "utf8")));
    const speciesOut: Record<string, number[]> = {};
    const overridesOut: Array<[number[], number]> = [];
    const counts: Record<string, number> = {};
    const routes: Record<string, number> = {};
    let checked = 0, misses = 0;
    const worst: number[] = [];
    const tables: string[] = [];
    for (const slug of Object.keys(parts).sort()) {
        const part = parts[slug];
        const remap = (i: number) => {
            const b64 = part.lists[i];
            let id = listIndex.get(b64);
            if (id === undefined) {
                id = lists.length;
                lists.push(b64);
                listIndex.set(b64, id);
            }
            return id;
        };
        const r = part.recipe.slice();
        if (r[0] === "P") r[2] = (r[2] as number[][]).map((e) => e.map((v, k) => (k >= 4 ? remap(v) : v)));
        else if (r[0] !== "F") r[1] = remap(r[1] as number);
        let ovr = -1;
        if (part.overrides) {
            ovr = overridesOut.length;
            overridesOut.push([part.overrides[0], remap(part.overrides[1])]);
        }
        speciesOut[slug] = [sheetOf(part.sheet), part.zone, recipeOf(r), ovr];
        counts[r[0] as string] = (counts[r[0] as string] ?? 0) + 1;
        routes[part.route] = (routes[part.route] ?? 0) + 1;
        checked += part.checked;
        misses += part.misses;
        worst.push(part.worst);
        if (r[0] === "X") tables.push(`${slug} (${part.route})`);
    }
    const sampler = mapPoints().sampler;
    const CELL = 2;
    const half = Math.ceil(sampler.half / CELL) * CELL;
    const nx = (2 * half) / CELL;
    const mask = Buffer.alloc(nx * nx);
    for (let j = 0; j < nx; j++) {
        for (let i = 0; i < nx; i++) {
            const g = sampler.ground(-half + (i + 0.5) * CELL, -half + (j + 0.5) * CELL);
            mask[j * nx + i] = g.water === "fresh" ? 1 : g.water === "sea" ? (g.depth < 1.5 ? 2 : 3) : 0;
        }
    }
    const atlas = {
        v: 1,
        about: "Ark positions atlas (encounter hunting): per species its sheet and, per zone, the recipe that finds its clusters' spots on the scene's own lists, with the scene's own spot wherever the recipe misses. Generated by animaldex_landing scripts/ark-positions-atlas.mts from the scene's population-independent grid; read by positions.ts (AnimalDex _shared/ark-positions, pinned copy in the web). Never edit by hand.",
        eps: EPS,
        zones: [...ARK_ZONES],
        islands: {wild: {mask: {x0: -half, z0: -half, cell: CELL, nx, nz: nx, data: mask.toString("base64")}, lists, recipes, species: speciesOut, sheets, overrides: overridesOut}}
    };
    const text = JSON.stringify(atlas) + "\n";
    writeFileSync(args.get("out")!, text);
    worst.sort((a, b) => a - b);
    const report = {species: Object.keys(parts).length, recipes: counts, routes, lists: lists.length, recipeRows: recipes.length, sheets: sheets.length, bytes: text.length, slotsChecked: checked, overridden: misses, withinEps: {p50: worst[worst.length >> 1], p99: worst[Math.floor(worst.length * 0.99)], max: worst[worst.length - 1]}, tables};
    if (args.get("report")) writeFileSync(args.get("report")!, JSON.stringify(report, null, 1));
    console.log(JSON.stringify({...report, tables: tables.length}));
}
