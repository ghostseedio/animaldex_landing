/**
 * Climbing a tree the way a climber does (the owner, 2026-11-17, on the live Ark: "monkeys are climbing trees parallel
 * to the ground and not the tree").
 *
 * The cause: a climb leg (`behaviour-schedule.ts` legPose "surface") between the ground and a place up in a tree (a
 * limb's top, a branch, a hang point under a limb) was one straight line from its foot on the ground to the place,
 * its normal blended between the two ends' normals. Both of those point up (the ground's, and a limb's top), so the
 * body stayed level, belly to the world's floor, and slid up a diagonal through the air beside the tree; down the same.
 * `wall-climb.ts` had mended this only where one end is itself on a sheer surface (a wall, the bark), which a limb's top
 * is not. Every tree climber the schedule sends up a tree (the primates, squirrels, martens, koalas, cats, bears, lizards)
 * did it, near and far, rigged or not: the drawn body takes its frame from this pose.
 *
 * Here: the climb goes through the tree's own trunk. From the ground it walks to the trunk's foot on the side it comes
 * from, climbs the trunk itself (its belly to the bark, its body along the trunk's axis, following the trunk's measured
 * lean and taper, spiralling round to the side its limb leaves from), then out along the limb to the place, its body
 * along the limb. Down the same the other way: head first for the kinds that come down head first (squirrels,
 * nuthatches, lizards, geckos and other reptiles, insects and spiders), backing down tail first for every other (the
 * primates, bears, cats, koalas, sloths, woodpeckers). Between two trees it comes down one and goes up the other.
 *
 * The trunk is the drawn tree's: its asset's bark points (`tree-attach.json`, on the drawn lod0 surface) fitted to an
 * axis that may lean and a radius that tapers (`fitTrunk`), placed where the renderer places the tree. Pure in its
 * inputs: the same for every viewer.
 */

import {assetAttachRows, type TreeWind} from "@/ark-scene/tree-assets";

type Vec = {x: number; y: number; z: number};

/** A trunk in the world: its axis through (x, y, z) at its foot, drifting (lx, lz) per metre up; its radius r0 there, tapering by `taper` a metre. */
export type Trunk = {x: number; y: number; z: number; lx: number; lz: number; r0: number; taper: number; /** The highest it is climbed (m above its foot). */ height: number};

/** An end of a climb: a spot, its surface's normal, and (on a tree) the way its limb runs. */
export type ClimbSpot = {x: number; y: number; z: number; nx: number; ny: number; nz: number};

/** How far out of the bark the contact point is (m): the bark's skin, so the body is on it, not in it. */
export const BARK_SKIN = 0.01;
/**
 * The most of a corner (m), each side of it, the body turns over from one surface to the next. (Its heading turns over
 * the inner half of that: on the trunk side of a corner its body is already along the trunk.)
 */
export const TREE_CORNER = 0.18;

// MARK: - The trunk

/**
 * The axis and radius of a trunk from points on its bark (each with its outward normal): least squares for the axis
 * c(y) = c0 + lean·y and the radius r(y) = r0 + taper·y, with the lean and the taper held gently to nothing where the
 * points say little (a soft prior), so two points at one height still give an upright trunk. Null with no points.
 */
export function fitTrunk(points: ReadonlyArray<{x: number; y: number; z: number; nx: number; nz: number}>): {cx: number; cz: number; lx: number; lz: number; r0: number; taper: number} | null {
    if (!points.length) return null;
    // Unknowns: cx, cz, lx, lz, r0, taper. The normal equations (A^T A) p = A^T b.
    const n = 6;
    const m = Array.from({length: n}, () => new Array<number>(n + 1).fill(0));
    const row = (a: number[], b: number) => {
        for (let i = 0; i < n; i++) {
            if (!a[i]) continue;
            for (let j = 0; j < n; j++) m[i][j] += a[i] * a[j];
            m[i][n] += a[i] * b;
        }
    };
    for (const p of points) {
        const l = Math.hypot(p.nx, p.nz) || 1;
        const nx = p.nx / l;
        const nz = p.nz / l;
        row([1, 0, p.y, 0, nx, nx * p.y], p.x);
        row([0, 1, 0, p.y, nz, nz * p.y], p.z);
    }
    // The prior: no lean, no taper, unless the points say so (weights in metres of evidence).
    const prior = 0.5;
    row([0, 0, prior, 0, 0, 0], 0);
    row([0, 0, 0, prior, 0, 0], 0);
    row([0, 0, 0, 0, 0, prior], 0);
    // A trunk of one height's points: its radius from them, its centre where their normals meet.
    row([0, 0, 0, 0, 1e-3, 0], 0);
    // Gaussian elimination with partial pivoting.
    for (let c = 0; c < n; c++) {
        let best = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[best][c])) best = r;
        if (Math.abs(m[best][c]) < 1e-12) return null;
        [m[c], m[best]] = [m[best], m[c]];
        for (let r = 0; r < n; r++) {
            if (r === c) continue;
            const f = m[r][c] / m[c][c];
            for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
        }
    }
    const v = m.map((r, i) => r[n] / r[i]);
    const [cx, cz, lx, lz, r0, taper] = v;
    if (![cx, cz, lx, lz, r0, taper].every(Number.isFinite) || r0 <= 0) return null;
    return {cx, cz, lx, lz, r0, taper};
}

const assetTrunks = new Map<string, ReturnType<typeof fitTrunk> & {top: number}>();

/** An asset tree's trunk in its own metres (its bark points fitted), and the highest of them; null without bark points. */
export function assetTrunkFit(asset: string): (NonNullable<ReturnType<typeof fitTrunk>> & {top: number}) | null {
    if (assetTrunks.has(asset)) return assetTrunks.get(asset) ?? null;
    const bark = assetAttachRows(asset).filter((r) => r[0] === "bark").map((r) => ({x: r[1], y: r[2], z: r[3], nx: r[4], nz: r[6]}));
    const fit = fitTrunk(bark);
    const out = fit ? {...fit, top: Math.max(...bark.map((b) => b.y))} : null;
    assetTrunks.set(asset, out as never);
    return out;
}

/** A placed asset tree's trunk in the world (its placement: `TreeWind`'s root, turn and scale), or null. */
export function placedTrunk(asset: string, wind: Pick<TreeWind, "root" | "rotation" | "scale">): Trunk | null {
    const fit = assetTrunkFit(asset);
    if (!fit) return null;
    const c = Math.cos(wind.rotation);
    const s = Math.sin(wind.rotation);
    const turn = (x: number, z: number) => ({x: x * c + z * s, z: -x * s + z * c});
    const at = turn(fit.cx, fit.cz);
    const lean = turn(fit.lx, fit.lz);
    return {
        x: wind.root.x + at.x * wind.scale,
        y: wind.root.y,
        z: wind.root.z + at.z * wind.scale,
        lx: lean.x,
        lz: lean.z,
        r0: fit.r0 * wind.scale,
        taper: fit.taper,
        // (Up to where its crown is: its limbs leave the trunk below its tallest bark point and a little over it.)
        height: Math.max(fit.top * 1.6, 1) * wind.scale
    };
}

/** A trunk from a single bark point (a tree whose asset is not known here): upright, its centre behind the point. */
export function trunkFromBark(point: ClimbSpot, radius: number, foot: number, height: number): Trunk {
    const l = Math.hypot(point.nx, point.nz) || 1;
    return {x: point.x - (point.nx / l) * radius, y: foot, z: point.z - (point.nz / l) * radius, lx: 0, lz: 0, r0: radius, taper: 0, height};
}

/** The trunk's surface at height `y` (world) round azimuth `az` (atan2(dx, dz)): the point on its skin, its outward normal, its up. */
export function trunkFrame(trunk: Trunk, y: number, az: number): {p: Vec; n: Vec; t: Vec} {
    const h = y - trunk.y;
    const r = Math.max(trunk.r0 + trunk.taper * h, trunk.r0 * 0.25, 0.02) + BARK_SKIN;
    const dx = Math.sin(az);
    const dz = Math.cos(az);
    const p = {x: trunk.x + trunk.lx * h + dx * r, y, z: trunk.z + trunk.lz * h + dz * r};
    // Its up along the bark: the axis's drift and the taper's lean out.
    const tx = trunk.lx + trunk.taper * dx;
    const tz = trunk.lz + trunk.taper * dz;
    const tl = Math.hypot(tx, 1, tz);
    const t = {x: tx / tl, y: 1 / tl, z: tz / tl};
    const d = dx * t.x + dz * t.z;
    const nx = dx - d * t.x;
    const ny = -d * t.y;
    const nz = dz - d * t.z;
    const nl = Math.hypot(nx, ny, nz) || 1;
    return {p, n: {x: nx / nl, y: ny / nl, z: nz / nl}, t};
}

/** The trunk's centre at height `y`. */
function axisAt(trunk: Trunk, y: number): {x: number; z: number} {
    const h = y - trunk.y;
    return {x: trunk.x + trunk.lx * h, z: trunk.z + trunk.lz * h};
}

/** How far a spot is out of the trunk's bark (m; 0 or less: on it). */
export function offBark(trunk: Trunk, spot: Vec): number {
    const c = axisAt(trunk, spot.y);
    const r = trunk.r0 + trunk.taper * (spot.y - trunk.y);
    return Math.hypot(spot.x - c.x, spot.z - c.z) - r;
}

// MARK: - The path

type Seg = {kind: "ground" | "trunk" | "limb"; a: Vec; b: Vec; length: number; trunk?: Trunk; az0?: number; az1?: number; n?: Vec};

export type TreeClimb = {segs: Seg[]; total: number; headFirst: boolean};

export type TreeClimbPose = {
    x: number;
    y: number;
    z: number;
    /** The surface's normal now (the body's up). */
    nx: number;
    ny: number;
    nz: number;
    /** Its body's heading, along the surface (up or down the trunk, along the limb, along the ground). */
    fx: number;
    fy: number;
    fz: number;
    yaw: number;
    /** On the trunk or out on a limb (off the ground). */
    onTree: boolean;
    /** On the trunk, coming down it head first. */
    down: boolean;
    /** On the trunk, coming down it tail first (its body still heads up it). */
    backing: boolean;
};

const azimuthOf = (trunk: Trunk, p: Vec) => {
    const c = axisAt(trunk, p.y);
    return Math.atan2(p.x - c.x, p.z - c.z);
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Where a place up in the tree joins its trunk: on the bark itself (a bark place), or where its limb leaves the trunk,
 * found back along the limb from the place (its normal's lean tells which way the limb runs up) and never above it.
 */
function junction(trunk: Trunk, spot: ClimbSpot): {j: Vec; az: number; onBark: boolean} {
    const az = azimuthOf(trunk, spot);
    const out = offBark(trunk, spot);
    if (out < 0.08 || Math.abs(spot.ny) < 0.5) {
        const y = Math.min(Math.max(spot.y, trunk.y + 0.25), trunk.y + trunk.height);
        return {j: trunkFrame(trunk, y, az).p, az, onBark: true};
    }
    // A limb's top leans back toward the trunk where the limb rises outward: its normal's outward part over its up part
    // is the limb's rise per metre out (a level limb: none). A hang point (its normal down) hangs under a level run.
    const c = axisAt(trunk, spot.y);
    const ox = (spot.x - c.x) / Math.max(Math.hypot(spot.x - c.x, spot.z - c.z), 1e-6);
    const oz = (spot.z - c.z) / Math.max(Math.hypot(spot.x - c.x, spot.z - c.z), 1e-6);
    const lean = spot.ny > 0.2 ? -(spot.nx * ox + spot.nz * oz) / spot.ny : 0;
    const rise = Math.min(Math.max(lean, 0), 1.2);
    const y = Math.min(Math.max(spot.y - rise * out, trunk.y + 0.4), spot.y, trunk.y + trunk.height);
    return {j: trunkFrame(trunk, y, az).p, az, onBark: false};
}

/**
 * The climb between two ends, either of which may be up a tree (its trunk given): null when neither is. `groundAt` is
 * the ground's height (for the walk between a trunk's foot and the ground end, or between two trees).
 */
export function treeClimb(from: ClimbSpot, to: ClimbSpot, fromTrunk: Trunk | null, toTrunk: Trunk | null, groundAt: (x: number, z: number) => number, headFirst: boolean): TreeClimb | null {
    if (!fromTrunk && !toTrunk) return null;
    const segs: Seg[] = [];
    const push = (seg: Omit<Seg, "length">) => {
        const length = seg.kind === "trunk" ? Math.hypot(seg.b.y - seg.a.y, wrap((seg.az1 ?? 0) - (seg.az0 ?? 0)) * ((seg.trunk?.r0 ?? 0.2) + BARK_SKIN)) : Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y, seg.b.z - seg.a.z);
        if (length > 1e-4) segs.push({...seg, length});
    };
    const sameTree = fromTrunk && toTrunk && Math.hypot(fromTrunk.x - toTrunk.x, fromTrunk.z - toTrunk.z) < 0.05;
    const footOf = (trunk: Trunk, toward: Vec) => {
        const az = Math.atan2(toward.x - trunk.x, toward.z - trunk.z);
        const probe = trunkFrame(trunk, trunk.y, az).p;
        const y = groundAt(probe.x, probe.z);
        return {p: trunkFrame(trunk, y, az).p, az};
    };
    const fromEnd = fromTrunk ? junction(fromTrunk, from) : null;
    const toEnd = toTrunk ? junction(toTrunk, to) : null;
    // Out of the tree it starts in: in along its limb to the trunk, then down (or round, in the same tree) the trunk.
    if (fromTrunk && fromEnd) {
        if (!fromEnd.onBark) push({kind: "limb", a: from, b: fromEnd.j, n: {x: from.nx, y: from.ny, z: from.nz}});
        const start = fromEnd.onBark ? {x: from.x, y: fromEnd.j.y, z: from.z} : fromEnd.j;
        if (sameTree && toEnd) {
            push({kind: "trunk", a: start, b: toEnd.j, trunk: fromTrunk, az0: fromEnd.az, az1: toEnd.az});
        } else {
            const foot = footOf(fromTrunk, toTrunk ? {x: toTrunk.x, y: 0, z: toTrunk.z} : to);
            push({kind: "trunk", a: start, b: foot.p, trunk: fromTrunk, az0: fromEnd.az, az1: foot.az});
            if (!toTrunk) push({kind: "ground", a: foot.p, b: to});
            else {
                const other = footOf(toTrunk, {x: fromTrunk.x, y: 0, z: fromTrunk.z});
                push({kind: "ground", a: foot.p, b: other.p});
                push({kind: "trunk", a: other.p, b: toEnd!.j, trunk: toTrunk, az0: other.az, az1: toEnd!.az});
            }
        }
    } else if (toTrunk && toEnd) {
        const foot = footOf(toTrunk, from);
        push({kind: "ground", a: from, b: foot.p});
        push({kind: "trunk", a: foot.p, b: toEnd.j, trunk: toTrunk, az0: foot.az, az1: toEnd.az});
    }
    if (toTrunk && toEnd && !toEnd.onBark) push({kind: "limb", a: toEnd.j, b: to, n: {x: to.nx, y: to.ny, z: to.nz}});
    else if (toTrunk && toEnd?.onBark && segs.length) {
        // (Onto the bark place itself: the last of the trunk ends on it.)
        const last = segs[segs.length - 1];
        if (last.kind === "trunk") last.b = {x: to.x, y: to.y, z: to.z};
    }
    if (!segs.length) return null;
    return {segs, total: segs.reduce((sum, s) => sum + s.length, 0), headFirst};
}

/** A segment's normal and its way along (unit) at share `k` of it. */
function segFrame(seg: Seg, k: number, groundAt: (x: number, z: number) => number): {p: Vec; n: Vec; f: Vec} {
    if (seg.kind === "trunk") {
        const trunk = seg.trunk!;
        const y = seg.a.y + (seg.b.y - seg.a.y) * k;
        const az = (seg.az0 ?? 0) + wrap((seg.az1 ?? 0) - (seg.az0 ?? 0)) * k;
        const frame = trunkFrame(trunk, y, az);
        const up = seg.b.y >= seg.a.y ? 1 : -1;
        // (A bark place's own spot, where the trunk ends on it: eased onto it over the last of the run.)
        const end = k > 0.9 ? (k - 0.9) / 0.1 : 0;
        const bp = trunkFrame(trunk, seg.b.y, seg.az1 ?? 0).p;
        const p = end > 0 ? {x: frame.p.x + (seg.b.x - bp.x) * end, y: frame.p.y, z: frame.p.z + (seg.b.z - bp.z) * end} : frame.p;
        return {p, n: frame.n, f: {x: frame.t.x * up, y: frame.t.y * up, z: frame.t.z * up}};
    }
    const p = {x: seg.a.x + (seg.b.x - seg.a.x) * k, y: seg.a.y + (seg.b.y - seg.a.y) * k, z: seg.a.z + (seg.b.z - seg.a.z) * k};
    const dx = seg.b.x - seg.a.x;
    const dy = seg.b.y - seg.a.y;
    const dz = seg.b.z - seg.a.z;
    if (seg.kind === "ground") {
        p.y = groundAt(p.x, p.z);
        const l = Math.hypot(dx, dz) || 1;
        return {p, n: {x: 0, y: 1, z: 0}, f: {x: dx / l, y: 0, z: dz / l}};
    }
    // Along the limb: its own surface's normal, square to the way along it.
    const l = Math.hypot(dx, dy, dz) || 1;
    const f = {x: dx / l, y: dy / l, z: dz / l};
    const n0 = seg.n ?? {x: 0, y: 1, z: 0};
    const d = n0.x * f.x + n0.y * f.y + n0.z * f.z;
    let n = {x: n0.x - d * f.x, y: n0.y - d * f.y, z: n0.z - d * f.z};
    const nl = Math.hypot(n.x, n.y, n.z);
    n = nl > 1e-3 ? {x: n.x / nl, y: n.y / nl, z: n.z / nl} : {x: 0, y: 1, z: 0};
    return {p, n, f};
}

const smooth = (t: number) => {
    const k = Math.min(Math.max(t, 0), 1);
    return k * k * (3 - 2 * k);
};
/** Across a corner (0: the surface before, 1: the one after), how far the heading has turned: tighter than the normal, so the body is along the new surface by the time its up is mostly that surface's. */
const turnOf = (c: number) => smooth((c - 0.2) / 0.35);
const mix = (a: Vec, b: Vec, w: number): Vec => {
    const x = a.x + (b.x - a.x) * w;
    const y = a.y + (b.y - a.y) * w;
    const z = a.z + (b.z - a.z) * w;
    const l = Math.hypot(x, y, z) || 1;
    return {x: x / l, y: y / l, z: z / l};
};

/**
 * Where the climber is at `u` (0..1) of its climb: on the ground, the bark or the limb, its up the surface's normal and
 * its heading along its way there (a tail-first climber coming down a trunk keeps heading up it), turning from one
 * surface to the next over at most TREE_CORNER each side of a corner.
 */
export function treeClimbAt(climb: TreeClimb, u: number, groundAt: (x: number, z: number) => number): TreeClimbPose {
    const s = Math.min(Math.max(u, 0), 1) * climb.total;
    let i = 0;
    let from = 0;
    while (i < climb.segs.length - 1 && from + climb.segs[i].length < s) {
        from += climb.segs[i].length;
        i++;
    }
    const seg = climb.segs[i];
    const into = Math.min(Math.max(s - from, 0), seg.length);
    const here = segFrame(seg, seg.length > 0 ? into / seg.length : 1, groundAt);
    let n = here.n;
    let f = here.f;
    // The corners: near the start of this segment from the one before, near its end into the next.
    const prev = climb.segs[i - 1];
    const next = climb.segs[i + 1];
    if (prev && prev.kind !== seg.kind) {
        const b = Math.max(Math.min(TREE_CORNER, prev.length / 2, seg.length / 2), 1e-4);
        if (into < b) {
            const other = segFrame(prev, 1, groundAt);
            const w = 0.5 - 0.5 * smooth(into / b);
            n = mix(n, other.n, w);
            f = mix(f, other.f, 1 - turnOf(1 - w));
        }
    }
    if (next && next.kind !== seg.kind) {
        const b = Math.max(Math.min(TREE_CORNER, next.length / 2, seg.length / 2), 1e-4);
        if (seg.length - into < b) {
            const other = segFrame(next, 0, groundAt);
            const w = 0.5 - 0.5 * smooth((seg.length - into) / b);
            n = mix(n, other.n, w);
            f = mix(f, other.f, turnOf(w));
        }
    }
    const descending = seg.kind === "trunk" && seg.b.y < seg.a.y;
    const backing = descending && !climb.headFirst;
    if (backing) f = {x: -f.x, y: -f.y, z: -f.z};
    // The heading laid on the surface (never into it).
    const d = f.x * n.x + f.y * n.y + f.z * n.z;
    let fx = f.x - d * n.x;
    let fy = f.y - d * n.y;
    let fz = f.z - d * n.z;
    const fl = Math.hypot(fx, fy, fz);
    if (fl > 1e-4) {
        fx /= fl;
        fy /= fl;
        fz /= fl;
    } else {
        fx = 0;
        fy = 1;
        fz = 0;
    }
    const flat = Math.hypot(here.f.x, here.f.z);
    const yaw = flat > 1e-3 ? Math.atan2(here.f.x * (backing ? -1 : 1), here.f.z * (backing ? -1 : 1)) : Math.atan2(-n.x, -n.z);
    return {x: here.p.x, y: here.p.y, z: here.p.z, nx: n.x, ny: n.y, nz: n.z, fx, fy, fz, yaw, onTree: seg.kind !== "ground", down: descending && climb.headFirst, backing};
}

// MARK: - Who comes down head first

/**
 * Coming down a trunk head first or tail first: tail first for the kinds known to back down (the primates, the bears
 * and pandas, the koalas, the sloths, the cats but the margay), head first for everything else that climbs (a squirrel
 * turns its hind feet back and runs down; a goat walks down its tree or crag; a nuthatch walks down; lizards, geckos,
 * snakes, insects and spiders). Keyed by name for mammals and birds; any other body plan (`ark.json`: "reptile",
 * "snake", "arthropod", "frog") head first.
 */
const TAIL_FIRST = /gibbon|siamang|orangutan|chimpanzee|gorilla|bonobo|loris|monkey|lemur|macaque|langur|baboon|tamarin|marmoset|capuchin|colobus|guereza|surili|howler|titi|saki|uakari|sifaka|indri|aye-aye|galago|bushbaby|tarsier|\bbear\b|-bear$|^bear|panda|koala|sloth|(^|-)cat$|wildcat|lion|leopard|jaguar|tiger|lynx|ocelot|serval|caracal|cougar|puma|bobcat|genet/;
export function descendsHeadFirst(slug: string, plan: string | null | undefined): boolean {
    if (plan && plan !== "mammal" && plan !== "bird") return true;
    if (/margay|squirrel(?!-monkey)|chipmunk/.test(slug)) return true;
    return !TAIL_FIRST.test(slug);
}

/** The host tree of a place from its id: the scenery's `<tag>:<host>:<n>` (or `map:<tag>:<host>:<n>`), the town's `town:tree:<i>:…`. */
export function treeHostOf(id: string | null | undefined): string | null {
    if (!id) return null;
    const town = /^(?:map:)?town:tree:(\d+):/.exec(id);
    if (town) return `town:tree:${town[1]}`;
    const parts = (id.startsWith("map:") ? id.slice(4) : id).split(":");
    return parts.length >= 3 && /^(decor|fill|jungle)\d+$/.test(parts[1]) ? parts[1] : null;
}
