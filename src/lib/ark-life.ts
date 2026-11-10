/**
 * Ark life v2 on the web: the server's event log and life stories, read and
 * turned into what /ark shows. THE RULE: the server decides everything and
 * writes the log; this only reads it. Nothing here decides an outcome.
 *
 * - `decodeArkEvents`: `voyage_events_since_v1(p_since, p_limit)`.
 * - `planArkReplay`: "while you were away", the acts the scene plays (at
 *   most a handful, the rarest first) and the counts for the summary line.
 * - `decodeArkLife`: `voyage_animal_life_v1(p_animal_id)`, the tap card's
 *   life story (life audit section 3.3), its `story_public` only when the
 *   server's flag lets it through.
 */

import type {ArkAnimal, ArkSnapshot, ArkZone} from "@/ark-scene/types";
import {ARK_ZONES} from "@/ark-scene/types";
import {decodeArkStory, type ArkAnimalStory} from "@/lib/ark-story";

export const ARK_EVENT_KINDS = ["arrival", "milestone", "meal", "birth", "death_old", "eaten", "extinction", "hungry", "fed"] as const;
export type ArkEventKind = typeof ARK_EVENT_KINDS[number];

/** An animal an event names: from the event itself, or from the snapshot when it is still aboard. */
export type ArkEventAnimal = {
    id: string;
    species_profile_id: string;
    name: string;
    model_slug: string;
    zone: ArkZone;
    /** When it came aboard (or was born): where it stood depends on it. */
    arrived_at: string | null;
};

export type ArkEvent = {
    id: string;
    kind: ArkEventKind;
    at: string;
    ark_day: number | null;
    /** The animal it is about (the eater, for a meal). */
    animal: ArkEventAnimal | null;
    /** The other one (the eaten, for a meal; a parent, for a birth). */
    other: ArkEventAnimal | null;
    /** The species, when no animal is named (an extinction). */
    species: {id: string; name: string} | null;
    /** The stored diet phrase a meal came from, verbatim. */
    phrase: string | null;
    /** A birth's parents (animal ids) and their bringers' labels. */
    parents: string[];
    bringers: string[];
};

const ZONES = new Set<string>(ARK_ZONES);
const KINDS = new Set<string>(ARK_EVENT_KINDS);

function text(value: unknown, max = 200): string | null {
    if (typeof value !== "string") return null;
    const clean = value.replace(/\s+/g, " ").trim();
    if (!clean) return null;
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function number(value: unknown): number | null {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) ? n : null;
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function labels(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => text(typeof item === "string" ? item : record(item)?.label, 60)).filter((label): label is string => Boolean(label)).slice(0, 4);
}

/**
 * One animal from an event row: a nested object (`animal`, `other`), or flat
 * fields with a prefix (`animal_id`, `model_slug`…; `other_animal_id`,
 * `other_model_slug`…), filled in from the snapshot when it is aboard.
 */
function eventAnimal(row: Record<string, unknown>, which: "animal" | "other", aboard: Map<string, ArkAnimal>): ArkEventAnimal | null {
    const nested = record(row[which]);
    const prefix = which === "animal" ? "" : "other_";
    const pick = (key: string) => (nested ? nested[key] ?? nested[key.replace(/^animal_/, "")] : row[`${prefix}${key}`]);
    const id = text(nested?.id ?? row[`${prefix}animal_id`], 80);
    if (!id) return null;
    const known = aboard.get(id);
    const slug = text(pick("model_slug"), 120) ?? known?.model_slug ?? null;
    const name = text(pick("name") ?? pick("species_name"), 120) ?? known?.name ?? null;
    if (!slug || !name) return null;
    const zone = text(pick("zone"), 40);
    return {
        id,
        species_profile_id: text(pick("species_profile_id"), 80) ?? known?.species_profile_id ?? "",
        name,
        model_slug: slug,
        zone: zone && ZONES.has(zone) ? zone as ArkZone : known?.zone ?? "farm_garden",
        arrived_at: text(pick("arrived_at"), 40) ?? known?.arrived_at ?? null
    };
}

/** `voyage_events_since_v1`'s rows, checked: a malformed row is dropped, never the whole list. Oldest first. */
export function decodeArkEvents(raw: unknown, snapshot: ArkSnapshot | null): ArkEvent[] {
    const rows = Array.isArray(raw) ? raw : Array.isArray(record(raw)?.events) ? record(raw)!.events as unknown[] : [];
    const aboard = new Map((snapshot?.animals ?? []).map((animal) => [animal.id, animal]));
    const events: ArkEvent[] = [];
    rows.forEach((item, index) => {
        const row = record(item);
        if (!row) return;
        const kind = text(row.kind, 20);
        const at = text(row.at, 40);
        if (!kind || !KINDS.has(kind) || !at || Number.isNaN(Date.parse(at))) return;
        const payload = record(row.payload) ?? {};
        const speciesId = text(row.species_profile_id ?? record(row.species)?.id, 80);
        const speciesName = text(row.species_name ?? record(row.species)?.name ?? payload.species_name, 120);
        const parents = (Array.isArray(row.parents) ? row.parents : Array.isArray(payload.parents) ? payload.parents : [])
            .map((id) => text(id, 80))
            .filter((id): id is string => Boolean(id))
            .slice(0, 2);
        events.push({
            id: text(row.id, 40) ?? `${at}-${index}`,
            kind: kind as ArkEventKind,
            at,
            ark_day: number(row.ark_day),
            animal: eventAnimal(row, "animal", aboard),
            other: eventAnimal(row, "other", aboard),
            species: speciesId || speciesName ? {id: speciesId ?? "", name: speciesName ?? ""} : null,
            phrase: text(row.phrase ?? payload.phrase, 160),
            parents,
            bringers: labels(row.bringers ?? payload.bringers)
        });
    });
    return events.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

// MARK: The replay

/** What the scene acts out for one or more events. */
export type ArkAct =
    | {kind: "arrival"; at: string; animal: ArkEventAnimal}
    | {kind: "birth"; at: string; young: ArkEventAnimal[]; parents: string[]; bringers: string[]}
    | {kind: "meal"; at: string; predator: ArkEventAnimal; prey: ArkEventAnimal; phrase: string | null; extinct: boolean}
    | {kind: "death"; at: string; animal: ArkEventAnimal; extinct: boolean}
    | {kind: "extinction"; at: string; species: string};

export type ArkReplaySummary = {arrivals: number; births: number; meals: number; deaths: number; extinctions: number};

export type ArkReplayPlan = {acts: ArkAct[]; summary: ArkReplaySummary; total: number};

/** The replay stays short: at most this many acts; the summary counts everything. */
export const ARK_REPLAY_MAX_ACTS = 8;

const RARITY: Record<ArkAct["kind"], number> = {extinction: 0, meal: 1, death: 2, birth: 3, arrival: 4};

/**
 * The acts for "while you were away", oldest first. A meal and the eaten
 * animal's own `eaten` row are one act, a litter is one act, an extinction
 * right after the meal or death that caused it rides on that act. When there
 * is more than fits, the rarest kinds stay (extinctions, meals, deaths,
 * births) and the newest arrivals; the summary still counts them all.
 */
export function planArkReplay(events: ArkEvent[], maxActs = ARK_REPLAY_MAX_ACTS): ArkReplayPlan {
    const summary: ArkReplaySummary = {arrivals: 0, births: 0, meals: 0, deaths: 0, extinctions: 0};
    const acts: ArkAct[] = [];
    const births = new Map<string, Extract<ArkAct, {kind: "birth"}>>();
    const endedBy = new Map<string, Extract<ArkAct, {kind: "meal"} | {kind: "death"}>>();
    for (const event of events) {
        switch (event.kind) {
            case "arrival":
                summary.arrivals++;
                if (event.animal) acts.push({kind: "arrival", at: event.at, animal: event.animal});
                break;
            case "birth": {
                summary.births++;
                if (!event.animal) break;
                const key = `${event.at}|${[...event.parents].sort().join(",")}`;
                const litter = births.get(key);
                if (litter) litter.young.push(event.animal);
                else {
                    const act = {kind: "birth" as const, at: event.at, young: [event.animal], parents: event.parents, bringers: event.bringers};
                    births.set(key, act);
                    acts.push(act);
                }
                break;
            }
            case "meal": {
                summary.meals++;
                if (!event.animal || !event.other) break;
                const act = {kind: "meal" as const, at: event.at, predator: event.animal, prey: event.other, phrase: event.phrase, extinct: false};
                endedBy.set(event.other.species_profile_id || event.other.model_slug, act);
                acts.push(act);
                break;
            }
            case "death_old": {
                summary.deaths++;
                if (!event.animal) break;
                const act = {kind: "death" as const, at: event.at, animal: event.animal, extinct: false};
                endedBy.set(event.animal.species_profile_id || event.animal.model_slug, act);
                acts.push(act);
                break;
            }
            case "extinction": {
                summary.extinctions++;
                const key = event.species?.id || event.animal?.species_profile_id || event.animal?.model_slug || "";
                const cause = key ? endedBy.get(key) : undefined;
                if (cause) cause.extinct = true;
                else acts.push({kind: "extinction", at: event.at, species: event.species?.name || event.animal?.name || ""});
                break;
            }
            default:
                // `eaten` is the meal's other half; milestones, hunger and feeding are not acted out.
                break;
        }
    }
    const total = acts.length;
    const indexed = acts.map((act, index) => ({act, index}));
    // Arrivals are what the Ark is made of: the newest always keeps a place.
    const newestArrival = [...indexed].reverse().find(({act}) => act.kind === "arrival");
    const rest = indexed.filter((item) => item !== newestArrival).sort((a, b) => RARITY[a.act.kind] - RARITY[b.act.kind] || b.index - a.index);
    const kept = (newestArrival && maxActs > 0 ? [newestArrival, ...rest] : rest)
        .slice(0, maxActs)
        .sort((a, b) => a.index - b.index)
        .map(({act}) => act);
    return {acts: kept, summary, total};
}

/** Nothing worth a replay or a summary. */
export function isQuietArkReplay(summary: ArkReplaySummary): boolean {
    return summary.arrivals + summary.births + summary.meals + summary.deaths + summary.extinctions === 0;
}

// MARK: The last visit

export const ARK_LAST_VISIT_KEY = "ark.lastVisit";

/** The last visit's time (ISO), or null on a first visit or with no storage. */
export function readArkLastVisit(storage: Pick<Storage, "getItem"> | null | undefined): string | null {
    try {
        const value = storage?.getItem(ARK_LAST_VISIT_KEY) ?? null;
        return value && !Number.isNaN(Date.parse(value)) ? value : null;
    } catch {
        return null;
    }
}

export function writeArkLastVisit(storage: Pick<Storage, "setItem"> | null | undefined, at: Date): void {
    try {
        storage?.setItem(ARK_LAST_VISIT_KEY, at.toISOString());
    } catch {
        // No storage (a private window): every visit is a first visit.
    }
}

/**
 * "since Tuesday", "since earlier today", "since 3 November": how the
 * summary names the last visit, in the reader's language and time zone.
 */
export function arkSinceWhen(since: Date, now: Date, locale: string, words: {today: string; yesterday: string; weekday: string; date: string}): string {
    const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const days = Math.round((day(now) - day(since)) / 86_400_000);
    if (days <= 0) return words.today;
    if (days === 1) return words.yesterday;
    if (days < 7) return words.weekday.replace("{day}", new Intl.DateTimeFormat(locale, {weekday: "long"}).format(since));
    return words.date.replace("{date}", new Intl.DateTimeFormat(locale, {day: "numeric", month: "long"}).format(since));
}

// MARK: Life stories

export type ArkLife = {
    id: string;
    status: "present" | "eaten" | "died_old" | "departed";
    origin: {kind: "arrived"; at: string | null; brought_by: string | null} | {kind: "born"; at: string | null; parents: string[]; parents_brought_by: string[]};
    generation: number;
    ark_age_days: number | null;
    ark_age_years: number | null;
    condition: "well_fed" | "hungry" | "old" | null;
    meals: number;
    last_meal: {at: string | null; prey: string; phrase: string | null} | null;
    young_raised: number;
    milestones: {count: number; latest: string | null};
    /** The first arrival in its line: who brought its ancestors (a label, anonymous by default). */
    ancestor_brought_by: string | null;
    /** The public debate it came from: only when the server's `public_story` flag is on. */
    story_public: ArkAnimalStory | null;
};

function count(value: unknown): number {
    const n = number(value);
    return n !== null && n >= 0 ? Math.floor(n) : 0;
}

/** `voyage_animal_life_v1`'s answer, checked. Null when there is none (the function not applied yet, an unknown animal). */
export function decodeArkLife(raw: unknown): ArkLife | null {
    const row = record(raw);
    if (!row) return null;
    const id = text(row.id, 80);
    if (!id) return null;
    const status = text(row.status, 20);
    const origin = record(row.origin) ?? {};
    const born = origin.kind === "born";
    const meal = record(row.last_meal);
    const milestones = record(row.milestones);
    const condition = text(row.condition, 20);
    const ageDays = number(row.ark_age_days);
    const ageYears = number(row.ark_age_years) ?? (ageDays !== null ? ageDays / 365 : null);
    const preyName = text(meal?.prey, 120);
    return {
        id,
        status: status === "eaten" || status === "died_old" || status === "departed" ? status : "present",
        origin: born
            ? {kind: "born", at: text(origin.at, 40), parents: (Array.isArray(origin.parents) ? origin.parents : []).map((p) => text(p, 80)).filter((p): p is string => Boolean(p)).slice(0, 2), parents_brought_by: labels(origin.parents_brought_by ?? origin.brought_by)}
            : {kind: "arrived", at: text(origin.at, 40), brought_by: text(typeof origin.brought_by === "string" ? origin.brought_by : record(origin.brought_by)?.label, 60)},
        generation: count(row.generation),
        ark_age_days: ageDays !== null && ageDays >= 0 ? ageDays : null,
        ark_age_years: ageYears !== null && ageYears >= 0 ? ageYears : null,
        condition: condition === "well_fed" || condition === "hungry" || condition === "old" ? condition : null,
        meals: count(row.meals),
        last_meal: preyName ? {at: text(meal?.at, 40), prey: preyName, phrase: text(meal?.phrase, 160)} : null,
        young_raised: count(row.young_raised),
        milestones: {count: count(milestones?.count ?? row.milestones_count), latest: text(milestones?.latest, 40)},
        ancestor_brought_by: text(typeof row.ancestor_brought_by === "string" ? row.ancestor_brought_by : record(row.ancestor_brought_by)?.label, 60),
        story_public: decodeArkStory(row.story_public)
    };
}

/** "Born to the pair brought by Voyager 2 and Voyager 5": the labels joined in the reader's language. */
export function arkJoinLabels(labelsToJoin: string[], locale: string): string {
    const unique = Array.from(new Set(labelsToJoin.filter(Boolean)));
    if (unique.length <= 1) return unique[0] ?? "";
    try {
        return new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(unique);
    } catch {
        return unique.join(" & ");
    }
}
