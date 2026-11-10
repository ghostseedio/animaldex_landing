#!/usr/bin/env node
/**
 * Writes the Ark's local test snapshots (contract section 5), shaped exactly
 * like `voyage_public_v1`:
 *
 *   src/ark-scene/fixtures/snapshot.json        about 120 animals over the 41 fixture
 *                                                species, every zone, a few "mine"
 *   src/ark-scene/fixtures/snapshot-early.json  the two real arrivals (Komodo Dragon,
 *                                                Red-tailed Hawk), anonymous
 *
 *   node scripts/generate-ark-fixtures.mjs [~/animaldex-talking-models]
 *
 * Names come from the model build's species.json, zones from its
 * habitats.json, species ids from the site's own static profile snapshot.
 * Deterministic: the same files every run.
 */
import {readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const models = process.argv[2] ?? path.join(os.homedir(), "animaldex-talking-models");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/** The 41 fixture species (AnimalDex scripts/talking-models/ark/fixture_species.txt). */
const FIXTURE = [
    "african-lion", "plains-zebra", "cheetah", "african-bush-elephant", "komodo-dragon", "scarlet-macaw", "jaguar",
    "red-fox", "eurasian-wolf", "roe-deer", "barn-owl", "domestic-cat", "domestic-goat", "domestic-dog", "house-sparrow",
    "mallard", "grey-heron", "american-alligator", "capybara", "great-white-shark", "humpback-whale", "green-sea-turtle",
    "reef-manta-ray", "harbor-seal", "atlantic-puffin", "fennec-fox", "dromedary-camel", "meerkat", "snow-leopard",
    "alpine-ibex", "golden-eagle", "polar-bear", "emperor-penguin", "arctic-fox", "red-tailed-hawk",
    "african-forest-buffalo", "african-clawed-frog", "african-fish-eagle", "american-lobster", "atlantic-trumpetfish",
    "acorn-barnacle"
];

const SCIENTIFIC = {
    "african-lion": "Panthera leo", "plains-zebra": "Equus quagga", "cheetah": "Acinonyx jubatus",
    "african-bush-elephant": "Loxodonta africana", "komodo-dragon": "Varanus komodoensis", "scarlet-macaw": "Ara macao",
    "jaguar": "Panthera onca", "red-fox": "Vulpes vulpes", "eurasian-wolf": "Canis lupus lupus", "roe-deer": "Capreolus capreolus",
    "barn-owl": "Tyto alba", "domestic-cat": "Felis catus", "domestic-goat": "Capra hircus", "domestic-dog": "Canis familiaris",
    "house-sparrow": "Passer domesticus", "mallard": "Anas platyrhynchos", "grey-heron": "Ardea cinerea",
    "american-alligator": "Alligator mississippiensis", "capybara": "Hydrochoerus hydrochaeris", "great-white-shark": "Carcharodon carcharias",
    "humpback-whale": "Megaptera novaeangliae", "green-sea-turtle": "Chelonia mydas", "reef-manta-ray": "Mobula alfredi",
    "harbor-seal": "Phoca vitulina", "atlantic-puffin": "Fratercula arctica", "fennec-fox": "Vulpes zerda",
    "dromedary-camel": "Camelus dromedarius", "meerkat": "Suricata suricatta", "snow-leopard": "Panthera uncia",
    "alpine-ibex": "Capra ibex", "golden-eagle": "Aquila chrysaetos", "polar-bear": "Ursus maritimus",
    "emperor-penguin": "Aptenodytes forsteri", "arctic-fox": "Vulpes lagopus", "red-tailed-hawk": "Buteo jamaicensis",
    "african-forest-buffalo": "Syncerus caffer nanus", "african-clawed-frog": "Xenopus laevis", "african-fish-eagle": "Haliaeetus vocifer",
    "american-lobster": "Homarus americanus", "atlantic-trumpetfish": "Aulostomus maculatus", "acorn-barnacle": "Semibalanus balanoides"
};

const species = JSON.parse(readFileSync(path.join(models, "species.json"), "utf8"));
const habitats = JSON.parse(readFileSync(path.join(models, "habitats.json"), "utf8"));
const profiles = JSON.parse(readFileSync(path.join(root, "src/data/published-seo-static-species-profiles.json"), "utf8")).entries;
const nameOf = Object.fromEntries(species.map((row) => [row.slug, row.name]));

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

/** A stable uuid-shaped id from a seed. */
function uuid(random) {
    const hex = Array.from({length: 32}, () => Math.floor(random() * 16).toString(16)).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const madeUpIds = {};
function speciesRow(slug, random) {
    const zone = habitats[slug];
    if (!zone) throw new Error(`${slug}: no habitat`);
    madeUpIds[slug] ??= uuid(random);
    return {
        species_profile_id: profiles[slug]?.speciesProfileId ?? madeUpIds[slug],
        name: nameOf[slug] ?? slug,
        scientific_name: SCIENTIFIC[slug] ?? null,
        model_slug: slug,
        zone
    };
}

function snapshot(animals, startedAt, asOf) {
    const zones = {};
    for (const animal of animals) zones[animal.zone] = (zones[animal.zone] ?? 0) + 1;
    const owners = new Set(animals.map((animal) => animal.brought_by.label));
    return {
        voyage: {slug: "first", name: "The first Ark", started_at: startedAt},
        counts: {animals: animals.length, species: new Set(animals.map((animal) => animal.species_profile_id)).size, founders: owners.size},
        zones: Object.entries(zones).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({key, animals: count})),
        animals,
        as_of: asOf
    };
}

// The early Ark: production's two arrivals, both anonymous.
const early = seeded(2);
const earlyAnimals = [
    {slug: "red-tailed-hawk", at: "2026-11-02T18:12:05Z", founder: 1},
    {slug: "komodo-dragon", at: "2026-11-09T23:48:47Z", founder: 2}
].map(({slug, at, founder}) => ({
    id: uuid(early),
    ...speciesRow(slug, early),
    arrived_at: at,
    brought_by: {label: `Voyager ${founder}`, named: false},
    mine: false
}));

// The full Ark: every fixture species at least once, the familiar ones in pairs and herds.
const random = seeded(20261110);
const counts = Object.fromEntries(FIXTURE.map((slug) => [slug, 1]));
const popular = ["african-lion", "plains-zebra", "domestic-dog", "domestic-cat", "red-fox", "mallard", "capybara", "emperor-penguin",
    "meerkat", "roe-deer", "eurasian-wolf", "african-bush-elephant", "house-sparrow", "domestic-goat", "harbor-seal", "atlantic-puffin",
    "green-sea-turtle", "polar-bear", "alpine-ibex", "scarlet-macaw", "grey-heron", "dromedary-camel"];
let total = FIXTURE.length;
while (total < 120) {
    const slug = random() < 0.75 ? popular[Math.floor(random() * popular.length)] : FIXTURE[Math.floor(random() * FIXTURE.length)];
    if (counts[slug] >= 7) continue;
    counts[slug]++;
    total++;
}
const start = Date.parse("2026-10-30T09:00:00Z");
const end = Date.parse("2026-11-10T08:00:00Z");
const FOUNDERS = 38;
const MINE = 7;
const animals = [];
for (const slug of FIXTURE) {
    for (let i = 0; i < counts[slug]; i++) {
        const founder = 1 + Math.floor(random() ** 1.6 * FOUNDERS);
        const at = new Date(start + random() * (end - start));
        at.setUTCMilliseconds(0);
        animals.push({
            id: uuid(random),
            ...speciesRow(slug, random),
            arrived_at: at.toISOString().replace(".000Z", "Z"),
            brought_by: {label: `Voyager ${founder}`, named: false},
            mine: founder === MINE
        });
    }
}
animals.sort((a, b) => a.arrived_at.localeCompare(b.arrived_at));

const write = (file, value) => writeFileSync(path.join(root, "src/ark-scene/fixtures", file), JSON.stringify(value, null, 1) + "\n");
write("snapshot-early.json", snapshot(earlyAnimals, "2026-11-02T18:12:05Z", "2026-11-10T09:00:00Z"));
write("snapshot.json", snapshot(animals, animals[0].arrived_at, "2026-11-10T09:00:00Z"));
const full = snapshot(animals, null, null);
console.log(`snapshot.json: ${full.counts.animals} animals, ${full.counts.species} species, ${full.counts.founders} founders, ${full.zones.length} zones, ${animals.filter((a) => a.mine).length} mine`);
