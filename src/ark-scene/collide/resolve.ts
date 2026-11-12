/**
 * The collisions' last word on where an animal stands (motion pass L5), after its schedule (and recipe, and
 * liveliness) put it somewhere: pure functions of its pose, its body, the world's solid things and its neighbours'
 * poses at the same moment, so every viewer sees the same.
 *
 * 1. `pushOut`: a body standing in something solid (a stay spot by a rock whose foot is too close for a crocodile, a
 *    hamlet spot beside a trough) is moved out of it, the shortest way, until it only touches. Paths are already clear
 *    (`behaviour-nav.ts`); this is for where things stand.
 * 2. `separation`: two bodies overlapping each other (two grazers on one patch, a herd member and its neighbour) are
 *    eased apart, each by its share of the overlap (the smaller moves more), from both poses as the schedule gives them:
 *    one step, symmetric, so it never depends on who was worked out first. A recipe's pair (a predator reaching its
 *    prey, two rivals in a contest) may touch; a sleeping huddle of one group (`sleep.ts` huddle, pile, cluster, row)
 *    lies together as the sleep lane laid it.
 * 3. `clipMove`: that easing never carries a body into anything solid: it stops where it would touch (so never through
 *    a fence to its far side).
 */

import {bodyMeets, colliderDistance, spansCollider, type Collider, type ColliderSet} from "@/ark-scene/collide/colliders";

export type ResolveBody = {
    id: string;
    /** Half its width (m), half its spine (m), its height (m): `bodies.ts`. */
    radius: number;
    half: number;
    height: number;
    /** Its group (its leader's id) and whether its kind sleeps together (huddled, piled, clustered, in a row). */
    group?: string | null;
    huddles?: boolean;
};

export type ResolvePose = {
    x: number;
    y: number;
    z: number;
    yaw: number;
    aloft: boolean;
    /** Asleep (a huddle lies together). */
    asleep?: boolean;
    /** The animal its recipe pairs it with now (they may touch). */
    partner?: string | null;
    /** The surface points it is on (`attach.ts`): what each is on is its surface, not something it stands in. */
    attached?: ReadonlyArray<{x: number; z: number; r?: number; host?: string}> | null;
    /** Held where it is (perched up on a branch or a rock's top: moving it would leave it in the air); others move round it. */
    fixed?: boolean;
};

/** Touching is not overlapping: what is left of an overlap after the easing (m, as a share of the smaller radius). */
export const SEPARATION_SLACK = 0.1;
/** A recipe's pair may come this close (a share of their radii summed): a predator reaches its prey. */
export const PARTNER_CONTACT = 0.6;

function exempt(c: Collider, attached: ResolvePose["attached"], fixed?: boolean): boolean {
    // (Perched up in a tree: among its own branches, the trunk beside it is the tree it is in.)
    if (fixed && c.kind === "trunk") return true;
    if (!attached) return false;
    for (const q of attached) if ((q.host && (c.id === `trunk:${q.host}` || c.id === `rock:${q.host}`)) || colliderDistance(c, q.x, q.z) < (q.r ?? 0.15)) return true;
    return false;
}

/** Points along a body's spine (middle first), at most its radius apart. */
function spinePoints(body: ResolveBody, x: number, z: number, yaw: number): Array<[number, number]> {
    if (body.half < 1e-3) return [[x, z]];
    const n = Math.min(Math.ceil(body.half / Math.max(body.radius, 0.02)), 4);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const out: Array<[number, number]> = [[x, z]];
    for (let k = 1; k <= n; k++) {
        const d = (body.half * k) / n;
        out.push([x + fx * d, z + fz * d], [x - fx * d, z - fz * d]);
    }
    return out;
}

const scratch: Collider[] = [];

/** The deepest overlap of a body with something solid it meets (its capsule, its height), its spine point and the outward way. */
function deepest(set: ColliderSet, body: ResolveBody, x: number, z: number, y: number, yaw: number, attached: ResolvePose["attached"], fixed?: boolean): {depth: number; nx: number; nz: number} | null {
    let best: {depth: number; nx: number; nz: number} | null = null;
    // (Nothing solid within its whole reach: clear, from one look round its middle.)
    if (set.distance(x, z, body.half + body.radius + 0.05) >= body.half + body.radius + 0.01) return null;
    for (const [px, pz] of spinePoints(body, x, z, yaw)) {
        for (const c of set.near(px, pz, body.radius + 0.01, scratch)) {
            if (c.soft || !bodyMeets(c, body.radius) || !spansCollider(c, y, body.height) || exempt(c, attached, fixed)) continue;
            const d = colliderDistance(c, px, pz);
            const depth = body.radius - d;
            if (depth <= 0.002 || (best && depth <= best.depth)) continue;
            // Outward: the distance's own gradient (a circle's radius, a box's face, a fence's side).
            const e = 0.01;
            let gx = colliderDistance(c, px + e, pz) - colliderDistance(c, px - e, pz);
            let gz = colliderDistance(c, px, pz + e) - colliderDistance(c, px, pz - e);
            const l = Math.hypot(gx, gz);
            if (l < 1e-6) {
                gx = px - c.cx;
                gz = pz - c.cz;
            }
            const m = Math.hypot(gx, gz) || 1;
            best = {depth, nx: gx / m, nz: gz / m};
        }
    }
    return best;
}

/**
 * Out of anything solid it stands in, until it only touches: a few steps along the deepest overlap's outward way; wedged
 * (between two trunks, a fence and a wall), the nearest point round it where its body is clear, searched outwards in
 * rings (the same for every caller), out to 3 m or its own length and a metre, whichever is more (a true-size whale's
 * tail by a rock in the shallows). Nowhere within that: as the steps left it.
 */
export function pushOut(set: ColliderSet, body: ResolveBody, pose: ResolvePose): {x: number; z: number; moved: number} {
    let x = pose.x;
    let z = pose.z;
    if (pose.fixed) return {x, z, moved: 0};
    // (Aloft too: only what its height reaches into, a trunk below the crown on a low flight, a barn's wall.)
    let stuck = false;
    for (let step = 0; step < 6; step++) {
        const hit = deepest(set, body, x, z, pose.y, pose.yaw, pose.attached, pose.fixed);
        if (!hit) {
            stuck = false;
            break;
        }
        stuck = true;
        x += hit.nx * (hit.depth + 0.003);
        z += hit.nz * (hit.depth + 0.003);
    }
    if (stuck && deepest(set, body, x, z, pose.y, pose.yaw, pose.attached, pose.fixed)) {
        const step = Math.max(body.radius * 0.5, 0.05);
        const most = Math.max(3, 2 * body.half + body.radius + 1);
        for (let ring = 1; ring * step <= most; ring++) {
            const d = ring * step;
            const n = Math.max(8, Math.ceil((Math.PI * 2 * d) / step));
            for (let k = 0; k < n; k++) {
                const a = (k / n) * Math.PI * 2;
                const px = pose.x + Math.sin(a) * d;
                const pz = pose.z + Math.cos(a) * d;
                if (!deepest(set, body, px, pz, pose.y, pose.yaw, pose.attached, pose.fixed)) return {x: px, z: pz, moved: d};
            }
        }
    }
    return {x, z, moved: Math.hypot(x - pose.x, z - pose.z)};
}

/** The way out of the solid thing that stops a move at (x, z) (its outward normal there), or null. */
function blockerNormal(set: ColliderSet, body: ResolveBody, x: number, z: number, pose: ResolvePose): {nx: number; nz: number} | null {
    const hit = deepest(set, body, x, z, pose.y, pose.yaw, pose.attached, pose.fixed);
    return hit ? {nx: hit.nx, nz: hit.nz} : null;
}

/**
 * From a (clear) to b, as far as its body gets before it would touch something solid it meets; stopped by something, the
 * rest of the move slides along it (its part along the thing's face), as far as that goes in turn.
 */
export function clipMove(set: ColliderSet, body: ResolveBody, from: {x: number; z: number}, to: {x: number; z: number}, pose: ResolvePose, slide = true): {x: number; z: number} {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    if (length < 1e-4) return {x: to.x, z: to.z};
    // (Sampled at a quarter of its radius: an easing is a fraction of a body; the last clear sample is kept.)
    const steps = Math.min(Math.ceil(length / Math.max(body.radius * 0.25, 0.01)), 24);
    let x = from.x;
    let z = from.z;
    for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const px = from.x + (to.x - from.x) * t;
        const pz = from.z + (to.z - from.z) * t;
        const normal = blockerNormal(set, body, px, pz, pose);
        if (normal) {
            if (!slide) break;
            // The rest, along the face.
            const rx = to.x - x;
            const rz = to.z - z;
            const into = rx * normal.nx + rz * normal.nz;
            if (into >= 0) break;
            return clipMove(set, body, {x, z}, {x: x + rx - normal.nx * into, z: z + rz - normal.nz * into}, pose, false);
        }
        x = px;
        z = pz;
    }
    return {x, z};
}

/** The closest points of two segments (2D) and their distance. */
function closest(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): {px: number; pz: number; qx: number; qz: number; d: number} {
    const ux = bx - ax;
    const uz = bz - az;
    const vx = dx - cx;
    const vz = dz - cz;
    const wx = ax - cx;
    const wz = az - cz;
    const a = ux * ux + uz * uz;
    const b = ux * vx + uz * vz;
    const c = vx * vx + vz * vz;
    const d = ux * wx + uz * wz;
    const e = vx * wx + vz * wz;
    const den = a * c - b * b;
    let s = 0;
    let t = 0;
    if (a < 1e-9 && c < 1e-9) {
        s = 0;
        t = 0;
    } else if (a < 1e-9) {
        t = Math.min(Math.max(e / c, 0), 1);
    } else if (c < 1e-9) {
        s = Math.min(Math.max(-d / a, 0), 1);
    } else {
        s = den > 1e-9 ? Math.min(Math.max((b * e - c * d) / den, 0), 1) : 0;
        t = (b * s + e) / c;
        if (t < 0) {
            t = 0;
            s = Math.min(Math.max(-d / a, 0), 1);
        } else if (t > 1) {
            t = 1;
            s = Math.min(Math.max((b - d) / a, 0), 1);
        }
    }
    const px = ax + ux * s;
    const pz = az + uz * s;
    const qx = cx + vx * t;
    const qz = cz + vz * t;
    return {px, pz, qx, qz, d: Math.hypot(px - qx, pz - qz)};
}

/** A stable direction for two bodies whose spines meet exactly: from the pair's ids. */
function pairAngle(a: string, b: string): number {
    let h = 2166136261;
    const text = a < b ? `${a}|${b}` : `${b}|${a}`;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return ((h >>> 0) / 4294967296) * Math.PI * 2 * (a < b ? 1 : -1);
}

/** How deep two bodies overlap now (m, 0 if they don't), and the way that eases `a` out of `b`. */
export function overlapOf(a: ResolveBody, pa: ResolvePose, b: ResolveBody, pb: ResolvePose): {depth: number; nx: number; nz: number} {
    if (pa.aloft !== pb.aloft) return {depth: 0, nx: 0, nz: 0};
    // (Within each other's height: a bird on a branch over a deer is clear of it.)
    if (pa.y + a.height <= pb.y || pb.y + b.height <= pa.y) return {depth: 0, nx: 0, nz: 0};
    const reach = a.half + a.radius + b.half + b.radius;
    if (Math.abs(pa.x - pb.x) > reach || Math.abs(pa.z - pb.z) > reach) return {depth: 0, nx: 0, nz: 0};
    const fa = {x: Math.sin(pa.yaw) * a.half, z: Math.cos(pa.yaw) * a.half};
    const fb = {x: Math.sin(pb.yaw) * b.half, z: Math.cos(pb.yaw) * b.half};
    const c = closest(pa.x - fa.x, pa.z - fa.z, pa.x + fa.x, pa.z + fa.z, pb.x - fb.x, pb.z - fb.z, pb.x + fb.x, pb.z + fb.z);
    const depth = a.radius + b.radius - c.d;
    if (depth <= 0) return {depth: 0, nx: 0, nz: 0};
    let nx = c.px - c.qx;
    let nz = c.pz - c.qz;
    let l = Math.hypot(nx, nz);
    // (Spines crossing: from middle to middle, else the pair's own seeded way.)
    if (l < 0.25 * Math.min(a.radius, b.radius)) {
        nx = pa.x - pb.x;
        nz = pa.z - pb.z;
        l = Math.hypot(nx, nz);
        if (l < 1e-3) {
            const angle = pairAngle(a.id, b.id);
            nx = Math.sin(angle);
            nz = Math.cos(angle);
            l = 1;
        }
    }
    return {depth, nx: nx / l, nz: nz / l};
}

/** How much of an overlap two bodies may keep (m): touching, a recipe's pair closer, a sleeping huddle as it lies. */
export function allowedOverlap(a: ResolveBody, pa: ResolvePose, b: ResolveBody, pb: ResolvePose): number {
    if (pa.partner === b.id || pb.partner === a.id) return (a.radius + b.radius) * PARTNER_CONTACT;
    if (pa.asleep && pb.asleep && a.huddles && b.huddles && a.group && a.group === b.group) return Infinity;
    return SEPARATION_SLACK * Math.min(a.radius, b.radius);
}

/**
 * The easing of a body away from its neighbours now (m): each overlap beyond what they may keep, its share of it (the
 * smaller body moves more: shares by radius squared), summed in the neighbours' id order (so the sum is the same bits
 * however they were found).
 */
export function separation(a: ResolveBody, pa: ResolvePose, neighbours: ReadonlyArray<{body: ResolveBody; pose: ResolvePose}>): {dx: number; dz: number} {
    let dx = 0;
    let dz = 0;
    const ordered = neighbours.length > 1 ? [...neighbours].sort((p, q) => (p.body.id < q.body.id ? -1 : p.body.id > q.body.id ? 1 : 0)) : neighbours;
    for (const {body: b, pose: pb} of ordered) {
        if (b.id === a.id) continue;
        const o = overlapOf(a, pa, b, pb);
        if (o.depth <= 0) continue;
        const excess = o.depth - allowedOverlap(a, pa, b, pb);
        if (excess <= 0) continue;
        const share = pb.fixed ? 1 : (b.radius * b.radius) / (a.radius * a.radius + b.radius * b.radius);
        dx += o.nx * excess * share;
        dz += o.nz * excess * share;
    }
    return {dx, dz};
}

/** How many easing rounds a cluster of touching animals gets. */
export const SEPARATION_ROUNDS = 4;

/** Two bodies close enough to be in one cluster (touching or nearly: a round's easing could bring them together). */
export function inContact(a: ResolveBody, pa: ResolvePose, b: ResolveBody, pb: ResolvePose): boolean {
    if (pa.aloft !== pb.aloft) return false;
    const reach = a.half + a.radius + b.half + b.radius;
    if (Math.abs(pa.x - pb.x) > reach || Math.abs(pa.z - pb.z) > reach) return false;
    return overlapOf(a, pa, b, pb).depth > allowedOverlap(a, pa, b, pb) * 0.5 - 0.02;
}

/**
 * A cluster of touching animals eased apart together (each already out of anything solid): `SEPARATION_ROUNDS` rounds,
 * each from everyone's place after the round before (so a herd packed on one patch spreads, not just the pairs), each
 * move clipped to (and slid along) anything solid. Members in id order; the same answer for every viewer that has the
 * same cluster. Returns each member's place, in the members' order.
 */
export function separateCluster(set: ColliderSet | null, members: ReadonlyArray<{body: ResolveBody; pose: ResolvePose}>): Array<{x: number; z: number}> {
    const order = members.map((_, i) => i).sort((i, j) => (members[i].body.id < members[j].body.id ? -1 : members[i].body.id > members[j].body.id ? 1 : 0));
    let at = members.map((m) => ({x: m.pose.x, z: m.pose.z}));
    if (members.length < 2) return at;
    for (let round = 0; round < SEPARATION_ROUNDS; round++) {
        const now = members.map((m, i) => ({body: m.body, pose: {...m.pose, x: at[i].x, z: at[i].z}}));
        const next = at.slice();
        let moved = false;
        for (const i of order) {
            if (now[i].pose.fixed) continue;
            const sep = separation(now[i].body, now[i].pose, now.filter((_, j) => j !== i));
            if (!sep.dx && !sep.dz) continue;
            moved = true;
            next[i] = set ? clipMove(set, now[i].body, at[i], {x: at[i].x + sep.dx, z: at[i].z + sep.dz}, now[i].pose) : {x: at[i].x + sep.dx, z: at[i].z + sep.dz};
        }
        at = next;
        if (!moved) break;
    }
    return at;
}

/**
 * Where it stands, all told, for a lone body or one whose cluster is given: out of anything solid, then its cluster
 * eased apart (`separateCluster`).
 */
export function resolvePose(set: ColliderSet | null, body: ResolveBody, pose: ResolvePose, neighbours: ReadonlyArray<{body: ResolveBody; pose: ResolvePose}> | null): {x: number; z: number} {
    if (!set) return {x: pose.x, z: pose.z};
    const out = pushOut(set, body, pose);
    if (!neighbours || !neighbours.length) return {x: out.x, z: out.z};
    const placed = {...pose, x: out.x, z: out.z};
    return separateCluster(set, [{body, pose: placed}, ...neighbours])[0];
}
