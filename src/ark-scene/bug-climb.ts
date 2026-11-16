/**
 * Small bugs climb grass (pass 3, lane TREES; the plan given the owner with "make leaves look like real foliage up
 * close": "small bugs climbing up and along grass blades"). A small insect whose record puts it on the ground (its
 * microhabitat's spot is the leaf litter: `micro.ts`) now and then walks to a grass blade by its home, climbs it to
 * near the top, turns round there and comes back down, then goes on with its crawl.
 *
 * Who: the model's body plan is an arthropod's (`ark.json` plan "arthropod"; never a butterfly, which flies), its true
 * length at most `CLIMB_MAX_LENGTH`, and the ground under its home grows blades tall enough for it (`bug-ground.ts`
 * BUG_DENSITY: no blade on paving, water or bare rock, and a lawn's short blades only for the smallest).
 *
 * When: a pure rule in its id and the shared clock (`climbAt`), so every viewer sees the same beetle on the same blade at
 * the same moment: once every 36 to 66 s, for 12 s (to the blade, up, a pause and the turn at the top, down, away).
 * Nothing is decided here (no meal, no move of its home): it is a pose, eased in and out of the crawl.
 *
 * The blade it climbs is drawn for it (`ClimbStems`): a straight blade at its home, standing still in the wind (so the
 * bug on it never slides off), drawn only within `STEM_DRAWN_WITHIN` of the camera, one instanced draw.
 */

import {BufferAttribute, BufferGeometry, FrontSide, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3} from "three";
import {BUG_DENSITY, type BugCover} from "@/ark-scene/bug-ground";
import {hashString} from "@/ark-scene/world";

/** The longest body (m) that climbs a blade: a beetle or an ant, not a stag beetle's bulk on a grass stem. */
export const CLIMB_MAX_LENGTH = 0.045;
/** The blades are drawn within this far of the camera (m). */
export const STEM_DRAWN_WITHIN = 14;
/** A climb's parts (s): to the blade, up, at the top (turning round), down, back to its crawl. */
const TO = 1;
const UP = 4;
const TOP = 2;
const DOWN = 4;
const AWAY = 1;
export const CLIMB_SECONDS = TO + UP + TOP + DOWN + AWAY;

export type ClimbStem = {x: number; y: number; z: number; height: number; /** Which side of the blade it climbs (rad about up). */ side: number; /** The bug's length (m). */ length: number; shade: number};
export type ClimbPoint = {x: number; y: number; z: number; nx: number; ny: number; nz: number; tx: number; ty: number; tz: number};

const unit = (key: string) => (hashString(key) % 100000) / 100000;
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Crustaceans share the arthropod plan but do not climb grass (a shrimp's record can put it in wet leaf litter). */
const NOT_CLIMBERS = /shrimp|prawn|crab|crayfish|lobster|woodlouse|isopod/;

/** The map's ground attach points (`map/place.ts`) a small animal can sit on among the blades. */
const GROUND_TAGS: ReadonlySet<string> = new Set(["leaf_litter", "grass", "ground", "soil", "worm_hole", "burrow_entrance"]);

/**
 * Whether a small animal climbs blades: on the ground (the litter, or a ground point of the map: most ground bugs are
 * placed on one), an arthropod's body plan, small enough.
 */
export function climbsBlades(slug: string, surface: string, plan: string | null | undefined, length: number, tag?: string): boolean {
    const ground = surface === "litter" || (surface === "attach" && tag !== undefined && GROUND_TAGS.has(tag));
    return ground && plan === "arthropod" && length > 0 && length <= CLIMB_MAX_LENGTH && !NOT_CLIMBERS.test(slug);
}

/**
 * Its blade: at its home on the ground, as tall as the ground's own blades there (the upper part of their range: it
 * picks a tall one), at least four body lengths; null where the ground grows none that tall.
 */
export function climbStem(id: string, home: {x: number; y: number; z: number}, cover: BugCover | null, length: number): ClimbStem | null {
    if (!cover) return null;
    const density = BUG_DENSITY[cover.surface];
    if (!density.per.blade || density.per.blade < 2) return null;
    const [low, high] = density.blade;
    const height = low + (high - low) * (0.55 + 0.45 * unit(`${id}#blade`));
    if (height < 4 * length) return null;
    return {x: home.x, y: home.y, z: home.z, height, side: unit(`${id}#side`) * Math.PI * 2, length, shade: 0.85 + 0.3 * unit(`${id}#shade`)};
}

/**
 * Where in its climb it is at `time` (s, the shared clock): `on` 0 (crawling) … 1 (on the blade), `up` 0 (its foot) …
 * 1 (the top of its climb), `turn` 0 (head up) … 1 (head down).
 */
export function climbAt(id: string, time: number): {on: number; up: number; turn: number} {
    const period = 36 + 30 * unit(`${id}#climb`);
    const local = (((time + unit(`${id}#when`) * period) % period) + period) % period;
    if (local >= CLIMB_SECONDS) return {on: 0, up: 0, turn: 0};
    let t = local;
    if (t < TO) return {on: ease(t / TO), up: 0, turn: 0};
    t -= TO;
    if (t < UP) return {on: 1, up: ease(t / UP), turn: 0};
    t -= UP;
    if (t < TOP) return {on: 1, up: 1, turn: ease(t / TOP)};
    t -= TOP;
    if (t < DOWN) return {on: 1, up: 1 - ease(t / DOWN), turn: 1};
    t -= DOWN;
    // Back on the ground: it turns to face its crawl again as it leaves the blade.
    return {on: 1 - ease(t / AWAY), up: 0, turn: 1 - ease(t / AWAY)};
}

/** Its place on the blade: on the blade's side `side`, its back out from it, heading up (turn 0) or down (1). */
export function climbPoint(stem: ClimbStem, up: number, turn: number, out: ClimbPoint): ClimbPoint {
    const top = Math.max(0, stem.height * 0.88 - stem.length * 0.6);
    const nx = Math.cos(stem.side);
    const nz = Math.sin(stem.side);
    // A blade's lean of a few degrees toward its side (as drawn), so the bug is on its face, not in it.
    const h = top * up;
    out.x = stem.x + nx * (0.0012 + h * STEM_LEAN);
    out.y = stem.y + h;
    out.z = stem.z + nz * (0.0012 + h * STEM_LEAN);
    out.nx = nx;
    out.ny = 0;
    out.nz = nz;
    // Head up (0) to head down (1): round about its back (the normal), through the blade's width.
    const a = Math.PI * turn;
    const bx = -nz;
    const bz = nx;
    out.tx = bx * Math.sin(a);
    out.ty = Math.cos(a);
    out.tz = bz * Math.sin(a);
    return out;
}

/** Each blade leans this far (m per m) toward the side its bug climbs. */
export const STEM_LEAN = 0.08;

/** A ground point and a blade point mixed (`on`), its frame normalised. */
export function mixClimb(ground: ClimbPoint, blade: ClimbPoint, on: number, out: ClimbPoint): ClimbPoint {
    const k = on;
    out.x = ground.x + (blade.x - ground.x) * k;
    out.y = ground.y + (blade.y - ground.y) * k;
    out.z = ground.z + (blade.z - ground.z) * k;
    let nx = ground.nx + (blade.nx - ground.nx) * k;
    let ny = ground.ny + (blade.ny - ground.ny) * k;
    let nz = ground.nz + (blade.nz - ground.nz) * k;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    let tx = ground.tx + (blade.tx - ground.tx) * k;
    let ty = ground.ty + (blade.ty - ground.ty) * k;
    let tz = ground.tz + (blade.tz - ground.tz) * k;
    const d = tx * nx + ty * ny + tz * nz;
    tx -= d * nx;
    ty -= d * ny;
    tz -= d * nz;
    const tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-4) {
        // Mid-way the heading can pass through its normal: any line across it.
        tx = -nz;
        ty = 0;
        tz = nx;
    } else {
        tx /= tl;
        ty /= tl;
        tz /= tl;
    }
    out.nx = nx;
    out.ny = ny;
    out.nz = nz;
    out.tx = tx;
    out.ty = ty;
    out.tz = tz;
    return out;
}

/** The climbers' blades: a straight, tapering, keeled blade (two crossed strips), dark at its foot. */
function stemGeometry(): BufferGeometry {
    const positions: number[] = [];
    const colours: number[] = [];
    const normals: number[] = [];
    const SEG = 4;
    for (const [ax, az] of [[1, 0], [0, 1]]) {
        for (let i = 0; i < SEG; i++) {
            const t0 = i / SEG;
            const t1 = (i + 1) / SEG;
            const w = (t: number) => 0.0028 * Math.pow(1 - t, 0.6) + 0.0003;
            const p = (t: number, s: number): [number, number, number] => [ax * s * w(t) + STEM_LEAN * t, t, az * s * w(t)];
            const quad = [p(t0, -1), p(t0, 1), p(t1, 1), p(t0, -1), p(t1, 1), p(t1, -1)];
            const ts = [t0, t0, t1, t0, t1, t1];
            // Both faces drawn as their own triangles (a double-sided material turns the whole normal over on the back,
            // its up too, and the blade went black against the light), each lit mostly as the sward it stands in (up),
            // as bug-ground.ts's blades are. The instance squashes y to the blade's height (about 0.14 m) and its normal
            // the other way, so the up is shortened by as much beforehand.
            for (const face of [1, -1]) {
                const order = face > 0 ? [0, 1, 2, 3, 4, 5] : [0, 2, 1, 3, 5, 4];
                for (const k of order) {
                    positions.push(...quad[k]);
                    const tone = 0.3 + 0.7 * Math.pow(ts[k], 0.6);
                    // A living blade's green (bug-ground.ts's #6b9a3a, linear), dark at the root.
                    colours.push(0.147 * tone, 0.323 * tone, 0.042 * tone);
                    normals.push(face * az * 0.39, 0.92 * 0.14, face * ax * 0.39);
                }
            }
        }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    return g;
}

const CAP = 24;

/** The blades of the climbers posed this frame (`note`), drawn near the camera (`update`, once a frame). */
export class ClimbStems {
    readonly mesh: InstancedMesh;
    private noted: ClimbStem[] = [];
    /** The last frame's climbers' blades (read by the proof harness through `mesh.userData.stems`). */
    private last: ClimbStem[] = [];
    private readonly matrix = new Matrix4();
    private readonly position = new Vector3();
    private readonly rotation = new Quaternion();
    private readonly scale = new Vector3();
    private readonly up = new Vector3(0, 1, 0);

    constructor() {
        const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.8, side: FrontSide});
        this.mesh = new InstancedMesh(stemGeometry(), material, CAP);
        this.mesh.count = 0;
        this.mesh.visible = false;
        this.mesh.frustumCulled = false;
        this.mesh.name = "bug-climb-stems";
        this.mesh.receiveShadow = true;
    }

    note(stem: ClimbStem) {
        if (this.noted.length < 256) this.noted.push(stem);
    }

    update(camera: {x: number; y: number; z: number}) {
        let count = 0;
        for (const stem of this.noted) {
            if (count >= CAP) break;
            if (Math.hypot(stem.x - camera.x, stem.y - camera.y, stem.z - camera.z) > STEM_DRAWN_WITHIN) continue;
            // Its lean toward the side its bug climbs: the blade's own +x turned to `side`.
            this.rotation.setFromAxisAngle(this.up, -stem.side);
            this.matrix.compose(this.position.set(stem.x, stem.y - 0.004, stem.z), this.rotation, this.scale.set(1, stem.height + 0.004, 1));
            this.mesh.setMatrixAt(count, this.matrix);
            count++;
        }
        [this.last, this.noted] = [this.noted, this.last];
        this.noted.length = 0;
        this.mesh.userData.stems = this.last;
        this.mesh.count = count;
        this.mesh.visible = count > 0;
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.mesh.geometry.dispose();
        (this.mesh.material as MeshStandardMaterial).dispose();
        this.mesh.dispose();
    }
}
