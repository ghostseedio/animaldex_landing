/**
 * The street trees' pits (ark-world-2; the owner, 2026-11-21: "a street tree's trunk passes through the pavement"): the slab,
 * which floats 16 cm over the verge with no edge face, ran straight through every street lime, and the trunk showed under its
 * edge. Each now stands in a tree pit in the middle of its slab (`plan.ts` treePits: a square of the slab's own kind, turned to
 * the street): a granite edging a hand high, dark soil inside it with a low mound round the trunk and a scatter of bark
 * mulch. The trunk comes out of the soil; nothing of the slab is under or round it that was not cut for it.
 *
 * Into each chunk's solid mesh, with the rest of the street scenery; about 80 triangles a pit.
 */

import {at as place, type Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {PAVEMENT_LIFT} from "@/ark-scene/islands/town/render/streets";
import {pitPoints, PIT_EDGING, type TreePit} from "@/ark-scene/islands/town/pavement-overlap";
import {rng} from "@/ark-scene/islands/town/geom";

const GRANITE = tone("#8d8a84");
const SOIL = tone("#3b2c20");
const MULCH = [tone("#5a432f"), tone("#6a5238"), tone("#4a3626")];

/** The edging's height over the slab and the soil's (m). */
export const PIT_EDGE_TOP = 0.1;
export const PIT_SOIL_TOP = 0.05;

/** The slab's top at a pit: the highest of its points' slab heights (the slab is laid draped on the ground there). */
export function pitFloor(pit: TreePit, heightAt: (x: number, z: number) => number): number {
    let top = -Infinity;
    for (const p of pitPoints(pit)) top = Math.max(top, heightAt(p.x, p.z) + PAVEMENT_LIFT);
    return top;
}

/** One pit into `solid`: its edging, soil, the mound round the trunk and mulch. */
export function drawTreePit(solid: Geo, pit: TreePit, heightAt: (x: number, z: number) => number) {
    const y0 = pitFloor(pit, heightAt);
    // (Local x along the street, z across it.)
    const f: Frame = {x: pit.x, y: y0 - 0.02, z: pit.z, rot: pit.heading};
    const h = pit.half;
    const e = PIT_EDGING;
    const top = PIT_EDGE_TOP + 0.02;
    // The edging: two long sides and two ends between them.
    for (const side of [-1, 1]) {
        solid.box(f, 0, 0, side * (h - e / 2), h * 2, top, e, GRANITE);
        solid.box(f, side * (h - e / 2), 0, 0, e, top, h * 2 - e * 2, GRANITE);
    }
    // The soil, a little under the edging's top, and the mound about the trunk.
    solid.box(f, 0, 0, 0, h * 2 - e * 2, PIT_SOIL_TOP + 0.02, h * 2 - e * 2, SOIL);
    const middle = place(f, 0, PIT_SOIL_TOP + 0.02, 0);
    const random = rng(pit.seed);
    solid.smoothLump(middle[0], middle[1] - 0.01, middle[2], h * 0.62, 0.045, h * 0.62, [middle[0], middle[1] - 0.4, middle[2]], SOIL, 0, random, 0);
    // Bark mulch: flat flecks on the soil (two triangles each, facing up).
    const flat = soilTop(f);
    for (let k = 0; k < 6; k++) {
        const a = random() * Math.PI * 2;
        const d = (0.35 + random() * 0.6) * (h - e);
        const cx = Math.cos(a) * d;
        const cz = Math.sin(a) * d;
        const w = 0.035 + random() * 0.04;
        const l = 0.05 + random() * 0.06;
        const t = random() * 3;
        const c = Math.cos(t);
        const sn = Math.sin(t);
        const corner = (u: number, v: number) => place(flat, cx + u * c - v * sn, 0, cz + u * sn + v * c);
        solid.quad(corner(-w, l), corner(w, l), corner(w, -l), corner(-w, -l), MULCH[k % MULCH.length]);
    }
}

/** The soil's top as a frame (so a fleck lies on it). */
function soilTop(f: Frame): Frame {
    return {x: f.x, y: f.y + PIT_SOIL_TOP + 0.022, z: f.z, rot: f.rot};
}

/** Every planted street tree's pit, into its chunk. */
export function treePits(pits: readonly TreePit[], planted: ReadonlySet<number>, chunkAt: (x: number, z: number) => {solid: Geo}, heightAt: (x: number, z: number) => number) {
    for (const pit of pits) {
        if (!planted.has(pit.seed)) continue;
        drawTreePit(chunkAt(pit.x, pit.z).solid, pit, heightAt);
    }
}
