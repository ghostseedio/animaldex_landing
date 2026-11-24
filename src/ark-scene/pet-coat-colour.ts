/**
 * Lane COATS (owner 2026-11-24, "yes go ahead with per-pet coats"): a plain Domestic Cat or Dog aboard drawn in its
 * own coat colours, read once on the server from the capture photo that brought it aboard (`voyage_animals.coat`,
 * sent as `coat` while `voyage_config.pet_coats` is on). This file is the colour side, with no three.js, so the
 * snapshot decoder can use it: the read's check, the three tint fixes of the step-1 review, and the packing into the
 * per-instance `arkVary` attribute (`pet-coat.ts` draws it).
 *
 * The review's fixes (coordinator, 2026-11-24):
 *  - a ginger (orange/golden) coat keeps the kind's own skin, which already is one, so a ginger is never washed out;
 *  - a mid-tone base (#4c453e) is lifted to read as a mid brown-grey, not near-black, and a near-neutral grey is held
 *    neutral (its chroma pulled in, and no warm-shadow exponents in the shader) so it never goes mauve;
 *  - the skin's tabby stripes are kept only faintly, and least on solid dark or light coats (in the shader).
 */

import type {ArkCoat} from "@/ark-scene/types";

/** The kinds that wear their own coats: the plain kind models only (breed and coat-colour looks keep their own). */
export const COAT_SLUGS: ReadonlySet<string> = new Set(["domestic-cat", "domestic-dog"]);

const HEX = /^#[0-9a-f]{6}$/i;

/** The read's `coat`, checked: two `#rrggbb` colours (the second may be null) and a white share 0-1; else null. */
export function arkCoatOf(raw: unknown): ArkCoat | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.base !== "string" || !HEX.test(row.base)) return null;
    const second = typeof row.second === "string" && HEX.test(row.second) ? row.second.toLowerCase() : null;
    const white = typeof row.white === "number" && Number.isFinite(row.white) ? Math.min(Math.max(row.white, 0), 1) : 0;
    return {base: row.base.toLowerCase(), second, white};
}

type Lab = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116);
const fi = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));

export function hexToLab(hex: string): Lab {
    const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
    const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Lab to 0-255 sRGB (clipped). */
export function labToRgb([l, a, b]: Lab): [number, number, number] {
    const fy = (l + 16) / 116;
    const x = fi(fy + a / 500) * 0.95047;
    const y = fi(fy);
    const z = fi(fy - b / 200) * 1.08883;
    const lin = [3.2406 * x - 1.5372 * y - 0.4986 * z, -0.9689 * x + 1.8758 * y + 0.0415 * z, 0.0557 * x - 0.204 * y + 1.057 * z];
    return lin.map((c) => Math.round(Math.min(Math.max(toSrgb(Math.min(Math.max(c, 0), 1)), 0), 1) * 255)) as [number, number, number];
}

const smooth = (e0: number, e1: number, x: number) => {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
};

/** A ginger or golden coat (orange to gold, clearly coloured, mid to light): the kind's own skin already is one. */
export function isGinger(hex: string): boolean {
    const [l, a, b] = hexToLab(hex);
    const chroma = Math.hypot(a, b);
    const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    return chroma >= 22 && hue >= 35 && hue <= 85 && l >= 42 && l <= 82;
}

/**
 * A coat colour as the scene draws it (0-255 sRGB): a dark mid-tone lifted (a photo's fur reads darker than the coat looks:
 * #4c453e, L 29, goes to about L 40, a mid brown-grey), black left as it is, and nothing from L 48 up made any lighter
 * (a light coat is never drawn brighter than its photo); a near-neutral (grey, cream, taupe) turned to fur's warm hue
 * at a low chroma, so it keeps some warmth and never goes lilac or mauve, and nothing outside fur's hues more than
 * faintly coloured.
 */
export function drawnColour(hex: string): [number, number, number] {
    let [l, a, b] = hexToLab(hex);
    l += 12 * smooth(20, 31, l) * (1 - smooth(36, 48, l));
    const chroma = Math.hypot(a, b);
    const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    if (chroma < 12) {
        // A grey, cream or taupe: turned to fur's warm hue (a little warmth kept, never lilac or mauve).
        // (A light one a little more: under the sky's cool light a cream at chroma 4 reads silver.)
        const c = Math.max(chroma, 4 + 3 * smooth(40, 60, l));
        return labToRgb([l, c * Math.cos((55 * Math.PI) / 180), c * Math.sin((55 * Math.PI) / 180)]);
    }
    // A coloured coat outside fur's hues (orange to yellow) is only faintly coloured.
    const scale = hue < 20 || hue > 105 ? Math.min(1, 4 / chroma) : 1;
    return labToRgb([l, a * scale, b * scale]);
}

export type CoatDraw = {base: [number, number, number]; second: [number, number, number]; white: number; keep: boolean};

/** What the shader is given for a coat (`drawnColour` on both; a missing second is the base, so no patches show). */
export function coatDraw(coat: ArkCoat): CoatDraw {
    const base = drawnColour(coat.base);
    // A ginger keeps the kind's skin, unless it has a darker second colour and is not piebald (a red dog with a darker
    // saddle): that one is drawn as its own warm coat, the second as soft shading on its back and ears (the shader), so
    // no hard patches lie over the skin's pale feathering.
    const darkerSecond = Boolean(coat.second) && hexToLab(coat.second as string)[0] < hexToLab(coat.base)[0] - 8;
    const keep = isGinger(coat.base) && !(darkerSecond && coat.white < PIEBALD);
    return {base, second: coat.second ? drawnColour(coat.second) : base, white: coat.white, keep};
}

/** From this white share up a coat is piebald: its second colour in hard patches; below it, soft shading on the back. */
export const PIEBALD = 0.25;

const pack = ([r, g, b]: [number, number, number]) => r * 65536 + g * 256 + b;

/**
 * The coat in `arkVary`'s x, y and z (w, the pattern seed, is kept). x: the white share as a fraction (0.05 + 0.4 white;
 * negative: keep the skin), its Power's whole turns are added after (`setVaryPower`) and the hue turn is unused; y: the
 * base as one 24-bit integer (exact in a float); z: minus one minus the second, so negative says "a coat" (a plain
 * animal's z, its brightness, is always positive).
 */
export function coatVary(draw: CoatDraw): [number, number, number] {
    const white = 0.05 + 0.4 * Math.min(Math.max(draw.white, 0), 1);
    return [draw.keep ? -white : white, pack(draw.base), -1 - pack(draw.second)];
}

/** The inverse of `coatVary` (tests, and the shader's own decode written out). */
export function coatUnvary(x: number, y: number, z: number): CoatDraw | null {
    if (!(z < 0)) return null;
    const q = Math.floor(x + 0.5);
    const frac = x - q;
    const unpack = (p: number): [number, number, number] => [Math.floor(p / 65536), Math.floor((p % 65536) / 256), p % 256];
    return {base: unpack(Math.round(y)), second: unpack(Math.round(-z - 1)), white: Math.round(((Math.abs(frac) - 0.05) / 0.4) * 1000) / 1000, keep: frac < 0};
}
