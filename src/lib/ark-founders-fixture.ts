/**
 * Development's founders (`/ark?fixture=1&founders=1`, `/u/{handle}/ark?fixture=founder`,
 * the chat's `?arkfounder=1`): the fixture Ark as the server answers it with
 * its `founder_names` switch on. Made-up people, no production data.
 *
 * Voyager 1 becomes "Maya Chen" (@mayachen, with a photo), who shared how her
 * African Lion got aboard; Voyager 4 becomes "Jonas Berg" (@jonasberg, no
 * photo), who shared nothing. Everyone else stays a Voyager (`founder: null`).
 */

import {getSpeciesArtworkUrl} from "@/lib/species-artwork";
import type {ArkFounderPage, ArkStoryDraft} from "@/lib/ark-founders";

type Raw = Record<string, unknown>;

export const ARK_FIXTURE_FOUNDERS: Record<string, {display_name: string; handle: string; avatar_url: string | null}> = {
    "Voyager 1": {display_name: "Maya Chen", handle: "mayachen", avatar_url: getSpeciesArtworkUrl("red-fox")},
    "Voyager 4": {display_name: "Jonas Berg", handle: "jonasberg", avatar_url: null}
};

/** The fixture's African Lion (Voyager 1's): its founder shared how it got aboard. */
export const ARK_FIXTURE_STORY_ANIMAL = "9650250d-035d-4e7a-a21c-dd4520530606";
/** The fixture's Domestic Cat (Voyager 4's): named, nothing shared. */
export const ARK_FIXTURE_NAMED_ANIMAL = "68bd4158-a6eb-438c-ae02-a4e9191cdf8b";

export const ARK_FIXTURE_STORY = {
    step: "Before the meeting I wrote down the one thing I needed to say, and said it first, calmly, before anyone else spoke.",
    problem: "I kept getting talked over at work and went quiet",
    shared_at: "2026-11-02T09:30:00Z"
};

/** A label as the server writes it with names on: the founder's name and identity, or `founder: null`. */
function named(label: unknown): unknown {
    if (!label || typeof label !== "object") return label;
    const row = label as Raw;
    const founder = typeof row.label === "string" ? ARK_FIXTURE_FOUNDERS[row.label] ?? null : null;
    return founder ? {label: founder.display_name, named: true, founder} : {...row, founder: null};
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

/** A `voyage_public_v1|v2` fixture answer as v2 answers with names on. */
export function withArkFixtureFounders<T>(raw: T): T {
    const copy = clone(raw) as unknown as Raw;
    const animals = Array.isArray(copy.animals) ? copy.animals as Raw[] : [];
    for (const animal of animals) {
        animal.brought_by = named(animal.brought_by);
        if (Array.isArray(animal.bringers)) animal.bringers = animal.bringers.map(named);
        animal.story = animal.id === ARK_FIXTURE_STORY_ANIMAL ? ARK_FIXTURE_STORY : null;
    }
    return copy as unknown as T;
}

/** The fixture's life stories (`voyage_animal_life_v1` by id) as they read with names on. */
export function withArkFixtureFounderLives(lives: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [id, value] of Object.entries(clone(lives))) {
        const life = value as Raw;
        const origin = (life.origin ?? {}) as Raw;
        if (origin.brought_by) origin.brought_by = named(origin.brought_by);
        if (Array.isArray(origin.born_to)) origin.born_to = origin.born_to.map(named);
        if (life.ancestor_brought_by) life.ancestor_brought_by = named(life.ancestor_brought_by);
        life.founder_story = id === ARK_FIXTURE_STORY_ANIMAL ? ARK_FIXTURE_STORY : null;
        out[id] = life;
    }
    return out;
}

/** `voyage_founder_v1` for the fixture's founders (an unknown handle: a Voyager's empty page). */
export function fixtureArkFounderPage(handle: string): ArkFounderPage {
    const founder = Object.values(ARK_FIXTURE_FOUNDERS).find((item) => item.handle === handle.toLowerCase()) ?? ARK_FIXTURE_FOUNDERS["Voyager 1"];
    const story = founder.handle === "mayachen";
    return {
        founder,
        animals: [
            {id: ARK_FIXTURE_STORY_ANIMAL, species_profile_id: "15d407cf-1155-4680-a1ff-125de0644832", name: "African Lion", model_slug: "african-lion", zone: "grassland", status: "present", arrived_at: "2026-10-30T13:12:17Z", story: story ? ARK_FIXTURE_STORY : null},
            {id: "17eced97-3ac1-43d9-ae0a-8f129efec5d6", species_profile_id: "", name: "Scarlet Macaw", model_slug: "scarlet-macaw", zone: "rainforest", status: "present", arrived_at: "2026-10-29T08:00:00Z", story: story ? {step: "I asked my neighbour for help with the garden instead of doing it all alone.", problem: null, shared_at: "2026-10-29T10:00:00Z"} : null}
        ]
    };
}

/** The chat's share line in development: a step to prefill, nothing shared yet, a known adult (the hook's `?arkfounder=` modes vary it). */
export function fixtureArkStoryDraft(animalId: string, species: string | null): ArkStoryDraft {
    return {
        animal_id: animalId,
        species,
        step: "Tonight, before bed, write the one sentence you want to say to your brother, and send it in the morning.",
        story: null,
        can_share: true,
        reason: null,
        needs_adult_confirm: false,
        ask_name: false
    };
}
