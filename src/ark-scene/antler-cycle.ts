/**
 * The antler cycle (3.3 batch, lane C; owner 2026-11-16), for the deer whose own catalogue row says how their antlers
 * come and go (`young-life.json` antlers, built by scripts/ark-young-life.mts): an elk bull's grow in velvet each summer
 * and are gone from early winter; a reindeer bull's are gone in winter while the cows keep theirs; a red deer's grow
 * in velvet before the rut; a chital stag's each on his own year. The months are the Ark year's (`seasonMonthAt`).
 *
 * The models carry their antlers in the mesh (one piece with the head). The look shader folds the points above the
 * antlers' start (`cut`, measured per model) to the skull: smaller while they grow, gone when shed; velvet tints them.
 * An animal's state rides in its `arkCoat.y` above the young coat's bits (`packAntler`): 0 as drawn (hard antler),
 * 1-14 growing in velvet (the size), 15 none. Pure in the month and the animal's id.
 */
import table from "@/ark-scene/young-life.json";
import type {ArkSex} from "@/ark-scene/behaviour-recipes";
import {unit} from "@/lib/ark-clock";

export type AntlerSpec = {
    name: string;
    line: string;
    /** Only the males carry them (the row names bulls or stags). */
    males: boolean;
    velvet?: number[];
    bare?: number[];
    bareMales?: number[];
    /** Each on his own year: this many months bare, then this many in velvet, the rest hard. */
    unsynced?: {bare: number; velvet: number};
    /** When the row's sentence is true of the animal: in velvet; in hard antler; a female keeping hers while the males are bare. */
    say: "velvet" | "hard" | "kept";
    cut: [number, number, number];
};

const SPECS = (table as unknown as {antlers: Record<string, AntlerSpec>}).antlers;

export function antlerOf(slug: string | null | undefined): AntlerSpec | null {
    return (slug && SPECS[slug]) || null;
}

export const ANTLER_NONE = 15;
const VELVET_MOST = 14;

export type AntlerState = {code: number; phase: "hard" | "velvet" | "bare"; say: boolean};

/** An animal's antlers in a month (1-12) of the Ark year. */
export function antlerState(spec: AntlerSpec, month: number, sex: ArkSex, id: string): AntlerState {
    const bare = (say = false): AntlerState => ({code: ANTLER_NONE, phase: "bare", say});
    if (spec.males && sex !== "male") return bare();
    let m = month;
    let velvet = spec.velvet ?? [];
    let gone = spec.bare ?? [];
    if (spec.unsynced) {
        // His own year: the months turned by his id (the same for every viewer).
        const offset = Math.floor(unit(id, "antler-year") * 12);
        m = ((month - 1 - offset + 24) % 12) + 1;
        gone = Array.from({length: spec.unsynced.bare}, (_, k) => k + 1);
        velvet = Array.from({length: spec.unsynced.velvet}, (_, k) => spec.unsynced!.bare + k + 1);
    }
    if (gone.includes(m)) return bare();
    if (sex === "male" && spec.bareMales?.includes(m)) return bare();
    const v = velvet.indexOf(m);
    if (v >= 0) return {code: 1 + Math.round(((VELVET_MOST - 1) * (v + 1)) / velvet.length), phase: "velvet", say: spec.say === "velvet"};
    const kept = spec.say === "kept" && sex === "female" && Boolean(spec.bareMales?.includes(m));
    return {code: 0, phase: "hard", say: spec.say === "hard" || kept};
}

/** The look shader's `arkAntler` for a species: where its antlers start (y, zMin, zBase); none: never above the model. */
export function antlerUniform(slug: string | null | undefined): [number, number, number, number] {
    const spec = antlerOf(slug);
    return spec ? [spec.cut[0], spec.cut[1], spec.cut[2], 1] : [1e4, 1e4, 0, 0];
}

/** `arkCoat.y` with the antler code above the dust and young coat (which keep their 0-32). */
export function packAntler(y: number, code: number): number {
    const low = y - 32 * Math.floor(y / 32 + 1e-6);
    return Math.max(low, 0) + 32 * Math.min(Math.max(Math.round(code), 0), ANTLER_NONE);
}

/** Writes an animal's antler code into the look pass's `arkCoat` (after the young coat). */
export function applyAntler(geometry: {getAttribute(name: string): unknown}, index: number, code: number): void {
    if (code <= 0) return;
    const attribute = geometry.getAttribute("arkCoat") as {count: number; getY(i: number): number; setY(i: number, y: number): void; needsUpdate: boolean} | undefined;
    if (!attribute || index >= attribute.count) return;
    attribute.setY(index, packAntler(attribute.getY(index), code));
    attribute.needsUpdate = true;
}

/** The same fold as the shader (for the tests): a rest point of the model with the antler code. */
export function foldAntler(p: [number, number, number], cut: [number, number, number], code: number): [number, number, number] {
    if (code <= 0 || p[1] <= cut[0] || p[2] <= cut[1]) return p;
    const k = code >= ANTLER_NONE ? 0 : 0.35 + (0.65 * (code - 1)) / (VELVET_MOST - 1);
    return [p[0] * k, cut[0] + (p[1] - cut[0]) * k, cut[2] + (p[2] - cut[2]) * k];
}
