/**
 * The scene's one way into grounding (motion 100x pass, lane L3): small named calls `index.ts` makes where it
 * stands an animal, so the wiring there stays a few lines (the integrator resolves `index.ts`; the rules live
 * here and in `stand.ts`, where the audit and the validator call them too).
 *
 * - `groundedLevelBase`: the height of the drawn mesh that goes on the ground or the surface (its true base, per
 *   level), instead of the bounding box's floor of whichever level loaded first.
 * - `groundedStand`: a ground pose's model origin and lean on the drawn ground (the pose's own offsets, a sleeping
 *   body's drop, an idle's lift, a den, a gait's bob, carried over).
 * - `scheduledPerch`: a schedule pose held on a raised point (a branch, a limb, bark, a wall, a rock face) as a
 *   surface the scene draws it on (its back along the normal, heading up a trunk), moving with its tree in the wind.
 * - `gripSoleDrop`: how far a gripping rig's soles are below its grip bones' pivots (so its toes, not its ankles,
 *   are on the branch).
 * - `clipStand`: a standing clip's own height off its rest sole, taken off.
 * - the runtime check (`groundingCheck`): with `?grounding=1` (development) each drawn animal's contacts against what
 *   it stands on, counted per animal and kind; `window.__arkDebug.grounding()` reads it.
 */

import {onHamletSwitch} from "@/ark-scene/no-hamlet";
import {allAttachPoints, attachSway, type AttachPoint} from "@/ark-scene/sampler";
import {clipStandOffset, levelBase, meanDrop, modelBase, type ModelLevelName} from "@/ark-scene/grounding/base";
import {drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import {scheduleSurface, standOnGround, type Stand, type SurfaceFrame} from "@/ark-scene/grounding/stand";

/** The level's true base (model units); `minY` for a model the base file does not list. */
export function groundedLevelBase(slug: string, level: ModelLevelName | "rig" | "token", minY: number): number {
    return levelBase(slug, level === "far" ? "far" : "near", minY);
}

export type GroundStandInput = {
    slug: string;
    level: ModelLevelName | "rig";
    x: number;
    z: number;
    yaw: number;
    /** The pose's own lean (a recipe's, sleep's): the contacts are found with it. */
    pitch: number;
    roll: number;
    /** Metres per model unit as drawn. */
    scale: number;
    /** The loaded mesh's bounding-box floor (the fallback base). */
    minY: number;
    /** A rig's standing clip now, and how much of it is drawn (its height off rest is taken off). */
    clip?: string | null;
    clipWeight?: number;
};

/**
 * Whether a pose stands on the ground (not in the air, on a surface, in the water, on something raised): its base is
 * at or below the ground under it (the analytic ground the schedule reads, or the drawn one), over dry land.
 */
export function standsOnGround(pose: {x: number; z: number; base: number; afloat: boolean; surface?: unknown; water?: unknown}, analytic: number): boolean {
    if (pose.afloat || pose.surface || pose.water || analytic <= 0.02) return false;
    return pose.base <= Math.max(analytic, drawnGroundHeight(pose.x, pose.z)) + 0.05;
}

/** The origin and extra lean for a ground pose (null: the model is not listed; the scene keeps its own rule). */
export function groundedStand(input: GroundStandInput): Stand | null {
    const found = modelBase(input.slug);
    if (!found) return null;
    const base = levelBase(input.slug, input.level === "far" ? "far" : "near", input.minY);
    // (On ground too uneven to lie on, its highest contact may go in a little, well inside the tolerance, so the rest float less.)
    const give = 0.5 * Math.max(0.02, 0.03 * found.size.y * input.scale);
    const stand = standOnGround(input.x, input.z, input.yaw, input.scale, base, found.footprint, input.pitch, input.roll, undefined, give);
    if (input.clip && input.level === "rig") stand.rootY -= clipStandOffset(input.slug, input.clip) * input.scale * (input.clipWeight ?? 1);
    return stand;
}

let byId: Map<string, AttachPoint> | null = null;
// Islands mode flips (`no-hamlet.ts`): built from the other world's scenery.
onHamletSwitch(() => {
    byId = null;
});
function attachPoint(id: string): AttachPoint | null {
    byId ??= new Map(allAttachPoints().map((point) => [point.id, point]));
    return byId.get(id) ?? null;
}

/** Off the ground: anything the schedule holds it on that is not the ground (its point's tag, or its pose's normal). */
export const RAISED_POINT_TAGS: ReadonlySet<string> = new Set(["branch", "bark", "leaf", "rock_face", "house_wall", "house_eave", "cliff_ledge", "ledge", "post", "fence_post", "roof_edge", "log_top", "log", "tree_hollow", "canopy_hang", "limb", "canopy_perch", "canopy_climb", "rock_top", "flower_head", "porch_light", "lamp"]);

/**
 * A schedule pose on a raised point as a surface frame (null on the ground, in the air or in the water): at its
 * destination's attach point (moving with its tree's sway, its heading the point's own along a branch or up a
 * trunk), or between points on a climb (the schedule's interpolated normal).
 */
export function scheduledPerch(at: {x: number; y: number; z: number; yaw: number; nx: number; ny: number; nz: number; moving: boolean; aloft: boolean}, to: {point: string | null} | null | undefined, arrived: boolean, time: number, wind: {x: number; y: number}): SurfaceFrame | null {
    if (at.aloft) return null;
    const point = arrived && to?.point ? attachPoint(to.point) : null;
    if (point && RAISED_POINT_TAGS.has(point.tag) && Math.hypot(at.x - point.position.x, at.z - point.position.z) < 0.05) {
        const sway = attachSway(point, time, wind);
        const steep = Math.abs(point.normal.y) < 0.5;
        const frame = scheduleSurface({x: point.position.x + sway.x, y: point.position.y + sway.y, z: point.position.z + sway.z, yaw: at.yaw, nx: point.normal.x, ny: point.normal.y, nz: point.normal.z}, steep ? point.forward ?? null : null);
        return frame;
    }
    if (at.ny < 0.95) return scheduleSurface(at);
    return null;
}

/** How far below its grip bones' pivots a gripping rig's soles are (model units; 0 without measured feet). */
export function gripSoleDrop(slug: string): number {
    return meanDrop(slug);
}

// MARK: Before and after (development)

let rules: "grounded" | "legacy" | null = null;
/**
 * Which rules the scene draws by: "grounded" (this lane's), or, in development with `?grounding=legacy`, the scene's
 * old ones (the bounding box's floor on the analytic ground, upright off the ground), so before-and-after shots come
 * from one build. `?grounding=1` (or `legacy`) also turns the runtime check on.
 */
export function groundingRules(): "grounded" | "legacy" {
    if (rules) return rules;
    rules = "grounded";
    if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
        const asked = new URLSearchParams(window.location.search).get("grounding");
        if (asked === "legacy") rules = "legacy";
        if (asked === "legacy" || asked === "1") groundingCheck.on = true;
    }
    return rules;
}

/** Development (the before-and-after shots): switch the rules on a running scene; `window.__arkGrounding` too. */
export function setGroundingRules(next: "grounded" | "legacy"): void {
    if (process.env.NODE_ENV === "production") return;
    rules = next;
}

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as {__arkGrounding?: unknown}).__arkGrounding = {
        setRules: (next: "grounded" | "legacy") => setGroundingRules(next),
        rules: () => groundingRules(),
        check: (on: boolean) => {
            groundingCheck.on = on;
        },
        report: () => groundingCheck.report(),
        reset: () => groundingCheck.reset()
    };
}

// MARK: The runtime check (development)

export type GroundingKindNow = "ground" | "surface";
type Tally = {slug: string; kind: GroundingKindNow; worst: number; floats: number; sinks: number; frames: number};

/** Development: `?grounding=1` turns the runtime check on (never in production). */
export const groundingCheck = {
    on: false,
    tallies: new Map<string, Tally>(),
    /**
     * One drawn animal this frame: its contacts' lowest gap (m) to what it stands on and the tolerance (its drawn height's).
     * Counts a frame as floating or sunk past the tolerance.
     */
    record(id: string, slug: string, kind: GroundingKindNow, gap: number, drawnHeight: number) {
        if (!this.on) return;
        const tolerance = Math.max(0.02, 0.03 * drawnHeight);
        const tally = this.tallies.get(id) ?? {slug, kind, worst: 0, floats: 0, sinks: 0, frames: 0};
        tally.frames++;
        if (gap > tolerance) tally.floats++;
        if (gap < -tolerance) tally.sinks++;
        if (Math.abs(gap) > Math.abs(tally.worst)) tally.worst = gap;
        this.tallies.set(id, tally);
    },
    report() {
        const rows = Array.from(this.tallies.entries()).map(([id, t]) => ({id, ...t}));
        return {
            animals: rows.length,
            floating: rows.filter((r) => r.floats > 0).length,
            sinking: rows.filter((r) => r.sinks > 0).length,
            /** Off in more than a tenth of the frames it was drawn (not a passing frame: a level swap, a push, a hop). */
            floatingMostly: rows.filter((r) => r.floats > 0.1 * r.frames).length,
            sinkingMostly: rows.filter((r) => r.sinks > 0.1 * r.frames).length,
            worst: rows.sort((a, b) => Math.abs(b.worst) - Math.abs(a.worst)).slice(0, 20).map((r) => ({slug: r.slug, kind: r.kind, worst: Math.round(r.worst * 1000) / 1000, floats: r.floats, sinks: r.sinks, frames: r.frames}))
        };
    },
    reset() {
        this.tallies.clear();
    }
};

/**
 * The lowest of a drawn ground animal's contacts over the drawn ground (m), from the matrix the scene composed: its
 * origin, its rotation (a quaternion) and scale. For the runtime check.
 */
export function drawnContactGap(slug: string, level: ModelLevelName | "rig", minY: number, position: {x: number; y: number; z: number}, q: {x: number; y: number; z: number; w: number}, scale: number): number | null {
    const found = modelBase(slug);
    if (!found) return null;
    const base = levelBase(slug, level === "far" ? "far" : "near", minY);
    const f = found.footprint;
    const zc = (f.z0 + f.z1) / 2;
    const xc = (f.x0 + f.x1) / 2;
    let lowest = Infinity;
    // (The same eight contacts `standOnGround` stands on: the footprint's edges' middles and its corners.)
    for (const [lx, lz] of [[xc, f.z1], [xc, f.z0], [f.x1, zc], [f.x0, zc], [f.x1, f.z1], [f.x0, f.z1], [f.x1, f.z0], [f.x0, f.z0]] as const) {
        // v' = q v q*
        const vx = lx * scale;
        const vy = base * scale;
        const vz = lz * scale;
        const ix = q.w * vx + q.y * vz - q.z * vy;
        const iy = q.w * vy + q.z * vx - q.x * vz;
        const iz = q.w * vz + q.x * vy - q.y * vx;
        const iw = -q.x * vx - q.y * vy - q.z * vz;
        const wx = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y;
        const wy = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z;
        const wz = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x;
        lowest = Math.min(lowest, position.y + wy - drawnGroundHeight(position.x + wx, position.z + wz));
    }
    return lowest;
}

/**
 * A drawn surface animal's base contact (its origin plus its up times its base) against its surface point, along the
 * surface's normal (m): positive off the surface, negative into it. For the runtime check.
 */
export function surfaceContactGap(slug: string, level: ModelLevelName | "rig", minY: number, position: {x: number; y: number; z: number}, q: {x: number; y: number; z: number; w: number}, scale: number, point: {x: number; y: number; z: number}, normal: {nx: number; ny: number; nz: number}): number {
    const base = levelBase(slug, level === "far" ? "far" : "near", minY) * scale;
    // The model's up (0, 1, 0) turned by q.
    const ux = 2 * (q.x * q.y - q.w * q.z);
    const uy = 1 - 2 * (q.x * q.x + q.z * q.z);
    const uz = 2 * (q.y * q.z + q.w * q.x);
    const cx = position.x + ux * base - point.x;
    const cy = position.y + uy * base - point.y;
    const cz = position.z + uz * base - point.z;
    return cx * normal.nx + cy * normal.ny + cz * normal.nz;
}
