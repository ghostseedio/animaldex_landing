/**
 * Cross-layer moments (the layers addendum): a seabird diving into the sea,
 * a whale surfacing to blow, an owl swooping from its branch, a primate
 * dropping to the ground. Visual only and cosmetic: nothing is caught or
 * eaten, nobody else takes part, and the animal ends where it began, so a
 * moment never looks like a meal (meals are the server's, acted out by
 * `acts.ts`). They are the livestream director's shot options
 * (`lib/ark-clips/shots.ts`), and the scene's `moment()`.
 *
 * Pure: the path of each moment from where the animal is, as a function of
 * time, so it is the same for every viewer and testable.
 */

import {speciesLayer} from "@/ark-scene/layers";
import type {ArkZone} from "@/ark-scene/types";
import {heightAt} from "@/ark-scene/world";

export const ARK_MOMENTS = ["seabird_dive", "whale_surface", "owl_swoop", "primate_drop"] as const;
export type ArkMomentKind = (typeof ARK_MOMENTS)[number];

/** How long each lasts (s). */
export const MOMENT_SECONDS: Record<ArkMomentKind, number> = {seabird_dive: 7, whale_surface: 8, owl_swoop: 6, primate_drop: 7};

const SEABIRD = /(?:^|-)(?:gull|tern|gannet|booby|pelican|puffin|cormorant|shag|shearwater|petrel|albatross|frigatebird|skua|osprey|fish-eagle|kingfisher|noddy|tropicbird|murre|guillemot|razorbill|auk|prion|fulmar)(?:-|$)/;
const WHALE = /(?:^|-)(?:whale|dolphin|orca|porpoise|beluga|narwhal|vaquita)(?:-|$)(?!shark)/;
const OWL = /(?:^|-)owl(?:-|$)/;
const SEA_ZONES = new Set<ArkZone>(["coral_reef", "open_ocean"]);

/** Whether a species can act out this moment (from its slug, its zone and its layer: stored data only). */
export function canMoment(kind: ArkMomentKind, slug: string, zone: ArkZone): boolean {
    switch (kind) {
        case "seabird_dive":
            return SEABIRD.test(slug);
        case "whale_surface":
            return WHALE.test(slug) && SEA_ZONES.has(zone);
        case "owl_swoop":
            return OWL.test(slug) && !SEA_ZONES.has(zone);
        case "primate_drop": {
            const layer = speciesLayer(slug);
            return layer.layer === "canopy" && layer.primate;
        }
    }
}

export type MomentFrom = {x: number; y: number; z: number; yaw: number};
export type MomentPose = {x: number; y: number; z: number; yaw: number; pitch: number; roll: number; afloat: boolean; upright: boolean};
/** Something to show at a moment's beat: a splash on the water, a blow from the blowhole. */
export type MomentBeat = {at: number; kind: "splash" | "blow"; x: number; y: number; z: number};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const seg = (u: number, from: number, to: number) => clamp01((u - from) / (to - from));

/** The nearest open water (at least 1 m deep) out from a point, along the line away from the island's middle. */
export function nearestSea(x: number, z: number): {x: number; z: number} {
    const r = Math.hypot(x, z) || 1;
    const ox = x / r;
    const oz = z / r;
    for (let d = 0; d < 120; d += 1.5) {
        const px = x + ox * d;
        const pz = z + oz * d;
        if (heightAt(px, pz) < -1) return {x: px, z: pz};
    }
    return {x: x + ox * 60, z: z + oz * 60};
}

/**
 * Where the animal is at `u` (0…1) of its moment, from where it was (`from`,
 * its pose when the moment began) and its drawn length. The beats say when
 * to splash or blow.
 */
export function momentPose(kind: ArkMomentKind, from: MomentFrom, u: number, length: number): MomentPose {
    const forwardX = Math.sin(from.yaw);
    const forwardZ = Math.cos(from.yaw);
    switch (kind) {
        case "primate_drop": {
            // Down to the ground just out from its limb, a while there, a leap back up.
            const gx = from.x + forwardX * Math.max(length, 0.8);
            const gz = from.z + forwardZ * Math.max(length, 0.8);
            const gy = Math.max(heightAt(gx, gz), 0);
            if (u < 0.14) {
                const k = seg(u, 0, 0.14);
                return {x: lerp(from.x, gx, k), y: lerp(from.y, gy, k * k), z: lerp(from.z, gz, k), yaw: from.yaw, pitch: 0.3 * Math.sin(Math.PI * k), roll: 0, afloat: k < 0.95, upright: true};
            }
            if (u < 0.68) return {x: gx, y: gy, z: gz, yaw: from.yaw + Math.PI * ease(seg(u, 0.4, 0.62)), pitch: 0, roll: 0, afloat: false, upright: true};
            const k = ease(seg(u, 0.68, 0.86));
            return {x: lerp(gx, from.x, k), y: lerp(gy, from.y, k) + Math.sin(Math.PI * k) * 0.9, z: lerp(gz, from.z, k), yaw: from.yaw + Math.PI, pitch: -0.4 * Math.sin(Math.PI * k), roll: 0, afloat: true, upright: true};
        }
        case "owl_swoop": {
            // From its branch (an owl on the ground first flies up to a branch's height), a long low swoop to the
            // ground ahead, a moment there, and a glide back.
            const reach = 5;
            const gx = from.x + forwardX * reach;
            const gz = from.z + forwardZ * reach;
            const gy = Math.max(heightAt(gx, gz), 0) + 0.05;
            const groundHere = Math.max(heightAt(from.x, from.z), 0);
            const perched = from.y - groundHere > 1.5;
            const up = perched ? 0 : 0.2;
            if (u < up) {
                const k = ease(seg(u, 0, up));
                return {x: from.x - forwardX * k * 0.8, y: from.y + k * 3.5, z: from.z - forwardZ * k * 0.8, yaw: from.yaw, pitch: -0.5 * Math.sin(Math.PI * k), roll: 0, afloat: true, upright: true};
            }
            const top = {x: from.x - forwardX * (perched ? 0 : 0.8), y: from.y + (perched ? 0 : 3.5), z: from.z - forwardZ * (perched ? 0 : 0.8)};
            if (u < up + 0.3) {
                const k = ease(seg(u, up, up + 0.3));
                const fromTop = top;
                // A curve that dips below the straight line (a quadratic, its control point low and near the end).
                const cx = lerp(fromTop.x, gx, 0.75);
                const cz = lerp(fromTop.z, gz, 0.75);
                const cy = gy + 0.3;
                const x = (1 - k) ** 2 * fromTop.x + 2 * (1 - k) * k * cx + k * k * gx;
                const y = (1 - k) ** 2 * fromTop.y + 2 * (1 - k) * k * cy + k * k * gy;
                const z = (1 - k) ** 2 * fromTop.z + 2 * (1 - k) * k * cz + k * k * gz;
                return {x, y, z, yaw: from.yaw, pitch: 0.5 * (1 - k), roll: 0, afloat: true, upright: true};
            }
            if (u < up + 0.42) return {x: gx, y: gy, z: gz, yaw: from.yaw, pitch: 0, roll: 0, afloat: false, upright: true};
            const k = ease(seg(u, up + 0.42, 0.92));
            const back = from.yaw + Math.PI;
            const x = lerp(gx, from.x, k) + Math.sin(Math.PI * k) * 1.2 * Math.cos(from.yaw);
            const z = lerp(gz, from.z, k) - Math.sin(Math.PI * k) * 1.2 * Math.sin(from.yaw);
            return {x, y: lerp(gy, from.y, k) + Math.sin(Math.PI * k) * 1.5, z, yaw: u < 0.92 ? back : from.yaw, pitch: -0.35 * Math.sin(Math.PI * k), roll: 0.3 * Math.sin(Math.PI * k), afloat: true, upright: true};
        }
        case "seabird_dive": {
            // Out over the sea, high; a plunge into it; a moment afloat; back to where it was.
            const sea = nearestSea(from.x, from.z);
            const high = 9;
            if (u < 0.3) {
                const k = ease(seg(u, 0, 0.3));
                return {x: lerp(from.x, sea.x, k), y: lerp(from.y, high, k), z: lerp(from.z, sea.z, k), yaw: Math.atan2(sea.x - from.x, sea.z - from.z), pitch: -0.2 * Math.sin(Math.PI * k), roll: 0, afloat: true, upright: true};
            }
            if (u < 0.42) {
                const k = seg(u, 0.3, 0.42);
                return {x: sea.x, y: lerp(high, -0.35, k * k), z: sea.z, yaw: Math.atan2(sea.x - from.x, sea.z - from.z), pitch: 1.25, roll: 0, afloat: true, upright: true};
            }
            if (u < 0.56) return {x: sea.x, y: 0.02 + Math.sin(u * 60) * 0.03, z: sea.z, yaw: Math.atan2(sea.x - from.x, sea.z - from.z), pitch: 0, roll: 0, afloat: true, upright: true};
            const k = ease(seg(u, 0.56, 1));
            return {x: lerp(sea.x, from.x, k), y: lerp(0.02, from.y, k) + Math.sin(Math.PI * k) * 3, z: lerp(sea.z, from.z, k), yaw: Math.atan2(from.x - sea.x, from.z - sea.z), pitch: -0.2 * Math.sin(Math.PI * k), roll: 0, afloat: true, upright: true};
        }
        case "whale_surface": {
            // Up through the water, nose first; its back breaks the surface and it blows; down again.
            const ahead = Math.max(length, 2) * 1.2;
            const top = 0.25 - Math.max(length, 2) * 0.12;
            if (u < 0.4) {
                const k = ease(seg(u, 0, 0.4));
                return {x: from.x + forwardX * ahead * k, y: lerp(from.y, top, k), z: from.z + forwardZ * ahead * k, yaw: from.yaw, pitch: -0.45 * Math.sin(Math.PI * k), roll: 0, afloat: true, upright: true};
            }
            if (u < 0.62) {
                const k = seg(u, 0.4, 0.62);
                return {x: from.x + forwardX * ahead * (1 + 0.6 * k), y: top + Math.sin(Math.PI * k) * 0.12, z: from.z + forwardZ * ahead * (1 + 0.6 * k), yaw: from.yaw, pitch: 0.08 * Math.sin(Math.PI * 2 * k), roll: 0, afloat: true, upright: true};
            }
            const k = ease(seg(u, 0.62, 1));
            return {x: from.x + forwardX * ahead * (1.6 - 1.6 * k), y: lerp(top, from.y, k), z: from.z + forwardZ * ahead * (1.6 - 1.6 * k), yaw: from.yaw, pitch: 0.4 * Math.sin(Math.PI * k), roll: 0, afloat: true, upright: true};
        }
    }
}

/** The beats of a moment: when (u) and where a splash or a blow is shown. */
export function momentBeats(kind: ArkMomentKind, from: MomentFrom, length: number): MomentBeat[] {
    if (kind === "seabird_dive") {
        const sea = nearestSea(from.x, from.z);
        return [{at: 0.42, kind: "splash", x: sea.x, y: 0, z: sea.z}, {at: 0.56, kind: "splash", x: sea.x, y: 0, z: sea.z}];
    }
    if (kind === "whale_surface") {
        const p = momentPose(kind, from, 0.5, length);
        return [{at: 0.42, kind: "splash", x: p.x, y: 0, z: p.z}, {at: 0.5, kind: "blow", x: p.x + Math.sin(from.yaw) * length * 0.25, y: 0.3, z: p.z + Math.cos(from.yaw) * length * 0.25}];
    }
    return [];
}
