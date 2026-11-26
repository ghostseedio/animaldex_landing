/**
 * "Chance of eating soon" on an animal's bars and card (owner 2026-11-24: a small % on the status bars, only if it costs
 * little compute, and honest: from the numbers the engine uses). Public (on by default) since 2026-11-26; `?eatsoon=0`
 * turns it off (`arkEatSoonOn`).
 *
 * What it says, by who the animal is:
 * - A wild hunter (one the hunting read names, `voyage_hunting_v1`): its chance of a catch in the next Ark day,
 *   P = (1 - (1 - find)^n) x catch, where
 *   - n: its awake 15-Ark-minute steps from its next hunt (the engine's own `hunt_from`, a miss's cooldown and the
 *     flow costs' setbacks already in it) to an Ark day from now, worked out by the shared positions module's `awakeAt`
 *     (the engine's own awake rule);
 *   - find: the share of its recent due, awake steps in which the engine's encounter test found prey it could take
 *     (the engine's, sent on the read's tuple; never rebuilt here: no look-ahead of the engine's inputs);
 *   - catch: the engine's catch chance per attempt against the prey it found last (`hunt.ts` CatchChance.chance).
 *   A miss costs at least one Ark day's cooldown (hunt styles, D12), so at most one attempt falls in the window: the
 *   chance of finding prey at least once, times the chance a try lands. With n = 0 it is not hunting in the window:
 *   "Hunts again in about X" (the first awake step on or after its next hunt). Without the engine's two numbers (an older
 *   read) no % is shown: "Hunting now" while due, or "Hunts again in about X".
 * - A dormant hunter (the engine says so on the tuple): "Dormant".
 * - A kept animal (a house, a farm, the zoo): fed by its carers, no %.
 * - Every other animal (grazers, browsers, foragers, the town's wild animals): fed by the day's food (the engine shares
 *   the ambient food out once a day; it is not a draw, so no % would be honest): "Eats every day", or "Food is short
 *   here" when the read says it is hungry.
 * - A human: nothing.
 *
 * Pure: no clock, no randomness, no I/O. The scene works out n once per status (at most about once a second, for the
 * selected animal only), never per frame.
 */

import {arkIsHuman} from "@/lib/ark-human";
import {arkHumanSpan} from "@/lib/ark-human-time";
import {fillArkWords} from "@/lib/ark-words";
import type {ArkAnimal} from "@/ark-scene/types";

/** The engine's two numbers for a predator (the read's tuple `[id, from, find, catch, dormant?]`). */
export type ArkHuntOdds = {find: number | null; catch: number | null; dormant: boolean};

/** What its due window looks like, from the hunting layer (its next hunt and the awake steps). */
export type ArkHuntWindow = {
    /** Its awake steps in the next Ark day on or after its next hunt. */
    steps: number;
    /** The first such step (epoch s), when one is in the next few Ark days; null past that. */
    firstAt: number | null;
};

export type ArkCarer = "owner" | "farmer" | "keeper";

export type ArkEatSoon =
    | {kind: "chance"; value: number}
    | {kind: "hunting"}
    | {kind: "later"; at: number}
    | {kind: "dormant"}
    | {kind: "kept"; carer: ArkCarer}
    | {kind: "daily"}
    | {kind: "short"};

/** The steps in an Ark day (`positions.ts` STEPS_PER_ARK_DAY). */
export const ARK_EAT_SOON_STEPS = 96;

/** P(a catch in the window) = (1 - (1 - find)^n) x catch; 0 with no step. Both inputs held to 0..1. */
export function arkCatchChance(find: number, catchChance: number, steps: number): number {
    if (!(steps > 0) || !Number.isFinite(find) || !Number.isFinite(catchChance)) return 0;
    const f = Math.min(Math.max(find, 0), 1);
    const c = Math.min(Math.max(catchChance, 0), 1);
    return (1 - Math.pow(1 - f, Math.min(Math.floor(steps), ARK_EAT_SOON_STEPS))) * c;
}

/**
 * The stalking cue (2026-11-26, "show what's about to happen"): a hunter out on its forays now whose chance of a catch in
 * the next Ark day is at least this gets a faint pulsing ring in the scene. The same number as its card's %.
 */
export const ARK_STALK_CUE = 0.4;

/**
 * Its chance when the scene should cue it as stalking, else null: hunting now (due and awake, the hunting layer's own
 * rule), not dormant, the engine's two numbers sent, and a chance of at least `ARK_STALK_CUE`. Pure.
 */
export function arkStalkCue(odds: ArkHuntOdds | null, window: ArkHuntWindow | null, huntingNow: boolean, least = ARK_STALK_CUE): number | null {
    if (!huntingNow || !odds || odds.dormant || odds.find === null || odds.catch === null || !window || !(window.steps > 0)) return null;
    const chance = arkCatchChance(odds.find, odds.catch, window.steps);
    return chance >= least ? chance : null;
}

/** Whether a hunter's two numbers could ever reach the cue (no window needed): a cheap first pass over the read. */
export function arkStalkCouldCue(odds: ArkHuntOdds | null, least = ARK_STALK_CUE): boolean {
    return Boolean(odds && !odds.dormant && odds.find !== null && odds.catch !== null && odds.find > 0 && arkCatchChance(odds.find, odds.catch, ARK_EAT_SOON_STEPS) >= least);
}

const CARER: Record<string, ArkCarer> = {house: "owner", farm: "farmer", zoo: "keeper"};

export type ArkEatSoonInput = {
    animal: Pick<ArkAnimal, "species_profile_id" | "kind_species_profile_id" | "model_slug" | "scientific_name" | "area" | "condition">;
    /** Is it a hunter the read names (it has a next hunt): its window, else null. */
    window: ArkHuntWindow | null;
    /** The engine's two numbers, when the read sends them. */
    odds: ArkHuntOdds | null;
};

/** What its bars and card say about eating soon, or null (a human). */
export function arkEatSoon(input: ArkEatSoonInput): ArkEatSoon | null {
    const {animal, window, odds} = input;
    if (arkIsHuman(animal)) return null;
    const carer = animal.area ? CARER[animal.area] : undefined;
    if (carer) return {kind: "kept", carer};
    if (window) {
        if (odds?.dormant) return {kind: "dormant"};
        if (window.steps > 0) return odds && odds.find !== null && odds.catch !== null ? {kind: "chance", value: round(arkCatchChance(odds.find, odds.catch, window.steps))} : {kind: "hunting"};
        return window.firstAt !== null ? {kind: "later", at: window.firstAt} : null;
    }
    return animal.condition === "hungry" ? {kind: "short"} : {kind: "daily"};
}

function round(value: number): number {
    return Math.round(Math.min(Math.max(value, 0), 1) * 1000) / 1000;
}

/** Its words (`ark.card` in the locale files). */
export type ArkEatSoonWords = {
    eatSoon: string;
    eatSoonChance: string;
    eatSoonHunting: string;
    eatSoonLater: string;
    eatSoonDormant: string;
    eatSoonKept: string;
    eatSoonDaily: string;
    eatSoonShort: string;
};

export const ARK_EAT_SOON_ENGLISH: ArkEatSoonWords = {
    eatSoon: "Chance of a catch in the next Ark day",
    eatSoonChance: "{percent} chance of a catch in the next Ark day",
    eatSoonHunting: "Hunting now",
    eatSoonLater: "Hunts again in about {time}",
    eatSoonDormant: "Dormant: not eating",
    eatSoonKept: "Fed by its carers",
    eatSoonDaily: "Eats every day",
    eatSoonShort: "Food is short here"
};

/** A whole percent, never "0%" for a real but small chance (under half a percent says "<1%"). */
export function arkEatSoonPercent(value: number, locale: string): string {
    const v = Math.min(Math.max(value, 0), 1);
    const format = (n: number) => {
        try {
            return new Intl.NumberFormat(locale, {style: "percent", maximumFractionDigits: 0}).format(n);
        } catch {
            return `${Math.round(n * 100)}%`;
        }
    };
    return v > 0 && v < 0.005 ? `<${format(0.01)}` : format(v);
}

/** Its line in the reader's words, and the short % for the bars (null unless it is a chance). */
export function arkEatSoonText(soon: ArkEatSoon, words: Partial<ArkEatSoonWords> | null | undefined, locale: string, nowSeconds: number): {text: string; percent: string | null} {
    const w = (key: keyof ArkEatSoonWords) => (words?.[key] && String(words[key]).trim()) || ARK_EAT_SOON_ENGLISH[key];
    switch (soon.kind) {
        case "chance": {
            const percent = arkEatSoonPercent(soon.value, locale);
            return {text: fillArkWords(w("eatSoonChance"), {percent}), percent};
        }
        case "hunting":
            return {text: w("eatSoonHunting"), percent: null};
        case "later":
            return {text: fillArkWords(w("eatSoonLater"), {time: arkHumanSpan(Math.max((soon.at - nowSeconds) * 1000, 60_000), undefined, locale, "long")}), percent: null};
        case "dormant":
            return {text: w("eatSoonDormant"), percent: null};
        case "kept":
            return {text: w("eatSoonKept"), percent: null};
        case "daily":
            return {text: w("eatSoonDaily"), percent: null};
        case "short":
            return {text: w("eatSoonShort"), percent: null};
    }
}

/**
 * The display switch. Public since 2026-11-26 (the engine's `voyage_hunt_odds` live on `voyage_hunting_v1`): on by
 * default; `?eatsoon=0` on the page or the embed, or `globalThis.__arkEatSoon = false`, turns it off (a comparison
 * picture, a fault to rule out).
 */
export function arkEatSoonOn(): boolean {
    const g = globalThis as {__arkEatSoon?: boolean; location?: {search?: string}};
    if (g.__arkEatSoon === false) return false;
    try {
        return new URLSearchParams(g.location?.search ?? "").get("eatsoon") !== "0";
    } catch {
        return true;
    }
}
