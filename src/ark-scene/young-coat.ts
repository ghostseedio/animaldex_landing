/**
 * Juvenile coats (3.3 batch, lane C; owner 2026-11-16): the young of some species look different from the adults
 * (a striped piglet, a tapir calf's pale stripes and spots, a banded hatchling crocodile, a white young Little Blue
 * Heron). Which species, and what their young look like, is `young-life.json` `coats`, built by
 * `scripts/ark-young-life.mts` from the species catalogue: only what a species' own stored text says, each with its
 * quote. Rules by data, never per-species code.
 *
 * How it is drawn: the species' material carries its young coat as four uniforms (`youngCoatUniforms`); each drawn
 * animal carries how strongly it wears it (0-15) in the twos of its `arkCoat.y` (`packYoung`), which the look shader
 * (`animal-look-shader.ts`) reads: the young colour over the adult's skin, and marks on the body's own coordinates
 * (bars across it, stripes along it, spots, one line down the back). An adult, or a species without a young coat,
 * carries 0 and is drawn exactly as before. No new draw call, texture or download.
 *
 * How long it is worn: where the text gives ages ("fade at around 3 to 4 months", "for its first year") those days
 * of life (the Ark's days are days of life, `ark-age.ts`); else while it is young, fading over the last of its growth.
 *
 * Only real young wear it: animals born on the Ark (`origin` "born"), by their age from the record.
 */

import table from "@/ark-scene/young-life.json";

type Rgb = [number, number, number];
export type YoungCoat = {
    name: string;
    line: string;
    base?: Rgb;
    mix?: number;
    mark?: "bars" | "stripes" | "spots" | "back";
    markColour?: Rgb;
    strength?: number;
    count?: number;
    width?: number;
    broken?: number;
    tail?: boolean;
    dull?: number;
    fade?: [number, number];
};

const COATS = (table as unknown as {coats: Record<string, YoungCoat>}).coats;
const MARK_KIND = {bars: 1, stripes: 2, spots: 3, back: 4} as const;
/** The steps of strength an animal can carry. */
export const YOUNG_STEPS = 15;

/** The species' young coat, or null (most species: the young look like the adults, smaller). */
export function youngCoatOf(slug: string | null | undefined): YoungCoat | null {
    return (slug && COATS[slug]) || null;
}

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** The species' young coat for its material (linear colours): all zero for a species without one. */
export function youngCoatUniforms(slug: string | null | undefined): {arkYoungA: {value: number[]}; arkYoungB: {value: number[]}; arkYoungC: {value: number[]}; arkYoungD: {value: number[]}} {
    const coat = youngCoatOf(slug);
    const base = coat?.base ?? [0, 0, 0];
    const mark = coat?.markColour ?? [0, 0, 0];
    return {
        arkYoungA: {value: [...base.map(linear), coat?.base ? coat.mix ?? 0.8 : 0]},
        arkYoungB: {value: [...mark.map(linear), coat?.mark ? coat.strength ?? 0.85 : 0]},
        arkYoungC: {value: [coat?.mark ? MARK_KIND[coat.mark] : 0, coat?.count ?? 4, coat?.tail ? 1 : 0, coat?.dull ?? 0]},
        arkYoungD: {value: [coat?.width ?? 0.35, coat?.broken ?? 0]}
    };
}

const smooth = (a: number, b: number, v: number) => {
    const u = Math.min(Math.max((v - a) / Math.max(b - a, 1e-6), 0), 1);
    return u * u * (3 - 2 * u);
};

/**
 * How strongly an animal wears its species' young coat (0-1): none for one that came aboard grown or whose age the
 * record does not give. `age`: its days of life and, while it is growing, how far grown (0-1; 1 or null once adult).
 */
export function youngCoatStrength(coat: YoungCoat | null, born: boolean, age: {ageDays: number | null; growth: number; young: boolean} | null): number {
    if (!coat || !born || !age || age.ageDays == null) return 0;
    if (coat.fade) return 1 - smooth(coat.fade[0], coat.fade[1], age.ageDays);
    return age.young ? 1 - smooth(0.7, 1, age.growth) : 0;
}

/** A strength (0-1) as the steps an animal carries. */
export function youngSteps(strength: number): number {
    return Math.round(Math.min(Math.max(strength, 0), 1) * YOUNG_STEPS);
}

/** `arkCoat.y` with the young coat's steps in its twos, the dust (0-1) kept under them. */
export function packYoung(y: number, steps: number): number {
    const dust = Math.min(Math.max(y - 2 * Math.floor(y * 0.5 + 0.001), 0), 1);
    return dust + 2 * Math.min(Math.max(Math.round(steps), 0), YOUNG_STEPS);
}

/** Writes an animal's young coat steps into the look pass's `arkCoat` (after that pass and the recipes' coat wrote wet and dust). */
export function applyYoungCoat(geometry: {getAttribute(name: string): unknown}, index: number, steps: number): void {
    if (steps <= 0) return;
    const attribute = geometry.getAttribute("arkCoat") as {count: number; getY(i: number): number; setY(i: number, y: number): void; needsUpdate: boolean} | undefined;
    if (!attribute || index >= attribute.count) return;
    attribute.setY(index, packYoung(attribute.getY(index), steps));
    attribute.needsUpdate = true;
}
