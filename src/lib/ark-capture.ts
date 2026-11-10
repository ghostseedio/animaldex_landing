/**
 * The server's three public Ark reads, captured together (`{snapshot,
 * events, lives}`), and the check that the web reads them whole.
 *
 * The canonical shapes (life v2 contract, section 4.1, on the server's
 * `ark-life` branch: docs/ark/LIFE-V2-CONTRACT.md) are the key sets below,
 * the same ones the server's read-only test (supabase/tests/voyage_life_read.sql)
 * holds the server to. A capture comes from the server's rolled-back
 * rehearsal (supabase/scripts/voyage-life-rehearsal: its final error carries
 * `CAPTURE_BEGIN{...}CAPTURE_END`) or from `scripts/generate-ark-life-fixtures.mts`;
 * `scripts/ark-life-fixtures-from-server.mts` checks one and writes it as
 * the fixtures.
 */

import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkSnapshot} from "@/ark-scene/types";
import {arkEventRows, decodeArkEvents, decodeArkLife, planArkReplay, type ArkEvent, type ArkLife, type ArkReplayPlan} from "@/lib/ark-life";

export type ArkCapture = {snapshot: unknown; events: unknown; lives: Record<string, unknown>};

/** Every key each read sends, at every level, sorted. Nothing else ever leaves the server. */
export const ARK_PUBLIC_SHAPES = {
    snapshot: ["animals", "as_of", "counts", "voyage", "zones"],
    voyage: ["ark_day", "name", "slug", "started_at"],
    counts: ["animals", "founders", "species"],
    zone: ["animals", "key"],
    animal: ["activity", "arrived_at", "born_ark_day", "bringers", "brought_by", "condition", "generation", "id", "mine", "model_slug", "name", "origin", "scientific_name", "slot", "slot_rank", "sociality", "species_profile_id", "zone"],
    label: ["label", "named"],
    events: ["as_of", "events", "more", "next_since"],
    event: ["animal", "ark_day", "at", "bringers", "id", "kind", "other", "parents", "phrase", "species", "species_profile_id"],
    eventAnimal: ["activity", "arrived_at", "generation", "id", "model_slug", "name", "origin", "slot", "slot_rank", "sociality", "species_profile_id", "status", "zone"],
    life: ["ancestor_brought_by", "ark_age_days", "ark_age_years", "born_ark_day", "condition", "died", "generation", "id", "last_meal", "meals", "milestones", "model_slug", "origin", "species", "species_profile_id", "status", "story_public", "young_raised"],
    originArrived: ["at", "brought_by", "kind"],
    originBorn: ["at", "born_to", "breeding_source", "kind", "parents"],
    milestones: ["count", "latest_at"],
    lastMeal: ["ark_day", "at", "phrase", "prey", "prey_species_profile_id"],
    died: ["at", "kind"]
} as const;

const MARK_BEGIN = "CAPTURE_BEGIN";
const MARK_END = "CAPTURE_END";

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function isCapture(value: unknown): value is ArkCapture {
    const row = record(value);
    return Boolean(row && "snapshot" in row && "events" in row && record(row.lives));
}

/**
 * A capture from a file's text: the capture's JSON itself, or the output of
 * `supabase db query` on the rehearsal (the capture is inside the error
 * message, JSON-escaped once per layer). Null when there is none.
 */
export function extractArkCapture(text: string, depth = 0): ArkCapture | null {
    if (depth > 6) return null;
    const whole = parse(text.trim());
    if (isCapture(whole)) return whole;
    const begin = text.indexOf(MARK_BEGIN);
    const end = text.indexOf(MARK_END, begin + 1);
    if (begin >= 0 && end > begin) {
        const inner = parse(text.slice(begin + MARK_BEGIN.length, end));
        if (isCapture(inner)) return inner;
    }
    // One layer of JSON around it (the CLI's answer, the API's message): look inside every string.
    const strings: string[] = [];
    const walk = (value: unknown) => {
        if (typeof value === "string") {
            if (value.includes(MARK_BEGIN)) strings.push(value);
        } else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(whole);
    for (let at = text.indexOf("{"); whole === undefined && at >= 0; at = text.indexOf("{", at + 1)) {
        const tail = parse(text.slice(at));
        if (tail !== undefined) {
            walk(tail);
            break;
        }
    }
    for (const value of strings) {
        const found = extractArkCapture(value, depth + 1);
        if (found) return found;
    }
    return null;
}

function keys(value: unknown): string {
    const row = record(value);
    return row ? Object.keys(row).sort().join(",") : String(value);
}

/** Every way the capture differs from the canonical shapes (none: it is the server's, exactly). */
export function arkCaptureProblems(capture: ArkCapture): string[] {
    const problems: string[] = [];
    const expect = (what: string, value: unknown, shape: readonly string[]) => {
        if (keys(value) !== shape.join(",")) problems.push(`${what}: keys ${keys(value)}`);
    };
    const labelsOk = (what: string, value: unknown) => {
        if (!Array.isArray(value)) return problems.push(`${what}: not a list`);
        value.forEach((item, i) => expect(`${what}[${i}]`, item, ARK_PUBLIC_SHAPES.label));
    };
    const snapshot = record(capture.snapshot);
    expect("snapshot", snapshot, ARK_PUBLIC_SHAPES.snapshot);
    expect("snapshot.voyage", snapshot?.voyage, ARK_PUBLIC_SHAPES.voyage);
    expect("snapshot.counts", snapshot?.counts, ARK_PUBLIC_SHAPES.counts);
    (Array.isArray(snapshot?.zones) ? snapshot!.zones as unknown[] : []).forEach((zone, i) => expect(`zones[${i}]`, zone, ARK_PUBLIC_SHAPES.zone));
    const places = new Set<string>();
    (Array.isArray(snapshot?.animals) ? snapshot!.animals as unknown[] : []).forEach((animal, i) => {
        const row = record(animal);
        expect(`animals[${i}]`, row, ARK_PUBLIC_SHAPES.animal);
        labelsOk(`animals[${i}].bringers`, row?.bringers);
        if (row?.brought_by !== null) expect(`animals[${i}].brought_by`, row?.brought_by, ARK_PUBLIC_SHAPES.label);
        const place = `${row?.zone}/${row?.slot}/${row?.slot_rank}`;
        if (places.has(place)) problems.push(`animals[${i}]: a second living animal at ${place}`);
        places.add(place);
    });
    const events = record(capture.events);
    expect("events", events, ARK_PUBLIC_SHAPES.events);
    arkEventRows(events).forEach((event, i) => {
        const row = record(event);
        expect(`events[${i}]`, row, ARK_PUBLIC_SHAPES.event);
        for (const which of ["animal", "other"] as const) {
            if (row?.[which] !== null) expect(`events[${i}].${which}`, row?.[which], ARK_PUBLIC_SHAPES.eventAnimal);
        }
        labelsOk(`events[${i}].bringers`, row?.bringers);
        if (!Array.isArray(row?.parents)) problems.push(`events[${i}].parents: not a list`);
    });
    for (const [id, life] of Object.entries(capture.lives)) {
        const row = record(life);
        expect(`lives.${id}`, row, ARK_PUBLIC_SHAPES.life);
        const origin = record(row?.origin);
        expect(`lives.${id}.origin`, origin, origin?.kind === "born" ? ARK_PUBLIC_SHAPES.originBorn : ARK_PUBLIC_SHAPES.originArrived);
        if (origin?.kind === "born") labelsOk(`lives.${id}.origin.born_to`, origin.born_to);
        else expect(`lives.${id}.origin.brought_by`, origin?.brought_by, ARK_PUBLIC_SHAPES.label);
        expect(`lives.${id}.milestones`, row?.milestones, ARK_PUBLIC_SHAPES.milestones);
        if (row?.last_meal !== null) expect(`lives.${id}.last_meal`, row?.last_meal, ARK_PUBLIC_SHAPES.lastMeal);
        if (row?.died !== null) expect(`lives.${id}.died`, row?.died, ARK_PUBLIC_SHAPES.died);
        if (row?.ancestor_brought_by !== null) expect(`lives.${id}.ancestor_brought_by`, row?.ancestor_brought_by, ARK_PUBLIC_SHAPES.label);
    }
    return problems;
}

export type ArkCaptureDecoded = {snapshot: ArkSnapshot | null; events: ArkEvent[]; lives: Map<string, ArkLife | null>; plan: ArkReplayPlan; lost: string[]};

/**
 * The capture through the web's own decoders, and whatever they lost: an
 * animal, an event, an event's animal, a place, a life or one of its facts
 * the server sent and the decoder dropped. `lost` empty: the web reads all of it.
 */
export function decodeArkCapture(capture: ArkCapture): ArkCaptureDecoded {
    const lost: string[] = [];
    const snapshot = decodeArkSnapshot(capture.snapshot);
    const rawAnimals = (record(capture.snapshot)?.animals as unknown[] | undefined) ?? [];
    if (!snapshot) lost.push("the snapshot");
    else {
        if (snapshot.animals.length !== rawAnimals.length) lost.push(`snapshot animals: ${snapshot.animals.length} of ${rawAnimals.length}`);
        if (snapshot.ark_day === undefined) lost.push("snapshot ark_day");
        for (const raw of rawAnimals) {
            const row = record(raw)!;
            const animal = snapshot.animals.find((a) => a.id === row.id);
            if (!animal) continue;
            if (animal.slot !== row.slot || animal.slot_rank !== row.slot_rank) lost.push(`animal ${row.id}: place`);
            if (animal.origin !== row.origin || animal.generation !== row.generation || (animal.condition ?? null) !== row.condition) lost.push(`animal ${row.id}: life fields`);
            if ((animal.bringers?.length ?? 0) !== (row.bringers as unknown[]).length) lost.push(`animal ${row.id}: bringers`);
        }
    }
    const rawEvents = arkEventRows(capture.events);
    const events = decodeArkEvents(capture.events, snapshot);
    if (events.length !== rawEvents.length) lost.push(`events: ${events.length} of ${rawEvents.length}`);
    for (const raw of rawEvents) {
        const row = record(raw)!;
        const event = events.find((e) => e.id === String(row.id));
        if (!event) continue;
        for (const which of ["animal", "other"] as const) {
            const sent = record(row[which]);
            const got = event[which];
            if (sent && !got) lost.push(`event ${row.id}: ${which}`);
            if (sent && got && (got.slot !== sent.slot || got.slot_rank !== sent.slot_rank || got.zone !== sent.zone || got.status !== sent.status)) lost.push(`event ${row.id}: ${which}'s place or status`);
        }
        if ((row.phrase ?? null) !== event.phrase) lost.push(`event ${row.id}: phrase`);
        if (new Set(row.parents as unknown[]).size !== event.parents.length) lost.push(`event ${row.id}: parents`);
        if ((row.bringers as unknown[]).length !== event.bringers.length) lost.push(`event ${row.id}: bringers`);
        if ((row.species ?? "") !== (event.species?.name ?? "")) lost.push(`event ${row.id}: species`);
    }
    const lives = new Map<string, ArkLife | null>();
    for (const [id, raw] of Object.entries(capture.lives)) {
        const life = decodeArkLife(raw);
        lives.set(id, life);
        const row = record(raw)!;
        if (!life) {
            lost.push(`life ${id}`);
            continue;
        }
        const origin = record(row.origin)!;
        const milestones = record(row.milestones)!;
        if (life.status !== row.status) lost.push(`life ${id}: status`);
        if (life.origin.kind !== origin.kind) lost.push(`life ${id}: origin`);
        if (life.origin.kind === "born" && (life.origin.born_to.length !== (origin.born_to as unknown[]).length || life.origin.breeding_source !== origin.breeding_source)) lost.push(`life ${id}: born_to or breeding_source`);
        if (life.origin.kind === "arrived" && life.origin.brought_by !== record(origin.brought_by)?.label) lost.push(`life ${id}: brought_by`);
        if (life.meals !== row.meals || life.young_raised !== row.young_raised || life.generation !== row.generation) lost.push(`life ${id}: counts`);
        if (life.condition !== row.condition) lost.push(`life ${id}: condition`);
        if (Boolean(life.last_meal) !== Boolean(row.last_meal) || (life.last_meal && life.last_meal.phrase !== record(row.last_meal)?.phrase)) lost.push(`life ${id}: last meal`);
        if (life.milestones.count !== milestones.count || life.milestones.latest_at !== milestones.latest_at) lost.push(`life ${id}: milestones`);
        if (Boolean(life.died) !== Boolean(row.died) || (life.died && life.died.kind !== record(row.died)?.kind)) lost.push(`life ${id}: died`);
        if (life.ancestor_brought_by !== (record(row.ancestor_brought_by)?.label ?? null)) lost.push(`life ${id}: ancestor`);
        if ((life.story_public === null) !== (row.story_public === null)) lost.push(`life ${id}: story_public`);
    }
    return {snapshot, events, lives, plan: planArkReplay(events, 1000), lost};
}
