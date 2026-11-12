/**
 * A species with no Ark model (owner decision A13, 2026-11-10): drawn as a
 * neutral placeholder, a soft generic four-legged figure in warm clay, never
 * a broken model. The server's public reads say so with `placeholder: true`
 * and `model_slug: null`; the scene also falls back to it for a species the
 * model set doesn't list, or whose files fail to load.
 *
 * A placeholder species with no slug at all takes `placeholder--<species id>`
 * as its slug, so each one keeps its own mesh (and its own row in the
 * population panel) and nothing links to a page that isn't there.
 */

import {
    BufferAttribute,
    CylinderGeometry,
    SphereGeometry,
    type BufferGeometry
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The slug and icon helpers live in `placeholder-icon.ts` (no three.js), re-exported here for the scene.
export {ARK_PLACEHOLDER_PREFIX, ARK_PLACEHOLDER_ICON, arkIconFallback, arkIconUrl, arkPlaceholderSlug, isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";

// Warm clay, in linear light (about sRGB #cdb48c on top, #a08262 underneath).
const TOP = [0.61, 0.46, 0.26];
const BELLY = [0.35, 0.23, 0.12];

/** A vertex colour from top (light, sunlit clay) to belly (shaded). */
function tint(geometry: BufferGeometry, low: number, high: number): BufferGeometry {
    const position = geometry.getAttribute("position");
    const colours = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
        const k = Math.min(Math.max((position.getY(i) - low) / Math.max(high - low, 0.001), 0), 1);
        for (let c = 0; c < 3; c++) colours[i * 3 + c] = BELLY[c] + (TOP[c] - BELLY[c]) * k;
    }
    geometry.setAttribute("color", new BufferAttribute(colours, 3));
    return geometry;
}

/**
 * The figure: a rounded body, a head on a short neck, four short legs and a
 * tail, about 1.9 long and 1.2 high, its head toward +z (as the models face).
 * Under 600 triangles, so it costs what a far model does; `low` (about
 * 120) is the herds' far figure (`herd-specks.ts`).
 */
export function placeholderGeometry(detail: "full" | "low" = "full"): BufferGeometry {
    const low = detail === "low";
    // Every part has the same attributes (position, normal, uv; all indexed), so they merge.
    const parts: BufferGeometry[] = [];
    const body = new SphereGeometry(0.5, low ? 7 : 14, low ? 5 : 10);
    body.scale(0.78, 0.62, 1.55);
    body.translate(0, 0.7, -0.05);
    parts.push(body);
    const head = new SphereGeometry(0.24, low ? 5 : 12, low ? 4 : 8);
    head.scale(0.95, 0.92, 1.15);
    head.translate(0, 1.04, 0.86);
    parts.push(head);
    const neck = new CylinderGeometry(0.13, 0.18, 0.42, low ? 4 : 8, 1, low);
    neck.rotateX(0.75);
    neck.translate(0, 0.9, 0.64);
    parts.push(neck);
    for (const [x, z] of [[-0.2, 0.42], [0.2, 0.42], [-0.2, -0.5], [0.2, -0.5]] as const) {
        const leg = new CylinderGeometry(0.075, 0.065, 0.5, low ? 3 : 7, 1, low);
        leg.translate(x, 0.25, z);
        parts.push(leg);
    }
    const tail = new CylinderGeometry(0.035, 0.05, 0.36, low ? 3 : 6, 1, low);
    tail.rotateX(-0.9);
    tail.translate(0, 0.74, -0.86);
    parts.push(tail);
    // Each part keeps its own smooth normals: soft, rounded, like a figure on a model.
    const merged = mergeGeometries(parts.map((geometry) => tint(geometry, 0.05, 1.25)));
    parts.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error("placeholder geometry");
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
}
