/**
 * Plane geometry for the town island's plan (docs/ark/town-island.md): oriented rectangles, polygons and polylines in
 * metres on the ground (x east, z south: +z faces the opening camera, as on the wild island). Pure, no three.js, so
 * the plan, the validator, the nav footprints and the tests share it.
 */

export type Pt = {x: number; z: number};
export type Poly = Pt[];

/** A rectangle turned about its middle: `w` along its own x (the street front), `d` along its own z (front to back). */
export type Box = {x: number; z: number; w: number; d: number; rot: number};

export function box(x: number, z: number, w: number, d: number, rot = 0): Box {
    return {x, z, w, d, rot};
}

/** A local point of a box (its own frame: +lx along the front, +lz towards the front) in the world. */
export function local(b: Box, lx: number, lz: number): Pt {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    return {x: b.x + lx * c - lz * s, z: b.z + lx * s + lz * c};
}

/** A world point in a box's own frame. */
export function toLocal(b: Box, x: number, z: number): Pt {
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    const dx = x - b.x;
    const dz = z - b.z;
    return {x: dx * c + dz * s, z: -dx * s + dz * c};
}

/** A sub-box of `b` in its frame: middle (lx, lz), size (w, d), the same turn plus `turn`. */
export function sub(b: Box, lx: number, lz: number, w: number, d: number, turn = 0): Box {
    const p = local(b, lx, lz);
    return {x: p.x, z: p.z, w, d, rot: b.rot + turn};
}

export function corners(b: Box): Poly {
    const hw = b.w / 2;
    const hd = b.d / 2;
    return [local(b, -hw, -hd), local(b, hw, -hd), local(b, hw, hd), local(b, -hw, hd)];
}

export function inBox(b: Box, x: number, z: number, margin = 0): boolean {
    const p = toLocal(b, x, z);
    return Math.abs(p.x) <= b.w / 2 + margin && Math.abs(p.z) <= b.d / 2 + margin;
}

/** Signed distance (m) from a point to a box's edge: negative inside. */
export function boxDistance(b: Box, x: number, z: number): number {
    const p = toLocal(b, x, z);
    const qx = Math.abs(p.x) - b.w / 2;
    const qz = Math.abs(p.z) - b.d / 2;
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
    return outside + Math.min(Math.max(qx, qz), 0);
}

export function area(poly: Poly): number {
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        sum += a.x * b.z - b.x * a.z;
    }
    return Math.abs(sum) / 2;
}

export function centroid(poly: Poly): Pt {
    let x = 0;
    let z = 0;
    for (const p of poly) {
        x += p.x;
        z += p.z;
    }
    return {x: x / poly.length, z: z / poly.length};
}

export function inPoly(poly: Poly, x: number, z: number): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i];
        const b = poly[j];
        if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
}

/** Distance (m) from a point to a polygon's boundary (0 on it), whichever side. */
export function polyEdgeDistance(poly: Poly, x: number, z: number): number {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        best = Math.min(best, segmentDistance(x, z, a.x, a.z, b.x, b.z));
    }
    return best;
}

/** Signed distance to a polygon: negative inside. */
export function polyDistance(poly: Poly, x: number, z: number): number {
    const d = polyEdgeDistance(poly, x, z);
    return inPoly(poly, x, z) ? -d : d;
}

export function segmentDistance(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
    const dx = bx - ax;
    const dz = bz - az;
    const length = dx * dx + dz * dz;
    const t = length > 0 ? Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / length, 0), 1) : 0;
    return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

// MARK: - Polylines: the nearest point, fast
//
// The plan, the ground and the scenery ask for the nearest point of the canal and the streets millions of times (the
// ground's 433 x 433 grid alone). Each line's segments get their bounds once (`segmentsOf`); a search skips a segment
// whose bounds are farther than the best found so far, and a "within" question skips the whole line when its bounds
// are out of reach. The answers are exactly the plain scan's, to the bit: a skipped segment could never have won
// (it is farther than the best, or than the limit, by more than `SKIP_SLACK`, far beyond rounding), the arithmetic of
// every segment that is looked at is the scan's own, and ties still go to the first segment.

/** A polyline's segments: their bounds (x0, x1, z0, z1 each), lengths, and the distance walked to each one's start. */
type Segments = {count: number; bounds: Float64Array; lengths: Float64Array; walked: Float64Array; x0: number; x1: number; z0: number; z1: number};

/** Each line's segments, worked out on its first search (the plan's lines are never changed once made). */
const SEGMENTS = new WeakMap<Poly, Segments>();

/** How much farther than the best (m) a segment's bounds must be to skip it: far more than any rounding. */
const SKIP_SLACK = 1e-6;

function segmentsOf(line: Poly): Segments {
    const known = SEGMENTS.get(line);
    if (known && known.count === line.length) return known;
    const n = Math.max(line.length - 1, 0);
    const bounds = new Float64Array(n * 4);
    const lengths = new Float64Array(n);
    const walked = new Float64Array(n);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    let sum = 0;
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const o = (i - 1) * 4;
        bounds[o] = Math.min(a.x, b.x);
        bounds[o + 1] = Math.max(a.x, b.x);
        bounds[o + 2] = Math.min(a.z, b.z);
        bounds[o + 3] = Math.max(a.z, b.z);
        x0 = Math.min(x0, bounds[o]);
        x1 = Math.max(x1, bounds[o + 1]);
        z0 = Math.min(z0, bounds[o + 2]);
        z1 = Math.max(z1, bounds[o + 3]);
        // (The scan's own sums, in its order: `along` comes out the same.)
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        lengths[i - 1] = length;
        walked[i - 1] = sum;
        sum += length;
    }
    const out = {count: line.length, bounds, lengths, walked, x0, x1, z0, z1};
    SEGMENTS.set(line, out);
    return out;
}

/** The squared gap from (x, z) to a box (0 inside or touching; with NaN anywhere, 0: never skipped). */
function boxGap2(x0: number, x1: number, z0: number, z1: number, x: number, z: number): number {
    const gx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
    const gz = z < z0 ? z0 - z : z > z1 ? z - z1 : 0;
    return gx * gx + gz * gz;
}

/** Nearest point of a polyline: its distance, the distance along it, the segment's direction. */
export function polylineNearest(line: Poly, x: number, z: number): {distance: number; along: number; dir: Pt; point: Pt} {
    const first = line[0];
    const seg = segmentsOf(line);
    const bounds = seg.bounds;
    let bestDistance = Infinity;
    let found = false;
    let bestAlong = 0;
    let bestPx = 0;
    let bestPz = 0;
    let bestDx = 0;
    let bestDz = 0;
    let bestLength = 0;
    for (let i = 1; i < line.length; i++) {
        const o = (i - 1) * 4;
        if (found) {
            const reach = bestDistance + SKIP_SLACK;
            if (boxGap2(bounds[o], bounds[o + 1], bounds[o + 2], bounds[o + 3], x, z) > reach * reach) continue;
        }
        const a = line[i - 1];
        const b = line[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = seg.lengths[i - 1];
        const t = length > 0 ? Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / (length * length), 0), 1) : 0;
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        const distance = Math.hypot(x - px, z - pz);
        if (distance < bestDistance) {
            found = true;
            bestDistance = distance;
            bestAlong = seg.walked[i - 1] + length * t;
            bestPx = px;
            bestPz = pz;
            bestDx = dx;
            bestDz = dz;
            bestLength = length;
        }
    }
    if (!found) return {distance: Infinity, along: 0, dir: {x: 1, z: 0}, point: {x: first.x, z: first.z}};
    return {distance: bestDistance, along: bestAlong, dir: {x: bestDx / (bestLength || 1), z: bestDz / (bestLength || 1)}, point: {x: bestPx, z: bestPz}};
}

/** The distance from (x, z) to a polyline: exactly `polylineNearest(line, x, z).distance`. */
export function polylineDistance(line: Poly, x: number, z: number): number {
    const seg = segmentsOf(line);
    const bounds = seg.bounds;
    let best = Infinity;
    for (let i = 1; i < line.length; i++) {
        const o = (i - 1) * 4;
        if (best !== Infinity) {
            const reach = best + SKIP_SLACK;
            if (boxGap2(bounds[o], bounds[o + 1], bounds[o + 2], bounds[o + 3], x, z) > reach * reach) continue;
        }
        const a = line[i - 1];
        const b = line[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = seg.lengths[i - 1];
        const t = length > 0 ? Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / (length * length), 0), 1) : 0;
        const distance = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
        if (distance < best) best = distance;
    }
    return best;
}

/** Whether (x, z) is nearer than `limit` to a polyline: exactly `polylineNearest(line, x, z).distance < limit`. */
export function polylineWithin(line: Poly, x: number, z: number, limit: number): boolean {
    const seg = segmentsOf(line);
    const reach = limit + SKIP_SLACK;
    const reach2 = reach * reach;
    if (boxGap2(seg.x0, seg.x1, seg.z0, seg.z1, x, z) > reach2) return false;
    const bounds = seg.bounds;
    for (let i = 1; i < line.length; i++) {
        const o = (i - 1) * 4;
        if (boxGap2(bounds[o], bounds[o + 1], bounds[o + 2], bounds[o + 3], x, z) > reach2) continue;
        const a = line[i - 1];
        const b = line[i];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length = seg.lengths[i - 1];
        const t = length > 0 ? Math.min(Math.max(((x - a.x) * dx + (z - a.z) * dz) / (length * length), 0), 1) : 0;
        if (Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < limit) return true;
    }
    return false;
}

export function polylineLength(line: Poly): number {
    let sum = 0;
    for (let i = 1; i < line.length; i++) sum += Math.hypot(line[i].x - line[i - 1].x, line[i].z - line[i - 1].z);
    return sum;
}

/** The point `along` metres down a polyline, with its direction. */
export function polylineAt(line: Poly, along: number): {point: Pt; dir: Pt} {
    let walked = 0;
    for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (walked + length >= along || i === line.length - 1) {
            const t = length > 0 ? Math.min(Math.max((along - walked) / length, 0), 1) : 0;
            return {point: {x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t}, dir: {x: (b.x - a.x) / (length || 1), z: (b.z - a.z) / (length || 1)}};
        }
        walked += length;
    }
    return {point: line[0], dir: {x: 1, z: 0}};
}

/** A polyline made smooth (Chaikin, `rounds` times), ends kept. */
export function smoothLine(line: Poly, rounds = 2): Poly {
    let out = line;
    for (let r = 0; r < rounds; r++) {
        const next: Poly = [out[0]];
        for (let i = 0; i < out.length - 1; i++) {
            const a = out[i];
            const b = out[i + 1];
            next.push({x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25}, {x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75});
        }
        next.push(out[out.length - 1]);
        out = next;
    }
    return out;
}

/** Whether two convex polygons overlap by more than `slack` m (separating axes). */
export function convexOverlap(a: Poly, b: Poly, slack = 0): boolean {
    for (const poly of [a, b]) {
        for (let i = 0; i < poly.length; i++) {
            const p = poly[i];
            const q = poly[(i + 1) % poly.length];
            const nx = q.z - p.z;
            const nz = -(q.x - p.x);
            const length = Math.hypot(nx, nz) || 1;
            let minA = Infinity;
            let maxA = -Infinity;
            let minB = Infinity;
            let maxB = -Infinity;
            for (const v of a) {
                const t = (v.x * nx + v.z * nz) / length;
                minA = Math.min(minA, t);
                maxA = Math.max(maxA, t);
            }
            for (const v of b) {
                const t = (v.x * nx + v.z * nz) / length;
                minB = Math.min(minB, t);
                maxB = Math.max(maxB, t);
            }
            if (maxA - slack <= minB || maxB - slack <= minA) return false;
        }
    }
    return true;
}

export function boxesOverlap(a: Box, b: Box, slack = 0): boolean {
    const reach = Math.hypot(a.w, a.d) / 2 + Math.hypot(b.w, b.d) / 2;
    if (Math.hypot(a.x - b.x, a.z - b.z) > reach) return false;
    return convexOverlap(corners(a), corners(b), slack);
}

/** A circle as a polygon (`n` sides). */
export function circle(x: number, z: number, r: number, n = 16): Poly {
    return Array.from({length: n}, (_, i) => ({x: x + Math.cos((i / n) * Math.PI * 2) * r, z: z + Math.sin((i / n) * Math.PI * 2) * r}));
}

export function ellipse(x: number, z: number, rx: number, rz: number, n = 24, rot = 0): Poly {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    return Array.from({length: n}, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        const lx = Math.cos(a) * rx;
        const lz = Math.sin(a) * rz;
        return {x: x + lx * c - lz * s, z: z + lx * s + lz * c};
    });
}

export function bounds(poly: Poly): {x0: number; z0: number; x1: number; z1: number} {
    let x0 = Infinity;
    let z0 = Infinity;
    let x1 = -Infinity;
    let z1 = -Infinity;
    for (const p of poly) {
        x0 = Math.min(x0, p.x);
        z0 = Math.min(z0, p.z);
        x1 = Math.max(x1, p.x);
        z1 = Math.max(z1, p.z);
    }
    return {x0, z0, x1, z1};
}

/** A deterministic generator (mulberry32) from a seed. */
export function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** FNV-1a of a string. */
export function hashText(value: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** `hashText` part way: its state after `prefix`, to go on with `hashTextOn` (FNV-1a runs left to right). */
export function hashTextPrefix(prefix: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < prefix.length; i++) {
        h ^= prefix.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h;
}

/** Exactly `hashText(prefix + value)`, from `hashTextPrefix(prefix)`: a prefix shared by many keys is hashed once. */
export function hashTextOn(state: number, value: string): number {
    let h = state;
    for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/** A number in [0, 1) from an id and a salt. */
export function unitOf(id: string, salt: string | number = 0): number {
    return hashText(`${id}|${salt}`) / 4294967296;
}
