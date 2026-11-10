/**
 * `voyage_public_v2`'s answer (life v2 contract, section 4.1), or v1's (the
 * same without the life fields), checked: anything malformed is dropped (an
 * animal with an unknown zone stands in the Home region, as the server
 * places a species it has no zone for), never the whole Ark.
 */

import {ARK_STAT_KEYS, type ArkStats} from "@/ark-scene/stats";
import {ARK_ZONES, type ArkAnimal, type ArkSnapshot, type ArkZone} from "@/ark-scene/types";
import {arkActivity} from "@/lib/ark-daylight";

const ZONES = new Set<string>(ARK_ZONES);

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function count(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** A whole number >= 0, or null. */
function whole(value: unknown): number | null {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function zone(value: unknown): ArkZone {
    return typeof value === "string" && ZONES.has(value) ? value as ArkZone : "farm_garden";
}

function animal(raw: unknown): ArkAnimal | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const id = text(row.id);
    const slug = text(row.model_slug);
    const name = text(row.name);
    // A young one born aboard: arrived_at is its birth.
    const arrived = text(row.arrived_at);
    if (!id || !slug || !name || !arrived) return null;
    const by = row.brought_by && typeof row.brought_by === "object" ? row.brought_by as Record<string, unknown> : {};
    const bringers = (Array.isArray(row.bringers) ? row.bringers : [])
        .map((b) => (b && typeof b === "object" ? b as Record<string, unknown> : null))
        .filter((b): b is Record<string, unknown> => b !== null && Boolean(text(b.label)))
        .slice(0, 4)
        .map((b) => ({label: text(b.label) as string, named: b.named === true}));
    // v2's fields, each only when the server sent it.
    const life: Partial<ArkAnimal> = {};
    if (row.origin === "arrived" || row.origin === "born") life.origin = row.origin;
    const generation = whole(row.generation);
    if (generation !== null) life.generation = generation;
    if (row.condition === "well_fed" || row.condition === "hungry" || row.condition === "old") life.condition = row.condition;
    if (typeof row.born_ark_day === "number" && Number.isFinite(row.born_ark_day)) life.born_ark_day = row.born_ark_day;
    if ("activity" in row) life.activity = arkActivity(row.activity);
    if (row.sociality === "solitary" || row.sociality === "pair" || row.sociality === "group") life.sociality = row.sociality;
    if (bringers.length) life.bringers = bringers;
    // The species' stats and stored length, when the server sends them (else the scene reads the catalogue's).
    const statsRow = row.stats && typeof row.stats === "object" ? row.stats as Record<string, unknown> : {};
    const stats: Partial<ArkStats> = {};
    for (const key of ARK_STAT_KEYS) {
        const value = statsRow[key] ?? (key === "size" ? row.size : undefined);
        if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) stats[key] = value;
    }
    if (Object.keys(stats).length) life.stats = stats;
    if (typeof row.length_m === "number" && Number.isFinite(row.length_m) && row.length_m > 0) {
        life.length_m = row.length_m;
        const phrase = text(row.length_phrase);
        if (phrase) life.length_phrase = phrase;
    }
    const slot = whole(row.slot);
    const rank = whole(row.slot_rank);
    if (slot !== null && rank !== null) Object.assign(life, {slot, slot_rank: rank});
    return {
        id,
        species_profile_id: text(row.species_profile_id) ?? "",
        name,
        scientific_name: text(row.scientific_name),
        model_slug: slug,
        zone: zone(row.zone),
        arrived_at: arrived,
        brought_by: {label: text(by.label) ?? "", named: by.named === true},
        mine: row.mine === true,
        ...life
    };
}

export function decodeArkSnapshot(raw: unknown): ArkSnapshot | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const voyage = row.voyage && typeof row.voyage === "object" ? row.voyage as Record<string, unknown> : null;
    if (!voyage) return null;
    const animals = (Array.isArray(row.animals) ? row.animals : []).map(animal).filter((a): a is ArkAnimal => a !== null);
    const counts = row.counts && typeof row.counts === "object" ? row.counts as Record<string, unknown> : {};
    const zones = (Array.isArray(row.zones) ? row.zones : [])
        .map((z) => (z && typeof z === "object" ? z as Record<string, unknown> : null))
        .filter((z): z is Record<string, unknown> => z !== null && typeof z.key === "string" && ZONES.has(z.key))
        .map((z) => ({key: z.key as ArkZone, animals: count(z.animals)}));
    return {
        voyage: {slug: text(voyage.slug) ?? "first", name: text(voyage.name) ?? "", started_at: text(voyage.started_at)},
        counts: {
            animals: count(counts.animals ?? animals.length),
            species: count(counts.species ?? new Set(animals.map((a) => a.species_profile_id)).size),
            founders: count(counts.founders)
        },
        zones,
        animals: animals.sort((a, b) => a.arrived_at.localeCompare(b.arrived_at)),
        as_of: text(row.as_of),
        ...(typeof voyage.ark_day === "number" && Number.isFinite(voyage.ark_day) ? {ark_day: voyage.ark_day} : {})
    };
}
