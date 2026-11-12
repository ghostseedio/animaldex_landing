/**
 * The town island's trees and shrubs as the asset library draws them (lane GC, the town's graphics pass;
 * docs/ark/town-island.md §11).
 *
 * - **Which tree.** Each planted tree's kind (the plan's: street and park limes and planes, the churchyard's yews, the
 *   gardens' cherries, apples and birches, the wood's oaks, birches and pines, the zoo's acacias, the shore's and the
 *   front gardens' shrubs) is drawn as a library tree of that species (`public/ark/assets/v1`, made in this repo, CC0),
 *   at its kind's real height (decision 34) times the plan's size roll: a park lime about 20 m, a street lime 12–15 m,
 *   a garden cherry 5–7 m, a front-garden holly 1–1.5 m.
 * - **Never inside each other (L6's tree spacing, `tree-spacing.ts`).** In the plan's order, each tree at its planted
 *   size first, then the same tree younger (×0.85 … ×0.5) where it would clash with a tree already standing, else left
 *   out (decision 95's order; a shrub is never put in a tree's place). A crown also keeps out of every building and zoo
 *   plot up to its roof or fence (a little overhang allowed), and a trunk off them.
 * - **The zoo's own trees** (the savanna's acacias, the bears' pines, a shade oak in the hoofstock paddocks, a small
 *   birch in each aviary under its net, the closed plots' lawn trees) settle the same way against the town's, per set
 *   of open enclosures.
 *
 * Pure: a function of the plan, the ground and the open enclosures; every reader (the renderer, the nav footprints and
 * colliders, the perches) asks `townTrees` / `townZooTrees`, so they agree on every tree.
 */

import {ASSETS} from "@/ark-scene/tree-pick";
import {assetAttachRows} from "@/ark-scene/tree-assets";
import {footprintBody, TreeSpacing, type TreeBody} from "@/ark-scene/tree-spacing";
import {boxDistance, centroid, hashText, inPoly, local, rng, type Box, type Poly} from "@/ark-scene/islands/town/geom";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {townPlan, type TownPlan, type TreeKind} from "@/ark-scene/islands/town/plan";
import type {ZooLayout} from "@/ark-scene/islands/town/areas";
import {ZOO_TYPES} from "@/ark-scene/islands/town/zoo-types";

type Species = {assets: string[]; /** Real mean height at the plan's size 1 (m). */ height: number; low?: boolean};

/**
 * Each kind's library trees and real height (m): English oak, common lime and London plane in parks 18–24 m (a street
 * lime is the plan's smaller roll), silver birch 15, weeping willow 12, Scots pine 18 on the coast, English yew 12, an
 * orchard or garden apple 5, a garden cherry 7, the savanna's umbrella thorn 8; shrubs holly and hazel 1.6.
 */
const SPECIES: Record<TreeKind, Species> = {
    oak: {assets: ["oak-a", "oak-b", "oak-c"], height: 18},
    lime: {assets: ["lime-a", "lime-c", "lime-a"], height: 20},
    plane: {assets: ["plane-a", "plane-b"], height: 22},
    birch: {assets: ["birch-a", "birch-b", "birch-c"], height: 15},
    willow: {assets: ["willow-a", "willow-b"], height: 12},
    poplar: {assets: ["beech-b", "beech-a"], height: 20},
    pine: {assets: ["pine-a", "pine-b", "pine-c"], height: 18},
    yew: {assets: ["yew-a", "yew-b"], height: 12},
    apple: {assets: ["apple-a", "apple-b", "apple-a", "apple-c"], height: 5},
    cherry: {assets: ["cherry-a", "cherry-a", "cherry-b"], height: 7},
    acacia: {assets: ["acacia-a", "acacia-b", "acacia-c"], height: 8},
    palm: {assets: ["palm-a", "palm-b", "palm-c"], height: 10},
    hedge_shrub: {assets: ["bush-holly-a", "bush-holly-b", "bush-hazel-a"], height: 1.6, low: true}
};

/** The street form of the lime (crown lifted for the traffic), for the plan's smaller limes. */
const STREET_LIME = "lime-b";
/** Younger and younger, where the tree at its planted size would clash (decision 95). */
const YOUNGER = [1, 0.85, 0.72, 0.6, 0.5];
/** The plan's largest size roll drawn (a veteran park tree at 1.2 its kind's mean). */
const MAX_SIZE = 1.2;
/** How far a crown may overhang a roof or a fence's top line: this share of its (85%) radius. */
const OVERHANG = 0.25;
/** A trunk keeps this far off a building or a zoo plot (m). */
const TRUNK_CLEAR = 0.3;
/** The decor's sink (`micro-decor.ts` DECOR_SINK), so the trunk's foot is in the ground. */
const SINK = 0.08;

/** A town tree as drawn: its library asset, foot, turn and scale, and its measured body (for spacing and colliders). */
export type TownTree = {
    id: string;
    kind: TreeKind;
    asset: string;
    x: number;
    y: number;
    z: number;
    rotation: number;
    /** Uniform scale on the asset (its own metres). */
    scale: number;
    /** A shrub (understorey): no perches, a soft collider. */
    low: boolean;
    /** The drawn tree's height (m) and its trunk's radius at the foot (m). */
    height: number;
    trunk: number;
    /** The crown's lowest leaves over the foot (m) and its 85% leaf radius (m). */
    crownBase: number;
    crown: number;
    seed: number;
};

const meanHeights = new Map<string, number>();
function meanHeight(species: Species): number {
    const key = species.assets.join(",");
    let h = meanHeights.get(key);
    if (h === undefined) {
        const unique = Array.from(new Set(species.assets));
        h = unique.reduce((sum, id) => sum + (ASSETS[id]?.height ?? 1), 0) / unique.length;
        meanHeights.set(key, h);
    }
    return h;
}

function pickAsset(kind: TreeKind, size: number, seed: number): string {
    const species = SPECIES[kind];
    if (kind === "lime" && size < 0.8) return STREET_LIME;
    return species.assets[(seed >>> 3) % species.assets.length];
}

/** The foot: sunk until no side of the trunk's foot is in the air (as the wild island's trees, L6). */
function footHeight(x: number, z: number, trunk: number): number {
    const ground = townHeight(x, z);
    let lowest = ground;
    const r = trunk * 0.8;
    for (let k = 0; k < 8; k++) lowest = Math.min(lowest, townHeight(x + Math.cos((k * Math.PI) / 4) * r, z + Math.sin((k * Math.PI) / 4) * r));
    return Math.min(ground - SINK, lowest - 0.02);
}

/** A candidate tree at a height (m), as drawn, its foot at `y` (`footHeight` at its planted size). */
function drawn(id: string, kind: TreeKind, asset: string, x: number, y: number, z: number, seed: number, height: number): {tree: TownTree; body: TreeBody} | null {
    const info = ASSETS[asset];
    if (!info) return null;
    const species = SPECIES[kind];
    const scale = height / (species.low ? info.height : meanHeight(species));
    const rotation = (seed % 628) / 100;
    const body = footprintBody(asset, {x, y, z, rotation}, scale, species.low === true);
    if (!body) return null;
    const crown = Math.max(...body.bands.map((band) => band[2]));
    return {tree: {id, kind, asset, x, y, z, rotation, scale, low: species.low === true, height: body.top - y, trunk: body.trunk, crownBase: body.bands[0][0] - y, crown, seed}, body};
}

/**
 * Something a crown keeps out of up to its top (a building's roof, a zoo plot's net, house or fence). `own`: the zoo
 * plot's id, whose own trees stand inside it (only under a net: `net`, the top binds them).
 */
type Blocker = {at: Box; top: number; own?: string; net?: boolean};

function blockedBy(body: TreeBody, blockers: readonly Blocker[], own?: string): boolean {
    for (const b of blockers) {
        const reach = Math.hypot(b.at.w, b.at.d) / 2 + body.reach + 1;
        if (Math.abs(b.at.x - body.cx) > reach || Math.abs(b.at.z - body.cz) > reach) continue;
        if (own !== undefined && b.own === own) {
            // A tree inside its own enclosure: under the aviary's net.
            if (b.net && body.top > b.top - 0.6) return true;
            continue;
        }
        if (boxDistance(b.at, body.x, body.z) < body.trunk + TRUNK_CLEAR) return true;
        const d = boxDistance(b.at, body.cx, body.cz);
        for (const [from, , r] of body.bands) {
            if (from >= b.top) continue;
            if (d < r * (1 - OVERHANG)) return true;
        }
    }
    return false;
}

/** The zoo plot's top a crown keeps under (m over the sea's level): the net, the house's roof, the fence. */
function plotTop(at: Box, type: string | null): number {
    const ground = townHeight(at.x, at.z);
    const spec = type ? ZOO_TYPES[type as keyof typeof ZOO_TYPES] : null;
    if (!spec) return ground + 2.6;
    if (spec.form === "aviary") return ground + 8.5;
    if (spec.form === "house") return ground + (type === "primate_house" ? 9 : 7);
    return ground + (type === "big_cats" ? 5 : type === "childrens_farm" || type === "small_mammals" ? 1.6 : 2.8);
}

function blockersOf(plan: TownPlan): Blocker[] {
    const out: Blocker[] = [];
    for (const b of plan.buildings) out.push({at: b.at, top: townHeight(b.at.x, b.at.z) + b.top + 0.3});
    for (const s of plan.zoo.slots) out.push({at: s.at, top: plotTop(s.at, s.type), own: s.id, net: ZOO_TYPES[s.type].form === "aviary"});
    // (A spare may take an aviary: kept clear to a net's height.)
    for (const s of plan.zoo.spares) out.push({at: s.at, top: townHeight(s.at.x, s.at.z) + 8.5, own: s.id, net: true});
    return out;
}

/** Settles one candidate: its planted size, then younger; null where even the youngest clashes. */
function settleOne(spacing: TreeSpacing, blockers: readonly Blocker[], id: string, kind: TreeKind, x: number, z: number, size: number, seed: number, own?: string, height?: number): TownTree | null {
    const species = SPECIES[kind];
    const asset = pickAsset(kind, size, seed);
    const info = ASSETS[asset];
    if (!info) return null;
    const planted = height ?? species.height * Math.min(Math.max(size, 0.5), MAX_SIZE);
    const y = footHeight(x, z, info.trunk_radius * (planted / (species.low ? info.height : meanHeight(species))));
    for (const younger of YOUNGER) {
        const candidate = drawn(id, kind, asset, x, y, z, seed, planted * younger);
        if (!candidate) return null;
        if (blockedBy(candidate.body, blockers, own)) continue;
        if (!spacing.fits(candidate.body)) continue;
        spacing.add(candidate.body);
        return candidate.tree;
    }
    return null;
}

type Settled = {trees: TownTree[]; spacing: () => TreeSpacing};
const settled = new WeakMap<TownPlan, Settled>();

function settlePlan(plan: TownPlan): Settled {
    const spacing = new TreeSpacing();
    const blockers = blockersOf(plan);
    const trees: TownTree[] = [];
    plan.trees.forEach((t, i) => {
        const tree = settleOne(spacing, blockers, `town:${i}:${t.seed}`, t.kind, t.x, t.z, t.scale, t.seed);
        if (tree) trees.push(tree);
    });
    // (A fresh spacing with the town's trees in it, for each set of zoo trees.)
    return {trees, spacing: () => {
        const copy = new TreeSpacing();
        for (const body of spacing.bodies) copy.add(body);
        return copy;
    }};
}

/** The plan's trees as drawn, settled (see the top). */
export function townTrees(plan: TownPlan = townPlan()): TownTree[] {
    let s = settled.get(plan);
    if (!s) {
        s = settlePlan(plan);
        settled.set(plan, s);
    }
    return s.trees;
}

/** The town's prebuild worker's answer (decision 153): the same trees, not settled again on the page's thread. */
export function primeTownTrees(plan: TownPlan, trees: TownTree[]): void {
    if (settled.has(plan)) return;
    settled.set(plan, {trees, spacing: () => {
        const spacing = new TreeSpacing();
        for (const t of trees) {
            const body = footprintBody(t.asset, t, t.scale, t.low);
            if (body) spacing.add(body);
        }
        return spacing;
    }});
}

// MARK: - The zoo's trees

const zooMemo = new WeakMap<TownPlan, Map<string, TownTree[]>>();

/**
 * The zoo's own trees for these open enclosures (and the closed plots' lawn trees), settled against the town's: the
 * savanna's acacias, the bears' and wolves' pines, a shade oak in a hoofstock paddock, a small birch under each aviary's
 * net; on a closed plot two or three limes and birches.
 */
export function townZooTrees(layout: ZooLayout, plan: TownPlan = townPlan()): TownTree[] {
    const key = [...layout.enclosures.filter((e) => !e.shared).map((e) => e.id), "|", ...layout.closed.map((c) => c.id)].join(",");
    let memo = zooMemo.get(plan);
    if (!memo) zooMemo.set(plan, (memo = new Map()));
    const known = memo.get(key);
    if (known) return known;
    townTrees(plan);
    const spacing = settled.get(plan)!.spacing();
    const blockers = blockersOf(plan);
    const out: TownTree[] = [];
    const inPool = (pool: Poly | null, x: number, z: number) => pool !== null && (inPoly(pool, x, z) || Math.hypot(x - centroid(pool).x, z - centroid(pool).z) < 2.5);
    for (const e of layout.enclosures) {
        if (e.shared) continue;
        const s = e.slot.at;
        const r = rng(hashText(`${e.slot.id}:trees`));
        const wanted: Array<{kind: TreeKind; height: number; n: number; margin: number}> =
            e.type === "savanna_paddocks" ? [{kind: "acacia", height: 8, n: 2, margin: 5}]
                : e.type === "bears_wolves" ? [{kind: "pine", height: 13, n: 2, margin: 4}]
                    : e.type === "hoofstock_paddocks" ? [{kind: "oak", height: 14, n: 1, margin: 6}]
                        : ZOO_TYPES[e.type].form === "aviary" ? [{kind: "birch", height: 6, n: 1, margin: 3}] : [];
        for (const w of wanted) {
            let placed = 0;
            for (let attempt = 0; attempt < 12 && placed < w.n; attempt++) {
                const p = local(s, (r() - 0.5) * Math.max(s.w - w.margin * 2, 1), (r() - 0.5) * Math.max(s.d - w.margin * 2, 1));
                if (inPool(e.pool, p.x, p.z)) continue;
                const seed = hashText(`${e.slot.id}:tree:${attempt}`);
                const height = w.height * (0.9 + r() * 0.25);
                const tree = settleOne(spacing, blockers, `zoo:${e.slot.id}:${attempt}`, w.kind, p.x, p.z, 1, seed, e.slot.id, Math.min(height, ZOO_TYPES[e.type].form === "aviary" ? 6.5 : height));
                if (tree) {
                    out.push(tree);
                    placed++;
                }
            }
        }
    }
    for (const plot of layout.closed) {
        const r = rng(hashText(`${plot.id}:trees`));
        const n = 2 + Math.floor(r() * 2);
        for (let k = 0; k < n; k++) {
            const p = local(plot.at, (r() - 0.5) * (plot.at.w - 4), (r() - 0.5) * (plot.at.d - 4));
            const kind: TreeKind = r() < 0.5 ? "lime" : "birch";
            const tree = settleOne(spacing, blockers, `zoo:${plot.id}:${k}`, kind, p.x, p.z, 0.7 + r() * 0.3, hashText(`${plot.id}${k}`), plot.id);
            if (tree) out.push(tree);
        }
    }
    memo.set(key, out);
    return out;
}

// MARK: - Perches on the drawn trees

export type TownPerch = {tag: "bark" | "branch" | "leaf"; x: number; y: number; z: number; nx: number; ny: number; nz: number; yaw: number};

/**
 * A tree's places for the behaviour world (the town's sampler), on the drawn tree's own surfaces (the asset's attach
 * points, `tree-attach.json`, placed as the tree is): one on the bark at climbing height, three on the tops of branches
 * (the widest, round the crown), one on a leaf high in the crown. Shrubs have none.
 */
export function townTreePerches(tree: TownTree): TownPerch[] {
    if (tree.low) return [];
    const rows = assetAttachRows(tree.asset);
    const c = Math.cos(tree.rotation);
    const s = Math.sin(tree.rotation);
    const place = (row: readonly unknown[], tag: TownPerch["tag"]): TownPerch => {
        const [, px, py, pz, nx, ny, nz, fx, , fz] = row as number[];
        const x = (px * c + pz * s) * tree.scale;
        const z = (-px * s + pz * c) * tree.scale;
        const wx = fx * c + fz * s;
        const wz = -fx * s + fz * c;
        return {tag, x: tree.x + x, y: tree.y + py * tree.scale, z: tree.z + z, nx: nx * c + nz * s, ny, nz: -nx * s + nz * c, yaw: Math.atan2(wx, wz)};
    };
    const out: TownPerch[] = [];
    const bark = rows.filter((r) => r[0] === "bark").sort((a, b) => Math.abs((a[2] as number) * tree.scale - 1.4) - Math.abs((b[2] as number) * tree.scale - 1.4));
    if (bark[0]) out.push(place(bark[0], "bark"));
    const branches = rows.filter((r) => r[0] === "branch");
    // Round the crown: the branch tops sorted by their direction, three apart.
    branches.sort((a, b) => Math.atan2(a[3] as number, a[1] as number) - Math.atan2(b[3] as number, b[1] as number));
    for (let k = 0; k < 3 && branches.length; k++) out.push(place(branches[Math.floor((k * branches.length) / 3)], "branch"));
    const leaves = rows.filter((r) => r[0] === "leaf").sort((a, b) => (b[2] as number) - (a[2] as number));
    if (leaves[0]) out.push(place(leaves[Math.min(1, leaves.length - 1)], "leaf"));
    return out;
}
