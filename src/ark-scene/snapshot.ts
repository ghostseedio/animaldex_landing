/**
 * `voyage_public_v2`'s answer (life v2 contract, section 4.1), or v1's (the
 * same without the life fields), checked: anything malformed is dropped (an
 * animal with an unknown zone stands in the Home region, as the server
 * places a species it has no zone for), never the whole Ark.
 */

import {ARK_STAT_KEYS, type ArkStats} from "@/ark-scene/stat-keys";
import {ARK_ZONES, type ArkAnimal, type ArkNestRow, type ArkSnapshot, type ArkZone} from "@/ark-scene/types";
import {arkActivity} from "@/lib/ark-daylight";
import {arkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import {arkArea, arkArrivalSource, arkThrive} from "@/ark-scene/thrive";

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
    const name = text(row.name);
    // A young one born aboard: arrived_at is its birth.
    const arrived = text(row.arrived_at);
    if (!id || !name || !arrived) return null;
    // A species with no Ark model (A13): `placeholder: true`, `model_slug: null`. Drawn as the neutral figure.
    const placeholder = row.placeholder === true || !text(row.model_slug);
    const slug = text(row.model_slug) ?? arkPlaceholderSlug(text(row.species_profile_id) ?? "", id);
    const by = row.brought_by && typeof row.brought_by === "object" ? row.brought_by as Record<string, unknown> : {};
    const bringers = (Array.isArray(row.bringers) ? row.bringers : [])
        .map((b) => (b && typeof b === "object" ? b as Record<string, unknown> : null))
        .filter((b): b is Record<string, unknown> => b !== null && Boolean(text(b.label)))
        .slice(0, 4)
        .map((b) => ({label: text(b.label) as string, named: b.named === true}));
    // v2's fields, each only when the server sent it.
    const life: Partial<ArkAnimal> = {};
    if (row.origin === "arrived" || row.origin === "born") life.origin = row.origin;
    // Captures + thrive (frozen read contract, section 1): each only when the server sent it.
    if ("source" in row) life.source = arkArrivalSource(row.source);
    if ("thrive" in row) life.thrive = arkThrive(row.thrive);
    if ("area" in row) life.area = arkArea(row.area);
    // Part C (islands on): its island and, in the zoo, its enclosure; each only when the server sent it.
    if (["wild", "town"].includes(row.island as string)) life.island = row.island as "wild" | "town";
    if ("enclosure" in row) life.enclosure = enclosure(row.enclosure);
    // Container breeding (only while the server's switch is on): where the engine keeps a house or farm animal (an id of the town's
    // plan, checked where it is read: `islands/town/containers.ts` knows the ids it can use).
    if (typeof row.container === "string") life.container = row.container;
    // Sexes (only while the server's switch is on): the key's presence says so; a mode only for a kind that is not a male and a female.
    // As sent: checked where they are read (`lib/ark-sex.ts`, not in the page's first JavaScript).
    if ("sex" in row) Object.assign(life, {sex: row.sex, reproduction: row.reproduction});
    const generation = whole(row.generation);
    if (generation !== null) life.generation = generation;
    if (["well_fed", "hungry", "old"].includes(row.condition as string)) life.condition = row.condition as ArkAnimal["condition"];
    const born = finite(row.born_ark_day);
    if (born !== null) life.born_ark_day = born;
    // Its kind's wild lifespan (the age bar), when the server sends one.
    const days = finite(row.lifespan_days);
    if (days !== null && days > 0) {
        life.lifespan_days = days;
        life.lifespan_estimate = row.lifespan_estimate === true;
        // PROPOSED (not sent yet): the upper end of that lifespan, and a predator kind's meal interval.
        const hi = finite(row.lifespan_days_hi);
        if (hi !== null && hi >= days) life.lifespan_days_hi = hi;
    }
    const meal = finite(row.hunt_interval_days);
    if (meal !== null && meal > 0) life.hunt_interval_days = meal;
    if ("activity" in row) life.activity = arkActivity(row.activity);
    if (["solitary", "pair", "group"].includes(row.sociality as string)) life.sociality = row.sociality as ArkAnimal["sociality"];
    if (bringers.length) life.bringers = bringers;
    // The species' stats and stored length, when the server sends them (else the scene reads the catalogue's).
    const statsRow = row.stats && typeof row.stats === "object" ? row.stats as Record<string, unknown> : {};
    const stats: Partial<ArkStats> = {};
    for (const key of ARK_STAT_KEYS) {
        const value = statsRow[key] ?? (key === "size" ? row.size : undefined);
        const level = finite(value);
        if (level !== null && level >= 0 && level <= 100) stats[key] = level;
    }
    if (Object.keys(stats).length) life.stats = stats;
    const length = finite(row.length_m);
    if (length !== null && length > 0) {
        life.length_m = length;
        const phrase = text(row.length_phrase);
        if (phrase) life.length_phrase = phrase;
    }
    const slot = whole(row.slot);
    const rank = whole(row.slot_rank);
    if (slot !== null && rank !== null) Object.assign(life, {slot, slot_rank: rank});
    if (placeholder) life.placeholder = true;
    // The last of its kind aboard (sent only when true): no mate, it will age out; the card says so.
    if (row.last_of_kind === true) life.last_of_kind = true;
    // V1 (E3's read, flag off today): a lone founder, sent only when true.
    if (row.lone === true) life.lone = true;
    // E6's read (flag off today): what it is doing now, as sent. Its fields are checked where they are read
    // (`seen/hooks.ts` `arkSeenStates`: this file is in the page's first JavaScript, that one is not).
    if (row.state && typeof row.state === "object") life.state = row.state as ArkAnimal["state"];
    const kind = text(row.kind_species_profile_id);
    if (kind && kind !== text(row.species_profile_id)) {
        life.kind_species_profile_id = kind;
        const kindName = text(row.kind_name);
        if (kindName) life.kind_name = kindName;
    }
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

/** A zoo enclosure's name (`<type>-<n>`, the server's `voyage_animals.enclosure`), or null. */
function enclosure(value: unknown): string | null {
    return typeof value === "string" && /^[a-z_]{1,40}-[0-9]{1,3}$/.test(value) ? value : null;
}

/** Part C: both islands' counts (`voyage_public_v3`'s `islands`), or null. */
function islandCounts(value: unknown): {wild: number; town: number; zoo: number} | null {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    return {wild: count(row.wild), town: count(row.town), zoo: count(row.zoo)};
}

/** The launch grace's end (an Ark day) and its ramp (Ark days), or null. */
function huntGrace(value: unknown): {ends_ark_day: number; ramp_ark_days: number} | null {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    const ends = finite(row.ends_ark_day);
    const ramp = finite(row.ramp_ark_days);
    return ends !== null && ends >= 0 && ramp !== null && ramp >= 0 ? {ends_ark_day: ends, ramp_ark_days: ramp} : null;
}

function finite(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A clutch row (`nests`, A9): only eggs in a known zone; anything else is dropped. */
function nestRow(raw: unknown): ArkNestRow | null {
    if (!raw || typeof raw !== "object") return null;
    const row = raw as Record<string, unknown>;
    const species = text(row.species_profile_id);
    if (!species || row.status !== "egg" || typeof row.zone !== "string" || !ZONES.has(row.zone)) return null;
    return {
        species_profile_id: species,
        name: text(row.name) ?? "",
        model_slug: text(row.model_slug),
        zone: row.zone as ArkZone,
        status: "egg",
        eggs: whole(row.eggs),
        laid_ark_day: finite(row.laid_ark_day),
        hatch_ark_day: finite(row.hatch_ark_day),
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
            // (a species is its kind: a Beagle is a Domestic Dog; the server's count is by kind)
            species: count(counts.species ?? new Set(animals.map((a) => a.kind_species_profile_id || a.species_profile_id)).size),
            founders: count(counts.founders)
        },
        zones,
        animals: animals.sort((a, b) => a.arrived_at.localeCompare(b.arrived_at)),
        as_of: text(row.as_of),
        ...(finite(voyage.ark_day) !== null ? {ark_day: voyage.ark_day as number} : {}),
        ...(Array.isArray(row.nests) ? {nests: row.nests.map(nestRow).filter((nest): nest is ArkNestRow => nest !== null)} : {}),
        // Part C: one island's read (`voyage_public_v3`): which island, and both islands' counts.
        ...(["wild", "town"].includes(row.island as string) ? {island: row.island as "wild" | "town"} : {}),
        ...(islandCounts(row.islands) ? {islands: islandCounts(row.islands)!} : {}),
        // PROPOSED (not sent yet): the hunting protection of the launch grace.
        ...(huntGrace(voyage.hunt_grace ?? row.hunt_grace) ? {hunt_grace: huntGrace(voyage.hunt_grace ?? row.hunt_grace)!} : {})
    };
}
