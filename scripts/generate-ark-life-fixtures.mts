#!/usr/bin/env -S npx tsx
/**
 * The Ark life v2 development fixtures (life contract section 5), written
 * in the server's shapes exactly: a made-up capture (`{snapshot, events,
 * lives}`, the answers of `voyage_public_v2`, `voyage_events_since_v1` and
 * `voyage_animal_life_v1`) checked and written by the same code that turns a
 * real server capture into fixtures (scripts/ark-life-fixtures-from-server.mts).
 *
 *   npx tsx scripts/generate-ark-life-fixtures.mts
 *
 * The world: the v1 fixture's animals, a few species for every kind of
 * chase, two zebra foals born aboard, meals, an extinction, a death of old
 * age, a jaguar that starved. Places (slot, slot_rank) are given in time
 * order by the server's rules (only the living hold one). The species'
 * activity and sociality are hand-set here; the real ones come from
 * `voyage_species_traits`. Made-up but plausible: these are what the scene
 * acts out, never what it decides. Deterministic: the same files every run.
 */
import {readFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {allocateArkPlaces} from "../src/ark-scene/placement.ts";
import type {ArkAnimal} from "../src/ark-scene/types.ts";
import {proveArkCapture, writeArkFixtures} from "./ark-life-fixtures-from-server.mts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "src/ark-scene/fixtures");
type V1Animal = {id: string; species_profile_id: string; name: string; scientific_name: string | null; model_slug: string; zone: ArkAnimal["zone"]; arrived_at: string; brought_by: {label: string; named: boolean}; mine: boolean};
const base = JSON.parse(readFileSync(join(fixtures, "snapshot.json"), "utf8")) as {voyage: {slug: string; name: string; started_at: string}; animals: V1Animal[]};

const STARTED = base.voyage.started_at;
const AS_OF = "2026-11-10T09:00:00Z";
/** 1 Ark year = 14 real days (life contract section 1). */
const ARK_DAY_MS = 14 / 365 * 86_400_000;
const arkDay = (iso: string) => Math.round((Date.parse(iso) - Date.parse(STARTED)) / ARK_DAY_MS * 1000) / 1000;

type Activity = "diurnal" | "nocturnal" | "crepuscular" | "any" | null;
type Sociality = "solitary" | "pair" | "group" | null;
/** Activity and sociality, by hand for the fixture species (the server reads stored text). */
const TRAITS: Record<string, [Activity, Sociality]> = {
    "african-lion": ["nocturnal", "group"], "plains-zebra": ["diurnal", "group"], "cheetah": ["diurnal", "solitary"],
    "african-bush-elephant": ["any", "group"], "komodo-dragon": ["diurnal", "solitary"], "scarlet-macaw": ["diurnal", "pair"],
    "jaguar": ["crepuscular", "solitary"], "red-fox": ["crepuscular", "solitary"], "eurasian-wolf": ["crepuscular", "group"],
    "roe-deer": ["crepuscular", null], "barn-owl": ["nocturnal", "pair"], "domestic-cat": ["crepuscular", null],
    "domestic-goat": ["diurnal", "group"], "domestic-dog": ["diurnal", null], "house-sparrow": ["diurnal", "group"],
    "mallard": ["diurnal", "pair"], "grey-heron": ["diurnal", "solitary"], "american-alligator": ["nocturnal", "solitary"],
    "capybara": ["crepuscular", "group"], "great-white-shark": ["any", "solitary"], "humpback-whale": ["any", "group"],
    "green-sea-turtle": ["diurnal", "solitary"], "reef-manta-ray": ["diurnal", null], "harbor-seal": ["any", "group"],
    "atlantic-puffin": ["diurnal", "group"], "fennec-fox": ["nocturnal", "pair"], "dromedary-camel": ["diurnal", "group"],
    "meerkat": ["diurnal", "group"], "snow-leopard": ["crepuscular", "solitary"], "alpine-ibex": ["diurnal", "group"],
    "golden-eagle": ["diurnal", "pair"], "polar-bear": ["any", "solitary"], "emperor-penguin": ["diurnal", "group"],
    "arctic-fox": ["any", null], "red-tailed-hawk": ["diurnal", "solitary"], "african-forest-buffalo": [null, "group"],
    "african-clawed-frog": ["nocturnal", null], "african-fish-eagle": ["diurnal", "pair"], "american-lobster": ["nocturnal", "solitary"],
    "atlantic-trumpetfish": ["diurnal", null], "acorn-barnacle": ["any", "group"],
    "european-rabbit": ["crepuscular", "group"], "african-rock-python": ["nocturnal", "solitary"], "alpine-marmot": ["diurnal", "group"],
    "atlantic-herring": ["any", "group"], "bluefin-tuna": ["diurnal", "group"], "american-bullfrog": ["nocturnal", "solitary"],
    "house-cricket": ["nocturnal", null]
};

/** The species added for the chases: slug, name, scientific name, zone, how many, profile id (the site's own where it has one). */
const EXTRA: Array<[string, string, string, ArkAnimal["zone"], number, string?]> = [
    ["european-rabbit", "European Rabbit", "Oryctolagus cuniculus", "grassland", 3],
    ["african-rock-python", "African Rock Python", "Python sebae", "grassland", 1, "496902c3-51d9-442e-8d5c-2ea85cd13cff"],
    ["alpine-marmot", "Alpine Marmot", "Marmota marmota", "mountains", 1],
    ["atlantic-herring", "Atlantic Herring", "Clupea harengus", "open_ocean", 5],
    ["bluefin-tuna", "Bluefin Tuna", "Thunnus thynnus", "open_ocean", 2, "71fa2b4a-3968-4cab-94ad-a196a5a6c096"],
    ["american-bullfrog", "American Bullfrog", "Lithobates catesbeianus", "river_lake", 1, "398571ec-d21e-4319-a187-e4235111026c"],
    ["house-cricket", "House Cricket", "Acheta domesticus", "river_lake", 3]
];

function seeded(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function uuid(random: () => number) {
    const hex = Array.from({length: 32}, () => Math.floor(random() * 16).toString(16)).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const iso = (ms: number) => new Date(Math.round(ms / 1000) * 1000).toISOString().replace(".000Z", "Z");
/** voyage_events_since_v1's `at`: microseconds. */
const micro = (at: string) => new Date(at).toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");

type Animal = V1Animal & {origin: "arrived" | "born"; parents: string[] | null; generation: number; status: "present" | "eaten" | "died_old" | "starved"; died_at: string | null; slot?: number; slot_rank?: number};

const random = seeded(20261111);
const animals: Animal[] = base.animals.map((animal) => ({...animal, origin: "arrived", parents: null, generation: 0, status: "present", died_at: null}));
// The added species come aboard between 31 October and 6 November.
for (const [slug, name, scientific, zone, count, profileId] of EXTRA) {
    const speciesId = profileId ?? uuid(random);
    for (let i = 0; i < count; i++) {
        const at = Date.parse("2026-10-31T08:00:00Z") + random() * (Date.parse("2026-11-06T20:00:00Z") - Date.parse("2026-10-31T08:00:00Z"));
        const founder = 1 + Math.floor(random() * 38);
        animals.push({id: uuid(random), species_profile_id: speciesId, name, scientific_name: scientific, model_slug: slug, zone, arrived_at: iso(at), brought_by: {label: `Voyager ${founder}`, named: false}, mine: false, origin: "arrived", parents: null, generation: 0, status: "present", died_at: null});
    }
}
animals.sort((a, b) => a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id));
const byId = new Map(animals.map((a) => [a.id, a]));
const of = (slug: string) => animals.filter((a) => a.model_slug === slug);
const first = (slug: string) => of(slug)[0];

// MARK: What happened (the server's decisions, made up for the fixture)

type Row = {kind: string; at: string; animal?: string; other?: string; species: string; phrase?: string};
const log: Row[] = animals.map((a) => ({kind: "arrival", at: a.arrived_at, animal: a.id, species: a.species_profile_id}));
const end = (animal: Animal, status: Animal["status"], at: string) => Object.assign(animal, {status, died_at: at});
const meal = (at: string, predator: Animal, prey: Animal, phrase: string) => {
    log.push({kind: "meal", at, animal: predator.id, other: prey.id, species: predator.species_profile_id, phrase});
    log.push({kind: "eaten", at, animal: prey.id, other: predator.id, species: prey.species_profile_id, phrase});
    end(prey, "eaten", at);
};

// Before the default replay window.
meal("2026-11-07T15:20:00Z", first("african-lion"), of("plains-zebra")[6], "zebras");
const zebras = of("plains-zebra").filter((z) => z.status === "present");
const pair = [zebras[0], zebras.find((z) => z.brought_by.label !== zebras[0].brought_by.label)!];
for (let i = 0; i < 2; i++) {
    const at = "2026-11-08T19:30:00Z";
    const foal: Animal = {id: uuid(random), species_profile_id: pair[0].species_profile_id, name: pair[0].name, scientific_name: pair[0].scientific_name, model_slug: "plains-zebra", zone: pair[0].zone, arrived_at: at, brought_by: {label: "", named: false}, mine: false, origin: "born", parents: [pair[0].id, pair[1].id], generation: 1, status: "present", died_at: null};
    animals.push(foal);
    byId.set(foal.id, foal);
    log.push({kind: "birth", at, animal: foal.id, species: foal.species_profile_id});
}
// The default replay window ("since Sunday": from 9 November).
meal("2026-11-09T01:40:00Z", first("african-rock-python"), of("european-rabbit")[1], "rabbits");
meal("2026-11-09T06:40:00Z", first("bluefin-tuna"), of("atlantic-herring")[2], "herring");
meal("2026-11-09T09:15:00Z", first("golden-eagle"), first("alpine-marmot"), "marmots");
log.push({kind: "extinction", at: "2026-11-09T09:15:00Z", species: first("alpine-marmot").species_profile_id});
meal("2026-11-09T13:05:00Z", first("great-white-shark"), of("harbor-seal")[3], "seals");
const sparrow = first("house-sparrow");
log.push({kind: "death_old", at: "2026-11-09T16:20:00Z", animal: sparrow.id, species: sparrow.species_profile_id});
end(sparrow, "died_old", "2026-11-09T16:20:00Z");
// A predator dies of long hunger (owner decision 2026-11-10): hungry first, then starved.
const jaguar = first("jaguar");
log.push({kind: "hungry", at: "2026-11-08T22:00:00Z", animal: jaguar.id, species: jaguar.species_profile_id});
log.push({kind: "starved", at: "2026-11-09T18:40:00Z", animal: jaguar.id, species: jaguar.species_profile_id});
end(jaguar, "starved", "2026-11-09T18:40:00Z");
meal("2026-11-10T02:00:00Z", first("american-bullfrog"), of("house-cricket")[0], "insects");
// A few milestones and hunger, which the replay leaves to the summary and the life story.
for (const animal of animals.filter((a, i) => i % 9 === 0 && a.origin === "arrived")) {
    log.push({kind: "milestone", at: iso(Date.parse(animal.arrived_at) + 86_400_000 * (1 + random() * 2)), animal: animal.id, species: animal.species_profile_id});
}
log.push({kind: "hungry", at: "2026-11-09T20:00:00Z", animal: of("eurasian-wolf")[0].id, species: of("eurasian-wolf")[0].species_profile_id});
const ORDER = ["arrival", "birth", "milestone", "hungry", "fed", "meal", "eaten", "death_old", "starved", "extinction"];
log.sort((a, b) => a.at.localeCompare(b.at) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

// MARK: Places, as the server gives them (voyage_animal_place): in time order, only the living hold one

{
    const living = new Map<string, ArkAnimal>();
    const asArk = (a: Animal): ArkAnimal => ({...a, brought_by: a.brought_by, sociality: TRAITS[a.model_slug]?.[1] ?? null, slot: a.slot ?? null, slot_rank: a.slot_rank ?? null});
    const moments = [
        ...animals.map((a) => ({at: a.arrived_at, rank: 0, animal: a, comes: true})),
        ...animals.filter((a) => a.died_at).map((a) => ({at: a.died_at!, rank: 1, animal: a, comes: false}))
    ].sort((a, b) => a.at.localeCompare(b.at) || a.rank - b.rank || a.animal.id.localeCompare(b.animal.id));
    for (const moment of moments) {
        if (!moment.comes) {
            living.delete(moment.animal.id);
            continue;
        }
        const animal = moment.animal;
        // A young one joins a living parent's cluster in its zone (the server's first rule).
        const parent = animal.parents?.map((id) => byId.get(id)!).find((p) => living.has(p.id) && p.zone === animal.zone);
        if (parent) {
            const ranks = new Set(Array.from(living.values()).filter((a) => a.zone === animal.zone && a.slot === parent.slot).map((a) => a.slot_rank));
            let rank = 0;
            while (ranks.has(rank)) rank++;
            Object.assign(animal, {slot: parent.slot, slot_rank: rank});
        } else {
            const place = allocateArkPlaces([...living.values(), asArk(animal)]).get(animal.id)!;
            Object.assign(animal, {slot: place.slot, slot_rank: place.rank});
        }
        living.set(animal.id, asArk(animal));
    }
}

// MARK: The answers

const label = (animal: Animal) => animal.brought_by;
const bringersOf = (animal: Animal): Array<{label: string; named: boolean}> => animal.origin === "born"
    ? Array.from(new Map(animal.parents!.map((id) => byId.get(id)!).map((p) => [p.brought_by.label, {label: p.brought_by.label, named: false}])).values())
    : [label(animal)];
const OLD = new Set([first("african-bush-elephant").id]);
const HUNGRY = new Set([of("eurasian-wolf")[0].id, of("eurasian-wolf")[1].id]);
const condition = (animal: Animal) => (animal.status !== "present" ? null : HUNGRY.has(animal.id) ? "hungry" : OLD.has(animal.id) ? "old" : "well_fed");
const name = (speciesId: string) => animals.find((a) => a.species_profile_id === speciesId)!.name;

const present = animals.filter((a) => a.status === "present");
const zones = new Map<string, number>();
for (const animal of present) zones.set(animal.zone, (zones.get(animal.zone) ?? 0) + 1);
const snapshot = {
    voyage: {slug: base.voyage.slug, name: base.voyage.name, started_at: STARTED, ark_day: arkDay(AS_OF)},
    counts: {animals: present.length, species: new Set(present.map((a) => a.species_profile_id)).size, founders: new Set(present.filter((a) => a.origin === "arrived").map((a) => a.brought_by.label)).size},
    zones: Array.from(zones.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key, n]) => ({key, animals: n})),
    animals: present.map((animal) => {
        const [activity, sociality] = TRAITS[animal.model_slug] ?? [null, null];
        return {
            id: animal.id, species_profile_id: animal.species_profile_id, name: animal.name, scientific_name: animal.scientific_name,
            model_slug: animal.model_slug, zone: animal.zone, arrived_at: animal.arrived_at,
            brought_by: animal.origin === "arrived" ? label(animal) : null, mine: false,
            origin: animal.origin, generation: animal.generation, condition: condition(animal), born_ark_day: arkDay(animal.arrived_at),
            activity, sociality, bringers: bringersOf(animal), slot: animal.slot, slot_rank: animal.slot_rank
        };
    }),
    as_of: AS_OF
};

const eventAnimal = (id: string | undefined) => {
    const animal = id ? byId.get(id) : undefined;
    if (!animal) return null;
    const [activity, sociality] = TRAITS[animal.model_slug] ?? [null, null];
    return {
        id: animal.id, species_profile_id: animal.species_profile_id, name: animal.name, model_slug: animal.model_slug, zone: animal.zone,
        arrived_at: animal.arrived_at, origin: animal.origin, generation: animal.generation, slot: animal.slot, slot_rank: animal.slot_rank,
        activity, sociality, status: animal.status
    };
};
const rows = log.map((row, index) => {
    const young = row.kind === "birth" ? byId.get(row.animal!)! : null;
    return {
        id: index + 1, kind: row.kind, at: micro(row.at), ark_day: arkDay(row.at), species_profile_id: row.species, species: name(row.species),
        animal: eventAnimal(row.animal), other: eventAnimal(row.other), phrase: row.phrase ?? null,
        parents: young ? Array.from(new Set(young.parents)) : [], bringers: young ? bringersOf(young) : []
    };
});
const events = {events: rows, next_since: rows[rows.length - 1].at, more: false, as_of: micro(AS_OF)};

const lives: Record<string, unknown> = {};
for (const animal of animals) {
    const meals = log.filter((e) => e.kind === "meal" && e.animal === animal.id);
    const milestones = log.filter((e) => e.kind === "milestone" && e.animal === animal.id);
    const last = meals[meals.length - 1];
    const endAt = animal.died_at ?? AS_OF;
    const age = Math.max(arkDay(endAt) - arkDay(animal.arrived_at), 0);
    // The first arrival of its line (parent_a first).
    let ancestor = animal;
    while (ancestor.origin === "born") ancestor = byId.get(ancestor.parents![0])!;
    lives[animal.id] = {
        id: animal.id, species_profile_id: animal.species_profile_id, species: animal.name, model_slug: animal.model_slug, status: animal.status,
        origin: animal.origin === "born"
            ? {kind: "born", at: animal.arrived_at, parents: Array.from(new Set(animal.parents)), born_to: bringersOf(animal), breeding_source: "estimate"}
            : {kind: "arrived", at: animal.arrived_at, brought_by: label(animal)},
        generation: animal.generation, born_ark_day: arkDay(animal.arrived_at),
        ark_age_days: Math.round(age * 10) / 10, ark_age_years: Math.round(age / 365 * 100) / 100,
        condition: condition(animal), meals: meals.length,
        last_meal: last ? {at: last.at, ark_day: arkDay(last.at), prey: byId.get(last.other!)!.name, prey_species_profile_id: byId.get(last.other!)!.species_profile_id, phrase: last.phrase} : null,
        young_raised: animals.filter((y) => y.parents?.includes(animal.id)).length,
        ancestor_brought_by: label(ancestor),
        milestones: {count: milestones.length, latest_at: milestones[milestones.length - 1]?.at ?? null},
        died: animal.died_at ? {at: animal.died_at, kind: animal.status} : null,
        story_public: null
    };
}

const capture = {snapshot, events, lives};
console.log(proveArkCapture(capture));
writeArkFixtures(capture);
console.log("wrote src/ark-scene/fixtures/snapshot-v2.json, events.json, lives.json");
