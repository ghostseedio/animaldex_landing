#!/usr/bin/env -S npx tsx
/**
 * The Ark map's species table (docs/ark/map-plan.md, B3/B4; the owner's
 * decisions of 2026-11-11, "just do whatever you recommend"):
 *
 *   npx tsx scripts/ark-map.mts <B1 microhabitats.json> <B1 catalogue.json>
 *
 * Inputs are the B1 inventory (`scratchpad/ark-map/microhabitats.json`: every
 * species' microhabitats with the verbatim phrase, forest resolved to canopy
 * or floor) and its read-only catalogue export (`catalogue.json`, for
 * `sleep_pattern` and the nest phrases), plus `src/ark-scene/layers.json`
 * (the canopy modes and the diggers). Deterministic: no API, no network.
 *
 * Writes:
 * - `src/ark-scene/map/species.json` (bundled, compact): per Ark model slug
 *   its spawn tag, every tag it may stand on, its movement and attachment,
 *   its roost, its role and host group, and flags; the host groups; the
 *   launch points per tag and zone.
 * - `docs/ark-map/species.json`: the same with every reason (the phrase and
 *   the field it came from), not bundled.
 * - `docs/ark-map/report.md`: counts per area and launch point, holds.
 *
 * Decisions (the plan's recommendations, approved):
 * 1. One compact island, the cold cove on it (the terrain is the graphics lane's).
 * 2. The Antarctic 8 and the 4 sub-Antarctic rocky-coast penguins are held for a
 *    future southern island: not placed (they wait at the landing if aboard).
 * 3. Colonies: one Ark animal is one colony: a nest at its nest microhabitat
 *    (from its text), workers around it; it buds; workers are its prey strength.
 * 4. Hosts: oxpecker and remora ride, the grazer-followers walk beside, the
 *    clownfish in the anemone and the cleaners at the station (fixtures), the
 *    clients visit by day, parasites only near their hosts.
 * 5. No text: a zone fallback for those with a voyage zone; the rest held.
 * 6. About 480 launch points, by primary share, at least 8 an area.
 */
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {FRESH_TAGS, MAP_AREAS, MAP_ATTACHMENTS, MAP_MOVES, MAP_TAGS, SEA_TAGS, TAG_AREA, type HostGroup, type MapArea, type MapAttachment, type MapMove, type MapRole, type MapTag} from "../src/ark-scene/map/tags.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [inventoryPath, cataloguePath] = process.argv.slice(2);
if (!inventoryPath || !cataloguePath) throw new Error("usage: ark-map.mts <microhabitats.json> <catalogue.json>");

type Hit = {type: string; role: "primary" | "secondary"; field: string; phrase: string; match?: string | null; power_voice?: boolean};
type Species = {
    id: string; num: number; name: string; slug: string | null; zone: string | null; size: number | null;
    class: string | null; order: string | null; family: string | null; phylum: string | null; plan: string | null;
    realm: string[] | null; activity: string | null; sociality: string | null;
    microhabitats: Hit[]; spawn: string[]; flags: string[]; has_text: boolean; template_habitat_text: boolean; none_reason: string | null;
};
type Row = {id: string; name: string; typical_habitat: string | null; where_to_look: string | null; sleep_pattern: string | null; female_offspring_notes: string | null; interesting_facts: string | null; diet_summary: string | null};

const inventory = (JSON.parse(readFileSync(inventoryPath, "utf8")) as {species: Species[]}).species;
const catalogue = new Map(((JSON.parse(readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows).map((row) => [row.id, row]));
const layers = (JSON.parse(readFileSync(join(root, "src/ark-scene/layers.json"), "utf8")) as {species: Record<string, [string, string, string, string?]>}).species;

const isTag = (value: string): value is MapTag => (MAP_TAGS as readonly string[]).includes(value);
const clean = (text: unknown) => (Array.isArray(text) ? text.join(" ") : typeof text === "string" ? text : "").replace(/^\s*Native range keys:[^.]*\.\s*/i, "").trim();
/** A phrase as stored: the match and a few words either side (verbatim). */
function phraseAt(text: string, index: number, length: number): string {
    const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, index - 30)) + 1);
    let end = text.indexOf(" ", Math.min(text.length, index + length + 30));
    if (end < 0) end = text.length;
    return text.slice(start, end).trim();
}

/** A place named after a negation ("rather than underground") is not where it is. */
const NEGATED = /(?:not|never|rather than|instead of|avoid(?:s|ing)?|away from|without)\s+(?:\w+\s+){0,2}$/i;

// MARK: Holds and exclusions

/** Decision 2: the Antarctic ice species and the sub-Antarctic rocky-coast penguins, for a future southern island. */
const ANTARCTIC = new Set(["emperor-penguin", "adelie-penguin", "weddell-seal", "leopard-seal", "crocodile-icefish", "snow-petrel", "antarctic-petrel", "snowy-sheathbill", "king-penguin", "gentoo-penguin", "macaroni-penguin", "southern-rockhopper-penguin"]);
/** Host absent: the only host is a human (A11 excludes humans). */
const HOST_ABSENT = new Set(["head-louse"]);

// MARK: Partners (section 6), each from a stored phrase in the inventory's manual symbiosis pass

const RIDERS: Record<string, HostGroup> = {"red-billed-oxpecker": "grazers", "live-sharksucker": "sharks_rays_turtles"};
const BESIDE: Record<string, HostGroup> = {"cattle-egret": "grazers", "fork-tailed-drongo": "grazers", "western-yellow-wagtail": "grazers", "grey-crowned-crane": "grazers", "indian-pied-myna": "grazers", "abyssinian-ground-hornbill": "grazers"};
const ANEMONE_FISH = new Set(["ocellaris-clownfish"]);
const CLEANERS = new Set(["bluestreak-cleaner-wrasse", "scarlet-cleaner-shrimp", "caribbean-cleaner-goby", "gray-angelfish"]);
const CLIENTS = new Set(["reef-manta-ray", "giant-oceanic-manta-ray", "humphead-wrasse"]);
const PARASITES: Record<string, HostGroup> = {"tick": "mammals", "cayenne-tick": "horses_tapirs_cattle", "cat-flea": "cats_dogs", "chicken-mite": "birds", "medicinal-leech": "frogs", "sea-lamprey": "fish"};
const BROOD = new Set(["common-cuckoo", "pied-cuckoo", "greater-honeyguide", "cuckoo-wasp", "red-velvet-ant"]);
const GRAZER_NAMES = ["Cape Buffalo", "African Forest Buffalo", "Water Buffalo", "Giraffe", "Black Rhinoceros", "Indian Rhinoceros", "Javan Rhinoceros", "Sumatran Rhinoceros", "Plains Zebra", "Mountain Zebra", "Grevy's Zebra", "Blue Wildebeest", "Cow", "Ankole-Watusi Cattle"];

// MARK: Colonies (section 5): taxonomy, with the nest from the text

const SOCIAL_BEES = new Set(["giant-honey-bee", "asian-honey-bee", "western-honey-bee", "melipona-stingless-bee", "australian-stingless-bee", "vulture-bee", "bumblebee", "lasioglossum-albescens"]);
function colonyKind(s: Species): "ants" | "bees" | "wasps" | "termites" | null {
    if (s.family === "Formicidae") return "ants";
    if (s.slug && SOCIAL_BEES.has(s.slug)) return "bees";
    if ((s.family === "Vespidae" && s.slug !== "potter-wasp") || s.slug === "red-paper-wasp" || s.slug === "mexican-paper-wasp") return "wasps";
    if (s.family === "Termitidae" || s.family === "Rhinotermitidae" || s.family === "Kalotermitidae") return "termites";
    return null;
}
const COLONY_REASON = {ants: "taxonomy: Formicidae (ants)", bees: "taxonomy: a social bee (honey, stingless, bumble or sweat bee)", wasps: "taxonomy: a social wasp (hornet, yellowjacket or paper wasp)", termites: "taxonomy: Termitidae (termites)"};
/** Where a colony nests, from the first nest phrase in its text; else its kind's usual nest. */
const NEST_RULES: Array<[MapTag, RegExp]> = [
    ["termite_ant_mounds", /\bmounds?\b|\banthills?\b|\btermitaria\b/i],
    ["trunks_bark", /\b(?:hollow (?:trees?|trunks?|logs?)|tree (?:holes?|hollows?|cavit(?:y|ies))|cavities in trees|in trees? cavit|bark)\b/i],
    ["house", /\b(?:eaves|roofs?|buildings?|attics?|sheds?|walls of houses|under overhangs)\b/i],
    ["canopy", /\b(?:in (?:the )?(?:canopy|trees|branches|foliage|vegetation)|leaf nests?|hanging from branches|on branches|(?:hollow )?twigs|small branches|silk(?:ed)? leaves|high in trees)\b/i],
    ["logs_deadwood", /\b(?:dead wood|deadwood|rotting (?:wood|logs)|logs|stumps)\b/i],
    ["rocks_boulders", /\b(?:under (?:stones|rocks)|rock crevices|crevices)\b/i],
    ["burrows", /\b(?:old (?:mouse|rodent|vole) (?:nests|holes|burrows)|abandoned burrows|rodent burrows|burrows)\b/i],
    ["soil", /\b(?:underground|in the (?:soil|ground)|soil|ground nests?|below ground|nests? in (?:the )?ground)\b/i]
];
const NEST_DEFAULT: Record<"ants" | "bees" | "wasps" | "termites", MapTag> = {ants: "soil", bees: "trunks_bark", wasps: "house", termites: "termite_ant_mounds"};

// MARK: Movement and attachment

const FIXED_CLASSES = new Set(["Anthozoa", "Demospongiae", "Hexactinellida", "Calcarea", "Bivalvia", "Thecostraca", "Ascidiacea", "Crinoidea", "Hydrozoa?"]);
const DRIFTERS = /jelly|man o'? ?war|by-the-wind|sailor|salp|comb jelly|siphonophore/i;

function movement(s: Species, layerMode: string, spawn: MapTag): {move: MapMove; reason: string} {
    const slug = s.slug ?? "";
    if (layerMode === "perch" || layerMode === "climb" || layerMode === "leap" || layerMode === "hang") return {move: layerMode as MapMove, reason: `layers.json canopy mode: ${layerMode}`};
    if (layerMode === "dig") return {move: "burrow", reason: "layers.json: digs (underground)"};
    if (s.class && FIXED_CLASSES.has(s.class)) return {move: "fixed", reason: `taxonomy: ${s.class} (fixed to its surface)`};
    if (/barnacle|sponge|coral|sea anemone|sea pen|mussel|oyster|clam|tunicate|sea squirt/i.test(s.name) && !/crab|shrimp|fish|goby/i.test(s.name)) return {move: "fixed", reason: `name: ${s.name} (fixed to its surface)`};
    if (DRIFTERS.test(s.name) || s.class === "Scyphozoa" || s.class === "Cubozoa") return {move: "drift", reason: `name or taxonomy: ${s.name} drifts`};
    switch (s.plan) {
        case "flying_bird":
        case "bat":
        case "flying_insect":
            return {move: "fly", reason: `body plan: ${s.plan}`};
        case "fish":
            return {move: "swim", reason: "body plan: fish"};
        case "cephalopod_jelly":
            return {move: "swim", reason: "body plan: cephalopod"};
        case "insect":
        case "arachnid":
        case "crustacean":
            return {move: "crawl", reason: `body plan: ${s.plan}`};
        case "legless":
            return s.class === "Clitellata" ? {move: "burrow", reason: "taxonomy: Clitellata (earthworms and leeches)"} : {move: "slither", reason: "body plan: legless"};
        case "amphibian":
            return s.order === "Anura" ? {move: "hop", reason: "taxonomy: Anura (frogs and toads)"} : {move: "walk", reason: "body plan: amphibian"};
        case "turtle":
            return SEA_TAGS.has(spawn) || FRESH_TAGS.has(spawn) ? {move: "swim", reason: `body plan: turtle, spawns in water (${spawn})`} : {move: "walk", reason: "body plan: turtle on land"};
        case "primate":
            return {move: "climb", reason: "body plan: primate"};
        case "other":
            if (s.class === "Gastropoda" || s.class === "Asteroidea" || s.class === "Echinoidea" || s.class === "Holothuroidea" || s.class === "Polyplacophora" || s.class === "Ophiuroidea") return {move: "crawl", reason: `taxonomy: ${s.class}`};
            if (s.class === "Cephalopoda") return {move: "swim", reason: "taxonomy: Cephalopoda"};
            if (s.class === "Polychaeta" || s.class === "Clitellata") return {move: "burrow", reason: `taxonomy: ${s.class}`};
            if (SEA_TAGS.has(spawn)) return {move: "swim", reason: `body plan: other, spawns at sea (${spawn})`};
            return {move: "crawl", reason: "body plan: other"};
        default:
            // Quadrupeds, walking and flightless birds, lizards: they walk, or swim where they live in the sea.
            if ((s.class === "Mammalia" || s.plan === "flightless_bird") && SEA_TAGS.has(spawn) && slug !== "polar-bear") return {move: "swim", reason: `body plan: ${s.plan}, spawns at sea (${spawn})`};
            return {move: "walk", reason: `body plan: ${s.plan ?? "unknown"}`};
    }
}

/** What it stands on, from its spawn tag and its movement (the partners' and colonies' are set later). */
function attachment(tag: MapTag, move: MapMove, small: boolean): MapAttachment {
    if (tag === "open_sky") return "air";
    if (move === "fixed") return "fixed";
    if (tag === "sea_surface" || move === "drift") return SEA_TAGS.has(tag) ? "surface" : move === "drift" ? "surface" : "ground";
    if (SEA_TAGS.has(tag) && tag !== "sea_ice") return move === "swim" ? "water" : "floor";
    if (tag === "sea_ice") return move === "swim" ? "water" : "ice";
    if (FRESH_TAGS.has(tag) && move === "swim") return "water";
    if (tag === "canopy" || tag === "leaves" || tag === "bamboo" || tag === "host_nests") return "limb";
    if (tag === "trunks_bark") return small || move === "climb" || move === "fly" || move === "crawl" ? "trunk" : "ground";
    if (tag === "house") return "wall";
    if (tag === "flower_meadow" && small && (move === "fly" || move === "crawl")) return "flower";
    if (tag === "rocks_boulders" && small && move !== "fly") return "rock";
    if ((tag === "forest_floor" || tag === "logs_deadwood") && small && move !== "fly") return "litter";
    if ((tag === "pond" || tag === "garden_pond") && small && (move === "crawl" || move === "hop" || move === "walk")) return "surface";
    if (tag === "soil" || tag === "burrows") return "burrow";
    if ((tag === "sea_cliffs" || tag === "cliffs") && move === "fly") return "ledge";
    return "ground";
}

// MARK: Roosts (from `sleep_pattern`)

const ROOST_RULES: Array<[string, RegExp]> = [
    ["caves", /\b(?:caves?|caverns?|mines|tunnels in rock)\b/i],
    ["trunks_bark", /\b(?:tree (?:holes?|hollows?|cavit(?:y|ies))|hollow (?:trees?|logs?|trunks?)|holes in trees|woodpecker holes|nest ?boxes|under (?:loose )?bark|bark crevices)\b/i],
    ["house", /\b(?:roofs?|eaves|attics?|buildings?|houses|barns?|sheds?|church(?:es)?|bridges?|lofts?)\b/i],
    ["sea_ice", /\b(?:sea ice|ice floes?|on the ice|pack ice)\b/i],
    ["burrows", /\b(?:burrows?|dens?|underground|warrens?|setts?|lodges?|holes? (?:in|under) the ground|ground holes?|dug)\b/i],
    ["marsh_reeds", /\b(?:reeds?|reedbeds?|reed ?beds|rushes|sedges?|cattails?|papyrus)\b/i],
    ["mangrove", /\bmangroves?\b/i],
    ["coral", /\bcoral\b/i],
    ["kelp", /\bkelp\b/i],
    ["cliffs", /\b(?:cliffs?|ledges?|cliff faces?|rock faces?|gorges?)\b/i],
    ["rocks_boulders", /\b(?:rocks?|crevices?|boulders?|stones?|scree|rock piles?|rocky)\b/i],
    ["logs_deadwood", /\b(?:logs?|dead wood|deadwood|fallen (?:trees|timber|branches)|stumps?)\b/i],
    ["forest_floor", /\b(?:leaf litter|litter|forest floor|moss)\b/i],
    ["canopy", /\b(?:in (?:the )?trees|trees? at night|in (?:tall |dense |a |large )?trees?|tree ?tops|treetops|branch(?:es)?|canopy|foliage|perch(?:es|ed|ing)?|high in)\b/i],
    ["leaves", /\b(?:leaf|leaves|under (?:a )?leaf|folded leaf)\b/i],
    ["water", /\b(?:on the water|on (?:the )?(?:open )?(?:sea|ocean|lake|river|pond)s?|at sea|floating|rafts?|on open water|in the water|on water)\b/i],
    ["sand", /\b(?:buried in (?:the )?sand|in (?:the )?sand|sand)\b/i],
    ["mud", /\b(?:buried in (?:the )?mud|in (?:the )?mud|mud)\b/i],
    ["grassland", /\b(?:grass(?:es)?|tussocks?|grass heads)\b/i],
    ["scrub", /\b(?:shrubs?|bushes|thickets?|hedges?|undergrowth|dense vegetation|brush)\b/i],
    ["snow_ice", /\b(?:snow|snow burrows?)\b/i]
];

function resolveRoost(word: string, s: Species, spawn: MapTag, move: MapMove, allowed: Set<MapTag>): MapTag | null {
    const marine = SEA_TAGS.has(spawn) || (move === "swim" && !FRESH_TAGS.has(spawn));
    const coastal = marine || ["rocky_shore", "sea_cliffs", "sandy_beach", "estuary", "mudflat", "mangrove"].includes(spawn);
    switch (word) {
        case "coral":
            return marine ? "coral_reef" : null;
        case "kelp":
            return marine || coastal ? "kelp" : null;
        case "water":
            if (marine || coastal) return allowed.has("coastal_shallows") || !allowed.has("open_ocean") ? "coastal_shallows" : "open_ocean";
            return allowed.has("stream_river") && !allowed.has("lake") ? "stream_river" : allowed.has("pond") && !allowed.has("lake") ? "pond" : "lake";
        case "sand":
            return marine ? "seabed" : coastal ? "sandy_beach" : "desert_sand";
        case "mud":
            return marine || coastal ? "mudflat" : "marsh_reeds";
        case "rocks_boulders":
            return marine ? (spawn === "coral_reef" ? "coral_reef" : allowed.has("rocky_shore") ? "rocky_shore" : "seabed") : "rocks_boulders";
        case "cliffs":
            return coastal || allowed.has("sea_cliffs") ? "sea_cliffs" : marine ? null : "cliffs";
        case "caves":
            return marine ? "rocky_shore" : "caves";
        default:
            if (marine && !SEA_TAGS.has(word as MapTag) && word !== "mangrove") return null;
            return isTag(word) ? word : null;
    }
}

function roostOf(s: Species, row: Row | undefined, spawn: MapTag, move: MapMove, allowed: Set<MapTag>): {tag: MapTag; phrase: string} | null {
    const text = clean(row?.sleep_pattern ?? null);
    if (!text) return null;
    let best: {index: number; tag: MapTag; phrase: string} | null = null;
    for (const [word, pattern] of ROOST_RULES) {
        const global = new RegExp(pattern.source, "gi");
        for (let found = global.exec(text); found; found = global.exec(text)) {
            if (NEGATED.test(text.slice(Math.max(0, found.index - 40), found.index))) continue;
            const tag = resolveRoost(word, s, spawn, move, allowed);
            if (!tag) continue;
            if (!best || found.index < best.index) best = {index: found.index, tag, phrase: phraseAt(text, found.index, found[0].length)};
            break;
        }
    }
    return best ? {tag: best.tag, phrase: best.phrase} : null;
}

// MARK: Zone fallback (decision 5)

function zoneFallback(zone: string, s: {plan: string | null; slug: string | null}): MapTag {
    const canopy = s.slug ? layers[s.slug]?.[0] === "canopy" : false;
    switch (zone) {
        case "coral_reef": return "coral_reef";
        case "open_ocean": return "open_ocean";
        case "seashore": return s.plan === "fish" ? "coastal_shallows" : s.plan === "crustacean" || s.plan === "other" ? "rocky_shore" : "sandy_beach";
        case "river_lake": return s.plan === "fish" ? "stream_river" : "lake";
        case "wetland": return "marsh_reeds";
        case "rainforest":
        case "woodland": return canopy || s.plan === "flying_bird" ? "canopy" : "forest_floor";
        case "grassland": return "grassland";
        case "desert": return "desert_sand";
        case "mountains": return "mountain_alpine";
        case "polar": return "tundra";
        default: return "garden";
    }
}

// MARK: The table

type Entry = {
    slug: string; name: string; zone: string; spawn: MapTag; spawnReason: string; allowed: MapTag[];
    move: MapMove; moveReason: string; attach: MapAttachment; attachReason: string;
    roost: MapTag | null; roostReason: string | null; role: MapRole | null; host: HostGroup | null; roleReason: string | null;
    colony: null | {kind: string; nest: MapTag; reason: string; nestReason: string};
    flags: string; small: boolean;
};
const held: Array<{slug: string | null; name: string; reason: string}> = [];
const excluded: Array<{slug: string | null; name: string; reason: string}> = [];
const entries: Entry[] = [];
const bySlug = new Map(inventory.filter((s) => s.slug).map((s) => [s.slug!, s]));
const byName = new Map(inventory.map((s) => [s.name.toLowerCase(), s]));

for (const s of inventory) {
    const flags = s.flags ?? [];
    if (flags.some((flag) => flag.startsWith("exclude"))) {
        excluded.push({slug: s.slug, name: s.name, reason: flags.find((flag) => flag.startsWith("exclude"))!});
        continue;
    }
    if (!s.slug || !s.zone) {
        held.push({slug: s.slug, name: s.name, reason: s.has_text ? "no Ark model (no voyage_species row)" : "no field-guide text and no voyage zone (decision 5: held until Part 5 fills the gap)"});
        continue;
    }
    if (ANTARCTIC.has(s.slug)) {
        held.push({slug: s.slug, name: s.name, reason: "decision 2: Antarctic (ice or sub-Antarctic rocky coast), held for a future southern island"});
        continue;
    }
    if (HOST_ABSENT.has(s.slug)) {
        held.push({slug: s.slug, name: s.name, reason: "host absent: its only host is a human (A11)"});
        continue;
    }
    const row = catalogue.get(s.id);
    const small = typeof s.size === "number" && s.size <= 15;
    const layer = layers[s.slug];
    const layerMode = layer?.[1] ?? "";
    let spawn: MapTag;
    let spawnReason: string;
    const spawnTags = s.spawn.filter(isTag).filter((tag) => tag !== "forest_general");
    const fallback = !spawnTags.length;
    if (fallback) {
        spawn = zoneFallback(s.zone, s);
        spawnReason = `zone fallback (decision 5): ${s.none_reason ?? "no microhabitat"}; voyage zone ${s.zone}${layer ? `, layer ${layer[0]}` : ""}`;
    } else {
        spawn = spawnTags[0];
        const hit = s.microhabitats.find((h) => h.type === spawn || (h.type === "forest_general" && (spawn === "canopy" || spawn === "forest_floor")));
        spawnReason = hit ? `${hit.field}: "${hit.phrase}"${hit.type === "forest_general" ? ` (forest, layer: ${spawn})` : ""}` : `inventory spawn: ${spawn}`;
    }
    const allowed = new Set<MapTag>(fallback ? [spawn] : spawnTags);
    let {move, reason: moveReason} = movement(s, layerMode, spawn);
    // A walker whose place is the canopy climbs there (squirrels, tree snakes, tree frogs).
    if ((spawn === "canopy" || spawn === "leaves" || spawn === "bamboo") && (move === "walk" || move === "slither" || move === "hop")) {
        moveReason = `${moveReason}; lives in the ${spawn}, so it climbs`;
        move = "climb";
    }
    let attach = attachment(spawn, move, small);
    let attachReason = `spawn ${spawn}, ${move}${small ? ", small" : ""}`;
    let role: MapRole | null = null;
    let host: HostGroup | null = null;
    let roleReason: string | null = null;
    const phraseFor = (types: string[]) => s.microhabitats.find((h) => types.includes(h.type));
    if (RIDERS[s.slug]) {
        role = "rider";
        host = RIDERS[s.slug];
        const hit = phraseFor(["on_grazers", "attached_to_large"]);
        roleReason = hit ? `${hit.field}: "${hit.phrase}"` : "plan section 6";
    } else if (BESIDE[s.slug]) {
        role = "beside";
        host = BESIDE[s.slug];
        const hit = phraseFor(["on_grazers"]);
        roleReason = hit ? `${hit.field}: "${hit.phrase}"` : "plan section 6";
    } else if (ANEMONE_FISH.has(s.slug)) {
        role = "anemone";
        host = "anemone";
        spawn = "anemone";
        attach = "anemone";
        attachReason = "lives in the reef's anemone (a fixture)";
        const hit = phraseFor(["anemone"]);
        roleReason = hit ? `${hit.field}: "${hit.phrase}"` : "plan section 6";
    } else if (CLEANERS.has(s.slug)) {
        role = "cleaner";
        spawn = "cleaner_station";
        attach = "station";
        attachReason = "works the reef's cleaning station (a fixture)";
        const hit = phraseFor(["cleaner_station"]);
        roleReason = hit ? `${hit.field}: "${hit.phrase}"` : "plan section 6";
    } else if (CLIENTS.has(s.slug)) {
        role = "client";
        host = "station_clients";
        const hit = phraseFor(["cleaner_station"]);
        roleReason = hit ? `${hit.field}: "${hit.phrase}" (drifts to the station by day)` : "plan section 6";
    } else if (PARASITES[s.slug]) {
        role = "parasite";
        host = PARASITES[s.slug];
        const hit = phraseFor(["on_hosts", "on_grazers"]);
        roleReason = hit ? `${hit.field}: "${hit.phrase}" (shown near its host, never harms it)` : "plan section 6";
    } else if (BROOD.has(s.slug)) {
        role = "brood";
        const hit = phraseFor(["host_nests"]);
        roleReason = hit ? `${hit.field}: "${hit.phrase}" (an egg in a host's nest, visual only)` : "plan section 6";
    }
    allowed.add(spawn);
    // Colonies: the nest's tag from the text (or the kind's usual nest).
    let colony: Entry["colony"] = null;
    const kind = colonyKind(s);
    if (kind) {
        let nest: MapTag = NEST_DEFAULT[kind];
        let nestReason = `the usual nest of ${kind}`;
        const texts: Array<[string, string]> = [["typical_habitat", clean(row?.typical_habitat ?? null)], ["where_to_look", clean(row?.where_to_look ?? null)], ["female_offspring_notes", clean(row?.female_offspring_notes ?? null)], ["interesting_facts", clean(row?.interesting_facts ?? null)], ["sleep_pattern", clean(row?.sleep_pattern ?? null)]];
        let best: {index: number; field: string; tag: MapTag; phrase: string} | null = null;
        for (const [field, text] of texts) {
            // Only sentences about the nest (or the colony, hive, mound).
            for (const sentence of text.split(/(?<=[.;])\s+/)) {
                if (!/\b(?:nests?|nesting|colon(?:y|ies)|hives?|mounds?|combs?|flying in and out)\b/i.test(sentence)) continue;
                // The place named first in the sentence (not a negated one, not the wood they scrape for paper).
                if (/\bscrape\b|paper is made/i.test(sentence)) continue;
                for (const [tag, pattern] of NEST_RULES) {
                    const global = new RegExp(pattern.source, "gi");
                    for (let found = global.exec(sentence); found; found = global.exec(sentence)) {
                        if (NEGATED.test(sentence.slice(Math.max(0, found.index - 40), found.index))) continue;
                        if (!best || (best.field === field && found.index < best.index)) best = {index: found.index, field, tag, phrase: phraseAt(sentence, found.index, found[0].length)};
                        break;
                    }
                }
                if (best) break;
            }
            if (best) break;
        }
        if (best) {
            nest = best.tag;
            nestReason = `${best.field}: "${best.phrase}"`;
        }
        colony = {kind, nest, reason: COLONY_REASON[kind], nestReason};
        spawn = nest;
        allowed.add(nest);
        attach = "nest";
        attachReason = `a colony's nest at ${nest}`;
    }
    const roost = role === "anemone" || role === "cleaner" || colony ? null : roostOf(s, row, spawn, move, allowed);
    if (roost) allowed.add(roost.tag);
    let flagString = "";
    if (fallback) flagString += "z";
    if (s.template_habitat_text) flagString += "t";
    if (flags.includes("domestic")) flagString += "d";
    if (flags.includes("group_entry (no binomial)")) flagString += "g";
    entries.push({
        slug: s.slug, name: s.name, zone: s.zone, spawn, spawnReason, allowed: Array.from(allowed),
        move, moveReason, attach, attachReason,
        roost: roost && roost.tag !== spawn ? roost.tag : null, roostReason: roost ? `sleep_pattern: "${roost.phrase}"` : null,
        role, host, roleReason, colony, flags: flagString, small
    });
}

// Host groups: species ids (breeds count as their kind, A1) and slugs.
const idOf = (slug: string) => bySlug.get(slug)?.id;
const groupOf = (filter: (s: Species) => boolean) => inventory.filter((s) => s.slug && s.zone && filter(s) && !ANTARCTIC.has(s.slug));
const hostGroups: Record<HostGroup, Species[]> = {
    grazers: GRAZER_NAMES.map((name) => byName.get(name.toLowerCase())).filter((s): s is Species => Boolean(s)),
    sharks_rays_turtles: groupOf((s) => s.class === "Chondrichthyes" || s.class === "Elasmobranchii" || s.family === "Cheloniidae" || s.family === "Dermochelyidae"),
    anemone: groupOf((s) => s.slug === "magnificent-sea-anemone"),
    station_clients: [],
    horses_tapirs_cattle: groupOf((s) => s.family === "Tapiridae" || ["domestic-horse", "cow", "ankole-watusi-cattle", "water-buffalo"].includes(s.slug!)),
    cats_dogs: groupOf((s) => ["domestic-cat", "domestic-dog"].includes(s.slug!)),
    birds: groupOf((s) => s.slug === "domestic-chicken"),
    frogs: groupOf((s) => s.order === "Anura"),
    fish: groupOf((s) => s.plan === "fish"),
    mammals: []
};
hostGroups.mammals = Array.from(new Set([...hostGroups.grazers, ...hostGroups.horses_tapirs_cattle]));
for (const slug of [...Object.keys(RIDERS), ...Object.keys(BESIDE), ...Object.keys(PARASITES)]) if (!idOf(slug)) console.warn(`partner missing from the catalogue: ${slug}`);

// MARK: Launch points (decision 6): about 480, by primary share, at least 8 an area

const TARGET = 480;
const MIN_AREA = 8;
const perArea = new Map<MapArea, number>();
const perTagZone = new Map<MapTag, Map<string, number>>();
for (const entry of entries) {
    const area = TAG_AREA[entry.spawn];
    perArea.set(area, (perArea.get(area) ?? 0) + 1);
    const zones = perTagZone.get(entry.spawn) ?? new Map<string, number>();
    // In the water (swimmers, floaters, the sea floor's, the floes') or on dry ground: their points are apart.
    const wet = ["water", "floor", "surface", "ice", "anemone", "station"].includes(entry.attach) || (entry.attach === "fixed" && SEA_TAGS.has(entry.spawn));
    const key = wet ? `${entry.zone}~w` : entry.zone;
    zones.set(key, (zones.get(key) ?? 0) + 1);
    perTagZone.set(entry.spawn, zones);
}
const placed = entries.length;
let scale = TARGET / placed;
const areaPoints = new Map<MapArea, number>();
for (let i = 0; i < 40; i++) {
    let total = 0;
    for (const area of MAP_AREAS) {
        const n = Math.max(MIN_AREA, Math.round((perArea.get(area) ?? 0) * scale));
        areaPoints.set(area, n);
        total += n;
    }
    if (Math.abs(total - TARGET) <= 2) break;
    scale *= TARGET / total;
}
/** Within an area, its points by tag (largest remainder, at least 1 for a tag anyone spawns at), then by zone. */
const tagPoints: Record<string, Record<string, number>> = {};
for (const area of MAP_AREAS) {
    const tags = MAP_TAGS.filter((tag) => TAG_AREA[tag] === area && (perTagZone.get(tag)?.size ?? 0) > 0);
    const counts = tags.map((tag) => Array.from(perTagZone.get(tag)!.values()).reduce((a, b) => a + b, 0));
    const total = counts.reduce((a, b) => a + b, 0);
    const n = Math.max(areaPoints.get(area)!, tags.length);
    const shares = counts.map((count) => Math.max(1, Math.floor(count / Math.max(total, 1) * n)));
    let left = n - shares.reduce((a, b) => a + b, 0);
    const order = counts.map((count, i) => ({i, rest: count / Math.max(total, 1) * n - Math.floor(count / Math.max(total, 1) * n)})).sort((a, b) => b.rest - a.rest);
    for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) shares[order[k].i]++;
    for (let k = order.length - 1; left < 0 && k >= 0; k--) {
        if (shares[order[k].i] > 1) {
            shares[order[k].i]--;
            left++;
        }
    }
    areaPoints.set(area, shares.reduce((a, b) => a + b, 0));
    tags.forEach((tag, i) => {
        // By zone, at least one each, the rest by share.
        const zones = Array.from(perTagZone.get(tag)!.entries()).sort((a, b) => b[1] - a[1]);
        const byZone: Record<string, number> = {};
        const want = shares[i];
        const zoneTotal = zones.reduce((sum, [, c]) => sum + c, 0);
        let given = 0;
        for (const [zone, count] of zones) {
            if (given >= want) break;
            const k = Math.max(1, Math.round(count / zoneTotal * want));
            byZone[zone] = Math.min(k, want - given);
            given += byZone[zone];
        }
        if (given < want) byZone[zones[0][0]] += want - given;
        tagPoints[tag] = byZone;
    });
}

// MARK: Output

const tagIndex = (tag: MapTag) => MAP_TAGS.indexOf(tag);
const compact: Record<string, Array<string | number>> = {};
for (const entry of entries) {
    // [spawn, allowed (tag indices, "."), move, attach, roost, role, host, flags (+ c colony)]
    compact[entry.slug] = [
        tagIndex(entry.spawn),
        entry.allowed.map(tagIndex).join("."),
        MAP_MOVES.indexOf(entry.move),
        MAP_ATTACHMENTS.indexOf(entry.attach),
        entry.roost ? tagIndex(entry.roost) : -1,
        entry.role ?? "",
        entry.host ?? "",
        entry.flags + (entry.colony ? "c" : "") + (entry.small ? "s" : "")
    ];
}
const hostTable = Object.fromEntries(Object.entries(hostGroups).map(([group, list]) => [group, {ids: list.map((s) => s.id), slugs: list.map((s) => s.slug)}]));
const out = {
    about: "Generated by scripts/ark-map.mts from the B1 inventory (docs/ark/map-inventory.md). Rows: [spawn tag, allowed tags, move, attach, roost tag or -1, role, host group, flags]; tags, moves and attachments are indices into src/ark-scene/map/tags.ts. Flags: z zone fallback, t template text, d domestic, g group entry, c colony, s small. Reasons: docs/ark-map/species.json.",
    held: held.filter((h) => h.slug).map((h) => h.slug),
    hosts: hostTable,
    points: tagPoints,
    species: compact
};
writeFileSync(join(root, "src/ark-scene/map/species.json"), JSON.stringify(out).replace(/\],"/g, "],\n\"") + "\n");
mkdirSync(join(root, "docs/ark-map"), {recursive: true});
writeFileSync(join(root, "docs/ark-map/species.json"), JSON.stringify({held, excluded, hosts: Object.fromEntries(Object.entries(hostGroups).map(([g, l]) => [g, l.map((s) => s.name)])), species: entries}, null, 1) + "\n");

// The report.
const lines: string[] = [];
const count = (filter: (e: Entry) => boolean) => entries.filter(filter).length;
lines.push("# Ark map, B3/B4: the species table (generated)", "", "Generated by `scripts/ark-map.mts`. Every row's reasons are in `species.json` beside this file.", "");
lines.push(`- Catalogue species: ${inventory.length}. Placed: ${entries.length} (${count((e) => e.flags.includes("z"))} by the zone fallback). Held: ${held.length}. Excluded: ${excluded.length}.`);
lines.push(`- Launch points: ${Array.from(areaPoints.values()).reduce((a, b) => a + b, 0)} (target ${TARGET}, at least ${MIN_AREA} an area).`, "");
lines.push("| Area | Spawn tags (points) | Live here | of which small | Launch points |", "|---|---|---:|---:|---:|");
for (const area of MAP_AREAS) {
    const tags = MAP_TAGS.filter((tag) => TAG_AREA[tag] === area && tagPoints[tag]).map((tag) => `\`${tag}\` ${Object.values(tagPoints[tag]).reduce((a, b) => a + b, 0)}`).join(", ");
    lines.push(`| ${area} | ${tags} | ${count((e) => TAG_AREA[e.spawn] === area)} | ${count((e) => TAG_AREA[e.spawn] === area && e.small)} | ${areaPoints.get(area)} |`);
}
const tally = <K extends string>(key: (e: Entry) => K | null) => {
    const map = new Map<K, number>();
    for (const e of entries) {
        const k = key(e);
        if (k) map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ");
};
lines.push("", `**Movement:** ${tally((e) => e.move)}.`, "", `**Attachment:** ${tally((e) => e.attach)}.`, "");
lines.push(`**Roosts** (from \`sleep_pattern\`, where it sleeps differs from where it lives): ${count((e) => Boolean(e.roost))} species: ${tally((e) => e.roost)}.`, "");
lines.push(`**Colonies:** ${count((e) => Boolean(e.colony))} (${tally((e) => e.colony?.kind ?? null)}); nests: ${tally((e) => e.colony?.nest ?? null)}.`, "");
lines.push("| Colony | Kind | Nest | Why |", "|---|---|---|---|");
for (const e of entries.filter((x) => x.colony)) lines.push(`| ${e.name} | ${e.colony!.kind} | \`${e.colony!.nest}\` | ${e.colony!.nestReason.replace(/\|/g, "/")} |`);
lines.push("", "| Partner | Role | Host group | Phrase |", "|---|---|---|---|");
for (const e of entries.filter((x) => x.role)) lines.push(`| ${e.name} | ${e.role} | ${e.host ?? "—"} | ${(e.roleReason ?? "").replace(/\|/g, "/")} |`);
lines.push("", "Host groups: " + Object.entries(hostGroups).map(([g, l]) => `${g} ${l.length}`).join(", ") + ".", "");
lines.push("## Held (not placed)", "", "| Species | Why |", "|---|---|");
for (const h of held.filter((x) => x.slug)) lines.push(`| ${h.name} | ${h.reason} |`);
lines.push("", `Plus ${held.filter((x) => !x.slug).length} catalogue species with no Ark model at all (no voyage zone, no text): they cannot come aboard.`, "");
lines.push("## Excluded", "", ...excluded.map((x) => `- ${x.name}: ${x.reason}`), "");
lines.push("## Zone fallback (decision 5)", "", ...entries.filter((e) => e.flags.includes("z")).map((e) => `- ${e.name} (${e.zone}): \`${e.spawn}\``), "");
writeFileSync(join(root, "docs/ark-map/report.md"), lines.join("\n") + "\n");
console.log(`placed ${entries.length}, held ${held.length}, excluded ${excluded.length}; points ${Array.from(areaPoints.values()).reduce((a, b) => a + b, 0)}`);
console.log(Object.fromEntries(areaPoints));
