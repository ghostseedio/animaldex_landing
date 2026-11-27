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
import {feetOf, hullKnown, hullOf, lyingPoints, posedHull, soleLevel, type RigPose} from "@/ark-scene/seat/support";
import {holdTreeDetail, releaseTreeDetail} from "@/ark-scene/tree-detail";

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
    /** At rest on its seat at its last solve (not on the move, nothing left to close): its turn can wait longest. */
    calm: boolean;
    /** The pass's clock at its last solve (s), and the scenery's version it was solved against. */
    at: number;
    seen: number;
    /**
     * How long (s) a held animal has had nothing drawn in reach under it: it comes down only once that has lasted (a
     * tree's nearer level, a rock field, may be a moment from being drawn).
     */
    doubt: number;
    /** Where its own motion had it when its offset was last put on (`offset`), and at its last solve: what it has moved by since. */
    ox: number;
    oy: number;
    oz: number;
    sx: number;
    sz: number;
    /** Moved on with a big offset since its last solve: solved now, whatever the budget. */
    urgent: boolean;
    /** Its body did not answer its offset (something else holds it where it is): until when it is left alone, and how often it has been. */
    mute: number;
    mutes: number;
    /** (The lowest of its body along its way off its surface, and its offset, when it was last looked at this way.) */
    wasGap: number;
    wasOff: number;
    wasOwnY: number;
    /** What a still one's last solve wanted of its offset and did not yet take (it takes what two solves agree on). */
    lean: number;
    /** Frames since its own motion last moved it over the ground (a walk the schedule does not call moving: an act's). */
    idle: number;
    /** What keeps its feet level through a clip of its own (m, `clipLift`): drawn now, and the feet's level it is taken from. */
    lift: number;
    liftFrom: number;
    /** How far its search for a way out of rock has got (the place it takes it up from at its next turn). */
    ring: number;
    /** Moves onto a surface beside it in a row that left it no nearer one. */
    sides: number;
    /** Where its own motion had it when it was last moved beside (NaN: never): moved on from there, it may be moved again. */
    bx: number;
    by: number;
    bz: number;
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
    /** A rig's grip bones (its feet, hands, paws, claws: `map/grip.ts`): the vertices they carry are its feet. */
    grips?: ArrayLike<{bone: number}> | null;
    /** In a clip that leaves the ground by its nature (a hop, a bound, a pounce): the audit lets its feet be off it. */
    leaping?: boolean;
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
/**
 * ARK-VANISH (the owner, 2026-11-23: "when i zoom in, animals seem to disappear"): a held animal (on a limb, a frond,
 * a rock's face) with nothing found under its feet is moved onto a surface beside it only this near (m, or 1.5 of its
 * length); further, it stays where its own motion has it, and it never falls. The seat runs only once an animal is
 * drawn near, so a parrot on its limb, a fairy-bluebird on a palm frond, a pipit on a rock's face were carried 5 to 12 m
 * off (the ground, a shrub) the moment the camera came close: gone from where the viewer was looking.
 */
const BESIDE_MOST = 0.5;
/** ARK-VANISH: `false` (development: `__arkSeatFar = true`) brings back the far move and the fall, to compare. */
const nearOnly = () => (globalThis as {__arkSeatFar?: boolean}).__arkSeatFar !== true;
/** ARK-VANISH: held on a surface the scene gave it (a limb, a leaf, a face); one it only calls standing, up in the air, still comes down. */
const onSurface = (kind: SeatKind) => kind === "perch" || kind === "cling";
/** How far over a point a rock's top is looked for (m): the biggest boulders. */
const ROCK_REACH = 12;
const EASE = 14;
const EASE_MOVING = 45;
/** The time a frame may spend on solves (ms), and on building grids. */
export const SEAT_BUDGET_MS = 0.6;
const GRID_BUDGET_MS = 0.3;

const MAX_POINTS = 240;
const world = new Float32Array(3 * (MAX_POINTS + 8));
const model = new Float32Array(3 * MAX_POINTS);
const hits: SolidHit[] = [];
const near: Near[] = [];
/** Of `near`, the closed ones (rock, and built things drawn one-sided): what a body can be inside, or over. */
const hard: Near[] = [];
function closedOf(): void {
    hard.length = 0;
    for (const it of near) if (!it.solid.double && it.solid.cls & (ROCK | HARD)) hard.push(it);
}
const order: number[] = [];
const support: number[] = [];
const gaps: number[] = [];
const groundGaps: number[] = [];
const wayPoints: number[] = [];
const stoneOrder: number[] = [];

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
        releaseTreeDetail(frame);
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
    offset(holder: SeatHolder, kind: SeatKind, dt: number, moving = false, ownX = NaN, ownY = NaN, ownZ = NaN): SeatState | null {
        const s = holder.seat;
        if (!s || this.off) return null;
        const seated = SEATED.has(kind);
        // (Off its perch and onto its feet, down to lie: what held its offset no longer does. Solved now.)
        if (seated && s.kind !== kind && SEATED.has(s.kind) && (s.tx !== 0 || s.ty !== 0 || s.tz !== 0)) s.urgent = true;
        s.kind = kind;
        if (!seated && !HOLDS.has(kind)) {
            // Let go: back to where its own motion has it, over half a second (one in the air or the water keeps only what
            // takes it out of a rock: `clear`).
            if (!FREE.has(kind)) s.tx = s.ty = s.tz = 0;
            s.solved = false;
        }
        if (seated && s.solved && ownY === ownY && s.oy === s.oy) {
            // Where its own motion has it has gone straight up or down since the last frame (a bird the schedule has
            // drifting in the air, brought down to the ground; a clip's rise the scene put on its body): its seat stays
            // where it is, not a frame or a turn behind.
            const dy = ownY - s.oy;
            if (Math.hypot(ownX - s.ox, dy, ownZ - s.oz) > Math.max(0.5, 40 * Math.min(Math.max(dt, 1 / 60), 0.1))) {
                // (Not a move: its own motion has it somewhere else, off its limb and down on the ground, a new trip's
                // start. What seated it there seats nothing here: from none, and seated at once at its next solve.)
                s.x = s.y = s.z = s.tx = s.ty = s.tz = 0;
                s.solved = false;
                s.env = NaN;
                s.lean = 0;
                s.sides = 0;
                s.doubt = 0;
                s.fell = false;
                s.urgent = true;
            } else if (dy !== 0 && Math.abs(s.ty) > 1 && Math.hypot(ownX - s.ox, ownZ - s.oz) <= 0.25 * Math.abs(dy)) {
                // (Only one brought a long way down or up from where its own motion has it: on the ground an act's walk
                // moves its height each frame and its place twice a second, and a tapir was held 30 cm under a rising bank.)
                s.y -= dy;
                s.ty -= dy;
            }
            s.idle = Math.hypot(ownX - s.ox, ownZ - s.oz) > 0.0005 ? 0 : Math.min(s.idle + 1, 99);
            // (Walked on with a big offset: what was under it is not what is under it now.)
            if (Math.hypot(s.tx, s.ty, s.tz) > 0.5 && Math.hypot(ownX - s.sx, ownZ - s.sz) > 0.5) s.urgent = true;
        }
        s.ox = seated ? ownX : NaN;
        s.oy = seated ? ownY : NaN;
        s.oz = seated ? ownZ : NaN;
        // (Eased: a still one over a fifth of a second, no pop; one on the move faster, the ground under it changes as it goes.)
        const k = s.solved || !seated ? 1 - Math.exp(-Math.min(Math.max(dt, 0), 0.1) * (seated ? (moving || s.idle < 6 ? EASE_MOVING : EASE) : 5)) : 1;
        s.x += (s.tx - s.x) * k;
        s.y += (s.ty - s.y) * k;
        s.z += (s.tz - s.z) * k;
        if (Math.abs(s.tx - s.x) < 0.001) s.x = s.tx;
        if (Math.abs(s.ty - s.y) < 0.001) s.y = s.ty;
        if (Math.abs(s.tz - s.z) < 0.001) s.z = s.tz;
        return s.x || s.y || s.z ? s : null;
    }

    /**
     * A still rig in a clip of its own (a walk on the spot, a preen, a scan): what to raise it by this frame so the
     * lowest of its feet stays level through the clip (m; the clip's own rise and fall of its soles, taken off). The
     * clip's row now, or -1 when it is not in one (moving, in a gait, fading between two): then it eases back to none.
     */
    clipLift(holder: SeatHolder, kind: SeatKind, geometry: BufferGeometry, grips: ArrayLike<{bone: number}> | null, baked: Uint16Array, bones: number, row: number, scale: number, dt: number): number {
        const s = holder.seat;
        if (!s || this.off) return 0;
        let target = 0;
        if (row >= 0 && (kind === "stand" || kind === "perch") && hullKnown(geometry)) {
            const soles = feetOf(geometry, grips);
            if (soles) {
                const level = soleLevel(soles, baked, bones, row) * scale;
                if (s.liftFrom !== s.liftFrom) s.liftFrom = level + s.lift;
                target = s.liftFrom - level;
            }
        } else s.liftFrom = NaN;
        // (Eased a little: a clip's rows are a few a second apart.)
        s.lift += (target - s.lift) * Math.min(Math.max(dt, 0) * 30, 1);
        if (Math.abs(s.lift - target) < 0.0005) s.lift = target;
        return s.lift;
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
        if (s && this.frame < s.mute) return false;
        if (focus || this.forced || !s || s.urgent) return true;
        if (this.frame < s.due && s.seen === this.solids.version) return false;
        if (this.spent >= SEAT_BUDGET_MS) {
            this.short = true;
            return false;
        }
        // (One still on its way to its seat, or on the move, a quarter as long as one at rest on it.)
        return !s.solved || this.frame - s.frame >= (s.calm ? this.wait : this.wait >> 2);
    }

    /**
     * After its matrix is final: work out where it rests, if it is its turn. Sets the target its offset eases to.
     */
    settle(input: SeatInput): void {
        const s = (input.holder.seat ??= {x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, due: 0, solved: false, kind: input.kind, gap: 0, low: 0, on: "", inside: 0, frame: -1, pushes: 0, floor: null, env: NaN, above: 0, calm: false, at: 0, seen: -1, doubt: 0, ox: NaN, oy: NaN, oz: NaN, sx: NaN, sz: NaN, urgent: false, mute: 0, mutes: 0, wasGap: NaN, wasOff: 0, wasOwnY: NaN, lean: 0, idle: 99, lift: 0, liftFrom: NaN, ring: 0, sides: 0, bx: NaN, by: NaN, bz: NaN, fell: false, fellX: 0, fellZ: 0});
        s.kind = input.kind;
        // Lane SEAT (2026-11-27): one drawn near and held on a surface up in a tree: that tree drawn at the level its
        // limbs are on (`tree-detail.ts`; a woodpecker drawn 50 m off on its beech's lod2, a metre over its crown).
        if (input.surface && input.level !== "far") holdTreeDetail(input.holder, input.matrix.elements[12], input.matrix.elements[13], input.matrix.elements[14], this.frame);
        if (this.keepPoints) {
            // Development (the audit's probe, `audit-probe.ts`): the animal as drawn this frame.
            const holder = input.holder as SeatHolder & {seatDrawn?: {kind: SeatKind; level: string; m: number[]; geometry: BufferGeometry; pose: RigPose | null; height: number; length: number; surface: SeatInput["surface"]; frame: number; near: number; leaping: boolean; grips: ArrayLike<{bone: number}> | null; striding: boolean}};
            const drawn = (holder.seatDrawn ??= {kind: input.kind, level: "", m: new Array<number>(16).fill(0), geometry: input.geometry, pose: null, height: 0, length: 0, surface: null, frame: 0, near: 0, leaping: false, grips: null, striding: false});
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
            drawn.leaping = input.leaping === true;
            drawn.grips = input.grips ?? null;
            drawn.striding = Boolean(input.pose) && (input.moving || s.idle < 6);
        }
        if (this.off) return;
        if (FREE.has(input.kind)) {
            if (this.frame >= s.due && (this.spent < SEAT_BUDGET_MS || this.forced) && (hullKnown(input.geometry) || this.hullsLeft-- > 0)) {
                const started = performance.now();
                this.clear(input, s);
                this.spent += performance.now() - started;
            }
            return;
        }
        if (!SEATED.has(input.kind) || this.frame < s.mute) return;
        if (!input.focus && !this.forced && !s.urgent) {
            if ((this.frame < s.due && s.seen === this.solids.version) || this.spent >= SEAT_BUDGET_MS) {
                if (this.spent >= SEAT_BUDGET_MS) this.short = true;
                return;
            }
            // (Everyone's turn: when a frame's budget does not reach them all, one seated lately waits for those seated longer ago.)
            if (s.solved && this.frame - s.frame < (s.calm ? this.wait : this.wait >> 2)) return;
            // (A mesh's hull: one new one a frame.)
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

    /**
     * One flying or swimming: left to its own motion, but not inside a rock or a wall. Its middle in one, it is taken up
     * over it (a flier) or out sideways to the nearest free water (a swimmer; up, with none); out of it, back to its own
     * way.
     */
    private clear(input: SeatInput, s: SeatState): void {
        const e = input.matrix.elements;
        const height = Math.max(input.height, 0.002);
        const length = Math.max(input.length, 0.002);
        // (Its middle: the middle of its posed points' box.)
        const n = Math.min(posedHull(hullOf(input.geometry), input.pose, model), MAX_POINTS);
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
            const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
            const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
            const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
            if (wx < x0) x0 = wx;
            if (wy < y0) y0 = wy;
            if (wz < z0) z0 = wz;
            if (wx > x1) x1 = wx;
            if (wy > y1) y1 = wy;
            if (wz > z1) z1 = wz;
        }
        if (!n) return;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const cz = (z0 + z1) / 2;
        const reach = Math.max(0.5, 1.5 * height);
        const far = Math.max(2 * length, 0.3);
        near.length = 0;
        this.solids.release();
        const whole = this.solids.collect(cx - far, cy - reach, cz - far, cx + far, cy + ROCK_REACH, cz + far, ROCK | HARD, near);
        closedOf();
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
        // (A swimmer deep in rockwork: out sideways to free water. Just under a stone's top, or a flier: up over it.)
        if (input.kind === "swim" && depth > 0.5 * height) {
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
        s.ty = s.y + depth + (input.kind === "swim" ? 0.05 * height + 0.01 : 0.5 * height);
        if (Math.hypot(s.tx, s.ty, s.tz) > MOST) s.tx = s.ty = s.tz = 0;
    }

    private solve(input: SeatInput, s: SeatState): boolean {
        const hull = hullOf(input.geometry);
        // (On the move: the schedule says so, or its own motion has carried it over the ground in the last frames.)
        const moving = input.moving || s.idle < 6;
        // Its points: its feet first (`feetOf`, as posed now), then its hull.
        const pose = input.pose;
        const soles = feetOf(input.geometry, input.grips);
        const feet = soles ? posedHull(soles, pose, model) : 0;
        const posed = Math.min(feet + posedHull(hull, pose, feet ? model.subarray(feet * 3) : model), MAX_POINTS);
        // (Lying: the posed body's lowest too, its folded legs and its belly, `lyingPoints`; after its hull, in the room
        // left, so a bird's many soles never push the hull's own lowest out of the points.)
        const n = posed + (input.kind === "lie" && posed < MAX_POINTS ? lyingPoints(input.geometry, pose, model.subarray(posed * 3)) : 0);
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
        // On its feet (standing, or held on a branch) it rests on its feet, whatever its head does: a grazing muzzle, a
        // pecking bill. Lying, or on a trunk's or a wall's face, on whatever of it is lowest now; and a long low body (a
        // snake, a lizard, a crocodile) along its whole length.
        const among = feet && (input.kind === "stand" || input.kind === "perch") && length <= 4 * height ? feet : n;
        let least = Infinity;
        for (let i = 0; i < among; i++) least = Math.min(least, world[i * 3] * ax + world[i * 3 + 1] * ay + world[i * 3 + 2] * az);
        const band = Math.max(0.004, 0.05 * height);
        order.length = 0;
        for (let i = 0; i < among; i++) if (world[i * 3] * ax + world[i * 3 + 1] * ay + world[i * 3 + 2] * az <= least + band) order.push(i);
        order.sort((a, b) => world[a * 3] * ax + world[a * 3 + 1] * ay + world[a * 3 + 2] * az - (world[b * 3] * ax + world[b * 3 + 1] * ay + world[b * 3 + 2] * az));
        const apart = 0.12 * length;
        support.length = 0;
        for (const i of order) {
            if (support.length >= 10) break;
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
        closedOf();
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
        // (Where its own motion has it now: to tell, next time, whether it has moved on or stood still.)
        const ownX = s.ox === s.ox ? s.ox : e[12] - s.x;
        const ownY = s.oy === s.oy ? s.oy : e[13] - s.y;
        const ownZ = s.oz === s.oz ? s.oz : e[14] - s.z;
        const stayed = Math.abs(ownX - s.sx) < 0.002 && Math.abs(ownZ - s.sz) < 0.002 && Math.abs(ownY - s.wasOwnY) < 0.002;
        s.sx = ownX;
        s.sz = ownZ;
        s.wasOwnY = ownY;
        s.urgent = false;
        const dt = Math.min(Math.max(this.clock - s.at, 0), 1);
        s.at = this.clock;
        s.seen = this.solids.version;
        if (!gaps.length) {
            // Nothing drawn where the scene holds it (a trunk's side that is not there): once that has lasted, upright and
            // down onto what is under it.
            s.gap = NaN;
            s.on = "none";
            s.doubt += Math.max(dt, 1 / 60);
            // (ARK-VANISH: left where its own motion has it, not brought down.)
            if (nearOnly() && onSurface(input.kind)) s.tx = s.ty = s.tz = 0;
            else if (s.doubt >= FALL_AFTER) {
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
        // (How far the lowest of its contacts may be in while the rest carry it: lying, a centimetre and a half; on its
        // feet, a little on uneven ground; in a stride, a swinging foot or a knuckle the clip takes under the ground's level.)
        const sink = input.kind === "lie" ? 0.015 : moving && pose ? Math.min(Math.max(0.02, 0.25 * height), 0.3) : Math.max(0.015, 0.08 * height);
        // (Held: the first of it to touch. On its feet: a quarter of them may be a little in, on uneven ground.)
        let gap = held ? chosenGap : Math.min(gaps[Math.floor(0.25 * (gaps.length - 1))], gaps[0] + sink);
        // (SIG4: and the ground under every one of its lowest, not its ten support points alone: a body resting by a step in
        // the ground, a raised patch of ground cover's rim, has a few of them under the step's top a hand's width from the
        // nearest support point. Its lowest under the ground there is its seat, as the audit measures it. The ground alone,
        // no casts: up to 160 of them, as the audit reads.)
        if (!held && !cling && order.length > support.length) {
            const step = Math.max(1, Math.ceil(order.length / 160));
            let low = Infinity;
            for (let k = 0; k < order.length; k += step) {
                const i = order[k];
                const y = world[i * 3 + 1];
                low = Math.min(low, y - input.ground(world[i * 3], world[i * 3 + 2], y));
            }
            if (low + sink < gap) gap = low + sink;
        }
        // Every point of its body against the closed things round it (a rock, a wall, a log), not its lowest alone: its
        // belly over a rock's dome, its flank in a boulder. Each must be over the top it is above (or under: then it is
        // in the thing); the least of those clearances is its seat when it is less than its feet's.
        let moved = false;
        let sideways = false;
        let closedMin = Infinity;
        s.inside = 0;
        if (!cling && hard.length) {
            const below = Math.max(gap, 0) + 0.02;
            let closed = Infinity;
            // (Its points, and its middle: the middle of their box.)
            for (let i = 0; i <= n; i++) {
                const x = i < n ? world[i * 3] : (x0 + x1) / 2;
                const y = i < n ? world[i * 3 + 1] : (y0 + y1) / 2;
                const z = i < n ? world[i * 3 + 2] : (z0 + z1) / 2;
                if (!this.boxed(x, z)) continue;
                hits.length = 0;
                this.solids.castIn(hard, x, y + ROCK_REACH, z, 0, -(ROCK_REACH + below), 0, hits);
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
                // close over it and with its own underside under the point: under a bench, a sill or a roof is not in it.)
                if (overNy > 0.2 && overCls === ROCK) clear = y - rockExit(hits, y + up);
                else if (overNy > 0.2 && overY - y <= reachUp && this.undersideBelow(x, y, z, reachUp)) clear = y - overY;
                if (clear < -0.02) s.inside++;
                if (clear < closed) closed = clear;
            }
            // And from the stones' side: a small stone under a body lies between its points. Over its footprint, a grid of
            // drops: a closed top higher than the body's underside near it is in the body.
            if (!held) {
                const under = this.stoneUnder(n, e, y0, y1, length, 0, 0, 0, input.ground);
                if (under < closed) {
                    closed = under;
                    if (under < -0.02) s.inside++;
                }
            }
            closedMin = closed;
            if (closed < gap) gap = closed;
            // Its seat is up on something closed (a rock under a foot, a slab through its flank). Held there, or with half
            // its feet carried by it once up, it stands on it. Else the thing is in its way, not under it: a dragon is
            // not balanced on its den's capstone with its body in the air either side; it stays at the ground's height
            // and goes out sideways.
            if (!held && groundGaps.length) {
                groundGaps.sort((a, b) => a - b);
                const onGround = Math.min(groundGaps[Math.floor(0.25 * (groundGaps.length - 1))], groundGaps[0] + sink);
                if (gap < onGround - DEAD && this.carried(-gap, n, e, height, input.ground) < 0.6) {
                    gap = onGround;
                    on = "ground";
                    sideways = true;
                }
            }
            if (!s.inside && !sideways) {
                s.pushes = 0;
                s.ring = 0;
            }
        }
        // Held on something with nothing near under it: a drawn surface beside it first; none, it comes down, once
        // that has lasted (what it is held on may be a moment from being drawn).
        let waiting = false;
        // (ARK-VANISH: left where its own motion has it: looked at again in half a second, not every few frames.)
        let left = false;
        // (Not one whose body lies on a closed thing by another part of it than its feet: a frog on a rock's shoulder.)
        const nothing = held && !cling && gap > Math.max(0.1, height) && closedMin > Math.max(0.1, height);
        // (SMALL-PERCHER: moved onto a surface beside it, and its own motion has carried it on since: it is not on its way
        // to that surface any more, nor on a sliver there; it is somewhere else. Moved beside again from where it is. Its
        // move spent instead, the brimstone was put back where its own motion had it as that bobbed up 21 cm over its
        // tree's crown, and left there for good.)
        const movedOn = s.sides > 0 && Math.hypot(ownX - s.bx, ownY - s.by, ownZ - s.bz) > Math.max(DEAD, 0.25 * length);
        if (nothing && movedOn) s.sides = 0;
        // (Still on its way there, its own motion where it was: judged once it is there, not by the air it crosses. Judged
        // on the way, a brimstone sliding onto a leaf 12 cm off found nothing under it half way and was put back.)
        const arriving = s.sides > 0 && (s.x !== s.tx || s.y !== s.ty || s.z !== s.tz);
        if (nothing && arriving) waiting = true;
        else if (nothing && this.besidesLeft <= 0 && !this.forced && !input.focus) waiting = true;
        else if (nothing) {
            this.besidesLeft--;
            // (Moved onto a surface beside it and still with nothing under it: a sliver. It comes down where it is.)
            const found = s.sides < 1 ? this.beside(cx, least, cz, length, Math.max(0.1, height), length <= 0.6 ? mask : ROCK | HARD, input.ground) : null;
            // (ARK-VANISH: only a surface close by; none, it stays where its own motion has it, and does not fall.)
            const side = found && (!nearOnly() || !onSurface(input.kind) || Math.hypot(found.x, found.gap, found.z) <= Math.max(BESIDE_MOST, 1.5 * length)) ? found : null;
            if (!side && nearOnly() && onSurface(input.kind)) {
                s.tx = s.ty = s.tz = 0;
                s.env = NaN;
                s.doubt = 0;
                waiting = true;
                left = true;
            } else if (side) {
                s.sides++;
                s.bx = ownX;
                s.by = ownY;
                s.bz = ownZ;
                s.tx = s.x + side.x;
                s.ty = s.y - side.gap;
                s.tz = s.z + side.z;
                s.env = NaN;
                s.doubt = 0;
                moved = true;
                gap = side.gap;
                on = side.kind;
            } else {
                s.doubt = s.sides ? FALL_AFTER : s.doubt + Math.max(dt, 1 / 60);
                if (s.doubt < FALL_AFTER && s.solved) waiting = true;
                else if (input.surface) {
                    // (Upright as it comes down: not leaning to a leaf that is not there.)
                    s.fell = true;
                    s.fellX = e[12] - s.x;
                    s.fellZ = e[14] - s.z;
                }
            }
        } else {
            s.doubt = 0;
            s.sides = 0;
        }
        s.gap = gap;
        s.low = gaps[0];
        s.on = on;
        s.floor = on === "ground" || cling ? null : least - gap;
        const fresh = !s.solved;
        // A body that stood still and did not answer its offset (it changed, its gap did not: something else holds the
        // body where it is, feet planted in the world): never chased. Back to its own motion, and left a good while.
        const offNow = s.x * ax + s.y * ay + s.z * az;
        if (fresh || moved || !stayed || moving || s.wasGap !== s.wasGap) {
            s.wasGap = fresh || moved ? NaN : least;
            s.wasOff = offNow;
        } else if (Math.abs(offNow - s.wasOff) > Math.min(Math.max(0.15, 0.5 * height), 0.4)) {
            // Its offset has gone a good way (15 cm, half its height) since it stood here, and the lowest of its body has
            // not gone with it: something else holds the body where it is. Never chased: back to where its offset was
            // then, and left alone ten seconds (the chosen animal too), longer each time it happens again.
            const by = offNow - s.wasOff;
            if (Math.abs(least - s.wasGap - by) > 0.7 * Math.abs(by)) {
                s.tx = s.x - ax * by;
                s.ty = s.y - ay * by;
                s.tz = s.z - az * by;
                s.env = NaN;
                s.lean = 0;
                s.calm = true;
                s.mutes = Math.min(s.mutes + 1, 6);
                s.mute = this.frame + 600 * s.mutes;
                s.due = s.mute;
                s.wasGap = NaN;
                return true;
            }
            s.wasGap = least;
            s.wasOff = offNow;
        }
        if (!moved && !waiting) {
            // The gap it would have with no offset along its way, at its lowest over its motion (`SeatState.env`).
            const u = gap - (s.x * ax + s.y * ay + s.z * az);
            // (A stride's moment in the air; a still one in a clip of its own is kept level through it: `clipLift`.)
            const band = Math.max(input.bounce ?? 0, moving && pose ? Math.min(Math.max(0.25 * height, 0.02), 0.3) : 0);
            if (fresh || s.env !== s.env || u <= s.env || band <= 0) {
                s.env = u;
                s.above = 0;
            } else {
                // (Up by more than a stride lifts it: followed at once to within that; within it, only once it has lasted.)
                s.above += dt;
                s.env = Math.min(u, Math.max(s.env + (s.above < 0.25 ? 0.05 : 0.05 + 4 * (s.above - 0.25)) * dt, u - band));
            }
            // Its offset along that way, when where it eases to would leave it more than a centimetre off. A still one
            // takes a small change only when two solves agree on its way, and then the lesser of the two: a run on the
            // spot or a planted foot's give is a few centimetres either way from one solve to the next, not a gap.
            const along = s.tx * ax + s.ty * ay + s.tz * az;
            let off = s.env + along;
            if (Math.abs(off) > DEAD) {
                if (!fresh && !moving && Math.abs(off) <= Math.max(0.1, 0.5 * height)) {
                    const agreed = s.lean !== 0 && s.lean > 0 === off > 0;
                    const wanted = off;
                    off = agreed ? (off > 0 ? Math.min(off, s.lean) : Math.max(off, s.lean)) : 0;
                    s.lean = agreed ? 0 : wanted;
                } else s.lean = 0;
                s.tx -= ax * off;
                s.ty -= ay * off;
                s.tz -= az * off;
            } else s.lean = 0;
        }
        if (sideways && !moved && s.pushes < 8 && s.x === s.tx && s.y === s.ty && s.z === s.tz && (this.pushesLeft > 0 || this.forced || input.focus)) {
            this.pushesLeft--;
            const out = this.wayOut(s, this.forced ? 30 : input.focus ? 6 : 1.5, n, e, cx, cy, cz, length, reachUp, input.ground);
            // (A search not yet through is taken up at its next turn; one through with no free place is not made again.)
            if (out === null) s.pushes = 8;
            else if (out !== "more") s.pushes++;
            if (out && out !== "more") {
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
        s.calm = settled && !moving && s.lean === 0;
        s.due = this.frame + (waiting ? (left ? 30 : 4) : settled && s.lean === 0 ? (moving ? 2 : 24 + (Math.abs(Math.round(e[12] * 31 + e[14] * 17)) % 12)) : 1);
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
        closedOf();
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
            // (Not a face that is itself inside a rock, one rock's top under another's, nor a crevice its body does not fit.)
            if (!this.fits(cx + it.x, y - it.gap, cz + it.z, length)) continue;
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
        best ??= found.find((it) => (it.x !== 0 || it.z !== 0 || Math.abs(it.gap) > reach) && this.fits(cx + it.x, y - it.gap, cz + it.z, length)) ?? null;
        return best;
    }

    /** Whether a body of `length` set down at a point is clear of rock: the point, and four a third of its length round it, a little up. */
    private fits(x: number, y: number, z: number, length: number): boolean {
        const r = 0.3 * length;
        if (this.depthAt(x, y + 0.01, z, 0.5) > 0.02) return false;
        for (let k = 0; k < 4; k++) if (this.depthAt(x + (k === 0 ? r : k === 1 ? -r : 0), y + 0.01 + 0.5 * r, z + (k === 2 ? r : k === 3 ? -r : 0), 0.5) > 0.02) return false;
        return true;
    }

    /** Whether a point is over or under the box of something closed near the body (most points are in none). */
    private boxed(x: number, z: number): boolean {
        for (const it of hard) {
            const b = it.solid.boxes;
            const o = it.o;
            if (x >= b[o] && x <= b[o + 3] && z >= b[o + 2] && z <= b[o + 5]) return true;
        }
        return false;
    }

    /**
     * Whether straight down from a point, within `reach`, the first closed face is an underside seen from within (the
     * bottom of the thing the point is in): with a top over it too, the point is inside something built.
     */
    private undersideBelow(x: number, y: number, z: number, reach: number): boolean {
        hits.length = 0;
        this.solids.castIn(hard, x, y, z, 0, -reach, 0, hits);
        let first: SolidHit | null = null;
        for (const hit of hits) if (!hit.double && hit.cls & (ROCK | HARD) && (!first || hit.t < first.t)) first = hit;
        return first !== null && first.ny < -0.2;
    }

    /**
     * How deep a point is inside a closed drawn solid (m under its top; 0: not in one). Straight up from it, the first
     * closed face met is one seen from inside: a rock's top however high (a rock is a lump); a built thing's only within
     * `reach` and with its own underside under the point (a roof drawn as one sheet over a room is seen from behind
     * too, and a ceiling, a bench or a sill is not a rock).
     */
    private depthAt(x: number, y: number, z: number, reach: number): number {
        if (!this.boxed(x, z)) return 0;
        hits.length = 0;
        this.solids.castIn(hard, x, y, z, 0, ROCK_REACH, 0, hits);
        let first: SolidHit | null = null;
        for (const hit of hits) if (!hit.double && (hit.cls === ROCK || (hit.cls === HARD && hit.t * ROCK_REACH <= reach)) && (!first || hit.t < first.t)) first = hit;
        if (first === null || first.ny <= 0.2) return 0;
        const depth = first.t * ROCK_REACH;
        if (first.cls === ROCK) return depth;
        return this.undersideBelow(x, y, z, reach) ? depth : 0;
    }

    /**
     * The share of its footprint (fifteen places over its length and width, as it lies now) that has a closed thing's
     * top or the ground under it within a seventh of its height once its lowest point is `rise` higher: whether what it
     * would be lifted onto carries it. (Its lowest points alone can all be over one small rock under its belly.)
     */
    private carried(rise: number, n: number, e: ArrayLike<number>, height: number, ground: (x: number, z: number, near?: number) => number): number {
        // Its extent along its own length and width (model space), and its lowest point as drawn.
        let mx0 = Infinity;
        let mx1 = -Infinity;
        let mz0 = Infinity;
        let mz1 = -Infinity;
        let low = Infinity;
        for (let i = 0; i < n; i++) {
            if (model[i * 3] < mx0) mx0 = model[i * 3];
            if (model[i * 3] > mx1) mx1 = model[i * 3];
            if (model[i * 3 + 2] < mz0) mz0 = model[i * 3 + 2];
            if (model[i * 3 + 2] > mz1) mz1 = model[i * 3 + 2];
            if (world[i * 3 + 1] < low) low = world[i * 3 + 1];
        }
        const y = low + rise;
        let all = 0;
        let held = 0;
        for (const u of [0.15, 0.5, 0.85])
            for (const v of [0.1, 0.3, 0.5, 0.7, 0.9]) {
                const lx = mx0 + (mx1 - mx0) * u;
                const lz = mz0 + (mz1 - mz0) * v;
                // (That place under its body in the world: by its own axes across and along, at its origin's height.)
                const x = e[0] * lx + e[8] * lz + e[12];
                const z = e[2] * lx + e[10] * lz + e[14];
                const under = ground(x, z, y);
                let top = under;
                hits.length = 0;
                if (y + 0.02 > under) this.solids.castIn(hard, x, y + 0.02, z, 0, under - y - 0.04, 0, hits);
                for (const hit of hits) if (!hit.double && hit.cls & (ROCK | HARD) && hit.ny > 0 && hit.y > top) top = hit.y;
                all++;
                if (y - top <= Math.max(0.05, 0.15 * height)) held++;
            }
        return all ? held / all : 1;
    }

    /**
     * The worst a closed thing's top stands over the body's underside (m, negative: by how much it is in the body; 0 or
     * more: none), the body moved by (dx, dy, dz): sixty drops over its footprint (its own length and width as it lies),
     * each rock met (from its top down to its underside or the ground) against the lowest and the highest of the body's
     * points within a hand's reach. Finds the small stone under a body and the slab through it between its points.
     */
    private stoneUnder(n: number, e: ArrayLike<number>, lowY: number, highY: number, length: number, dx: number, dy: number, dz: number, ground: (x: number, z: number, near?: number) => number): number {
        let mx0 = Infinity;
        let mx1 = -Infinity;
        let mz0 = Infinity;
        let mz1 = -Infinity;
        let my = 0;
        for (let i = 0; i < n; i++) {
            if (model[i * 3] < mx0) mx0 = model[i * 3];
            if (model[i * 3] > mx1) mx1 = model[i * 3];
            if (model[i * 3 + 2] < mz0) mz0 = model[i * 3 + 2];
            if (model[i * 3 + 2] > mz1) mz1 = model[i * 3 + 2];
            my += model[i * 3 + 1];
        }
        my /= Math.max(n, 1);
        const r = Math.max(0.12 * length, 0.03);
        let worst = Infinity;
        for (let u = 0; u < 5; u++)
            for (let v = 0; v < 12; v++) {
                const lx = mx0 + ((u + 0.5) / 5) * (mx1 - mx0);
                const lz = mz0 + ((v + 0.5) / 12) * (mz1 - mz0);
                const x = e[0] * lx + e[4] * my + e[8] * lz + e[12] + dx;
                const z = e[2] * lx + e[6] * my + e[10] * lz + e[14] + dz;
                if (!this.boxed(x, z)) continue;
                const floor = ground(x, z, lowY);
                // (The body there: the lowest and the highest of its points within reach of the drop.)
                let under = Infinity;
                let over = -Infinity;
                for (let i = 0; i < n; i++) {
                    const px = world[i * 3] + dx - x;
                    const pz = world[i * 3 + 2] + dz - z;
                    if (px * px + pz * pz > r * r) continue;
                    const py = world[i * 3 + 1] + dy;
                    if (py < under) under = py;
                    if (py > over) over = py;
                }
                if (under === Infinity) continue;
                // Down through everything over and in the body's column: a rock is solid from each top down to its
                // underside (or the ground); a built thing, only a top under the body's own top (a log, a trough).
                const from = highY + ROCK_REACH;
                hits.length = 0;
                if (from > floor) this.solids.castIn(hard, x, from, z, 0, floor - from, 0, hits);
                stoneOrder.length = 0;
                for (let h = 0; h < hits.length; h++) if (!hits[h].double && hits[h].cls & (ROCK | HARD)) stoneOrder.push(h);
                stoneOrder.sort((p, q) => hits[q].y - hits[p].y);
                let top = NaN;
                for (let k = 0; k <= stoneOrder.length; k++) {
                    const hit = k < stoneOrder.length ? hits[stoneOrder[k]] : null;
                    if (hit && hit.cls === HARD) {
                        if (hit.ny > 0 && hit.y < highY && hit.y > floor + 0.03 && under - hit.y < worst) worst = under - hit.y;
                        continue;
                    }
                    if (hit && hit.ny > 0) {
                        if (top !== top) top = hit.y;
                        continue;
                    }
                    // (An underside, or the ground at the end: the rock entered at `top` ends here.)
                    if (top === top) {
                        const bottom = hit ? hit.y : floor;
                        if (top > floor + 0.03 && top > under + 0.02 && bottom < over - 0.02 && under - top < worst) worst = under - top;
                        top = NaN;
                    }
                }
            }
        return worst;
    }

    /**
     * The nearest move sideways that takes the body out of the closed things it is in: a step at a time each way, to
     * the first place where none of its points is under a closed thing's own top. Null: none within three body lengths (it is left: the audit says so); "more": its time was up, the rest at its next turn.
     */
    private wayOut(s: SeatState, budget: number, n: number, e: ArrayLike<number>, cx: number, cy: number, cz: number, length: number, reach: number, ground: (x: number, z: number, near?: number) => number): {x: number; y: number; z: number} | "more" | null {
        const step = Math.max(0.125 * length, 0.03);
        const here = ground(cx, cz, cy);
        const far = step * 24 + length;
        // (Every point of it: a place is free when none of them is in anything, as the seat itself then finds.)
        wayPoints.length = 0;
        let lowY = Infinity;
        let highY = -Infinity;
        for (let i = 0; i < n; i++) {
            wayPoints.push(i);
            if (world[i * 3 + 1] < lowY) lowY = world[i * 3 + 1];
            if (world[i * 3 + 1] > highY) highY = world[i * 3 + 1];
        }
        near.length = 0;
        this.solids.release();
        this.solids.collect(cx - far, cy - reach - length, cz - far, cx + far, cy + ROCK_REACH, cz + far, ROCK | HARD, near);
        closedOf();
        // (Inside a time: a body among many closed things costs a cast a point a place. What is left is taken up at
        // its next turn, from the place it had reached.)
        const started = performance.now();
        for (let c = s.ring; c < 24 * 8; c++) {
            if (c > s.ring && performance.now() - started > budget) {
                s.ring = c;
                return "more";
            }
            const j = 1 + Math.floor(c / 8);
            const k = c % 8;
            const dx = Math.cos((k * Math.PI) / 4) * step * j;
            const dz = Math.sin((k * Math.PI) / 4) * step * j;
            const dy = ground(cx + dx, cz + dz, cy) - here;
            let free = this.depthAt(cx + dx, cy + dy, cz + dz, reach) <= 0.02;
            for (let w = 0; free && w < wayPoints.length; w++) {
                const i = wayPoints[w];
                if (this.depthAt(world[i * 3] + dx, world[i * 3 + 1] + dy, world[i * 3 + 2] + dz, reach) > 0.02) free = false;
            }
            // (And no stone under it there.)
            if (free && this.stoneUnder(n, e, lowY + dy, highY + dy, length, dx, dy, dz, ground) < -0.02) free = false;
            if (free) {
                s.ring = 0;
                return {x: dx, y: dy, z: dz};
            }
        }
        s.ring = 0;
        return null;
    }
}

export {TREE, SOFT};
