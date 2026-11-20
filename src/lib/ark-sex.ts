/**
 * Male and female, said (the coordinator, 2026-11-20: beside an animal's name in its panel and in the species list's rows, with
 * accessible labels, in the 45 Ark languages; kinds with no sexes say so). Pure, and NOT in the /ark page's first JavaScript
 * (`ark-page-weight.test.ts`): the panel and the list reach it through a lazy import (`ark/ark-sex.tsx`), the embed's bars directly.
 *
 * The server sends each animal's `sex` ("m", "f", or null where its kind keeps none) and, for a kind that is not a male and a
 * female, its `reproduction` mode, only while its `sexes` switch is on (AnimalDex migration 20261209130000). With the switch off no
 * animal carries the key: nothing is said. A stored sex is the animal's own, set when it was born or came aboard.
 */

import type {ArkAnimal} from "@/ark-scene/types";
import {fillArkWords} from "@/lib/ark-words";

export type ArkSexWords = {
    male: string;
    female: string;
    /** "male: {count}", "female: {count}" (a species row's tally). */
    maleN: string;
    femaleN: string;
    /** A kind that is not a male and a female. */
    hermaphrodite: string;
    parthenogenetic: string;
    asexual: string;
};

export type ArkSexView = {
    /** What is drawn: ♂, ♀, "♂3 ♀4", or (a kind with no sexes) its note. */
    text: string;
    /** What a screen reader says (also the tooltip). */
    label: string;
    /** A note about the kind, not a mark. */
    note: boolean;
};

export const ARK_SEX_MARK = {m: "♂", f: "♀"} as const;

/**
 * What to say of these animals (one animal's panel, or every animal of a species' row): ♂ or ♀ for one; "♂3 ♀4" for several;
 * the kind's note when it keeps no males and females (a hermaphrodite, parthenogenetic or asexual kind). Null: nothing: the server's
 * switch is off (no animal carries `sex`), or none of them has a sex.
 */
export function arkSexView(animals: ReadonlyArray<Pick<ArkAnimal, "sex" | "reproduction">>, words: Partial<ArkSexWords> | null | undefined, number: (n: number) => string = String): ArkSexView | null {
    if (!words || !animals.some((a) => a.sex !== undefined)) return null;
    const mode = animals.find((a) => a.reproduction === "hermaphrodite" || a.reproduction === "parthenogenetic" || a.reproduction === "asexual")?.reproduction;
    const note = mode ? words[mode] : null;
    if (note) return {text: note, label: note, note: true};
    const males = animals.filter((a) => a.sex === "m").length;
    const females = animals.filter((a) => a.sex === "f").length;
    if (!males && !females) return null;
    if (animals.length === 1) {
        const label = males ? words.male : words.female;
        return label ? {text: males ? ARK_SEX_MARK.m : ARK_SEX_MARK.f, label, note: false} : null;
    }
    const parts: Array<{text: string; label: string}> = [];
    if (males && words.maleN) parts.push({text: `${ARK_SEX_MARK.m}${number(males)}`, label: fillArkWords(words.maleN, {count: number(males)})});
    if (females && words.femaleN) parts.push({text: `${ARK_SEX_MARK.f}${number(females)}`, label: fillArkWords(words.femaleN, {count: number(females)})});
    return parts.length ? {text: parts.map((p) => p.text).join(" "), label: parts.map((p) => p.label).join(", "), note: false} : null;
}
