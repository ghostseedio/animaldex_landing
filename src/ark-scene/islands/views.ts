/**
 * The wild island's whole view (P6, docs/ark/wild-island.md §8): the scene's default view (`index.ts` homeView) as a
 * pure function of the screen's shape and the town's origin, so the tests can check what it frames and what the
 * streamer draws from it. Per world:
 *
 * - v1: today's (home growth's 96 m circle, 114 m on an upright phone, round a point south-east of the lake; with the
 *   town, moved 45 m toward it).
 * - v2: the bigger island's land (x −217…198, z −199…195, `islands/wild/index.ts` wildLandBounds) with the town about
 *   651 m out (190.5 + 250 + 210.25). It is islands mode only, so the camera has the two islands' reach from the start.
 *
 * Pure: no three.js.
 */

import {arkWorld} from "@/ark-scene/world";
import {CAMERA_RANGE} from "@/ark-scene/runtime/camera";
import {townWorldOrigin} from "@/ark-scene/islands/index";

/** With two islands in the world, the camera reaches out over both (the town's whole view is ~600 m off). */
export const ISLANDS_MAX_DISTANCE = 900;

export type WildFrame = {
    /** The circle the whole view fits (m): wide screens, upright phones (aspect under 0.8). */
    radius: number;
    radiusTall: number;
    /** With the town, an upright phone's view from this far whatever its width (m; null: from `radiusTall`). */
    distanceTall: number | null;
    /** Where the view looks (wide, upright). */
    target: {x: number; z: number};
    targetTall: {x: number; z: number};
    /** With the town in the world, the wide view's target moves this far toward it (m). */
    toTown: number;
    /** The upright view across the strait: its target moves this far toward the town (m), and its polar angle. */
    toTownTall: number;
    polarTall: number;
    /** The camera's reach (m): the whole view's distance is held to `reach`, the user's zoom to `reachIslands` once the town is in. */
    reach: number;
    reachIslands: number;
    /** With the town in the world, the idle drift sways ± this (rad) about where the view was; null: it goes round. */
    driftSway: number | null;
    /** A region's view (`focusRegion`) from this polar angle (rad from straight down; null: the view's own), at least this far (m). */
    regionPolar: number | null;
    regionNearest: number;
};

/** The wild island's whole-view frame in the world in use. */
export function wildFrame(): WildFrame {
    // v2's upright view (decision rows, docs/ark/wild-island.md §9): from 950 m on every upright phone, looking down
    // a little more (0.9 rad from straight down) and aimed 130 m out toward the town, so the town's far shore stays inside
    // the low tier's 1,600 m map distance; the island fills the frame's width (its east and west tips just outside).
    if (arkWorld() === "v2") return {radius: 204, radiusTall: 236, distanceTall: 950, target: {x: -10, z: 22}, targetTall: {x: -10, z: 0}, toTown: 70, toTownTall: 130, polarTall: 0.9, reach: 1000, reachIslands: 1000, driftSway: 0.12, regionPolar: 0.62, regionNearest: 110};
    return {radius: 96, radiusTall: 114, distanceTall: null, target: {x: 12, z: 14}, targetTall: {x: 16, z: 24}, toTown: 45, toTownTall: 0, polarTall: 1.15, reach: CAMERA_RANGE.far, reachIslands: ISLANDS_MAX_DISTANCE, driftSway: null, regionPolar: null, regionNearest: 48};
}

export type WildHomeView = {target: {x: number; y: number; z: number}; distance: number; polar: number; azimuth: number};

/**
 * The whole world in view, from the south and above (`index.ts` homeView): the screen's `aspect` (width / height), the
 * vertical field of view (degrees), and the town's world origin when it is in the world (else null).
 */
export function wildHomeView(aspect: number, fovDegrees: number, townIn: {x: number; z: number} | null, townComing = false): WildHomeView {
    // (v2, with the town coming (the archipelago's two islands, built after the first frame): its place across the strait
    // is known before it is built, so the first frame is already the two-island view and nothing moves when it joins.
    // Without it (one island: the apps' embed with `?world=v2`) the island alone.)
    const town = townIn ?? (townComing && arkWorld() === "v2" ? townWorldOrigin() : null);
    const vertical = fovDegrees * Math.PI / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
    const fit = Math.min(vertical, horizontal);
    // Home growth (2026-11-11): the island reaches about 30 m further south and east (the hamlet's district), so the
    // view centres a little south-east of the lake and fits a wider circle. (P6: the v2 island's own, `wildFrame`.)
    const frame = wildFrame();
    const radius = aspect < 0.8 ? frame.radiusTall : frame.radius;
    const distance = aspect < 0.8 && town && frame.distanceTall !== null ? Math.min(frame.distanceTall, frame.reach) : Math.min(radius / Math.sin(fit / 2) * 0.8, frame.reach);
    // Part C, one world: the wild island as before, turned and raised a little so the town stands across the strait
    // beyond its far shore (decision 142).
    if (town) return twoIslandHome(aspect, distance, town, frame);
    // Low enough to see the horizon over the island's far shore.
    const at = aspect < 0.8 ? frame.targetTall : frame.target;
    return {target: {x: at.x, y: 0, z: at.z}, distance: distance * 0.94, polar: 1.06, azimuth: 0};
}

/** The default view with the town beside the wild island: turned toward it and raised a little, the town across the strait. */
function twoIslandHome(aspect: number, distance: number, o: {x: number; z: number}, frame: WildFrame): WildHomeView {
    const length = Math.hypot(o.x, o.z) || 1;
    const ux = o.x / length;
    const uz = o.z / length;
    // Upright phones (decision 154): the narrow frame looks straight across the strait, the wild island the subject in
    // the middle and the town in the upper part beyond it. Wider screens: turned 45% of the way, the town upper right.
    const tall = aspect < 0.8;
    const tx = tall ? frame.targetTall.x + ux * frame.toTownTall : frame.target.x + ux * frame.toTown;
    const tz = tall ? frame.targetTall.z + uz * frame.toTownTall : frame.target.z + uz * frame.toTown;
    let fx = ux * 0.45;
    let fz = -1 + (uz + 1) * 0.45;
    if (tall) {
        const dx = o.x - tx;
        const dz = o.z - tz;
        const d = Math.hypot(dx, dz) || 1;
        fx = dx / d;
        fz = dz / d;
    }
    const azimuth = Math.atan2(-fx, -fz);
    return {target: {x: tx, y: 0, z: tz}, distance: distance * (tall ? 1.0 : 1.12), polar: tall ? frame.polarTall : 1.15, azimuth};
}

/** The camera's eye for a view (three's Spherical about the target: polar from +y, azimuth about +y from +z). */
export function viewEye(view: WildHomeView): {x: number; y: number; z: number} {
    const s = Math.sin(view.polar) * view.distance;
    return {x: view.target.x + s * Math.sin(view.azimuth), y: view.target.y + Math.cos(view.polar) * view.distance, z: view.target.z + s * Math.cos(view.azimuth)};
}
