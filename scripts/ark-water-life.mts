#!/usr/bin/env -S npx tsx
/**
 * `src/ark-scene/water-life.json`: each water species' way of life in the water (behaviours pass, lane B6 water,
 * 2026-11-14; docs/ark/behaviour-pass-2026-11/water.md), for the behaviour schedule's water legs
 * (`src/ark-scene/water-life.ts`): whether it swims without ever stopping, patrols and pauses, lies in wait, keeps to
 * a patch of reef, lives on the bottom, drifts, and for the air breathers and the animals of the shore which rhythm of
 * breaths and of water and land is theirs.
 *
 * Deterministic, from stored data only (no AI calls): the catalogue export the profile generator reads (taxonomy,
 * zone, and the stored text for "ambush" and "never stops swimming"), with the family, order or phrase that decided it
 * kept as the reason in `data/ark/water-life.json`. Only species the rules name are listed; any other swimmer is a
 * rover by its profile (`water-life.ts`).
 *
 *   npx tsx scripts/ark-water-life.mts <species.json>
 *
 * (`species.json` is the export described at the top of `scripts/ark-behaviour-profiles.mts`.)
 */
import fs from "node:fs";
import path from "node:path";

type Row = {
    slug: string | null;
    zone: string | null;
    excluded_reason: string | null;
    class_name: string | null;
    order_name: string | null;
    family_name: string | null;
    typical_habitat: string | null;
    where_to_look: string | null;
    diet_summary: string | null;
    sleep_pattern: string | null;
    signature_traits: string[] | string | null;
    interesting_facts: string[] | string | null;
};

const [exportPath] = process.argv.slice(2);
if (!exportPath) {
    console.error("usage: ark-water-life.mts species.json");
    process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const rows: Row[] = (Array.isArray(exported) ? exported : exported.rows).filter((r: Row) => r.slug);

/** The ways of life (`water-life.ts` ArkWaterLife) and their one-letter codes in the compact file. */
const CODES = {cruiser: "c", cetacean: "w", sirenian: "m", rover: "r", ambush: "a", reef: "f", bottom: "b", drifter: "d", jet: "j", den: "o", seal: "s", seaturtle: "t", croc: "k", terrapin: "p", hippo: "h", otter: "l", beaver: "v", wallower: "u", frog: "g", aquatic: "q"} as const;
type Life = keyof typeof CODES;

/** Open-water fish and sharks that swim all the time (ram breathers and the pelagic schoolers). */
const CRUISER_FAMILIES = /^(Scombridae|Istiophoridae|Xiphiidae|Coryphaenidae|Carangidae|Clupeidae|Engraulidae|Exocoetidae|Lampridae|Nematistiidae|Mugilidae|Atherinidae|Megalopidae|Rachycentridae|Polyodontidae|Lamnidae|Alopiidae|Cetorhinidae|Carcharhinidae|Sphyrnidae|Triakidae|Rhincodontidae|Myliobatidae|Mobulidae|Somniosidae|Mitsukurinidae|Chlamydoselachidae|Hexanchidae|Squalidae|Echeneidae|Ammodytidae|Trichiuridae)$/;
/** Fish that lie in wait and lunge. */
const AMBUSH_FAMILIES = /^(Esocidae|Lepisosteidae|Channidae|Amiidae|Antennariidae|Lophiidae|Melanocetidae|Ogcocephalidae|Brachionichthyidae|Scorpaenidae|Synanceiidae|Uranoscopidae|Trachinidae|Synodontidae|Serranidae|Epinephelidae|Batrachoididae|Muraenidae|Anarhichadidae|Aulostomidae|Fistulariidae|Zeidae|Sphyraenidae|Orectolobidae|Stomiidae|Chiasmodontidae|Eurypharyngidae|Anoplogastridae|Psychrolutidae|Cottidae|Platycephalidae|Belonidae|Polypteridae|Malapteruridae|Chaenopsidae|Eleotridae|Arapaimidae|Osteoglossidae|Latimeriidae|Protopteridae|Opisthoproctidae|Sebastidae|Channichthyidae|Ipnopidae|Sternoptychidae)$/;
/** Fish of the reef and of cover that keep to a small patch: they hover, dart a little way and come back. */
const REEF_FAMILIES = /^(Pomacentridae|Chaetodontidae|Pomacanthidae|Labridae|Scaridae|Acanthuridae|Balistidae|Tetraodontidae|Diodontidae|Ostraciidae|Monacanthidae|Zanclidae|Siganidae|Apogonidae|Holocentridae|Gobiidae|Blenniidae|Callionymidae|Syngnathidae|Solenostomidae|Centriscidae|Cirrhitidae|Anomalopidae|Monocentridae|Congridae|Cyclopteridae|Osphronemidae|Pantodontidae|Toxotidae|Mormyridae|Notopteridae|Gymnotidae|Apteronotidae|Poeciliidae|Adrianichthyidae|Gasterosteidae)$/;
/** Fish of the bottom: they rest on it and glide just over it (rays, skates, flatfish, sturgeons, catfish, loaches, gurnards, the sharks that lie up by day). */
const BOTTOM_FAMILIES = /^(Dasyatidae|Potamotrygonidae|Rajidae|Urolophidae|Torpedinidae|Rhinobatidae|Rhinidae|Pristidae|Pristiophoridae|Scyliorhinidae|Ginglymostomatidae|Hemiscylliidae|Stegostomatidae|Heterodontidae|Squatinidae|Acipenseridae|Cobitidae|Botiidae|Triglidae|Dactylopteridae|Pegasidae|Lotidae|Callichthyidae|Loricariidae|Clariidae|Ictaluridae|Siluridae|Chimaeridae|Anguillidae|Synbranchidae|Myxinidae)$/;
const BOTTOM_ORDERS = /^(Pleuronectiformes)$/;
const DRIFTER_CLASSES = /^(Scyphozoa|Cubozoa|Hydrozoa|Tentaculata|Nuda|Thaliacea|Staurozoa)$/;
const DRIFTER_FAMILIES = /^(Glaucidae|Cliidae|Clionidae|Limacinidae|Janthinidae|Epitoniidae|Molidae)$/;
/** Octopuses of the bottom keep a den; the open-water ones (glass, dumbo, blanket, argonaut) jet and drift like squid. */
const DEN_FAMILIES = /^(Octopodidae|Enteroctopodidae)$/;
const TEXT_NEVER_STOPS = /\b(never stops? swimming|must (keep )?swim(ming)? (constantly|continuously|to breathe)|swims? (constantly|continuously|without (stopping|rest))|constantly (swimming|on the move)|ram ventilat\w+|obligate ram)\b/i;
const TEXT_AMBUSH = /\b(ambush(es|ing)? (predators?|hunters?)|ambush predator|lies? in wait|l(ies|ying) motionless|sit-and-wait|waits? motionless|lurks?|lie-in-wait)\b/i;

const textOf = (row: Row, fields: Array<keyof Row>) => fields.map((f) => (Array.isArray(row[f]) ? (row[f] as string[]).join(" ") : (row[f] ?? ""))).join(" ");

function lifeOf(row: Row): {life: Life; why: string} | null {
    const cls = row.class_name ?? "";
    const order = row.order_name ?? "";
    const family = row.family_name ?? "";
    const slug = row.slug ?? "";
    const fam = (life: Life) => ({life, why: `family ${family}`});
    if (order === "Cetacea" || /^(Balaenidae|Balaenopteridae|Delphinidae|Eschrichtiidae|Iniidae|Monodontidae|Phocoenidae|Physeteridae|Platanistidae|Ziphiidae|Kogiidae|Pontoporiidae|Lipotidae)$/.test(family)) return {life: "cetacean", why: `order ${order || family}: a whale or a dolphin`};
    if (order === "Sirenia") return {life: "sirenian", why: "order Sirenia"};
    if (/^(Phocidae|Otariidae|Odobenidae)$/.test(family)) return fam("seal");
    if (/^(Cheloniidae|Dermochelyidae)$/.test(family)) return {life: "seaturtle", why: `family ${family}: a sea turtle`};
    if (/Crocodylia/.test(`${cls} ${order}`) || /^(Crocodylidae|Alligatoridae|Gavialidae)$/.test(family)) return {life: "croc", why: `${family || cls}: a crocodilian`};
    if (family === "Hippopotamidae" && slug === "common-hippopotamus") return {life: "hippo", why: "the common hippopotamus: in the water by day, ashore to graze at night"};
    if (/(?:^|-)otters?$/.test(slug) && cls === "Mammalia") return {life: "otter", why: "an otter"};
    if (family === "Castoridae") return fam("beaver");
    // Freshwater turtles that bask on the bank and live in the water (not the tortoises, nor the box, bog, wood and leaf turtles of the land).
    if (/^(Emydidae|Geoemydidae|Chelidae|Chelydridae|Kinosternidae|Trionychidae|Podocnemididae|Carettochelyidae|Pelomedusidae|Dermatemydidae|Platysternidae)$/.test(family) && !/box-turtle|bog-turtle|wood-turtle|leaf-turtle|tortoise/.test(slug)) return {life: "terrapin", why: `family ${family}: a freshwater turtle`};
    // Mammals that spend a good part of the day in the water.
    if (/^(Myocastoridae|Tapiridae|Ornithorhynchidae)$/.test(family) || /(?:^|-)(capybara|rakali|desman|muskrat|water-vole|water-buffalo|water-opossum|yapok)$/.test(slug)) return {life: "wallower", why: `${family || slug}: in the water a good part of the day`};
    // Amphibians that never leave the water.
    if (cls === "Amphibia" && (/^(Pipidae|Telmatobiidae|Proteidae|Sirenidae|Cryptobranchidae|Typhlonectidae|Amphiumidae)$/.test(family) || slug === "axolotl")) return {life: "aquatic", why: `${slug === "axolotl" ? "the axolotl" : `family ${family}`}: lives in the water`};
    if (cls === "Amphibia" && (order === "Anura" || family === "Salamandridae")) return {life: "frog", why: `${order === "Anura" ? "order Anura" : "family Salamandridae"}: at the water's edge`};
    if (DRIFTER_CLASSES.test(cls)) return {life: "drifter", why: `class ${cls}: pulses and drifts`};
    if (DRIFTER_FAMILIES.test(family)) return {life: "drifter", why: `family ${family}: drifts`};
    if (cls === "Cephalopoda") return DEN_FAMILIES.test(family) ? {life: "den", why: `family ${family}: keeps a den`} : {life: "jet", why: `class Cephalopoda (${order || family}): jets and hovers`};
    // Fish (the export's class is empty for the ray-finned fish; sharks and rays are Elasmobranchii).
    const fish = /Actinopterygii|Chondrichthyes|Elasmobranchii|Holocephali|Sarcopterygii|Teleostei|Coelacanthi|Dipneusti|Myxini|Petromyzonti/.test(cls) || (cls === "" && /iformes$/.test(order));
    if (!fish) return null;
    if (CRUISER_FAMILIES.test(family)) return fam("cruiser");
    const never = TEXT_NEVER_STOPS.exec(textOf(row, ["signature_traits", "interesting_facts", "sleep_pattern", "typical_habitat"]));
    if (never) return {life: "cruiser", why: `"${never[0]}"`};
    if (BOTTOM_ORDERS.test(order)) return {life: "bottom", why: `order ${order}: a flatfish`};
    if (BOTTOM_FAMILIES.test(family)) return fam("bottom");
    if (AMBUSH_FAMILIES.test(family)) return fam("ambush");
    if (REEF_FAMILIES.test(family)) return fam("reef");
    const ambush = TEXT_AMBUSH.exec(textOf(row, ["signature_traits", "diet_summary", "where_to_look"]));
    if (ambush) return {life: "ambush", why: `"${ambush[0]}"`};
    if (row.zone === "coral_reef") return {life: "reef", why: "a fish of the reef's zone"};
    return null;
}

const full: Record<string, {life: Life; why: string}> = {};
const compact: Record<string, string> = {};
for (const row of [...rows].sort((a, b) => a.slug!.localeCompare(b.slug!))) {
    if (row.excluded_reason) continue;
    const found = lifeOf(row);
    if (!found) continue;
    full[row.slug!] = found;
    compact[row.slug!] = CODES[found.life];
}
const counts = Object.values(full).reduce<Record<string, number>>((acc, f) => ((acc[f.life] = (acc[f.life] ?? 0) + 1), acc), {});
const about = "Generated by scripts/ark-water-life.mts from the live catalogue export (taxonomy, zone, stored text). A species' way of life in the water, one letter (" + Object.entries(CODES).map(([k, v]) => `${v} ${k}`).join(", ") + "); species not listed are read from their behaviour profile (water-life.ts).";
fs.mkdirSync(path.join(root, "data/ark"), {recursive: true});
fs.writeFileSync(path.join(root, "data/ark/water-life.json"), JSON.stringify({about, count: Object.keys(full).length, counts, species: full}, null, 1) + "\n");
fs.writeFileSync(path.join(root, "src/ark-scene/water-life.json"), `{"about":${JSON.stringify(about)},\n"species":{\n${Object.entries(compact).map(([slug, code]) => `${JSON.stringify(slug)}:${JSON.stringify(code)}`).join(",\n")}\n}}\n`);
console.log(`${Object.keys(full).length} species`, counts);
