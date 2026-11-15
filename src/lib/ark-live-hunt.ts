/**
 * The live hunt marker (lane ark-kills-real): while a real hunt or meal is under way anywhere on the island, one small
 * chip names the newest ("A hunt is under way · African Lion"); tapped, the camera flies there (the scene's own
 * selection). And the meals the live world acts: the hunting read's recent encounter meals joined to the event log's
 * records of the two animals (the eaten one's model and place), nothing made up.
 */
import type {ArkLiveHunt} from "@/ark-scene/types";
import type {ArkHuntingMeal} from "@/lib/ark-hunting";
import type {ArkAct, ArkEvent} from "@/lib/ark-life";
import {fillArkWords, type ArkWords} from "@/lib/ark-words";

/** How long after its step a meal may still be under way or have traces showing (s): the read's own window is 2 h. */
export const ARK_LIVE_MEAL_SECONDS = 7200;

/** `ark.hunt` in the locale files. */
export type ArkHuntWords = {
    /** "A hunt is under way · {animal}" */
    hunting: string;
    /** "A {animal} is eating its catch" style: "A meal is under way · {animal}" */
    eating: string;
    /** The chip's accessible name: "{line}. Show me" */
    label: string;
};

/** English, as `en.json` has it (the fallback while a locale lacks it). */
export const ARK_HUNT_ENGLISH: ArkHuntWords = {
    hunting: "A hunt is under way · {animal}",
    eating: "A meal is under way · {animal}",
    label: "{line}. Show me"
};

/** The chip's words: its line, or its accessible name. */
export function arkHuntLine(words: Pick<ArkWords, "hunt">, hunt: Pick<ArkLiveHunt, "name" | "phase">, what: "line" | "label"): string {
    const w = {...ARK_HUNT_ENGLISH, ...(words.hunt ?? {})};
    const line = fillArkWords(hunt.phase === "eating" ? w.eating : w.hunting, {animal: hunt.name});
    return what === "line" ? line : fillArkWords(w.label, {line});
}

/** The meals to act: each read meal whose two animals the event log's meal row names (its records), with its encounter. */
export function arkLiveMealsFrom(meals: readonly ArkHuntingMeal[], events: readonly ArkEvent[]): Array<Extract<ArkAct, {kind: "meal"}>> {
    const out: Array<Extract<ArkAct, {kind: "meal"}>> = [];
    for (const meal of meals) {
        const row = events.find((e) => e.kind === "meal" && e.animal?.id === meal.predator && e.other?.id === meal.prey);
        if (!row?.animal || !row.other) continue;
        out.push({kind: "meal", at: row.at, predator: row.animal, prey: row.other, phrase: row.phrase, extinct: false, encounter: meal.encounter});
    }
    return out;
}
