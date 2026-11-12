/**
 * The camera's body (runtime lane): it never goes inside the ground, a tree,
 * a rock or a building; it keeps the same glide on a 60 Hz, a 120 Hz and a
 * throttled screen; a followed animal is kept in the middle without lag; a
 * mouse wheel's notch glides instead of jumping.
 *
 * Obstacles come from the scenery's own seeded lists (`decor.ts` worldDecor
 * and forestFill), so every viewer's camera meets the same trees. Their
 * shapes are the camera's approximations of what `vegetation.ts` draws: a
 * trunk (a vertical capsule) and a crown (an ellipsoid) per tree, an
 * ellipsoid per rock, a box per building. Shrubs, reeds and flowers are soft
 * and not obstacles.
 *
 * Pure apart from three's Vector3: the frame loop passes the camera and the
 * target in; the tests drive it with numbers.
 */

import {noHamlet} from "@/ark-scene/no-hamlet";
import type {Vector3} from "three";
import {forestFill, worldDecor, type DecorItem, type DecorKind} from "@/ark-scene/decor";
import {canopyTree, COTTAGE} from "@/ark-scene/micro-decor";
import {heightAt} from "@/ark-scene/world";

/** The camera's own radius (m): how close its eye comes to a surface. */
export const CAMERA_RADIUS = 0.35;

/**
 * The camera's reach (m), at true scale (motion pass §3): `near` the nearest it usually comes to its target, `close`
 * the nearest to a small animal (an ant, a gecko: true size, so a few centimetres off), `far` the farthest (the whole
 * island, and a whale whole on a phone held upright).
 */
export const CAMERA_RANGE = {near: 4, close: 0.08, far: 340} as const;

/**
 * How far from an animal the camera stands to meet it (m), by the length it is drawn at (true size) and the view's
 * aspect (width over height): a small one about a fifth of the view (a 1 cm beetle from 7 cm, a mouse from about a
 * metre); a mid-sized one in its surroundings, as before (`10 + 4 L`: a fox from about 13 m); a whale or an elephant
 * far enough back to be seen whole across the narrower side of the view (a 25 m blue whale on an upright phone from
 * about 115 m).
 */
export function meetDistance(length: number, aspect: number, fovDegrees = 38): number {
    const L = Math.max(length, 0.001);
    const small = Math.max(L * 7, 0.12);
    const context = 10 + 4 * L;
    const t = Math.min(Math.max((L - 0.15) / 0.85, 0), 1);
    const blend = t * t * (3 - 2 * t);
    const near = small + (context - small) * blend;
    return Math.min(Math.max(near, fitWhole(L, aspect, fovDegrees)), CAMERA_RANGE.far);
}

/** The distance (m) at which a length fills 70% of the narrower side of the view. */
export function fitWhole(length: number, aspect: number, fovDegrees = 38): number {
    const vertical = 2 * Math.tan((fovDegrees * Math.PI) / 360);
    return length / (0.7 * vertical * Math.min(Math.max(aspect, 0.3), 1));
}

/** `rank` (0–1, forest fill only): drawn, and so an obstacle, only under the tier's fill share. */
type Ellipsoid = {kind: "ellipsoid"; x: number; y: number; z: number; rx: number; ry: number; rz: number; solid: boolean; rank?: number};
type Capsule = {kind: "capsule"; x: number; z: number; y0: number; y1: number; r: number; rank?: number};
type Box = {kind: "box"; x: number; z: number; y0: number; y1: number; hx: number; hz: number; rotation: number; rank?: number};
export type CameraObstacle = Ellipsoid | Capsule | Box;

/**
 * Per tree kind, in the shape's own metres (× the item's scale): the trunk's radius and top, the crown's middle and
 * radii (sideways, up). From vegetation.ts's shapes.
 */
const TREES: Partial<Record<DecorKind, {trunk: number; top: number; crownY: number; crownR: number; crownRy: number}>> = {
    broadleaf: {trunk: 0.2, top: 2.6, crownY: 3.5, crownR: 1.9, crownRy: 1.4},
    rainforest: {trunk: 0.26, top: 4.6, crownY: 4.7, crownR: 2.7, crownRy: 1.6},
    conifer: {trunk: 0.16, top: 1.4, crownY: 2.6, crownR: 1.15, crownRy: 1.8},
    acacia: {trunk: 0.13, top: 2.6, crownY: 2.9, crownR: 2.3, crownRy: 0.45},
    palm: {trunk: 0.13, top: 4.9, crownY: 5.0, crownR: 1.9, crownRy: 0.6},
    orchard: {trunk: 0.12, top: 1.3, crownY: 1.8, crownR: 1.05, crownRy: 0.8},
    cactus: {trunk: 0.24, top: 2.5, crownY: 0, crownR: 0, crownRy: 0}
};

/** The obstacles of one scenery item (empty for soft things). */
export function obstaclesOf(item: DecorItem): CameraObstacle[] {
    const s = item.scale;
    if (item.kind === "rock") {
        // The rock shape: radius ~0.85 squashed 1.1 × 0.62 × 0.95, sitting a little into the ground.
        return [{kind: "ellipsoid", x: item.x, y: item.y + 0.1 * s, z: item.z, rx: 0.9 * s, ry: 0.55 * s, rz: 0.82 * s, solid: true}];
    }
    if (item.kind === "canopy") {
        const tree = canopyTree(item.variant);
        return [
            {kind: "capsule", x: item.x, z: item.z, y0: item.y - 1, y1: item.y + tree.height * s, r: tree.base * s},
            {kind: "ellipsoid", x: item.x, y: item.y + tree.crown.y * s, z: item.z, rx: (tree.crown.radius + 1.2) * s, ry: tree.crown.radius * tree.crown.squash * s * 1.4, rz: (tree.crown.radius + 1.2) * s, solid: false}
        ];
    }
    // The barn's body is 6.4 × 4.4 m, its roof's ridge 5.05 m up.
    if (item.kind === "barn") return [{kind: "box", x: item.x, z: item.z, y0: item.y - 1, y1: item.y + 5.05 * s, hx: 3.5 * s, hz: 2.6 * s, rotation: item.rotation}];
    if (item.kind === "cottage") return [];
    const tree = TREES[item.kind];
    if (!tree) return [];
    const out: CameraObstacle[] = [{kind: "capsule", x: item.x, z: item.z, y0: item.y - 1, y1: item.y + tree.top * s, r: tree.trunk * s}];
    if (tree.crownR > 0) out.push({kind: "ellipsoid", x: item.x, y: item.y + tree.crownY * s, z: item.z, rx: tree.crownR * s, ry: tree.crownRy * s, rz: tree.crownR * s, solid: false});
    return out;
}

/** The cottage (drawn by micro-scene.ts, not in the decor's list as a shape): its walls and roof as a box. */
function cottageObstacle(): Box {
    const c = COTTAGE;
    return {kind: "box", x: c.x, z: c.z, y0: c.floor - 1, y1: c.floor + c.wall + c.ridge, hx: c.width / 2 + c.overhang, hz: c.depth / 2 + c.overhang, rotation: c.rotation};
}

const CELL = 8;

/**
 * The obstacles near a point, from a coarse grid. Built once per fill share (the forest fill a tier draws), from the
 * seeded scenery lists: the same for every viewer.
 */
export class CameraObstacles {
    private readonly cells = new Map<string, CameraObstacle[]>();
    readonly count: number;

    constructor(items: Array<DecorItem & {rank?: number}>, extra: CameraObstacle[] = []) {
        let count = 0;
        const add = (obstacle: CameraObstacle) => {
            const reach = obstacle.kind === "ellipsoid" ? Math.max(obstacle.rx, obstacle.rz) : obstacle.kind === "capsule" ? obstacle.r : Math.hypot(obstacle.hx, obstacle.hz);
            const x0 = Math.floor((obstacle.x - reach) / CELL);
            const x1 = Math.floor((obstacle.x + reach) / CELL);
            const z0 = Math.floor((obstacle.z - reach) / CELL);
            const z1 = Math.floor((obstacle.z + reach) / CELL);
            for (let cx = x0; cx <= x1; cx++) {
                for (let cz = z0; cz <= z1; cz++) {
                    const key = `${cx},${cz}`;
                    const list = this.cells.get(key) ?? [];
                    list.push(obstacle);
                    this.cells.set(key, list);
                }
            }
            count++;
        };
        for (const item of items) {
            for (const obstacle of obstaclesOf(item)) {
                if (typeof item.rank === "number") obstacle.rank = item.rank;
                add(obstacle);
            }
        }
        for (const obstacle of extra) add(obstacle);
        this.count = count;
    }

    /** The scene's: the decor, the whole forest fill (with its ranks: `collideCamera` keeps a tier's share) and the cottage. */
    static forScene(): CameraObstacles {
        // (Islands mode, `no-hamlet.ts`: no cottage.)
        return new CameraObstacles([...worldDecor(), ...forestFill()], noHamlet() ? [] : [cottageObstacle()]);
    }

    near(x: number, z: number): CameraObstacle[] {
        return this.cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? [];
    }
}

type Point = {x: number; y: number; z: number};

/**
 * How far a point is inside an obstacle grown by `margin` (≤ 0 outside), and the way out (unit). Ellipsoids are
 * scaled to a sphere for the test and pushed along their surface's normal.
 */
export function penetration(obstacle: CameraObstacle, p: Point, margin: number): {depth: number; nx: number; ny: number; nz: number} {
    if (obstacle.kind === "capsule") {
        if (p.y < obstacle.y0 - margin || p.y > obstacle.y1 + margin) return {depth: 0, nx: 0, ny: 0, nz: 0};
        const dx = p.x - obstacle.x;
        const dz = p.z - obstacle.z;
        const d = Math.hypot(dx, dz);
        const depth = obstacle.r + margin - d;
        if (depth <= 0) return {depth: 0, nx: 0, ny: 0, nz: 0};
        return d > 1e-6 ? {depth, nx: dx / d, ny: 0, nz: dz / d} : {depth, nx: 0, ny: 0, nz: 1};
    }
    if (obstacle.kind === "box") {
        const cos = Math.cos(obstacle.rotation);
        const sin = Math.sin(obstacle.rotation);
        const dx = p.x - obstacle.x;
        const dz = p.z - obstacle.z;
        // Into the box's own frame (rotation about up).
        const lx = dx * cos - dz * sin;
        const lz = dx * sin + dz * cos;
        const hx = obstacle.hx + margin;
        const hz = obstacle.hz + margin;
        const top = obstacle.y1 + margin;
        if (Math.abs(lx) >= hx || Math.abs(lz) >= hz || p.y >= top || p.y <= obstacle.y0) return {depth: 0, nx: 0, ny: 0, nz: 0};
        // Out by the nearest face: a side, or up over the roof.
        const outX = hx - Math.abs(lx);
        const outZ = hz - Math.abs(lz);
        const outY = top - p.y;
        if (outY <= outX && outY <= outZ) return {depth: outY, nx: 0, ny: 1, nz: 0};
        const ox = outX < outZ ? Math.sign(lx) || 1 : 0;
        const oz = outX < outZ ? 0 : Math.sign(lz) || 1;
        // Back to the world's frame.
        return {depth: Math.min(outX, outZ), nx: ox * cos + oz * sin, ny: 0, nz: -ox * sin + oz * cos};
    }
    const ux = (p.x - obstacle.x) / (obstacle.rx + margin);
    const uy = (p.y - obstacle.y) / (obstacle.ry + margin);
    const uz = (p.z - obstacle.z) / (obstacle.rz + margin);
    const u = Math.hypot(ux, uy, uz);
    if (u >= 1) return {depth: 0, nx: 0, ny: 0, nz: 0};
    // The normal of the scaled sphere, back in world space; the depth along it, roughly.
    let nx = ux / (obstacle.rx + margin);
    let ny = uy / (obstacle.ry + margin);
    let nz = uz / (obstacle.rz + margin);
    const n = Math.hypot(nx, ny, nz);
    if (n < 1e-9) return {depth: obstacle.ry + margin, nx: 0, ny: 1, nz: 0};
    nx /= n;
    ny /= n;
    nz /= n;
    const radiusAlong = 1 / Math.hypot(nx / (obstacle.rx + margin), ny / (obstacle.ry + margin), nz / (obstacle.rz + margin));
    return {depth: radiusAlong * (1 - u), nx, ny, nz};
}

/** Whether a point is inside an obstacle (the target inside a crown: that crown is not pushed against). */
export function inside(obstacle: CameraObstacle, p: Point, margin = 0): boolean {
    return penetration(obstacle, p, margin).depth > 0;
}

export type CollideOptions = {
    /** Seconds since the last frame (0: snap). */
    dt: number;
    /** Under the sea (a dive): the ground rule is the scene's own. */
    diving: boolean;
    /** How high over the ground the eye keeps (the scene's rule: a quarter of the view distance, 3 cm to 1.2 m). */
    clearance: number;
    /** Close to a small animal (a close-up): only solid things (trunks, rocks, walls) push, by less. */
    closeUp: boolean;
    /** The forest fill's share the tier draws (default all). */
    fill?: number;
    /** Part C: the loaded island's ground (default the wild island's). */
    ground?: (x: number, z: number) => number;
};

/**
 * Moves the camera out of anything it is inside (and up over ground rising just round it), returning how far it
 * moved. Solid things push at once (the eye never sits inside a rock or a trunk); crowns ease it out over ~0.15 s,
 * so the view glides off the leaves instead of jumping. Anything the target is inside is ignored (looking at an
 * animal up in a crown).
 */
export function collideCamera(obstacles: CameraObstacles, camera: Vector3, target: Point, options: CollideOptions): number {
    const start = {x: camera.x, y: camera.y, z: camera.z};
    if (!options.diving) {
        // The ground round the eye, not only under it: a slope rising in front is kept off the near plane.
        const ring = Math.min(Math.max(options.clearance * 1.5, 0.15), 1.6);
        const groundAt = options.ground ?? heightAt;
        let ground = Math.max(groundAt(camera.x, camera.z), 0);
        for (let k = 0; k < 6; k++) {
            const angle = (k / 6) * Math.PI * 2;
            ground = Math.max(ground, Math.max(groundAt(camera.x + Math.cos(angle) * ring, camera.z + Math.sin(angle) * ring), 0) - ring * 0.35);
        }
        const floor = ground + options.clearance;
        if (camera.y < floor) camera.y += (floor - camera.y) * ease(options.dt, 0.08);
    }
    const margin = options.closeUp ? 0.06 : CAMERA_RADIUS;
    for (let pass = 0; pass < 2; pass++) {
        for (const obstacle of obstacles.near(camera.x, camera.z)) {
            if (obstacle.rank !== undefined && obstacle.rank >= (options.fill ?? 1)) continue;
            const solid = obstacle.kind !== "ellipsoid" || obstacle.solid;
            if (options.closeUp && !solid) continue;
            if (inside(obstacle, target, 0.05)) continue;
            const hit = penetration(obstacle, camera, margin);
            if (hit.depth <= 0) continue;
            const k = solid ? 1 : ease(options.dt, 0.15);
            camera.x += hit.nx * hit.depth * k;
            camera.y += hit.ny * hit.depth * k;
            camera.z += hit.nz * hit.depth * k;
        }
    }
    return Math.hypot(camera.x - start.x, camera.y - start.y, camera.z - start.z);
}

/** The share of a gap closed in `dt` seconds by an exponential approach with time constant `tau` (1 when dt is 0: snap). */
export function ease(dt: number, tau: number): number {
    if (!(dt > 0)) return 1;
    return 1 - Math.exp(-Math.min(dt, 0.25) / tau);
}

/**
 * OrbitControls' damping is per frame: 0.075 at 60 Hz. The factor for this frame's dt, so the glide after a drag
 * lasts as long on a 120 Hz screen and at a throttled 30 fps as at 60.
 */
export function dampingFor(dt: number, at60 = 0.075): number {
    if (!(dt > 0)) return at60;
    const frames = Math.min(dt, 0.1) * 60;
    return 1 - Math.pow(1 - at60, frames);
}

/**
 * Following an animal: the target moves toward where it is (and a little ahead, by its speed), closing the gap with
 * a time constant instead of a fixed share per frame. Returns the step to add to both the target and the camera.
 */
export class FollowSmoother {
    private last: Point | null = null;
    private velocity = {x: 0, y: 0, z: 0};

    reset() {
        this.last = null;
        this.velocity = {x: 0, y: 0, z: 0};
    }

    step(target: Point, aim: Point, dt: number, tau = 0.14): Point {
        if (this.last && dt > 0) {
            const k = ease(dt, 0.3);
            this.velocity.x += ((aim.x - this.last.x) / dt - this.velocity.x) * k;
            this.velocity.y += ((aim.y - this.last.y) / dt - this.velocity.y) * k;
            this.velocity.z += ((aim.z - this.last.z) / dt - this.velocity.z) * k;
        }
        this.last = {x: aim.x, y: aim.y, z: aim.z};
        // A lead of one time constant cancels the lag of an exponential follow at constant speed; capped (a teleport, a respawn).
        const lead = Math.hypot(this.velocity.x, this.velocity.z) < 12 ? tau : 0;
        const k = ease(dt, tau);
        return {
            x: (aim.x + this.velocity.x * lead - target.x) * k,
            y: (aim.y + this.velocity.y * lead * 0.5 - target.y) * k,
            z: (aim.z + this.velocity.z * lead - target.z) * k
        };
    }
}

/**
 * A mouse wheel's notch glides: the native event is held back and handed to OrbitControls in shrinking parts over
 * about 0.15 s (its zoom is multiplicative, so the parts add up to the same zoom, and zoom-to-cursor still aims at
 * the pointer). Trackpads and pinches (small deltas, many events) pass straight through.
 */
export class WheelGlide {
    private pending = 0;
    private at = {clientX: 0, clientY: 0, ctrlKey: false};
    private readonly synthetic = new WeakSet<Event>();
    private readonly onWheel: (event: WheelEvent) => void;

    constructor(private readonly target: HTMLElement, threshold = 40) {
        this.onWheel = (event: WheelEvent) => {
            if (this.synthetic.has(event)) return;
            const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
            if (Math.abs(delta) < threshold || event.ctrlKey) {
                // A trackpad or a pinch: already smooth. Anything held back goes first, so the order is kept.
                this.flush();
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            this.pending += delta;
            this.at = {clientX: event.clientX, clientY: event.clientY, ctrlKey: event.ctrlKey};
            // The first part now, so the wheel answers at once.
            this.dispatch(delta * 0.3);
        };
        target.addEventListener("wheel", this.onWheel, {capture: true, passive: false});
    }

    /** Still gliding (the frame loop keeps drawing every frame). */
    get active(): boolean {
        return Math.abs(this.pending) > 0.5;
    }

    step(dt: number) {
        if (!this.active) return;
        const part = Math.abs(this.pending) < 3 ? this.pending : this.pending * ease(dt, 0.06);
        this.dispatch(part);
    }

    private flush() {
        if (this.active) this.dispatch(this.pending);
        this.pending = 0;
    }

    private dispatch(delta: number) {
        this.pending -= delta;
        if (Math.abs(delta) < 0.01) return;
        const event = new WheelEvent("wheel", {deltaY: delta, deltaMode: 0, clientX: this.at.clientX, clientY: this.at.clientY, ctrlKey: this.at.ctrlKey, bubbles: true, cancelable: true});
        this.synthetic.add(event);
        this.target.dispatchEvent(event);
    }

    dispose() {
        this.target.removeEventListener("wheel", this.onWheel, {capture: true});
        this.pending = 0;
    }
}
