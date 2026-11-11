/**
 * The controller's cameras (design §4.7, §4.8). Pure maths: the scene applies the result to its camera.
 *
 * Third person: behind and a little above the animal (max(4 D, 0.6 m) back, 0.6 D up; 1.5 × that in flight), on the
 * view's turn and tilt. A sphere-cast from the animal to the wanted eye pulls the camera in before a trunk, a rock, a
 * wall or the ground; it stays on the animal's side of the water's surface; it never goes under ground.
 *
 * First person: at the head, looking where the view looks, the head turning up to the rig's look limits (quadrupeds
 * 70°, birds 110°, owls 170°). The horizontal field of view is the species' (`species.ts`: 80° forward-eyed hunters,
 * 70° owls, 115° wide-eyed prey and insects), capped by the tier (120° high, 110° medium, 90° low) and by a 75°
 * vertical; portrait screens show less (the HUD suggests turning the phone). The near plane comes in to
 * max(0.02, 0.1 D) so small animals can see.
 */

import type {Abilities} from "@/ark-live/species";
import type {Mode} from "@/ark-live/protocol";

export type Vec = {x: number; y: number; z: number};
export type CameraPose = {eye: Vec; target: Vec; fov: number; near: number};

export const THIRD_PERSON_VFOV = 45;
export const VFOV_CAP = 75;
export const TIER_HFOV_CAP = {high: 120, medium: 110, low: 90, lite: 90} as const;
const EYE_RADIUS = 0.35;

export type CameraWorld = {
    ground: (x: number, z: number) => number;
    /** A solid obstacle at the point for something of this radius (the sampler's `blocked`). */
    blocked: (x: number, z: number, radius: number) => boolean;
    /** The water's surface over a point, or null on land. */
    water: (x: number, z: number) => number | null;
};

/** The animal's middle, from its pose (feet for grounded modes, the body's middle in the water and the air). */
export function bodyMiddle(p: {x: number; y: number; z: number; mode: Mode}, D: number): Vec {
    const grounded = p.mode === "ground" || p.mode === "wade" || p.mode === "climb" || p.mode === "burrow";
    return {x: p.x, y: grounded ? p.y + 0.4 * D : p.y, z: p.z};
}

export function thirdPerson(p: {x: number; y: number; z: number; mode: Mode}, a: Abilities, view: {yaw: number; pitch: number}, world: CameraWorld): CameraPose {
    const D = a.D;
    const target = bodyMiddle(p, D);
    target.y += 0.2 * D;
    const flying = p.mode === "air" || p.mode === "strait";
    const distance = Math.max(4 * D, 0.6) * (flying ? 1.5 : 1);
    const pitch = Math.max(-1.2, Math.min(0.6, view.pitch));
    // Behind the view: the view looks along its yaw, so the eye sits the other way.
    const back = {x: -Math.sin(view.yaw) * Math.cos(pitch), y: -Math.sin(pitch), z: -Math.cos(view.yaw) * Math.cos(pitch)};
    const want = {x: target.x + back.x * distance, y: target.y + back.y * distance + 0.6 * D, z: target.z + back.z * distance};
    // Sphere-cast from the animal to the eye: stop short of the first thing in the way.
    const steps = Math.max(4, Math.ceil(distance / 0.25));
    let eye = {...target};
    const underwater = (() => {
        const level = world.water(p.x, p.z);
        return level !== null && target.y < level;
    })();
    for (let i = 1; i <= steps; i++) {
        const f = i / steps;
        const x = target.x + (want.x - target.x) * f;
        const z = target.z + (want.z - target.z) * f;
        let y = target.y + (want.y - target.y) * f;
        const g = world.ground(x, z);
        if (world.blocked(x, z, EYE_RADIUS) && f > 0.15) break;
        // Under ground (a burrow's cutaway too): over the ground instead.
        if (y < g + EYE_RADIUS) y = g + EYE_RADIUS;
        // The animal's side of the surface, never straddling it.
        const level = world.water(x, z);
        if (level !== null) {
            if (underwater && y > level - 0.2) y = level - 0.2;
            if (!underwater && y < level + 0.2) y = level + 0.2;
        }
        eye = {x, y, z};
    }
    return {eye, target, fov: THIRD_PERSON_VFOV, near: Math.max(0.05, Math.min(0.4, 0.15 * D))};
}

/** How far the head turns before the body follows (radians), by body plan (`rig-clips.ts` RIG_LOOK_LIMITS). */
export function lookLimit(a: Abilities): number {
    if (a.fovClass === "owl") return (170 * Math.PI) / 180;
    if (a.body === "b") return (110 * Math.PI) / 180;
    return (70 * Math.PI) / 180;
}

export function horizontalFov(a: Abilities, tier: keyof typeof TIER_HFOV_CAP): number {
    return Math.min(a.fov, TIER_HFOV_CAP[tier]);
}

/** The vertical FOV that shows `hfov` degrees across at this aspect (width / height), capped at 75°. */
export function verticalFov(hfov: number, aspect: number): number {
    const h = (hfov * Math.PI) / 180;
    const v = 2 * Math.atan(Math.tan(h / 2) / Math.max(aspect, 0.1));
    return Math.min((v * 180) / Math.PI, VFOV_CAP);
}

export function firstPerson(p: {x: number; y: number; z: number; yaw: number; mode: Mode}, a: Abilities, view: {yaw: number; pitch: number}, aspect: number, tier: keyof typeof TIER_HFOV_CAP, world: CameraWorld): CameraPose {
    const D = a.D;
    const middle = bodyMiddle(p, D);
    // The head: forward of the middle and up a little.
    const head = {x: middle.x + Math.sin(p.yaw) * 0.42 * D, y: middle.y + 0.25 * D, z: middle.z + Math.cos(p.yaw) * 0.42 * D};
    const g = world.ground(head.x, head.z);
    if (p.mode !== "burrow" && head.y < g + 0.03) head.y = g + 0.03;
    // The head turns within its limits; past them it holds (the body follows the input).
    let turn = view.yaw - p.yaw;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    const limit = lookLimit(a);
    turn = Math.max(-limit, Math.min(limit, turn));
    const yaw = p.yaw + turn;
    const pitch = Math.max(-1.1, Math.min(1.1, view.pitch));
    const target = {x: head.x + Math.sin(yaw) * Math.cos(pitch), y: head.y + Math.sin(pitch), z: head.z + Math.cos(yaw) * Math.cos(pitch)};
    return {eye: head, target, fov: verticalFov(horizontalFov(a, tier), aspect), near: Math.max(0.02, 0.1 * D)};
}
