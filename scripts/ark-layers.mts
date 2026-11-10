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
 *     st.class_name as class, st.order_name as ord, st.family_name as family
 *     from voyage_species vs join species_profiles sp on sp.id = vs.species_profile_id
 *     left join species_field_guide fg on fg.species_profile_id = vs.species_profile_id
 *     left join species_taxonomy st on st.species_profile_id = vs.species_profile_id
 *     order by vs.model_slug" > catalogue-layers.json
 *
 *   npx tsx scripts/ark-layers.mts catalogue-layers.json traits.json plans.json [report.json]
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
const [input, traitsPath, plansPath, reportPath] = process.argv.slice(2);
if (!input || !traitsPath || !plansPath) throw new Error("usage: ark-layers.mts <catalogue json> <traits.json> <plans.json> [report json]");

type Row = {slug: string; spid: string; name: string | null; zone: string; size: number | null; habitat: string | null; look: string | null; sleep: string | null; class: string | null; ord: string | null; family: string | null};
const raw = JSON.parse(readFileSync(input, "utf8")) as {rows: Row[]} | Row[];
const rows = (Array.isArray(raw) ? raw : raw.rows).slice().sort((a, b) => a.slug.localeCompare(b.slug));
const traits = new Map((JSON.parse(readFileSync(traitsPath, "utf8")) as {traits: Array<{species_profile_id: string; realm?: string[] | null; realm_phrase?: string | null}>}).traits.map((t) => [t.species_profile_id, t]));
const plans = (JSON.parse(readFileSync(plansPath, "utf8")) as {species: Record<string, {plan: string}>}).species;

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

const UNDERGROUND = /\b(?:underground|subterranean|fossorial|tunnels|tunnelling|tunneling|spends? most of (?:its|their) (?:life|lives|time) (?:underground|in burrows))\b/i;
const UNDERGROUND_FAMILIES = new Set(["Talpidae", "Bathyergidae", "Spalacidae", "Chrysochloridae", "Geomyidae", "Notoryctidae", "Ctenomyidae", "Caeciliidae", "Amphisbaenidae", "Megascolecidae", "Lumbricidae", "Gryllotalpidae"]);
const UNDERGROUND_CLASSES = new Set(["Mammalia", "Amphibia", "Squamata", "Clitellata", "Insecta"]);
const BURROW = /\b(?:burrows?|burrowing|digs?|digging|warrens?)\b/i;
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
        const deep = find(DEEP, ["habitat", "look"]);
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
    const burrow = BURROW_CLASSES.has(cls) ? find(BURROW, ["habitat", "look", "sleep"]) : null;
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
