/**
 * Ark life v2 on the web: the server's event log and life stories, read and
 * turned into what /ark shows. THE RULE: the server decides everything and
 * writes the log; this only reads it. Nothing here decides an outcome.
 *
 * The shapes are the server's, exactly (life v2 contract, section 4.1):
 * - `decodeArkEvents`: `voyage_events_since_v1(p_since, p_limit)`'s
 *   `{events, next_since, more, as_of}` (or its `events` array).
 * - `planArkReplay`: "while you were away", the acts the scene plays (at
 *   most a handful, the rarest first) and the counts for the summary line.
 * - `decodeArkLife`: `voyage_animal_life_v1(p_animal_id)`, the tap card's
 *   life story (life audit section 3.3), its `story_public` only when the
 *   server's flag lets it through.
 */

import type {ArkArea, ArkArrivalSource, ArkSnapshot, ArkSociality, ArkThrive, ArkZone} from "@/ark-scene/types";
import {arkArea, arkArrivalSource} from "@/ark-scene/thrive";
import {decodeArkLineage, decodeArkThriveField, type ArkLineage} from "@/lib/ark-thrive";
import {ARK_ZONES} from "@/ark-scene/types";
import {arkActivity, type ArkActivity} from "@/lib/ark-daylight";
import {decodeArkStory, type ArkAnimalStory} from "@/lib/ark-story";
import {arkPlaceholderSlug} from "@/ark-scene/placeholder";
import {arkLabelHasFounderKey, arkLabelText, decodeArkFounder, decodeArkFounderStory, type ArkFounder, type ArkFounderStory} from "@/lib/ark-founders";

/**
 * The log's kinds. `starved`: a predator dead of long hunger (owner decision
 * 2026-11-10). `laid`: an egg-layer laid a clutch (A9); its young come later
 * as `birth` rows with `payload.from_egg`. Eggs are never food. `revised`
 * (A3): the step that brought an animal was revised after it arrived; the
 * animal stays. Counted in its life story, never acted out.
 */
export const ARK_EVENT_KINDS = ["arrival", "milestone", "meal", "birth", "laid", "death_old", "starved", "eaten", "extinction", "hungry", "fed", "revised"] as const;
export type ArkEventKind = typeof ARK_EVENT_KINDS[number];

export type ArkAnimalStatus = "present" | "eaten" | "died_old" | "starved";

/**
 * An animal an event names, as the server sends it (`voyage_event_animal`):
 * enough to act it out when it is no longer aboard, its place included.
 */
export type ArkEventAnimal = {
    id: string;
    species_profile_id: string;
    name: string;
    model_slug: string;
    zone: ArkZone;
    /** When it came aboard (or was born). */
    arrived_at: string | null;
    origin: "arrived" | "born" | null;
    generation: number | null;
    /** Where it stands (or stood): decided by the server when it came aboard. */
    slot: number | null;
    slot_rank: number | null;
    activity: ArkActivity | null;
    sociality: ArkSociality | null;
    /** As it is now (an eaten one is `eaten`). */
    status: ArkAnimalStatus | null;
    /** Captures + thrive: how well kept it is now, and its area (placement only); null from an older server (absent where it is made by hand). */
    thrive?: ArkThrive | null;
    area?: ArkArea | null;
};

export type ArkEvent = {
    id: string;
    kind: ArkEventKind;
    at: string;
    ark_day: number | null;
    /** The animal it is about (the eater, for a meal; the eaten, for its `eaten` row; the young, for a birth). */
    animal: ArkEventAnimal | null;
    /** The other one (the eaten, for a meal; the eater, for `eaten`). */
    other: ArkEventAnimal | null;
    /** The event's species (an extinction names only this). */
    species: {id: string; name: string} | null;
    /** The stored diet phrase a meal came from, verbatim. */
    phrase: string | null;
    /** A birth's parents (animal ids) and the young's born-to labels; empty otherwise. */
    parents: string[];
    bringers: string[];
    /** The named bringers behind `bringers` (null for a Voyager), for their @username links. */
    bringer_founders?: Array<ArkFounder | null>;
    /** A birth that hatched from an egg (`payload.from_egg`). */
    from_egg: boolean;
    /** A `laid` row's clutch: how many eggs (`payload.eggs`), when the server says. */
    eggs: number | null;
    /** On a `milestone` (a worked step): the band the step left the person's animals in; else null. */
    thrive: ArkThrive | null;
    /** On an `arrival`: how it came aboard (a capture, or before them a step); else null. */
    source: ArkArrivalSource | null;
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
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function whole(value: unknown): number | null {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/**
 * `[{label, named, founder?}]` → the labels as the reader reads them (never a user id: the server sends only
 * labels): a named bringer's @username (owner, 2026-11-11), else the label ("Voyager 5").
 */
function labels(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => arkLabelText(item)).filter((label): label is string => Boolean(label)).slice(0, 4);
}

function label(value: unknown): string | null {
    return arkLabelText(value);
}

/** The named bringers behind `labels` (null for a Voyager), in the same order, for links. */
function labelFounders(value: unknown): Array<ArkFounder | null> {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => Boolean(arkLabelText(item))).slice(0, 4).map((item) => decodeArkFounder(record(item)?.founder));
}

function status(value: unknown): ArkAnimalStatus | null {
    return value === "present" || value === "eaten" || value === "died_old" || value === "starved" ? value : null;
}

/** One animal of an event row (`animal` or `other`); a species with no model yet takes the snapshot's, else it is left out. */
function eventAnimal(value: unknown, aboard: Map<string, ArkSnapshot["animals"][number]>): ArkEventAnimal | null {
    const row = record(value);
    const id = text(row?.id, 80);
    if (!row || !id) return null;
    const known = aboard.get(id);
    // A species with no Ark model (A13): the placeholder's slug, as the snapshot decodes it.
    const slug = text(row.model_slug, 120) ?? known?.model_slug ?? (row.placeholder === true || "model_slug" in row ? arkPlaceholderSlug(text(row.species_profile_id, 80) ?? "", id) : null);
    const name = text(row.name, 120) ?? known?.name ?? null;
    if (!slug || !name) return null;
    const zone = text(row.zone, 40);
    const sociality = row.sociality;
    return {
        id,
        species_profile_id: text(row.species_profile_id, 80) ?? "",
        name,
        model_slug: slug,
        zone: zone && ZONES.has(zone) ? zone as ArkZone : "farm_garden",
        arrived_at: text(row.arrived_at, 40),
        origin: row.origin === "arrived" || row.origin === "born" ? row.origin : null,
        generation: whole(row.generation),
        slot: whole(row.slot),
        slot_rank: whole(row.slot_rank),
        activity: arkActivity(row.activity),
        sociality: sociality === "solitary" || sociality === "pair" || sociality === "group" ? sociality : null,
        status: status(row.status),
        thrive: decodeArkThriveField(row.thrive),
        area: arkArea(row.area)
    };
}

/** The events of a `voyage_events_since_v1` answer (or its `events` array). */
export function arkEventRows(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    const events = record(raw)?.events;
    return Array.isArray(events) ? events : [];
}

/** `voyage_events_since_v1`'s events, checked: a malformed row is dropped, never the whole list. Oldest first. */
export function decodeArkEvents(raw: unknown, snapshot: ArkSnapshot | null): ArkEvent[] {
    const aboard = new Map((snapshot?.animals ?? []).map((animal) => [animal.id, animal]));
    const events: Array<ArkEvent & {serial: number}> = [];
    arkEventRows(raw).forEach((item, index) => {
        const row = record(item);
        if (!row) return;
        const kind = text(row.kind, 20);
        const at = text(row.at, 40);
        if (!kind || !KINDS.has(kind) || !at || Number.isNaN(Date.parse(at))) return;
        const serial = whole(row.id);
        const speciesId = text(row.species_profile_id, 80);
        const speciesName = text(row.species, 120);
        const payload = record(row.payload) ?? {};
        const parents = (Array.isArray(row.parents) ? row.parents : Array.isArray(payload.parents) ? payload.parents : [])
            .map((id) => text(id, 80))
            .filter((id): id is string => Boolean(id));
        const eggs = whole(payload.eggs ?? payload.clutch ?? row.eggs);
        events.push({
            id: serial !== null ? String(serial) : `${at}-${index}`,
            serial: serial ?? Number.MAX_SAFE_INTEGER,
            kind: kind as ArkEventKind,
            at,
            ark_day: number(row.ark_day),
            animal: eventAnimal(row.animal, aboard),
            other: eventAnimal(row.other, aboard),
            species: speciesId || speciesName ? {id: speciesId ?? "", name: speciesName ?? ""} : null,
            phrase: text(row.phrase, 160),
            parents: Array.from(new Set(parents)).slice(0, 2),
            bringers: labels(row.bringers),
            bringer_founders: labelFounders(row.bringers),
            from_egg: payload.from_egg === true || row.from_egg === true,
            eggs: eggs !== null && eggs > 0 ? Math.min(eggs, 9999) : null,
            thrive: kind === "milestone" ? decodeArkThriveField(row.thrive ?? payload.band) : null,
            source: kind === "arrival" ? arkArrivalSource(row.source ?? payload.source) : null
        });
    });
    return events
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.serial - b.serial)
        .map(({serial: _serial, ...event}) => event);
}

// MARK: The replay

/** What the scene acts out for one or more events. */
export type ArkAct =
    | {kind: "arrival"; at: string; animal: ArkEventAnimal}
    /** `fromEgg`: the young hatch from a nest or clutch (A9), the one laid earlier in the replay when it is in it. */
    | {kind: "birth"; at: string; young: ArkEventAnimal[]; parents: string[]; bringers: string[]; /** The named ones behind `bringers`, for links. */ bringerFounders?: Array<ArkFounder | null>; fromEgg: boolean}
    /** An egg-layer laid a clutch (A9): a nest or clutch appears beside it. `eggs` when the server counts them. */
    | {kind: "laid"; at: string; animal: ArkEventAnimal; eggs: number | null; nest: string; parents: string[]}
    | {kind: "meal"; at: string; predator: ArkEventAnimal; prey: ArkEventAnimal; phrase: string | null; extinct: boolean}
    /** Old age, or (`starved`) long hunger: acted out quietly, it lies still and fades, never a chase. */
    | {kind: "death"; at: string; animal: ArkEventAnimal; cause: "old" | "starved"; extinct: boolean}
    | {kind: "extinction"; at: string; species: string};

export type ArkReplaySummary = {arrivals: number; births: number; meals: number; deaths: number; starved: number; extinctions: number; /** Clutches laid (A9). */ laid: number; /** Of the births, the young that hatched. */ hatched: number};

export type ArkReplayPlan = {acts: ArkAct[]; summary: ArkReplaySummary; total: number};

/** The replay stays short: at most this many acts; the summary counts everything. */
export const ARK_REPLAY_MAX_ACTS = 8;

const RARITY: Record<ArkAct["kind"], number> = {extinction: 0, meal: 1, death: 2, birth: 3, laid: 3, arrival: 4};

/**
 * The nest a clutch is laid in, and the young that hatch come from: one per
 * laying parent and day of the Ark, so a hatch finds the nest it was laid in.
 */
export function arkNestKey(parentIds: string[], at: string): string {
    return `${[...parentIds].sort().join(",")}@${at.slice(0, 10)}`;
}

/**
 * The acts for "while you were away", oldest first. A meal and the eaten
 * animal's own `eaten` row are one act, a litter is one act, an extinction
 * right after the meal or death that caused it rides on that act. When there
 * is more than fits, the rarest kinds stay (extinctions, meals, deaths,
 * births) and the newest arrivals; the summary still counts them all.
 */
export function planArkReplay(events: ArkEvent[], maxActs = ARK_REPLAY_MAX_ACTS): ArkReplayPlan {
    const summary: ArkReplaySummary = {arrivals: 0, births: 0, meals: 0, deaths: 0, starved: 0, extinctions: 0, laid: 0, hatched: 0};
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
                if (event.from_egg) summary.hatched++;
                if (!event.animal) break;
                const key = `${event.at}|${[...event.parents].sort().join(",")}|${event.from_egg ? "egg" : ""}`;
                const litter = births.get(key);
                if (litter) litter.young.push(event.animal);
                else {
                    const act = {kind: "birth" as const, at: event.at, young: [event.animal], parents: event.parents, bringers: event.bringers, bringerFounders: event.bringer_founders, fromEgg: event.from_egg};
                    births.set(key, act);
                    acts.push(act);
                }
                break;
            }
            case "laid": {
                summary.laid++;
                if (!event.animal) break;
                const parents = event.parents.length ? event.parents : [event.animal.id];
                const act = {kind: "laid" as const, at: event.at, animal: event.animal, eggs: event.eggs, nest: arkNestKey([event.animal.id], event.at), parents};
                acts.push(act);
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
            case "death_old":
            case "starved": {
                if (event.kind === "starved") summary.starved++;
                else summary.deaths++;
                if (!event.animal) break;
                const act = {kind: "death" as const, at: event.at, animal: event.animal, cause: event.kind === "starved" ? "starved" as const : "old" as const, extinct: false};
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
                // `eaten` is the meal's other half; milestones, revisions (A3), hunger and feeding are not acted out.
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
    return summary.arrivals + summary.births + summary.meals + summary.deaths + summary.starved + summary.extinctions + summary.laid === 0;
}

/** The clutch a hatch came from, when it was laid in the same replay (the same parent's latest before it). */
export function arkHatchNest(acts: ArkAct[], index: number): Extract<ArkAct, {kind: "laid"}> | null {
    const act = acts[index];
    if (!act || act.kind !== "birth" || !act.fromEgg) return null;
    for (let i = index - 1; i >= 0; i--) {
        const before = acts[i];
        if (before.kind === "laid" && (act.parents.includes(before.animal.id) || before.parents.some((id) => act.parents.includes(id)))) return before;
    }
    return null;
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

export type ArkBreedingSource = "stored" | "partial" | "estimate";

export type ArkLife = {
    id: string;
    species: string | null;
    model_slug: string | null;
    status: ArkAnimalStatus;
    origin:
        /** `source`: a capture brought it, or (before captures did) a step; null from an older server. */
        | {kind: "arrived"; at: string | null; brought_by: string | null; source: ArkArrivalSource | null}
        | {kind: "born"; at: string | null; parents: string[]; born_to: string[]; breeding_source: ArkBreedingSource | null; /** Hatched from an egg (A9). */ from_egg: boolean};
    generation: number;
    born_ark_day: number | null;
    ark_age_days: number | null;
    ark_age_years: number | null;
    /** Only while it lives. */
    condition: "well_fed" | "hungry" | "old" | null;
    meals: number;
    last_meal: {at: string | null; prey: string; phrase: string | null} | null;
    young_raised: number;
    milestones: {count: number; latest_at: string | null};
    /** The first arrival in its line: who brought its ancestors (a label, anonymous by default). */
    ancestor_brought_by: string | null;
    /** How it ended, when it has. */
    died: {at: string | null; kind: "eaten" | "died_old" | "starved"} | null;
    /** A3: the latest revision of the step that brought it (`worked`: it reads "worked" again). The animal stays. */
    revision: {at: string | null; worked: boolean} | null;
    /** The public debate it came from: only when the server's `public_story` flag is on. */
    story_public: ArkAnimalStory | null;
    /**
     * Founders (founders contract, section 2): the named founders behind the
     * labels above, each null for a Voyager. `names` when the server sent the
     * `founder` keys (its switch is on); all null and false before.
     */
    founders: {names: boolean; brought_by: ArkFounder | null; born_to: Array<ArkFounder | null>; ancestor: ArkFounder | null};
    /** The story its founder chose to share (what they did, the problem line), or null. */
    founder_story: ArkFounderStory | null;
    /** Captures + thrive: how well kept it is now (null once it has died, or from an older server). */
    thrive: ArkThrive | null;
    /** The house or the farm (placement only), or null: its zone. */
    area: ArkArea | null;
    /** Its descendants ever born, by generation, and how many live (null from an older server). */
    lineage: ArkLineage | null;
};

function count(value: unknown): number {
    return whole(value) ?? 0;
}

/** `voyage_animal_life_v1`'s answer, checked. Null when there is none (the function not applied yet, an unknown animal). */
export function decodeArkLife(raw: unknown): ArkLife | null {
    const row = record(raw);
    const id = text(row?.id, 80);
    if (!row || !id) return null;
    const origin = record(row.origin) ?? {};
    const meal = record(row.last_meal);
    const milestones = record(row.milestones);
    const died = record(row.died);
    const revision = record(row.revision);
    const condition = row.condition;
    const ageDays = number(row.ark_age_days);
    const ageYears = number(row.ark_age_years);
    const preyName = text(meal?.prey, 120);
    const breeding = origin.breeding_source;
    const bornTo = (Array.isArray(origin.born_to) ? origin.born_to : []).filter((item) => Boolean(text(record(item)?.label, 60))).slice(0, 4);
    const names = arkLabelHasFounderKey(origin.brought_by) || arkLabelHasFounderKey(row.ancestor_brought_by) || bornTo.some(arkLabelHasFounderKey);
    return {
        id,
        species: text(row.species, 120),
        model_slug: text(row.model_slug, 120),
        status: status(row.status) ?? "present",
        origin: origin.kind === "born"
            ? {
                kind: "born",
                at: text(origin.at, 40),
                parents: Array.from(new Set((Array.isArray(origin.parents) ? origin.parents : []).map((p) => text(p, 80)).filter((p): p is string => Boolean(p)))).slice(0, 2),
                born_to: labels(origin.born_to),
                breeding_source: breeding === "stored" || breeding === "partial" || breeding === "estimate" ? breeding : null,
                from_egg: origin.from_egg === true || record(origin.payload)?.from_egg === true
            }
            : {kind: "arrived", at: text(origin.at, 40), brought_by: label(origin.brought_by), source: arkArrivalSource(origin.source ?? row.source)},
        generation: count(row.generation),
        born_ark_day: number(row.born_ark_day),
        ark_age_days: ageDays !== null && ageDays >= 0 ? ageDays : null,
        ark_age_years: ageYears !== null && ageYears >= 0 ? ageYears : ageDays !== null && ageDays >= 0 ? ageDays / 365 : null,
        condition: condition === "well_fed" || condition === "hungry" || condition === "old" ? condition : null,
        meals: count(row.meals),
        last_meal: preyName ? {at: text(meal?.at, 40), prey: preyName, phrase: text(meal?.phrase, 160)} : null,
        young_raised: count(row.young_raised),
        milestones: {count: count(milestones?.count), latest_at: text(milestones?.latest_at, 40)},
        ancestor_brought_by: label(row.ancestor_brought_by),
        died: died && (died.kind === "eaten" || died.kind === "died_old" || died.kind === "starved") ? {at: text(died.at, 40), kind: died.kind} : null,
        revision: revision ? {at: text(revision.at, 40), worked: revision.worked === true} : null,
        story_public: decodeArkStory(row.story_public),
        founders: {
            names,
            brought_by: origin.kind === "born" ? null : decodeArkFounder(record(origin.brought_by)?.founder),
            born_to: origin.kind === "born" ? bornTo.map((item) => decodeArkFounder(record(item)?.founder)) : [],
            ancestor: decodeArkFounder(record(row.ancestor_brought_by)?.founder)
        },
        founder_story: origin.kind === "born" ? null : decodeArkFounderStory(row.founder_story),
        // Once it has died it has no condition (the contract's null); the read's band otherwise.
        thrive: died ? null : decodeArkThriveField(row.thrive),
        area: arkArea(row.area),
        lineage: decodeArkLineage(row.lineage)
    };
}

/** A deleted account's animals are "brought by" this label (A5): the server's words, said in the reader's language. */
export const ARK_FORMER_VOYAGER = "Former voyager";

/** A bringer's label as the reader reads it: "Former voyager" in their language (A5), a Voyager number as it is. */
export function arkBringerLabel(label: string, former?: string): string {
    return former && label.trim().toLowerCase() === ARK_FORMER_VOYAGER.toLowerCase() ? former : label;
}

/** "Born to the pair brought by Voyager 2 and Voyager 5": the labels joined in the reader's language. */
export function arkJoinLabels(labelsToJoin: string[], locale: string, former?: string): string {
    const unique = Array.from(new Set(labelsToJoin.filter(Boolean).map((label) => arkBringerLabel(label, former))));
    if (unique.length <= 1) return unique[0] ?? "";
    try {
        return new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(unique);
    } catch {
        return unique.join(" & ");
    }
}
