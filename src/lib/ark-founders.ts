/**
 * Ark founders on the web (docs/ark/FOUNDERS-CONTRACT.md, server migration
 * 20261114100000): who brought an animal, by name when the server names
 * them, and the story they chose to share. THE RULE: the server decides who
 * is named and which story is public; this only reads its answers.
 *
 * Behind the server's `founder_names` switch. While it is off every read
 * answers as before: labels are `{label, named}` with no `founder` key, no
 * `story`, no `founder_story`, and `voyage_founder_v1` answers null. That
 * absence is how the web tells the switch is off (`names: false`), and then
 * everything shows exactly as it did.
 *
 * The scene's snapshot decoder (`ark-scene/snapshot.ts`) keeps only the
 * labels; the founders ride beside it (`ArkFounders`, read from the same
 * `voyage_public_v2` answer by `arkFoundersOf`), so the scene is unchanged.
 */

import type {ArkZone} from "@/ark-scene/types";
import {ARK_ZONES} from "@/ark-scene/types";

/** A named founder: how the Ark shows them, and where their profile is. */
export type ArkFounder = {display_name: string; handle: string; avatar_url: string | null};

/** A story its founder shared: what they did, and one optional line about the problem, in their words. */
export type ArkFounderStory = {step: string; problem: string | null; shared_at: string | null};

/** A bringer as a label reads: `founder` only when the server names them (switch on). */
export type ArkLabel = {label: string; named: boolean; founder: ArkFounder | null};

/** One animal's founders, from the snapshot: who brought it (or, for the young, both parents' bringers) and its story. */
export type ArkAnimalFounders = {brought_by: ArkFounder | null; bringers: Array<ArkFounder | null>; story: ArkFounderStory | null};

/**
 * Beside the snapshot: `names` is true when the server sent founder keys
 * (the switch is on), and `animals` holds only the animals with a named
 * founder or a shared story, by id.
 */
export type ArkFounders = {names: boolean; animals: Record<string, ArkAnimalFounders>};

export const ARK_NO_FOUNDERS: ArkFounders = {names: false, animals: {}};

/** The share line's limits (the edge function's): what they did 3–300 characters, the problem 3–160 or none. */
export const ARK_STORY_STEP_MIN = 3;
export const ARK_STORY_STEP_MAX = 300;
export const ARK_STORY_PROBLEM_MIN = 3;
export const ARK_STORY_PROBLEM_MAX = 160;

const HANDLE = /^[a-z0-9](?:[a-z0-9._-]{0,28}[a-z0-9])?$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZONES = new Set<string>(ARK_ZONES);

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean) return null;
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function date(value: unknown): string | null {
    const at = text(value, 40);
    return at && !Number.isNaN(Date.parse(at)) ? at : null;
}

/** Only an https picture (a profile photo in storage); anything else is no avatar. */
function avatar(value: unknown): string | null {
    const url = text(value, 600);
    if (!url) return null;
    try {
        return new URL(url).protocol === "https:" ? url : null;
    } catch {
        return null;
    }
}

/** `{display_name, handle, avatar_url}`, checked: a founder without a usable handle is no founder (nothing to link to). */
export function decodeArkFounder(raw: unknown): ArkFounder | null {
    const row = record(raw);
    if (!row) return null;
    const handle = text(row.handle, 40)?.replace(/^@+/, "") ?? null;
    if (!handle || !HANDLE.test(handle)) return null;
    return {display_name: text(row.display_name, 60) ?? handle, handle, avatar_url: avatar(row.avatar_url)};
}

/** `{step, problem, shared_at}`, checked: no step, no story. */
export function decodeArkFounderStory(raw: unknown): ArkFounderStory | null {
    const row = record(raw);
    if (!row) return null;
    const step = text(row.step, ARK_STORY_STEP_MAX);
    if (!step) return null;
    return {step, problem: text(row.problem, ARK_STORY_PROBLEM_MAX), shared_at: date(row.shared_at)};
}

/** A label object, with its founder when named. */
export function decodeArkLabel(raw: unknown): ArkLabel | null {
    const row = record(raw);
    const label = text(row?.label, 60);
    if (!row || !label) return null;
    const founder = decodeArkFounder(row.founder);
    return {label, named: row.named === true || founder !== null, founder};
}

/** Whether a label came from a server with names on: it carries the `founder` key (null for a Voyager). */
export function arkLabelHasFounderKey(raw: unknown): boolean {
    const row = record(raw);
    return Boolean(row && "founder" in row);
}

/**
 * The founders in a `voyage_public_v2` answer (or a v1 one: none). `names`
 * when any label carries the `founder` key. Animals with nobody named and no
 * story are left out, so the answer stays small.
 */
export function arkFoundersOf(rawSnapshot: unknown): ArkFounders {
    const animals = record(rawSnapshot)?.animals;
    if (!Array.isArray(animals)) return ARK_NO_FOUNDERS;
    let names = false;
    const out: Record<string, ArkAnimalFounders> = {};
    for (const item of animals) {
        const row = record(item);
        const id = text(row?.id, 80);
        if (!row || !id) continue;
        const bringersRaw = Array.isArray(row.bringers) ? row.bringers.slice(0, 4) : [];
        if (arkLabelHasFounderKey(row.brought_by) || bringersRaw.some(arkLabelHasFounderKey)) names = true;
        const broughtBy = decodeArkFounder(record(row.brought_by)?.founder);
        const bringers = bringersRaw.map((b) => decodeArkFounder(record(b)?.founder));
        const story = decodeArkFounderStory(row.story);
        if (broughtBy || story || bringers.some(Boolean)) out[id] = {brought_by: broughtBy, bringers, story};
    }
    return {names, animals: out};
}

/** `ArkFounders` as the web's own route sends it (`/api/ark/voyage`'s `founders`), checked again: nothing from the network is trusted. */
export function decodeArkFounders(raw: unknown): ArkFounders {
    const row = record(raw);
    const animals = record(row?.animals);
    if (!row || !animals) return ARK_NO_FOUNDERS;
    const out: Record<string, ArkAnimalFounders> = {};
    for (const [id, value] of Object.entries(animals)) {
        const entry = record(value);
        if (!entry || !text(id, 80)) continue;
        out[id] = {
            brought_by: decodeArkFounder(entry.brought_by),
            bringers: (Array.isArray(entry.bringers) ? entry.bringers.slice(0, 4) : []).map(decodeArkFounder),
            story: decodeArkFounderStory(entry.story)
        };
    }
    return {names: row.names === true, animals: out};
}

/** A founder's profile on the web (the Link component adds the locale). */
export function arkFounderPath(founder: Pick<ArkFounder, "handle">): string {
    return `/u/${encodeURIComponent(founder.handle)}`;
}

// MARK: A founder's page (`voyage_founder_v1`)

export type ArkFounderAnimal = {
    id: string;
    species_profile_id: string;
    name: string;
    model_slug: string | null;
    zone: ArkZone | null;
    status: string | null;
    arrived_at: string | null;
    story: ArkFounderStory | null;
};

export type ArkFounderPage = {founder: ArkFounder | null; animals: ArkFounderAnimal[]};

/** `voyage_founder_v1(p_handle)`: null while the switch is off, for an unknown handle, or before the migration. */
export function decodeArkFounderPage(raw: unknown): ArkFounderPage | null {
    const row = record(raw);
    if (!row) return null;
    const animals: ArkFounderAnimal[] = [];
    for (const item of Array.isArray(row.animals) ? row.animals.slice(0, 200) : []) {
        const animal = record(item);
        const id = text(animal?.id, 80);
        const name = text(animal?.name, 120);
        if (!animal || !id || !name) continue;
        const zone = text(animal.zone, 40);
        animals.push({
            id,
            species_profile_id: text(animal.species_profile_id, 80) ?? "",
            name,
            model_slug: text(animal.model_slug, 120),
            zone: zone && ZONES.has(zone) ? zone as ArkZone : null,
            status: text(animal.status, 20),
            arrived_at: date(animal.arrived_at),
            story: decodeArkFounderStory(animal.story)
        });
    }
    return {founder: decodeArkFounder(row.founder), animals};
}

/** The animals on a founder's page that carry a shared story, newest first (the server's order). */
export function arkFounderStories(page: ArkFounderPage | null): Array<ArkFounderAnimal & {story: ArkFounderStory}> {
    return (page?.animals ?? []).filter((animal): animal is ArkFounderAnimal & {story: ArkFounderStory} => animal.story !== null);
}

// MARK: The person's own controls

export type ArkFounderBlocked = "under_18" | "private_profile" | "no_handle";

export type ArkFounderSettings = {
    enabled: boolean;
    show_name: boolean;
    chosen: boolean;
    blocked: ArkFounderBlocked | null;
    earlier_anonymous: number;
    founder: ArkFounder | null;
};

/** `voyage_founder_settings_v1()` / `set_voyage_founder_name_v1`'s answer, checked; null when it isn't one. */
export function decodeArkFounderSettings(raw: unknown): ArkFounderSettings | null {
    const row = record(Array.isArray(raw) ? raw[0] : raw);
    if (!row || typeof row.enabled !== "boolean") return null;
    const blocked = row.blocked === "under_18" || row.blocked === "private_profile" || row.blocked === "no_handle" ? row.blocked : null;
    const earlier = typeof row.earlier_anonymous === "number" && Number.isFinite(row.earlier_anonymous) ? Math.max(0, Math.floor(row.earlier_anonymous)) : 0;
    return {
        enabled: row.enabled,
        show_name: row.show_name !== false,
        chosen: row.chosen === true,
        blocked,
        earlier_anonymous: earlier,
        founder: decodeArkFounder(row.founder)
    };
}

/** What the switch shows: off and disabled when blocked, else the server's position. */
export function arkFounderSwitch(settings: ArkFounderSettings): {checked: boolean; disabled: boolean} {
    return settings.blocked ? {checked: false, disabled: true} : {checked: settings.show_name, disabled: false};
}

// MARK: The share line (`voyage_founder_story_draft_v1`, `voyage-founder-story`)

export type ArkStoryDraft = {
    animal_id: string;
    species: string | null;
    /** The prefill: the step's own words (never the problem). */
    step: string | null;
    /** What they shared, when they have. */
    story: ArkFounderStory | null;
    can_share: boolean;
    reason: "disabled" | "not_yours" | "under_18" | null;
};

export function decodeArkStoryDraft(raw: unknown): ArkStoryDraft | null {
    const row = record(raw);
    const id = text(row?.animal_id, 80);
    if (!row || !id || !UUID.test(id)) return null;
    const reason = row.reason === "disabled" || row.reason === "not_yours" || row.reason === "under_18" ? row.reason : null;
    return {
        animal_id: id.toLowerCase(),
        species: text(row.species, 120),
        step: text(row.step, ARK_STORY_STEP_MAX),
        story: decodeArkFounderStory(row.story),
        can_share: row.can_share === true && reason === null,
        reason
    };
}

/** The share line's body for the edge function, or why it can't go: the step 3–300 characters, the problem 3–160 or left out. */
export function arkStoryShareBody(animalId: string, step: string, problem: string | null | undefined):
    | {ok: true; body: {animal_id: string; step: string; problem?: string}}
    | {ok: false; error: "invalid_animal_id" | "story_too_short" | "story_too_long"} {
    if (!UUID.test(animalId)) return {ok: false, error: "invalid_animal_id"};
    const what = step.replace(/\s+/g, " ").trim();
    const why = (problem ?? "").replace(/\s+/g, " ").trim();
    if (what.length < ARK_STORY_STEP_MIN || (why && why.length < ARK_STORY_PROBLEM_MIN)) return {ok: false, error: "story_too_short"};
    if (what.length > ARK_STORY_STEP_MAX || why.length > ARK_STORY_PROBLEM_MAX) return {ok: false, error: "story_too_long"};
    return {ok: true, body: why ? {animal_id: animalId.toLowerCase(), step: what, problem: why} : {animal_id: animalId.toLowerCase(), step: what}};
}

/** How a share went, from the edge function's status and body (contract section 3). */
export type ArkStoryShareResult =
    | {ok: true; story: ArkFounderStory}
    | {ok: false; problem: "not_public" | "could_not_check" | "unavailable"};

export function arkStoryShareResult(status: number, body: unknown): ArkStoryShareResult {
    const row = record(body);
    if (status >= 200 && status < 300 && row?.ok === true) {
        const story = decodeArkFounderStory(row.story);
        return story ? {ok: true, story} : {ok: false, problem: "unavailable"};
    }
    if (status === 422 || row?.error === "not_public") return {ok: false, problem: "not_public"};
    if (status === 503 || row?.error === "could_not_check") return {ok: false, problem: "could_not_check"};
    // 401/403/400/500: nothing the person can fix with other words; the line says to try again.
    return {ok: false, problem: "unavailable"};
}
