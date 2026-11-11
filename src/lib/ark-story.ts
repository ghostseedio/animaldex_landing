/**
 * "How it got aboard", for the animal tapped on /ark: `voyage_animal_story_v1(p_animal_id)`.
 *
 * The function answers NULL, or exactly
 * `{"kind":"public_debate","problem":…,"way":{"animal":…,"power":…},"debate_id":uuid|null}`,
 * and only for an animal that came from a PUBLIC debate by an adult. Anything
 * else (a missing function, an error, a different shape) is null: the card
 * then says only that a step worked, and never anything private.
 */

import type {ArkAnimal} from "@/ark-scene/types";
import {decodeArkFounderStory, decodeArkLabel, type ArkFounderStory, type ArkLabel} from "@/lib/ark-founders";

export type ArkAnimalStory = {
    kind: "public_debate";
    problem: string;
    way: {animal: string; power: string};
    debate_id: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isArkUuid(value: unknown): value is string {
    return typeof value === "string" && UUID.test(value);
}

function text(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean) return null;
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function decodeArkStory(raw: unknown): ArkAnimalStory | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    if (row.kind !== "public_debate") return null;
    const way = row.way && typeof row.way === "object" ? row.way as Record<string, unknown> : null;
    const problem = text(row.problem, 220);
    const animal = text(way?.animal, 80);
    const power = text(way?.power, 80);
    if (!problem || !animal || !power) return null;
    return {kind: "public_debate", problem, way: {animal, power}, debate_id: isArkUuid(row.debate_id) ? row.debate_id : null};
}

/**
 * Founders (founders contract, section 2): when the animal's founder shared
 * how it got aboard, the read answers that first, as
 * `{kind: "founder_story", step, problem, shared_at, brought_by: label}`,
 * whether or not the founder is named (an anonymous founder's story sits
 * under "Voyager N"). Otherwise it answers as before.
 */
export type ArkFounderStoryRead = ArkFounderStory & {kind: "founder_story"; brought_by: ArkLabel | null};

/** Either story the read can answer. */
export type ArkStoryRead = ArkAnimalStory | ArkFounderStoryRead;

/** `voyage_animal_story_v1`'s answer, either kind, checked; null for anything else. */
export function decodeArkStoryRead(raw: unknown): ArkStoryRead | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    if (row.kind === "founder_story") {
        const story = decodeArkFounderStory(row);
        return story ? {kind: "founder_story", ...story, brought_by: decodeArkLabel(row.brought_by)} : null;
    }
    return decodeArkStory(raw);
}

/** PostgREST's "no such function" (before the migration is applied): not an error worth a warning. */
export function isMissingArkFunction(error: {code?: string | null; message?: string | null} | null | undefined): boolean {
    if (!error) return false;
    return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

/**
 * Development's `?fixture=` Ark: a made-up story on two animals (the second
 * and the fourth to arrive, one with its debate and one without), so the
 * card's line can be seen without the function. Every other animal gets the
 * plain line.
 */
export function fixtureArkStory(animal: ArkAnimal, animals: ArkAnimal[]): ArkAnimalStory | null {
    const at = animals.findIndex((other) => other.id === animal.id);
    if (at === 1) {
        return {kind: "public_debate", problem: "I keep putting off the hard conversation with my brother", way: {animal: "Wolf", power: "Return to the Pack"}, debate_id: "00000000-0000-4000-8000-00000000d0b8"};
    }
    if (at === 3) {
        return {kind: "public_debate", problem: "My mornings fall apart before I get to work", way: {animal: "Honey Bee", power: "One Flower at a Time"}, debate_id: null};
    }
    return null;
}
