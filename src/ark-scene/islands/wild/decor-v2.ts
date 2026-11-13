/**
 * The bigger wild island's scenery in the motion pass's own formats (P3, docs/ark/wild-island.md §8). With `world.ts`
 * arkWorld() "v2", `decor.ts` worldDecor / forestFill / grassTufts, `floor-assets.ts` floorPlacements and `mounds.ts`
 * answer from here, built from the island's generator (`scenery.ts` wildScenery). Everything the motion pass builds
 * from the decor then follows on v2 with no change of its own:
 *
 * - L6's tree spacing and tree-pick: each canopy tree is a decor tree carrying its asset and its real height
 *   (`DecorItem.asset`, which `tree-pick.ts` treeAssetFor takes as it is), settled by `decor.ts` settle in the
 *   generator's own order (its priority): a tree that would grow into another as drawn (`tree-spacing.ts`: trunks,
 *   a trunk through a crown, fused crowns) is grown smaller, or left out; no trunk stands in a rock or a mound.
 *   The understorey is the forest fill, settled the same way under the canopy, ranked for the tiers.
 * - L6's rocks: each boulder is a decor rock of its footprint, so `rock-assets.ts` rockAssetFor picks its asset by
 *   where it lies (the mountain's and the ice's angular rocks are L6's generated ones) and sits it into its slope,
 *   and `map/rocks.ts` drawnRocks lists it. The generator's scree is left to L6's mountain (`rock-layout.ts`, run
 *   over v2's mountain), whose crags shed their own scree fans.
 * - L3's attach points (`sampler.ts`) and L5's colliders (`collide/colliders.ts`) read the decor, the fill, the
 *   drawn rocks and the floor's logs, so they come from v2's trees, rocks and logs.
 *
 * Shrubs are the decor's own shrubs (thickets allowed, off every trunk), reeds the decor's reeds, lily pads the
 * decor's pads (a few to each of the generator's beds, on the water's own level). The ground plants (ferns, flowers,
 * sedge, moss) and grass clumps are floor placements (`asset-rocks.ts` AssetFloor draws them by asset), clear of
 * trunks, rocks and logs. Grass tufts are scattered over the island's land by the decor's own rule. The coral, kelp
 * and seagrass are the reef's (`reef.ts`, round v2's reef site), the floes and cave mouths the map's landmarks.
 *
 * Nothing stands in a land zone's clearing (the animals' ground) or on a micro corner (`micro-decor.ts`, whose canopy
 * trees stand first). Pure and deterministic: the generator, the world and fixed seeds.
 */

import manifest from "@/ark-scene/assets-manifest.json";
import {addMoundsTo, addRockTo, settle, tone, type DecorItem, type DecorKind, type FillItem, type GrassTuft, type Pending} from "@/ark-scene/decor";
import type {FloorPlacement} from "@/ark-scene/floor-assets";
import {microDecor, type MicroDecorItem} from "@/ark-scene/micro-decor";
import {inRock} from "@/ark-scene/map/rocks";
import {allMounds, moundFoot} from "@/ark-scene/mounds";
import {rockAssetFor, rockBase} from "@/ark-scene/rock-assets";
import {treeBody, TreeSpacing} from "@/ark-scene/tree-spacing";
import {assetTreePlacement} from "@/ark-scene/tree-pick";
import {fbm, heightAt, sampleGround, seeded, smoothstep, ZONE_SITES, zoneAt} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";
import {wildScenery, type WildItem} from "@/ark-scene/islands/wild/scenery";
import {type WildGroundSample} from "@/ark-scene/islands/wild/ground";
import {gridSlope} from "@/ark-scene/islands/wild/terrain-cache";
import {wildLandBounds} from "@/ark-scene/islands/wild/index";
import {DECOR_APPENDED, appendLast, ledgerKey} from "@/ark-scene/islands/wild/ledger";

type AssetInfo = {height: number; crown_radius?: number; bounds?: {min: [number, number, number]; max: [number, number, number]}};
const ASSETS = (manifest as unknown as {assets: Record<string, AssetInfo>}).assets;

/** The decor kind each of the generator's tree families is (`tree-pick.ts` makes the same families from these). */
const DECOR_KIND: Record<string, DecorKind> = {
    oak: "broadleaf",
    beech: "broadleaf",
    birch: "broadleaf",
    willow: "broadleaf",
    snag: "broadleaf",
    apple: "broadleaf",
    mangrove: "broadleaf",
    emergent: "rainforest",
    pine: "conifer",
    spruce: "conifer",
    acacia: "acacia",
    palm: "palm"
};

/** The procedural rock's footprint at scale 1 (`rock-assets.ts` OLD_FOOTPRINT): a decor rock's size is its footprint over this. */
const ROCK_FOOTPRINT = 1.75;
/** The largest decor rock (m across, over ROCK_FOOTPRINT): the mountain's biggest blocks are its crags (`rock-layout.ts`). */
const ROCK_SCALE_MOST = 4;
/** `vegetation.ts` shrub(): about 0.65 m in radius at scale 1. */
const SHRUB_RADIUS = 0.65;
/** `vegetation.ts` reeds: about 1.8 m tall at scale 1. */
const REED_HEIGHT = 1.8;

const frac = (v: number) => v - Math.floor(v);
function unit(x: number, z: number, salt: number): number {
    return frac(Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453);
}
const family = (asset: string) => asset.replace(/-[a-z]$/, "");
const letter = (asset: string) => Math.max(0, "abc".indexOf(asset.slice(-1)));
const wild = (x: number, z: number) => sampleGround(x, z) as unknown as WildGroundSample;

/** A footprint's mean width (m) at scale 1. */
function across(id: string): number {
    const b = ASSETS[id]?.bounds;
    return b ? (b.max[0] - b.min[0] + (b.max[2] - b.min[2])) / 2 : 2;
}

// MARK: - Where nothing stands

/** The land zones' clearings: the animals' own ground (decor.ts keeps its scatter out of them). */
function clearings(): Array<{x: number; z: number; r: number}> {
    return (Object.keys(ZONE_SITES) as ArkZone[]).map((zone) => ZONE_SITES[zone]).filter((site) => site.kind === "land" && site.clearing > 0).map((site) => ({x: site.x, z: site.z, r: site.clearing}));
}

/** A small spatial index of discs (x, z, r). */
class Discs {
    private readonly cells = new Map<string, Array<[number, number, number]>>();
    constructor(private readonly size = 6) {}
    add(x: number, z: number, r: number) {
        for (let i = Math.floor((x - r) / this.size); i <= Math.floor((x + r) / this.size); i++) {
            for (let j = Math.floor((z - r) / this.size); j <= Math.floor((z + r) / this.size); j++) {
                const key = `${i},${j}`;
                const list = this.cells.get(key);
                if (list) list.push([x, z, r]);
                else this.cells.set(key, [[x, z, r]]);
            }
        }
    }
    hits(x: number, z: number, r: number): boolean {
        for (let i = Math.floor((x - r) / this.size); i <= Math.floor((x + r) / this.size); i++) {
            for (let j = Math.floor((z - r) / this.size); j <= Math.floor((z + r) / this.size); j++) {
                for (const [ox, oz, or] of this.cells.get(`${i},${j}`) ?? []) if (Math.hypot(ox - x, oz - z) < or + r) return true;
            }
        }
        return false;
    }
}

/** The micro corners' patches (flowers, litter, stones, the canopy trees' feet), kept to themselves. */
function microKeepOut(micro: readonly MicroDecorItem[]): Discs {
    const discs = new Discs();
    for (const item of micro) discs.add(item.x, item.z, item.kind === "canopy" ? 1.2 : item.kind === "rock" ? 0.9 * item.scale + 0.4 : 0.6);
    return discs;
}

/** Out of every clearing and every micro patch, by `r` (m). */
function openGround(x: number, z: number, r: number, keep: Discs, cleared: ReadonlyArray<{x: number; z: number; r: number}>): boolean {
    for (const c of cleared) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false;
    return !keep.hits(x, z, r);
}

// MARK: - The decor

/** A canopy or understorey tree as a decor tree: its asset at its own scale, its foot on the ground. */
function treeItem(w: WildItem): DecorItem | null {
    if (!w.asset) return null;
    const kind = DECOR_KIND[family(w.asset)];
    if (!kind) return null;
    const s = sampleGround(w.x, w.z);
    const item: DecorItem = {kind, variant: letter(w.asset), x: w.x, y: s.height, z: w.z, scale: w.scale, rotation: w.yaw, color: tone(zoneAt(s), kind, unit(w.x, w.z, 71)), asset: w.asset};
    // Drawn (a tree on a bare high face is left off by the renderer: `tree-pick.ts` assetTreePlacement), or not at all.
    return assetTreePlacement(item) ? item : null;
}

function shrubItem(w: WildItem): DecorItem {
    const s = sampleGround(w.x, w.z);
    const radius = (w.asset ? ASSETS[w.asset]?.crown_radius ?? 0.8 : 0.8) * w.scale;
    const scale = Math.min(Math.max(radius / SHRUB_RADIUS, 0.6), 1.8);
    return {kind: "shrub", variant: Math.floor(unit(w.x, w.z, 72) * 3), x: w.x, y: s.height, z: w.z, scale, rotation: w.yaw, color: tone(zoneAt(s), "shrub", unit(w.x, w.z, 73))};
}

function rockItem(w: WildItem): DecorItem {
    const s = sampleGround(w.x, w.z);
    const scale = Math.min((across(w.asset!) * w.scale) / ROCK_FOOTPRINT, ROCK_SCALE_MOST);
    return {kind: "rock", variant: Math.floor(unit(w.x, w.z, 74) * 3), x: w.x, y: s.height, z: w.z, scale, rotation: w.yaw, color: tone(zoneAt(s), "rock", unit(w.x, w.z, 75))};
}

/** A rock's base outline may stand this far off the ground at most (`scenery-check.ts` FLOAT_TOLERANCE is 2.5 cm). */
const ROCK_SEATED = 0.015;

/**
 * The rock as L6 draws it (`rock-assets.ts` rockAssetFor: leaned with its slope, sunk until its base is in the ground,
 * never past half its height): where even that leaves an edge in the air (a cliff's lip), a smaller rock of the same
 * kind, or none.
 */
function seatedRock(item: DecorItem): DecorItem | null {
    for (const f of [1, 0.75, 0.55]) {
        const rock = f === 1 ? item : {...item, scale: item.scale * f};
        const placed = rockAssetFor(rock);
        if (!placed) return null;
        if (rockBase(placed).every(([x, y, z]) => y - heightAt(x, z) <= ROCK_SEATED)) return rock;
    }
    return null;
}

function reedItem(w: WildItem): DecorItem {
    const height = (w.asset ? ASSETS[w.asset]?.height ?? 2 : 2) * w.scale;
    return {kind: "reed", variant: Math.floor(unit(w.x, w.z, 76) * 3), x: w.x, y: sampleGround(w.x, w.z).height, z: w.z, scale: Math.min(Math.max(height / REED_HEIGHT, 0.7), 1.4), rotation: w.yaw, color: unit(w.x, w.z, 77) < 0.5 ? "#b2a565" : "#8f8f4f"};
}

/** A bed of lily pads (the generator's one asset bed) as the decor's single pads, on the water's own surface. */
function lilyBed(w: WildItem, out: DecorItem[]) {
    const random = seeded((Math.floor(w.x * 100) * 73856093) ^ (Math.floor(w.z * 100) * 19349663) ^ 0x11a7);
    const pads = 4 + Math.floor(random() * 3);
    for (let k = 0; k < pads; k++) {
        const a = random() * Math.PI * 2;
        const r = k === 0 ? 0 : 0.35 + random() * 0.75;
        const scale = 0.6 + random() * 0.6;
        const rotation = random() * Math.PI * 2;
        const colour = random() < 0.5 ? "#5f8a3c" : "#6e9844";
        const x = w.x + Math.cos(a) * r;
        const z = w.z + Math.sin(a) * r;
        const s = wild(x, z);
        // Still water a hand to a metre and a half deep (the decor's own pads' range), clear of the river's current.
        if (s.freshLevel === null || s.fresh < 0.5) continue;
        const depth = s.freshLevel - s.height;
        if (depth < 0.12 || depth > 1.6 || s.riverHit.d < s.riverHit.width * 0.6) continue;
        out.push({kind: "lily", variant: k % 3, x, y: s.freshLevel + 0.02, z, scale, rotation, color: colour});
    }
}

/**
 * The v2 decor, in this order (each item's index is its host's, `decor<i>`): the canopy's trees, then the shrubs,
 * then the rocks, reeds and lily pads, then the micro corners (`micro-decor.ts`), as `decor.ts` appends them, then
 * what terrain fixes have added since (`ledger.ts`).
 */
export function wildDecor(): DecorItem[] {
    const scenery = wildScenery();
    const micro = microDecor();
    const keep = microKeepOut(micro);
    const cleared = clearings();
    const spacing = new TreeSpacing();
    // The micro corners' trees stand first: the scenery gives way to them (as on today's island).
    for (const item of micro) {
        const body = treeBody(item);
        if (body) spacing.add(body);
    }

    // Rocks first (as drawn, `rock-assets.ts`): no trunk stands in one. None in a termite mound.
    const mounds = new Discs();
    for (const mound of allMounds()) mounds.add(mound.x, mound.z, moundFoot(mound) + 0.3);
    const rocks: DecorItem[] = [];
    for (const w of scenery) {
        if (w.kind !== "rock" || !w.asset || family(w.asset) === "scree") continue;
        const wanted = rockItem(w);
        if (!openGround(wanted.x, wanted.z, 0.9 * wanted.scale, keep, cleared) || mounds.hits(wanted.x, wanted.z, 0.9 * wanted.scale)) continue;
        const item = seatedRock(wanted);
        if (item) rocks.push(item);
    }
    for (const rock of rocks) addRockTo(spacing, rock);
    addMoundsTo(spacing);

    // The canopy's trees in the generator's own order (its priority: the tree that wins between neighbours first), then
    // the shrubs: `decor.ts` settle grows each tree at the first size that fits, or leaves it out.
    const canopy = scenery.filter((w) => w.kind === "tree" && w.storey === "canopy").sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const pending: Pending[] = [];
    for (const w of canopy) {
        const item = treeItem(w);
        if (item && openGround(item.x, item.z, 1.5, keep, cleared)) pending.push({item, shrub: null});
    }
    for (const w of scenery) {
        if (w.kind !== "shrub") continue;
        const item = shrubItem(w);
        if (openGround(item.x, item.z, SHRUB_RADIUS * item.scale, keep, cleared)) pending.push({item, shrub: null});
    }
    const settled = settle(spacing, pending, true).filter((item): item is DecorItem => item !== null);
    const trees = settled.filter((item) => item.kind !== "shrub");
    const shrubs = settled.filter((item) => item.kind === "shrub");

    const water: DecorItem[] = [];
    for (const w of scenery) {
        if (w.kind === "reed" && !keep.hits(w.x, w.z, 0.5)) water.push(reedItem(w));
        else if (w.kind === "lily") lilyBed(w, water);
    }

    const out = [...trees, ...shrubs, ...rocks, ...water];
    for (const item of micro) out.push({kind: item.kind, variant: item.variant, x: item.x, y: item.y, z: item.z, scale: item.scale, rotation: item.rotation, color: item.color});
    // Append-only across terrain fixes (decision 303, `ledger.ts`): what a fix added goes after the micro corners, so
    // every other item keeps its index (its host's, `decor<i>`, and so its attach points' ids and seeded draws).
    return appendLast(out, (item) => ledgerKey(item.kind, item.x, item.z), DECOR_APPENDED);
}

/** Every decor tree and rock as the spacing knows them, and the mounds: what the understorey and the floor keep clear of. */
function decorSpacing(decor: readonly DecorItem[]): TreeSpacing {
    const spacing = new TreeSpacing();
    for (const item of decor) {
        const body = treeBody(item);
        if (body) spacing.add(body);
        if (item.kind === "rock") addRockTo(spacing, item);
    }
    addMoundsTo(spacing);
    return spacing;
}

/**
 * The v2 forest fill: the understorey under the canopy (young emergents and palms in the rainforest, birches, young
 * beeches and snags in the woodland), settled under the decor's trees as `decor.ts` forestFill settles its own, and
 * ranked by the generator's hash for the tiers (`tree-pick.ts` fillDrawnOnEveryTier). Sorted by rank, as the fill is.
 */
export function wildFill(decor: readonly DecorItem[]): FillItem[] {
    const keep = microKeepOut(microDecor());
    const cleared = clearings();
    const spacing = decorSpacing(decor);
    const pending: Pending[] = [];
    const ranks: number[] = [];
    for (const w of wildScenery()) {
        if (w.kind !== "tree" || w.storey !== "under") continue;
        const item = treeItem(w);
        if (!item || !openGround(item.x, item.z, 1.5, keep, cleared)) continue;
        pending.push({item, shrub: null});
        ranks.push(w.rank ?? 0.5);
    }
    const out: FillItem[] = [];
    settle(spacing, pending, false).forEach((item, i) => {
        if (item) out.push({...item, rank: ranks[i]});
    });
    return out.sort((a, b) => a.rank - b.rank);
}

// MARK: - Grass

/** How much meadow grass each zone grows (the decor's own shares, `decor.ts` grassTufts; the ice a little). */
const MEADOW: Partial<Record<ArkZone, number>> = {grassland: 1, woodland: 0.75, river_lake: 0.85, wetland: 0.6, rainforest: 0.45, mountains: 0.35, seashore: 0.12, polar: 0.08};
/** No meadow grass above this (m): the alpine turf thins out under v2's snow line (52 m). */
const GRASS_CEILING = 46;

/**
 * Grass tufts over the island's land (`decor.ts` grassTufts' rule on v2: densest on the meadows, fuller round the
 * animals' ground, thinning to nothing on sand, rock, ice, snow and water). `count` of them, from a fixed seed.
 */
export function wildGrassTufts(count: number): GrassTuft[] {
    const random = seeded(77002);
    const tufts: GrassTuft[] = [];
    const box = wildLandBounds();
    const sites = clearings();
    let guard = 0;
    while (tufts.length < count && guard++ < count * 12) {
        const x = box.minX + random() * (box.maxX - box.minX);
        const z = box.minZ + random() * (box.maxZ - box.minZ);
        const roll = random();
        const s = wild(x, z);
        if (s.height < 0.35 || s.land < 0.85 || s.height > GRASS_CEILING || s.fresh >= 0.5 || s.ice > 0.3) continue;
        const zone = zoneAt(s) as ArkZone;
        // Fuller round the animals' own ground, where the camera comes close.
        const nearAnimals = sites.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 6) ? 1.8 : 1;
        const want = (MEADOW[zone] ?? 0) * nearAnimals * smoothstep(0.15, 0.5, fbm(x * 0.06 - 7, z * 0.06 + 3) + (nearAnimals > 1 ? 0.2 : 0));
        if (roll > want) continue;
        // Off the river's water and its very edge, and off the steep faces.
        if (s.riverHit.d < s.riverHit.width + 1.5 || gridSlope(x, z) > 1) continue;
        const scale = 0.45 + random() * 0.4;
        const rotation = random() * Math.PI * 2;
        const dryRoll = random();
        tufts.push({x, y: s.height, z, scale, rotation, zone, dry: zone === "grassland" ? 0.3 + 0.45 * dryRoll : zone === "mountains" || zone === "desert" ? 0.3 + 0.3 * dryRoll : 0.12 * dryRoll});
    }
    return tufts;
}

// MARK: - The floor

/**
 * The ground plants (ferns, flowers, sedge, moss) and grass clumps, as floor placements: upright, their foot a little
 * in the ground on a slope; off every trunk, rock and fallen log, out of the micro patches. `logs` are the floor's own
 * fallen logs (`floor-assets.ts`), kept clear of.
 */
export function wildFloorPlants(decor: readonly DecorItem[], fill: readonly FillItem[], logs: readonly FloorPlacement[]): FloorPlacement[] {
    const keep = microKeepOut(microDecor());
    const trunks = new Discs(4);
    for (const item of [...decor, ...fill]) {
        const body = treeBody(item);
        if (body && !body.low) trunks.add(body.x, body.z, body.trunk + 0.25);
    }
    const lying = new Discs(4);
    for (const log of logs) {
        const b = ASSETS[log.id]?.bounds;
        const half = b ? ((b.max[0] - b.min[0]) / 2) * log.scale : 1.5;
        for (const t of [-0.66, 0, 0.66]) lying.add(log.x + Math.cos(log.yaw) * half * t, log.z - Math.sin(log.yaw) * half * t, 0.7 * log.scale);
    }
    const out: FloorPlacement[] = [];
    for (const w of wildScenery()) {
        if ((w.kind !== "plant" && w.kind !== "grass") || !w.asset || !ASSETS[w.asset]) continue;
        const r = 0.25 * across(w.asset) * w.scale;
        if (keep.hits(w.x, w.z, r) || trunks.hits(w.x, w.z, 0.15) || lying.hits(w.x, w.z, 0.1) || inRock(w.x, w.z, 0.15)) continue;
        // Its foot in the ground across a slope: sunk by the rise over a third of its width.
        const ground = heightAt(w.x, w.z);
        const slope = gridSlope(w.x, w.z);
        out.push({id: w.asset, x: w.x, y: ground - 0.03 - Math.min(slope, 0.8) * r * 0.6, z: w.z, yaw: w.yaw, scale: w.scale, up: [0, 1, 0]});
    }
    return out;
}
