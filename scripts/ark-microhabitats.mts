#!/usr/bin/env -S npx tsx
/**
 * `src/ark-scene/microhabitats.json`: where on the island each small species
 * lives (docs/ark-micro.md, the owner's "small animals and microhabitats"
 * addendum). Deterministic, from stored text and taxonomy only: the exact
 * phrase that decided it is kept as the reason.
 *
 * The data is a read-only query of the live catalogue, run from the AnimalDex repo:
 *
 *   supabase db query --linked -o json "select vs.model_slug as slug, sp.display_name as name, vs.zone,
 *     (sp.canonical_game_stats->>'size')::int as size, fg.typical_habitat as habitat, fg.where_to_look as look,
 *     st.class_name as class, st.order_name as ord, st.family_name as family, st.phylum
 *     from voyage_species vs join species_profiles sp on sp.id = vs.species_profile_id
 *     left join species_field_guide fg on fg.species_profile_id = vs.species_profile_id
 *     left join species_taxonomy st on st.species_profile_id = vs.species_profile_id
 *     order by vs.model_slug" > catalogue-micro.json
 *
 *   npx tsx scripts/ark-microhabitats.mts catalogue-micro.json [report.json]
 *
 * Small: size stat at or below 15. On the catalogue's mass anchors (stats.ts)
 * 13 is 0.4 kg and 17 is 1 kg, so 15 is about 0.6 kg: a brown rat. That is
 * where the scene's drawn length (1.2 · L^0.6) reaches twice the true length
 * (L 0.28 m, drawn 0.56 m): from there down, drawing an animal true to size
 * against a wall, a trunk or a flower makes a visible difference.
 *
 * Spots, in order:
 * 1. house: the cottage at Home. Domestic animals (a cat, a dog, a house
 *    sparrow, a house mouse and the other pets below), whatever their size,
 *    live around it. A small one of the Home zone whose text names a
 *    building anywhere (walls, roofs, houses, lit windows, lights at
 *    night...) lives on it; one of another zone only when a building is the
 *    first place its text names.
 * 2. otherwise the spot whose phrase comes first in `typical_habitat` (the
 *    range keys dropped), then in `where_to_look`: house, bark, flowers,
 *    rocks, leaf_litter, pond_surface. Each spot only takes the classes that can
 *    live on it (no bird on leaf litter, no fish on the pond's surface), and
 *    nothing of the open sea or the reef takes a spot at all.
 * 3. none: the animal stands in its zone as before.
 *
 * Rows: [spot, reason] or [spot, reason, flags] where flags is a string of
 * letters: m a moth (to the porch light at night), c a clinger (crawls on its
 * surface), r a rig that passed (`~/animaldex-talking-models/rig/manifest.json`),
 * a on the ground around the house, o on its roof (else on its walls).
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2];
const reportPath = process.argv[3];
if (!input) throw new Error("usage: ark-microhabitats.mts <query output json> [report json]");

type Row = {slug: string; name: string | null; zone: string; size: number | null; habitat: string | null; look: string | null; class: string | null; ord: string | null; family: string | null; phylum: string | null};
const raw = JSON.parse(readFileSync(input, "utf8")) as {rows: Row[]} | Row[];
const rows = (Array.isArray(raw) ? raw : raw.rows).slice().sort((a, b) => a.slug.localeCompare(b.slug));

export const SMALL_SIZE = 15;
const SPOTS = ["house", "bark", "flowers", "rocks", "leaf_litter", "pond_surface"] as const;
type Spot = typeof SPOTS[number] | "none";

/** Pets and house-dwellers that live around the cottage, whatever their size (the owner's list: cats, dogs, house sparrows, mice). */
const DOMESTIC = new Set(["domestic-cat", "domestic-dog", "house-sparrow", "house-mouse", "domestic-canary", "domestic-ferret", "domestic-pigeon", "house-finch", "house-wren"]);

/** The sea and the reef keep their own: nothing there takes a land spot. */
const SEA_ZONES = new Set(["coral_reef", "open_ocean"]);

const INVERTEBRATE_LAND = ["Insecta", "Arachnida", "Chilopoda", "Diplopoda", "Gastropoda", "Collembola", "Clitellata", "Malacostraca", "Entognatha"];
const ALLOWED: Record<Exclude<Spot, "none">, (row: Row) => boolean> = {
    house: (row) => !["Actinopterygii", "Chondrichthyes"].includes(row.class ?? ""),
    // Birds on bark only if they forage there (woodpeckers, nuthatches, treecreepers, woodcreepers); squirrels and dormice climb it.
    bark: (row) => [...INVERTEBRATE_LAND, "Squamata", "Amphibia"].includes(row.class ?? "")
        || (row.class === "Aves" && ["Picidae", "Sittidae", "Certhiidae", "Climacteridae", "Dendrocolaptidae"].includes(row.family ?? ""))
        || (row.class === "Mammalia" && ["Sciuridae", "Gliridae"].includes(row.family ?? "")),
    // Flowers: insects and spiders, and the nectar birds that hover at them.
    flowers: (row) => ["Insecta", "Arachnida"].includes(row.class ?? "") || (row.class === "Aves" && ["Trochilidae", "Nectariniidae"].includes(row.family ?? "")),
    rocks: (row) => [...INVERTEBRATE_LAND, "Squamata", "Amphibia"].includes(row.class ?? "") || (row.class === "Mammalia" && ["Ochotonidae", "Procaviidae", "Sciuridae", "Muridae", "Cricetidae"].includes(row.family ?? "")),
    leaf_litter: (row) => [...INVERTEBRATE_LAND, "Squamata", "Amphibia"].includes(row.class ?? "") || (row.class === "Mammalia" && ["Soricidae", "Talpidae", "Erinaceidae"].includes(row.family ?? "")),
    // The pond's surface film and lily pads: insects, spiders, frogs, snails. Fish swim under it, in their own zone.
    // (Spiders only the fishing and raft spiders that hunt on it.)
    pond_surface: (row) => (["Insecta", "Amphibia", "Gastropoda"].includes(row.class ?? "") && !["Lepidoptera", "Hymenoptera"].includes(row.ord ?? "")) || (row.class === "Arachnida" && row.family === "Pisauridae")
};

const PATTERNS: Record<Exclude<Spot, "none">, RegExp> = {
    house: /\b(?:houses?|homes\b|human (?:homes|dwellings|habitation|structures)|dwellings?|buildings\b|(?<!(?:rock|stone|cave|canyon|cliff|gorge|tree|garden|dry-stone|dry stone|mountain|harbour|harbor|sea|quarry|limestone)[\s-])walls?\b(?! lizards?)|ceilings?|roofs?|rooftops?|roof (?:spaces|tiles)|eaves|porch(?:es)?|verandas?|attics?|sheds?|outbuildings?|garages?|cellars?|basements?|indoors|man-made structures|artificial lights?|(?<!away from )(?:street|porch|outdoor|house|electric|security) ?lights?|lights at night|(?<!away from |street |the )lights\b|lamps?|lit (?:windows|walls|porches|buildings)|(?<!wing )windows\b|window ?(?:sills?|frames)|kitchens?|pantries|bathrooms?|stored (?:grain|food|products)|wardrobes?|closets?)/i,
    bark: /\b(?:bark|tree ?trunks?|trunks|on trees|tree holes?|tree hollows?|tree cavit(?:y|ies)|tree crevices|dead (?:trees|wood|branches|timber)|standing deadwood|deadwood|snags|tree stumps?|stumps)\b/i,
    flowers: /\b(?:flowers?|flowering|blossoms?|blooms?|blooming|nectar|wildflowers?|flower-rich)\b/i,
    rocks: /\b(?:rocks?|rocky|stones?|stony|boulders?|crevices|cliffs?|scree|outcrops?|stone walls?|rock walls?|talus|ledges)\b/i,
    leaf_litter: /\b(?:leaf ?litter|leaf-litter|litter|fallen leaves|dead leaves|forest floor|woodland floor|under logs|rotting (?:logs|wood|leaves|vegetation)|decaying (?:logs|wood|leaves|vegetation|matter|plant matter)|logs|compost|moss|mossy|soil|ground cover|undergrowth|humus|mulch|damp ground)\b/i,
    pond_surface: /\b(?:pond surface|surface of (?:still |slow |calm |quiet )?(?:ponds?|pools?|water|lakes?|streams?)|water surface|water's surface|surface film|floating (?:vegetation|plants|leaves)|lily ?pads?|ponds?|garden ponds?)\b/i
};

const BUTTERFLY_FAMILIES = new Set(["Papilionidae", "Nymphalidae", "Pieridae", "Lycaenidae", "Hesperiidae", "Riodinidae", "Hedylidae"]);
const isMoth = (row: Row) => row.ord === "Lepidoptera" && !BUTTERFLY_FAMILIES.has(row.family ?? "");

/** The text that says where it lives: the range keys dropped. */
function habitatText(value: string | null): string {
    return (value ?? "").replace(/^\s*Native range keys:[^.]*\.\s*/i, "").trim();
}

function usable(text: string): boolean {
    return text.length >= 12 && !/^(?:not documented|unknown|n\/a)\.?$/i.test(text);
}

/** The phrase as stored: the match and a few words either side. */
function phraseAt(text: string, index: number, length: number): string {
    const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, index - 28)) + 1);
    let end = text.indexOf(" ", Math.min(text.length, index + length + 28));
    if (end < 0) end = text.length;
    return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

type Result = {spot: Spot; reason: string; field: "habitat" | "look" | "taxonomy" | "none"; match: string; flags: string};

function classify(row: Row, rigPassed: Set<string>): Result | null {
    const domestic = DOMESTIC.has(row.slug);
    const small = typeof row.size === "number" && row.size <= SMALL_SIZE;
    if (!domestic && !small) return null;
    const flags = (spot: Spot) => {
        let f = "";
        if (isMoth(row)) f += "m";
        if (spot !== "none" && spot !== "flowers" && spot !== "pond_surface" && ["Insecta", "Arachnida", "Chilopoda", "Diplopoda", "Squamata", "Gastropoda", "Malacostraca"].includes(row.class ?? "") && !isMoth(row)) f += "c";
        if (rigPassed.has(row.slug)) f += "r";
        // At the house: mammals (bats excepted) and frogs on the ground around it, birds on the roof, the rest on the walls.
        if (spot === "house" && ((row.class === "Mammalia" && row.ord !== "Chiroptera") || row.class === "Amphibia")) f += "a";
        if (spot === "house" && row.class === "Aves") f += "o";
        return f;
    };
    if (domestic) return {spot: "house", reason: `domestic: ${row.name ?? row.slug} (around the house)`, field: "taxonomy", match: "domestic", flags: flags("house")};
    if (SEA_ZONES.has(row.zone)) return {spot: "none", reason: `zone ${row.zone}: stays at sea`, field: "none", match: "", flags: ""};
    const fields: Array<["habitat" | "look", string]> = [["habitat", habitatText(row.habitat)], ["look", habitatText(row.look)]];
    for (const [field, text] of fields) {
        if (!usable(text)) continue;
        let best: {spot: Spot; index: number; match: string} | null = null;
        let first = Infinity;
        for (const spot of SPOTS) {
            const found = PATTERNS[spot].exec(text);
            if (!found) continue;
            if (spot !== "house") first = Math.min(first, found.index);
            // Away from Home, the house only when a building is the first place named, by any spot (the cottage is at Home, not in their zone).
            if (spot === "house" && row.zone !== "farm_garden" && found.index > first) continue;
            if (!ALLOWED[spot](row)) continue;
            if (!best || found.index < best.index) best = {spot, index: found.index, match: found[0]};
        }
        if (best?.spot === "house" && row.zone !== "farm_garden" && best.index > first) best = null;
        // At Home a building wins wherever it is named: those that live with people live at the house.
        const house = row.zone === "farm_garden" ? PATTERNS.house.exec(text) : null;
        if (house && ALLOWED.house(row)) best = {spot: "house", index: house.index, match: house[0]};
        if (best) return {spot: best.spot, reason: `${field}: "${phraseAt(text, best.index, best.match.length)}"`, field, match: best.match, flags: flags(best.spot)};
    }
    // A moth at Home with nothing better: to the porch light.
    if (isMoth(row) && row.zone === "farm_garden") return {spot: "house", reason: "taxonomy: a moth (Lepidoptera, not a butterfly family) in the Home zone", field: "taxonomy", match: "moth", flags: flags("house")};
    const any = fields.some(([, text]) => usable(text));
    return {spot: "none", reason: any ? "no spot phrase in the stored text" : "no usable habitat text", field: "none", match: "", flags: ""};
}

// Rigs that passed their checks (the clips themselves are not published to the scene yet).
const rigPassed = new Set<string>();
const manifestPath = join(homedir(), "animaldex-talking-models/rig/manifest.json");
if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {species: Record<string, {state?: string}>};
    for (const [slug, entry] of Object.entries(manifest.species ?? {})) if (entry.state === "passed") rigPassed.add(slug);
}

const species: Record<string, [string, string] | [string, string, string]> = {};
const report: Record<string, Array<{slug: string; name: string | null; zone: string; size: number | null; class: string | null; reason: string}>> = {};
let small = 0;
let noText = 0;
for (const row of rows) {
    const result = classify(row, rigPassed);
    if (!result) continue;
    small++;
    if (result.reason === "no usable habitat text") noText++;
    (report[result.reason === "no usable habitat text" ? "no_text" : result.spot] ??= []).push({slug: row.slug, name: row.name, zone: row.zone, size: row.size, class: row.class, reason: result.reason});
    if (result.spot === "none") continue;
    species[row.slug] = result.flags ? [result.spot, result.reason, result.flags] : [result.spot, result.reason];
}

const out = join(root, "src/ark-scene/microhabitats.json");
writeFileSync(out, JSON.stringify({
    about: `Generated by scripts/ark-microhabitats.mts from the live catalogue. Small = size stat <= ${SMALL_SIZE} (or domestic). Rows: [spot, reason] or [spot, reason, flags]; flags: m moth, c clinger, r rig passed, a around the house, o on its roof.`,
    small: SMALL_SIZE,
    species
}).replace(/\],"/g, "],\n\"") + "\n");
const counts = Object.fromEntries(Object.entries(report).map(([key, list]) => [key, list.length]));
console.log(`${small} small or domestic species of ${rows.length}; ${noText} with no usable habitat text`);
console.log(JSON.stringify(counts));
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 1));
