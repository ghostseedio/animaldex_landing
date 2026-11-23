/**
 * The spiders' webs drawn (lane ARK-WEBS): each web-spinning spider aboard (`spider-webs.ts` webHabit) gets its web at
 * its home, hung on what is drawn there, and sits on it. Loaded with the scene's first web spider (a dynamic import).
 *
 * Anchored, never floating: a web is fitted once its spider is within `FIT_WITHIN` of the camera. The triangles drawn
 * round its home (every mesh, instanced set and batch the scene draws there, as they are drawn, plus the drawn ground's
 * heights) are gathered, and rays are cast from candidate hubs in the web's plane (an orb), in every direction (a
 * tangle) or along the ground (a sheet). A web hangs only where its threads meet drawn surfaces on enough sides: an
 * orb's frame on three sides or more round its hub, a tangle in a corner of two surfaces, a sheet on the ground with a
 * wall or plants to run its funnel into. Every anchor thread ends on the surface its ray met. Nowhere to hang: no web.
 *
 * Cheap: one draw call for every web near the camera (thin camera-facing quads, `MAX_WEBS` webs at most), faded out
 * from `FADE_FROM` to `DRAWN_WITHIN` and not drawn beyond; nothing at all in a wide view. Silk is near invisible
 * except where it catches the light: a fibre glints where the sun's half-vector is square to it, glows when the camera
 * looks toward the sun through it, and carries dew at a still dawn (`props/conditions.ts` dewOf).
 */

import {worldColliders, type Collider} from "@/ark-scene/collide";
import {BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Quaternion, ShaderMaterial, Sphere, SphereGeometry, Vector2, Vector3, type BatchedMesh, type Material, type Object3D} from "three";
import {ARK_DAYLIGHT, ARK_ENV, ARK_GLINT, ARK_SUN} from "@/ark-scene/glsl";
import {dewOf} from "@/ark-scene/props/conditions";
import {threadOrder} from "@/ark-scene/props/web-spin";
import {atHub, silkTrip, webHabit, webStage, type WebHabit} from "@/ark-scene/spider-webs";
import {hashString} from "@/ark-scene/world";
import {type CatchFrame, type CatchGeometry} from "@/ark-scene/web-catch";

/** How far from its home a spider hangs its web at most (m): where there is something to hang it on. */
export const WEB_SITE_WITHIN = 3;
/** An orb weaver's, further: it moves on until it finds a gap to span (Foelix 2011), a few metres at most. */
export const ORB_SITE_WITHIN = 5;
const siteWithin = (habit: WebHabit) => (habit.kind === "orb" ? ORB_SITE_WITHIN : WEB_SITE_WITHIN);
/** Fitted within this far of the camera (m). */
export const FIT_WITHIN = 30;
/** Drawn within this far (m), fading out from `FADE_FROM`. */
export const DRAWN_WITHIN = 24;
export const FADE_FROM = 9;
/** Webs drawn at once (the nearest). */
export const MAX_WEBS = 16;
/** The silk bundles' parts drawn at once (three a bundle; the record's catches only: the owner, 2026-11-23, "no fake events"). */
const MAX_BUGS = 24;
/** Fitting's share of a frame (ms). */
const FIT_BUDGET_MS = 1.5;

export type WebPoint = {x: number; y: number; z: number; nx: number; ny: number; nz: number; tx: number; ty: number; tz: number};
type V3 = {x: number; y: number; z: number};

/** A ray's first drawn surface: its distance, the point, the surface's normal there. */
export type Hit = {d: number; x: number; y: number; z: number; nx: number; ny: number; nz: number};
/** Casts rays among what is drawn near a point: the first surface within `far`, or null. */
export type Caster = (origin: V3, dir: V3, far: number) => Hit | null;

/** One thread: its ends, when it is laid (0–1), its colour's gold (Nephila's silk is yellow). */
type Thread = {a: V3; b: V3; order: number};

export type FittedWeb = {
    id: string;
    habit: WebHabit;
    /** The hub (an orb's middle, a tangle's heart, a sheet's funnel mouth). */
    hub: V3;
    /** The web's plane: its normal (an orb's face; a sheet's is up) and its right and up in that plane. */
    normal: V3;
    right: V3;
    up: V3;
    radius: number;
    threads: Thread[];
    /** The radii's far ends (an orb's), the tangle's knots, the sheet's edge: where trips go. */
    ends: V3[];
    /** A night spinner's retreat by day: the top anchor, on its surface. */
    retreat: WebPoint | null;
    gold: number;
    /** Filled silk (a sheet's felt, its funnel's tube; alpha > 0) and dark (the funnel's mouth; alpha < 0): triangles. */
    fill?: Array<{a: V3; b: V3; c: V3; alpha: number}>;
};

// MARK: Fitting (pure, given a caster)

const sub = (a: V3, b: V3): V3 => ({x: a.x - b.x, y: a.y - b.y, z: a.z - b.z});
const add = (a: V3, b: V3, k = 1): V3 => ({x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k});
const len = (a: V3) => Math.hypot(a.x, a.y, a.z);
const norm = (a: V3): V3 => {
    const l = len(a) || 1;
    return {x: a.x / l, y: a.y / l, z: a.z / l};
};
const unit = (key: string) => (hashString(key) % 100000) / 100000;

/** A small seeded random for a web's own threads (the same web for every viewer). */
function seeded(key: string): () => number {
    let s = hashString(key) >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5;
        s >>>= 0;
        return s / 4294967296;
    };
}

/** An orb's rays: `n` directions round the hub in its plane (right, up). */
function planeDirs(right: V3, up: V3, n: number): V3[] {
    const out: V3[] = [];
    for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        out.push(norm(add({x: right.x * Math.cos(a), y: right.y * Math.cos(a), z: right.z * Math.cos(a)}, up, Math.sin(a))));
    }
    return out;
}

/**
 * An orb at `home`: the best hub and face among candidates round it, its frame anchored on three sides or more (the
 * widest gap between anchors under 160°), room for at least `minRadius` of orb. Null: nowhere to hang one.
 */
export function fitOrb(id: string, habit: WebHabit, home: V3, groundAt: (x: number, z: number) => number, cast: Caster): FittedWeb | null {
    return drain(fitOrbSteps(id, habit, home, groundAt, cast, NO_BUDGET));
}

function* fitOrbSteps(id: string, habit: WebHabit, home: V3, groundAt: (x: number, z: number) => number, cast: Caster, budget: {until: number}): Generator<void, FittedWeb | null> {
    const ground = groundAt(home.x, home.z);
    const RAYS = 12;
    // (Its frame threads may run a good way to their anchors, a metre and more to a branch over it: Foelix 2011.)
    const reach = Math.max(habit.radius * 2.6 + 0.25, 1.6);
    const minRadius = Math.min(habit.radius * 0.35, 0.08);
    let best: {score: number; hub: V3; right: V3; hits: Array<Hit | null>; radius: number} | null = null;
    const turn0 = unit(`orb:${id}`) * Math.PI;
    // Candidate hubs: round its home, and between two drawn things near it (two stems, a post and a shrub) the orb's
    // span apart, its face across the gap (`probeAround`).
    const base = Math.max(home.y, ground);
    const candidates: Array<{hub: V3; faces: number[]}> = [];
    const allFaces = [0, 1, 2, 3, 4, 5].map((f) => turn0 + (f / 6) * Math.PI);
    for (const [ox, oz] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) for (const lift of [1.0, 1.6, 2.4]) candidates.push({hub: {x: home.x + ox, y: base + habit.radius * lift + 0.05, z: home.z + oz}, faces: allFaces});
    const levels = [base + habit.radius * 1.1 + 0.05, base + habit.radius * 2 + 0.1, base + 0.9, base + 1.4];
    // (Nothing near: an orb weaver hangs its web where there is something to hang it on, a few strides off at most.)
    let pairs = probePairs(home, levels, cast, 0.2, Math.min(reach * 2, 2.4), 3);
    for (let ring = 2.5; pairs.length < 4 && ring <= ORB_SITE_WITHIN; ring += 2.5) {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + ring;
            const from = {x: home.x + Math.cos(a) * ring, y: home.y, z: home.z + Math.sin(a) * ring};
            pairs = pairs.concat(probePairs(from, levels, cast, 0.2, Math.min(reach * 2, 2.4), 2).map((p) => ({...p, d: p.d + ring})));
        }
    }
    for (const pair of pairs) candidates.push({hub: pair.mid, faces: [Math.atan2(pair.dir.z, pair.dir.x)]});
    // Beside one upright thing (a trunk, a post, a fence, a window frame), low, its orb strung between it and the ground
    // (Argiope in the open: a frame thread to a stem or post above, the rest to the grass: Bugguide). Its face square
    // to the thing, so the frame meets it.
    // Under something over it (a branch, an eave, a sill), its hub a little below, the frame down to the ground or plants.
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        for (const ring of [0, 0.8, 1.6, 2.6]) {
            if (ring === 0 && k > 0) continue;
            const from = {x: home.x + Math.cos(a) * ring, y: base + 0.3, z: home.z + Math.sin(a) * ring};
            const over = cast(from, {x: 0, y: 1, z: 0}, 2.2);
            if (over && over.ny < -0.2) candidates.push({hub: {x: from.x, y: Math.max(from.y + over.d - habit.radius * 1.3, base + habit.radius + 0.1), z: from.z}, faces: allFaces});
        }
    }
    const side = probeAround(home, [base + 0.3, base + 0.6, base + 1.0], cast, ORB_SITE_WITHIN, 16).filter((h) => Math.abs(h.ny) < 0.4).sort((a, b) => a.d - b.d);
    for (const wall of side.slice(0, 8)) {
        for (const off of [habit.radius * 0.9, habit.radius * 0.5]) for (const lift of [1.1, 1.5]) candidates.push({hub: {x: wall.x + wall.nx * off, y: base + habit.radius * lift + 0.05, z: wall.z + wall.nz * off}, faces: [Math.atan2(wall.nz, wall.nx)]});
    }
    for (const {hub, faces} of candidates.slice(0, 140)) {
        if (performance.now() > budget.until) yield;
        {
            for (const a of faces) {
                const right = {x: Math.cos(a), y: 0, z: Math.sin(a)};
                const dirs = planeDirs(right, {x: 0, y: 1, z: 0}, RAYS);
                const hits = dirs.map((dir) => {
                    const hit = cast(hub, dir, reach);
                    // The ground counts as drawn (its heights where the thread meets it), for the threads that go down to it.
                    if (dir.y < -0.2) {
                        const g = groundHit(hub, dir, reach, groundAt);
                        if (g && (!hit || g.d < hit.d)) return g;
                    }
                    return hit;
                });
                const near = hits.map((h) => (h ? h.d : reach));
                const radius = Math.min(habit.radius, Math.min(...near) * 0.85);
                if (radius < minRadius) continue;
                // Anchored all round: the widest run of rays with nothing to hold to.
                let gap = 0;
                let run = 0;
                for (let k = 0; k < RAYS * 2; k++) {
                    run = hits[k % RAYS] ? 0 : run + 1;
                    gap = Math.max(gap, run);
                }
                const anchored = hits.filter(Boolean).length;
                // (Anchors at most 150° apart round the hub: a frame on every side.)
                if (anchored < 3 || (gap + 1) * (360 / RAYS) > 150) continue;
                // A big orb on short threads, its hub not too low.
                const slack = hits.reduce((s, h) => s + (h ? Math.max(h.d - radius, 0) : 0), 0) / anchored;
                const score = radius - slack * 0.25 + anchored * 0.005 - Math.hypot(hub.x - home.x, hub.z - home.z) * 0.01;
                if (!best || score > best.score) best = {score, hub, right, hits, radius};
            }
        }
    }
    if (!best) return null;
    return buildOrb(id, habit, best.hub, best.right, best.hits, best.radius);
}

function buildOrb(id: string, habit: WebHabit, hub: V3, right: V3, hits: Array<Hit | null>, radius: number): FittedWeb {
    const random = seeded(`orb-threads:${id}`);
    const up = {x: 0, y: 1, z: 0};
    const normal = norm({x: right.z, y: 0, z: -right.x});
    const threads: Thread[] = [];
    const RAYS = hits.length;
    const anchors = hits.map((hit, k) => (hit ? {hit, k} : null)).filter((a): a is {hit: Hit; k: number} => a !== null);
    // Nephila's hub sits high in its orb: the orb reaches further down than up (Robinson & Robinson 1973).
    const high = habit.spinHour === null && habit.radius >= 0.5;
    const spokes = 22 + Math.floor(random() * 10);
    const at = (a: number, r: number): V3 => add(add(hub, right, Math.cos(a) * r), up, Math.sin(a) * r);
    // The orb's reach on each radius: its circle, a little uneven, and lower than the hub for Nephila.
    const reachOf = (a: number) => radius * (0.9 + 0.1 * Math.sin(a * 3 + random() * 0.2)) * (high ? (Math.sin(a) < 0 ? 1 : 0.55) : 1);
    // The frame: anchor threads from the rim out to what each ray met, laid first.
    anchors.forEach(({hit, k}, i) => {
        const a = (k / RAYS) * Math.PI * 2;
        threads.push({a: at(a, reachOf(a)), b: {x: hit.x, y: hit.y, z: hit.z}, order: threadOrder("anchor", i, anchors.length)});
    });
    // The frame's polygon round the rim, between the anchor threads' rim ends.
    for (let i = 0; i < anchors.length; i++) {
        const a0 = (anchors[i].k / RAYS) * Math.PI * 2;
        const a1 = (anchors[(i + 1) % anchors.length].k / RAYS) * Math.PI * 2;
        threads.push({a: at(a0, reachOf(a0)), b: at(a1, reachOf(a1)), order: threadOrder("anchor", i, anchors.length)});
    }
    const ends: V3[] = [];
    const angles: number[] = [];
    for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * Math.PI * 2 + (random() - 0.5) * 0.06;
        angles.push(a);
        const end = at(a, reachOf(a));
        ends.push(end);
        threads.push({a: hub, b: end, order: threadOrder("spoke", k, spokes)});
    }
    // The sticky spiral: evenly spaced turns in the orb's plane, from a free zone round the hub out to the rim; where the
    // orb is shorter on one side (Nephila's, above its hub) the spiral turns back short of it rather than crowding
    // (Zschokke & Vollrath 1995). Its spacing a few millimetres to a centimetre or two, by the orb's size (Foelix 2011).
    const reaches = angles.map((a) => reachOf(a));
    const longest = Math.max(...reaches);
    const free = radius * 0.2;
    const spacing = Math.max(0.012, radius * 0.055);
    const total = Math.ceil(((longest * 0.96 - free) / spacing) * spokes);
    for (let t = 0; t < total; t++) {
        const k0 = t % spokes;
        const k1 = (t + 1) % spokes;
        const r0 = free + (spacing * t) / spokes;
        const r1 = free + (spacing * (t + 1)) / spokes;
        if (r0 > reaches[k0] * 0.96 || r1 > reaches[k1] * 0.96) continue;
        threads.push({a: at(angles[k0], r0), b: at(angles[k1], r1), order: threadOrder("spiral", t, total)});
    }
    // The hub's own few turns, laid with the spokes.
    for (let t = 0; t < spokes * 2; t++) {
        const k0 = t % spokes;
        const k1 = (t + 1) % spokes;
        threads.push({a: at(angles[k0], radius * (0.05 + 0.05 * (t / (spokes * 2)))), b: at(angles[k1], radius * (0.05 + 0.05 * ((t + 1) / (spokes * 2)))), order: threadOrder("spoke", spokes - 1, spokes)});
    }
    // Argiope's band (Herberstein et al. 2000): a zigzag above and below the hub, or an X of four arms; Cyclosa's line
    // of prey remains through the hub. Laid last.
    if (habit.band) {
        const arms = habit.band === "cross" ? [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4] : [Math.PI / 2, -Math.PI / 2];
        for (const arm of arms) {
            const steps = habit.band === "debris" ? 6 : 16;
            const reach = radius * (habit.band === "debris" ? 0.7 : 0.55);
            for (let s = 0; s < steps; s++) {
                const r0 = radius * 0.1 + (reach * s) / steps;
                const r1 = radius * 0.1 + (reach * (s + 1)) / steps;
                const w = habit.band === "debris" ? 0.004 : 0.018 * (1 - s / steps * 0.4);
                const side = s % 2 ? 1 : -1;
                const p0 = add(add(hub, right, Math.cos(arm) * r0 - Math.sin(arm) * w * side), up, Math.sin(arm) * r0 + Math.cos(arm) * w * side);
                const p1 = add(add(hub, right, Math.cos(arm) * r1 + Math.sin(arm) * w * side), up, Math.sin(arm) * r1 - Math.cos(arm) * w * side);
                threads.push({a: p0, b: p1, order: 1});
                if (habit.band !== "debris") threads.push({a: p0, b: add(p1, up, 0.002), order: 1});
            }
        }
    }
    // A night spinner's retreat: where its highest anchor thread meets its surface (bark, a post).
    let retreat: WebPoint | null = null;
    if (habit.nightOnly) {
        const top = anchors.reduce<{hit: Hit; k: number} | null>((best, a) => (!best || a.hit.y > best.hit.y ? a : best), null);
        if (top) {
            const n = norm({x: top.hit.nx, y: top.hit.ny, z: top.hit.nz});
            const t = norm(sub({x: hub.x, y: hub.y, z: hub.z}, top.hit));
            retreat = {x: top.hit.x, y: top.hit.y, z: top.hit.z, nx: n.x, ny: n.y, nz: n.z, tx: t.x, ty: t.y, tz: t.z};
        }
    }
    return {id, habit, hub, normal, right, up, radius, threads, ends, retreat, gold: high ? 1 : 0};
}

/** Horizontal rays out from its home at these heights: the drawn surfaces round it (walls, posts, stems, shrubs). */
function probeAround(home: V3, levels: number[], cast: Caster, far: number, rays = 16): Array<Hit & {dir: V3}> {
    const out = probeFrom(home, levels, cast, far, rays);
    // (A home in or against something drawn, a trunk, a hedge: rays all round meet it at once. Probed again from a
    // stride out on each side.)
    if (out.filter((h) => h.d < 0.6).length >= levels.length * rays * 0.6) {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            out.push(...probeFrom({x: home.x + Math.cos(a) * 1.2, y: home.y, z: home.z + Math.sin(a) * 1.2}, levels, cast, far, 8));
        }
        return out.filter((h) => h.d >= 0.6);
    }
    return out;
}

function probeFrom(home: V3, levels: number[], cast: Caster, far: number, rays: number): Array<Hit & {dir: V3}> {
    const out: Array<Hit & {dir: V3}> = [];
    for (const y of levels) {
        for (let k = 0; k < rays; k++) {
            const a = (k / rays) * Math.PI * 2 + 0.1;
            const dir = {x: Math.cos(a), y: 0, z: Math.sin(a)};
            const hit = cast({x: home.x, y, z: home.z}, dir, far);
            if (hit) out.push({...hit, dir});
        }
    }
    return out;
}

/** Pairs of drawn things a span apart near its home (each found by a ray across the gap from the other): their middle and the line between. */
function probePairs(home: V3, levels: number[], cast: Caster, minSpan: number, maxSpan: number, far: number): Array<{mid: V3; dir: V3; d: number}> {
    const out: Array<{mid: V3; dir: V3; d: number}> = [];
    for (const hit of probeAround(home, levels, cast, far)) {
        // From just off the surface met, back across: the next drawn thing within the span.
        const back = {x: -hit.dir.x, y: 0, z: -hit.dir.z};
        for (const turn of [0, 0.35, -0.35]) {
            const c = Math.cos(turn);
            const sn = Math.sin(turn);
            const dir = {x: back.x * c - back.z * sn, y: 0, z: back.x * sn + back.z * c};
            const from = {x: hit.x + dir.x * 0.01, y: hit.y, z: hit.z + dir.z * 0.01};
            const other = cast(from, dir, maxSpan);
            if (!other || other.d < minSpan) continue;
            const mid = {x: (from.x + other.x) / 2, y: hit.y, z: (from.z + other.z) / 2};
            out.push({mid, dir, d: Math.hypot(mid.x - home.x, mid.z - home.z)});
        }
    }
    out.sort((a, b) => a.d - b.d);
    return out;
}

/** The 3D directions a tangle's or a sheet's rays go: the six axes and the eight diagonals. */
const ALL_DIRS: V3[] = (() => {
    const out: V3[] = [{x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0}, {x: 0, y: 1, z: 0}, {x: 0, y: -1, z: 0}, {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: -1}];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) out.push(norm({x: sx, y: sy, z: sz}));
    for (let k = 0; k < 8; k++) out.push({x: Math.cos((k / 8) * Math.PI * 2 + 0.39), y: 0, z: Math.sin((k / 8) * Math.PI * 2 + 0.39)});
    return out;
})();

/**
 * A tangle at `home`: in a concave corner (Pholcus and the theridiids spin where two surfaces meet: two walls, a wall and
 * the eave or sill over it, a wall and the ground at its foot: Foelix 2011; Jackson & Brassington 1987), its knots in
 * the space between the surfaces and every frame thread out to one of them. Null: no corner near.
 */
/** How far off its surfaces a tangle's heart is. */
const r0 = (habit: WebHabit) => Math.min(habit.radius * 0.5, 0.12);

/** Where a ray down from `from` meets the drawn ground (its height at each step, refined): null past `far`. */
function groundHit(from: V3, dir: V3, far: number, groundAt: (x: number, z: number) => number): Hit | null {
    if (dir.y >= 0) return null;
    let d = 0;
    for (let i = 0; i < 4; i++) {
        d = (from.y - groundAt(from.x + dir.x * d, from.z + dir.z * d)) / -dir.y;
        if (!(d > 0) || d > far) return null;
    }
    const x = from.x + dir.x * d;
    const z = from.z + dir.z * d;
    return {d, x, y: groundAt(x, z), z, nx: 0, ny: 1, nz: 0};
}

/** A surface of a corner: a point on it and its facing (out of the solid, into the corner's space). */
type Face = {p: V3; n: V3; ground: boolean};

export function fitTangle(id: string, habit: WebHabit, home: V3, groundAt: (x: number, z: number) => number, cast: Caster): FittedWeb | null {
    return drain(fitTangleSteps(id, habit, home, groundAt, cast, NO_BUDGET));
}

function* fitTangleSteps(id: string, habit: WebHabit, home: V3, groundAt: (x: number, z: number) => number, cast: Caster, budget: {until: number}): Generator<void, FittedWeb | null> {
    const r = habit.radius;
    const off = r0(habit);
    const base = Math.max(home.y, groundAt(home.x, home.z));
    // The uprights near it (walls, a shed's, a fence's), at the foot and higher.
    const walls = probeAround(home, [base + 0.15, base + 0.8, base + 1.6], cast, WEB_SITE_WITHIN + 1).filter((h) => Math.abs(h.ny) < 0.3).sort((a, b) => a.d - b.d);
    let best: {score: number; faces: Face[]; hub: V3} | null = null;
    const consider = (faces: Face[], hub: V3, kindScore: number) => {
        // (Its heart in the open: nothing between it and each of its surfaces but the gap it sits off them.)
        for (const f of faces) {
            const d = (hub.x - f.p.x) * f.n.x + (hub.y - f.p.y) * f.n.y + (hub.z - f.p.z) * f.n.z;
            if (d < off * 0.5 || d > off * 2.5) return;
            if (!f.ground && !cast(hub, {x: -f.n.x, y: -f.n.y, z: -f.n.z}, d + 0.05)) return;
        }
        for (const dir of ALL_DIRS) {
            const h = cast(hub, dir, off * 0.4);
            if (h) return;
        }
        const score = kindScore - Math.hypot(hub.x - home.x, hub.z - home.z) * 0.1;
        if (!best || score > best.score) best = {score, faces, hub};
    };
    for (const wall of walls.slice(0, 14)) {
        if (performance.now() > budget.until) yield;
        const n = norm({x: wall.nx, y: 0, z: wall.nz});
        const t = {x: -n.z, y: 0, z: n.x};
        const face: Face = {p: {x: wall.x, y: wall.y, z: wall.z}, n, ground: false};
        const g = groundAt(wall.x + n.x * off, wall.z + n.z * off);
        const ground: Face = {p: {x: wall.x, y: g, z: wall.z}, n: {x: 0, y: 1, z: 0}, ground: true};
        const foot = Math.abs(wall.y - g) < 0.4;
        // Two walls: along this one each way to another facing back across it (the inside of an L).
        for (const side of [1, -1]) {
            const from = add(face.p, n, 0.05);
            const dir = {x: t.x * side, y: 0, z: t.z * side};
            const other = cast(from, dir, 2.5);
            if (!other || Math.abs(other.ny) > 0.3) continue;
            const n2 = norm({x: other.nx, y: 0, z: other.nz});
            if (n2.x * dir.x + n2.z * dir.z > -0.5) continue;
            const second: Face = {p: {x: other.x, y: other.y, z: other.z}, n: n2, ground: false};
            const cornerAt = (y: number): V3 => ({x: other.x + n.x * off + n2.x * off, y, z: other.z + n.z * off + n2.z * off});
            if (foot) consider([face, second, ground], cornerAt(g + off), 4);
            // Up the corner to under anything over it (an eave, a ceiling, a sill), else at a height.
            const up = cast(cornerAt(wall.y), {x: 0, y: 1, z: 0}, 2.5);
            if (up && up.ny < -0.5) consider([face, second, {p: {x: up.x, y: up.y, z: up.z}, n: {x: 0, y: -1, z: 0}, ground: false}], cornerAt(wall.y + up.d - off), 5);
            consider([face, second], cornerAt(wall.y), 3);
        }
        // A wall and what is over it (an eave, a sill).
        const under = add(face.p, n, off);
        const over = cast(under, {x: 0, y: 1, z: 0}, 2.5);
        if (over && over.ny < -0.5) consider([face, {p: {x: over.x, y: over.y, z: over.z}, n: {x: 0, y: -1, z: 0}, ground: false}], {x: under.x, y: under.y + over.d - off, z: under.z}, 3.5);
        // A wall and the ground at its foot.
        if (foot) consider([face, ground], {x: under.x, y: g + off, z: under.z}, 2);
    }
    if (!best) return null;
    const {faces, hub} = best as {score: number; faces: Face[]; hub: V3};
    const random = seeded(`tangle:${id}`);
    // The knots: in the corner's space, between its surfaces (each knot a little off every one), the corner's way
    // along (up a two-wall corner; along the wall otherwise).
    const walls2 = faces.filter((f) => !f.ground && Math.abs(f.n.y) < 0.5);
    const along = walls2.length >= 2 ? {x: 0, y: 1, z: 0} : walls2.length ? {x: -walls2[0].n.z, y: 0, z: walls2[0].n.x} : {x: 1, y: 0, z: 0};
    const knots: V3[] = [];
    for (let i = 0; i < 40 && knots.length < 22; i++) {
        let k: V3 = add(hub, along, (random() - 0.5) * r * 1.2);
        for (const f of faces) k = add(k, f.n, (random() * 0.9 - 0.25) * r);
        // Short of every surface and inside the corner (on the open side of each face).
        let ok = true;
        for (const f of faces) {
            const d = (k.x - f.p.x) * f.n.x + (k.y - f.p.y) * f.n.y + (k.z - f.p.z) * f.n.z;
            if (d < 0.015) ok = false;
        }
        if (ok && cast(hub, norm(sub(k, hub)), len(sub(k, hub)) + 0.01)) ok = false;
        if (ok) knots.push(k);
    }
    if (knots.length < 6) return null;
    const threads: Thread[] = [];
    // Frame threads: each knot to the surfaces nearest it, straight on to each (a cast: every one ends on its surface).
    for (const k of knots) {
        const near = faces.map((f) => ({f, d: (k.x - f.p.x) * f.n.x + (k.y - f.p.y) * f.n.y + (k.z - f.p.z) * f.n.z})).sort((a, b) => a.d - b.d);
        for (const {f, d} of near.slice(0, 2)) {
            if (d > r * 1.5) continue;
            const dir = {x: -f.n.x, y: -f.n.y, z: -f.n.z};
            // A little slant, as real frame threads run: the cast says where it lands.
            const slant = norm(add(dir, along, (random() - 0.5) * 0.6));
            const hit = cast(k, slant, d * 2 + 0.05);
            const g = f.ground ? groundHit(k, slant, d * 2 + 0.05, groundAt) : null;
            const end = hit && (!g || hit.d < g.d) ? hit : g;
            if (end) threads.push({a: k, b: {x: end.x, y: end.y, z: end.z}, order: 0});
        }
    }
    // The tangle: each knot to its nearer neighbours (short threads, knot to knot).
    for (let i = 0; i < knots.length; i++) {
        const order = knots.map((k, j) => ({j, d: len(sub(k, knots[i]))})).filter((o) => o.j !== i).sort((a, b) => a.d - b.d);
        for (const {j, d} of order.slice(0, 2 + (i % 2))) if (j > i || d > r * 0.5) threads.push({a: knots[i], b: knots[j], order: 0});
    }
    // Gumfoot lines (theridiids, not Pholcus): straight down from the low knots to the ground met (Benjamin & Zschokke 2003).
    if (!habit.hangs) {
        for (const k of knots.slice().sort((a, b) => a.y - b.y).slice(0, 5)) {
            const down = cast(k, {x: 0, y: -1, z: 0}, 0.8);
            const g = groundAt(k.x, k.z);
            const y = down ? k.y - down.d : k.y - g < 0.8 ? g : null;
            if (y !== null) threads.push({a: k, b: {x: k.x, y, z: k.z}, order: 0});
        }
    }
    const normal = {x: 0, y: 1, z: 0};
    // (Its open side, out of the corner: its surfaces' facings together, level. A look into the corner is from there.)
    const facing = faces.reduce((m, f) => ({x: m.x + f.n.x, y: 0, z: m.z + f.n.z}), {x: 0, y: 0, z: 0});
    const open = len(facing) > 1e-3 ? norm(facing) : {x: 0, y: 0, z: 1};
    return {id, habit, hub, normal, right: {x: open.z, y: 0, z: -open.x}, up: open, radius: r, threads: threads.filter((t) => len(sub(t.a, t.b)) > 0.005), ends: knots, retreat: null, gold: 0};
}

/**
 * A sheet and its funnel at `home`: on the ground, its funnel running back into the nearest vertical surface (a wall's
 * foot, a fence, a log, a stone) within reach, else into the grass (the funnel down into the plants' bases, as a grass
 * spider's). Its edge held up by threads to the surfaces round it.
 */
export function fitSheet(id: string, habit: WebHabit, home: V3, ground: (x: number, z: number) => number, cast: Caster): FittedWeb | null {
    const r = habit.radius;
    let best: {score: number; mouth: V3; back: V3; wall: Hit | null} | null = null;
    // Candidate mouths: round its home, and at the foot of each upright surface near it (a wall's, a fence's, a log's).
    const g0 = ground(home.x, home.z);
    const spots: Array<[number, number]> = [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]];
    for (const wall of probeAround({x: home.x, y: g0, z: home.z}, [g0 + 0.15], cast, 4).filter((h) => Math.abs(h.ny) < 0.4).sort((a, b) => a.d - b.d).slice(0, 8)) spots.push([wall.x + wall.nx * 0.25 - home.x, wall.z + wall.nz * 0.25 - home.z]);
    for (const [ox, oz] of spots) {
        const x = home.x + ox;
        const z = home.z + oz;
        const g = ground(x, z);
        const at = {x, y: g + 0.06, z};
        const walls: Array<Hit | null> = [];
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            walls.push(cast(at, {x: Math.cos(a), y: 0, z: Math.sin(a)}, 0.6));
        }
        // (Not inside something drawn: a wall's or a log's inside meets its faces all round.)
        if (walls.filter(Boolean).length >= 6) continue;
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const dir = {x: Math.cos(a), y: 0, z: Math.sin(a)};
            const wall = walls[k];
            // (An upright thing, a wall's or a fence's or a log's foot, at least a hand high: not a path's edge.)
            const vertical = wall && Math.abs(wall.ny) < 0.5 && Boolean(cast({x: at.x, y: at.y + 0.25, z: at.z}, dir, wall.d + 0.15));
            const score = vertical ? 2 - wall!.d : 0;
            if (!best || score > best.score) best = {score, mouth: at, back: dir, wall: vertical ? wall : null};
        }
    }
    // (Eratigena and its kin spin into a corner, by a wall: no wall near, no web: Roberts 1995.)
    if (!best || !best.wall) return null;
    const random = seeded(`sheet:${id}`);
    const {back, wall} = best;
    // The funnel's mouth a little out from the wall; the sheet spreads away from it.
    const mouth = wall ? {x: best.mouth.x + back.x * (wall.d - 0.07), y: best.mouth.y, z: best.mouth.z + back.z * (wall.d - 0.07)} : best.mouth;
    const out = {x: -back.x, y: 0, z: -back.z};
    const side = {x: -out.z, y: 0, z: out.x};
    const threads: Thread[] = [];
    const ends: V3[] = [];
    // The sheet: a fan of threads out from the mouth and rings across them, just over the ground and sagging a little.
    const RADII = 14;
    const RINGS = 9;
    const pt = (u: number, w: number): V3 => {
        const a = (w - 0.5) * Math.PI * 0.95;
        const d = r * (0.08 + 0.92 * u) * (0.85 + 0.15 * Math.sin(w * 9 + u * 3));
        const x = mouth.x + (out.x * Math.cos(a) + side.x * Math.sin(a)) * d;
        const z = mouth.z + (out.z * Math.cos(a) + side.z * Math.sin(a)) * d;
        return {x, y: Math.max(ground(x, z) + 0.035, mouth.y - 0.01 - 0.01 * Math.sin(u * Math.PI)), z};
    };
    for (let i = 0; i < RADII; i++) {
        const w = i / (RADII - 1);
        let prev = mouth;
        for (let s = 1; s <= RINGS; s++) {
            const p = pt(s / RINGS, w);
            threads.push({a: prev, b: p, order: 0});
            prev = p;
        }
        ends.push(prev);
    }
    for (let s = 1; s <= RINGS; s++) {
        for (let i = 0; i < RADII - 1; i++) threads.push({a: pt(s / RINGS, i / (RADII - 1)), b: pt(s / RINGS, (i + 1) / (RADII - 1)), order: 0});
        // A few crossing threads: a sheet is a felt, not a fan.
        for (let i = 0; i < 4; i++) threads.push({a: pt(s / RINGS, random()), b: pt(Math.min((s + 1) / RINGS, 1), random()), order: 0});
    }
    // The funnel: a tube of threads from the mouth back into the corner (or down into the grass's bases).
    const funnelEnd = wall ? {x: wall.x - back.x * 0.005, y: mouth.y - 0.02, z: wall.z - back.z * 0.005} : {x: mouth.x + back.x * 0.08, y: ground(mouth.x, mouth.z) + 0.005, z: mouth.z + back.z * 0.08};
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const ring = (p: V3, rr: number): V3 => ({x: p.x + side.x * Math.cos(a) * rr, y: p.y + 0.012 + Math.sin(a) * rr * 0.7, z: p.z + side.z * Math.cos(a) * rr});
        threads.push({a: ring(mouth, 0.03), b: ring(funnelEnd, 0.012), order: 0});
    }
    // The felt: a sheet's silk is dense enough to read as a pale patch (Agelenidae: Foelix 2011); a dark mouth.
    const fill: NonNullable<FittedWeb["fill"]> = [];
    for (let s = 0; s < RINGS; s++) {
        for (let i = 0; i < RADII - 1; i++) {
            const u0 = s / RINGS;
            const u1 = (s + 1) / RINGS;
            const w0 = i / (RADII - 1);
            const w1 = (i + 1) / (RADII - 1);
            const alpha = 0.34 * (1 - 0.6 * u1);
            const p00 = s === 0 ? mouth : pt(u0, w0);
            const p01 = s === 0 ? mouth : pt(u0, w1);
            fill.push({a: p00, b: pt(u1, w0), c: pt(u1, w1), alpha});
            if (s > 0) fill.push({a: p00, b: pt(u1, w1), c: p01, alpha});
        }
    }
    {
        const ringAt = (p: V3, rr: number, a: number): V3 => ({x: p.x + side.x * Math.cos(a) * rr, y: p.y + 0.012 + Math.sin(a) * rr * 0.7, z: p.z + side.z * Math.cos(a) * rr});
        const centre = {x: mouth.x + back.x * 0.004, y: mouth.y + 0.012, z: mouth.z + back.z * 0.004};
        for (let i = 0; i < 10; i++) {
            const a0 = (i / 10) * Math.PI * 2;
            const a1 = ((i + 1) / 10) * Math.PI * 2;
            // The tube, pale; its opening, dark.
            fill.push({a: ringAt(mouth, 0.03, a0), b: ringAt(funnelEnd, 0.012, a0), c: ringAt(funnelEnd, 0.012, a1), alpha: 0.4});
            fill.push({a: ringAt(mouth, 0.03, a0), b: ringAt(funnelEnd, 0.012, a1), c: ringAt(mouth, 0.03, a1), alpha: 0.4});
            fill.push({a: centre, b: ringAt(centre, 0.026, a0), c: ringAt(centre, 0.026, a1), alpha: -0.85});
        }
    }
    // Scaffold threads from the sheet's edge up to the wall or the plants over it.
    if (wall) {
        for (let i = 0; i < 6; i++) {
            const e = ends[Math.floor(random() * ends.length)];
            const upHit = cast(e, norm({x: back.x, y: 0.6, z: back.z}), r * 2.5);
            if (upHit) threads.push({a: e, b: {x: upHit.x, y: upHit.y, z: upHit.z}, order: 0});
        }
    }
    return {id, habit, hub: mouth, normal: {x: 0, y: 1, z: 0}, right: side, up: out, radius: r, threads, ends, retreat: null, gold: 0, fill};
}

/** Fit a spider's web of its kind at its home. */
export function fitWeb(id: string, habit: WebHabit, home: V3, groundNear: (x: number, z: number, near?: number) => number, cast: Caster): FittedWeb | null {
    return drain(fitWebSteps(id, habit, home, groundNear, cast, NO_BUDGET));
}

/** The same, a slice at a time (it pauses between candidate sites once `budget.until` is past). */
export function* fitWebSteps(id: string, habit: WebHabit, home: V3, groundNear: (x: number, z: number, near?: number) => number, cast: Caster, budget: {until: number}): Generator<void, FittedWeb | null> {
    // (The floor it lives on where floors are stacked, a town's raised lawns and decks: the one nearest its home's height.)
    const ground = (x: number, z: number) => groundNear(x, z, home.y + 0.3);
    if (habit.kind !== "sheet") {
        const steps = habit.kind === "orb" ? fitOrbSteps(id, habit, home, ground, cast, budget) : fitTangleSteps(id, habit, home, ground, cast, budget);
        for (;;) {
            const step = steps.next();
            if (step.done) return step.value;
            yield;
        }
    }
    return fitSheet(id, habit, home, ground, cast);
}

// MARK: The spider on its web

/** Where on its web its spider is now (its feet's point, its back's way, its head's way). */
export function spiderOnWeb(web: FittedWeb, hours: number, seconds: number, built: number): WebPoint {
    const {habit, hub, normal} = web;
    if (habit.kind === "orb") {
        // A night spinner by day: in its retreat.
        if (web.retreat && !atHub(habit, web.id, hours)) return web.retreat;
        const stage = webStage(habit, web.id, hours);
        let at: V3 = hub;
        if (stage.spinning) {
            // At the thread being laid now (the last one whose turn has come).
            let last: Thread | null = null;
            for (const t of web.threads) if (t.order <= built && (!last || t.order >= last.order)) last = t;
            if (last) at = last.b;
        } else if (!stage.takingDown && web.ends.length) {
            const trip = silkTrip(web.id, seconds);
            const end = web.ends[trip.thread % web.ends.length];
            at = add(hub, sub(end, hub), trip.out * 0.9);
        }
        // Head down on its face (Argiope sits head down at the hub: Bugguide), its back off the face toward the side it rests.
        return {x: at.x, y: at.y, z: at.z, nx: normal.x, ny: normal.y, nz: normal.z, tx: 0, ty: -1, tz: 0};
    }
    if (habit.kind === "tangle") {
        // Hanging upside down under its tangle's knots (theridiids and Pholcus hang inverted: Foelix 2011), out along a
        // thread now and then.
        const trip = silkTrip(web.id, seconds);
        const home = web.ends.reduce((best, k) => (k.y > best.y ? k : best), web.ends[0] ?? hub);
        const to = web.ends[trip.thread % Math.max(web.ends.length, 1)] ?? home;
        const at = add(home, sub(to, home), trip.out);
        const a = unit(`tangle-face:${web.id}`) * Math.PI * 2;
        return {x: at.x, y: at.y, z: at.z, nx: 0, ny: -1, nz: 0, tx: Math.cos(a), ty: 0, tz: Math.sin(a)};
    }
    // A sheet weaver at its funnel's mouth, facing out over its sheet; out over it and back now and then.
    const trip = silkTrip(web.id, seconds);
    const to = web.ends[trip.thread % Math.max(web.ends.length, 1)] ?? hub;
    const at = add(hub, sub(to, hub), trip.out * 0.8);
    const dir = trip.out > 0 ? norm(sub(to, hub)) : norm(web.up);
    return {x: at.x, y: at.y, z: at.z, nx: 0, ny: 1, nz: 0, tx: dir.x, ty: 0, tz: dir.z};
}

// MARK: Gathering what is drawn

/** Names never to hang a web on: the weather, the sky, the animals' marks, water. */
const NEVER = /sky|cloud|rain|snow|mist|halo|label|dust|trace|mark|icon|ring|shadow|speck|dot|water|sea|wave|glow|light|webs/i;
const TO_LOCAL = new Matrix4();
const MAT = new Matrix4();
const Q = new Quaternion();
const S = new Vector3();
const P = new Vector3();
const UP = new Vector3(0, 1, 0);
const FWD = new Vector3(0, 0, 1);
const AXIS = new Vector3();
const SPIN = new Quaternion();
const OFF = new Vector3();
const COL = new Color();
const M = new Matrix4();
const W = new Matrix4();
const A = new Vector3();
const B = new Vector3();
const C = new Vector3();
const L = new Vector3();
const SPHERE = new Sphere();

/**
 * The triangles drawn within `reach` of `centre` (world frame, nine numbers each), from every visible mesh, instanced set
 * (each instance near) and batch under `root`. The ground is asked by its heights instead (its meshes are left out).
 */
export function gatherDrawn(root: Object3D, centre: V3, reach: number, skip: (object: Object3D) => boolean, tally?: Map<string, number>, owners?: string[]): Float32Array {
    const steps = gatherSteps(root, centre, reach, skip, {until: Infinity}, tally, owners);
    for (;;) {
        const step = steps.next();
        if (step.done) return step.value;
    }
}

/**
 * The same, a slice at a time: it pauses (yields) once `budget.until` (performance.now()) is past, at the next scene object
 * or every 256 instances, and is resumed in a later frame, so a gather never stalls one frame.
 */
export function* gatherSteps(root: Object3D, centre: V3, reach: number, skip: (object: Object3D) => boolean, budget: {until: number}, tally?: Map<string, number>, owners?: string[]): Generator<void, Float32Array> {
    let current = "";
    let list = new Float32Array(9 * 1024);
    let count = 0;
    const push = (a: Vector3, b: Vector3, c: Vector3) => {
        if ((count + 1) * 9 > list.length) {
            const grown = new Float32Array(list.length * 2);
            grown.set(list);
            list = grown;
        }
        const at = count * 9;
        list[at] = a.x;
        list[at + 1] = a.y;
        list[at + 2] = a.z;
        list[at + 3] = b.x;
        list[at + 4] = b.y;
        list[at + 5] = b.z;
        list[at + 6] = c.x;
        list[at + 7] = c.y;
        list[at + 8] = c.z;
        count++;
        if (tally) tally.set(current, (tally.get(current) ?? 0) + 1);
        if (owners) owners.push(current);
    };
    const take = (geometry: BufferGeometry, matrix: Matrix4, start = 0, total = -1) => {
        const position = geometry.getAttribute("position") as BufferAttribute | undefined;
        // (A copy let go once on the GPU: nothing to read here; its colliders stand in.)
        if (!position || !position.array || position.array.length < position.count * position.itemSize) return;
        const index = geometry.index;
        TO_LOCAL.copy(matrix).invert();
        const scale = matrix.getMaxScaleOnAxis() || 1;
        L.set(centre.x, centre.y, centre.z).applyMatrix4(TO_LOCAL);
        const r = reach / scale;
        const n = total >= 0 ? total : index ? index.count : position.count;
        for (let t = start; t + 2 < start + n; t += 3) {
            const a = index ? index.getX(t) : t;
            const b = index ? index.getX(t + 1) : t + 1;
            const c = index ? index.getX(t + 2) : t + 2;
            const ax = position.getX(a);
            const bx = position.getX(b);
            const cx = position.getX(c);
            if (Math.min(ax, bx, cx) > L.x + r || Math.max(ax, bx, cx) < L.x - r) continue;
            const az = position.getZ(a);
            const bz = position.getZ(b);
            const cz = position.getZ(c);
            if (Math.min(az, bz, cz) > L.z + r || Math.max(az, bz, cz) < L.z - r) continue;
            const ay = position.getY(a);
            const by = position.getY(b);
            const cy = position.getY(c);
            if (Math.min(ay, by, cy) > L.y + r || Math.max(ay, by, cy) < L.y - r) continue;
            push(A.set(ax, ay, az).applyMatrix4(matrix), B.set(bx, by, bz).applyMatrix4(matrix), C.set(cx, cy, cz).applyMatrix4(matrix));
        }
    };
    const near = (geometry: BufferGeometry, matrix: Matrix4) => {
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        const sphere = geometry.boundingSphere!;
        A.copy(sphere.center).applyMatrix4(matrix);
        const radius = sphere.radius * (matrix.getMaxScaleOnAxis() || 1);
        return Math.hypot(A.x - centre.x, A.y - centre.y, A.z - centre.z) < radius + reach;
    };
    const stack: Object3D[] = [root];
    while (stack.length) {
        if (performance.now() > budget.until) yield;
        const object = stack.pop()!;
        if (!object.visible || skip(object)) continue;
        const mesh = object as Mesh;
        const name = mesh.name || (mesh.userData.kind as string | undefined) || "";
        current = name || mesh.parent?.name || "?";
        // (Nameless helpers, a ground-hugging layer that follows the camera among them (3,000 flat triangles a hand over
        // the lawn wherever one looks), are no surface to hang silk on: only the named world's.)
        if (current === "?") {
            for (let c = object.children.length - 1; c >= 0; c--) stack.push(object.children[c]);
            continue;
        }
        if (mesh.isMesh && !(NEVER.test(name) || /ground|terrain|tile|inside|decal|near:|litter|pebble|scatter/i.test(name)) && !mesh.userData.arkAnimal && !(mesh as unknown as {isSkinnedMesh?: boolean}).isSkinnedMesh) {
            const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined;
            // (Not cut-out cards, whose clear parts are no surface, nor a far level of detail, swapped out up close.)
            const seen = material && material.visible && material.colorWrite && !(material.transparent && material.opacity < 0.5) && !(material.alphaTest > 0) && !/:lod[1-9]|impostor/i.test(name);
            const geometry = mesh.geometry as BufferGeometry;
            if (seen && geometry) {
                const batched = mesh as unknown as BatchedMesh;
                const instanced = mesh as unknown as InstancedMesh;
                if (batched.isBatchedMesh) {
                    for (let i = 0; i < batched.instanceCount; i++) {
                        if ((i & 255) === 255 && performance.now() > budget.until) yield;
                        try {
                            if (!batched.getVisibleAt(i)) continue;
                            const g = batched.getGeometryIdAt(i);
                            batched.getMatrixAt(i, M);
                            W.multiplyMatrices(mesh.matrixWorld, M);
                            const box = batched.getBoundingSphereAt(g, SPHERE);
                            if (!box) continue;
                            A.copy(box.center).applyMatrix4(W);
                            if (Math.hypot(A.x - centre.x, A.y - centre.y, A.z - centre.z) > box.radius * (W.getMaxScaleOnAxis() || 1) + reach) continue;
                            const range = batched.getGeometryRangeAt(g) as {indexStart: number; indexCount: number; vertexStart: number; vertexCount: number};
                            if (geometry.index && range.indexCount > 0) take(geometry, W, range.indexStart, range.indexCount);
                            else take(geometry, W, range.vertexStart, range.vertexCount);
                        } catch {
                            continue;
                        }
                    }
                } else if (instanced.isInstancedMesh) {
                    // (Ground cover in the tens of thousands, grass blades, is no frame for a web: its drawn blades sway.)
                    if (instanced.count <= 20000) {
                        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
                        const sphere = geometry.boundingSphere!;
                        const e = instanced.instanceMatrix.array as Float32Array;
                        const worldScale = mesh.matrixWorld.getMaxScaleOnAxis() || 1;
                        for (let i = 0; i < instanced.count; i++) {
                            if ((i & 255) === 255 && performance.now() > budget.until) yield;
                            // (First by the instance's own place and size, read straight from its matrix: most are far.)
                            const k = i * 16;
                            const scale = Math.max(Math.hypot(e[k], e[k + 1], e[k + 2]), Math.hypot(e[k + 4], e[k + 5], e[k + 6]), Math.hypot(e[k + 8], e[k + 9], e[k + 10]));
                            A.set(e[k + 12], e[k + 13], e[k + 14]).applyMatrix4(mesh.matrixWorld);
                            const r = (len(sphere.center) * scale + sphere.radius * scale) * worldScale;
                            if (Math.hypot(A.x - centre.x, A.y - centre.y, A.z - centre.z) > r + reach) continue;
                            instanced.getMatrixAt(i, M);
                            W.multiplyMatrices(mesh.matrixWorld, M);
                            if (near(geometry, W)) take(geometry, W);
                        }
                    }
                } else if (near(geometry, mesh.matrixWorld)) {
                    const draw = geometry.drawRange;
                    const total = geometry.index ? geometry.index.count : (geometry.getAttribute("position")?.count ?? 0);
                    const start = Math.max(draw.start, 0);
                    take(geometry, mesh.matrixWorld, start, Math.min(draw.count, total - start));
                }
            }
        }
        for (let c = object.children.length - 1; c >= 0; c--) stack.push(object.children[c]);
    }
    return list.subarray(0, count * 9);
}

/** The hard colliders round a point (walls, fences, posts) as triangles, after the gathered ones. */
function withColliders(list: Float32Array, centre: V3, reach: number): Float32Array {
    let near: readonly Collider[] = [];
    try {
        near = worldColliders().near(centre.x, centre.z, reach);
    } catch {
        return list;
    }
    const extra: number[] = [];
    const quad = (p: number[][]) => extra.push(...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]);
    const prism = (ring: Array<[number, number]>, y0: number, y1: number) => {
        for (let i = 0; i < ring.length; i++) {
            const [ax, az] = ring[i];
            const [bx, bz] = ring[(i + 1) % ring.length];
            quad([[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]]);
        }
        // Its top (a wall's coping, a post's cap): a fan.
        for (let i = 1; i + 1 < ring.length; i++) extra.push(ring[0][0], y1, ring[0][1], ring[i][0], y1, ring[i][1], ring[i + 1][0], y1, ring[i + 1][1]);
    };
    for (const c of near) {
        // (Not a hedge, whose leafy drawn mass is wider and rounder than its collider: its own drawn leaves stand in.)
        if (c.soft || c.gap >= 0.2 || !(c.kind === "building" || c.kind === "fence" || c.kind === "post")) continue;
        const y0 = Number.isFinite(c.y0) ? c.y0 : centre.y - 5;
        const y1 = Number.isFinite(c.y1) ? c.y1 : centre.y + 5;
        if (c.shape === "box") {
            const at = (lx: number, lz: number): [number, number] => [c.cx + lx * c.cos + lz * c.sin, c.cz - lx * c.sin + lz * c.cos];
            prism([at(c.hx0, c.hz0), at(c.hx1, c.hz0), at(c.hx1, c.hz1), at(c.hx0, c.hz1)], y0, y1);
        } else if (c.shape === "circle") {
            const ring: Array<[number, number]> = [];
            for (let k = 0; k < 8; k++) ring.push([c.cx + Math.cos((k / 8) * Math.PI * 2) * c.r, c.cz + Math.sin((k / 8) * Math.PI * 2) * c.r]);
            prism(ring, y0, y1);
        } else {
            const dx = c.bx - c.ax;
            const dz = c.bz - c.az;
            const l = Math.hypot(dx, dz) || 1;
            const nx = (-dz / l) * c.r;
            const nz = (dx / l) * c.r;
            prism([[c.ax + nx, c.az + nz], [c.bx + nx, c.bz + nz], [c.bx - nx, c.bz - nz], [c.ax - nx, c.az - nz]], y0, y1);
        }
    }
    if (!extra.length) return list;
    const out = new Float32Array(list.length + extra.length);
    out.set(list);
    out.set(extra, list.length);
    return out;
}

/** A caster over gathered triangles (both faces): the nearest hit and its normal. */
export function triangleCaster(list: Float32Array, centre: V3 = {x: 0, y: 0, z: 0}, reach = 6): Caster {
    return drain(casterSteps(list, centre, reach, NO_BUDGET));
}

/** Run a sliced step to its end at once. */
function drain<T>(steps: Generator<void, T>): T {
    for (;;) {
        const step = steps.next();
        if (step.done) return step.value;
    }
}

/** A budget never spent: a sliced step run to its end. */
const NO_BUDGET = {until: Infinity};

/** The caster, built a slice at a time (it pauses once `budget.until` is past, every 2048 triangles). */
export function* casterSteps(list: Float32Array, centre: V3, reach: number, budget: {until: number}): Generator<void, Caster> {
    const count = list.length / 9;
    // A grid of the triangles (by their boxes, `CELL` m cells): a ray tests only those in the cells it passes.
    const CELL = 0.4;
    const cells = new Map<number, number[]>();
    const key = (i: number, j: number, k: number) => ((i + 2048) * 4096 + (j + 2048)) * 4096 + (k + 2048);
    const lo = {x: Math.floor((centre.x - reach) / CELL), y: Math.floor((centre.y - reach) / CELL), z: Math.floor((centre.z - reach) / CELL)};
    const hi = {x: Math.floor((centre.x + reach) / CELL), y: Math.floor((centre.y + reach) / CELL), z: Math.floor((centre.z + reach) / CELL)};
    for (let t = 0; t < count; t++) {
        if ((t & 2047) === 2047 && performance.now() > budget.until) yield;
        const k = t * 9;
        const x0 = Math.floor(Math.min(list[k], list[k + 3], list[k + 6]) / CELL);
        const x1 = Math.floor(Math.max(list[k], list[k + 3], list[k + 6]) / CELL);
        const y0 = Math.floor(Math.min(list[k + 1], list[k + 4], list[k + 7]) / CELL);
        const y1 = Math.floor(Math.max(list[k + 1], list[k + 4], list[k + 7]) / CELL);
        const z0 = Math.floor(Math.min(list[k + 2], list[k + 5], list[k + 8]) / CELL);
        const z1 = Math.floor(Math.max(list[k + 2], list[k + 5], list[k + 8]) / CELL);
        // (A huge triangle, a wall's whole face, only in the cells within the gathered reach.)
        for (let i = Math.max(x0, lo.x); i <= Math.min(x1, hi.x); i++) {
            for (let j = Math.max(y0, lo.y); j <= Math.min(y1, hi.y); j++) {
                for (let m = Math.max(z0, lo.z); m <= Math.min(z1, hi.z); m++) {
                    const c = key(i, j, m);
                    const here = cells.get(c);
                    if (here) here.push(t);
                    else cells.set(c, [t]);
                }
            }
        }
    }
    const stamp = new Uint32Array(count);
    let ray = 0;
    const visited: number[] = [];
    return (o, d, far) => {
        let best = far;
        let at = -1;
        ray++;
        visited.length = 0;
        let last = -1;
        // The cells along the ray, a half cell a step (and the cells either side of each step's point).
        for (let s = 0; s <= far + CELL; s += CELL * 0.5) {
            const x = o.x + d.x * Math.min(s, far);
            const y = o.y + d.y * Math.min(s, far);
            const z = o.z + d.z * Math.min(s, far);
            const c = key(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL));
            if (c === last) continue;
            last = c;
            const here = cells.get(c);
            if (!here) continue;
            for (const t of here) {
                if (stamp[t] === ray) continue;
                stamp[t] = ray;
                visited.push(t);
            }
        }
        for (const i of visited) {
            const k = i * 9;
            const ax = list[k];
            const ay = list[k + 1];
            const az = list[k + 2];
            const e1x = list[k + 3] - ax;
            const e1y = list[k + 4] - ay;
            const e1z = list[k + 5] - az;
            const e2x = list[k + 6] - ax;
            const e2y = list[k + 7] - ay;
            const e2z = list[k + 8] - az;
            const px = d.y * e2z - d.z * e2y;
            const py = d.z * e2x - d.x * e2z;
            const pz = d.x * e2y - d.y * e2x;
            const det = e1x * px + e1y * py + e1z * pz;
            if (Math.abs(det) < 1e-12) continue;
            const inv = 1 / det;
            const tx = o.x - ax;
            const ty = o.y - ay;
            const tz = o.z - az;
            const u = (tx * px + ty * py + tz * pz) * inv;
            if (u < 0 || u > 1) continue;
            const qx = ty * e1z - tz * e1y;
            const qy = tz * e1x - tx * e1z;
            const qz = tx * e1y - ty * e1x;
            const v = (d.x * qx + d.y * qy + d.z * qz) * inv;
            if (v < 0 || u + v > 1) continue;
            const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
            if (t > 1e-4 && t < best) {
                best = t;
                at = i;
            }
        }
        if (at < 0) return null;
        const k = at * 9;
        const e1 = {x: list[k + 3] - list[k], y: list[k + 4] - list[k + 1], z: list[k + 5] - list[k + 2]};
        const e2 = {x: list[k + 6] - list[k], y: list[k + 7] - list[k + 1], z: list[k + 8] - list[k + 2]};
        let n = norm({x: e1.y * e2.z - e1.z * e2.y, y: e1.z * e2.x - e1.x * e2.z, z: e1.x * e2.y - e1.y * e2.x});
        // (Facing back toward the ray's origin: the side the thread is on.)
        if (n.x * d.x + n.y * d.y + n.z * d.z > 0) n = {x: -n.x, y: -n.y, z: -n.z};
        return {d: best, x: o.x + d.x * best, y: o.y + d.y * best, z: o.z + d.z * best, nx: n.x, ny: n.y, nz: n.z};
    };
}

// MARK: Drawing

const VERTEX = /* glsl */ `
uniform float uBuilt[${MAX_WEBS}];
uniform float uFade[${MAX_WEBS}];
uniform float uShake[${MAX_WEBS}];
uniform vec3 uShakeDir[${MAX_WEBS}];
uniform float uTime;
uniform vec2 uRes;
uniform float uPx;
uniform vec3 uSun;
attribute vec3 aB;
attribute vec2 aCorner;
attribute float aOrder;
attribute float aSlot;
attribute float aGold;
attribute float aFill;
varying float vFill;
varying float vFade;
varying float vGlint;
varying float vU;
varying float vGold;
void main() {
    int slot = int(aSlot + 0.5);
    float built = 1.0;
    float fade = 0.0;
    float shake = 0.0;
    vec3 shakeDir = vec3(0.0);
    for (int i = 0; i < ${MAX_WEBS}; i++) {
        if (i == slot) { built = uBuilt[i]; fade = uFade[i]; shake = uShake[i]; shakeDir = uShakeDir[i]; }
    }
    // A catch struggling in it: the web trembles along its face (a few millimetres, each thread at its own phase).
    vec3 pa = position + shakeDir * shake * 0.006 * sin(uTime * 38.0 + dot(position, vec3(41.0, 57.0, 73.0)));
    vec3 pb = aB + shakeDir * shake * 0.006 * sin(uTime * 38.0 + dot(aB, vec3(41.0, 57.0, 73.0)));
    vec4 ca = projectionMatrix * viewMatrix * vec4(pa, 1.0);
    vec4 cb = projectionMatrix * viewMatrix * vec4(pb, 1.0);
    vec4 c = mix(ca, cb, aCorner.x);
    if (aOrder > built + 1e-4 || fade <= 0.0 || ca.w <= 0.0 || cb.w <= 0.0) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }
    vec2 sa = ca.xy / ca.w * uRes;
    vec2 sb = cb.xy / cb.w * uRes;
    vec2 dir = sb - sa;
    dir = length(dir) > 1e-5 ? normalize(dir) : vec2(1.0, 0.0);
    c.xy += vec2(-dir.y, dir.x) * aCorner.y * uPx / uRes * c.w;
    gl_Position = c;
    vec3 wp = mix(pa, pb, aCorner.x);
    vec3 v = normalize(cameraPosition - wp);
    vec3 t = normalize(pb - pa + 1e-6);
    // A fibre's highlight: where the sun's half-vector is square to it; and the glow of silk against the sun.
    vec3 h = normalize(uSun + v);
    float th = dot(t, h);
    vGlint = pow(max(1.0 - th * th, 0.0), 120.0) + 0.7 * pow(max(dot(-v, uSun), 0.0), 6.0);
    vFade = fade;
    vU = aCorner.x * length(aB - position);
    vGold = aGold;
    vFill = aFill;
}
`;

const FRAGMENT = /* glsl */ `
uniform float uDay;
uniform float uDew;
uniform vec3 uGlint;
uniform float uDebug;
varying float vFade;
varying float vGlint;
varying float vU;
varying float vGold;
varying float vFill;
void main() {
    if (vFill < 0.0) {
        gl_FragColor = vec4(vec3(0.03, 0.03, 0.025), vFade * -vFill);
        return;
    }
    // Dew: beads along the threads at a still dawn.
    float bead = uDew * smoothstep(0.55, 0.95, sin(vU * 420.0) * 0.5 + 0.5);
    float lit = vGlint * uDay;
    float a = vFade * clamp(0.12 * (0.35 + 0.65 * uDay) + 0.7 * lit + 0.5 * bead, 0.0, 0.9);
    vec3 silk = mix(vec3(0.86, 0.89, 0.9), vec3(0.95, 0.8, 0.35), vGold * 0.8);
    vec3 colour = mix(silk * (0.35 + 0.65 * uDay), uGlint, clamp(lit + bead * 0.6, 0.0, 1.0));
    if (vFill > 0.0) a = vFade * clamp(vFill * (0.45 + 0.55 * uDay) + 0.35 * lit + 0.4 * bead, 0.0, 0.85);
    gl_FragColor = uDebug > 0.5 ? vec4(1.0, 0.1, 0.6, 1.0) : vec4(colour, a);
}
`;

type Spider = {id: string; habit: WebHabit; home: V3; web: FittedWeb | null; tries: number; triedAt: number; job: Generator<void, FittedWeb | null> | null};

/** The record's catch being drawn at a web (`act`), with its frame now. */
type Catching = {frame: CatchFrame; until: number; length: number};

/** Where on a fitted web a catch happens (seeded): a point of its capture area, its hub, its face, the spider's rest. */
export function catchGeometry(web: FittedWeb, seed: string): CatchGeometry {
    const u = unit(`catch:${seed}`);
    const v = unit(`catch-r:${seed}`);
    if (web.habit.kind === "orb") {
        const a = u * Math.PI * 2;
        const r = web.radius * (0.45 + 0.4 * v);
        const at = add(add(web.hub, web.right, Math.cos(a) * r), web.up, Math.sin(a) * r);
        return {hub: web.hub, at, normal: web.normal, rest: {x: 0, y: -1, z: 0}};
    }
    if (web.habit.kind === "tangle") {
        // Hung under its top knot; the insect held lower in the tangle (a gumfoot line takes a walker up: Benjamin & Zschokke 2003).
        const top = web.ends.reduce((best, k) => (k.y > best.y ? k : best), web.ends[0] ?? web.hub);
        const low = web.ends.length ? web.ends[Math.floor(u * web.ends.length) % web.ends.length] : web.hub;
        const at = add(top, sub(low, top), 0.55 + 0.35 * v);
        return {hub: top, at, normal: norm({x: web.normal.x, y: web.normal.y, z: web.normal.z}), rest: {x: Math.cos(u * 6.28), y: 0, z: Math.sin(u * 6.28)}};
    }
    const end = web.ends.length ? web.ends[Math.floor(u * web.ends.length) % web.ends.length] : add(web.hub, web.up, web.radius);
    const at = add(web.hub, sub(end, web.hub), 0.5 + 0.35 * v);
    // A funnel weaver runs out over its sheet, bites and drags its prey back into the funnel unwrapped (Foelix 2011, ch. 5;
    // Agelenidae rarely wrap): no silk bundle.
    return {hub: web.hub, at, normal: {x: 0, y: 1, z: 0}, rest: norm(web.up), wrap: false};
}

export type WebsStats = {spiders: number; fitted: number; drawn: number; threads: number; fitMs: number; fitMaxMs: number};

/** The webs of the scene's web spiders: fitted near the camera, drawn in one call, their spiders' places on them. */
export class SpiderWebs {
    readonly mesh: Mesh;
    private readonly material: ShaderMaterial;
    private readonly spiders = new Map<string, Spider>();
    private slots: Spider[] = [];
    private slotKey = "";
    private fitMs = 0;
    private fitMaxMs = 0;
    private readonly budget = {until: 0};
    private fitting: Spider | null = null;

    private *fitJob(s: Spider): Generator<void, FittedWeb | null> {
        const reach = s.habit.radius * 3 + siteWithin(s.habit) + 1;
        // (Each sliced step run on, pausing when it pauses: no `yield*` at this build's target.)
        const gather = gatherSteps(this.root, s.home, reach, (o) => o === this.mesh, this.budget);
        let gathered = gather.next();
        while (!gathered.done) {
            yield;
            gathered = gather.next();
        }
        // The town's walls, fences and posts as their colliders' boxes: the town lets go of its buildings' vertex copies
        // once they are on the GPU (`islands/town/render/batches.ts`), and the boxes are cut from the same plan.
        const list = withColliders(gathered.value, s.home, reach);
        const build = casterSteps(list, s.home, reach, this.budget);
        let built = build.next();
        while (!built.done) {
            yield;
            built = build.next();
        }
        const fit = fitWebSteps(s.id, s.habit, s.home, this.ground, built.value, this.budget);
        let fitted = fit.next();
        while (!fitted.done) {
            yield;
            fitted = fit.next();
        }
        return fitted.value;
    }
    private lastPick = -Infinity;
    private readonly res = new Vector2(1, 1);
    /** The record's catches being drawn now, by spider (while its act plays). */
    private readonly catching = new Map<string, Catching>();
    private readonly lastRecord = new Map<string, Catching>();
    /** The insects and the silk bundles of the catches (one instanced draw). */
    readonly bugs: InstancedMesh;
    private reduced = false;

    constructor(private readonly root: Object3D, private readonly ground: (x: number, z: number, near?: number) => number) {
        this.material = new ShaderMaterial({
            uniforms: {
                uBuilt: {value: new Array(MAX_WEBS).fill(1)},
                uFade: {value: new Array(MAX_WEBS).fill(0)},
                uShake: {value: new Array(MAX_WEBS).fill(0)},
                uShakeDir: {value: Array.from({length: MAX_WEBS}, () => new Vector3(0, 0, 1))},
                uTime: {value: 0},
                uRes: {value: this.res},
                uPx: {value: 0.6},
                uSun: {value: new Vector3(0, 1, 0)},
                uDay: {value: 1},
                uDew: {value: 0},
                uGlint: {value: new Color("#fff4e0")},
                // (Development: every thread drawn solid magenta, to check where the webs hang.)
                uDebug: {value: 0}
            },
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            transparent: true,
            depthWrite: false,
            // (Every quad is wound the same way round on screen, its side offset turning with the thread: never culled.)
            side: DoubleSide,
            // (One pass: three draws a transparent double-sided material twice, back faces then front, otherwise.)
            forceSinglePass: true
        });
        this.mesh = new Mesh(new BufferGeometry(), this.material);
        this.mesh.name = "spider-webs";
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
        this.mesh.renderOrder = 2;
        this.bugs = new InstancedMesh(new SphereGeometry(0.5, 8, 6), new MeshLambertMaterial({color: 0xffffff, emissive: 0x8a857a}), MAX_BUGS);
        this.bugs.name = "spider-web-catches";
        this.bugs.frustumCulled = false;
        this.bugs.count = 0;
        this.mesh.add(this.bugs);
    }

    /** A spider aboard (its slug and stored scientific name decide whether it spins a web); its home on its island. */
    note(id: string, slug: string, scientificName: string | null | undefined, home: V3): boolean {
        if (this.spiders.has(id)) return true;
        const habit = webHabit(slug, scientificName);
        if (!habit) return false;
        this.spiders.set(id, {id, habit, home, web: null, tries: 0, triedAt: -Infinity, job: null});
        return true;
    }

    forget(id: string): void {
        if (this.fitting?.id === id) this.fitting = null;
        this.spiders.delete(id);
        this.catching.delete(id);
        this.lastRecord.delete(id);
    }

    /**
     * The record's catch at this spider's web (`hunt-acts.ts` runWeb, a meal of the server's): where on its web, or null
     * when its web is not hung (the act is then the generic chase).
     */
    catchGeometry(id: string, seed: string): CatchGeometry | null {
        const web = this.spiders.get(id)?.web;
        return web ? catchGeometry(web, seed) : null;
    }

    /** The record's act this frame (from the act's pose): the web's shake and the bundle, drawn as its act says. */
    act(id: string, frame: CatchFrame, seconds: number, preyLength: number): void {
        const c = {frame, until: seconds + 0.25, length: preyLength};
        this.catching.set(id, c);
        this.lastRecord.set(id, c);
    }

    /** The record's meal going on at its hub after the catch (the meal's script): the bundle stays at its mouth. */
    feeding(id: string, seconds: number): void {
        const last = this.lastRecord.get(id);
        if (!last?.frame.bundle || last.frame.phase === "done") return;
        this.catching.set(id, {...last, frame: {...last.frame, shake: 0, phase: "feed", bundle: {...last.frame.bundle, size: 1}}, until: seconds + 0.25});
    }

    /** Where its spider is drawn now: on its web, once its web is fitted. */
    pose(id: string, hours: number, seconds: number): WebPoint | null {
        const spider = this.spiders.get(id);
        if (!spider?.web) return null;
        const built = webStage(spider.habit, id, hours).built;
        return spiderOnWeb(spider.web, hours, seconds, built);
    }

    /** The fitted web of a spider (the probes and the tests read it). */
    web(id: string): FittedWeb | null {
        return this.spiders.get(id)?.web ?? null;
    }

    /**
     * Each frame: fit the nearest unfitted web within reach (within a time budget), choose the nearest fitted webs, set
     * their stage and fade, and the light: the sun's way, the hour's light, the dew of a still dawn.
     */
    update(camera: V3, hours: number, seconds: number, view: {width: number; height: number; pixelRatio: number}, reducedMotion: boolean): void {
        if (!this.spiders.size) {
            this.mesh.visible = false;
            return;
        }
        const started = performance.now();
        // Fitting: nearest first, within the budget.
        const pending: Array<{s: Spider; d: number}> = [];
        for (const s of Array.from(this.spiders.values())) {
            if (s.web || seconds - s.triedAt < (s.tries < 3 ? 8 : 30)) continue;
            const d = Math.hypot(s.home.x - camera.x, s.home.y - camera.y, s.home.z - camera.z);
            if (d < FIT_WITHIN) pending.push({s, d});
        }
        pending.sort((a, b) => a.d - b.d);
        // One spider's fit at a time (the nearest), a slice a frame: what is drawn round it gathered, its caster built,
        // its web fitted, each pausing once the frame's budget is spent and going on in the next.
        const s = this.fitting ?? pending[0]?.s ?? null;
        if (s) {
            this.fitting = s;
            this.budget.until = started + FIT_BUDGET_MS;
            s.job ??= this.fitJob(s);
            const step = s.job.next();
            if (step.done) {
                s.job = null;
                s.web = step.value;
                s.tries++;
                s.triedAt = seconds;
                this.fitting = null;
            }
        }
        this.fitMs = performance.now() - started;
        this.fitMaxMs = Math.max(this.fitMaxMs, this.fitMs);
        // The nearest fitted webs within reach, re-chosen twice a second.
        if (seconds - this.lastPick > 0.5 || seconds < this.lastPick) {
            this.lastPick = seconds;
            const near: Array<{s: Spider; d: number}> = [];
            for (const s of Array.from(this.spiders.values())) {
                if (!s.web) continue;
                const d = Math.hypot(s.web.hub.x - camera.x, s.web.hub.y - camera.y, s.web.hub.z - camera.z);
                if (d < DRAWN_WITHIN) near.push({s, d});
            }
            near.sort((a, b) => a.d - b.d);
            const chosen = near.slice(0, MAX_WEBS).map((n) => n.s);
            const key = chosen.map((s) => s.id).join(",");
            if (key !== this.slotKey) {
                this.slotKey = key;
                this.slots = chosen;
                this.rebuild();
            }
        }
        if (!this.slots.length) {
            this.mesh.visible = false;
            return;
        }
        const uniforms = this.material.uniforms;
        const built = uniforms.uBuilt.value as number[];
        const fade = uniforms.uFade.value as number[];
        this.slots.forEach((s, i) => {
            const web = s.web!;
            const d = Math.hypot(web.hub.x - camera.x, web.hub.y - camera.y, web.hub.z - camera.z);
            fade[i] = 1 - Math.min(Math.max((d - FADE_FROM) / (DRAWN_WITHIN - FADE_FROM), 0), 1);
            built[i] = reducedMotion ? 1 : webStage(s.habit, s.id, hours).built;
        });
        for (let i = this.slots.length; i < MAX_WEBS; i++) fade[i] = 0;
        this.reduced = reducedMotion;
        this.catches(seconds);
        this.res.set(view.width / 2, view.height / 2);
        uniforms.uPx.value = 0.5 * view.pixelRatio;
        uniforms.uTime.value = seconds % 1000;
        (uniforms.uSun.value as Vector3).copy(ARK_SUN.value);
        uniforms.uDay.value = Math.min(Math.max(ARK_DAYLIGHT.value, 0), 1);
        uniforms.uDew.value = dewOf(hours, ARK_ENV.wind.value, ARK_ENV.rain.value, ARK_ENV.wetness.value);
        (uniforms.uGlint.value as Color).copy(ARK_GLINT.value);
        this.mesh.visible = true;
    }

    /**
     * The catches this frame: only the record's, while its act plays (the owner, 2026-11-23: "no fake events": a web
     * holds an insect only when a real one, an animal aboard, was caught by the engine). Every web stirs a little in the
     * wind; one with a catch struggling in it shakes.
     */
    private catches(seconds: number): void {
        for (const [id, c] of Array.from(this.catching.entries())) if (c.until < seconds) this.catching.delete(id);
        const wind = Math.min(Math.max(ARK_ENV.wind.value, 0), 1) * 0.15;
        const shake = this.material.uniforms.uShake.value as number[];
        const dirs = this.material.uniforms.uShakeDir.value as Vector3[];
        this.slots.forEach((s, i) => {
            const c = this.catching.get(s.id);
            shake[i] = Math.max(c ? c.frame.shake : 0, this.reduced ? 0 : wind);
            dirs[i].set(s.web!.normal.x, s.web!.normal.y, s.web!.normal.z);
        });
        let n = 0;
        const put = (p: V3, sx: number, sy: number, sz: number, yaw: number, colour: number) => {
            if (n >= MAX_BUGS) return;
            Q.setFromAxisAngle(UP, yaw);
            S.set(sx, sy, sz);
            P.set(p.x, p.y, p.z);
            MAT.compose(P, Q, S);
            this.bugs.setMatrixAt(n, MAT);
            this.bugs.setColorAt(n, COL.setHex(colour));
            n++;
        };
        for (const c of Array.from(this.catching.values())) {
            const f = c.frame;
            // (The insect itself is the caught animal, drawn by the scene from its act.) The silk bundle, growing white round it as it is wrapped.
            if (f.bundle && f.bundle.size > 0.02) {
                // A silk-wrapped insect: an elongated, slightly lumpy off-white parcel of the prey's own shape (head, thorax,
                // abdomen under the silk), a little shorter than the prey for its legs and wings folded in (Foelix 2011,
                // ch. 5: the wrapped prey "mummy"). Laid along the spider's way to it, turning as it is wrapped.
                // (Silk reads pale even in the shade: the material's own glow, `emissive`.)
                const L = c.length * 0.8 * f.bundle.size;
                AXIS.set(f.spider.tx, f.spider.ty, f.spider.tz);
                if (AXIS.lengthSq() < 1e-6) AXIS.set(0, -1, 0);
                AXIS.normalize();
                Q.setFromUnitVectors(FWD, AXIS);
                SPIN.setFromAxisAngle(AXIS, f.prey.spin);
                Q.premultiply(SPIN);
                const parts: Array<[number, number, number, number]> = [
                    // [along the axis, width, length, colour]
                    [0, 0.42, 0.62, 0xefe9da],
                    [0.34, 0.33, 0.34, 0xf7f3ea],
                    [-0.33, 0.38, 0.4, 0xe8e1cf]
                ];
                for (const [along, w, l, colour] of parts) {
                    if (n >= MAX_BUGS) break;
                    OFF.copy(FWD).multiplyScalar(along * L).applyQuaternion(Q);
                    P.set(f.bundle.x + OFF.x, f.bundle.y + OFF.y, f.bundle.z + OFF.z);
                    S.set(w * L, w * L * 0.9, l * L);
                    MAT.compose(P, Q, S);
                    this.bugs.setMatrixAt(n, MAT);
                    this.bugs.setColorAt(n, COL.setHex(colour));
                    n++;
                }
            }
        }
        this.bugs.count = n;
        this.bugs.instanceMatrix.needsUpdate = true;
        if (this.bugs.instanceColor) this.bugs.instanceColor.needsUpdate = true;
    }

    private rebuild(): void {
        let threads = 0;
        let fills = 0;
        for (const s of this.slots) {
            threads += s.web!.threads.length;
            fills += s.web!.fill?.length ?? 0;
        }
        const verts = threads * 4 + fills * 3;
        const a = new Float32Array(verts * 3);
        const b = new Float32Array(verts * 3);
        const corner = new Float32Array(verts * 2);
        const order = new Float32Array(verts);
        const slot = new Float32Array(verts);
        const gold = new Float32Array(verts);
        const fillA = new Float32Array(verts);
        const index = new Uint32Array(threads * 6 + fills * 3);
        let v = 0;
        let q = 0;
        this.slots.forEach((s, i) => {
            for (const t of s.web!.threads) {
                for (let c = 0; c < 4; c++) {
                    a.set([t.a.x, t.a.y, t.a.z], (v + c) * 3);
                    b.set([t.b.x, t.b.y, t.b.z], (v + c) * 3);
                    corner[(v + c) * 2] = c < 2 ? 0 : 1;
                    corner[(v + c) * 2 + 1] = c % 2 ? 1 : -1;
                    order[v + c] = t.order;
                    slot[v + c] = i;
                    gold[v + c] = s.web!.gold;
                }
                index.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], q);
                v += 4;
                q += 6;
            }
            // (A fill's corners are its own: both ends the same point, no width; drawn with the threads.)
            for (const f of s.web!.fill ?? []) {
                [f.a, f.b, f.c].forEach((p, c) => {
                    a.set([p.x, p.y, p.z], (v + c) * 3);
                    b.set([p.x, p.y, p.z], (v + c) * 3);
                    slot[v + c] = i;
                    fillA[v + c] = f.alpha;
                });
                index.set([v, v + 1, v + 2], q);
                v += 3;
                q += 3;
            }
        });
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(a, 3));
        geometry.setAttribute("aB", new BufferAttribute(b, 3));
        geometry.setAttribute("aCorner", new BufferAttribute(corner, 2));
        geometry.setAttribute("aOrder", new BufferAttribute(order, 1));
        geometry.setAttribute("aSlot", new BufferAttribute(slot, 1));
        geometry.setAttribute("aGold", new BufferAttribute(gold, 1));
        geometry.setAttribute("aFill", new BufferAttribute(fillA, 1));
        geometry.setIndex(new BufferAttribute(index, 1));
        this.mesh.geometry.dispose();
        this.mesh.geometry = geometry;
    }

    /** Development (the hunt harness): try its web at another home, fitted again from the next frame. */
    rehome(id: string, home: V3): void {
        const s = this.spiders.get(id);
        if (!s) return;
        if (this.fitting?.id === id) this.fitting = null;
        Object.assign(s, {home, web: null, tries: 0, triedAt: -Infinity, job: null});
        this.slots = this.slots.filter((x) => x.id !== id);
    }

    /** Development: what is drawn round a spider's home (the probes read it). */
    explain(id: string): {home: V3; triangles: number; around: Array<{d: number; ny: number; y: number}>; by: Array<[string, number]>; fits: boolean; list: number[]; grounds: number[]; owners: string[]} | null {
        const s = this.spiders.get(id);
        if (!s) return null;
        const reach = s.habit.radius * 3 + siteWithin(s.habit) + 1;
        const tally = new Map<string, number>();
        const owners: string[] = [];
        const drawn = gatherDrawn(this.root, s.home, reach, (o) => o === this.mesh, tally, owners);
        const list = withColliders(drawn, s.home, reach);
        while (owners.length < list.length / 9) owners.push("collider");
        const cast = triangleCaster(list, s.home, reach);
        const g = this.ground(s.home.x, s.home.z, s.home.y + 0.3);
        const around = probeAround(s.home, [Math.max(s.home.y, g) + 0.3, Math.max(s.home.y, g) + 1.2], cast, 4).map((h) => ({d: Math.round(h.d * 100) / 100, ny: Math.round(h.ny * 100) / 100, y: Math.round(h.y * 100) / 100}));
        // (The ground's heights on a 0.25 m grid round its home, for fitting again offline.)
        const grounds: number[] = [];
        for (let i = -40; i <= 40; i++) for (let j = -40; j <= 40; j++) grounds.push(this.ground(s.home.x + i * 0.25, s.home.z + j * 0.25, s.home.y + 0.3));
        return {home: s.home, triangles: list.length / 9, around, by: Array.from(tally.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12), fits: fitWeb(s.id, s.habit, s.home, this.ground, cast) !== null, list: Array.from(list), grounds, owners};
    }

    /** How near the camera may come to look at a drawn web whose silk is round this point (m): else no nearer than usual. */
    closeUp(x: number, y: number, z: number): number {
        for (const s of this.slots) {
            const hub = s.web!.hub;
            if (Math.hypot(hub.x - x, hub.y - y, hub.z - z) < s.web!.radius + 0.6) return 0.25;
        }
        return 4;
    }

    stats(): WebsStats {
        let fitted = 0;
        for (const s of Array.from(this.spiders.values())) if (s.web) fitted++;
        let threads = 0;
        for (const s of this.slots) threads += s.web!.threads.length;
        return {spiders: this.spiders.size, fitted, drawn: this.slots.length, threads, fitMs: this.fitMs, fitMaxMs: this.fitMaxMs};
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        this.material.dispose();
        this.bugs.geometry.dispose();
        (this.bugs.material as Material).dispose();
        this.bugs.dispose();
        this.mesh.removeFromParent();
        this.spiders.clear();
        this.slots = [];
    }
}
