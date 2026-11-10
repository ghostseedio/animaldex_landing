/**
 * `voyage_public_v1`'s (or v2's) answer, checked: anything malformed is dropped (an
 * animal with an unknown zone stands in the Home region, as the server
 * places a species it has no zone for), never the whole Ark.
 */

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

function zone(value: unknown): ArkZone {
    return typeof value === "string" && ZONES.has(value) ? value as ArkZone : "farm_garden";
}

function animal(raw: unknown): ArkAnimal | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const id = text(row.id);
    const slug = text(row.model_slug);
    const name = text(row.name);
    // A young one born aboard: its birth stands for its arrival.
    const arrived = text(row.arrived_at) ?? text(row.born_at);
    if (!id || !slug || !name || !arrived) return null;
    const by = row.brought_by && typeof row.brought_by === "object" ? row.brought_by as Record<string, unknown> : {};
    const bringers = (Array.isArray(row.bringers) ? row.bringers : [])
        .map((b) => (b && typeof b === "object" ? b as Record<string, unknown> : null))
        .filter((b): b is Record<string, unknown> => b !== null && Boolean(text(b.label)))
        .slice(0, 4)
        .map((b) => ({label: text(b.label) as string, named: b.named === true}));
    const parents = Array.isArray(row.parents) ? row.parents.map(text).filter((p): p is string => Boolean(p)) : [];
    const generation = Number(row.generation);
    const bornDay = Number(row.born_ark_day);
    // v2's fields, each only when the server sent it.
    const life: Partial<ArkAnimal> = {};
    if (row.origin === "arrived" || row.origin === "born") life.origin = row.origin;
    if (Number.isFinite(generation) && generation >= 0) life.generation = Math.floor(generation);
    if (row.condition === "well_fed" || row.condition === "hungry" || row.condition === "old") life.condition = row.condition;
    if (row.born_ark_day !== null && row.born_ark_day !== undefined && Number.isFinite(bornDay)) life.born_ark_day = bornDay;
    if ("activity" in row) life.activity = arkActivity(row.activity);
    if (row.sociality === "solitary" || row.sociality === "pair" || row.sociality === "group") life.sociality = row.sociality;
    if (bringers.length) life.bringers = bringers;
    if (parents.length === 2) life.parents = [parents[0], parents[1]];
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
        ...(Number.isFinite(Number(row.ark_day)) && row.ark_day !== null && row.ark_day !== undefined ? {ark_day: Number(row.ark_day)} : {})
    };
}
