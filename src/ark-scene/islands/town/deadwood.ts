/**
 * Dead wood on the town island (graphics pass 2, lane town2; the owner: "often you find caterpillars and rotting wood
 * feeders on here too in real life which we should do on the ark too to feel more realistic"): fallen logs and old
 * stumps, mossy and with bracket fungus, in the wood, the churchyard, the wild corner, the park's edges and the back of
 * some gardens (a log pile), each with a patch of nettles and bramble beside it.
 *
 * - Where the wood-dwellers already aboard live (`niche.ts` DEADWOOD_SLUGS, from data/ark/town-deadwood-species.json:
 *   stored text puts them under logs or bark, or eating rotting wood): a `deadwood` spot at each log's foot, and on
 *   the log itself the places the schedule goes to (its top, its bark, the litter and shade at its foot).
 * - Where the moths and butterflies whose caterpillars live on leaves rest (LEAF_SLUGS): a `leaves` spot at each
 *   patch, and leaf places on its tops.
 *
 * Pure in the plan: the same for every viewer. Placed clear of buildings, garden rooms and ponds, trees' trunks,
 * hedges, streets and paths, the water, door ways and each other.
 */

import {hashText, inPoly, local, polyEdgeDistance, polylineDistance, rng, segmentDistance, type Box, type Poly} from "@/ark-scene/islands/town/geom";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {townTileHeight} from "@/ark-scene/islands/town/drawn-ground";
import {townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";
import {townTrees} from "@/ark-scene/islands/town/trees";
import {inTownSolid} from "@/ark-scene/islands/town/tanks";
import {clearOfDoors} from "@/ark-scene/islands/town/doors";

export type DeadwoodItem = {
    id: string;
    kind: "log" | "stump";
    /** Its middle on the ground (town frame). */
    x: number;
    z: number;
    /** A log's axis heading (radians, along local x: (cos, sin)); a stump's turn. */
    rot: number;
    /** A log's length (m); a stump's height. */
    length: number;
    /** Its radius (m). */
    r: number;
    /** Its lowest drawn ground under it (m): a log's underside is sunk to it, a stump stands from it. */
    base: number;
    /** The green, garden or parcel it lies in. */
    place: string;
    seed: number;
};

/** A patch of nettles and bramble beside a log or stump (leaf places for the caterpillars' moths and butterflies). */
export type LeafPatch = {id: string; x: number; z: number; r: number; height: number; base: number; place: string; seed: number};

export type TownDeadwood = {items: DeadwoodItem[]; patches: LeafPatch[]};

/** How many of each go in each kind of green (logs, stumps). */
const PER_GREEN: Record<string, [number, number]> = {wood: [9, 4], churchyard: [2, 1], wild_corner: [3, 1], park: [3, 1]};

const memo = new WeakMap<TownPlan, TownDeadwood>();

export function townDeadwood(plan: TownPlan = townPlan()): TownDeadwood {
    const cached = memo.get(plan);
    if (cached) return cached;
    const items: DeadwoodItem[] = [];
    const patches: LeafPatch[] = [];
    const trees = townTrees(plan);
    const streets = plan.streets.map((s) => ({line: s.line, reach: s.width / 2 + s.pavement + 0.6}));
    const clear = (x: number, z: number, reach: number, except: DeadwoodItem | null = null): boolean => {
        if (inTownSolid(x, z, reach + 0.3)) return false;
        const g = sampleTownGround(x, z);
        if (g.surface === "water" || g.surface === "sea" || g.surface === "bank" || g.height < 0.3) return false;
        for (const t of trees) if (Math.hypot(t.x - x, t.z - z) < t.trunk + reach + (t.low ? 0.5 : 0.7)) return false;
        for (const s of streets) if (polylineDistance(s.line, x, z) < s.reach + reach) return false;
        for (const h of plan.hedges) {
            for (let i = 1; i < h.line.length; i++) {
                const a = h.line[i - 1];
                const b = h.line[i];
                if (segmentDistance(x, z, a.x, a.z, b.x, b.z) < reach + 0.7) return false;
            }
        }
        if (!clearOfDoors({x, z, w: reach * 2, d: reach * 2, rot: 0}, 0.3, plan)) return false;
        for (const o of items) if (o !== except && Math.hypot(o.x - x, o.z - z) < reach + (o.kind === "log" ? o.length / 2 : o.r) + 0.8) return false;
        for (const p of patches) if (Math.hypot(p.x - x, p.z - z) < reach + p.r + 0.3) return false;
        return true;
    };
    const lowest = (pts: ReadonlyArray<[number, number]>) => Math.min(...pts.map(([x, z]) => townTileHeight(x, z)));
    const logBase = (x: number, z: number, rot: number, length: number, r: number) => {
        const pts: Array<[number, number]> = [];
        for (const u of [-0.5, -0.25, 0, 0.25, 0.5]) for (const v of [-1, 0, 1]) pts.push([x + Math.cos(rot) * u * length - Math.sin(rot) * v * r, z + Math.sin(rot) * u * length + Math.cos(rot) * v * r]);
        return lowest(pts);
    };
    const flatEnough = (x: number, z: number, reach: number) => {
        const hs = [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach]].map(([dx, dz]) => townTileHeight(x + dx, z + dz));
        return Math.max(...hs) - Math.min(...hs) < 0.35 + reach * 0.15;
    };
    const addPatch = (owner: DeadwoodItem, r: () => number) => {
        // Beside it, on whichever side is clear: nettles grow where the wood rots and the soil is rich.
        for (let k = 0; k < 6; k++) {
            const a = owner.rot + Math.PI / 2 + (k % 2 ? Math.PI : 0) + (r() - 0.5) * 0.8;
            const out = owner.r + 0.75 + r() * 0.4;
            const along = owner.kind === "log" ? (r() - 0.5) * owner.length * 0.6 : 0;
            const x = owner.x + Math.cos(a) * out + Math.cos(owner.rot) * along;
            const z = owner.z + Math.sin(a) * out + Math.sin(owner.rot) * along;
            const pr = 0.5 + r() * 0.25;
            // (Its own clearance, but it may stand by its own log.)
            if (!clear(x, z, pr, owner) || !flatEnough(x, z, pr)) continue;
            patches.push({id: `${owner.id}:patch`, x, z, r: pr, height: 0.55 + r() * 0.3, base: lowest([[x, z], [x + pr, z], [x - pr, z], [x, z + pr], [x, z - pr]]), place: owner.place, seed: hashText(`${owner.id}:patch`)});
            return;
        }
    };
    const tryLog = (id: string, place: string, pick: () => {x: number; z: number} | null, r: () => number, small = false): DeadwoodItem | null => {
        for (let tries = 0; tries < 40; tries++) {
            const p = pick();
            if (!p) continue;
            const length = small ? 1.1 + r() * 0.5 : 2.2 + r() * 2.4;
            const radius = small ? 0.11 + r() * 0.05 : 0.17 + r() * 0.13;
            const rot = r() * Math.PI;
            const ends = [-0.5, 0, 0.5].map((u) => ({x: p.x + Math.cos(rot) * u * length, z: p.z + Math.sin(rot) * u * length}));
            if (!ends.every((e) => clear(e.x, e.z, radius + 0.2))) continue;
            if (!ends.every((e) => flatEnough(e.x, e.z, radius + 0.3))) continue;
            const base = logBase(p.x, p.z, rot, length, radius);
            // (Along a slope it is bedded at its lowest: the ground under it never rises past its middle.)
            if (Math.max(...[-0.5, -0.25, 0, 0.25, 0.5].map((u) => townTileHeight(p.x + Math.cos(rot) * u * length, p.z + Math.sin(rot) * u * length))) > base + radius * 0.9) continue;
            const item: DeadwoodItem = {id, kind: "log", x: p.x, z: p.z, rot, length, r: radius, base, place, seed: hashText(id)};
            items.push(item);
            return item;
        }
        return null;
    };
    const tryStump = (id: string, place: string, pick: () => {x: number; z: number} | null, r: () => number): DeadwoodItem | null => {
        for (let tries = 0; tries < 40; tries++) {
            const p = pick();
            if (!p) continue;
            const radius = 0.26 + r() * 0.16;
            if (!clear(p.x, p.z, radius + 0.25) || !flatEnough(p.x, p.z, radius + 0.2)) continue;
            const item: DeadwoodItem = {id, kind: "stump", x: p.x, z: p.z, rot: r() * Math.PI * 2, length: 0.32 + r() * 0.35, r: radius, base: lowest([[p.x + radius, p.z], [p.x - radius, p.z], [p.x, p.z + radius], [p.x, p.z - radius], [p.x, p.z]]), place, seed: hashText(id)};
            items.push(item);
            return item;
        }
        return null;
    };
    const inside = (poly: Poly, r: () => number, inset: number) => {
        let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
        for (const q of poly) {
            x0 = Math.min(x0, q.x);
            z0 = Math.min(z0, q.z);
            x1 = Math.max(x1, q.x);
            z1 = Math.max(z1, q.z);
        }
        return () => {
            const x = x0 + r() * (x1 - x0);
            const z = z0 + r() * (z1 - z0);
            return inPoly(poly, x, z) && polyEdgeDistance(poly, x, z) > inset ? {x, z} : null;
        };
    };
    for (const g of plan.greens) {
        const n = PER_GREEN[g.kind];
        if (!n) continue;
        const r = rng(hashText(`deadwood:${g.id}`));
        const pick = inside(g.poly, r, 2.5);
        for (let k = 0; k < n[0]; k++) {
            const log = tryLog(`deadwood:${g.id}:log${k}`, g.id, pick, r);
            if (log && k % 2 === 0) addPatch(log, r);
        }
        for (let k = 0; k < n[1]; k++) {
            const stump = tryStump(`deadwood:${g.id}:stump${k}`, g.id, pick, r);
            if (stump && k % 2 === 1) addPatch(stump, r);
        }
    }
    // A log pile at the bottom of every third house's back garden (a wildlife corner), clear of its shed and pond.
    // (Parcel ids repeat on some streets: the id carries the parcel's index.)
    plan.parcels.forEach((p, i) => {
        if (p.kind !== "house" || !p.back || p.seed % 3 !== 0) return;
        const back: Box = p.back;
        const r = rng(p.seed ^ 0x2d2d);
        const pick = () => {
            const u = (r() - 0.5) * (back.w - 2.4);
            const v = -back.d / 2 + 1.1 + r() * Math.min(1.6, back.d * 0.3);
            const q = local(back, u, v);
            return {x: q.x, z: q.z};
        };
        const log = tryLog(`deadwood:${p.id}#${i}:log`, p.id, pick, r, true);
        if (log) addPatch(log, r);
    });
    const out = {items, patches};
    memo.set(plan, out);
    return out;
}

/** The places on a log or stump, in the town's frame: its top, its bark, the litter and shade at its foot. */
export type DeadwoodPlace = {tag: "log_top" | "bark" | "leaf_litter" | "shade" | "leaf"; x: number; y: number; z: number; nx: number; ny: number; nz: number; yaw: number};

export function deadwoodPlaces(item: DeadwoodItem): DeadwoodPlace[] {
    const c = Math.cos(item.rot);
    const s = Math.sin(item.rot);
    const out: DeadwoodPlace[] = [];
    if (item.kind === "log") {
        // (A log's axis is r·0.8 over its base: it is bedded in the ground a little.)
        const axis = item.base + item.r * 0.8;
        const yaw = Math.atan2(c, s);
        for (const u of [-0.25, 0.2]) out.push({tag: "log_top", x: item.x + c * u * item.length, y: axis + item.r, z: item.z + s * u * item.length, nx: 0, ny: 1, nz: 0, yaw});
        // On its side, half way up, the bark faces out (−sin, cos) of the axis.
        out.push({tag: "bark", x: item.x - s * item.r, y: axis, z: item.z + c * item.r, nx: -s, ny: 0, nz: c, yaw});
        out.push({tag: "bark", x: item.x + s * item.r + c * item.length * 0.3, y: axis, z: item.z - c * item.r + s * item.length * 0.3, nx: s, ny: 0, nz: -c, yaw});
        const foot = item.r + 0.18;
        out.push({tag: "leaf_litter", x: item.x - s * foot - c * item.length * 0.2, y: townTileHeight(item.x - s * foot, item.z + c * foot), z: item.z + c * foot - s * item.length * 0.2, nx: 0, ny: 1, nz: 0, yaw});
        out.push({tag: "shade", x: item.x + s * foot, y: townTileHeight(item.x + s * foot, item.z - c * foot), z: item.z - c * foot, nx: 0, ny: 1, nz: 0, yaw});
    } else {
        out.push({tag: "log_top", x: item.x, y: item.base + item.length, z: item.z, nx: 0, ny: 1, nz: 0, yaw: item.rot});
        out.push({tag: "bark", x: item.x + c * item.r, y: item.base + item.length * 0.45, z: item.z + s * item.r, nx: c, ny: 0, nz: s, yaw: item.rot});
        const foot = item.r + 0.2;
        out.push({tag: "leaf_litter", x: item.x - c * foot, y: townTileHeight(item.x - c * foot, item.z - s * foot), z: item.z - s * foot, nx: 0, ny: 1, nz: 0, yaw: item.rot});
    }
    return out;
}

/** A deadwood spot: at the foot of the log or stump, on the ground beside it (where its dwellers are placed). */
export function deadwoodFoot(item: DeadwoodItem): {x: number; z: number} {
    const c = Math.cos(item.rot);
    const s = Math.sin(item.rot);
    const out = item.r + 0.12;
    return {x: item.x - s * out, z: item.z + c * out};
}

/** A patch's leaf places: three of its tops. */
export function leafPatchPlaces(p: LeafPatch): DeadwoodPlace[] {
    return [0, 1, 2].map((k) => {
        const a = (p.seed % 628) / 100 + (k * Math.PI * 2) / 3;
        const d = p.r * (k === 0 ? 0.1 : 0.45);
        return {tag: "leaf" as const, x: p.x + Math.cos(a) * d, y: p.base + p.height * (k === 0 ? 1 : 0.82), z: p.z + Math.sin(a) * d, nx: 0, ny: 1, nz: 0, yaw: a};
    });
}
