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
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";

export const ARK_PLACEHOLDER_PREFIX = "placeholder--";

/** The slug a placeholder species is drawn under when the server sends none. */
export function arkPlaceholderSlug(speciesProfileId: string, fallbackId: string): string {
    const key = (speciesProfileId || fallbackId).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80) || "unknown";
    return `${ARK_PLACEHOLDER_PREFIX}${key}`;
}

/** A slug made up for a species the server sent with no model (no page, no icon art). */
export function isArkPlaceholderSlug(slug: string | null | undefined): boolean {
    return typeof slug === "string" && slug.startsWith(ARK_PLACEHOLDER_PREFIX);
}

/** The generic figure as a small icon, for the population panel, the tap card and the far icons. */
export const ARK_PLACEHOLDER_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="#b9a789"><ellipse cx="46" cy="52" rx="27" ry="17"/><circle cx="72" cy="35" r="11"/><path d="M64 44l8-6 4 9-9 5z"/><rect x="25" y="60" width="7" height="20" rx="3.5"/><rect x="36" y="62" width="7" height="19" rx="3.5"/><rect x="52" y="62" width="7" height="19" rx="3.5"/><rect x="62" y="60" width="7" height="20" rx="3.5"/><path d="M20 47c-6-1-9 3-10 8" stroke="#b9a789" stroke-width="5" stroke-linecap="round" fill="none"/></g><ellipse cx="44" cy="45" rx="17" ry="7" fill="#d6c8ad" opacity=".7"/></svg>`
)}`;

/** An icon image that failed to load (a species with no art yet) shows the generic figure instead. */
export function arkIconFallback(event: {currentTarget: {src: string}}) {
    if (event.currentTarget.src !== ARK_PLACEHOLDER_ICON) event.currentTarget.src = ARK_PLACEHOLDER_ICON;
}

/** A species' icon art, or the generic figure for a placeholder. */
export function arkIconUrl(slug: string): string {
    return isArkPlaceholderSlug(slug) ? ARK_PLACEHOLDER_ICON : getSpeciesArtworkUrl(slug);
}

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
