/**
 * Trees that never grow inside each other (scenery lane, the motion 100x pass; the owner: "trees grow inside each
 * other").
 *
 * Every tree as it is drawn, as a body: its trunk (a vertical cylinder from its foot to the middle of its crown) and
 * its crown (the leaf area measured on the drawn lod0 tree, `scripts/ark-tree-footprints.mjs`: five slices up the
 * crown, each with the radius that holds 85% of its leaves, and how far it reaches in eight directions). Two trees
 * clash when
 *
 *   - their trunks are closer than their radii and a hand's width of roots (`TRUNK_GAP`),
 *   - one's trunk runs through the other's crown (through its 85% leaf mass, at a height where both are), or
 *   - their crowns, at a height where both have leaves, overlap by more than a light interlock at the edges
 *     (`CROWN_INTERLOCK`: crowns that touch and mesh a little are a wood; one inside the other is the bug).
 *
 * A tree under another's crown, whose top stays below that crown's lowest leaves, is the understorey: allowed, as
 * long as the taller tree's trunk is not through it. Shrubs may form thickets with shrubs, but stay off trunks.
 *
 * The decor's scatter (`decor.ts`) keeps the trees it places in a `TreeSpacing` and asks it before each new one;
 * the CI check (`src/lib/ark-scenery.test.ts`) counts clashes over every drawn tree. Pure and deterministic.
 */

import footprintTable from "@/ark-scene/tree-footprints.json";
import {canopyTree} from "@/ark-scene/micro-decor";
import {assetTreePlacement} from "@/ark-scene/tree-pick";

type Footprint = {cx: number; cz: number; top: number; trunk: number; r: number; bands: Array<[number, number, number]>; sectors: number[]};
const FOOTPRINTS = (footprintTable as unknown as {assets: Record<string, Footprint>}).assets;

/** Trunks this far apart beyond their radii at least (m): the root flare. */
export const TRUNK_GAP = 0.3;
/** Crowns may overlap by this share of their summed (85%) radii: the edges mesh, the masses stay apart. */
export const CROWN_INTERLOCK = 0.15;
/** Shrubs among shrubs: thickets, as long as their middles stay this share of their radii apart. */
export const THICKET = 0.5;
/** Slices of two crowns must share at least this much height (m) to touch. */
const BAND_OVERLAP = 0.25;

export type TreeBody = {
    /** The decor kind ("broadleaf", "shrub", …) and the asset drawn, if any ("oak-a"). */
    kind: string;
    asset: string | null;
    /** An understorey shrub: may stand in a thicket with other shrubs. */
    low: boolean;
    /** The trunk's foot (the drawn origin) and radius, and how high it runs (into the crown's middle). */
    x: number;
    y: number;
    z: number;
    trunk: number;
    trunkTop: number;
    /** The crown's middle (world) and its slices [from, to, radius] in world metres. */
    cx: number;
    cz: number;
    bands: Array<[number, number, number]>;
    /** Reach by direction (8 sectors of the crown's own frame, from +x toward +z) as a share of its radius, and its turn. */
    sectors: number[];
    yaw: number;
    /** The tree's top (world), and how far it reaches round its crown's middle (for the spatial index). */
    top: number;
    reach: number;
};

type TreeLike = {kind: string; variant?: number; x: number; y: number; z: number; scale: number; rotation: number};

const ROUND = [1, 1, 1, 1, 1, 1, 1, 1];
/** The decor's sink (micro-decor.ts DECOR_SINK), repeated to keep this module light. */
const SINK = 0.08;

function body(kind: string, asset: string | null, item: {x: number; y: number; z: number; rotation: number}, s: number, fp: Footprint, low: boolean): TreeBody {
    const c = Math.cos(item.rotation);
    const n = Math.sin(item.rotation);
    // three's turn about +y: x' = x cos + z sin, z' = -x sin + z cos.
    const cx = item.x + (fp.cx * c + fp.cz * n) * s;
    const cz = item.z + (-fp.cx * n + fp.cz * c) * s;
    const bands = fp.bands.map(([from, to, r]) => [item.y + from * s, item.y + to * s, r * s] as [number, number, number]);
    const crownBase = fp.bands[0][0];
    const widest = Math.max(...fp.bands.map((band) => band[2])) * Math.max(...fp.sectors) * s;
    const offset = Math.hypot(cx - item.x, cz - item.z);
    return {
        kind,
        asset,
        low,
        x: item.x,
        y: item.y,
        z: item.z,
        trunk: fp.trunk * s,
        trunkTop: item.y + (crownBase + 0.5 * (fp.top - crownBase)) * s,
        cx,
        cz,
        bands,
        sectors: fp.sectors,
        yaw: item.rotation,
        top: item.y + fp.top * s,
        reach: Math.max(widest, offset + fp.trunk * s)
    };
}

/** vegetation.ts shrub(): four soft blobs about 1.4 m across and 0.85 m high at scale 1, leaf cards round them. */
const SHRUB: Footprint = {cx: 0.02, cz: -0.1, top: 0.85, trunk: 0.06, r: 0.65, bands: [[0.1, 0.85, 0.65]], sectors: ROUND};
/** vegetation.ts cactus(): a 2.4 m column, arms out to 0.75 m. */
const CACTUS: Footprint = {cx: 0, cz: 0, top: 2.45, trunk: 0.24, r: 0.7, bands: [[0.8, 2.45, 0.7]], sectors: ROUND};

/** micro-decor.ts canopyTree: a tall trunk, five limbs under pads of leaves, a small crown. */
function canopyFootprint(variant: number): Footprint {
    const tree = canopyTree(variant);
    const lowest = Math.min(...tree.limbs.map((limb) => limb.height));
    const highest = Math.max(...tree.limbs.map((limb) => limb.height + Math.sin(limb.rise) * limb.length)) + tree.pad.lift + tree.pad.radius * tree.pad.squash;
    const reach = Math.max(...tree.limbs.map((limb) => tree.base * 0.8 + Math.cos(limb.rise) * limb.length)) + tree.pad.radius * 0.6;
    return {cx: 0, cz: 0, top: tree.crown.y + tree.crown.radius * tree.crown.squash, trunk: tree.base, r: reach, bands: [[lowest, highest, reach], [tree.height - 0.3, tree.crown.y + tree.crown.radius * tree.crown.squash, tree.crown.radius]], sectors: ROUND};
}

/**
 * A decor (or forest-fill) item as the tree it is drawn as, or null when it is not a tree (a rock, a reed) or is not
 * drawn (an asset tree left off a bare rock face high on the mountain).
 */
export function treeBody(item: TreeLike): TreeBody | null {
    switch (item.kind) {
        case "shrub":
            return body("shrub", null, {...item, y: item.y - SINK}, item.scale, SHRUB, true);
        case "cactus":
            return body("cactus", null, {...item, y: item.y - SINK}, item.scale, CACTUS, false);
        case "canopy":
            return body("canopy", null, {...item, y: item.y - SINK}, item.scale, canopyFootprint(item.variant ?? 0), false);
        default: {
            const placed = assetTreePlacement(item as never);
            if (!placed) return null;
            const fp = FOOTPRINTS[placed.id];
            if (!fp) return null;
            return body(item.kind, placed.id, {x: placed.x, y: placed.y, z: placed.z, rotation: placed.rotation}, placed.scale, fp, false);
        }
    }
}

/** How far a crown reaches toward a world direction (radians, atan2(z, x)), as a share of its radius: sectors blended. */
function reachToward(tree: TreeBody, angle: number): number {
    // World angle = local angle − yaw (three's turn), so the local angle is the world's plus the yaw.
    const step = Math.PI / 4;
    let local = (angle + tree.yaw) / step - 0.5;
    local = ((local % 8) + 8) % 8;
    const i = Math.floor(local);
    const f = local - i;
    return tree.sectors[i] * (1 - f) + tree.sectors[(i + 1) % 8] * f;
}

export type Clash = {kind: "trunk" | "crown" | "trunk-in-crown"; /** How far inside the allowed spacing (m). */ depth: number};

/** Does a's trunk run through b's crown (its 85% leaves), at a height where b has leaves? */
function trunkThroughCrown(a: TreeBody, b: TreeBody): number {
    if (a.low) return 0;
    const d = Math.hypot(a.x - b.cx, a.z - b.cz);
    const toward = reachToward(b, Math.atan2(a.z - b.cz, a.x - b.cx));
    let worst = 0;
    for (const [from, to, r] of b.bands) {
        if (Math.min(to, a.trunkTop) - Math.max(from, a.y) < BAND_OVERLAP) continue;
        // A shrub's crown may brush a trunk at its edge: its leaves are a skirt round the foot, not a mass.
        const keep = (b.low ? 0.75 : 1) * r * toward + a.trunk;
        worst = Math.max(worst, keep - d);
    }
    return worst;
}

/** Whether two drawn trees grow inside each other, and how badly. Null when they stand clear. */
export function treesClash(a: TreeBody, b: TreeBody): Clash | null {
    const foot = Math.hypot(b.x - a.x, b.z - a.z);
    const trunks = a.trunk + b.trunk + TRUNK_GAP - foot;
    if (trunks > 0) return {kind: "trunk", depth: trunks};
    // Crowns: at every height both have leaves.
    const dx = b.cx - a.cx;
    const dz = b.cz - a.cz;
    const d = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const fa = reachToward(a, angle);
    const fb = reachToward(b, angle + Math.PI);
    const k = a.low && b.low ? THICKET : 1 - CROWN_INTERLOCK;
    let crown = 0;
    for (const [af, at, ar] of a.bands) {
        for (const [bf, bt, br] of b.bands) {
            if (Math.min(at, bt) - Math.max(af, bf) < BAND_OVERLAP) continue;
            crown = Math.max(crown, k * (ar * fa + br * fb) - d);
        }
    }
    const through = Math.max(trunkThroughCrown(a, b), trunkThroughCrown(b, a));
    if (through > 0 && through >= crown) return {kind: "trunk-in-crown", depth: through};
    if (crown > 0) return {kind: "crown", depth: crown};
    return null;
}

/** A rock as drawn, for trees to keep their trunks out of (`map/rocks.ts` DrawnRock's shape: its turned box). */
export type RockBox = {x: number; z: number; cos: number; sin: number; hx0: number; hx1: number; hz0: number; hz1: number};

/** Does a circle (x, z, r) reach into a rock's box (its own frame: local x = dx cos − dz sin, local z = dx sin + dz cos)? */
function inBox(rock: RockBox, x: number, z: number, r: number): boolean {
    const dx = x - rock.x;
    const dz = z - rock.z;
    const lx = dx * rock.cos - dz * rock.sin;
    const lz = dx * rock.sin + dz * rock.cos;
    return lx > rock.hx0 - r && lx < rock.hx1 + r && lz > rock.hz0 - r && lz < rock.hz1 + r;
}

/** A spatial index of placed trees (each listed in every cell its crown and trunk reach), and of rocks to stay out of. */
export class TreeSpacing {
    private readonly cells = new Map<number, TreeBody[]>();
    private readonly rocks = new Map<number, RockBox[]>();
    private static readonly CELL = 6;
    readonly bodies: TreeBody[] = [];

    /** A rock no trunk may stand in, and no shrub may grow out of. */
    addRock(rock: RockBox) {
        const c = TreeSpacing.CELL;
        const reach = Math.hypot(Math.max(-rock.hx0, rock.hx1), Math.max(-rock.hz0, rock.hz1));
        for (let i = Math.floor((rock.x - reach) / c); i <= Math.floor((rock.x + reach) / c); i++) for (let j = Math.floor((rock.z - reach) / c); j <= Math.floor((rock.z + reach) / c); j++) {
            const key = TreeSpacing.key(i, j);
            const list = this.rocks.get(key);
            if (list) list.push(rock);
            else this.rocks.set(key, [rock]);
        }
    }

    /** Whether a tree's trunk (or a shrub's middle) stands in a rock. */
    private inRock(tree: TreeBody): boolean {
        const list = this.rocks.get(TreeSpacing.key(Math.floor(tree.x / TreeSpacing.CELL), Math.floor(tree.z / TreeSpacing.CELL)));
        if (!list) return false;
        // A trunk keeps a hand's width off the rock; a shrub's middle off it (its leaves may lean on the stone).
        const r = tree.low ? 0.05 : tree.trunk + 0.15;
        return list.some((rock) => inBox(rock, tree.x, tree.z, r));
    }

    private static key(i: number, j: number): number {
        return (i + 4096) * 8192 + (j + 4096);
    }

    private span(tree: TreeBody, f: (key: number) => void) {
        const c = TreeSpacing.CELL;
        // The crown's circle and the trunk's, together.
        const x0 = Math.min(tree.cx - tree.reach, tree.x - tree.trunk);
        const x1 = Math.max(tree.cx + tree.reach, tree.x + tree.trunk);
        const z0 = Math.min(tree.cz - tree.reach, tree.z - tree.trunk);
        const z1 = Math.max(tree.cz + tree.reach, tree.z + tree.trunk);
        for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) f(TreeSpacing.key(i, j));
    }

    add(tree: TreeBody) {
        this.bodies.push(tree);
        this.span(tree, (key) => {
            const list = this.cells.get(key);
            if (list) list.push(tree);
            else this.cells.set(key, [tree]);
        });
    }

    /** Every placed tree this one would clash with (each once). */
    clashes(tree: TreeBody): Array<{other: TreeBody; clash: Clash}> {
        const seen = new Set<TreeBody>();
        const out: Array<{other: TreeBody; clash: Clash}> = [];
        this.span(tree, (key) => {
            for (const other of this.cells.get(key) ?? []) {
                if (seen.has(other)) continue;
                seen.add(other);
                const clash = treesClash(tree, other);
                if (clash) out.push({other, clash});
            }
        });
        return out;
    }

    /** Whether this tree would clash with any placed one (or stand in a rock). */
    fits(tree: TreeBody): boolean {
        if (this.inRock(tree)) return false;
        let ok = true;
        const seen = new Set<TreeBody>();
        this.span(tree, (key) => {
            if (!ok) return;
            for (const other of this.cells.get(key) ?? []) {
                if (seen.has(other)) continue;
                seen.add(other);
                if (treesClash(tree, other)) {
                    ok = false;
                    return;
                }
            }
        });
        return ok;
    }
}
