/**
 * The shared Ark in the chat and the Ark Score (AnimalDex docs/ark-next.md
 * Parts 2 and 3; docs/ark-spec.md, "Decisions (2026-11-11, captures +
 * thrive)"; the frozen read contract, docs/ark/captures-thrive-design.md
 * section 0).
 *
 * - The Ark Score is v3 (`ark_points`): the sum of the points each of your
 *   steps that worked locked in, more for animals the Ark needs. It has no
 *   top, never goes down, and captures, other people and the daily tick never
 *   lower it. `ark_points_week` is this week's points. The v2 world score
 *   (`ark_world_score`, 0–100) is read only from a server without
 *   `ark_points`, and the Life Sim bar sum (`ark_score`, 0–500) only from one
 *   older still, each for one deploy cycle.
 * - Life is the five bars, with no total (`life`).
 * - Under a step card, one line says what the step does for the reader's
 *   animals of that kind (`voyage_step_offer_state_v1`: `thrive` or
 *   `thrive_later`, with the band now and after). Steps no longer bring
 *   animals; captures do.
 *
 * Pure: the routes, the chat, the profile and the tests read it. Every field
 * is read tolerantly; the server decides every number.
 */

import {arkThrive} from "@/ark-scene/thrive";
import type {ArkThrive} from "@/ark-scene/types";

export type ArkScoreRead = {
    value: number;
    /** The top of an older score's range (100 for v2, 500 for the Life Sim sum); null for v3, which has none. */
    outOf: 100 | 500 | null;
    /** A score of the shared Ark (v3 or v2), not the old Life Sim sum. */
    world: boolean;
    /** v3 (`ark_points`): points from steps that worked, no top, never lower. */
    points: boolean;
};

export type ArkLife = {
    /** Money's 0–100 bar (`money_bar`), not the balance. */
    moneyBar: number | null;
    relationships: number | null;
    energy: number | null;
    reputation: number | null;
    experience: number | null;
};

/** `thrive`: the reader has living animals of this kind aboard; `thrive_later`: none (never captured, died, no model yet). */
export type ArkStepOfferState = "thrive" | "thrive_later";

/** `voyage_step_offer_state_v1`: what a step that works does for this reader's animals of this kind. */
export type ArkStepOffer = {
    state: ArkStepOfferState;
    /** The look's display name, as the server sends it. */
    species: string;
    /** The reader's own living animals of this kind aboard, 0–2. */
    livingBrought: number;
    /** The reader's condition for the kind now, and what one more worked step would leave it at. */
    bandNow: ArkThrive;
    bandIfWorked: ArkThrive;
};

function record(value: unknown): Record<string, unknown> | null {
    if (typeof value === "string") {
        try {
            return record(JSON.parse(value));
        } catch {
            return null;
        }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function integer(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function text(value: unknown, max = 120): string | null {
    if (typeof value !== "string") return null;
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean) return null;
    return clean.length > max ? clean.slice(0, max).trimEnd() : clean;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// MARK: - The Ark Score

/**
 * A row's Ark Score: `ark_points` (v3: no top, never lower) when the server
 * sends it; else `ark_world_score` (v2, 0–100) from a server without v3; else
 * the old `ark_score` (0–500) from one older still. Null when none is there.
 */
export function readArkScore(row: unknown): ArkScoreRead | null {
    const fields = record(row);
    if (!fields) return null;
    const points = integer(fields.ark_points);
    if (points !== null) return {value: Math.max(points, 0), outOf: null, world: true, points: true};
    const world = integer(fields.ark_world_score);
    if (world !== null) return {value: clamp(world, 0, 100), outOf: 100, world: true, points: false};
    const legacy = integer(fields.ark_score);
    return legacy !== null ? {value: clamp(legacy, 0, 500), outOf: 500, world: false, points: false} : null;
}

/**
 * This week's change to the Ark Score, top level or inside `ark_week`:
 * `ark_points_week` (v3: the points locked in the last 7 days, never below 0)
 * when the server sends it, else v2's `ark_world_week_change` (which could be
 * negative). Null when the server sends neither.
 */
export function readArkWorldWeekChange(row: unknown): number | null {
    const fields = record(row);
    if (!fields) return null;
    const week = record(fields.ark_week);
    const points = integer(fields.ark_points_week) ?? integer(week?.ark_points_week);
    if (points !== null) return Math.max(points, 0);
    return integer(fields.ark_world_week_change) ?? integer(week?.ark_world_week_change);
}

/** `life`: `{money_bar, relationships, energy, reputation, experience}` (no total). Null when absent or empty. */
export function decodeArkLife(raw: unknown): ArkLife | null {
    const row = record(raw);
    if (!row) return null;
    const bar = (value: unknown) => {
        const parsed = integer(value);
        return parsed === null ? null : clamp(parsed, 0, 100);
    };
    const life: ArkLife = {
        moneyBar: bar(row.money_bar ?? record(row.money)?.bar),
        relationships: bar(row.relationships),
        energy: bar(row.energy),
        reputation: bar(row.reputation),
        experience: bar(row.experience)
    };
    return Object.values(life).some((value) => value !== null) ? life : null;
}

/** Where on its track an older score sits, for its bar (0–100); null for v3, which has no top and so no bar. */
export function arkScoreShare(score: Pick<ArkScoreRead, "value" | "outOf">): number | null {
    return score.outOf ? clamp((score.value / score.outOf) * 100, 0, 100) : null;
}

/** "+3", "−2" (a true minus), "0". */
export function arkSignedChange(delta: number): string {
    return delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0";
}

/**
 * The first-time explanation band's memory (per browser): dismissed once, never shown again.
 * v2: the v3 score (points from steps) is explained afresh, even to readers who dismissed v2's.
 */
export const ARK_SCORE_EXPLAINED_KEY = "animaldex:ark-score-explained:v3";

// MARK: - The step's line (captures + thrive)

/** The contract's states, and the earlier server's (`new` | `pair_complete` | `milestone`, until its migration) read as them. */
function offerState(value: unknown): ArkStepOfferState | null {
    if (value === "thrive" || value === "thrive_later") return value;
    if (value === "new") return "thrive_later";
    if (value === "pair_complete" || value === "milestone") return "thrive";
    return null;
}

/** The state for a living count: none aboard, `thrive_later`; one or two, `thrive`. */
export function arkStepOfferStateFor(livingBrought: number): ArkStepOfferState {
    return livingBrought <= 0 ? "thrive_later" : "thrive";
}

/**
 * The band one more worked step would leave a condition in, worked out from
 * the band alone (for a server that sends no `band_if_worked`): a step from
 * ordinary reaches good, and good may reach prime only from near the top, so
 * good stays good. The server's own answer always wins.
 */
function nextBand(band: ArkThrive): ArkThrive {
    return band === "ordinary" ? "good" : band;
}

/**
 * `voyage_step_offer_state_v1`'s answer. Null for null (no line: unknown,
 * excluded, under-13) or anything malformed.
 */
export function decodeArkStepOffer(raw: unknown): ArkStepOffer | null {
    const row = record(raw);
    const species = text(row?.species);
    if (!row || !species) return null;
    const livingBrought = clamp(integer(row.living_brought) ?? 0, 0, 2);
    const bandNow = arkThrive(row.band_now) ?? "ordinary";
    return {
        state: offerState(row.state) ?? arkStepOfferStateFor(livingBrought),
        species,
        livingBrought,
        bandNow,
        bandIfWorked: arkThrive(row.band_if_worked) ?? nextBand(bandNow)
    };
}

type SnapshotAnimal = {id: string; species_profile_id: string; model_slug: string; name: string; mine: boolean; arrived_at: string; origin?: "arrived" | "born"; source?: "capture" | "step" | null; thrive?: ArkThrive | null};

/** Whether a snapshot animal is this species (by canonical id, or by its model slug). */
export function arkAnimalIsSpecies(animal: Pick<SnapshotAnimal, "species_profile_id" | "model_slug">, species: {speciesProfileId: string | null; slug: string | null}): boolean {
    if (species.speciesProfileId && animal.species_profile_id.toLowerCase() === species.speciesProfileId.toLowerCase()) return true;
    return Boolean(species.slug && animal.model_slug === species.slug);
}

/**
 * The same answer from the public snapshot (`voyage_public_v2`, read with
 * the reader's session so their own come back `mine`), for a server without
 * `voyage_step_offer_state_v1`: the reader's own arrived animals of this
 * species, and the band they are in (the best of theirs; ordinary when the
 * snapshot carries none). Born young are their family line, never their pair.
 */
export function arkStepOfferFromSnapshot(
    animals: readonly SnapshotAnimal[],
    species: {speciesProfileId: string | null; slug: string | null; name: string | null}
): ArkStepOffer | null {
    const kind = animals.filter((animal) => !animal.id.startsWith("visitor:") && arkAnimalIsSpecies(animal, species));
    const name = text(species.name) ?? kind[0]?.name ?? null;
    if (!name) return null;
    const mine = kind.filter((animal) => animal.mine && animal.origin !== "born");
    const livingBrought = Math.min(2, mine.length);
    const bands = mine.map((animal) => arkThrive(animal.thrive) ?? "ordinary");
    const bandNow: ArkThrive = bands.includes("prime") ? "prime" : bands.includes("good") ? "good" : "ordinary";
    return {state: arkStepOfferStateFor(livingBrought), species: name, livingBrought, bandNow, bandIfWorked: nextBand(bandNow)};
}

export type ArkWorldWords = {
    offerThrive: string;
    offerPrime: string;
    offerStayPrime: string;
    offerLater: string;
    arrival: string;
    arrivalAn: string;
};

/** English takes "an" before a vowel sound; other languages translate both keys the same. */
export function arkTakesAn(name: string, locale: string): boolean {
    return locale.toLowerCase().startsWith("en") && /^[aeiou]/i.test(name.trim());
}

/**
 * The step card's line, by state and band: "If this works, your Komodo
 * Dragons will thrive"; "…will be in prime condition" when one more step
 * would get them there; "…will stay in prime condition" when they are; and,
 * with none aboard, "…will thrive once one is aboard". `plural` names two in
 * English ("Komodo Dragons"); other languages say the name as it is (A17).
 */
export function arkStepOfferLine(offer: Pick<ArkStepOffer, "state" | "species" | "livingBrought" | "bandNow" | "bandIfWorked">, words: ArkWorldWords, locale: string, plural: (name: string) => string = (name) => name): string {
    const name = offer.livingBrought >= 2 && locale.toLowerCase().startsWith("en") ? plural(offer.species) : offer.species;
    const template = offer.state === "thrive_later"
        ? words.offerLater
        : offer.bandNow === "prime"
            ? words.offerStayPrime
            : offer.bandIfWorked === "prime"
                ? words.offerPrime
                : words.offerThrive;
    return template.split("{species}").join(name);
}

/** The thread's line when a step brought the animal aboard (before captures did): "A Red Fox came aboard the Ark". */
export function arkArrivalLine(species: string, words: Pick<ArkWorldWords, "arrival" | "arrivalAn">, locale: string): string {
    return (arkTakesAn(species, locale) ? words.arrivalAn : words.arrival).split("{species}").join(species);
}

// MARK: - The arrival (Part 2)

/**
 * A reply that finished a step that worked: its step (`stepDone.id`, when the
 * server sent it) is what makes the reader's animals of that kind thrive
 * (`voyage_step_result_v1`), and, before captures did, what brought one aboard.
 */
export type ArkWorkedFinisher = {id: string; createdAt: string; stepId?: string | null; /** The step's own words (`stepDone.step`): the founders' story moment prefills with it (D6), never with the problem. */ stepText?: string | null};

type FinisherMessage = {
    id: string;
    role: string;
    createdAt: string;
    status?: string;
    companionEvent?: {stepDone?: {outcome?: string; id?: string; step?: string} | undefined} | undefined;
};

const STEP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function arkWorkedFinishers(messages: readonly FinisherMessage[]): ArkWorkedFinisher[] {
    return messages
        .filter((message) => message.role === "assistant"
            && (!message.status || message.status === "complete")
            && message.companionEvent?.stepDone?.outcome === "worked")
        .map((message) => {
            const stepId = message.companionEvent?.stepDone?.id ?? null;
            const stepText = message.companionEvent?.stepDone?.step?.replace(/\s+/g, " ").trim() || null;
            return {id: message.id, createdAt: message.createdAt, stepId: stepId && STEP_ID.test(stepId) ? stepId.toLowerCase() : null, stepText};
        });
}

/** How far an arrival may sit from the reply that finished its step: it arrives at the step's `done_at`, applied by the minute's outbox run. */
const ARRIVAL_BEFORE_MS = 3 * 60_000;
const ARRIVAL_AFTER_MS = 10 * 60_000;

/**
 * Which of the reader's animals of this species each worked step brought:
 * the one that arrived nearest the reply that finished it (the server sets
 * `arrived_at` to the step's `done_at`), each animal at most once. A step
 * with none (not yet applied, or eaten since) is left out.
 */
export function arkMatchArrivals<T extends SnapshotAnimal>(
    finishers: readonly ArkWorkedFinisher[],
    animals: readonly T[],
    species: {speciesProfileId: string | null; slug: string | null}
): Map<string, T> {
    const candidates = animals.filter((animal) => animal.mine
        && animal.origin !== "born"
        // A capture's animal is never a step's (captures + thrive): only a step's, or one from a server that doesn't say.
        && animal.source !== "capture"
        && !animal.id.startsWith("visitor:")
        && arkAnimalIsSpecies(animal, species)
        && !Number.isNaN(Date.parse(animal.arrived_at)));
    const pairs: Array<{finisher: string; animal: T; gap: number}> = [];
    for (const finisher of finishers) {
        const at = Date.parse(finisher.createdAt);
        if (Number.isNaN(at)) continue;
        for (const animal of candidates) {
            const arrived = Date.parse(animal.arrived_at);
            if (arrived < at - ARRIVAL_BEFORE_MS || arrived > at + ARRIVAL_AFTER_MS) continue;
            pairs.push({finisher: finisher.id, animal, gap: Math.abs(arrived - at)});
        }
    }
    pairs.sort((a, b) => a.gap - b.gap);
    const matched = new Map<string, T>();
    const used = new Set<string>();
    for (const pair of pairs) {
        if (matched.has(pair.finisher) || used.has(pair.animal.id)) continue;
        matched.set(pair.finisher, pair.animal);
        used.add(pair.animal.id);
    }
    return matched;
}

/** When the chat reads the Ark again after a step worked: the outbox applies arrivals once a minute. */
export const ARK_ARRIVAL_POLL_MS = [5_000, 15_000, 30_000, 50_000, 75_000, 105_000, 140_000] as const;

// MARK: - Missions (contract A.4: they unlock on collection points)

type MissionRow = {
    is_locked?: unknown;
    unlocked_at?: unknown;
    unlock_collection_points?: unknown;
    unlock_score_min?: unknown;
    requires_trade_unlocked?: unknown;
};

/** The collection points a mission opens at, when the server says (`unlock_collection_points`). */
export function missionUnlockCollectionPoints(row: MissionRow): number | null {
    const points = integer(row.unlock_collection_points);
    return points !== null && points > 0 ? points : null;
}

/**
 * Whether a mission is locked. The server's word first (a mission it opened
 * stays open); then collection points (verified Overall) against
 * `unlock_collection_points`. An older server, without that column, has
 * `unlock_score_min` on the Life Sim Ark scale: compared with the old Ark
 * Score when it is known, otherwise it stays locked until the server opens it.
 */
export function missionIsLocked(row: MissionRow, reader: {collectionPoints: number; tradeUnlocked: boolean; legacyArkScore: number | null}): boolean {
    if (typeof row.is_locked === "boolean") return row.is_locked;
    if (row.unlocked_at) return false;
    if (row.requires_trade_unlocked === true && !reader.tradeUnlocked) return true;
    const points = missionUnlockCollectionPoints(row);
    if (points !== null) return reader.collectionPoints < points;
    if (row.unlock_collection_points !== undefined) return false;
    const legacyMin = integer(row.unlock_score_min) ?? 0;
    if (legacyMin <= 0) return false;
    return reader.legacyArkScore === null ? true : reader.legacyArkScore < legacyMin;
}

// MARK: - /u/{handle}/ark (Part 3): one person's animals, as privacy allows

export type ArkPersonSpecies = {
    speciesProfileId: string;
    name: string;
    slug: string;
    count: number;
    /** The first of theirs to come aboard. */
    since: string | null;
};

export type ArkPersonView =
    /** Their own page, or someone who chose to show their name: their animals, by species. */
    | {kind: "listed"; self: boolean; named: boolean; label: string | null; animals: number; species: ArkPersonSpecies[]}
    /** Someone anonymous: nothing of theirs is told apart (the Ark shows a Voyager number, never a name). */
    | {kind: "anonymous"};

type PersonAnimal = SnapshotAnimal & {brought_by: {label: string; named: boolean}};

/**
 * What `/u/{handle}/ark` may show of one person (spec privacy: anonymous by
 * default, names only by opt-in). The snapshot is read as the visitor:
 * `mine` marks the visitor's own, and a bringer's label is their username
 * only when they chose to show it (and are an adult); otherwise "Voyager N",
 * which this page never ties to a profile. So: your own page lists yours,
 * with the label others see; someone else's lists theirs only when they are
 * named; anyone else is anonymous. Born young are counted with the bringer
 * the server names on them.
 *
 * Founders (founders contract): with names on, a named label is the
 * founder's display name, not their username; `founderHandle` (from the
 * founders beside the snapshot) ties an animal to its founder's @handle.
 */
export function arkPersonView(animals: readonly PersonAnimal[], person: {isSelf: boolean; username: string; founderHandle?: (animal: PersonAnimal) => string | null}): ArkPersonView {
    const handle = person.username.trim().toLowerCase();
    const theirs = person.isSelf
        ? animals.filter((animal) => animal.mine)
        : animals.filter((animal) => {
            const founder = person.founderHandle?.(animal)?.trim().toLowerCase() ?? null;
            if (founder) return founder === handle;
            return animal.brought_by.named && animal.brought_by.label.trim().toLowerCase() === handle;
        });
    if (!person.isSelf && theirs.length === 0) return {kind: "anonymous"};
    const bySpecies = new Map<string, ArkPersonSpecies>();
    for (const animal of theirs) {
        const key = animal.species_profile_id || animal.model_slug;
        const current = bySpecies.get(key);
        const since = current?.since && current.since <= animal.arrived_at ? current.since : animal.arrived_at || current?.since || null;
        bySpecies.set(key, {speciesProfileId: animal.species_profile_id, name: animal.name, slug: animal.model_slug, count: (current?.count ?? 0) + 1, since});
    }
    const species = Array.from(bySpecies.values()).sort((a, b) => b.count - a.count || (a.since ?? "").localeCompare(b.since ?? "") || a.name.localeCompare(b.name));
    const label = theirs[0]?.brought_by.label ?? null;
    return {kind: "listed", self: person.isSelf, named: theirs.some((animal) => animal.brought_by.named), label, animals: theirs.length, species};
}
