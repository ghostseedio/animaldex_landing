/**
 * The hamlet's reserved land as the scenery's decor sees it (docs/ark/props.md,
 * "Home plots"): the map lane's reserved plot slots (`map/hamlet-slots.json`,
 * past today's cottage and barn), each its lot (the house and its garden; the
 * barn's yard and every paddock the props may fence) and its core (the house,
 * the barn). Pure, with nothing imported but two tables, so `decor.ts` can
 * ask it while it builds without an import cycle (the map's own
 * `reservedAt` needs the props' paddocks, which need the decor).
 *
 * The lots are the map's own footprints (`map/hamlet.ts` plotFootprint),
 * baked into `hamlet-footprints.json` (`ark-props.test` checks they still
 * match); the cores are its CORE.
 */

import slotTable from "@/ark-scene/map/hamlet-slots.json";
import footprintTable from "@/ark-scene/props/hamlet-footprints.json";

type Slot = {id: string; kind: "house" | "smallholding"; x: number; z: number; rotation: number};
type Rect = {x0: number; x1: number; z0: number; z1: number};

/** The core a building stands on, in its plot's frame (the map's CORE). */
export const HAMLET_CORE: Record<Slot["kind"], Rect> = {
    house: {x0: -3.6, x1: 3.6, z0: -2.9, z1: 3.2},
    smallholding: {x0: -4.8, x1: 4.8, z0: -3.8, z1: 3.8}
};

const SLOTS: Slot[] = (slotTable as unknown as {plots: Slot[]}).plots;
const FOOTPRINTS = (footprintTable as unknown as {footprints: Record<string, Array<[number, number]>>}).footprints;

/** Inside a convex quadrilateral (either winding). */
function insideQuad(quad: Array<[number, number]>, x: number, z: number): boolean {
    let sign = 0;
    for (let i = 0; i < quad.length; i++) {
        const [px, pz] = quad[i];
        const [qx, qz] = quad[(i + 1) % quad.length];
        const cross = (qx - px) * (z - pz) - (qz - pz) * (x - px);
        if (cross === 0) continue;
        if (sign === 0) sign = Math.sign(cross);
        else if (Math.sign(cross) !== sign) return false;
    }
    return true;
}

/** Where a point is on the reserved land: under a building's core, elsewhere on a lot, or not reserved. */
export function hamletLandAt(x: number, z: number): "core" | "lot" | null {
    let found: "core" | "lot" | null = null;
    for (const slot of SLOTS) {
        // Into the slot's frame (three's rotation about y: local +z → (sin, cos)).
        const dx = x - slot.x;
        const dz = z - slot.z;
        if (Math.abs(dx) > 21 || Math.abs(dz) > 21) continue;
        const c = Math.cos(slot.rotation);
        const s = Math.sin(slot.rotation);
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        const core = HAMLET_CORE[slot.kind];
        if (lx >= core.x0 && lx <= core.x1 && lz >= core.z0 && lz <= core.z1) return "core";
        const footprint = FOOTPRINTS[slot.id];
        if (footprint && insideQuad(footprint, x, z)) found = "lot";
    }
    return found;
}

/**
 * The decor's grass and flowers there (the graphics lane's `decor.ts` asks): none under a building's core, about
 * half elsewhere on a lot (grazed, trodden), all elsewhere. `u` is the decor's own draw for the item (0…1).
 */
export function hamletKeeps(x: number, z: number, u: number): boolean {
    const land = hamletLandAt(x, z);
    return land === null || (land === "lot" && u < 0.5);
}

/** On a reserved plot's footprint (the crops keep off it: `fields.ts` cropAt and its shader twin). */
export function hamletLotAt(x: number, z: number): boolean {
    for (const quad of Object.values(FOOTPRINTS)) {
        const [x0, z0] = quad[0];
        if (Math.abs(x - x0) > 40 || Math.abs(z - z0) > 40) continue;
        if (insideQuad(quad, x, z)) return true;
    }
    return false;
}

/** The footprints as GLSL (`fields.ts` arkField): true inside any, for the shader to paint them grass, not crop rows. */
export function hamletLotsGlsl(): string {
    const quads = Object.values(FOOTPRINTS);
    const edge = (a: [number, number], b: [number, number]) => `((${b[0].toFixed(3)} - ${a[0].toFixed(3)}) * (p.y - ${a[1].toFixed(3)}) - (${b[1].toFixed(3)} - ${a[1].toFixed(3)}) * (p.x - ${a[0].toFixed(3)}))`;
    const tests = quads.map((quad) => {
        const edges = quad.map((a, i) => edge(a, quad[(i + 1) % quad.length]));
        return `    { float e0 = ${edges[0]}; float e1 = ${edges[1]}; float e2 = ${edges[2]}; float e3 = ${edges[3]};
      if ((e0 >= 0.0 && e1 >= 0.0 && e2 >= 0.0 && e3 >= 0.0) || (e0 <= 0.0 && e1 <= 0.0 && e2 <= 0.0 && e3 <= 0.0)) return true; }`;
    });
    return `bool arkHamletLot(vec2 p) {\n${tests.join("\n")}\n    return false;\n}\n`;
}
