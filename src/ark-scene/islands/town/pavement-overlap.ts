/**
 * Where a foot stands against the town's drawn pavements (ark-world-2; the owner, 2026-11-21: "a street tree's trunk passes
 * through the pavement": the slab ran straight through a street lime's trunk, the trunk showing on both sides of the slab's
 * edge with a dark gap where it met the verge). The pure test the plan's street trees and lamps are held to, and the
 * count that says how many of them break it.
 *
 * A pavement is drawn as a slab strip (`render/streets.ts`): from the kerb's back (`width / 2 + 0.16`) to its outer edge
 * (`width / 2 + pavement`), 16 cm over the ground, cut where it would run over a carriageway or the pavement of a street it
 * gives way to (`street-clip.ts`). A slab has no edge face: it floats 16 cm over the verge. So a trunk whose foot reaches
 * the slab and leaves it, or stands on it with nothing round it, shows the slab passing through it. Pure: no three.js.
 */

import {acrossDistance, clipStreets, cutAt, type ClipStreet} from "@/ark-scene/islands/town/street-clip";
import type {Street} from "@/ark-scene/islands/town/plan";

export type PavementSurface = "road" | "kerb" | "slab" | "walk" | "off";

/** The streets whose own surface is for walking (a footpath, a towpath, a quay): "walk", not "road". */
const WALKWAYS: ReadonlySet<Street["kind"]> = new Set<Street["kind"]>(["path", "zoo_path", "towpath", "quay"]);

export const KERB_BACK = 0.16;
/** The width of a tree pit's edging (m): a trunk keeps this inside the pit's half side. */
export const PIT_EDGING = 0.09;
/** A street lamp's foot (m): its base's radius with a hand's clearance. */
export const LAMP_FOOT = 0.14;

/** What is drawn at a point: the carriageway, a kerb's top, a pavement slab or a footpath, or none of them (grass, a garden, a drive). */
export function drawnSurfaceAt(clip: ClipStreet[], x: number, z: number): PavementSurface {
    let best: PavementSurface = "off";
    for (const c of clip) {
        // (Outside the street's box, widened by its band: nothing of it here.)
        if (x < c.box.x0 || x > c.box.x1 || z < c.box.z0 || z > c.box.z1) continue;
        const s = c.street;
        const d = acrossDistance(s.line, x, z);
        if (d > s.width / 2 + s.pavement) continue;
        let here: PavementSurface = "off";
        if (d <= s.width / 2) here = cutAt(clip, c, "carriageway", x, z) ? "off" : WALKWAYS.has(s.kind) ? "walk" : "road";
        else if (s.pavement > 0 && d <= s.width / 2 + KERB_BACK) here = cutAt(clip, c, "kerb", x, z) ? "off" : "kerb";
        else if (s.pavement > 0) here = cutAt(clip, c, "pavement", x, z) ? "off" : "slab";
        if (here === "road") return "road";
        if (here === "kerb") best = "kerb";
        else if ((here === "slab" || here === "walk") && best === "off") best = here;
    }
    return best;
}

/** The surfaces under a disc of radius `r` about (x, z): its middle and twelve points on its rim. */
export function surfacesUnder(clip: ClipStreet[], x: number, z: number, r: number): PavementSurface[] {
    const out: PavementSurface[] = [drawnSurfaceAt(clip, x, z)];
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        out.push(drawnSurfaceAt(clip, x + Math.cos(a) * r, z + Math.sin(a) * r));
    }
    return out;
}

/** What a foot of radius `r` does to the pavement: stands wholly on a walkway (a slab or a footpath), wholly off every street surface, or straddles (a slab's edge, a kerb, the road). */
export type FootOnPavement = "on_walkway" | "off_pavement" | "straddles";

export function footOnPavement(clip: ClipStreet[], x: number, z: number, r: number): FootOnPavement {
    const under = surfacesUnder(clip, x, z, r);
    if (under.every((s) => s === "slab" || s === "walk")) return "on_walkway";
    if (under.every((s) => s === "off")) return "off_pavement";
    return "straddles";
}

/** A tree pit's square, centred and turned to its street: the tray a street tree stands in (half its side, the street's heading). */
export type TreePit = {x: number; z: number; /** The street's heading there (radians, atan2(dz, dx)). */ heading: number; half: number; street: string; seed: number};

/** The pit's four corners and the middles of its sides (nine points with its centre) in the town's frame. */
export function pitPoints(p: TreePit): Array<{x: number; z: number}> {
    const ux = Math.cos(p.heading);
    const uz = Math.sin(p.heading);
    const out: Array<{x: number; z: number}> = [];
    for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) out.push({x: p.x + ux * a * p.half - uz * b * p.half, z: p.z + uz * a * p.half + ux * b * p.half});
    return out;
}

/** Whether a point is inside a pit's square widened by `margin` (in the pit's own frame: its edging, and room to stand beside it). */
export function nearPit(pits: readonly TreePit[], x: number, z: number, margin: number): boolean {
    for (const p of pits) {
        const ux = Math.cos(p.heading);
        const uz = Math.sin(p.heading);
        const a = (x - p.x) * ux + (z - p.z) * uz;
        const b = -(x - p.x) * uz + (z - p.z) * ux;
        if (Math.abs(a) <= p.half + margin && Math.abs(b) <= p.half + margin) return true;
    }
    return false;
}

/** Whether a whole pit lies on drawn slab (its corners, side middles and centre). */
export function pitOnSlab(clip: ClipStreet[], p: TreePit): boolean {
    return pitPoints(p).every((q) => drawnSurfaceAt(clip, q.x, q.z) === "slab");
}

export function clipOf(streets: Street[]): ClipStreet[] {
    return clipStreets(streets);
}
