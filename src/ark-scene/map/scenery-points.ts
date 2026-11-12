/**
 * The graphics lane's attach points (`sampler.ts` allAttachPoints, docs/ark/graphics-interface.md) as the map's
 * (`map/sampler.ts` AttachPoint), for the map's samplers: today's island's stub (`world-sampler.ts`) and, on the v2
 * world (Part C), the bigger wild island's (`islands/wild/map-sampler.ts`), so both read the scenery's points the same
 * way. Split out of `world-sampler.ts` unchanged.
 */

import type {AttachPoint as SceneryPoint, AttachTag as SceneryTag} from "@/ark-scene/sampler";
import type {AttachPoint, AttachTag} from "@/ark-scene/map/sampler";
import type {ArkZone} from "@/ark-scene/types";
import {inRock} from "@/ark-scene/map/rocks";

/** The map's ground-level attach tags (a hole, a burrow's mouth, a fallen leaf): never inside a drawn rock. */
export const GROUND_TAGS: ReadonlySet<AttachTag> = new Set<AttachTag>(["worm_hole", "burrow_entrance"]);

/** The scenery interface's attach tags as the map's (`sampler.ts` ATTACH_MEANS): a pond's surface is the water species' (`water.ts`), hang points not yet used. */
export const SCENERY_TAG: Partial<Record<SceneryTag, AttachTag>> = {
    leaf: "leaf", branch: "branch", bark: "bark", flower_head: "flower_head", rock_face: "rock_face", tide_pool: "tide_pool",
    house_wall: "house_wall", house_eave: "house_eave", porch_light: "porch_light", lamp: "porch_light", leaf_litter: "leaf",
    worm_hole: "worm_hole", burrow: "burrow_entrance", canopy_perch: "branch", canopy_climb: "bark",
    limb: "limb", canopy_hang: "canopy_hang", fence_post: "fence_post", roof_edge: "roof_edge", ledge: "ledge", tree_hollow: "tree_hollow"
};

/**
 * A point's heading along its surface: its `forward` where the scenery
 * gives one, else the sampler's own convention (graphics-interface.md: the
 * model's quaternion is setFromUnitVectors(+y, normal) · rotationY(yaw), so
 * its +z goes to that rotation of (sin yaw, 0, cos yaw)), laid square to
 * the normal.
 */
export function headingOf(n: [number, number, number], yaw: number, forward?: {x: number; y: number; z: number}): [number, number, number] {
    let t: [number, number, number];
    if (forward) t = [forward.x, forward.y, forward.z];
    else {
        // The rotation taking +y to n (axis +y × n, by the angle between them), applied to (sin yaw, 0, cos yaw).
        const v: [number, number, number] = [Math.sin(yaw), 0, Math.cos(yaw)];
        const axis: [number, number, number] = [n[2], 0, -n[0]];
        const s = Math.hypot(...axis);
        const c = n[1];
        if (s < 1e-9) t = c > 0 ? v : [v[0], -v[1], -v[2]];
        else {
            const k: [number, number, number] = [axis[0] / s, axis[1] / s, axis[2] / s];
            const dot = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
            const cross: [number, number, number] = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
            t = [0, 1, 2].map((i) => v[i] * c + cross[i] * s + k[i] * dot * (1 - c)) as [number, number, number];
        }
    }
    const d = t[0] * n[0] + t[1] * n[1] + t[2] * n[2];
    t = [t[0] - d * n[0], t[1] - d * n[1], t[2] - d * n[2]];
    const l = Math.hypot(...t) || 1;
    if (l < 1e-6) return Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    return [t[0] / l, t[1] / l, t[2] / l];
}

/**
 * A scenery point as the map's, or null: a tag the map does not use, or a hole, a burrow's mouth, a fallen leaf or a
 * ground ledge inside a drawn rock. Its id and normal as they are, a heading from its yaw, and its largest body (any
 * smaller one fits: a 2 mm spider on a wall); `zoneAt` names its zone when the scenery gives none.
 */
export function sceneryMapPoint(point: SceneryPoint, zoneAt: (x: number, z: number) => ArkZone): AttachPoint | null {
    const tag = SCENERY_TAG[point.tag];
    if (!tag) return null;
    // A hole, a burrow's mouth or a fallen leaf on the ground never inside a drawn rock (the asset rocks, `rocks.ts`).
    if ((GROUND_TAGS.has(tag) || point.tag === "leaf_litter") && inRock(point.position.x, point.position.z, 0.15)) return null;
    // (Nor a ledge of the ground's own cliffs inside one: the scenery lane's outcrops sit on the slopes the ledges are
    // on, and a ledge in an outcrop put its animal in the rock. Motion pass L5, at L6's ask.)
    if (point.tag === "ledge" && point.host === "ground" && inRock(point.position.x, point.position.z, 0.15)) return null;
    const n: [number, number, number] = [point.normal.x, point.normal.y, point.normal.z];
    // A limb or a hang point keeps its least body (it is for large climbers and hangers); any smaller body fits the rest.
    // (True scale, motion pass §3: down to 0.1 mm, a fairyfly's 0.16 mm or a mite's 0.5 mm; 1 mm was the old drawn floor.)
    const min = tag === "limb" || tag === "canopy_hang" ? point.size[0] : Math.min(point.size[0], 0.0001);
    const limb = point.radius !== undefined ? {radius: point.radius, load: point.load, clearAbove: point.clearAbove, clearBelow: point.clearBelow} : {};
    return {id: point.id, tag, x: point.position.x, y: point.position.y, z: point.position.z, normal: n, tangent: headingOf(n, point.yaw, point.forward), size: {min, max: point.size[1]}, zone: point.zone ?? zoneAt(point.position.x, point.position.z), ...(point.wind ? {source: point} : {}), ...limb};
}
