/**
 * ARK-SEAT: the last word on where a drawn animal is (the owner, 2026-11-21: "bugs are STILL hovering mid air, komodo
 * dragon is still hovering above a rock ... i need guaranteed fixes on animals not properly interacting with their
 * environments from bugs to mammals").
 *
 * Every earlier fix put an animal on one kind of surface by that surface's own rule (the ground, a rock's face, a
 * flower, a limb, an eave), and an animal on a surface or in a state no rule knew was left where its schedule had it.
 * This pass knows no kinds. After everything else has placed and posed an animal, it takes the points its drawn body
 * can rest on (`support.ts`: its mesh's hull as posed, a rig's skinned by the pose drawn this frame), finds what is
 * drawn under them (the scene's ground function and `solids.ts`: every solid mesh in the scene, as placed), and moves
 * the body so it rests there:
 *
 * - standing or walking: its lowest points on the surface (a quarter of them may be a little in, on uneven ground);
 * - lying: its lowest point on the surface, nothing more than 1.5 cm in;
 * - held on something (a branch, a leaf, a roof): on the drawn surface nearest its feet; none in reach, a drawn
 *   surface beside it, else down onto the first thing under it. Never left in the air;
 * - on a trunk, a wall or a rock's face: along the face's normal onto the drawn face;
 * - inside a rock or a wall (its middle, or the inner part of its body): out sideways to the nearest free spot, or up
 *   onto the top.
 * - flying, swimming, hanging, carried, riding, mid-hop, in a den: left alone.
 *
 * The answer is an offset kept on the animal and eased in over a few frames (it always arrives). It is worked out
 * for a few animals a frame, most due first, inside a time budget; the chosen animal at once.
 */

import type {BufferGeometry, Matrix4, Object3D} from "three";
import {ALL, DrawnSolids, HARD, ROCK, SOFT, TREE, type Near, type SolidHit} from "@/ark-scene/seat/solids";
import {hullKnown, hullOf, posedHull, type RigPose} from "@/ark-scene/seat/support";

/** What the scene says the animal is doing, for the seat: the first four are seated, the rest left alone. */
export type SeatKind = "stand" | "lie" | "perch" | "cling" | "fly" | "swim" | "hang" | "ride" | "carried" | "den" | "afloat" | "hop" | "act" | "swing" | "grow";

/** Kinds that keep the offset they had (a hop's arc, an entrance): they are back on their feet in a moment. */
const HOLDS: ReadonlySet<SeatKind> = new Set<SeatKind>(["hop", "grow", "act"]);
const SEATED: ReadonlySet<SeatKind> = new Set<SeatKind>(["stand", "lie", "perch", "cling"]);

export type SeatState = {
    /** The offset drawn now (m), and the one it eases to. */
    x: number;
    y: number;
    z: number;
    tx: number;
    ty: number;
    tz: number;
    /** The frame it is next worked out, and whether it ever was. */
    due: number;
    solved: boolean;
    kind: SeatKind;
    /** The last solve: its seat's gap (m; + over the surface), its lowest point's, what it rests on, how much of it was in a solid. */
    gap: number;
    low: number;
    on: string;
    inside: number;
    frame: number;
    /** Where it was at the last solve (to tell a still one from a mover). */
    px: number;
    py: number;
    pz: number;
    /** Pushes tried since it was last free of solids. */
    pushes: number;
    /** The surface under it at the last solve (m), when it is not the ground: the feet's ground there. */
    floor: number | null;
    /** The gap and the offset at the solve before (a body that does not answer the offset is left: no runaway). */
    wasGap: number;
    wasY: number;
    stuck: number;
    /** Development: the support points of the last solve (world, x y z each). */
    points?: number[];
};

export type SeatHolder = {seat?: SeatState};

export type SeatInput = {
    holder: SeatHolder;
    kind: SeatKind;
    /** The instance as drawn (with the offset on). */
    matrix: Matrix4;
    geometry: BufferGeometry;
    pose: RigPose | null;
    /** Its drawn height and length (m). */
    height: number;
    length: number;
    /** The surface the scene holds it on, if any (its normal), and that surface's sway now. */
    surface: {nx: number; ny: number; nz: number; sway?: {x: number; y: number; z: number}} | null;
    moving: boolean;
    /** The drawn ground under a point (m), near a height where floors are stacked. */
    ground: (x: number, z: number, near?: number) => number;
    /** The chosen animal: worked out now, whatever the budget. */
    focus: boolean;
    /** Development: the level it is drawn at ("near", "far"), for the audit. */
    level?: string;
};

const DEAD = 0.012;
/** How far over a point a rock's top is looked for (m): the biggest boulders. */
const ROCK_REACH = 12;
const EASE = 14;
/** The time a frame may spend on solves (ms), and on building grids. */
export const SEAT_BUDGET_MS = 0.7;
const GRID_BUDGET_MS = 0.35;

const world = new Float32Array(3 * 80);
const model = new Float32Array(3 * 80);
const hits: SolidHit[] = [];
const near: Near[] = [];
const order: number[] = [];
const support: number[] = [];
const gaps: number[] = [];

export class SeatPass {
    readonly solids: DrawnSolids;
    private frame = 0;
    private spent = 0;
    /** Frames begun (development: the audit's clock). */
    get frames(): number {
        return this.frame;
    }
    private hullsLeft = 1;
    private pushesLeft = 1;
    private overhead = 0;
    /** Development: keep each solve's support points. */
    keepPoints = false;
    /** Off (the before pictures, the A/B measure): every offset zero. */
    off = false;
    /** The audit: no budget, nothing waits. */
    set force(on: boolean) {
        this.solids.force = on;
        this.forced = on;
    }
    private forced = false;
    solves = 0;
    ms = 0;

    constructor(scene: Object3D) {
        this.solids = new DrawnSolids(scene);
    }

    /** The frame's start (its own count of frames: the renderer's counts every pass it draws). */
    begin(): void {
        const frame = ++this.frame;
        this.spent = 0;
        this.hullsLeft = 1;
        this.pushesLeft = 1;
        this.overhead = 0;
        if (this.off) return;
        const started = performance.now();
        this.solids.begin(frame);
        this.solids.step(GRID_BUDGET_MS);
        this.overhead = performance.now() - started;
    }

    /** The frame's time in the pass so far (ms): its solves, and reading the scene's meshes. */
    get frameMs(): number {
        return this.spent + this.overhead;
    }

    /**
     * The offset to draw an animal with this frame (eased toward its target), before its matrix is composed. Null:
     * none.
     */
    offset(holder: SeatHolder, kind: SeatKind, dt: number): SeatState | null {
        const s = holder.seat;
        if (!s || this.off) return null;
        s.kind = kind;
        if (!SEATED.has(kind) && !HOLDS.has(kind)) {
            // Let go: back to where its own motion has it, over half a second.
            s.tx = s.ty = s.tz = 0;
            s.solved = false;
        }
        const k = s.solved || !SEATED.has(kind) ? 1 - Math.exp(-Math.min(Math.max(dt, 0), 0.1) * (SEATED.has(kind) ? EASE : 5)) : 1;
        s.x += (s.tx - s.x) * k;
        s.y += (s.ty - s.y) * k;
        s.z += (s.tz - s.z) * k;
        if (Math.abs(s.tx - s.x) < 0.001) s.x = s.tx;
        if (Math.abs(s.ty - s.y) < 0.001) s.y = s.ty;
        if (Math.abs(s.tz - s.z) < 0.001) s.z = s.tz;
        return s.x || s.y || s.z ? s : null;
    }

    /**
     * Whether `settle` has anything to do for this animal this frame (its turn, inside the budget): asked first, so
     * the frames it is not due cost one comparison and make nothing.
     */
    wants(holder: SeatHolder, kind: SeatKind, focus: boolean): boolean {
        if (this.keepPoints) return true;
        if (this.off || !SEATED.has(kind)) return false;
        return focus || this.forced || (this.frame >= (holder.seat?.due ?? 0) && this.spent < SEAT_BUDGET_MS);
    }

    /**
     * After its matrix is final: work out where it rests, if it is its turn. Sets the target its offset eases to.
     */
    settle(input: SeatInput): void {
        const s = (input.holder.seat ??= {x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, due: 0, solved: false, kind: input.kind, gap: 0, low: 0, on: "", inside: 0, frame: -1, px: NaN, py: NaN, pz: NaN, pushes: 0, floor: null, wasGap: NaN, wasY: 0, stuck: 0});
        s.kind = input.kind;
        if (this.keepPoints) {
            // Development (the audit's probe, `audit-probe.ts`): the animal as drawn this frame.
            const holder = input.holder as SeatHolder & {seatDrawn?: {kind: SeatKind; level: string; m: number[]; geometry: BufferGeometry; pose: RigPose | null; height: number; length: number; surface: SeatInput["surface"]; frame: number}};
            const drawn = (holder.seatDrawn ??= {kind: input.kind, level: "", m: new Array<number>(16).fill(0), geometry: input.geometry, pose: null, height: 0, length: 0, surface: null, frame: 0});
            drawn.kind = input.kind;
            drawn.level = input.pose ? "rig" : input.level ?? "";
            for (let i = 0; i < 16; i++) drawn.m[i] = input.matrix.elements[i];
            drawn.geometry = input.geometry;
            drawn.pose = input.pose ? {...input.pose} : null;
            drawn.height = input.height;
            drawn.length = input.length;
            drawn.surface = input.surface ? {nx: input.surface.nx, ny: input.surface.ny, nz: input.surface.nz, sway: input.surface.sway ? {...input.surface.sway} : undefined} : null;
            drawn.frame = this.frame;
        }
        if (this.off || !SEATED.has(input.kind)) return;
        if (!input.focus && !this.forced) {
            if (this.frame < s.due || this.spent >= SEAT_BUDGET_MS) return;
            if (!hullKnown(input.geometry)) {
                if (this.hullsLeft <= 0) return;
                this.hullsLeft--;
            }
        }
        const started = performance.now();
        const whole = this.solve(input, s);
        const took = performance.now() - started;
        this.spent += took;
        this.ms += took;
        this.solves++;
        // (A mesh it stands by still being read: again next frame, keeping what it had.)
        if (!whole) s.due = this.frame + 1;
    }

    private solve(input: SeatInput, s: SeatState): boolean {
        const hull = hullOf(input.geometry);
        const n = Math.min(posedHull(hull, input.pose, model), 80);
        const e = input.matrix.elements;
        const sway = input.surface?.sway;
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (let i = 0; i < n; i++) {
            const x = model[i * 3];
            const y = model[i * 3 + 1];
            const z = model[i * 3 + 2];
            // (Where the scenery is read: without its tree's sway, which the drawn tree and the animal share.)
            const wx = (world[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12] - (sway?.x ?? 0));
            const wy = (world[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13] - (sway?.y ?? 0));
            const wz = (world[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14] - (sway?.z ?? 0));
            cx += wx;
            cy += wy;
            cz += wz;
        }
        if (!n) return true;
        cx /= n;
        cy /= n;
        cz /= n;
        const height = Math.max(input.height, 0.002);
        const length = Math.max(input.length, 0.002);
        const cling = input.kind === "cling" && input.surface !== null;
        // The way off the surface: up, or the face's normal on a trunk, a wall, a rock's face.
        let ax = 0;
        let ay = 1;
        let az = 0;
        if (cling && input.surface) {
            const l = Math.hypot(input.surface.nx, input.surface.ny, input.surface.nz) || 1;
            ax = input.surface.nx / l;
            ay = input.surface.ny / l;
            az = input.surface.nz / l;
        }
        // The points it rests on: the lowest along that way, a few, apart.
        let least = Infinity;
        for (let i = 0; i < n; i++) least = Math.min(least, world[i * 3] * ax + world[i * 3 + 1] * ay + world[i * 3 + 2] * az);
        const band = Math.max(0.004, 0.05 * height);
        order.length = 0;
        for (let i = 0; i < n; i++) if (world[i * 3] * ax + world[i * 3 + 1] * ay + world[i * 3 + 2] * az <= least + band) order.push(i);
        order.sort((a, b) => world[a * 3] * ax + world[a * 3 + 1] * ay + world[a * 3 + 2] * az - (world[b * 3] * ax + world[b * 3 + 1] * ay + world[b * 3 + 2] * az));
        const apart = 0.12 * length;
        support.length = 0;
        for (const i of order) {
            if (support.length >= 6) break;
            if (support.every((j) => Math.hypot(world[i * 3] - world[j * 3], world[i * 3 + 1] - world[j * 3 + 1], world[i * 3 + 2] - world[j * 3 + 2]) > apart)) support.push(i);
        }
        const held = input.kind === "perch" || input.kind === "cling";
        if (held && n < 80) {
            // Held on something narrow (a stem, a twig, a leaf's tip), its feet may be wider than it: under its middle too.
            const lift = cx * ax + cy * ay + cz * az - least;
            world[n * 3] = cx - ax * lift;
            world[n * 3 + 1] = cy - ay * lift;
            world[n * 3 + 2] = cz - az * lift;
            support.unshift(n);
        }
        const tiny = length <= 0.08;
        const mask = held || tiny ? ALL : ROCK | HARD;
        const up = Math.min(Math.max(0.75 * height, 0.03), 1);
        // Everything drawn near its body, once: its casts are made against these.
        let x0 = Infinity;
        let y0 = Infinity;
        let z0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        let z1 = -Infinity;
        for (let i = 0; i < n; i++) {
            x0 = Math.min(x0, world[i * 3]);
            y0 = Math.min(y0, world[i * 3 + 1]);
            z0 = Math.min(z0, world[i * 3 + 2]);
            x1 = Math.max(x1, world[i * 3]);
            y1 = Math.max(y1, world[i * 3 + 1]);
            z1 = Math.max(z1, world[i * 3 + 2]);
        }
        const reachUp = Math.max(0.5, 1.5 * height);
        const pad = cling ? Math.max(0.3, 1.6 * height) + up : Math.max(1.2 * length, 0.2);
        // (Down to the ground under it: what a held animal with nothing under its feet comes down onto.)
        const under = cling ? y0 - pad : Math.min(y0, input.ground(cx, cz, cy)) - 0.3;
        near.length = 0;
        this.solids.release();
        let whole = this.solids.collect(x0 - pad, under, z0 - pad, x1 + pad, y1 + (cling ? Math.max(up, reachUp) : ROCK_REACH), z1 + pad, held || tiny ? ALL : ROCK | HARD, near);
        gaps.length = 0;
        let on = "ground";
        let nearest = Infinity;
        for (const i of support) {
            const x = world[i * 3];
            const y = world[i * 3 + 1];
            const z = world[i * 3 + 2];
            if (cling) {
                const down = Math.max(0.25, 1.5 * height);
                hits.length = 0;
                this.solids.castIn(near, x + ax * up, y + ay * up, z + az * up, -ax * (up + down), -ay * (up + down), -az * (up + down), hits);
                let best: number | null = null;
                for (const hit of hits) {
                    const facing = hit.nx * ax + hit.ny * ay + hit.nz * az;
                    if ((hit.double ? Math.abs(facing) : facing) < 0.25) continue;
                    const gap = hit.t * (up + down) - up;
                    if (best === null || Math.abs(gap) < Math.abs(best)) {
                        best = gap;
                        if (Math.abs(gap) < nearest) {
                            nearest = Math.abs(gap);
                            on = hit.kind;
                        }
                    }
                }
                // (A steep face of the ground itself: a cliff, a bank.)
                if (best === null && ay > 0.15) {
                    const g = (y - input.ground(x, z, y)) * ay;
                    if (Math.abs(g) < down) best = g;
                }
                if (best !== null) gaps.push(best);
                continue;
            }
            const ground = input.ground(x, z, y);
            const top = y + up;
            const bottom = Math.min(y, ground) - 0.02;
            hits.length = 0;
            if (top > bottom) this.solids.castIn(near, x, top, z, 0, bottom - top, 0, hits);
            // What it cannot be under: the ground, and the top of anything closed (a rock, a roof, a log).
            let floor = ground;
            let floorKind = "ground";
            for (const hit of hits) {
                if (hit.double || hit.ny < 0.25) continue;
                if (hit.y > floor) {
                    floor = hit.y;
                    floorKind = hit.kind;
                }
            }
            let best = floor;
            let bestKind = floorKind;
            if (y >= floor - DEAD) {
                // Over that: the nearest of it and any leaf, limb or flower head between (one over its feet counts less).
                let score = Math.abs(y - floor);
                for (const hit of hits) {
                    if (!hit.double || Math.abs(hit.ny) < 0.25 || hit.y < floor) continue;
                    const d = hit.y > y ? (hit.y - y) * 1.5 : y - hit.y;
                    if (d < score) {
                        score = d;
                        best = hit.y;
                        bestKind = hit.kind;
                    }
                }
            }
            const gap = y - best;
            gaps.push(gap);
            if (Math.abs(gap) < nearest) {
                nearest = Math.abs(gap);
                on = bestKind;
            }
        }
        s.frame = this.frame;
        s.px = e[12];
        s.py = e[13];
        s.pz = e[14];
        if (this.keepPoints) s.points = support.flatMap((i) => [world[i * 3], world[i * 3 + 1], world[i * 3 + 2]]);
        if (!whole) return false;
        if (!gaps.length) {
            // Nothing drawn where the scene holds it (a trunk's side that is not there): onto what is under it.
            s.gap = NaN;
            s.on = "none";
            s.due = this.frame + 30;
            s.solved = true;
            return true;
        }
        gaps.sort((a, b) => a - b);
        const sink = input.kind === "lie" ? 0.015 : Math.max(0.015, 0.08 * height);
        // (Held: the first of it to touch. On its feet: a quarter of them may be a little in, on uneven ground.)
        let gap = held ? gaps[0] : Math.min(gaps[Math.floor(0.25 * (gaps.length - 1))], gaps[0] + sink);
        // Held on something with nothing near under it: a drawn surface beside it first.
        let sideX = 0;
        let sideZ = 0;
        if (input.kind === "perch" && gap > Math.max(0.1, height)) {
            const side = this.beside(cx, least, cz, length, Math.max(0.1, height), mask, input.ground);
            if (side) {
                sideX = side.x;
                sideZ = side.z;
                gap = side.gap;
                on = side.kind;
            }
        }
        s.gap = gap;
        s.low = gaps[0];
        s.on = on;
        s.floor = on === "ground" || cling ? null : least - gap;
        const fresh = !s.solved;
        // A body that does not answer (its feet put back where they were whatever its height): left, never chased.
        if (!fresh && Math.abs(s.y - s.wasY) > 0.02 && Math.abs(gap - s.wasGap) < 0.3 * Math.abs(s.y - s.wasY) && Math.abs(gap) > DEAD) s.stuck++;
        else if (Math.abs(gap) <= DEAD) s.stuck = 0;
        s.wasGap = gap;
        s.wasY = s.y;
        if (s.stuck >= 3) {
            s.tx = s.x;
            s.ty = s.y;
            s.tz = s.z;
        } else if (Math.abs(gap) > DEAD || sideX || sideZ) {
            s.tx = s.x + sideX - ax * gap;
            s.ty = s.y - ay * gap;
            s.tz = s.z + sideZ - az * gap;
        }
        // Inside a rock or a wall: out of it.
        s.inside = 0;
        if (!cling && (input.kind === "stand" || input.kind === "lie") && Math.abs(gap) <= Math.max(DEAD, 0.25 * height)) {
            const reach = reachUp;
            const inside = near.some((it) => it.solid.cls & (ROCK | HARD)) ? this.insideCount(n, cx, cy, cz, 0, 0, 0, reach) : 0;
            s.inside = inside;
            if (inside > 0 && s.pushes < 4 && (this.pushesLeft > 0 || this.forced || input.focus)) {
                this.pushesLeft--;
                const out = this.wayOut(n, cx, cy, cz, length, reach, input.ground);
                s.pushes++;
                if (out) {
                    s.tx = s.x + out.x;
                    s.tz = s.z + out.z;
                    s.ty = s.y + out.y;
                }
            } else if (!inside) s.pushes = 0;
        }
        if (fresh) {
            // Its first time drawn here: there at once, no slide into place.
            s.x = s.tx;
            s.y = s.ty;
            s.z = s.tz;
            s.solved = true;
        }
        const settled = Math.abs(gap) <= DEAD && (!s.inside || s.pushes >= 4) && s.x === s.tx && s.y === s.ty && s.z === s.tz;
        s.due = this.frame + (settled ? (input.moving ? 3 : 24 + (Math.abs(Math.round(e[12] * 31 + e[14] * 17)) % 12)) : 1);
        return true;
    }

    /** A drawn surface beside a held animal within its reach, at about its feet's height: the nearest. */
    private beside(cx: number, y: number, cz: number, length: number, reach: number, mask: number, ground: (x: number, z: number, near?: number) => number): {x: number; z: number; gap: number; kind: string} | null {
        near.length = 0;
        this.solids.release();
        this.solids.collect(cx - 1.3, y - reach, cz - 1.3, cx + 1.3, y + reach, cz + 1.3, mask, near);
        for (const r of [Math.min(Math.max(0.25 * length, 0.015), 0.2), Math.min(Math.max(0.5 * length, 0.03), 0.4), Math.min(Math.max(length, 0.06), 0.8), Math.min(Math.max(2 * length, 0.12), 1.2)]) {
            let best: {x: number; z: number; gap: number; kind: string} | null = null;
            for (let k = 0; k < 8; k++) {
                const dx = Math.cos((k * Math.PI) / 4) * r;
                const dz = Math.sin((k * Math.PI) / 4) * r;
                hits.length = 0;
                this.solids.castIn(near, cx + dx, y + reach, cz + dz, 0, -2 * reach, 0, hits);
                for (const hit of hits) {
                    if ((hit.double ? Math.abs(hit.ny) : hit.ny) < 0.25) continue;
                    const gap = y - hit.y;
                    if (!best || Math.abs(gap) < Math.abs(best.gap)) best = {x: dx, z: dz, gap, kind: hit.kind};
                }
                const g = y - ground(cx + dx, cz + dz, y);
                if (Math.abs(g) <= reach && (!best || Math.abs(g) < Math.abs(best.gap))) best = {x: dx, z: dz, gap: g, kind: "ground"};
            }
            if (best) return best;
        }
        return null;
    }

    /**
     * Whether a point is inside a closed drawn solid: straight up from it (to `reach`: a ceiling is not a rock), the
     * first face met is one seen from inside, and straight down there is no floor or top it stands over first (a roof
     * drawn as one sheet over a room is seen from behind too).
     */
    private insidePoint(x: number, y: number, z: number, reach: number): boolean {
        hits.length = 0;
        this.solids.castIn(near, x, y, z, 0, ROCK_REACH, 0, hits);
        let first: SolidHit | null = null;
        for (const hit of hits) if (!hit.double && (hit.cls === ROCK || (hit.cls === HARD && hit.t * ROCK_REACH <= reach)) && (!first || hit.t < first.t)) first = hit;
        if (first === null || first.ny <= 0.2) return false;
        // (A rock is a lump: under its top is in it. Anything built may be a sheet over a room: only with no floor under.)
        if (first.cls === ROCK) return true;
        hits.length = 0;
        this.solids.castIn(near, x, y, z, 0, -reach, 0, hits);
        first = null;
        for (const hit of hits) if (!hit.double && hit.cls & (ROCK | HARD) && (!first || hit.t < first.t)) first = hit;
        return first === null || first.ny <= 0.2;
    }

    /**
     * How many of the body's inner points (its middle, and every point of its hull drawn in by a quarter: a foot on a
     * rock or a flank against one is not in it) are inside a solid, the body moved by (dx, dy, dz).
     */
    private insideCount(n: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, reach: number): number {
        let count = this.insidePoint(cx + dx, cy + dy, cz + dz, reach) ? 1 : 0;
        for (let i = 0; i < n; i++) {
            const x = cx + (world[i * 3] - cx) * 0.75;
            const y = cy + (world[i * 3 + 1] - cy) * 0.75;
            const z = cz + (world[i * 3 + 2] - cz) * 0.75;
            if (this.insidePoint(x + dx, y + dy, z + dz, reach)) count++;
        }
        return count;
    }

    /** The nearest move that takes the body out of the solids it is in: sideways, a step at a time each way; else up onto the top. */
    private wayOut(n: number, cx: number, cy: number, cz: number, length: number, reach: number, ground: (x: number, z: number, near?: number) => number): {x: number; y: number; z: number} | null {
        const step = Math.max(0.25 * length, 0.04);
        const here = ground(cx, cz, cy);
        const far = step * 8 + length;
        near.length = 0;
        this.solids.release();
        this.solids.collect(cx - far, cy - reach - length, cz - far, cx + far, cy + ROCK_REACH, cz + far, ROCK | HARD, near);
        for (let j = 1; j <= 8; j++) {
            for (let k = 0; k < 8; k++) {
                const dx = Math.cos((k * Math.PI) / 4) * step * j;
                const dz = Math.sin((k * Math.PI) / 4) * step * j;
                const dy = ground(cx + dx, cz + dz, cy) - here;
                if (this.insideCount(n, cx, cy, cz, dx, dy, dz, reach) === 0) return {x: dx, y: dy, z: dz};
            }
        }
        // Up onto it: the highest top over its middle.
        hits.length = 0;
        this.solids.cast(cx, cy + ROCK_REACH, cz, 0, -ROCK_REACH, 0, ROCK | HARD, hits);
        let top = -Infinity;
        for (const hit of hits) if (!hit.double && hit.ny > 0.25) top = Math.max(top, hit.y);
        if (top === -Infinity) return null;
        let low = Infinity;
        for (let i = 0; i < n; i++) low = Math.min(low, world[i * 3 + 1]);
        return {x: 0, y: top - low, z: 0};
    }
}

export {TREE, SOFT};
