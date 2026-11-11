/**
 * An animal's body as the collisions see it: its own model's shape (`body-shapes.json`, from each model's `ark.json`
 * extent: `scripts/ark-collide-bodies.mts`) at the length it is drawn (`stats.ts` arkBody, the sizing lane's), as a
 * capsule along its heading: a spine `2 · half` long, `radius` round it, `height` tall. Known before its model loads
 * and the same for every viewer.
 */

import shapesFile from "@/ark-scene/collide/body-shapes.json";

const SHAPES = (shapesFile as {shapes: Record<string, string>}).shapes;

export type BodyShape = {
    /** Half its width (m): the capsule's radius. */
    radius: number;
    /** Half its spine (m): from its middle to the middle of its head end's round (0 for a round body). */
    half: number;
    /** Its height (m). */
    height: number;
    /** Its drawn length along its heading (m). */
    length: number;
};

/** A model with no shape listed: about a quadruped's proportions. */
const DEFAULT: [number, number, number] = [0.35, 0.5, 1];

const decoded = new Map<string, [number, number, number]>();
function ratios(slug: string): [number, number, number] {
    let r = decoded.get(slug);
    if (r) return r;
    const code = SHAPES[slug];
    r = code && code.length === 6 ? [parseInt(code.slice(0, 2), 36) / 100, parseInt(code.slice(2, 4), 36) / 100, parseInt(code.slice(4, 6), 36) / 100] : DEFAULT;
    decoded.set(slug, r);
    return r;
}

/** Its body at a drawn length `length` (m: the length its model is scaled to, `arkBody(...).display` times its sex's scale). */
export function bodyShape(slug: string, length: number): BodyShape {
    const [w, h, l] = ratios(slug);
    const d = Math.max(length, 0.01);
    const radius = Math.max((w * d) / 2, 0.005);
    const along = l * d;
    return {radius, half: Math.max(along / 2 - radius, 0), height: Math.max(h * d, 0.01), length: along};
}

/** Half its width (m): how far a fence, a trunk or another animal keeps from its spine. */
export function bodyRadius(slug: string, length: number): number {
    return bodyShape(slug, length).radius;
}

/** Whether the shape is the model's own (else the default proportions). */
export function hasBodyShape(slug: string): boolean {
    return Boolean(SHAPES[slug]);
}
