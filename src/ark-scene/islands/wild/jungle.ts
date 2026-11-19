/**
 * The jungle (lane ARK-JUNGLE, board 2026-11-20: "a denser jungle area with open gaps in the canopy where swinging is
 * visible"; the monkeys lane swung its primates through the crowns, where the leaves hid them).
 *
 * The rainforest where the wild island's primates live (the siamang, the capuchin, the toque macaques, the chimpanzee,
 * the squirrel monkeys: the zone's own ground round its site) is made a jungle: a lower canopy of young emergents and
 * palms closed up between the big trees, crowns meshing, and a few treefall gaps kept open in it, each a few metres of
 * sky across with crowns all round its edge. A gibbon's swing and its flight across, a langur's leap, a capuchin's
 * bound go over open air there, seen from above and from beside, not inside a crown.
 *
 * What it is and is not:
 * - Trees only, at the forest fill's sizes (`decor.ts` settle's growth, `tree-spacing.ts`: no trunk in another, no crown
 *   grown into another, none in a rock or a mound), drawn as the fill is (`asset-trees.ts`), and solid as the fill is
 *   (`collide/colliders.ts`: nothing walks through a trunk; the camera's obstacles).
 * - A list of its own, after everything else: the decor and the forest fill are unchanged item for item (their indices
 *   are the animals' homes' hosts: `ledger.ts`), and so are the floor's logs and plants (a jungle tree keeps clear of
 *   each), the attach points and the map's lists. Its trees carry holds only for canopy travel (`jungleHolds`): no
 *   animal's home is on one, so no home moves (the server's pinned atlas, `ark-positions.test.ts`).
 * - Pure: the terrain, the scenery and fixed seeds; the same on every device.
 */

import manifest from "@/ark-scene/assets-manifest.json";
import {addMoundsTo, addRockTo, forestFill, tone, worldDecor, type DecorItem, type FillItem} from "@/ark-scene/decor";
import {floorPlacements} from "@/ark-scene/floor-assets";
import {microDecor} from "@/ark-scene/micro-decor";
import {treeAttachPoints, type TreeAttach} from "@/ark-scene/tree-assets";
import {assetTreePlacement} from "@/ark-scene/tree-pick";
import {treeBody, TreeSpacing, type TreeBody} from "@/ark-scene/tree-spacing";
import {arkWorld, sampleGround, ZONE_SITES, zoneAt} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";
import type {WildGroundSample} from "@/ark-scene/islands/wild/ground";
import {gridSlope} from "@/ark-scene/islands/wild/terrain-cache";

type AssetInfo = {height: number; crown_radius?: number; bounds?: {min: [number, number, number]; max: [number, number, number]}};
const ASSETS = (manifest as unknown as {assets: Record<string, AssetInfo>}).assets;

/**
 * The stand: round the primates' ground in the rainforest (their homes, measured on the real Ark 2026-11-20: the siamang
 * at -160, 57, the capuchin at -167, 31, the chimpanzee at -134, 79, the squirrel monkeys at -142, 85, the toque macaques
 * at -194, 14), its edge feathered into the forest round it.
 */
export const JUNGLE = {x: -160, z: 56, r: 34};

/** A treefall gap: open sky over it, crowns round its edge (m). */
export type JungleGap = {x: number; z: number; r: number};

/** How many gaps, how wide (radius, m), and how far apart their middles keep. */
const GAPS = 7;
const GAP_R = [2.2, 3.0] as const;
const GAP_APART = 10;
/** The trees offered: on a jittered grid this far apart (m), most of them left out by the spacing. */
const STEP = 2.6;
/** A jungle tree's trunk keeps this clear of a fallen log's or a ground plant's middle (m), and of a micro patch. */
const FLOOR_CLEAR = 0.55;
/** A crown keeps out of a gap: its widest reach this share of the way to the gap's middle at most. */
const CROWN_SHARE = 0.85;
/** The jungle's rank in the fill's tiers: drawn on every tier (`tree-pick.ts` WOODS_FILL), so its holds are on every tier too. */
const RANK = 0.05;

const frac = (v: number) => v - Math.floor(v);
function unit(x: number, z: number, salt: number): number {
    return frac(Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453);
}

/** What grows at a spot, by a roll: mostly young emergents (the lower canopy), palms between, a few taller emergents. */
function offer(x: number, z: number, roll: number, size: number): {asset: string; kind: "rainforest" | "palm"; scale: number} {
    if (roll < 0.22) return {asset: ["palm-a", "palm-b", "palm-c"][Math.floor(size * 3) % 3], kind: "palm", scale: 0.95 + 0.45 * size};
    if (roll < 0.34) return {asset: "emergent-a", kind: "rainforest", scale: 0.42 + 0.22 * size};
    return {asset: "emergent-b", kind: "rainforest", scale: 0.48 + 0.3 * size};
}

/** Open ground for a trunk: land, not water nor its bank, not steep, in the rainforest, out of the zones' clearings. */
function ground(x: number, z: number): WildGroundSample | null {
    const s = sampleGround(x, z) as unknown as WildGroundSample;
    if (s.height < 0.6 || s.land < 0.9 || s.fresh >= 0.3 || s.riverHit.d < s.riverHit.width + 2.5) return null;
    if (gridSlope(x, z) > 0.55) return null;
    if (zoneAt(s as never) !== "rainforest") return null;
    return s;
}

/** The land zones' clearings (the animals' own ground, as `decor-v2.ts` keeps its scatter out of them). */
function clearings(): Array<{x: number; z: number; r: number}> {
    return (Object.keys(ZONE_SITES) as ArkZone[]).map((zone) => ZONE_SITES[zone]).filter((site) => site.kind === "land" && site.clearing > 0).map((site) => ({x: site.x, z: site.z, r: site.clearing}));
}

/** The places a jungle trunk may not stand: the floor's logs and plants, the micro patches, the clearings. */
function floorKeepOut(): (x: number, z: number, r: number) => boolean {
    const cells = new Map<string, Array<[number, number, number]>>();
    const add = (x: number, z: number, r: number) => {
        const key = `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
        const list = cells.get(key) ?? [];
        list.push([x, z, r]);
        cells.set(key, list);
    };
    for (const p of floorPlacements()) {
        if (Math.hypot(p.x - JUNGLE.x, p.z - JUNGLE.z) > JUNGLE.r + 8) continue;
        const b = ASSETS[p.id]?.bounds;
        if (p.id.startsWith("log-") && b) {
            // A log along its length: three discs.
            const half = ((b.max[0] - b.min[0]) / 2) * p.scale;
            for (const t of [-0.8, -0.4, 0, 0.4, 0.8]) add(p.x + Math.cos(p.yaw) * half * t, p.z - Math.sin(p.yaw) * half * t, 0.6 * p.scale + 0.3);
        } else add(p.x, p.z, 0.2);
    }
    for (const item of microDecor()) if (Math.hypot(item.x - JUNGLE.x, item.z - JUNGLE.z) < JUNGLE.r + 8) add(item.x, item.z, item.kind === "canopy" ? 1.4 : 0.8);
    const cleared = clearings();
    return (x, z, r) => {
        for (const c of cleared) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
        for (let i = Math.floor((x - 2) / 4); i <= Math.floor((x + 2) / 4); i++) {
            for (let j = Math.floor((z - 2) / 4); j <= Math.floor((z + 2) / 4); j++) {
                for (const [ox, oz, or] of cells.get(`${i},${j}`) ?? []) if (Math.hypot(ox - x, oz - z) < or + r) return true;
            }
        }
        return false;
    };
}

/** The crown's widest reach round its middle (m). */
function crownReach(body: TreeBody): number {
    return Math.max(...body.bands.map((band) => band[2])) * Math.max(...body.sectors);
}

/** Whether a crown overhangs a gap. */
function overGap(body: TreeBody, gaps: readonly JungleGap[]): boolean {
    for (const g of gaps) {
        if (Math.hypot(body.cx - g.x, body.cz - g.z) < g.r + crownReach(body) * CROWN_SHARE) return true;
        if (Math.hypot(body.x - g.x, body.z - g.z) < g.r + body.trunk + 0.3) return true;
    }
    return false;
}

let cached: {trees: FillItem[]; gaps: JungleGap[]} | null = null;

/** The scenery's trees and rocks as the spacing knows them (decor and fill), and the mounds. */
function sceneSpacing(): TreeSpacing {
    const spacing = new TreeSpacing();
    for (const item of [...worldDecor(), ...forestFill()]) {
        const body = treeBody(item);
        if (body) spacing.add(body);
        if (item.kind === "rock") addRockTo(spacing, item);
    }
    addMoundsTo(spacing);
    return spacing;
}

/**
 * The gaps: open places in the stand with no crown of the scenery over the ground yet (on a 2 m grid), where the
 * scenery's crowns stand close round (the more crowns whose edge is within a couple of metres of the gap's, the better:
 * a gap a gibbon can cross, with holds on its far side), apart from each other.
 */
function findGaps(bodies: readonly TreeBody[]): JungleGap[] {
    const near = bodies.filter((b) => !b.low && Math.hypot(b.cx - JUNGLE.x, b.cz - JUNGLE.z) < JUNGLE.r + 20);
    const spots: Array<{x: number; z: number; clear: number; score: number}> = [];
    for (let x = JUNGLE.x - JUNGLE.r * 0.8; x <= JUNGLE.x + JUNGLE.r * 0.8; x += 2) {
        for (let z = JUNGLE.z - JUNGLE.r * 0.8; z <= JUNGLE.z + JUNGLE.r * 0.8; z += 2) {
            if (Math.hypot(x - JUNGLE.x, z - JUNGLE.z) > JUNGLE.r * 0.8 || !ground(x, z)) continue;
            // How far it is to the nearest crown's edge (negative: under one), and to the nearest trunk.
            let clear = Infinity;
            const edges: number[] = [];
            for (const b of near) {
                const edge = Math.hypot(x - b.cx, z - b.cz) - crownReach(b) * CROWN_SHARE;
                edges.push(edge);
                clear = Math.min(clear, edge, Math.hypot(x - b.x, z - b.z) - b.trunk - 1);
            }
            if (clear < GAP_R[0]) continue;
            const round = edges.filter((e) => e < clear + 2.5).length;
            spots.push({x, z, clear, score: round - 0.25 * clear + 0.01 * unit(x, z, 5)});
        }
    }
    spots.sort((a, b) => b.score - a.score);
    const gaps: JungleGap[] = [];
    for (const o of spots) {
        if (gaps.length >= GAPS) break;
        if (gaps.some((g) => Math.hypot(g.x - o.x, g.z - o.z) < GAP_APART)) continue;
        gaps.push({x: o.x, z: o.z, r: Math.min(GAP_R[0] + (GAP_R[1] - GAP_R[0]) * unit(o.x, o.z, 6), o.clear)});
    }
    return gaps;
}

/** The jungle: its trees (after the forest fill, in their own list) and its gaps. Empty off the v2 island. */
export function wildJungle(): {trees: FillItem[]; gaps: JungleGap[]} {
    if (cached) return cached;
    if (arkWorld() !== "v2") return {trees: [], gaps: []};
    const spacing = sceneSpacing();
    const gaps = findGaps(spacing.bodies);
    const blocked = floorKeepOut();
    // Offers: round each gap first (a ring of crowns just meeting its edge), then the stand's jittered grid.
    type Offer = {x: number; z: number; roll: number; size: number; yaw: number};
    const offers: Offer[] = [];
    gaps.forEach((g, k) => {
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2 + unit(g.x, g.z, 10 + k) * 0.7;
            const d = g.r + 4.2 + 1.2 * unit(g.x + i, g.z, 11);
            offers.push({x: g.x + Math.cos(a) * d, z: g.z + Math.sin(a) * d, roll: 0.3 + 0.7 * unit(g.x, g.z + i, 12), size: unit(g.x + i, g.z, 13), yaw: unit(g.z, g.x + i, 14) * Math.PI * 2});
        }
    });
    for (let x = JUNGLE.x - JUNGLE.r; x <= JUNGLE.x + JUNGLE.r; x += STEP) {
        for (let z = JUNGLE.z - JUNGLE.r; z <= JUNGLE.z + JUNGLE.r; z += STEP) {
            const jx = x + (unit(x, z, 1) - 0.5) * STEP * 0.8;
            const jz = z + (unit(x, z, 2) - 0.5) * STEP * 0.8;
            const d = Math.hypot(jx - JUNGLE.x, jz - JUNGLE.z);
            // (Feathered: thinning out over the stand's outer fifth.)
            if (d > JUNGLE.r || (d > JUNGLE.r * 0.8 && unit(jx, jz, 3) < (d - JUNGLE.r * 0.8) / (JUNGLE.r * 0.2))) continue;
            offers.push({x: jx, z: jz, roll: unit(jx, jz, 4), size: unit(jx, jz, 7), yaw: unit(jz, jx, 8) * Math.PI * 2});
        }
    }
    const trees: FillItem[] = [];
    // Full size first, then younger in the gaps left (`decor.ts` settle's order: a sapling never takes a big tree's place).
    const done = new Set<number>();
    for (const sizes of [[1, 0.85], [0.7, 0.55]]) {
        offers.forEach((o, i) => {
            if (done.has(i)) return;
            const s = ground(o.x, o.z);
            if (!s || blocked(o.x, o.z, FLOOR_CLEAR)) return;
            const pick = offer(o.x, o.z, o.roll, o.size);
            for (const f of sizes) {
                const item: FillItem = {kind: pick.kind, variant: Math.max(0, "abc".indexOf(pick.asset.slice(-1))), x: o.x, y: s.height, z: o.z, scale: pick.scale * f, rotation: o.yaw, color: tone("rainforest", pick.kind, unit(o.x, o.z, 9)), asset: pick.asset, rank: RANK};
                if (!assetTreePlacement(item)) break;
                const body = treeBody(item);
                if (!body || overGap(body, gaps) || !spacing.fits(body)) continue;
                spacing.add(body);
                trees.push(item);
                done.add(i);
                break;
            }
        });
    }
    return (cached = {trees, gaps});
}

/** The jungle's trees, as the forest fill's are listed (`decor.ts` jungleFill). */
export function jungleTrees(): FillItem[] {
    return wildJungle().trees;
}

/** The canopy holds of the jungle's trees (limbs' tops, hang points under them, branches): for canopy travel only. */
export type JungleHold = TreeAttach & {id: string; host: string};

let holds: JungleHold[] | null = null;
const HOLD_CAP: Partial<Record<TreeAttach["tag"], number>> = {limb: 10, canopy_hang: 6, branch: 8};

export function jungleHolds(): JungleHold[] {
    if (holds) return holds;
    const out: JungleHold[] = [];
    jungleTrees().forEach((item, j) => {
        const host = `jungle${j}`;
        const kept: Record<string, number> = {};
        for (const point of treeAttachPoints(item as DecorItem)) {
            const cap = HOLD_CAP[point.tag];
            if (!cap || (kept[point.tag] = (kept[point.tag] ?? 0) + 1) > cap) continue;
            out.push({...point, id: `${point.tag}:${host}:${point.n}`, host});
        }
    });
    return (holds = out);
}
