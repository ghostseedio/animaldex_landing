/**
 * `voyage_public_v1`'s answer, checked: anything malformed is dropped (an
 * animal with an unknown zone stands in the Home region, as the server
 * places a species it has no zone for), never the whole Ark.
 */

import {ARK_ZONES, type ArkAnimal, type ArkSnapshot, type ArkZone} from "@/ark-scene/types";

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
    const arrived = text(row.arrived_at);
    if (!id || !slug || !name || !arrived) return null;
    const by = row.brought_by && typeof row.brought_by === "object" ? row.brought_by as Record<string, unknown> : {};
    return {
        id,
        species_profile_id: text(row.species_profile_id) ?? "",
        name,
        scientific_name: text(row.scientific_name),
        model_slug: slug,
        zone: zone(row.zone),
        arrived_at: arrived,
        brought_by: {label: text(by.label) ?? "", named: by.named === true},
        mine: row.mine === true
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
        as_of: text(row.as_of)
    };
}
