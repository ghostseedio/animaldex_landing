/**
 * The world's solid things as colliders (motion pass L5, the owner: "animals walk through fences and rocks"): every
 * fence, building, trunk, rock, log and hay bale as drawn, from the lanes' own sources (never hand-copied numbers), so
 * when the scenery lane moves a tree or replaces a rock, the colliders move with it.
 *
 * - Fences: the house plots' picket runs (`home-layout.ts` picketRuns: the gate is a gap), the smallholdings' paddock
 *   rails (`paddockFence`: a gate is a gap; no rail where a rock stands, which is then the rock), and the farm's field
 *   fences (`decor.ts` "fence" items: `vegetation.ts` fence(), posts at ±1.2 m, rails 2.45 m long at 0.45 and 0.85 m).
 *   A rail fence's rails start 0.4 m up and its posts reach the ground, so a hen walks under the rails; a picket fence
 *   is solid to the ground but its gaps let anything narrower than `PICKET_GAP` through.
 * - Buildings: each house plot's cottage (`cottageStyle(plot).scale` of `COTTAGE`), each smallholding's barn or shed
 *   (`barnStyle(plot).size`), and what the props lay on a plot that is solid (`plotKeepOuts`: the compost bin, the water
 *   butt, the hay shelter and its loose hay, the troughs, the coop). Vegetable beds are walked over.
 * - Trunks: every decor and forest-fill tree as drawn (`tree-assets.ts` assetTrunk for an asset tree, `vegetation.ts`
 *   trunkOf otherwise), from the foot to where the leaves hide it. Shrubs are soft (walked into, not counted).
 * - Rocks: `map/rocks.ts` drawnRocks (the scenery lane makes it list every solid rock: decor rocks, outcrops, boulders).
 * - Fallen logs (`floor-assets.ts` floorObstacles) and hay bales (decor "hay": a bale on its side), lamp posts.
 * - Soft, for the paths only: shrubs (walkers go round them, as the walk grid always kept them; a body brushing one is
 *   not passing through anything). And the garden pond with its ring of stones (drawn water over dry ground: walkers
 *   drink at its edge, never walk in; ducks and frogs on its surface are on it).
 *
 * Everything is a pure function of the world and the hamlet's plots: every viewer has the same colliders.
 */

import {noHamlet, onHamletSwitch} from "@/ark-scene/no-hamlet";
import {forestFill, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {assetTrunk} from "@/ark-scene/tree-assets";
import {trunkOf} from "@/ark-scene/vegetation";
import {canopyTree, COTTAGE, DECOR_SINK} from "@/ark-scene/micro-decor";
import {drawnRocks} from "@/ark-scene/map/rocks";
import {floorObstacles} from "@/ark-scene/floor-assets";
import {barnStyle, cottageStyle, defaultHomePlots, GARDEN, paddockFence, paddockRect, paddockSegments, PADDOCK_POST_TOP, picketRuns, PICKET_POST_TOP, plotFrame, plotKeepOuts, type HomePlot} from "@/ark-scene/props/home-layout";
import {onArkWorld, sampleGround} from "@/ark-scene/world";
import {GARDEN_POND} from "@/ark-scene/micro-decor";
import {POND_STONES} from "@/ark-scene/world-sampler";

export type ColliderKind = "fence" | "building" | "trunk" | "rock" | "log" | "hay" | "post" | "shrub" | "pond";

type ColliderBase = {
    kind: ColliderKind;
    /** Stable id (kind and source), for reports. */
    id: string;
    /** Its foot and its top (m). A body wholly above the top or below the foot is clear of it. */
    y0: number;
    y1: number;
    /** Its middle and how far any part of it reaches from there (m), for the index. */
    cx: number;
    cz: number;
    reach: number;
    /** A gap a body narrower than this (m across) slips through (a picket fence's), else 0. */
    gap: number;
    /** Soft: paths go round it, but a body may brush into it (a shrub). */
    soft?: boolean;
};

/** A vertical cylinder. */
export type CircleCollider = ColliderBase & {shape: "circle"; r: number};
/** An oriented box (`map/rocks.ts` DrawnRock's frame: local x = dx cos − dz sin, local z = dx sin + dz cos). */
export type BoxCollider = ColliderBase & {shape: "box"; cos: number; sin: number; hx0: number; hx1: number; hz0: number; hz1: number};
/** A thick line (a fence's rails, a picket run): every point within `r` of the segment a–b. */
export type SegmentCollider = ColliderBase & {shape: "segment"; ax: number; az: number; bx: number; bz: number; r: number};
export type Collider = CircleCollider | BoxCollider | SegmentCollider;

/** A picket fence's gaps (m): anything narrower slips between the pickets (a mouse, a beetle, a frog). */
export const PICKET_GAP = 0.06;
/** A rail fence's lowest rail's underside over the ground (m): anything lower walks under the rails. */
export const RAIL_CLEAR = 0.4;

/** The signed distance from a point to a collider's footprint (m, negative inside). */
export function colliderDistance(c: Collider, x: number, z: number): number {
    switch (c.shape) {
        case "circle":
            return Math.hypot(x - c.cx, z - c.cz) - c.r;
        case "box": {
            const dx = x - c.cx;
            const dz = z - c.cz;
            const lx = dx * c.cos - dz * c.sin;
            const lz = dx * c.sin + dz * c.cos;
            const qx = Math.max(c.hx0 - lx, lx - c.hx1);
            const qz = Math.max(c.hz0 - lz, lz - c.hz1);
            return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
        }
        case "segment":
            return segmentDistance(x, z, c.ax, c.az, c.bx, c.bz) - c.r;
    }
}

export function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
    const vx = bx - ax;
    const vz = bz - az;
    const length = vx * vx + vz * vz;
    const t = length > 0 ? Math.min(Math.max(((x - ax) * vx + (z - az) * vz) / length, 0), 1) : 0;
    return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}

/** Does a body's height span (base to base + height) reach into the collider's (with 2 cm to spare at its top)? */
export function spansCollider(c: Collider, base: number, height: number): boolean {
    if (!Number.isFinite(base)) return true;
    return base + height > c.y0 && base < c.y1 - 0.02;
}

/** Which colliders a body is subject to: a picket gap lets a narrow one through; the rails pass over a low one. */
export function bodyMeets(c: Collider, radius: number): boolean {
    return !(c.gap > 0 && radius * 2 < c.gap);
}

/** A gap in a fence to walk through (a garden's gate, a paddock's): its middle, its way across (unit) and its width (m). */
export type Gate = {id: string; x: number; z: number; nx: number; nz: number; width: number};

const CELL = 4;
const key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);

/** The colliders, indexed by 4 m cell (each listed in every cell its reach covers). */
export class ColliderSet {
    readonly list: readonly Collider[];
    readonly version: string;
    /** The fences' gates (the walk grid steps through them: its cells are coarser than a gate). */
    readonly gates: readonly Gate[];
    private readonly cells = new Map<number, Collider[]>();

    constructor(list: Collider[], version: string, gates: Gate[] = []) {
        this.list = list;
        this.version = version;
        this.gates = gates;
        for (const c of list) {
            for (let i = Math.floor((c.cx - c.reach) / CELL); i <= Math.floor((c.cx + c.reach) / CELL); i++) {
                for (let j = Math.floor((c.cz - c.reach) / CELL); j <= Math.floor((c.cz + c.reach) / CELL); j++) {
                    const k = key(i, j);
                    const at = this.cells.get(k);
                    if (at) at.push(c);
                    else this.cells.set(k, [c]);
                }
            }
        }
    }

    /** Every collider whose reach comes within `r` of a point (each once, in index order). */
    near(x: number, z: number, r: number, out: Collider[] = []): Collider[] {
        out.length = 0;
        const i0 = Math.floor((x - r) / CELL);
        const i1 = Math.floor((x + r) / CELL);
        const j0 = Math.floor((z - r) / CELL);
        const j1 = Math.floor((z + r) / CELL);
        if (i0 === i1 && j0 === j1) {
            const at = this.cells.get(key(i0, j0));
            if (at) for (const c of at) out.push(c);
            return out;
        }
        for (let i = i0; i <= i1; i++) {
            for (let j = j0; j <= j1; j++) {
                const at = this.cells.get(key(i, j));
                if (!at) continue;
                for (const c of at) if (!out.includes(c)) out.push(c);
            }
        }
        return out;
    }

    private readonly scratch: Collider[] = [];

    /**
     * How far a point is from the nearest collider a body of this radius meets (m, negative inside one), up to `cap`.
     * With a base and height, only colliders its height span reaches into count.
     */
    clearance(x: number, z: number, radius = 0, cap = 4, base = -Infinity, height = Infinity): number {
        let best = cap;
        for (const c of this.near(x, z, cap, this.scratch)) {
            if (!bodyMeets(c, radius) || !spansCollider(c, base, height)) continue;
            const d = colliderDistance(c, x, z);
            if (d < best) best = d;
        }
        return best;
    }

    /** The collider a body (a disc of `radius`, optionally `height` tall from `base`) overlaps most, and by how much (m), or null. */
    deepest(x: number, z: number, radius: number, base = -Infinity, height = Infinity, kinds?: ReadonlySet<ColliderKind>): {collider: Collider; depth: number} | null {
        let best: {collider: Collider; depth: number} | null = null;
        for (const c of this.near(x, z, radius + 0.01, this.scratch)) {
            if ((kinds && !kinds.has(c.kind)) || !bodyMeets(c, radius) || !spansCollider(c, base, height)) continue;
            const depth = radius - colliderDistance(c, x, z);
            if (depth > 0 && (!best || depth > best.depth)) best = {collider: c, depth};
        }
        return best;
    }

    /** A body of this radius at (x, z) overlaps something solid (on the ground, or within its height span). */
    blocked(x: number, z: number, radius: number, base = -Infinity, height = Infinity): boolean {
        for (const c of this.near(x, z, radius + 0.01, this.scratch)) {
            if (!bodyMeets(c, radius) || !spansCollider(c, base, height)) continue;
            if (colliderDistance(c, x, z) < radius) return true;
        }
        return false;
    }

    /**
     * How far along a → b (0–1) a body of this radius goes before it touches a collider (1: all the way). Marched by the
     * distance to the nearest collider (a disc never steps past what it could touch), so a thin fence is never skipped;
     * `slack` lets it graze (m). A start already inside one: 0.
     */
    sweep(ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01): number {
        const length = Math.hypot(bx - ax, bz - az);
        const need = radius - slack;
        let s = 0;
        for (let guard = 0; guard < 4000; guard++) {
            const t = length > 0 ? s / length : 1;
            const x = ax + (bx - ax) * t;
            const z = az + (bz - az) * t;
            const free = this.clearance(x, z, radius, radius + 2) - need;
            if (free < 0) return Math.max(t, 0);
            if (s >= length) return 1;
            s = Math.min(s + Math.max(free, 0.02), length);
        }
        return 1;
    }

    /** How far a point is from the nearest solid thing of any kind, whatever its gaps and height (m), up to `cap`: the paths'. */
    distance(x: number, z: number, cap = 4, skip?: (c: Collider) => boolean): number {
        let best = cap;
        for (const c of this.near(x, z, cap, this.scratch)) {
            if (skip && skip(c)) continue;
            const d = colliderDistance(c, x, z);
            if (d < best) best = d;
        }
        return best;
    }

    /** `sweep` against every solid thing, whatever its gaps and height (the paths': a walker never threads a picket fence). */
    sweepAll(ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01, skip?: (c: Collider) => boolean): number {
        const length = Math.hypot(bx - ax, bz - az);
        const need = radius - slack;
        let s = 0;
        for (let guard = 0; guard < 4000; guard++) {
            const t = length > 0 ? s / length : 1;
            const free = this.distance(ax + (bx - ax) * t, az + (bz - az) * t, radius + 2, skip) - need;
            if (free < 0) return Math.max(t, 0);
            if (s >= length) return 1;
            s = Math.min(s + Math.max(free, 0.02), length);
        }
        return 1;
    }

    /** A straight run from a to b for a body of this radius touches nothing solid. */
    segmentClear(ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01): boolean {
        return this.sweep(ax, az, bx, bz, radius, slack) >= 1;
    }
}

// MARK: Building the set

/** The trunk of a decor or forest-fill tree as drawn: its radius (world m), its foot and how high it shows. */
function trunkCollider(item: DecorItem, host: string): CircleCollider | null {
    const asset = assetTrunk(item);
    let radius: number;
    let height: number;
    if (asset) {
        // (assetTrunk is in the decor item's own units: the item's scale makes it the world's.)
        radius = asset.radius * item.scale;
        height = asset.height * item.scale;
    } else if (item.kind === "canopy") {
        const tree = canopyTree(item.variant);
        radius = tree.base * item.scale;
        height = tree.height * item.scale;
    } else {
        const trunk = trunkOf(item.kind, item.variant);
        if (!trunk) return null;
        radius = trunk.radius * item.scale;
        height = trunk.height * item.scale;
    }
    const y0 = item.y - DECOR_SINK - 0.2;
    return {shape: "circle", kind: "trunk", id: `trunk:${host}`, cx: item.x, cz: item.z, r: radius, reach: radius, y0, y1: y0 + Math.max(height, 0.5), gap: 0};
}

const TREE_KINDS = new Set<DecorItem["kind"]>(["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard", "canopy", "cactus"]);

function box(kind: ColliderKind, id: string, cx: number, cz: number, rotation: number, hx0: number, hx1: number, hz0: number, hz1: number, y0: number, y1: number): BoxCollider {
    return {shape: "box", kind, id, cx, cz, cos: Math.cos(rotation), sin: Math.sin(rotation), hx0, hx1, hz0, hz1, y0, y1, reach: Math.hypot(Math.max(-hx0, hx1), Math.max(-hz0, hz1)), gap: 0};
}

function segment(kind: ColliderKind, id: string, a: {x: number; z: number}, b: {x: number; z: number}, r: number, y0: number, y1: number, gap = 0): SegmentCollider {
    const cx = (a.x + b.x) / 2;
    const cz = (a.z + b.z) / 2;
    return {shape: "segment", kind, id, ax: a.x, az: a.z, bx: b.x, bz: b.z, r, cx, cz, reach: Math.hypot(b.x - a.x, b.z - a.z) / 2 + r, y0, y1, gap};
}

function post(id: string, x: number, z: number, r: number, top: number): CircleCollider {
    const g = sampleGround(x, z).height;
    return {shape: "circle", kind: "post", id, cx: x, cz: z, r, reach: r, y0: g - 0.2, y1: g + top, gap: 0};
}

/** A rail fence between two posts (world): the rails (from `RAIL_CLEAR` up) and a post at each end (to the ground). */
function railFence(out: Collider[], id: string, a: {x: number; z: number}, b: {x: number; z: number}, top: number, posts: [boolean, boolean]) {
    const ga = sampleGround(a.x, a.z).height;
    const gb = sampleGround(b.x, b.z).height;
    const low = Math.min(ga, gb);
    out.push(segment("fence", `${id}:rails`, a, b, 0.05, low + RAIL_CLEAR, Math.max(ga, gb) + top));
    if (posts[0]) out.push(post(`${id}:post0`, a.x, a.z, 0.07, top));
    if (posts[1]) out.push(post(`${id}:post1`, b.x, b.z, 0.07, top));
}

/** The plots' buildings, fences and solid props. */
function plotColliders(out: Collider[], plots: HomePlot[]) {
    for (const plot of plots) {
        const frame = plotFrame(plot);
        const turn = plot.rotation;
        if (plot.kind === "house") {
            const k = cottageStyle(plot).scale;
            const hw = (COTTAGE.width / 2) * k;
            const hd = (COTTAGE.depth / 2) * k;
            out.push(box("building", `house:${plot.id}`, plot.x, plot.z, turn, -hw, hw, -hd, hd, frame.floor - 0.6, frame.floor + (COTTAGE.wall + COTTAGE.ridge) * k));
            // The picket fence (the gate's gap between its two front runs).
            picketRuns().forEach(([ax, az, bx, bz], n) => {
                const a = frame.toWorld(ax, az);
                const b = frame.toWorld(bx, bz);
                const g = Math.min(sampleGround(a.x, a.z).height, sampleGround(b.x, b.z).height);
                out.push(segment("fence", `picket:${plot.id}:${n}`, a, b, 0.05, g - 0.2, g + PICKET_POST_TOP + 0.1, PICKET_GAP));
            });
        } else {
            if (plot.barn !== false) {
                const [sx, sy, sz] = barnStyle(plot).size;
                // (vegetation.ts barnGeometry: about 6.4 by 4.4 m, its roof's ridge about 5.6 m up.)
                out.push(box("building", `barn:${plot.id}`, plot.x, plot.z, turn, -3.2 * sx, 3.2 * sx, -2.2 * sz, 2.2 * sz, frame.floor - 0.6, frame.floor + 5.6 * sy));
            }
            paddockFence(plot).forEach((part, n) => {
                const a = frame.toWorld(part.a.x, part.a.z);
                const b = frame.toWorld(part.b.x, part.b.z);
                if (part.rails) railFence(out, `paddock:${plot.id}:${n}`, a, b, PADDOCK_POST_TOP, [part.post, false]);
                else if (part.post) out.push(post(`paddock:${plot.id}:${n}:post0`, a.x, a.z, 0.07, PADDOCK_POST_TOP));
            });
        }
        // What the props lay on the plot that is solid (vegetable beds are walked over).
        plotKeepOuts(plot).forEach((keep, n) => {
            if (keep.what === "beds") return;
            const cx = (keep.x0 + keep.x1) / 2;
            const cz = (keep.z0 + keep.z1) / 2;
            const at = frame.toWorld(cx, cz);
            const g = sampleGround(at.x, at.z).height;
            const tall = keep.what === "hay_shelter" ? 2.7 : keep.what === "coop" ? 1.5 : keep.what === "trough" ? 0.6 : keep.what === "water_butt" ? 1.1 : keep.what === "hay" ? 0.5 : 1;
            out.push(box("building", `${keep.what}:${plot.id}:${n}`, at.x, at.z, turn, keep.x0 - cx, keep.x1 - cx, keep.z0 - cz, keep.z1 - cz, g - 0.3, g + tall));
        });
    }
}

/**
 * Two collider sets as one (Part C, one world: the wild island's and another island's, each in the world frame and apart
 * across the strait): every query near a point answers from what is near it on either island. The same object for the
 * same two sets (a scene's frame asks it each time).
 */
const unions = new WeakMap<ColliderSet, WeakMap<ColliderSet, ColliderSet>>();
export function unionColliders(a: ColliderSet, b: ColliderSet): ColliderSet {
    let byOther = unions.get(a);
    if (!byOther) unions.set(a, (byOther = new WeakMap()));
    let both = byOther.get(b);
    if (!both) byOther.set(b, (both = new ColliderSet([...a.list, ...b.list], `${a.version}+${b.version}`, [...a.gates, ...b.gates])));
    return both;
}

/** The plots' gates: each house's garden gate (`GARDEN`), each paddock's (`paddockSegments`' gate). */
export function buildGates(plots: HomePlot[] | null): Gate[] {
    const out: Gate[] = [];
    for (const plot of plots ?? defaultHomePlots()) {
        const frame = plotFrame(plot);
        const across = (lx: number, lz: number, ux: number, uz: number) => {
            const a = frame.toWorld(lx, lz);
            const b = frame.toWorld(lx + ux, lz + uz);
            const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
            return {x: a.x, z: a.z, nx: (b.x - a.x) / l, nz: (b.z - a.z) / l};
        };
        if (plot.kind === "house") {
            const g = across((GARDEN.gateFrom + GARDEN.gateTo) / 2, GARDEN.gateZ, 0, 1);
            out.push({id: `gate:${plot.id}`, ...g, width: GARDEN.gateTo - GARDEN.gateFrom});
        } else {
            for (const segment of paddockSegments(paddockRect(plot))) {
                if (!segment.gate) continue;
                const mx = (segment.a.x + segment.b.x) / 2;
                const mz = (segment.a.z + segment.b.z) / 2;
                const dx = segment.b.x - segment.a.x;
                const dz = segment.b.z - segment.a.z;
                const g = across(mx, mz, -dz, dx);
                out.push({id: `gate:${plot.id}`, ...g, width: Math.hypot(dx, dz)});
            }
        }
    }
    return out;
}

/** Every collider in the world for these plots (the hamlet's: `map/hamlet.ts` hamletPlotsFor; today's by default). */
export function buildColliders(plots: HomePlot[] | null): Collider[] {
    const out: Collider[] = [];
    // (Named by the scenery's own hosts, `decor<i>` and `fill<i>` (sampler.ts): a perch on a tree names its tree.)
    const decor = worldDecor();
    const items: Array<{item: DecorItem; host: string}> = [...decor.map((item, i) => ({item, host: `decor${i}`})), ...forestFill().map((item, i) => ({item: item as DecorItem, host: `fill${i}`}))];
    items.forEach(({item, host}, n) => {
        if (TREE_KINDS.has(item.kind)) {
            const trunk = trunkCollider(item, host);
            if (trunk) out.push(trunk);
        } else if (item.kind === "fence") {
            // vegetation.ts fence(): rails 2.45 m along the item's own x (turned by its rotation about y), posts at ±1.2 m.
            const ux = Math.cos(item.rotation);
            const uz = -Math.sin(item.rotation);
            const a = {x: item.x - ux * 1.225, z: item.z - uz * 1.225};
            const b = {x: item.x + ux * 1.225, z: item.z + uz * 1.225};
            railFence(out, `field-fence:${n}`, a, b, 1, [false, false]);
            out.push(post(`field-fence:${n}:post0`, item.x - ux * 1.2, item.z - uz * 1.2, 0.07, 1));
            out.push(post(`field-fence:${n}:post1`, item.x + ux * 1.2, item.z + uz * 1.2, 0.07, 1));
        } else if (item.kind === "hay") {
            // vegetation.ts hay(): a bale 1.15 m long on its side (along its own x), 1.24 m across.
            const s = item.scale;
            out.push(box("hay", `hay:${n}`, item.x, item.z, item.rotation, -0.575 * s, 0.575 * s, -0.62 * s, 0.62 * s, item.y - 0.1, item.y + 1.24 * s));
        } else if (item.kind === "lamp") {
            out.push(post(`lamp:${n}`, item.x, item.z, 0.1, 2.6));
        } else if (item.kind === "shrub") {
            // (The walk grid's own shrub: 0.5 m at its scale.)
            const r = 0.5 * item.scale;
            out.push({shape: "circle", kind: "shrub", id: `shrub:${n}`, cx: item.x, cz: item.z, r, reach: r, y0: item.y - 0.2, y1: item.y + 1.2 * item.scale, gap: 0, soft: true});
        }
    });
    // (Islands mode, `no-hamlet.ts`: no garden pond.)
    if (!noHamlet()) {
        const g = sampleGround(GARDEN_POND.x, GARDEN_POND.z).height;
        const r = GARDEN_POND.radius + POND_STONES;
        out.push({shape: "circle", kind: "pond", id: "pond:garden", cx: GARDEN_POND.x, cz: GARDEN_POND.z, r, reach: r, y0: g - 1, y1: g + 0.4, gap: 0});
    }
    // (A decor rock named by its host, `decor<i>`, as its faces and tops are; any other drawn rock by its place in the list.)
    const rockHosts = new Map<string, string>();
    decor.forEach((item, i) => {
        if (item.kind === "rock") rockHosts.set(`${item.x.toFixed(2)},${item.z.toFixed(2)}`, `decor${i}`);
    });
    drawnRocks().forEach((rock, n) => {
        const host = rockHosts.get(`${rock.x.toFixed(2)},${rock.z.toFixed(2)}`);
        out.push({shape: "box", kind: "rock", id: host ? `rock:${host}` : `rock:${n}`, cx: rock.x, cz: rock.z, cos: rock.cos, sin: rock.sin, hx0: rock.hx0, hx1: rock.hx1, hz0: rock.hz0, hz1: rock.hz1, y0: rock.y0, y1: rock.y1, reach: rock.reach, gap: 0});
    });
    floorObstacles().forEach((log, n) => {
        const g = sampleGround(log.x, log.z).height;
        // (floorObstacles' radius is the log's own plus 0.1 m: the drawn log is about that less.)
        const r = Math.max(log.radius - 0.1, 0.05);
        out.push({shape: "circle", kind: "log", id: `log:${n}`, cx: log.x, cz: log.z, r, reach: r, y0: g - 0.2, y1: g + r * 1.6, gap: 0});
    });
    plotColliders(out, plots ?? defaultHomePlots());
    return out;
}

let shared: {key: string; set: ColliderSet} | null = null;
// Islands mode flips (`no-hamlet.ts`): the default plots' key is the same, the world is not.
onHamletSwitch(() => {
    shared = null;
});
// And the world (`world.ts`: the bigger wild island's scenery, P3).
onArkWorld(() => {
    shared = null;
});

/** The plots' key (the same `world-sampler.ts` keys its walk grid's rebuild by). */
export function plotsKey(plots: HomePlot[] | null): string {
    return plots ? plots.map((p) => `${p.id}@${p.x.toFixed(2)},${p.z.toFixed(2)},${p.rotation.toFixed(3)},${p.kind},${p.barn === false ? 0 : 1}`).join(";") : "default";
}

/** The collider set for these plots, built once (and again when the plots change). */
export function colliderSetFor(plots: HomePlot[] | null): ColliderSet {
    const k = plotsKey(plots);
    if (shared && shared.key === k) return shared.set;
    const list = buildColliders(plots);
    const counts = new Map<string, number>();
    for (const c of list) counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1);
    const version = `collide:${Array.from(counts.entries()).map(([kind, n]) => `${kind}${n}`).join(".")}:${k.length}`;
    shared = {key: k, set: new ColliderSet(list, version, buildGates(plots))};
    return shared.set;
}

/** Drop the shared set (the scenery changed under it: tests). */
export function resetColliders() {
    shared = null;
}
