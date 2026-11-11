/**
 * Standing on things (motion 100x pass, lane L3: "animals float or sink; tree animals aren't properly on
 * branches"). Pure: the scene (`index.ts`, through `grounding/hook.ts`), the audit and the validator call the same
 * functions, so what is checked is what is drawn.
 *
 * - On the ground: the model's contacts (its footprint at its true base, `base.ts`) on the DRAWN ground
 *   (`drawn-ground.ts`), the body leaning to the slope along its length (pitch) and a little across it (roll), and
 *   lifted until its highest-standing contact touches: nothing sinks into the slope, and on a plane every contact
 *   touches. (The rig's foot IK, lane L1, then plants each foot on the ground under it.)
 * - On a surface (a branch, a limb, bark, a wall, a rock face, a leaf): its back along the surface's normal and its
 *   base (or, with a rig, the sole of its gripping feet, not the bones' pivots) on the point.
 *
 * Model units in, metres out: `scale` is the drawn scale (metres per model unit).
 */

import {drawnGround, drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import type {Footprint} from "@/ark-scene/grounding/base";

/** How far a body leans to the slope along its length, and across it (radians). */
export const MAX_PITCH = 0.5;
export const MAX_ROLL = 0.18;

export type Stand = {
    /** The model's origin height (m). */
    rootY: number;
    /** Lean along its length (radians, the scene's convention: positive puts the head down). */
    pitch: number;
    /** Lean across it (radians about its length). */
    roll: number;
    /** The drawn ground under its middle (m). */
    ground: number;
};

/**
 * The model's origin and lean so its contacts stand on the drawn ground (the scene's Euler order: yaw, then
 * pitch, then roll, `YXZ`). `base` is the level's true base, `footprint` its contacts' extent; both model units.
 * `extraPitch` and `extraRoll` are the pose's own (a recipe's lean, sleep's roll): the contacts are found with them.
 */
export function standOnGround(x: number, z: number, yaw: number, scale: number, base: number, footprint: Footprint, extraPitch = 0, extraRoll = 0, ground: (x: number, z: number) => number = drawnGroundHeight): Stand {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    // Heading (+z of the model) and across it (+x of the model) in the world.
    const along = (lx: number, lz: number) => ({x: x + (lx * cy + lz * sy) * scale, z: z + (-lx * sy + lz * cy) * scale});
    const zc = (footprint.z0 + footprint.z1) / 2;
    const xc = (footprint.x0 + footprint.x1) / 2;
    const length = Math.max((footprint.z1 - footprint.z0) * scale, 1e-4);
    const width = Math.max((footprint.x1 - footprint.x0) * scale, 1e-4);
    const front = along(xc, footprint.z1);
    const back = along(xc, footprint.z0);
    const left = along(footprint.x1, zc);
    const right = along(footprint.x0, zc);
    const gf = ground(front.x, front.z);
    const gb = ground(back.x, back.z);
    const gl = ground(left.x, left.z);
    const gr = ground(right.x, right.z);
    const pitch = Math.max(Math.min(Math.atan2(gb - gf, length), MAX_PITCH), -MAX_PITCH);
    const roll = Math.max(Math.min(Math.atan2(gl - gr, width), MAX_ROLL), -MAX_ROLL);
    const p = pitch + extraPitch;
    const r = roll + extraRoll;
    // R = Ry(yaw) · Rx(p) · Rz(r): each contact's offset from the origin, in the world.
    const cp = Math.cos(p);
    const sp = Math.sin(p);
    const cr = Math.cos(r);
    const sr = Math.sin(r);
    let rootY = -Infinity;
    const contacts: Array<[number, number]> = [
        [xc, footprint.z1],
        [xc, footprint.z0],
        [footprint.x1, zc],
        [footprint.x0, zc],
        [footprint.x1, footprint.z1],
        [footprint.x0, footprint.z1],
        [footprint.x1, footprint.z0],
        [footprint.x0, footprint.z0]
    ];
    for (const [lx, lz] of contacts) {
        // Rz(r)
        const x1 = (lx * cr - base * sr) * scale;
        const y1 = (lx * sr + base * cr) * scale;
        const z1 = lz * scale;
        // Rx(p): y, z
        const y2 = y1 * cp - z1 * sp;
        const z2 = y1 * sp + z1 * cp;
        // Ry(yaw): x, z
        const wx = x + x1 * cy + z2 * sy;
        const wz = z - x1 * sy + z2 * cy;
        rootY = Math.max(rootY, ground(wx, wz) - y2);
    }
    return {rootY, pitch, roll, ground: ground(x, z)};
}

export type SurfaceFrame = {
    x: number;
    y: number;
    z: number;
    nx: number;
    ny: number;
    nz: number;
    tx: number;
    ty: number;
    tz: number;
};

/**
 * A surface frame for a pose the schedule holds on a raised point (a branch, a limb, bark, a wall, a rock face):
 * its normal from the schedule, its heading along the surface (up the trunk on anything steeper than 60 degrees,
 * else its yaw laid onto the surface). Null on the ground or in the air.
 */
export function scheduleSurface(at: {x: number; y: number; z: number; yaw: number; nx: number; ny: number; nz: number}, forward?: {x: number; y: number; z: number} | null): SurfaceFrame {
    const n = Math.hypot(at.nx, at.ny, at.nz) || 1;
    const nx = at.nx / n;
    const ny = at.ny / n;
    const nz = at.nz / n;
    let hx: number;
    let hy: number;
    let hz: number;
    if (forward) {
        hx = forward.x;
        hy = forward.y;
        hz = forward.z;
    } else if (ny < 0.5 && ny > -0.5) {
        // A wall or a trunk: head up it.
        hx = 0;
        hy = 1;
        hz = 0;
    } else {
        hx = Math.sin(at.yaw);
        hy = 0;
        hz = Math.cos(at.yaw);
    }
    const dot = hx * nx + hy * ny + hz * nz;
    let tx = hx - nx * dot;
    let ty = hy - ny * dot;
    let tz = hz - nz * dot;
    let l = Math.hypot(tx, ty, tz);
    if (l < 1e-4) {
        // Heading straight into the surface: along it, across the world's up instead.
        tx = -nz;
        ty = 0;
        tz = nx;
        l = Math.hypot(tx, tz) || 1;
    }
    return {x: at.x, y: at.y, z: at.z, nx, ny, nz, tx: tx / l, ty: ty / l, tz: tz / l};
}

/** The drawn ground's height and normal under a point (re-exported for the scene's one import). */
export {drawnGround, drawnGroundHeight};
