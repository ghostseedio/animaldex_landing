/**
 * A recorded event, replayed at its own time (V2; AnimalDex docs/ark/audits/ecosystem-audit-2026-11-18.md §2.4, §5
 * P0-7; decision 389). Pure: from the server's event log (`/api/ark/events`, the public read) and the Ark's read, the
 * plan of one event's replay: when it happened, everyone it names (with the server's own record of each, so whoever
 * is gone now can stand in: `cast.ts`), and what the scene's own live layers are fed to act it.
 *
 * THE RULES
 * - The record decides. Nothing here decides an outcome, picks a partner or moves a time: the event's row is the plan.
 * - No look-ahead (decision 389). Only an event the server has already released is replayed: it must be in the public
 *   log that was read (the drip releases a decided day in pieces; an unreleased piece is not in that read) and its
 *   time must not be after `now`. Everything else the plan reads is at or before the event's own time.
 * - No parallel acting. The plan feeds the layers the live world uses, with the keys the live log gives them
 *   (`live/controller.ts`): `addMatings`, `addBirths`, `addDeaths`, `setMeals`, `addEscapes`, and the scene's own
 *   replay (`play`) for a hatching. The same record, the same key, the same act for every viewer.
 *
 * The kinds: `mated`, `birth`, `death` (`death_old`, `starved`), `extinct` (`extinction`, with the death or meal that
 * caused it), `meal`, `escaped` are the server's (`voyage_events.kind`). `last_stand` and `released` are NOT written by
 * the server yet (the crisis layer and Release to the Wild, the audit's P0-4 and P1-8): their rows' shape here is
 * provisional and marked so (`provisional`), to be matched to the server's when it writes them.
 */

import type {ArkSnapshot, ArkAnimal} from "@/ark-scene/types";
import type {ArkCastRecord} from "@/ark-scene/replay/cast";
import {arkEventRows, decodeArkEvents, decodeArkMealEncounter, planArkReplay, type ArkAct, type ArkEvent, type ArkEventAnimal, type ArkMealEncounter} from "@/lib/ark-life";

export const ARK_REPLAY_KINDS = ["mated", "birth", "death", "extinct", "meal", "escaped", "last_stand", "released"] as const;
export type ArkReplayKind = (typeof ARK_REPLAY_KINDS)[number];

/** The server's kinds a replay can be made of, and the replay each is. */
const KIND_OF: Record<string, ArkReplayKind> = {mated: "mated", birth: "birth", death_old: "death", starved: "death", extinction: "extinct", meal: "meal", escaped: "escaped", last_stand: "last_stand", released: "released"};
/** Not written by the server yet: the rows are the harness's (and the shape provisional). */
const PROVISIONAL = new Set<ArkReplayKind>(["last_stand", "released"]);

export function isArkReplayKind(value: unknown): value is ArkReplayKind {
    return typeof value === "string" && (ARK_REPLAY_KINDS as readonly string[]).includes(value);
}

export type ArkReplayRole = "pair" | "parent" | "young" | "subject" | "last" | "predator" | "prey";

export type ArkReplayMember = {role: ArkReplayRole; record: ArkCastRecord; /** In the Ark's read now (else it stands in). */ aboard: boolean};

/** What the scene's live layers are fed (each its own input's shape, with the live log's keys). */
export type ArkReplayFeed = {
    matings?: Array<{key: string; a: string; b: string; t0: number}>;
    births?: Array<{key: string; parents: string[]; young: string[]; t0: number}>;
    deaths?: Array<{key: string; animal: ArkEventAnimal; t0: number}>;
    meals?: Array<Extract<ArkAct, {kind: "meal"}>>;
    escapes?: Array<{key: string; prey: string; predator: string; t0: number; encounter?: ArkMealEncounter}>;
    /** A hatching: the scene's own replay act (`play`), a clutch that hatches where the young stand. */
    play?: ArkAct[];
    /** A release: the animal comes ashore at its wild home with the entrance an arrival has; `from`: its record in the zoo it left. */
    release?: {id: string; from: ArkCastRecord | null};
};

export type ArkEventReplay = {
    eventId: string;
    kind: ArkReplayKind;
    /** The server's kind of the row (`death_old`, `extinction`…). */
    eventKind: string;
    /** The event's own time: ISO, and epoch seconds (a meal's or an escape's encounter step when the server gives it). */
    at: string;
    t0: number;
    arkDay: number | null;
    species: {id: string; name: string};
    /** Everyone the event names, the one the camera is about first. */
    cast: ArkReplayMember[];
    /** The last of its kind (the soft ring). */
    marks: string[];
    feed: ArkReplayFeed;
    /** A kind the server does not write yet (see the file's comment). */
    provisional: boolean;
    /** On an extinction: the row that ended the kind (a death's or a meal's event id). */
    causeEventId: string | null;
    /** What the plan could not find (a parent with no record in the log given): said in the recorder's log, never hidden. */
    notes: string[];
};

/** Why an event cannot be replayed: `code` for the caller, the message for a person. */
export class ArkReplayUnavailable extends Error {
    constructor(readonly code: "unknown_event" | "not_released" | "not_replayable" | "no_animals", message: string) {
        super(message);
        this.name = "ArkReplayUnavailable";
    }
}

type Row = Record<string, unknown>;
const rowOf = (value: unknown): Row | null => (value && typeof value === "object" && !Array.isArray(value) ? value as Row : null);
const idOf = (row: Row | null): string => (row && (typeof row.id === "number" || typeof row.id === "string") ? String(row.id) : "");
const timeOf = (row: Row | null): number => (row && typeof row.at === "string" ? Date.parse(row.at) : NaN);

/** The public read's `island` and `enclosure` of an event's animal: `ArkEventAnimal` does not carry them. */
function withPlace(record: ArkEventAnimal, raw: unknown): ArkCastRecord {
    const row = rowOf(raw);
    const island = row?.island === "town" || row?.island === "wild" ? row.island : null;
    const enclosure = typeof row?.enclosure === "string" && row.enclosure ? row.enclosure.slice(0, 80) : null;
    return {...record, island, enclosure};
}

/** An animal of the read as an event would name it (one a row does not describe: a living parent). */
export function recordOfAboard(animal: ArkAnimal): ArkCastRecord {
    return {
        id: animal.id,
        species_profile_id: animal.species_profile_id,
        name: animal.name,
        model_slug: animal.model_slug,
        zone: animal.zone,
        arrived_at: animal.arrived_at || null,
        origin: animal.origin ?? null,
        generation: animal.generation ?? null,
        slot: animal.slot ?? null,
        slot_rank: animal.slot_rank ?? null,
        activity: animal.activity ?? null,
        sociality: animal.sociality ?? null,
        status: "present",
        thrive: animal.thrive ?? null,
        area: animal.area ?? null,
        island: animal.island ?? null,
        enclosure: animal.enclosure ?? null
    };
}

/**
 * The plan of one event's replay. `raw`: the event log as the server answers it (`{events}` or the rows), which must
 * hold the event. `now` (ms): nothing after it is replayed. Throws `ArkReplayUnavailable` with the reason.
 */
export function planArkEventReplay(eventId: string | number, raw: unknown, snapshot: ArkSnapshot | null, options: {now: number}): ArkEventReplay {
    const wanted = String(eventId).trim();
    const rows = arkEventRows(raw).map(rowOf).filter((row): row is Row => Boolean(row));
    const row = rows.find((candidate) => idOf(candidate) === wanted) ?? null;
    if (!row || !wanted) throw new ArkReplayUnavailable("unknown_event", `Event ${wanted || "(none)"} is not in the event log that was read (the public log reaches 30 days back, released events only)`);
    const atMs = timeOf(row);
    const rowKind = typeof row.kind === "string" ? row.kind : "";
    const kind = KIND_OF[rowKind];
    if (!kind) throw new ArkReplayUnavailable("not_replayable", `Event ${wanted} is "${rowKind}": only ${Object.keys(KIND_OF).join(", ")} are replayed`);
    // No look-ahead: an event not yet released is never in the public read; one dated after now is refused all the same.
    if (!Number.isFinite(atMs) || atMs > options.now) throw new ArkReplayUnavailable("not_released", `Event ${wanted} is not released yet: nothing ahead of now is replayed`);

    const aboard = new Map((snapshot?.animals ?? []).map((animal) => [animal.id, animal]));
    // (Read as an arrival: the same decoder, `decodeArkEvents`, gives a row's two animals whatever its kind, the ones
    // `ARK_EVENT_KINDS` does not list too: `escaped`, and the provisional kinds.)
    const decodeAnimals = (source: Row): {animal: ArkCastRecord | null; other: ArkCastRecord | null; event: ArkEvent | null} => {
        const event = decodeArkEvents([{...source, kind: "arrival"}], snapshot)[0] ?? null;
        return {animal: event?.animal ? withPlace(event.animal, source.animal) : null, other: event?.other ? withPlace(event.other, source.other) : null, event};
    };
    const decodeOwn = (source: Row): ArkEvent | null => decodeArkEvents([source], snapshot)[0] ?? null;
    const earlier = rows.filter((candidate) => timeOf(candidate) <= atMs).sort((a, b) => timeOf(b) - timeOf(a) || Number(b.id) - Number(a.id));
    const notes: string[] = [];
    /** The newest record of an animal at or before the event (never after it), else as it is aboard now. */
    const recordOf = (id: string): ArkCastRecord | null => {
        for (const candidate of earlier) {
            const animal = rowOf(candidate.animal);
            const other = rowOf(candidate.other);
            if (animal?.id !== id && other?.id !== id) continue;
            const decoded = decodeAnimals(candidate);
            const found = decoded.animal?.id === id ? decoded.animal : decoded.other?.id === id ? decoded.other : null;
            if (found) return found;
        }
        const living = aboard.get(id);
        return living ? recordOfAboard(living) : null;
    };
    const member = (role: ArkReplayRole, record: ArkCastRecord): ArkReplayMember => ({role, record, aboard: aboard.has(record.id)});
    const own = decodeAnimals(row);
    const species = {id: typeof row.species_profile_id === "string" ? row.species_profile_id : own.animal?.species_profile_id ?? "", name: typeof row.species === "string" && row.species ? row.species : own.animal?.name ?? ""};
    const base = {eventId: wanted, kind, eventKind: rowKind, at: new Date(atMs).toISOString(), arkDay: typeof row.ark_day === "number" && Number.isFinite(row.ark_day) ? row.ark_day : null, species, provisional: PROVISIONAL.has(kind), causeEventId: null as string | null, notes};
    const t0 = atMs / 1000;
    const none = (what: string): never => {
        throw new ArkReplayUnavailable("no_animals", `Event ${wanted} (${rowKind}) ${what}`);
    };

    switch (kind) {
        case "mated": {
            const parents = own.event?.parents ?? [];
            const a = own.animal ?? (parents[0] ? recordOf(parents[0]) : null);
            const b = own.other ?? (parents[1] ? recordOf(parents[1]) : null);
            if (!a || !b || a.id === b.id) return none("does not name its two animals");
            return {...base, t0, cast: [member("pair", a), member("pair", b)], marks: [], feed: {matings: [{key: `mated:${wanted}`, a: a.id, b: b.id, t0}]}};
        }
        case "birth": {
            // The litter: every birth row of the same moment and parents (one act, as the live log and the replay make it).
            const event = decodeOwn(row);
            if (!event?.animal) return none("does not name its young");
            const parentsKey = [...event.parents].sort().join(",");
            const litterRows = rows.filter((candidate) => candidate.kind === "birth" && candidate.at === row.at);
            const litter = litterRows.map((candidate) => ({candidate, event: decodeOwn(candidate)})).filter((item) => item.event?.animal && [...item.event.parents].sort().join(",") === parentsKey && item.event.from_egg === event.from_egg);
            const young = litter.map((item) => withPlace(item.event!.animal!, item.candidate.animal));
            const parents: ArkCastRecord[] = [];
            for (const id of event.parents) {
                const record = recordOf(id);
                if (record) parents.push(record);
                else notes.push(`Parent ${id} has no record in the log given and is not aboard: it is not in the cast`);
            }
            const cast = [...parents.map((record) => member("parent", record)), ...young.map((record) => member("young", record))];
            if (event.from_egg) {
                const acts = planArkReplay(litter.map((item) => item.event!), Number.MAX_SAFE_INTEGER).acts.filter((act) => act.kind === "birth");
                return {...base, t0, cast, marks: [], feed: {play: acts}};
            }
            if (!parents.length) return none("names no parent the log given has a record of: a live birth is acted by its mother");
            return {...base, t0, cast, marks: [], feed: {births: [{key: `birth:${event.at}:${parentsKey}`, parents: [...event.parents], young: young.map((record) => record.id), t0}]}};
        }
        case "death": {
            if (!own.animal) return none("does not name its animal");
            return {...base, t0, cast: [member("subject", own.animal)], marks: [], feed: {deaths: [{key: `death:${wanted}`, animal: own.animal, t0}]}};
        }
        case "extinct": {
            // The row that ended the kind: its last death or the meal its last one was eaten in, at or just before the extinction.
            const speciesId = species.id;
            const cause = earlier.find((candidate) => {
                if (candidate === row || atMs - timeOf(candidate) > 3_600_000) return false;
                const animal = rowOf(candidate.animal);
                const other = rowOf(candidate.other);
                if (candidate.kind === "death_old" || candidate.kind === "starved") return Boolean(speciesId) && animal?.species_profile_id === speciesId;
                return candidate.kind === "meal" && Boolean(speciesId) && other?.species_profile_id === speciesId;
            }) ?? null;
            if (!cause) return none(`is the extinction of ${species.name || "a kind"}, and the log given does not hold the death or meal that ended it`);
            const ended = decodeAnimals(cause);
            const causeT = timeOf(cause) / 1000;
            if (cause.kind === "meal") {
                const meal = planArkReplay([decodeOwn(cause)].filter((event): event is ArkEvent => Boolean(event)), 1).acts.find((act): act is Extract<ArkAct, {kind: "meal"}> => act.kind === "meal");
                if (!meal || !ended.animal || !ended.other) return none("ended in a meal that does not name its two animals");
                return {...base, t0: meal.encounter?.t ?? causeT, causeEventId: idOf(cause), cast: [member("last", ended.other), member("predator", ended.animal)], marks: [ended.other.id], feed: {meals: [{...meal, extinct: true}]}};
            }
            if (!ended.animal) return none("ended in a death that does not name its animal");
            return {...base, t0: causeT, causeEventId: idOf(cause), cast: [member("last", ended.animal)], marks: [ended.animal.id], feed: {deaths: [{key: `death:${idOf(cause)}`, animal: ended.animal, t0: causeT}]}};
        }
        case "meal": {
            const event = decodeOwn(row);
            const meal = event ? planArkReplay([event], 1).acts.find((act): act is Extract<ArkAct, {kind: "meal"}> => act.kind === "meal") : undefined;
            if (!meal || !own.animal || !own.other) return none("does not name the hunter and its prey");
            return {...base, t0: meal.encounter?.t ?? t0, cast: [member("predator", own.animal), member("prey", own.other)], marks: [], feed: {meals: [meal]}};
        }
        case "escaped": {
            // The prey is the row's animal, the hunter its other (`ark-ecology/encounter.ts`).
            if (!own.animal || !own.other) return none("does not name the prey and the hunter");
            const encounter = decodeArkMealEncounter(row.encounter ?? rowOf(row.payload)?.encounter);
            const step = encounter?.t ?? t0;
            return {...base, t0: step, cast: [member("prey", own.animal), member("predator", own.other)], marks: [], feed: {escapes: [{key: `escaped:${wanted}`, prey: own.animal.id, predator: own.other.id, t0: step, ...(encounter ? {encounter} : {})}]}};
        }
        case "last_stand": {
            // Provisional: the last of its kind in the wild (the row's animal), and a predator of it in reach when the row names one.
            if (!own.animal) return none("does not name the last animal");
            return {...base, t0, cast: [member("last", own.animal), ...(own.other ? [member("predator", own.other)] : [])], marks: [own.animal.id], feed: {}};
        }
        case "released": {
            // Provisional: the row's animal as it is in the wild now; `payload.from`, its record in the zoo it left.
            if (!own.animal) return none("does not name the animal released");
            const fromRaw = rowOf(rowOf(row.payload)?.from) ?? rowOf(row.from);
            const from = fromRaw ? decodeAnimals({...row, animal: {...fromRaw, id: own.animal.id}, other: null}).animal : null;
            return {...base, t0, cast: [member("subject", own.animal)], marks: [], feed: {release: {id: own.animal.id, from}}};
        }
    }
}

/** Every model the replay's cast needs, each once (asked for before the first frame). */
export function arkReplayModels(replay: ArkEventReplay): string[] {
    return Array.from(new Set(replay.cast.map((member) => member.record.model_slug)));
}

/** The replayable events of a log, newest first: for the recorder's `--replay list` and the harness. Nothing after `now`. */
export function arkReplayableEvents(raw: unknown, now: number): Array<{id: string; kind: ArkReplayKind; eventKind: string; at: string; species: string}> {
    const out: Array<{id: string; kind: ArkReplayKind; eventKind: string; at: string; species: string}> = [];
    for (const item of arkEventRows(raw)) {
        const row = rowOf(item);
        const kind = row && typeof row.kind === "string" ? KIND_OF[row.kind] : undefined;
        const at = timeOf(row);
        if (!row || !kind || !Number.isFinite(at) || at > now || !idOf(row)) continue;
        out.push({id: idOf(row), kind, eventKind: String(row.kind), at: String(row.at), species: typeof row.species === "string" ? row.species : String(rowOf(row.animal)?.name ?? "")});
    }
    return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || Number(b.id) - Number(a.id));
}
