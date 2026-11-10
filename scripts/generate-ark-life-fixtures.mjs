#!/usr/bin/env node
/**
 * Writes the Ark life v2 fixtures (life contract section 5), shaped like the
 * server's public reads, so /ark can be tried before the server is live:
 *
 *   src/ark-scene/fixtures/snapshot-v2.json  `voyage_public_v2`: the v1 fixture's
 *                                             animals, minus the eaten and the dead,
 *                                             plus a few species for every kind of
 *                                             chase and two zebra foals born aboard
 *   src/ark-scene/fixtures/events.json       `voyage_events_since_v1`: every event
 *                                             since the Ark began, oldest first
 *   src/ark-scene/fixtures/lives.json        `voyage_animal_life_v1` per animal id
 *
 *   node scripts/generate-ark-life-fixtures.mjs
 *
 * Made-up but plausible: these are what the scene acts out, never what it
 * decides. The species' activity and sociality are hand-set here; the real
 * ones come from `voyage_species_traits`. Deterministic: the same files
 * every run.
 */
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fixtures = path.join(root, "src/ark-scene/fixtures");
const base = JSON.parse(readFileSync(path.join(fixtures, "snapshot.json"), "utf8"));

const STARTED = "2026-10-30T09:16:01Z";
const AS_OF = "2026-11-10T09:00:00Z";
/** 1 Ark year = 14 real days (life contract section 1). */
const ARK_DAY_MS = 14 / 365 * 86_400_000;
const arkDay = (iso) => Math.round((Date.parse(iso) - Date.parse(STARTED)) / ARK_DAY_MS * 10) / 10;

/** Activity and sociality, by hand for the fixture species (the server reads stored text). */
const TRAITS = {
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

/** The species added for the chases: slug, name, scientific name, zone, profile id (the site's own where it has one). */
const EXTRA = [
    ["european-rabbit", "European Rabbit", "Oryctolagus cuniculus", "grassland", 3],
    ["african-rock-python", "African Rock Python", "Python sebae", "grassland", 1, "496902c3-51d9-442e-8d5c-2ea85cd13cff"],
    ["alpine-marmot", "Alpine Marmot", "Marmota marmota", "mountains", 1],
    ["atlantic-herring", "Atlantic Herring", "Clupea harengus", "open_ocean", 5],
    ["bluefin-tuna", "Bluefin Tuna", "Thunnus thynnus", "open_ocean", 2, "71fa2b4a-3968-4cab-94ad-a196a5a6c096"],
    ["american-bullfrog", "American Bullfrog", "Lithobates catesbeianus", "river_lake", 1, "398571ec-d21e-4319-a187-e4235111026c"],
    ["house-cricket", "House Cricket", "Acheta domesticus", "river_lake", 3]
];

function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function uuid(random) {
    const hex = Array.from({length: 32}, () => Math.floor(random() * 16).toString(16)).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const iso = (ms) => new Date(Math.round(ms / 1000) * 1000).toISOString().replace(".000Z", "Z");

const random = seeded(20261111);
const animals = base.animals.map((animal) => ({...animal, origin: "arrived", parents: null}));
// The added species come aboard between 31 October and 6 November.
for (const [slug, name, scientific, zone, count, profileId] of EXTRA) {
    const speciesId = profileId ?? uuid(random);
    for (let i = 0; i < count; i++) {
        const at = Date.parse("2026-10-31T08:00:00Z") + random() * (Date.parse("2026-11-06T20:00:00Z") - Date.parse("2026-10-31T08:00:00Z"));
        const founder = 1 + Math.floor(random() * 38);
        animals.push({id: uuid(random), species_profile_id: speciesId, name, scientific_name: scientific, model_slug: slug, zone, arrived_at: iso(at), brought_by: {label: `Voyager ${founder}`, named: false}, mine: false, origin: "arrived", parents: null});
    }
}
animals.sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));

const of = (slug) => animals.filter((a) => a.model_slug === slug);
const first = (slug) => of(slug)[0];

// MARK: What happened (the server's decisions, made up for the fixture)

const events = [];
let serial = 0;
const ref = (animal) => ({id: animal.id, species_profile_id: animal.species_profile_id, name: animal.name, model_slug: animal.model_slug, zone: animal.zone, arrived_at: animal.arrived_at});
const push = (kind, at, fields) => events.push({id: String(++serial), kind, at, ark_day: arkDay(at), ...fields});

for (const animal of animals) push("arrival", animal.arrived_at, {animal: ref(animal), bringers: [animal.brought_by.label]});

const gone = new Map();
const meal = (at, predator, prey, phrase) => {
    push("meal", at, {animal: ref(predator), other: ref(prey), phrase});
    push("eaten", at, {animal: ref(prey), other: ref(predator), phrase});
    gone.set(prey.id, "eaten");
};

// Before the default replay window.
meal("2026-11-07T15:20:00Z", first("african-lion"), of("plains-zebra")[6], "zebras");
const zebras = of("plains-zebra").filter((z) => !gone.has(z.id));
const pair = [zebras[0], zebras.find((z) => z.brought_by.label !== zebras[0].brought_by.label)];
const foals = [];
for (let i = 0; i < 2; i++) {
    const at = "2026-11-08T19:30:00Z";
    const foal = {id: uuid(random), species_profile_id: pair[0].species_profile_id, name: pair[0].name, scientific_name: pair[0].scientific_name, model_slug: "plains-zebra", zone: pair[0].zone, arrived_at: at, brought_by: {label: pair[0].brought_by.label, named: false}, mine: false, origin: "born", parents: [pair[0].id, pair[1].id]};
    foals.push(foal);
    push("birth", at, {animal: ref(foal), parents: foal.parents, bringers: [pair[0].brought_by.label, pair[1].brought_by.label]});
}
animals.push(...foals);
// The default replay window ("since Sunday": from 9 November).
meal("2026-11-09T01:40:00Z", first("african-rock-python"), of("european-rabbit")[1], "rabbits");
meal("2026-11-09T06:40:00Z", first("bluefin-tuna"), of("atlantic-herring")[2], "herring");
meal("2026-11-09T09:15:00Z", first("golden-eagle"), first("alpine-marmot"), "marmots");
push("extinction", "2026-11-09T09:15:00Z", {species_profile_id: first("alpine-marmot").species_profile_id, species_name: "Alpine Marmot"});
meal("2026-11-09T13:05:00Z", first("great-white-shark"), of("harbor-seal")[3], "seals");
const sparrow = first("house-sparrow");
push("death_old", "2026-11-09T16:20:00Z", {animal: ref(sparrow)});
gone.set(sparrow.id, "died_old");
meal("2026-11-10T02:00:00Z", first("american-bullfrog"), of("house-cricket")[0], "insects");
// A few milestones and hunger, which the replay leaves to the summary and the life story.
for (const animal of animals.filter((_, i) => i % 9 === 0)) push("milestone", iso(Date.parse(animal.arrived_at) + 86_400_000 * (1 + random() * 2)), {animal: ref(animal)});
push("hungry", "2026-11-09T20:00:00Z", {animal: ref(of("eurasian-wolf")[0])});
events.sort((a, b) => a.at.localeCompare(b.at) || Number(a.id) - Number(b.id));

// MARK: The snapshot as the server would answer now

const OLD = new Set([first("african-bush-elephant").id]);
const HUNGRY = new Set([of("eurasian-wolf")[0].id, of("eurasian-wolf")[1].id, first("jaguar").id]);
const present = animals.filter((a) => !gone.has(a.id));
const v2Animal = (animal) => {
    const [activity, sociality] = TRAITS[animal.model_slug] ?? [null, null];
    const bringers = animal.origin === "born"
        ? animal.parents.map((id) => animals.find((a) => a.id === id).brought_by)
        : [animal.brought_by];
    return {
        ...animal,
        generation: animal.origin === "born" ? 1 : 0,
        condition: OLD.has(animal.id) ? "old" : HUNGRY.has(animal.id) ? "hungry" : "well_fed",
        born_ark_day: arkDay(animal.arrived_at),
        activity,
        sociality,
        bringers: bringers.map((b) => ({label: b.label, named: false})),
        ...(animal.origin === "born" ? {} : {parents: null})
    };
};
const zones = {};
for (const animal of present) zones[animal.zone] = (zones[animal.zone] ?? 0) + 1;
const snapshot = {
    voyage: base.voyage,
    counts: {animals: present.length, species: new Set(present.map((a) => a.species_profile_id)).size, founders: new Set(present.filter((a) => a.origin === "arrived").map((a) => a.brought_by.label)).size},
    zones: Object.entries(zones).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({key, animals: count})),
    animals: present.map(v2Animal),
    as_of: AS_OF,
    ark_day: arkDay(AS_OF)
};

// MARK: Life stories

const lives = {};
for (const animal of animals) {
    const meals = events.filter((e) => e.kind === "meal" && e.animal.id === animal.id);
    const young = events.filter((e) => e.kind === "birth" && e.parents.includes(animal.id));
    const milestones = events.filter((e) => e.kind === "milestone" && e.animal.id === animal.id);
    const end = gone.has(animal.id) ? events.find((e) => (e.kind === "eaten" || e.kind === "death_old") && e.animal.id === animal.id).at : AS_OF;
    const age = Math.round((Date.parse(end) - Date.parse(animal.arrived_at)) / ARK_DAY_MS);
    const parents = animal.parents?.map((id) => animals.find((a) => a.id === id)) ?? null;
    const last = meals[meals.length - 1];
    lives[animal.id] = {
        id: animal.id,
        species: animal.name,
        status: gone.get(animal.id) ?? "present",
        origin: animal.origin === "born"
            ? {kind: "born", at: animal.arrived_at, parents: animal.parents, parents_brought_by: parents.map((p) => p.brought_by.label)}
            : {kind: "arrived", at: animal.arrived_at, brought_by: animal.brought_by.label},
        generation: animal.origin === "born" ? 1 : 0,
        ark_age_days: age,
        ark_age_years: Math.round(age / 365 * 100) / 100,
        condition: OLD.has(animal.id) ? "old" : HUNGRY.has(animal.id) ? "hungry" : "well_fed",
        meals: meals.length,
        last_meal: last ? {at: last.at, prey: last.other.name, phrase: last.phrase} : null,
        young_raised: young.length,
        milestones: {count: milestones.length, latest: milestones[milestones.length - 1]?.at ?? null},
        ancestor_brought_by: parents ? parents[0].brought_by.label : animal.brought_by.label,
        story_public: null
    };
}

const write = (file, value) => writeFileSync(path.join(fixtures, file), JSON.stringify(value, null, 1) + "\n");
write("snapshot-v2.json", snapshot);
write("events.json", events);
write("lives.json", lives);
const kinds = events.reduce((sum, e) => ({...sum, [e.kind]: (sum[e.kind] ?? 0) + 1}), {});
console.log(`snapshot-v2.json: ${snapshot.counts.animals} animals, ${snapshot.counts.species} species, Ark day ${snapshot.ark_day}`);
console.log(`events.json: ${events.length} events`, kinds);
console.log(`lives.json: ${Object.keys(lives).length} lives`);
