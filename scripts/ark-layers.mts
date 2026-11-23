#!/usr/bin/env -S npx tsx
/**
 * `src/ark-scene/layers.json`: each species' layer of the Ark (docs/ark-micro.md,
 * "Layers": the owner's vertical-layers addendum). Deterministic, from stored
 * data only, the deciding phrase kept as the reason:
 *
 * - the zone (`voyage_species.zone`) and the realm from the traits lane
 *   (`scratchpad/ark/traits.json`, `realm` + `realm_phrase`);
 * - the body plan (`~/animaldex-talking-models/rig/plans.json`);
 * - `species_field_guide.typical_habitat`, `where_to_look`, `sleep_pattern`;
 * - taxonomy (class, order, family).
 *
 * The data is a read-only query of the live catalogue, run from the AnimalDex repo:
 *
 *   supabase db query --linked -o json "select vs.model_slug as slug, vs.species_profile_id as spid,
 *     sp.display_name as name, vs.zone, (sp.canonical_game_stats->>'size')::int as size,
 *     fg.typical_habitat as habitat, fg.where_to_look as look, fg.sleep_pattern as sleep,
 *     fg.signature_traits::text as traits_text, fg.interesting_facts::text as facts,
 *     fg.diet_summary::text as diet, fg.species_spotlight::text as spotlight,
 *     st.class_name as class, st.order_name as ord, st.family_name as family
 *     from voyage_species vs join species_profiles sp on sp.id = vs.species_profile_id
 *     left join species_field_guide fg on fg.species_profile_id = vs.species_profile_id
 *     left join species_taxonomy st on st.species_profile_id = vs.species_profile_id
 *     order by vs.model_slug" > catalogue-layers.json
 *
 *   npx tsx scripts/ark-layers.mts catalogue-layers.json traits.json plans.json [report.json] [depth-report.json]
 *
 * It also writes `src/ark-scene/depth-bands.json`, every water species'
 * depth band (see "Depth bands" below).
 *
 * Layers (first that applies):
 * - sea: the reef and the open ocean's zones. `deep` when the text puts it in
 *   deep water (deep sea, abyssal, midwater, twilight zone...), with `g` when
 *   the text says it glows (bioluminescent, light organs, photophores);
 *   `reef` for the reef's zone (bottom-dwellers, crabs, octopus, stars: `floor`);
 *   `open_sea` for the open ocean (`filter` for the plankton feeders: mantas,
 *   whale and basking sharks, baleen whales).
 * - underground: its text says it lives underground (underground,
 *   subterranean, fossorial, tunnels), or a family that does (moles,
 *   mole-rats, golden moles, pocket gophers).
 * - canopy: its text puts it in trees before it names the ground (canopy,
 *   treetops, arboreal, in trees, branches, perches; for a mammal, a reptile
 *   or a frog only a plain "arboreal", "canopy", "treetops", "lives in trees"
 *   in its habitat, never "browses low branches"), for a class that lives
 *   up there: birds that fly (perch), primates (climb; gibbons and lemurs
 *   leap), sloths and bats (hang), tree-living mammals, lizards, snakes and
 *   frogs (climb).
 * - ground: the rest. A ground animal whose text says it digs or lives in a
 *   burrow gets the flag `b`: its burrow's entrance is drawn by it.
 *
 * Rows: [layer, mode, reason] or [layer, mode, reason, flags] (b a burrow by it,
 * g glows at night, p a primate).
 */
import {readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [input, traitsPath, plansPath, reportPath, depthReportPath] = process.argv.slice(2);
if (!input || !traitsPath || !plansPath) throw new Error("usage: ark-layers.mts <catalogue json> <traits.json> <plans.json> [report json]");

type Row = {slug: string; spid: string; name: string | null; zone: string; size: number | null; habitat: string | null; look: string | null; sleep: string | null; class: string | null; ord: string | null; family: string | null;
    /** The species text the depth bands also read (absent from older catalogue files). */
    traits_text?: string | null; facts?: string | null; diet?: string | null; spotlight?: string | null};
const raw = JSON.parse(readFileSync(input, "utf8")) as {rows: Row[]} | Row[];
// (A species with no model yet has no slug: it is not drawn.)
const rows = (Array.isArray(raw) ? raw : raw.rows).filter((row) => row.slug).sort((a, b) => a.slug.localeCompare(b.slug));
const traits = new Map((JSON.parse(readFileSync(traitsPath, "utf8")) as {traits: Array<{species_profile_id: string; realm?: string[] | null; realm_phrase?: string | null}>}).traits.map((t) => [t.species_profile_id, t]));
const plans = (JSON.parse(readFileSync(plansPath, "utf8")) as {species: Record<string, {plan: string; talking_plan?: string}>}).species;

export type Layer = "canopy" | "ground" | "underground" | "reef" | "open_sea" | "deep";

const text = (value: string | null) => (value ?? "").replace(/^\s*Native range keys:[^.]*\.\s*/i, "").trim();
const usable = (value: string) => value.length >= 12;

function phraseAt(value: string, index: number, length: number): string {
    const start = Math.max(0, value.lastIndexOf(" ", Math.max(0, index - 28)) + 1);
    let end = value.indexOf(" ", Math.min(value.length, index + length + 28));
    if (end < 0) end = value.length;
    return `${start > 0 ? "…" : ""}${value.slice(start, end).trim()}${end < value.length ? "…" : ""}`;
}

const DEEP = /\b(?:deep[- ]sea|deep[- ]water|deep waters|deep ocean|ocean depths|abyss(?:al)?|bathyal|bathypelagic|mesopelagic|midwater|mid-water|twilight zone|hadal|hydrothermal vents?|continental slopes?|seamounts?)\b/i;
const GLOW = /\b(?:bioluminescen\w*|light[- ]organs?|photophores?|luminous organs?|glows? in the dark|glowing points|produces? (?:its own )?light)\b/i;
const FLOOR_PLANS = new Set(["crustacean", "other"]);
const FLOOR_CLASSES = new Set(["Malacostraca", "Asteroidea", "Echinoidea", "Holothuroidea", "Ophiuroidea", "Gastropoda", "Bivalvia", "Anthozoa", "Polychaeta", "Crinoidea"]);
const FILTER = /(?:^|-)(?:manta|mobula|whale-shark|basking-shark|blue-whale|fin-whale|humpback|right-whale|bowhead|minke|sei-whale|brydes|gray-whale|grey-whale)(?:-|$)/;
const OCTOPUS = /(?:^|-)(?:octopus)(?:-|$)/;

/** Underground only when the text says the animal itself lives there ("lives underground", "fossorial", "digs tunnels"), not a place it lists ("wet tunnels"). */
const UNDERGROUND = /\b(?:lives? (?:mostly |almost entirely )?underground|living underground|(?:spends?|spent) (?:most of (?:its|their) (?:life|lives|time) )?underground|subterranean|fossorial|digs? (?:its own |long |extensive )?tunnels|tunnel systems? (?:it|they) digs?|underground (?:tunnels|burrow systems|colonies|life))\b/i;
const UNDERGROUND_FAMILIES = new Set(["Talpidae", "Bathyergidae", "Spalacidae", "Chrysochloridae", "Geomyidae", "Notoryctidae", "Ctenomyidae", "Caeciliidae", "Amphisbaenidae", "Megascolecidae", "Lumbricidae", "Gryllotalpidae"]);
const UNDERGROUND_CLASSES = new Set(["Mammalia", "Amphibia", "Squamata", "Clitellata", "Insecta"]);
/** A burrow of its own: the animal digs, or lives, rests, sleeps or nests in burrows (not a list of places that has "burrows" in it). */
const BURROW = /\b(?:digs?|digging|dug|burrowing|burrow-dwelling|warrens?|(?:lives?|living|rests?|resting|sleeps?|sleeping|shelters?|sheltering|nests?|nesting|roosts?|hides?|spends? the day|spent) (?:\w+ ){0,3}in (?:its own |their own |a |their |its |old |abandoned )?(?:\w+ )?burrows?|(?:its|their) (?:own )?burrows?)\b/i;
const BURROW_CLASSES = new Set(["Mammalia", "Squamata", "Amphibia", "Testudines", "Aves", "Malacostraca"]);

const TREES = /\b(?:canopy|canopies|treetops?|tree tops|arboreal|in (?:the )?trees|among (?:the )?trees|tree branches|branches|perch(?:es|ing)?|tree-dwelling|trees? holes?|roosts? in trees|climbs? trees|in tall trees|forest trees)\b/i;
/** Mammals, reptiles and frogs need a plainer statement: they live in the trees (not "browses low branches"). */
const ARBOREAL = /\b(?:canopy|canopies|treetops?|tree tops|arboreal|tree-dwelling|lives? in (?:the )?trees|in the trees|climbs? trees|high in trees|forest canopy)\b/i;
const GROUND_FIRST = /\b(?:terrestrial|on the ground|ground-dwelling|forest floor|on the floor|open ground|grassland|savannas?|plains?|deserts?)\b/i;

type Result = {layer: Layer; mode: string; reason: string; flags: string; confident: boolean};

function classify(row: Row): Result {
    const plan = plans[row.slug]?.plan ?? null;
    const trait = traits.get(row.spid);
    const realm = trait?.realm ?? null;
    const fields: Array<[string, string]> = [["habitat", text(row.habitat)], ["look", text(row.look)], ["sleep", text(row.sleep)]];
    const find = (pattern: RegExp, only?: string[]) => {
        for (const [field, value] of fields) {
            if (only && !only.includes(field)) continue;
            if (!usable(value)) continue;
            const found = pattern.exec(value);
            if (found) return {field, value, index: found.index, match: found[0]};
        }
        return null;
    };
    const say = (hit: {field: string; value: string; index: number; match: string}) => `${hit.field}: "${phraseAt(hit.value, hit.index, hit.match.length)}"`;
    const anyText = fields.some(([, value]) => usable(value));

    // The sea.
    if (row.zone === "coral_reef" || row.zone === "open_ocean") {
        // Deep only from where it lives (`typical_habitat`), never from where people watch it ("from boats crossing deep water").
        const deep = find(DEEP, ["habitat"]);
        const glow = find(GLOW);
        if (deep) return {layer: "deep", mode: "swim", reason: say(deep), flags: glow ? "g" : "", confident: true};
        const floor = FLOOR_CLASSES.has(row.class ?? "") || (plan !== null && FLOOR_PLANS.has(plan) && row.class !== "Cephalopoda") || OCTOPUS.test(row.slug);
        if (row.zone === "coral_reef") return {layer: "reef", mode: FILTER.test(row.slug) ? "filter" : floor ? "floor" : "swim", reason: `zone coral_reef${floor ? `, ${row.class ?? plan} on the floor` : ""}`, flags: glow ? "g" : "", confident: true};
        return {layer: "open_sea", mode: FILTER.test(row.slug) ? "filter" : floor ? "floor" : "swim", reason: `zone open_ocean${FILTER.test(row.slug) ? ", a plankton feeder" : ""}`, flags: glow ? "g" : "", confident: true};
    }
    const cls = row.class ?? "";
    // Underground.
    // (Desmans are moles that swim: not underground.)
    if (UNDERGROUND_FAMILIES.has(row.family ?? "") && !/desman/.test(row.slug)) return {layer: "underground", mode: "dig", reason: `taxonomy: ${row.family}`, flags: "", confident: true};
    const under = UNDERGROUND_CLASSES.has(cls) ? find(UNDERGROUND, ["habitat"]) : null;
    if (under && !(cls === "Insecta" && !/mole|cicada|cricket|beetle larva|grub/i.test(row.name ?? ""))) return {layer: "underground", mode: "dig", reason: say(under), flags: "", confident: true};
    // The canopy: in trees before the ground is named.
    const flies = plan === "flying_bird" || plan === "bat";
    const canClimb = cls === "Aves" ? flies : ["Mammalia", "Squamata", "Amphibia"].includes(cls);
    if (canClimb && !(realm && realm.length === 1 && (realm[0] === "sea" || realm[0] === "fresh"))) {
        const trees = cls === "Aves" ? find(TREES, ["habitat", "look"]) : find(ARBOREAL, ["habitat"]);
        const ground = trees ? GROUND_FIRST.exec(trees.value) : null;
        const sloth = row.family === "Bradypodidae" || row.family === "Choloepidae" || row.family === "Megalonychidae";
        if (sloth) return {layer: "canopy", mode: "hang", reason: `taxonomy: ${row.family} (a sloth)`, flags: "", confident: true};
        if (trees && (!ground || ground.index > trees.index)) {
            const mode = cls === "Aves" ? "perch"
                : row.ord === "Chiroptera" ? "hang"
                : row.family === "Hylobatidae" || ["Lemuridae", "Indriidae", "Lepilemuridae", "Cheirogaleidae"].includes(row.family ?? "") ? "leap"
                : "climb";
            return {layer: "canopy", mode, reason: say(trees), flags: row.ord === "Primates" ? "p" : "", confident: true};
        }
    }
    // The ground; a burrow by it when its text says it digs or lives in one.
    // Its own burrow: from where it lives or sleeps, not from what a watcher sees by it ("basking near a burrow mouth").
    const burrow = BURROW_CLASSES.has(cls) ? find(BURROW, ["habitat", "sleep"]) : null;
    return {layer: "ground", mode: "", reason: burrow ? say(burrow) : anyText ? "no tree, burrow or sea phrase" : "no usable text (on the ground by default)", flags: burrow ? "b" : "", confident: anyText};
}

const species: Record<string, string[]> = {};
const report: Record<string, Array<{slug: string; name: string | null; zone: string; class: string | null; mode: string; reason: string}>> = {};
for (const row of rows) {
    const result = classify(row);
    const key = result.layer === "ground" && !result.confident ? "no_data" : result.layer === "ground" && result.flags.includes("b") ? "ground_burrow" : result.layer;
    (report[key] ??= []).push({slug: row.slug, name: row.name, zone: row.zone, class: row.class, mode: result.mode, reason: result.reason});
    if (result.layer === "ground" && !result.flags) continue;
    species[row.slug] = result.flags ? [result.layer, result.mode, result.reason, result.flags] : [result.layer, result.mode, result.reason];
}
const out = join(root, "src/ark-scene/layers.json");
writeFileSync(out, JSON.stringify({
    about: "Generated by scripts/ark-layers.mts from the live catalogue, the traits lane and the rig body plans. Rows: [layer, mode, reason] or [layer, mode, reason, flags] (b a burrow by it, g glows at night, p a primate). Species not listed are on the ground.",
    species
}).replace(/\],"/g, "],\n\"") + "\n");
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([key, list]) => [key, list.length]))));
if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 1));

// MARK: Depth bands

/*
 * Depth bands (the owner's sea-depth fix, 2026-11-11): where in the water
 * column each water species lives, from the same stored data, the deciding
 * phrase (or the taxonomy, the body plan or the zone) kept as the reason.
 *
 * A water species: every species of the reef's and the open ocean's zones;
 * a species of any zone whose body cannot leave the water (fish, flatfish,
 * whales and sea cows, jellyfish, cephalopods, true eels; not the fish that
 * walk on the mud); a sea otter; the lake's swimming birds (ducks, grebes,
 * divers) and its bottom-dwelling invertebrates (crayfish, snails, mussels).
 * The shore's seals, penguins and crabs and the lake's frogs and otters stay
 * on land: they are not water species here.
 *
 * Salt or fresh: from the realm (traits lane), the zone when the realm names
 * both or neither. Its home: its own zone's water (the reef, the open ocean),
 * the lake (fresh), or the sea off its zone's coast (salt from a land zone).
 *
 * Salt bands, first that applies:
 * - deep: the layers' deep, when its habitat names deep water itself (not only a slope or a seamount),
 *   never an air-breather; `f` when it lives on the deep floor;
 * - surface: a seabird or a sea otter (floats), or its text says it floats or lives at the surface;
 * - seabed: crabs, lobsters, shrimps, stars, urchins, sea cucumbers, snails, clams, anemones,
 *   horseshoe crabs, flatfish, rays that rest on the bottom (not mantas, devil and eagle rays),
 *   or its text puts it on the bottom (seabed, sea floor, benthic, demersal, buries in sand);
 * - reef: the reef's zone, and a coast fish whose text names reefs, rocks, kelp or tide pools;
 *   flag `c` (in a crevice, a hole or a den) for octopus, moray and other true eels, or text;
 * - upper: whales, dolphins, sea cows, turtles, seals, penguins, mantas, tuna, billfish, the big
 *   sharks, flying fish, sunfish, dolphinfish; or its text says surface waters, epipelagic, near the surface;
 * - mid: jellyfish, or its text says schools, shoals or mid-water; the rest by default (flagged).
 * Fresh bands: pond_surface (ducks, grebes, divers, or the text), pond_bed (crayfish, snails, mussels,
 * catfish, loaches, sturgeons, or the text: bottom, riverbed, gravel...), pond_mid (the rest; default flagged).
 *
 * The reviewed hold list (DEPTH_HOLD, and seabirds that never settle on the water): species at sea
 * that are not water species, kept off the water with the reason (the scene flies them over their
 * zone, awake or asleep). They are written to `held`, not given a band.
 *
 * Flags: `b` breathes air (mammals, birds, reptiles, or a whale's or turtle's body plan) and so surfaces
 * to breathe; `c` in a crevice; `f` a deep one on the deep floor; `g` glows at night.
 * Rows: [band, water, home, flags, reason, source] (source: text, taxonomy, plan, zone or default).
 */

type Band = "surface" | "upper" | "mid" | "seabed" | "reef" | "deep" | "pond_surface" | "pond_mid" | "pond_bed";
type Water = "salt" | "fresh";
type Home = "zone" | "lake" | "coast";
type Source = "text" | "taxonomy" | "plan" | "zone" | "default";
type DepthResult = {band: Band; water: Water; home: Home; flags: string; reason: string; source: Source} | {held: string};

/**
 * The reviewed hold list: species the catalogue puts at sea that must not be drawn on or in the
 * water, each with why (checked by hand, 2026-11-11). Fix the data, then take them off.
 */
const DEPTH_HOLD: Record<string, string> = {
    "striped-albatross": "catalogue data error: the Striped Albatross is a butterfly (Appias libythea, a pierid of South and South-East Asia) zoned open_ocean; held off the sea until its zone is fixed"
};
/** Seabirds that never settle on the water (their plumage is not waterproof): they soar, and sleep on the wing. */
const NEVER_ON_WATER_FAMILIES = new Set(["Fregatidae"]);

const DEPTH_TEXT_FIELDS = ["habitat", "sleep", "traits_text", "facts", "spotlight", "look", "diet"] as const;
const WATER_BOUND_PLANS = new Set(["fish", "flatfish", "cetacean", "jellyfish", "cephalopod"]);
const SEA_ZONES = new Set(["coral_reef", "open_ocean"]);
const SALT_LAND_ZONES = new Set(["seashore", "polar"]);
/** The fish that walk out on the mud (mudskippers): on land. */
const AMPHIBIOUS_FISH = /\b(?:out of (?:the )?water|walks? on (?:the )?mud|skips? across (?:the )?mud|leaves? the water)\b/i;
const SWIMMING_BIRDS = new Set(["Anatidae", "Podicipedidae", "Gaviidae"]);
const BED_CLASSES = new Set([...FLOOR_CLASSES, "Merostomata", "Maxillopoda", "Ascidiacea", "Echinoidea"]);
const PELAGIC_RAYS = new Set(["Mobulidae", "Myliobatidae", "Rhinopteridae"]);
const RAY_ORDERS = new Set(["Myliobatiformes", "Rajiformes", "Torpediniformes", "Rhinopristiformes"]);
const UPPER_FAMILIES = new Set(["Scombridae", "Xiphiidae", "Istiophoridae", "Lamnidae", "Carcharhinidae", "Sphyrnidae", "Alopiidae", "Exocoetidae", "Rhincodontidae", "Cetorhinidae", "Molidae", "Coryphaenidae", "Spheniscidae", "Phocidae", "Otariidae", "Odobenidae", "Cheloniidae", "Dermochelyidae", "Hydrophiidae", ...PELAGIC_RAYS]);
const UPPER_ORDERS = new Set(["Cetacea", "Sirenia"]);
const BED_FISH_FAMILIES = new Set(["Siluridae", "Ictaluridae", "Callichthyidae", "Loricariidae", "Clariidae", "Pimelodidae", "Cobitidae", "Acipenseridae", "Polyodontidae", "Cottidae", "Gobiidae", "Uranoscopidae", "Lophiidae", "Synanceiidae", "Scorpaenidae", "Brachionichthyidae", "Batrachoididae", "Orectolobidae", "Ginglymostomatidae", "Heterodontidae", "Scyliorhinidae", "Squatinidae", "Pleuronectidae", "Soleidae", "Bothidae", "Paralichthyidae", "Scophthalmidae"]);
const BED_FISH_ORDERS = new Set(["Siluriformes", "Pleuronectiformes"]);
const AIR_CLASSES = new Set(["Mammalia", "Aves", "Reptilia", "Testudines", "Crocodylia", "Squamata"]);
const JELLY_CLASSES = new Set(["Scyphozoa", "Hydrozoa", "Cubozoa", "Ctenophora", "Tentaculata", "Thaliacea"]);

const SURFACE = /\b(?:floats? (?:on|at) (?:the )?(?:sea |water |ocean )?surface|floating (?:on|at) (?:the )?(?:sea |water |ocean )?surface|floats? on (?:its|their) backs?|rafts? (?:together|of)|rafting|lives? (?:on|at) the (?:sea |ocean |water )?surface|surface-dwelling|neuston|rests? on the water|sleeps? (?:on|floating on) the (?:water|sea)|float(?:s|ing)? on (?:the )?(?:open )?(?:water|sea|ocean)|drifts? on the (?:sea |ocean |water )?surface)\b/i;
const UPPER = /\b(?:surface waters?|near the surface|close to the surface|just (?:below|under) the surface|upper (?:water|waters|layers?|ocean|sea|water column)|epipelagic|sunlit (?:surface |upper |open )?(?:waters?|zone|layers?|sea)|top (?:few|\d+) (?:metres|meters))\b/i;
const MID = /\b(?:mid-?water|middle depths|water column|schools?|schooling|shoals?|shoaling|swarms?|open water)\b/i;
const SEABED = /\b(?:sea ?beds?|sea ?floors?|ocean floors?|on the bottom|near the bottom|along the bottom|sea bottom|bottom-dwell\w*|bottom dwell\w*|bottom-living|benthic|demersal|(?:sandy|muddy|soft|rocky|gravel) bottoms?|buries? (?:itself |themselves |in )?(?:in )?(?:the )?(?:sand|mud)|buried in (?:the )?(?:sand|mud)|rests? on the (?:bottom|sand|sea ?floor)|lies? (?:on|in) the sand)\b/i;
const REEFY = /\b(?:reefs?|rocky (?:shores?|coasts?|areas|outcrops|ledges|seabeds?)|kelp|tide ?pools?|rock ?pools?|seagrass|among rocks)\b/i;
const CREVICE = /\b(?:crevices?|holes?|caves?|dens?|cracks?|lairs?|burrows?)\b/i;
const POND_BED = /\b(?:keeps? to the bottom|on the bottom|near the bottom|along the bottom|(?:soft|muddy|sandy) bottoms?|bottom-(?:dwell|cruis|feed|liv)\w*|benthic|buried in (?:the )?(?:mud|sand)|burrows? in (?:the )?mud|under stones|beneath stones)\b/i;
/** Where the text says it is not on the bottom ("far above the seabed", "rather than resting on the bottom"). */
const NOT_BED = /\b(?:above the (?:sea ?bed|sea ?floor|bottom)|rather than (?:resting )?on the (?:sea ?floor|sea ?bed|bottom))/i;
/** Deep from the words for deep water itself, not from a slope or a seamount a surface animal also visits. */
const DEEP_STRICT = /\b(?:deep[- ]sea|deep[- ]water|deep waters|deep ocean|ocean depths|abyss(?:al)?|bathyal|bathypelagic|mesopelagic|midwater|mid-water|twilight zone|hadal|hydrothermal vents?|deep (?:continental slopes?|seafloor|sea floor|marine))\b/i;
const POND_SURFACE = /\b(?:floats?|floating|dabbl\w*|surface of (?:the )?water|water surface|on open water|swims? on (?:the )?(?:water|surface))\b/i;

function depthBand(row: Row): DepthResult | null {
    if (DEPTH_HOLD[row.slug]) return {held: DEPTH_HOLD[row.slug]};
    if (SEA_ZONES.has(row.zone) && NEVER_ON_WATER_FAMILIES.has(row.family ?? "")) return {held: `taxonomy: ${row.family} (a seabird that never lands on the water: it soars, and sleeps on the wing)`};
    const talking = plans[row.slug]?.talking_plan ?? null;
    const trait = traits.get(row.spid);
    const realm = new Set(trait?.realm ?? []);
    const cls = row.class ?? "";
    const family = row.family ?? "";
    const ord = row.ord ?? "";
    const fields = DEPTH_TEXT_FIELDS.map((field) => [field, text((row as Record<string, unknown>)[field] as string | null)] as [string, string]);
    const find = (pattern: RegExp, only?: readonly string[], reject?: RegExp) => {
        for (const [field, value] of fields) {
            if (only && !only.includes(field)) continue;
            if (!usable(value)) continue;
            const found = pattern.exec(value);
            if (!found) continue;
            const phrase = phraseAt(value, found.index, found[0].length);
            if (reject?.test(phrase)) continue;
            return `${field}: "${phrase}"`;
        }
        return null;
    };
    // Its body: the talking plan, else the taxonomy.
    const plan = talking ?? (ord === "Cetacea" || ord === "Sirenia" ? "cetacean" : JELLY_CLASSES.has(cls) ? "jellyfish" : cls === "Cephalopoda" ? "cephalopod" : ord === "Pleuronectiformes" ? "flatfish" : cls === "Actinopterygii" || cls === "Elasmobranchii" || cls === "Chondrichthyes" ? "fish" : null);
    const trueEel = plan === "eel" && !["Amphibia", "Squamata", "Reptilia"].includes(cls);
    const fishLike = plan !== null && (WATER_BOUND_PLANS.has(plan) || trueEel);
    const amphibious = fishLike && plan === "fish" && (family === "Oxudercidae" || /mudskipper/.test(row.slug) || find(AMPHIBIOUS_FISH) !== null);
    const seaZone = SEA_ZONES.has(row.zone);
    const seaOtter = family === "Mustelidae" && realm.has("sea") && !realm.has("land") && !realm.has("fresh");
    const lakeBird = row.zone === "river_lake" && cls === "Aves" && SWIMMING_BIRDS.has(family);
    const lakeBed = row.zone === "river_lake" && BED_CLASSES.has(cls) && cls !== "Insecta";
    if (!seaZone && !(fishLike && !amphibious) && !seaOtter && !lakeBird && !lakeBed) return null;

    // Salt or fresh.
    const salt = realm.has("sea") && !realm.has("fresh") ? true
        : realm.has("fresh") && !realm.has("sea") ? false
        : seaZone || SALT_LAND_ZONES.has(row.zone);
    const water: Water = salt ? "salt" : "fresh";
    const home: Home = salt ? (seaZone ? "zone" : "coast") : "lake";
    const breathes = AIR_CLASSES.has(cls) || plan === "cetacean" || plan === "turtle";
    const layer = classify(row);
    const glow = layer.flags.includes("g") || find(GLOW) !== null;
    const flags = (extra = "") => `${breathes ? "b" : ""}${extra}${glow ? "g" : ""}`;
    const result = (band: Band, reason: string, source: Source, extra = ""): DepthResult & {band: Band} => ({band, water, home, flags: flags(extra), reason, source});

    if (water === "fresh") {
        if (lakeBird) return result("pond_surface", `taxonomy: ${family} (swims on the water)`, "taxonomy");
        const floats = find(POND_SURFACE, ["habitat", "sleep"]);
        if (floats && !fishLike) return result("pond_surface", floats, "text");
        if (BED_CLASSES.has(cls)) return result("pond_bed", `taxonomy: ${cls} (on the bed)`, "taxonomy");
        if (BED_FISH_FAMILIES.has(family) || BED_FISH_ORDERS.has(ord)) return result("pond_bed", `taxonomy: ${family || ord} (a bottom fish)`, "taxonomy");
        // Where it lives (not where it rests at night: most fish settle near the bottom in the dark).
        const bed = breathes ? null : find(POND_BED, ["habitat", "traits_text"], NOT_BED);
        if (bed) return result("pond_bed", bed, "text");
        const mid = find(MID) ?? find(UPPER);
        if (mid) return result("pond_mid", mid, "text");
        if (breathes) return result("pond_mid", `${UPPER_ORDERS.has(ord) ? `taxonomy: ${ord}` : `body plan ${plan}`} (swims, surfaces to breathe)`, UPPER_ORDERS.has(ord) ? "taxonomy" : "plan");
        return result("pond_mid", `default: no depth phrase (${plan ?? cls ?? "unknown"} body)`, "default");
    }

    // Not a water body at all (a land animal the catalogue put at sea, not yet reviewed): held off the water.
    if (!fishLike && !breathes && plan !== null && !BED_CLASSES.has(cls) && !["eel", "cephalopod", "jellyfish", "sessile", "slow_invertebrate", "arthropod"].includes(plan) && !realm.has("sea")) return {held: `unreviewed: a ${plan} body in zone ${row.zone} with no water realm (a catalogue error?)`};
    // A deep one on the deep floor: its body, or its habitat names the floor (and not the open midwater, "not on the seabed").
    const habitat = text(row.habitat);
    const onFloor = BED_CLASSES.has(cls) || RAY_ORDERS.has(ord) || (find(/\b(?:sea ?floor|sea ?bed|bottoms?|abyssal plains?|hydrothermal vents?|vent fields?)\b/i, ["habitat"], NOT_BED) !== null && !/\b(?:midwater|mid-water|mesopelagic|bathypelagic|open water|open ocean|not (?:live )?on the sea ?bed|rather than on)\b/i.test(habitat));
    const deep = breathes ? null : find(DEEP_STRICT, ["habitat"]);
    if (layer.layer === "deep" && deep) return result("deep", deep, "text", onFloor ? "f" : "");
    if (seaOtter) return result("surface", `taxonomy: ${family}, sea only (a sea otter floats)`, "taxonomy");
    if (cls === "Aves" && family !== "Spheniscidae") return result("surface", `taxonomy: Aves (a seabird floats)`, "taxonomy");
    const floats = find(SURFACE, ["habitat", "sleep", "traits_text", "facts", "spotlight"]);
    if (floats) return result("surface", floats, "text");
    // The seabed: its body or its kind.
    if (BED_CLASSES.has(cls)) return result("seabed", `taxonomy: ${cls} (on the seabed)`, "taxonomy");
    if (plan === "flatfish" || ord === "Pleuronectiformes") return result("seabed", "taxonomy: a flatfish", plan === "flatfish" ? "plan" : "taxonomy");
    if (RAY_ORDERS.has(ord) && !PELAGIC_RAYS.has(family) && !/manta|mobula|devil-ray|eagle-ray|cownose/.test(row.slug)) return result("seabed", `taxonomy: ${ord} (a ray resting on the bottom)`, "taxonomy");
    // The open water's big swimmers, and the jellyfish, by their kind.
    const upperKind = UPPER_ORDERS.has(ord) || UPPER_FAMILIES.has(family) || /manta|mobula/.test(row.slug);
    if (upperKind && row.zone !== "coral_reef") return result("upper", `taxonomy: ${UPPER_ORDERS.has(ord) ? ord : family || "a manta"}`, "taxonomy");
    if (plan === "jellyfish" || JELLY_CLASSES.has(cls)) return result("mid", `${plan === "jellyfish" ? "body plan" : "taxonomy"}: a jellyfish (drifts in mid-water)`, plan === "jellyfish" ? "plan" : "taxonomy");
    // The reef: among the coral (in a crevice for the octopus and the eels).
    const reefy = row.zone === "coral_reef" ? null : find(REEFY, ["habitat", "look"]);
    if (row.zone === "coral_reef" || (home === "coast" && reefy && !breathes)) {
        const crevice = /octopus/.test(row.slug) || trueEel || family === "Muraenidae" ? `${trueEel || family === "Muraenidae" ? `taxonomy: ${family || ord || "an eel"}` : "an octopus"} (in a hole)` : find(CREVICE, ["habitat", "sleep"]);
        const why = row.zone === "coral_reef" ? "zone coral_reef" : reefy!;
        return result("reef", crevice ? `${why}; ${crevice}` : why, row.zone === "coral_reef" ? "zone" : "text", crevice ? "c" : "");
    }
    // The seabed from where it lives (its habitat or its build, never where it rests at night).
    const bed = breathes ? null : find(SEABED, ["habitat", "traits_text"], NOT_BED);
    if (bed) return result("seabed", bed, "text");
    if (BED_FISH_FAMILIES.has(family)) return result("seabed", `taxonomy: ${family} (a bottom fish)`, "taxonomy");
    if (plan === "cetacean" || plan === "turtle") return result("upper", `body plan ${plan}`, "plan");
    // Where it lives, not a night's feeding trip or a sighting ("filmed near the surface").
    const upper = find(UPPER, ["habitat", "traits_text"]);
    if (upper) return result("upper", upper, "text");
    const mid = find(MID);
    if (mid) return result("mid", mid, "text");
    if (breathes) return result("upper", `taxonomy: ${cls} (an air-breather keeps near the surface)`, "taxonomy");
    return result("mid", `default: no depth phrase (${plan ?? cls ?? "unknown"} body)`, "default");
}

const bands: Record<string, Array<string>> = {};
const held: Record<string, [string, string]> = {};
const depthReport: Record<string, Array<{slug: string; name: string | null; zone: string; class: string | null; family: string | null; water: Water; home: Home; flags: string; reason: string; source: Source}>> = {};
for (const row of rows) {
    const found = depthBand(row);
    if (!found) continue;
    if ("held" in found) {
        held[row.slug] = ["air", found.held];
        continue;
    }
    bands[row.slug] = [found.band, found.water, found.home, found.flags, found.reason, found.source];
    (depthReport[found.band] ??= []).push({slug: row.slug, name: row.name, zone: row.zone, class: row.class, family: row.family, water: found.water, home: found.home, flags: found.flags, reason: found.reason, source: found.source});
}
writeFileSync(join(root, "src/ark-scene/depth-bands.json"), JSON.stringify({
    about: "Generated by scripts/ark-layers.mts (\"Depth bands\") from the live catalogue, the traits lane's realm, the rig body plans and the taxonomy. Rows: [band, water, home, flags, reason, source]; flags: b breathes air, c in a crevice, f on the deep floor, g glows at night. Species not listed are not water species. held: the reviewed hold list, [show, reason]: at sea but kept off the water (flown over its zone).",
    species: bands,
    held
}).replace(/\],"/g, "],\n\"") + "\n");
console.log(JSON.stringify({held}));
console.log(JSON.stringify(Object.fromEntries(Object.entries(depthReport).map(([key, list]) => [key, list.length]))));
console.log(JSON.stringify({default: Object.values(depthReport).flat().filter((r) => r.source === "default").length, relocated: Object.values(depthReport).flat().filter((r) => r.home !== "zone" && !(r.home === "lake" && r.zone === "river_lake")).length}));
if (depthReportPath) writeFileSync(depthReportPath, JSON.stringify(depthReport, null, 1));
