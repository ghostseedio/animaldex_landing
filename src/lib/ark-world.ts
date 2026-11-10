/**
 * The shared Ark in the chat and the new Ark Score (AnimalDex
 * docs/ark-next.md Parts 2 and 3; docs/ark-spec.md sections 2 and 7.6;
 * the Parts 2-3 contract, sections A and B).
 *
 * - The Ark Score is the world score: 0–100, `round(100·logistic(locked/10))`,
 *   50 with no contributions, computed by the server (`ark_world_score`) and
 *   moved only by your own arrivals. The old key (`ark_score`, the Life Sim
 *   bar sum, 0–500) is read only when the new one is missing: an older
 *   server, for one deploy cycle.
 * - Life is the five bars, with no total (`life`).
 * - Under a step card, one line says what the step means for the Ark
 *   (`voyage_step_offer_state_v1`); when a step that worked brings an animal
 *   aboard, one line in the thread says so.
 *
 * Pure: the routes, the chat, the profile and the tests read it. Every field
 * is read tolerantly; the server decides every number.
 */

export type ArkScoreRead = {
    value: number;
    /** 100 for the world score; 500 for the old Life Sim sum, read only from an older server. */
    outOf: 100 | 500;
    /** The world score (`ark_world_score`), not the old key. */
    world: boolean;
};

export type ArkLife = {
    /** Money's 0–100 bar (`money_bar`), not the balance. */
    moneyBar: number | null;
    relationships: number | null;
    energy: number | null;
    reputation: number | null;
    experience: number | null;
};

export type ArkStepOfferState = "new" | "pair_complete" | "milestone";

/** `voyage_step_offer_state_v1`: what a step that works means for the Ark, for this reader and this species. */
export type ArkStepOffer = {
    state: ArkStepOfferState;
    /** The species' display name, as the server sends it. */
    species: string;
    /** The reader's own living animals of this species aboard, capped at 2. */
    livingBrought: number;
    /** All of this species aboard, anyone's. */
    aboard: number;
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
 * A row's Ark Score: `ark_world_score` (0–100) when the server sends it,
 * else the old `ark_score` (0–500) from a server that has not switched yet.
 * Null when neither is there.
 */
export function readArkScore(row: unknown): ArkScoreRead | null {
    const fields = record(row);
    if (!fields) return null;
    const world = integer(fields.ark_world_score);
    if (world !== null) return {value: clamp(world, 0, 100), outOf: 100, world: true};
    const legacy = integer(fields.ark_score);
    return legacy !== null ? {value: clamp(legacy, 0, 500), outOf: 500, world: false} : null;
}

/**
 * This week's change to the world score (`ark_world_week_change`: the sum of
 * this week's locked contributions as the server works it out), top level or
 * inside `ark_week`. Null when the server does not send it.
 */
export function readArkWorldWeekChange(row: unknown): number | null {
    const fields = record(row);
    if (!fields) return null;
    return integer(fields.ark_world_week_change) ?? integer(record(fields.ark_week)?.ark_world_week_change);
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

/** Where on the 0–100 track a score sits, for its bar. */
export function arkScoreShare(score: Pick<ArkScoreRead, "value" | "outOf">): number {
    return clamp((score.value / score.outOf) * 100, 0, 100);
}

/** "+3", "−2" (a true minus), "0". */
export function arkSignedChange(delta: number): string {
    return delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0";
}

/** The first-time explanation band's memory (per browser): dismissed once, never shown again. */
export const ARK_SCORE_EXPLAINED_KEY = "animaldex:ark-world-score-explained:v1";

// MARK: - The step's line (Part 2)

function offerState(value: unknown): ArkStepOfferState | null {
    return value === "new" || value === "pair_complete" || value === "milestone" ? value : null;
}

/** The state for a living count: 0 a new arrival, 1 completes a pair, 2 or more a milestone. */
export function arkStepOfferStateFor(livingBrought: number): ArkStepOfferState {
    return livingBrought <= 0 ? "new" : livingBrought === 1 ? "pair_complete" : "milestone";
}

/** `voyage_step_offer_state_v1`'s answer. Null when it is not one (an older server, a malformed answer). */
export function decodeArkStepOffer(raw: unknown): ArkStepOffer | null {
    const row = record(raw);
    const species = text(row?.species);
    if (!row || !species) return null;
    const livingBrought = clamp(integer(row.living_brought) ?? 0, 0, 2);
    return {
        state: offerState(row.state) ?? arkStepOfferStateFor(livingBrought),
        species,
        livingBrought,
        aboard: Math.max(0, integer(row.aboard) ?? 0)
    };
}

type SnapshotAnimal = {id: string; species_profile_id: string; model_slug: string; name: string; mine: boolean; arrived_at: string; origin?: "arrived" | "born"};

/** Whether a snapshot animal is this species (by canonical id, or by its model slug). */
export function arkAnimalIsSpecies(animal: Pick<SnapshotAnimal, "species_profile_id" | "model_slug">, species: {speciesProfileId: string | null; slug: string | null}): boolean {
    if (species.speciesProfileId && animal.species_profile_id.toLowerCase() === species.speciesProfileId.toLowerCase()) return true;
    return Boolean(species.slug && animal.model_slug === species.slug);
}

/**
 * The same answer from the public snapshot (`voyage_public_v2`, read with
 * the reader's session so their own come back `mine`), for a server without
 * `voyage_step_offer_state_v1`. Born young count as the reader's only when
 * the server marks them `mine`, as the function would.
 */
export function arkStepOfferFromSnapshot(
    animals: readonly SnapshotAnimal[],
    species: {speciesProfileId: string | null; slug: string | null; name: string | null}
): ArkStepOffer | null {
    const kind = animals.filter((animal) => !animal.id.startsWith("visitor:") && arkAnimalIsSpecies(animal, species));
    const name = text(species.name) ?? kind[0]?.name ?? null;
    if (!name) return null;
    const livingBrought = Math.min(2, kind.filter((animal) => animal.mine).length);
    return {state: arkStepOfferStateFor(livingBrought), species: name, livingBrought, aboard: kind.length};
}

export type ArkWorldWords = {
    offerNew: string;
    offerNewAn: string;
    offerPair: string;
    offerMilestone: string;
    arrival: string;
    arrivalAn: string;
};

/** English takes "an" before a vowel sound; other languages translate both keys the same. */
export function arkTakesAn(name: string, locale: string): boolean {
    return locale.toLowerCase().startsWith("en") && /^[aeiou]/i.test(name.trim());
}

/** The step card's line: "If this works, a Red Fox comes aboard the Ark", and so on by state. */
export function arkStepOfferLine(offer: Pick<ArkStepOffer, "state" | "species">, words: ArkWorldWords, locale: string): string {
    const template = offer.state === "milestone"
        ? words.offerMilestone
        : offer.state === "pair_complete"
            ? words.offerPair
            : arkTakesAn(offer.species, locale) ? words.offerNewAn : words.offerNew;
    return template.split("{species}").join(offer.species);
}

/** The thread's line when the animal came aboard: "A Red Fox came aboard the Ark". */
export function arkArrivalLine(species: string, words: ArkWorldWords, locale: string): string {
    return (arkTakesAn(species, locale) ? words.arrivalAn : words.arrival).split("{species}").join(species);
}

// MARK: - The arrival (Part 2)

/** A reply that finished a step that worked: the only kind that brings an animal aboard. */
export type ArkWorkedFinisher = {id: string; createdAt: string};

type FinisherMessage = {
    id: string;
    role: string;
    createdAt: string;
    status?: string;
    companionEvent?: {stepDone?: {outcome?: string} | undefined} | undefined;
};

export function arkWorkedFinishers(messages: readonly FinisherMessage[]): ArkWorkedFinisher[] {
    return messages
        .filter((message) => message.role === "assistant"
            && (!message.status || message.status === "complete")
            && message.companionEvent?.stepDone?.outcome === "worked")
        .map((message) => ({id: message.id, createdAt: message.createdAt}));
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
 */
export function arkPersonView(animals: readonly PersonAnimal[], person: {isSelf: boolean; username: string}): ArkPersonView {
    const handle = person.username.trim().toLowerCase();
    const theirs = person.isSelf
        ? animals.filter((animal) => animal.mine)
        : animals.filter((animal) => animal.brought_by.named && animal.brought_by.label.trim().toLowerCase() === handle);
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
