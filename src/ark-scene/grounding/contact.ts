/**
 * Contact rules (lane ARK-CONTACT, decision 447: "some animals don't touch trees, leaves, the ground, the walls, the
 * waters properly"). Small pure rules the scene (`index.ts`) and the contact audit (`contact-audit.ts`,
 * `scripts/ark-contact-audit.mts`) share, so what the audit measures is what the scene draws.
 *
 * - `wadeBase`: an animal with no water band (a heron, a sparrow, a lion) over water stands on the bed only while the
 *   water is shallower than its legs; deeper, it is held at its float line, never under the surface walking the bed.
 * - `edgeBase`: sliding into or out of the water, its body never goes into the bank it is on.
 * - `benthicCreep`: a sea star, an urchin, a sea cucumber creeps on the bed (centimetres a minute); a sessile one keeps still.
 * - `shadowFootprint`: a contact shadow's size and middle from the body's own box, turned by its pitch and roll.
 * - `inPlaceLift`: how much of a clip's root rise to take off when it plays in place on the ground (a pounce, a Power
 *   clip): the body stays on its feet, as a standing clip's does.
 */

import type {ArkWaterKind} from "@/ark-scene/behaviour-profile";
import {floatLine} from "@/ark-scene/sea-depth";

/**
 * How deep (a share of its drawn height) an animal with no water band wades and stays on its feet: a wader (a heron, an
 * egret: legs half its height) to just over its knees; anything else to its belly.
 */
export function wadeDepth(height: number, kind: ArkWaterKind | null | undefined): number {
    return Math.max(height, 0.01) * (kind === "wader" ? 0.5 : 0.28);
}

/** Body plans that live on the bed under the water (a sea anemone, an urchin, a crab, a fish on the bottom): never floated up. */
const BED_PLANS: ReadonlySet<string> = new Set(["sessile", "slow_invertebrate", "worm", "arthropod", "fish", "eel", "ray", "flatfish", "cephalopod", "jellyfish"]);
export function livesUnderWater(profile: {seabed?: boolean; move?: string} | null | undefined, plan: string | null | undefined): boolean {
    return Boolean(profile?.seabed) || profile?.move === "sessile" || BED_PLANS.has(plan ?? "");
}

/**
 * Its base over water with no band: on the bed while the water there is within its wading depth (or it lives under the
 * water: `livesUnderWater`); deeper, at its float line on the surface (its kind's, else a bird's or a mammal's), its back
 * and head above the water.
 */
export function wadeBase(ground: number, waterTop: number, height: number, kind: ArkWaterKind | null | undefined, plan: string | null | undefined, underWater = false): {base: number; floating: boolean} {
    const depth = waterTop - ground;
    if (underWater || depth <= wadeDepth(height, kind)) return {base: ground, floating: false};
    const sink = floatLine(kind ?? (plan === "bird" ? "bird" : "mammal"));
    return {base: Math.max(ground, waterTop - sink * Math.max(height, 0.01)), floating: true};
}

/** Into or out of the water: settled from standing to its float line by the slide, never into the ground under it. */
export function edgeBase(stand: number, fitted: number, k: number, ground: number): number {
    return Math.max(stand + (fitted - stand) * k, ground);
}

/**
 * A sea star's creep (body lengths a second): 15 cm a minute for a 25 cm star (Asteroidea tube feet), an urchin's and a
 * sea cucumber's alike; a sessile animal (a barnacle, a feather star at rest) keeps still. Null: its pace as before.
 */
export const BENTHIC_CREEP = 0.01;
export function benthicCreep(profile: {move: string; seabed?: boolean}): number | null {
    if (profile.move === "sessile") return 0;
    if (profile.move === "crawl" && profile.seabed) return BENTHIC_CREEP;
    return null;
}

type Box = {min: {x: number; y: number; z: number}; max: {x: number; y: number; z: number}};

/**
 * A contact shadow from the body itself: its box's corners turned by the pose's pitch (nose down positive) and roll,
 * flattened onto the ground: the width across, the length along, and the middle's offset from the origin (model axes,
 * metres). A lion on its side casts its back's width, a giraffe its own long narrow shape, a beetle a beetle's.
 */
export function shadowFootprint(box: Box, scale: number, pitch: number, roll: number): {width: number; length: number; midX: number; midZ: number} {
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
            for (const z of [box.min.z, box.max.z]) {
                // Roll about the heading (z), then pitch about the side (x), as the scene's Euler (pitch, yaw, roll).
                const rx = x * cr - y * sr;
                const ry = x * sr + y * cr;
                const pz = ry * sp + z * cp;
                x0 = Math.min(x0, rx);
                x1 = Math.max(x1, rx);
                z0 = Math.min(z0, pz);
                z1 = Math.max(z1, pz);
            }
    // (The box's corners overstate a rounded body: its footprint is about 0.85 of the box's across, as the old 1.15 of
    // the width over the soft blob's falloff made it.)
    return {width: (x1 - x0) * scale, length: (z1 - z0) * scale, midX: ((x0 + x1) / 2) * scale, midZ: ((z0 + z1) / 2) * scale};
}

/** How far over its rest a clip played in place may lift the body before it is taken off (a share of its height): a bob. */
export const IN_PLACE_LIFT_FREE = 0.04;

/** The root rise to take off (m) for a clip played in place on the ground: anything over a bob. */
export function inPlaceLift(rise: number, height: number): number {
    const free = IN_PLACE_LIFT_FREE * Math.max(height, 0.01);
    return rise > free ? rise - free : 0;
}

/** A rock drawn reached down to its ground (`rock-assets.ts` rockFoot): its origin, its up, its scale, its top (own units) and stretch k. */
export type StretchedRock = {x: number; y: number; z: number; ux: number; uy: number; uz: number; scale: number; top: number; k: number};
type FacePoint = {x: number; y: number; z: number; nx: number; ny: number; nz: number; tx: number; ty: number; tz: number};

/**
 * A rock face's attach point on a rock drawn reached down to its ground (mangrove crab "floating above a rock"): the
 * drawing stretches the rock along its up about its top (y' = top + (y − top)·k), but its attach points are the shape's
 * as made (the lists the server's atlas pins are kept). Here the point is moved as the rock's surface there was, its
 * normal and its heading turned as the stretch turns them, so what sits on it sits on the rock as drawn.
 */
export function stretchedFace(point: FacePoint, rock: StretchedRock, out: FacePoint): FacePoint {
    const dx = point.x - rock.x;
    const dy = point.y - rock.y;
    const dz = point.z - rock.z;
    const along = (dx * rock.ux + dy * rock.uy + dz * rock.uz) / rock.scale;
    const shift = Math.min(along - rock.top, 0) * (rock.k - 1) * rock.scale;
    out.x = point.x + rock.ux * shift;
    out.y = point.y + rock.uy * shift;
    out.z = point.z + rock.uz * shift;
    // (A normal under a stretch along up by k: its along-up part over k; a heading: its along-up part times k.)
    const nu = point.nx * rock.ux + point.ny * rock.uy + point.nz * rock.uz;
    const nScale = 1 / rock.k - 1;
    let nx = point.nx + rock.ux * nu * nScale;
    let ny = point.ny + rock.uy * nu * nScale;
    let nz = point.nz + rock.uz * nu * nScale;
    const nl = Math.hypot(nx, ny, nz) || 1;
    out.nx = nx /= nl;
    out.ny = ny /= nl;
    out.nz = nz /= nl;
    const tu = point.tx * rock.ux + point.ty * rock.uy + point.tz * rock.uz;
    const tx = point.tx + rock.ux * tu * (rock.k - 1);
    const ty = point.ty + rock.uy * tu * (rock.k - 1);
    const tz = point.tz + rock.uz * tu * (rock.k - 1);
    const tl = Math.hypot(tx, ty, tz) || 1;
    out.tx = tx / tl;
    out.ty = ty / tl;
    out.tz = tz / tl;
    return out;
}
