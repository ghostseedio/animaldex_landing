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
import {clipSeat, clipSeatKnown, hullKnown, hullOf, posedHull, type RigPose} from "@/ark-scene/seat/support";

/** What the scene says the animal is doing, for the seat: the first four are seated, the rest left alone. */
export type SeatKind = "stand" | "lie" | "perch" | "cling" | "fly" | "swim" | "hang" | "ride" | "carried" | "den" | "afloat" | "hop" | "act" | "swing" | "grow";

/** Kinds that keep the offset they had (a hop's arc, an entrance): they are back on their feet in a moment. */
const HOLDS: ReadonlySet<SeatKind> = new Set<SeatKind>(["hop", "grow", "act"]);
const SEATED: ReadonlySet<SeatKind> = new Set<SeatKind>(["stand", "lie", "perch", "cling"]);
/** Kinds in the air or the water by their own motion: not seated, but kept out of rock and walls (`clear`). */
const FREE: ReadonlySet<SeatKind> = new Set<SeatKind>(["fly", "swim"]);

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
    /** Pushes tried since it was last free of solids. */
    pushes: number;
    /** The surface under it at the last solve (m), when it is not the ground: the feet's ground there. */
    floor: number | null;
    /**
     * The gap it would have with no offset (m, along the way off its surface), as its lowest over its motion: it
     * follows the body down at once and up only when the body has stayed up (`above`, s), so a stride's or a clip's
     * bounce is not chased. NaN: to take from the next solve.
     */
    env: number;
    above: number;
    /** The pass's clock at its last solve (s), and the scenery's version it was solved against. */
    at: number;
    seen: number;
    /**
     * How long (s) a held animal has had nothing drawn in reach under it: it comes down only once that has lasted (a
     * tree's nearer level, a rock field, may be a moment from being drawn).
     */
    doubt: number;
    /** Held where nothing is drawn (a trunk's side that is not there, a perch over nothing): drawn upright, coming down; and where that was. */
    fell: boolean;
    fellX: number;
    fellZ: number;
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
    /**
     * What is under a point when nothing drawn as a mesh is (m): the drawn ground (where floors are stacked, the one
     * its own motion has it by, not the one by where the pass has moved it: that fed back, a macaw let down a floor
     * at a time to the aquarium's hall under the zoo), or, over water deeper than it wades, its float line.
     */
    ground: (x: number, z: number, near?: number) => number;
    /** Development (the audit's probe): the height its own motion has it at, and so which floor is its. */
    near?: number;
    /**
     * How far its own motion lifts it off what it is on in a stride (m): a moving rig in a clip of its own (a bound's or a
     * gallop's moment in the air); 0 for one whose feet the locomotion layer plants, a still one, a mesh with no rig.
     * Its offset follows a rise within this only once it has lasted.
     */
    bounce?: number;
    /** The chosen animal: worked out now, whatever the budget. */
    focus: boolean;
    /** Development: the level it is drawn at ("near", "far"), for the audit. */
    level?: string;
};

const DEAD = 0.012;
/** How long a held animal has nothing drawn under it before it comes down (s). */
const FALL_AFTER = 0.8;
/** The most an animal is ever moved (m): past it something else is wrong, and it is left where its own motion has it. */
const MOST = 60;
/** How far over a point a rock's top is looked for (m): the biggest boulders. */
const ROCK_REACH = 12;
const EASE = 14;
const EASE_MOVING = 45;
/** The time a frame may spend on solves (ms), and on building grids. */
export const SEAT_BUDGET_MS = 0.6;
const GRID_BUDGET_MS = 0.3;

const MAX_POINTS = 144;
const world = new Float32Array(3 * (MAX_POINTS + 8));
const model = new Float32Array(3 * MAX_POINTS);
const still: RigPose = {bones: 0, live: null, liveRow: -1, baked: null, row0: 0, row1: 0, t: 0, from0: 0, from1: 0, fromT: 0, fromWeight: 0, weight: 1};
const hits: SolidHit[] = [];
const near: Near[] = [];
const order: number[] = [];
const support: number[] = [];
const gaps: number[] = [];
const groundGaps: number[] = [];
const wayPoints: number[] = [];

const over: number[] = [];

/**
 * How high a point under a rock's own top must go to be out: the hits of a cast straight through it, the closed faces
 * over `from` taken upward; a top seen from inside means it is in that rock, and so on up through any rock piled on
 * it, until a face seen from outside (an overhang's underside) or nothing. -Infinity: it is in no rock.
 */
function rockExit(found: SolidHit[], from: number): number {
    over.length = 0;
    for (let i = 0; i < found.length; i++) if (!found[i].double && found[i].cls & (ROCK | HARD) && found[i].y > from) over.push(i);
    over.sort((a, b) => found[a].y - found[b].y);
    let exit = -Infinity;
    for (const i of over) {
        const hit = found[i];
        if (hit.cls !== ROCK || hit.ny <= 0.2) break;
        exit = hit.y;
    }
    return exit;
}

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
    private besidesLeft = 1;
    private overhead = 0;
    private clock = 0;
    private wait = 0;
    private short = false;
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

    /** The frame's start (its own count of frames: the renderer's counts every pass it draws), `dt` seconds after the last. */
    begin(dt = 1 / 60): void {
        const frame = ++this.frame;
        this.clock += Math.min(Math.max(dt, 0), 0.25);
        // (The last frame's budget ran out before everyone due was seated: each waits a frame longer between turns; else less.)
        this.wait = this.short ? Math.min(this.wait + 1, 90) : Math.max(this.wait - 1, 0);
        this.short = false;
        this.spent = 0;
        this.hullsLeft = 1;
        this.pushesLeft = 1;
        this.besidesLeft = 1;
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
    offset(holder: SeatHolder, kind: SeatKind, dt: number, moving = false): SeatState | null {
        const s = holder.seat;
        if (!s || this.off) return null;
        s.kind = kind;
        if (!SEATED.has(kind) && !HOLDS.has(kind)) {
            // Let go: back to where its own motion has it, over half a second (one in the air or the water keeps only what
            // takes it out of a rock: `clear`).
            if (!FREE.has(kind)) s.tx = s.ty = s.tz = 0;
            s.solved = false;
        }
        // (Eased: a still one over a fifth of a second, no pop; one on the move faster, the ground under it changes as it goes.)
        const k = s.solved || !SEATED.has(kind) ? 1 - Math.exp(-Math.min(Math.max(dt, 0), 0.1) * (SEATED.has(kind) ? (moving ? EASE_MOVING : EASE) : 5)) : 1;
        s.x += (s.tx - s.x) * k;
        s.y += (s.ty - s.y) * k;
        s.z += (s.tz - s.z) * k;
        if (Math.abs(s.tx - s.x) < 0.001) s.x = s.tx;
        if (Math.abs(s.ty - s.y) < 0.001) s.y = s.ty;
        if (Math.abs(s.tz - s.z) < 0.001) s.z = s.tz;
        return s.x || s.y || s.z ? s : null;
    }

    /**
     * Whether an animal the scene holds on a surface found nothing drawn there at its last solve: the scene then draws
     * it upright, as one coming down onto what is under it (`kind` "perch", no surface). It is asked again where the
     * scene holds it once it has moved half a metre on.
     */
    fallen(holder: SeatHolder, kind: SeatKind, x: number, z: number): boolean {
        const s = holder.seat;
        if (!s || !s.fell || this.off) return false;
        if ((kind !== "perch" && kind !== "cling") || Math.hypot(x - s.fellX, z - s.fellZ) > 0.5) {
            s.fell = false;
            return false;
        }
        return true;
    }

    /**
     * Whether `settle` has anything to do for this animal this frame (its turn, inside the budget): asked first, so
     * the frames it is not due cost one comparison and make nothing.
     */
    wants(holder: SeatHolder, kind: SeatKind, focus: boolean): boolean {
        if (this.keepPoints) return true;
        if (this.off || (!SEATED.has(kind) && !FREE.has(kind))) return false;
        if (FREE.has(kind)) return this.frame >= (holder.seat?.due ?? 0) && (this.spent < SEAT_BUDGET_MS || this.forced);
        // (Its turn, or the scenery round it has changed since it was seated: a tree's nearer level, a rock field come in.)
        const s = holder.seat;
        if (focus || this.forced || !s) return true;
        if (this.frame < s.due && s.seen === this.solids.version) return false;
        if (this.spent >= SEAT_BUDGET_MS) {
            this.short = true;
            return false;
        }
        return !s.solved || this.frame - s.frame >= this.wait;
    }

    /**
     * After its matrix is final: work out where it rests, if it is its turn. Sets the target its offset eases to.
     */
    settle(input: SeatInput): void {
        const s = (input.holder.seat ??= {x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, due: 0, solved: false, kind: input.kind, gap: 0, low: 0, on: "", inside: 0, frame: -1, pushes: 0, floor: null, env: NaN, above: 0, at: 0, seen: -1, doubt: 0, fell: false, fellX: 0, fellZ: 0});
        s.kind = input.kind;
        if (this.keepPoints) {
            // Development (the audit's probe, `audit-probe.ts`): the animal as drawn this frame.
            const holder = input.holder as SeatHolder & {seatDrawn?: {kind: SeatKind; level: string; m: number[]; geometry: BufferGeometry; pose: RigPose | null; height: number; length: number; surface: SeatInput["surface"]; frame: number; near: number}};
            const drawn = (holder.seatDrawn ??= {kind: input.kind, level: "", m: new Array<number>(16).fill(0), geometry: input.geometry, pose: null, height: 0, length: 0, surface: null, frame: 0, near: 0});
            drawn.kind = input.kind;
            drawn.level = input.pose ? "rig" : input.level ?? "";
            for (let i = 0; i < 16; i++) drawn.m[i] = input.matrix.elements[i];
            drawn.geometry = input.geometry;
            drawn.pose = input.pose ? {...input.pose} : null;
            drawn.height = input.height;
            drawn.length = input.length;
            drawn.surface = input.surface ? {nx: input.surface.nx, ny: input.surface.ny, nz: input.surface.nz, sway: input.surface.sway ? {...input.surface.sway} : undefined} : null;
            drawn.frame = this.frame;
            drawn.near = input.near ?? input.matrix.elements[13];
        }
        if (this.off) return;
        if (FREE.has(input.kind)) {
            if (this.frame >= s.due && (this.spent < SEAT_BUDGET_MS || this.forced)) {
                const started = performance.now();
                this.clear(input, s);
                this.spent += performance.now() - started;
            }
            return;
        }
        if (!SEATED.has(input.kind)) return;
        if (!input.focus && !this.forced) {
            if ((this.frame < s.due && s.seen === this.solids.version) || this.spent >= SEAT_BUDGET_MS) {
                if (this.spent >= SEAT_BUDGET_MS) this.short = true;
                return;
            }
            // (Everyone's turn: when a frame's budget does not reach them all, one seated lately waits for those seated longer ago.)
            if (s.solved && this.frame - s.frame < this.wait) return;
            // (A mesh's hull, a clip's seat: one new one a frame.)
            if (!hullKnown(input.geometry) || (input.pose?.clip && !clipSeatKnown(input.geometry, input.pose.clip.row))) {
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

    /**
     * One flying or swimming: left to its own motion, but not inside a rock or a wall. Its middle in one, it is taken up
     * over it (a flier) or out sideways to the nearest free water (a swimmer; up, with none); out of it, back to its own
     * way.
     */
    private clear(input: SeatInput, s: SeatState): void {
        const e = input.matrix.elements;
        const height = Math.max(input.height, 0.002);
        const length = Math.max(input.length, 0.002);
        // (Its middle: half its height up its own up from where it is drawn.)
        const scale = Math.hypot(e[4], e[5], e[6]) || 1;
        const cx = e[12] + (e[4] / scale) * height * 0.5;
        const cy = e[13] + (e[5] / scale) * height * 0.5;
        const cz = e[14] + (e[6] / scale) * height * 0.5;
        const reach = Math.max(0.5, 1.5 * height);
        const far = Math.max(2 * length, 0.3);
        near.length = 0;
        this.solids.release();
        const whole = this.solids.collect(cx - far, cy - reach, cz - far, cx + far, cy + ROCK_REACH, cz + far, ROCK | HARD, near);
        s.frame = this.frame;
        s.seen = this.solids.version;
        s.due = this.frame + (whole ? 6 + (Math.abs(Math.round(e[12] * 31 + e[14] * 17)) % 6) : 1);
        s.inside = 0;
        if (!whole || !near.length) {
            if (whole) s.tx = s.ty = s.tz = 0;
            return;
        }
        const depth = this.depthAt(cx, cy, cz, reach);
        if (depth <= 0) {
            // Free where it is drawn: and where its own motion has it? Then back to that.
            if ((s.tx || s.ty || s.tz) && this.depthAt(cx - s.x, cy - s.y, cz - s.z, reach) <= 0) s.tx = s.ty = s.tz = 0;
            return;
        }
        s.inside = 1;
        if (input.kind === "swim") {
            const step = Math.max(0.25 * length, 0.04);
            for (let j = 1; j <= 8; j++)
                for (let k = 0; k < 8; k++) {
                    const dx = Math.cos((k * Math.PI) / 4) * step * j;
                    const dz = Math.sin((k * Math.PI) / 4) * step * j;
                    if (this.depthAt(cx + dx, cy, cz + dz, reach) <= 0) {
                        s.tx = s.x + dx;
                        s.tz = s.z + dz;
                        return;
                    }
                }
        }
        s.ty = s.y + depth + 0.5 * height;
        if (Math.hypot(s.tx, s.ty, s.tz) > MOST) s.tx = s.ty = s.tz = 0;
    }

    private solve(input: SeatInput, s: SeatState): boolean {
        const hull = hullOf(input.geometry);
        // A still rig in a clip of its own (a preen, a peck, a hop on the spot): as it is at the clip's own usual frame,
        // so the clip's rise and fall is its motion, not a gap to close; with the vertices lowest in that frame.
        let pose = input.pose;
        let n = 0;
        if (pose && pose.clip && pose.baked) {
            const seat = clipSeat(input.geometry, hull, pose.baked, pose.bones, pose.clip.row, pose.clip.rows);
            still.bones = pose.bones;
            still.baked = pose.baked;
            still.row0 = still.row1 = seat.row;
            pose = still;
            n = posedHull(seat.low, pose, model);
        }
        n += posedHull(hull, pose, n ? model.subarray(n * 3) : model);
        n = Math.min(n, MAX_POINTS);
        const e = input.matrix.elements;
        const sway = input.surface?.sway;
        let cx = 0;
        let cy = 0;
        let cz = 0;
        let x0 = Infinity;
        let y0 = Infinity;
        let z0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        let z1 = -Infinity;
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
            if (wx < x0) x0 = wx;
            if (wy < y0) y0 = wy;
            if (wz < z0) z0 = wz;
            if (wx > x1) x1 = wx;
            if (wy > y1) y1 = wy;
            if (wz > z1) z1 = wz;
        }
        if (!n) return true;
        cx /= n;
        cy /= n;
        cz /= n;
        const height = Math.max(input.height, 0.002);
        const length = Math.max(input.length, 0.002);
        const cling = input.kind === "cling" && input.surface !== null;
        // Held on something: the scene says so, or it is plainly up off the ground (more than its own height: a bird the
        // schedule has in a tree between two of its points, an animal on a log): then anything drawn can be what it is on.
        const held = input.kind === "perch" || input.kind === "cling" || y0 - input.ground(cx, cz, cy) > Math.max(0.25, height);
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
            let clear = true;
            for (const j of support) if (Math.hypot(world[i * 3] - world[j * 3], world[i * 3 + 1] - world[j * 3 + 1], world[i * 3 + 2] - world[j * 3 + 2]) <= apart) clear = false;
            if (clear) support.push(i);
        }
        if (held) {
            // Held on something narrow (a stem, a twig, a leaf's tip), its feet may be wider than it: under its middle
            // too, and a little round it.
            const lift = cx * ax + cy * ay + cz * az - least;
            const mx = cx - ax * lift;
            const my = cy - ay * lift;
            const mz = cz - az * lift;
            const rx = 0.18 * (x1 - x0);
            const ry = 0.18 * (y1 - y0);
            const rz = 0.18 * (z1 - z0);
            for (let k = 0; k < 5; k++) {
                // (Round its middle, in the surface: off along the way from it taken out.)
                let dx = k === 1 ? rx : k === 2 ? -rx : 0;
                let dy = k === 3 && cling ? ry : k === 4 && cling ? -ry : 0;
                let dz = k === 3 && !cling ? rz : k === 4 && !cling ? -rz : 0;
                const off = dx * ax + dy * ay + dz * az;
                dx -= ax * off;
                dy -= ay * off;
                dz -= az * off;
                world[(n + k) * 3] = mx + dx;
                world[(n + k) * 3 + 1] = my + dy;
                world[(n + k) * 3 + 2] = mz + dz;
                support.push(n + k);
            }
        }
        const tiny = length <= 0.08;
        // What can hold it: anything for the smallest and for a small one held up; a big one held up, wood and rock (a
        // leopard on a limb is not on a fern); one on its feet on the ground, only what is closed (a rock, a log, a roof).
        const mask = tiny || (held && length <= 0.6) ? ALL : held ? ROCK | HARD | TREE : ROCK | HARD;
        const up = Math.min(Math.max(0.75 * height, 0.03), 1);
        // Everything drawn near its body, once: its casts are made against these.
        const reachUp = Math.max(0.5, 1.5 * height);
        const pad = cling ? Math.max(0.3, 1.6 * height) + up : Math.max(1.2 * length, 0.2);
        // (Down to the ground under it: what a held animal with nothing under its feet comes down onto.)
        const under = cling ? y0 - pad : Math.min(y0, input.ground(cx, cz, cy)) - 0.3;
        near.length = 0;
        this.solids.release();
        const whole = this.solids.collect(x0 - pad, under, z0 - pad, x1 + pad, y1 + (cling ? Math.max(up, reachUp) : ROCK_REACH), z1 + pad, mask, near);
        gaps.length = 0;
        groundGaps.length = 0;
        let on = "ground";
        let chosen = Infinity;
        let chosenGap = 0;
        for (const i of support) {
            const x = world[i * 3];
            const y = world[i * 3 + 1];
            const z = world[i * 3 + 2];
            let gap: number | null = null;
            let kind = "ground";
            if (cling) {
                const down = Math.max(0.25, 1.5 * height);
                hits.length = 0;
                this.solids.castIn(near, x + ax * up, y + ay * up, z + az * up, -ax * (up + down), -ay * (up + down), -az * (up + down), hits);
                for (const hit of hits) {
                    const facing = hit.nx * ax + hit.ny * ay + hit.nz * az;
                    if ((hit.double ? Math.abs(facing) : facing) < 0.25) continue;
                    const g = hit.t * (up + down) - up;
                    if (gap === null || Math.abs(g) < Math.abs(gap)) {
                        gap = g;
                        kind = hit.kind;
                    }
                }
                // (A steep face of the ground itself: a cliff, a bank.)
                if (gap === null && ay > 0.15) {
                    const g = (y - input.ground(x, z, y)) * ay;
                    if (Math.abs(g) < down) gap = g;
                }
            } else {
                const ground = input.ground(x, z, y);
                groundGaps.push(y - ground);
                // (Held on a rock, it may be in it: a rock's top is looked for as far over it as rocks are high.)
                const top = y + (held ? ROCK_REACH : up);
                const bottom = Math.min(y, ground) - 0.02;
                hits.length = 0;
                if (top > bottom) this.solids.castIn(near, x, top, z, 0, bottom - top, 0, hits);
                // What it cannot be under: the ground, and the top of anything closed (a rock, a roof, a log) within a
                // step's reach over it; a face met from above is the thing's top there, however steep.
                let floor = ground;
                for (const hit of hits) {
                    if (hit.double || hit.ny <= 0 || hit.y > y + up) continue;
                    if (hit.y > floor) {
                        floor = hit.y;
                        kind = hit.kind;
                    }
                }
                if (held) {
                    // (Under a rock's own top it is in the rock: up to that top, and through any rock over that one.)
                    const exit = rockExit(hits, y + up);
                    if (exit > floor) {
                        floor = exit;
                        kind = "rock";
                    }
                }
                let best = floor;
                if (y >= floor - DEAD) {
                    // Over that: the nearest of it and any leaf, limb or flower head between (one over its feet counts less).
                    let score = Math.abs(y - floor);
                    for (const hit of hits) {
                        if (!hit.double || Math.abs(hit.ny) < 0.25 || hit.y < floor || hit.y > y + up) continue;
                        const d = hit.y > y ? (hit.y - y) * 1.5 : y - hit.y;
                        if (d < score) {
                            score = d;
                            best = hit.y;
                            kind = hit.kind;
                        }
                    }
                }
                gap = y - best;
            }
            if (gap === null) continue;
            gaps.push(gap);
            // (Held: the best of its contacts is its seat. On its feet: worked out from them all below; what the nearest is on.)
            if (Math.abs(gap) < chosen) {
                chosen = Math.abs(gap);
                chosenGap = gap;
                on = kind;
            }
        }
        s.frame = this.frame;
        if (this.keepPoints) s.points = support.flatMap((i) => [world[i * 3], world[i * 3 + 1], world[i * 3 + 2]]);
        if (!whole) return false;
        const dt = Math.min(Math.max(this.clock - s.at, 0), 1);
        s.at = this.clock;
        s.seen = this.solids.version;
        if (!gaps.length) {
            // Nothing drawn where the scene holds it (a trunk's side that is not there): once that has lasted, upright and
            // down onto what is under it.
            s.gap = NaN;
            s.on = "none";
            s.doubt += Math.max(dt, 1 / 60);
            if (s.doubt >= FALL_AFTER) {
                s.fell = true;
                s.fellX = e[12] - s.x;
                s.fellZ = e[14] - s.z;
                s.env = NaN;
            }
            s.solved = true;
            s.due = this.frame + 4;
            return true;
        }
        gaps.sort((a, b) => a - b);
        const sink = input.kind === "lie" ? 0.015 : Math.max(0.015, 0.08 * height);
        // (Held: the first of it to touch. On its feet: a quarter of them may be a little in, on uneven ground.)
        let gap = held ? chosenGap : Math.min(gaps[Math.floor(0.25 * (gaps.length - 1))], gaps[0] + sink);
        // Every point of its body against the closed things round it (a rock, a wall, a log), not its lowest alone: its
        // belly over a rock's dome, its flank in a boulder. Each must be over the top it is above (or under: then it is
        // in the thing); the least of those clearances is its seat when it is less than its feet's.
        let moved = false;
        let sideways = false;
        s.inside = 0;
        if (!cling && near.some((it) => it.solid.cls & (ROCK | HARD) && !it.solid.double)) {
            const below = Math.max(gap, 0) + 0.02;
            let closed = Infinity;
            for (let i = 0; i < n; i++) {
                const x = world[i * 3];
                const y = world[i * 3 + 1];
                const z = world[i * 3 + 2];
                if (!this.boxed(x, z)) continue;
                hits.length = 0;
                this.solids.castIn(near, x, y + ROCK_REACH, z, 0, -(ROCK_REACH + below), 0, hits);
                let top = -Infinity;
                let overY = Infinity;
                let overNy = 0;
                let overCls = 0;
                for (const hit of hits) {
                    if (hit.double || !(hit.cls & (ROCK | HARD))) continue;
                    if (hit.y <= y + up) {
                        if (hit.ny > 0 && hit.y > top) top = hit.y;
                    } else if (hit.y < overY) {
                        overY = hit.y;
                        overNy = hit.ny;
                        overCls = hit.cls;
                    }
                }
                let clear = top > -Infinity ? y - top : Infinity;
                // (Under a closed thing's own top: in it. A rock however high, and any rock over that one; a built thing only
                // close over it, with no floor under.)
                if (overNy > 0.2 && overCls === ROCK) clear = y - rockExit(hits, y + up);
                else if (overNy > 0.2 && overY - y <= reachUp && !this.floorUnder(x, y, z, reachUp)) clear = y - overY;
                if (clear < -0.02) s.inside++;
                if (clear < closed) closed = clear;
            }
            if (closed < gap) gap = closed;
            // Its seat is up on something closed (a rock under a foot, a slab through its flank). Held there, or with half
            // its feet carried by it once up, it stands on it. Else the thing is in its way, not under it: a dragon is
            // not balanced on its den's capstone with its body in the air either side; it stays at the ground's height
            // and goes out sideways.
            if (!held && groundGaps.length) {
                groundGaps.sort((a, b) => a - b);
                const onGround = Math.min(groundGaps[Math.floor(0.25 * (groundGaps.length - 1))], groundGaps[0] + sink);
                if (gap < onGround - DEAD && this.carried(-gap, n, height, input.ground) < 0.5) {
                    gap = onGround;
                    on = "ground";
                    sideways = true;
                }
            }
            if (!s.inside && !sideways) s.pushes = 0;
        }
        // Held on something with nothing near under it: a drawn surface beside it first; none, it comes down, once
        // that has lasted (what it is held on may be a moment from being drawn).
        let waiting = false;
        if (held && !cling && gap > Math.max(0.1, height) && this.besidesLeft <= 0 && !this.forced && !input.focus) waiting = true;
        else if (held && !cling && gap > Math.max(0.1, height)) {
            this.besidesLeft--;
            const side = this.beside(cx, least, cz, length, Math.max(0.1, height), length <= 0.6 ? mask : ROCK | HARD, input.ground);
            if (side) {
                s.tx = s.x + side.x;
                s.ty = s.y - side.gap;
                s.tz = s.z + side.z;
                s.env = NaN;
                s.doubt = 0;
                moved = true;
                gap = side.gap;
                on = side.kind;
            } else {
                s.doubt += Math.max(dt, 1 / 60);
                if (s.doubt < FALL_AFTER && s.solved) waiting = true;
                else if (input.surface) {
                    // (Upright as it comes down: not leaning to a leaf that is not there.)
                    s.fell = true;
                    s.fellX = e[12] - s.x;
                    s.fellZ = e[14] - s.z;
                }
            }
        } else s.doubt = 0;
        s.gap = gap;
        s.low = gaps[0];
        s.on = on;
        s.floor = on === "ground" || cling ? null : least - gap;
        const fresh = !s.solved;
        if (!moved && !waiting) {
            // The gap it would have with no offset along its way, at its lowest over its motion (`SeatState.env`).
            const u = gap - (s.x * ax + s.y * ay + s.z * az);
            const band = Math.max(input.bounce ?? 0, 0);
            if (fresh || s.env !== s.env || u <= s.env || band <= 0) {
                s.env = u;
                s.above = 0;
            } else {
                // (Up by more than a stride lifts it: followed at once to within that; within it, only once it has lasted.)
                s.above += dt;
                s.env = Math.min(u, Math.max(s.env + (s.above < 0.25 ? 0.05 : 0.05 + 4 * (s.above - 0.25)) * dt, u - band));
            }
            // Its offset along that way, when where it eases to would leave it more than a centimetre off.
            const along = s.tx * ax + s.ty * ay + s.tz * az;
            const off = s.env + along;
            if (Math.abs(off) > DEAD) {
                s.tx -= ax * off;
                s.ty -= ay * off;
                s.tz -= az * off;
            }
        }
        if (sideways && !moved && s.pushes < 4 && s.x === s.tx && s.y === s.ty && s.z === s.tz && (this.pushesLeft > 0 || this.forced || input.focus)) {
            this.pushesLeft--;
            const out = this.wayOut(n, cx, cy, cz, length, reachUp, input.ground);
            s.pushes++;
            if (out) {
                s.tx = s.x + out.x;
                s.ty = s.y + out.y;
                s.tz = s.z + out.z;
                s.env = NaN;
                moved = true;
            }
        }
        if (Math.hypot(s.tx, s.ty, s.tz) > MOST) s.tx = s.ty = s.tz = 0;
        if (fresh) {
            // Its first time drawn here: there at once, no slide into place.
            s.x = s.tx;
            s.y = s.ty;
            s.z = s.tz;
            s.solved = true;
        }
        const settled = !moved && s.env === s.env && Math.abs(s.env + (s.tx * ax + s.ty * ay + s.tz * az)) <= DEAD && s.x === s.tx && s.y === s.ty && s.z === s.tz;
        s.due = this.frame + (waiting ? 4 : settled ? (input.moving ? 2 : 24 + (Math.abs(Math.round(e[12] * 31 + e[14] * 17)) % 12)) : 1);
        return true;
    }

    /**
     * The drawn surface nearest a held animal with nothing under its feet: straight over or under it, or beside it out
     * to a metre and a half (a leaf, a twig, a rock's top, the ground), by how far it is from where its feet are; and,
     * for one that plants can hold, out to six metres and down to the crowns under it (the schedule has a bird on a
     * limb 19 m up beside a tree drawn 12 m high: it goes onto that tree's crown, not down to the ground). What it is
     * moved onto before it is ever let down to the ground.
     */
    private beside(cx: number, y: number, cz: number, length: number, reach: number, mask: number, ground: (x: number, z: number, near?: number) => number): {x: number; z: number; gap: number; kind: string} | null {
        const wide = (mask & TREE) !== 0;
        const far = wide ? 6 : 1.6;
        const down = wide ? 14 : 1.6;
        const up = 1.6;
        near.length = 0;
        this.solids.release();
        this.solids.collect(cx - far - 0.1, y - down - 0.1, cz - far - 0.1, cx + far + 0.1, y + up + 0.1, cz + far + 0.1, mask, near);
        const found: Array<{x: number; z: number; gap: number; kind: string; d: number}> = [];
        let least = Infinity;
        let last = -1;
        for (const r of [0, Math.min(Math.max(0.25 * length, 0.015), 0.2), Math.min(Math.max(0.5 * length, 0.03), 0.4), Math.min(Math.max(length, 0.06), 0.8), Math.min(Math.max(2 * length, 0.12), 1.2), 1.6, 2.5, 4, 6]) {
            if (r <= last || r > far) continue;
            last = r;
            // (Nothing further out can be nearer than what is found already, a ring to spare for a sliver passed over.)
            if (least + 0.5 * length <= r) break;
            const around = r > 1.6 ? 12 : r ? 8 : 1;
            // (Near it, what is at about its feet's height; further out, the crowns under it too.)
            const below = r > 1.6 ? down : 1.6;
            for (let k = 0; k < around; k++) {
                const dx = Math.cos((k * Math.PI * 2) / around) * r;
                const dz = Math.sin((k * Math.PI * 2) / around) * r;
                hits.length = 0;
                this.solids.castIn(near, cx + dx, y + up, cz + dz, 0, -(up + below), 0, hits);
                for (const hit of hits) {
                    if (hit.double ? Math.abs(hit.ny) < 0.25 : hit.ny <= 0) continue;
                    const d = Math.hypot(r, y - hit.y);
                    found.push({x: dx, z: dz, gap: y - hit.y, kind: hit.kind, d});
                    if (d < least) least = d;
                }
                const g = y - ground(cx + dx, cz + dz, y);
                if (Math.abs(g) <= below) {
                    found.push({x: dx, z: dz, gap: g, kind: "ground", d: Math.hypot(r, g)});
                    if (Math.hypot(r, g) < least) least = Math.hypot(r, g);
                }
            }
        }
        // The nearest that is more than a sliver: with the same surface under two of four points a fifth of its length
        // round it (a leaf's very edge holds one sample and not the next; a twig holds two along it).
        found.sort((a, b) => a.d - b.d);
        const step = Math.max(0.2 * length, 0.004);
        let best: {x: number; z: number; gap: number; kind: string; d: number} | null = null;
        for (let c = 0; c < Math.min(found.length, 6) && !best; c++) {
            const it = found[c];
            // (Within its own reach under it there was nothing: what is found is further, or it would not be asked.)
            if (!it.x && !it.z && Math.abs(it.gap) <= reach) continue;
            if (it.kind === "ground") {
                best = it;
                break;
            }
            let same = 0;
            for (let k = 0; k < 4; k++) {
                hits.length = 0;
                this.solids.castIn(near, cx + it.x + (k === 0 ? step : k === 1 ? -step : 0), y - it.gap + 0.05, cz + it.z + (k === 2 ? step : k === 3 ? -step : 0), 0, -0.1, 0, hits);
                let on = false;
                for (const hit of hits) if (Math.abs(hit.y - (y - it.gap)) < 0.02 + step) on = true;
                if (on) same++;
            }
            if (same >= 2) best = it;
        }
        best ??= found.find((it) => it.x !== 0 || it.z !== 0 || Math.abs(it.gap) > reach) ?? null;
        return best;
    }

    /** Whether a point is over or under the box of something closed near the body (most points are in none). */
    private boxed(x: number, z: number): boolean {
        for (const it of near) {
            if (it.solid.double || !(it.solid.cls & (ROCK | HARD))) continue;
            const b = it.solid.boxes;
            const o = it.o;
            if (x >= b[o] && x <= b[o + 3] && z >= b[o + 2] && z <= b[o + 5]) return true;
        }
        return false;
    }

    /** Whether straight down from a point, within `reach`, the first closed face is a floor or a top it stands over. */
    private floorUnder(x: number, y: number, z: number, reach: number): boolean {
        hits.length = 0;
        this.solids.castIn(near, x, y, z, 0, -reach, 0, hits);
        let first: SolidHit | null = null;
        for (const hit of hits) if (!hit.double && hit.cls & (ROCK | HARD) && (!first || hit.t < first.t)) first = hit;
        return first !== null && first.ny > 0.2;
    }

    /**
     * How deep a point is inside a closed drawn solid (m under its top; 0: not in one). Straight up from it, the first
     * closed face met is one seen from inside: a rock's top however high (a rock is a lump); a built thing's only within
     * `reach` and with no floor or top it stands over under it (a roof drawn as one sheet over a room is seen from
     * behind too, and a ceiling is not a rock).
     */
    private depthAt(x: number, y: number, z: number, reach: number): number {
        if (!this.boxed(x, z)) return 0;
        hits.length = 0;
        this.solids.castIn(near, x, y, z, 0, ROCK_REACH, 0, hits);
        let first: SolidHit | null = null;
        for (const hit of hits) if (!hit.double && (hit.cls === ROCK || (hit.cls === HARD && hit.t * ROCK_REACH <= reach)) && (!first || hit.t < first.t)) first = hit;
        if (first === null || first.ny <= 0.2) return 0;
        const depth = first.t * ROCK_REACH;
        if (first.cls === ROCK) return depth;
        return this.floorUnder(x, y, z, reach) ? 0 : depth;
    }

    /**
     * Of the points it rests on (its lowest, `support`), the share that have a closed thing's top or the ground under
     * them within a fifth of its height once it is `rise` higher: whether what it would be lifted onto carries it.
     */
    private carried(rise: number, n: number, height: number, ground: (x: number, z: number, near?: number) => number): number {
        let all = 0;
        let held = 0;
        for (const i of support) {
            if (i >= n) continue;
            const x = world[i * 3];
            const y = world[i * 3 + 1] + rise;
            const z = world[i * 3 + 2];
            const under = ground(x, z, y);
            let top = under;
            hits.length = 0;
            if (y + 0.02 > under) this.solids.castIn(near, x, y + 0.02, z, 0, under - y - 0.04, 0, hits);
            for (const hit of hits) if (!hit.double && hit.cls & (ROCK | HARD) && hit.ny > 0 && hit.y > top) top = hit.y;
            all++;
            if (y - top <= Math.max(0.03, 0.2 * height)) held++;
        }
        return all ? held / all : 1;
    }

    /**
     * The nearest move sideways that takes the body out of the closed things it is in: a step at a time each way, to
     * the first place where none of its points (its lowest, and a couple of dozen over its hull) is under a closed
     * thing's own top. Null: none within two body lengths (it is left: the audit says so).
     */
    private wayOut(n: number, cx: number, cy: number, cz: number, length: number, reach: number, ground: (x: number, z: number, near?: number) => number): {x: number; y: number; z: number} | null {
        const step = Math.max(0.25 * length, 0.04);
        const here = ground(cx, cz, cy);
        const far = step * 8 + length;
        wayPoints.length = 0;
        for (const i of support) if (i < n) wayPoints.push(i);
        for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 24))) wayPoints.push(i);
        near.length = 0;
        this.solids.release();
        this.solids.collect(cx - far, cy - reach - length, cz - far, cx + far, cy + ROCK_REACH, cz + far, ROCK | HARD, near);
        for (let j = 1; j <= 8; j++) {
            for (let k = 0; k < 8; k++) {
                const dx = Math.cos((k * Math.PI) / 4) * step * j;
                const dz = Math.sin((k * Math.PI) / 4) * step * j;
                const dy = ground(cx + dx, cz + dz, cy) - here;
                let free = this.depthAt(cx + dx, cy + dy, cz + dz, reach) <= 0.02;
                for (let w = 0; free && w < wayPoints.length; w++) {
                    const i = wayPoints[w];
                    if (this.depthAt(world[i * 3] + dx, world[i * 3 + 1] + dy, world[i * 3 + 2] + dz, reach) > 0.02) free = false;
                }
                if (free) return {x: dx, y: dy, z: dz};
            }
        }
        return null;
    }
}

export {TREE, SOFT};
