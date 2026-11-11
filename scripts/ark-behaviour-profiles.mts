#!/usr/bin/env -S npx tsx
/**
 * Behaviour profiles for every Ark species (the NPC-style behaviour brief,
 * docs/ark-behaviour.md): how it moves, when it sleeps and where, who it
 * keeps company with, what it eats, which behaviours it has and which places
 * in the world it uses. Visual only: the server's ecology decides life and
 * death; these only decide what an animal is seen doing.
 *
 * Deterministic keyword rules over stored data only (no AI calls). Every
 * field keeps the verbatim phrase that decided it (`src`), or says it is a
 * body-plan default (`defaults`), so a profile can be checked against the
 * catalogue text.
 *
 * Inputs (read-only):
 *   1. a live export, run from the AnimalDex repo:
 *        supabase db query --linked -o json "select vs.species_profile_id id, vs.model_slug slug, vs.zone, vs.excluded_reason,
 *          sp.display_name name, sp.canonical_game_stats stats, t.realm, t.realm_phrase, t.activity, t.activity_phrase,
 *          t.sociality, t.sociality_phrase, t.ambient, t.ambient_phrases, t.length_m, t.length_phrase, t.dominance, t.speed,
 *          t.size, t.pet, t.brackish, t.hosts, fg.sleep_pattern, fg.best_time_of_day, fg.typical_habitat, fg.where_to_look,
 *          fg.diet_summary, fg.signature_traits, fg.interesting_facts, fg.species_spotlight, tx.class_name, tx.order_name,
 *          tx.family_name
 *          from voyage_species vs join species_profiles sp on sp.id=vs.species_profile_id
 *          left join voyage_species_traits t on t.species_profile_id=vs.species_profile_id
 *          left join species_field_guide fg on fg.species_profile_id=vs.species_profile_id
 *          left join species_taxonomy tx on tx.species_profile_id=vs.species_profile_id order by vs.model_slug"
 *   2. the rig manifest (`~/animaldex-talking-models/rig/manifest.json`): body plan and the clips that passed;
 *   3. the map lane's microhabitat inventory (B1, `microhabitats.json`): spawn tags with their phrases;
 *   4. the scene's `src/ark-scene/layers.json` and `microhabitats.json` (already generated from the same data).
 *
 *   npx tsx scripts/ark-behaviour-profiles.mts export.json manifest.json b1-microhabitats.json [food.json] [rig-v2-manifest.json rig-v2-set-manifest.json]
 *
 *   food.json (optional, for `src/ark-scene/food-links.json`), read-only from the same repo:
 *        supabase db query --linked -o json "select pv.model_slug predator, string_agg(distinct yv.model_slug, ',' order by yv.model_slug) prey
 *          from voyage_food_links l join voyage_species pv on pv.species_profile_id=l.predator join voyage_species yv on yv.species_profile_id=l.prey
 *          where coalesce(l.realm_ok,true) and coalesce(l.size_ok,true) and pv.excluded_reason is null and yv.excluded_reason is null
 *          and pv.model_slug<>yv.model_slug group by pv.model_slug"
 *
 * Outputs:
 *   - `data/ark/behaviour-profiles.json`: the full profiles, every field with its source phrase;
 *   - `src/ark-scene/behaviours.json`: the compact rows the scene reads (`behaviour-profile.ts` decodes them);
 *   - a summary on stdout (counts, defaults per field).
 */

import fs from "node:fs";
import path from "node:path";

type Row = {
    id: string;
    slug: string | null;
    zone: string | null;
    excluded_reason: string | null;
    parent_slug?: string | null;
    text_from_parent?: boolean | null;
    name: string;
    stats: {size?: number; speed?: number; dominance?: number; rarity?: number; intelligence?: number} | null;
    realm: string[] | null;
    activity: string | null;
    activity_phrase: string | null;
    sociality: string | null;
    sociality_phrase: string | null;
    ambient: string[] | null;
    ambient_phrases: string[] | null;
    dominance: number | null;
    speed: number | null;
    size: number | null;
    pet: boolean | null;
    sleep_pattern: string | null;
    best_time_of_day: string | null;
    typical_habitat: string | null;
    where_to_look: string | null;
    diet_summary: string | null;
    signature_traits: string[] | null;
    interesting_facts: string[] | null;
    species_spotlight: string | null;
    class_name: string | null;
    order_name: string | null;
    family_name: string | null;
};

type Rig = {plan: string; state: string; clips_pass: string[]; flight_fallback?: boolean; pose?: unknown; clips?: Record<string, {pass?: boolean; ground_speed?: number; duty?: number; bls?: number}>};
type B1 = {id: string; slug: string; plan: string | null; spawn: string[]; microhabitats: Array<{type: string; field: string; phrase: string}>};

const [exportPath, manifestPath, b1Path, foodPath, rigV2Path, rigV2SetPath] = process.argv.slice(2);
if (!exportPath || !manifestPath || !b1Path) {
    console.error("usage: ark-behaviour-profiles.mts export.json manifest.json b1-microhabitats.json");
    process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const rows: Row[] = (Array.isArray(exported) ? exported : exported.rows).filter((r: Row) => r.slug);
const manifest: Record<string, Rig> = JSON.parse(fs.readFileSync(manifestPath, "utf8")).species;
/**
 * The re-made rig set the scene reads first (`rig-clips.ts` ARK_RIG_VERSION v2): the rig manifest it was published from
 * and the published set's own list. A species the set lists walks at its v2 clips' pace; any other at its v1 clips'
 * (the scene falls back to v1 for it). (2026-11-11: with v2 up, walkers kept to v1's pace walked at 0.4 of their clip.)
 */
const rigV2: Record<string, Rig> = rigV2Path ? JSON.parse(fs.readFileSync(rigV2Path, "utf8")).species : {};
const rigV2Set: Record<string, unknown> = rigV2SetPath ? JSON.parse(fs.readFileSync(rigV2SetPath, "utf8")).species : {};
const paceRig = (slug: string): {rig: Rig | undefined; v2: boolean} => (rigV2Set[slug] && rigV2[slug] ? {rig: rigV2[slug], v2: true} : {rig: manifest[slug], v2: false});
const b1 = new Map<string, B1>((JSON.parse(fs.readFileSync(b1Path, "utf8")).species as B1[]).map((s) => [s.id, s]));
const layers: Record<string, [string, string, string, string?]> = JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/layers.json"), "utf8")).species;
const micro: Record<string, [string, string, string?]> = JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/microhabitats.json"), "utf8")).species;

// MARK: Phrases

type Field = "sleep" | "time" | "habitat" | "look" | "diet" | "traits" | "facts" | "spotlight" | "activity" | "sociality" | "ambient" | "b1";
/** A stored field and the verbatim phrase that decided it; a rule from the body plan or taxonomy (stored, not text); or a default where data is missing (flagged). */
type Source = {field: Field; phrase: string} | {rule: string} | {default: string};
/** The adult is what the Ark shows: sentences about larvae, caterpillars, nymphs or tadpoles are left out. */
const YOUNG = /\b(larva|larvae|larval|caterpillars?|nymphs?|naiads?|tadpoles?|grubs|maggots|hellgrammites?)\b/i;
function adult(text: string | null | undefined): string | null {
    if (!text) return null;
    const kept = text.split(/(?<=[.;])\s+/).filter((sentence) => !YOUNG.test(sentence)).join(" ");
    return kept || null;
}
const FIELD_OF: Record<Exclude<Field, "activity" | "sociality" | "ambient" | "b1">, (r: Row) => string | null> = {
    sleep: (r) => adult(r.sleep_pattern),
    time: (r) => r.best_time_of_day,
    habitat: (r) => adult(r.typical_habitat ? r.typical_habitat.replace(/^Native range keys:[^.]*\.\s*/, "") : null),
    look: (r) => adult(r.where_to_look),
    diet: (r) => adult(r.diet_summary),
    traits: (r) => adult((r.signature_traits ?? []).join(" ")),
    facts: (r) => adult((r.interesting_facts ?? []).join(" ")),
    spotlight: (r) => adult(r.species_spotlight)
};
type TextField = keyof typeof FIELD_OF;

/**
 * The clause (between sentence or comma breaks, at most ~90 characters) round a match: a verbatim substring of the
 * text, always whole words. (It used to drop a field's first letter, "nsects": a break not found is index -1, and
 * -1 + 2 is 1. Fixed 2026-11-11.)
 */
export function clause(text: string, index: number, length: number): string {
    // Just after the last break before the match (the field's start when there is none).
    const after = (stop: string) => {
        const at = index > 0 ? text.lastIndexOf(stop, index - 1) : -1;
        return at < 0 ? 0 : at + stop.length;
    };
    const sentenceStart = Math.max(after(". "), after("; "));
    let sentenceEnd = text.length;
    for (const stop of [". ", "; "]) {
        const at = text.indexOf(stop, index + length);
        if (at >= 0) sentenceEnd = Math.min(sentenceEnd, at + 1);
    }
    let start = sentenceStart;
    let end = sentenceEnd;
    if (end - start > 90) {
        const comma = after(", ");
        if (comma > start && index - comma < 60) start = comma;
        const next = text.indexOf(", ", index + length);
        if (next >= 0 && next < end) end = next;
        if (end - start > 110) {
            // A window round the match, widened to whole words.
            let from = Math.max(start, index - 40);
            while (from > start && /\w/.test(text[from - 1])) from--;
            let to = Math.min(end, index + length + 50);
            while (to < end && /\w/.test(text[to])) to++;
            start = from;
            end = to;
        }
    }
    return text.slice(start, end).trim().replace(/[.;,]$/, "");
}

/** The first field (in order) whose text matches, with its phrase. */
/**
 * The words before a match that make it about something else: a prey's colony, an insect's nest, three pairs of eyes,
 * a negation ("little gliding"), new colonies started by people.
 */
const NOT_ITS_OWN = /\b(weaver|weavers'?|ant|ants'?|termite|termites'?|bee|bees'?|wasp|wasps'?|insect|insects'?|bird|birds'?|seabird|prey|new|introduced|three|four|two|eight|six|little|no|rarely|seldom|without|not|never|cannot|can't|unable to|too heavy to|follow\w*|hunt\w*|target\w*|raid\w*|attack\w*|chas\w*|stalk\w*|ambush\w*|feral|escaped|established)\s+(\w+\s+)?$/i;
/** What follows a match that makes it about something else: "schooling fish", "swarms of krill", "colonies inside trunks". */
const NOT_ITS_OWN_AFTER = /^\s+(of\s+|inside\s+|within\s+)?(\w+\s+)?(ants?|termites?|bees?|wasps?|krill|fish|baitfish|prey|plankton|copepods|insects?|trunks|logs|wood|sardines|anchov\w*|squid|locusts?)\b/i;

/** The first field (in order) whose text matches, with its phrase (a match about something else is passed over). */
function find(row: Row, fields: TextField[], pattern: RegExp, veto?: (before: string) => boolean): {field: TextField; phrase: string; match: string} | null {
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    for (const field of fields) {
        const text = FIELD_OF[field](row);
        if (!text) continue;
        global.lastIndex = 0;
        for (let m = global.exec(text); m; m = global.exec(text)) {
            if (NOT_ITS_OWN.test(text.slice(Math.max(0, m.index - 32), m.index))) continue;
            if (NOT_ITS_OWN_AFTER.test(text.slice(m.index + m[0].length, m.index + m[0].length + 40))) continue;
            if (veto?.(text.slice(Math.max(0, m.index - 32), m.index))) continue;
            return {field, phrase: clause(text, m.index, m[0].length), match: m[0].toLowerCase()};
        }
    }
    return null;
}

const ALL: TextField[] = ["sleep", "habitat", "look", "traits", "facts", "spotlight", "diet"];
const BEHAVIOUR_TEXT: TextField[] = ["sleep", "traits", "facts", "look", "habitat", "spotlight"];

// MARK: The plan and the layer

const SEA_ZONES = new Set(["coral_reef", "open_ocean"]);
const WATER_ZONES = new Set(["coral_reef", "open_ocean", "river_lake", "wetland", "seashore"]);

function planOf(row: Row): {plan: string; src: Source} {
    const c = row.class_name ?? "";
    const byClass = c === "Aves" ? "flying_bird" : c === "Mammalia" ? "quadruped" : c === "Insecta" ? "insect" : c === "Arachnida" ? "arachnid" : c === "Reptilia" ? "lizard" : c === "Amphibia" ? "amphibian" : /Actinopterygii|Chondrichthyes|Elasmobranchii|Sarcopterygii|Teleostei/.test(c) ? "fish" : "other";
    const rig = manifest[row.slug!];
    // The rig's "other" holds the breeds and odd models; their class says more (a corgi walks, a koi swims).
    if (rig?.plan && !(rig.plan === "other" && byClass !== "other")) return {plan: rig.plan, src: {rule: `rig body plan ${rig.plan}`}};
    const fromB1 = b1.get(row.id)?.plan;
    if (fromB1 && fromB1 !== "other") return {plan: fromB1, src: {rule: `B1 body plan ${fromB1}`}};
    if (byClass !== "other") return {plan: byClass, src: {rule: `class ${c}`}};
    return {plan: "other", src: {default: `class ${c || "unknown"}`}};
}

// MARK: Rules

type Activity = "diurnal" | "nocturnal" | "crepuscular" | "any";
const TIME_WORDS: Array<[RegExp, Activity]> = [
    [/^(anytime|any time|day and night|all day)/i, "any"],
    // ("Morning and late afternoon" is a day animal busy at both ends of the day: `rhythmOf`'s two peaks, not twilight.)
    [/dawn and dusk|dusk and dawn|twilight/i, "crepuscular"],
    [/^(night|nighttime|night-time|evening and night|dusk and night|after dark|late evening)/i, "nocturnal"],
    [/^(day|daytime|daylight|morning|midday|afternoon|late morning|early morning|warm|sunny)/i, "diurnal"]
];

function activityOf(row: Row, plan: string): {value: Activity; src: Source} {
    if (row.activity && ["diurnal", "nocturnal", "crepuscular", "any"].includes(row.activity)) return {value: row.activity as Activity, src: {field: "activity", phrase: row.activity_phrase ?? row.activity}};
    const time = row.best_time_of_day?.trim();
    if (time) for (const [pattern, value] of TIME_WORDS) if (pattern.test(time)) return {value, src: {field: "time", phrase: time}};
    const hit = find(row, ["sleep", "traits", "facts"], /\b(nocturnal|crepuscular|diurnal|active by day|active at night|by night|at dusk|after dark|by day|in daylight|in sunshine)\b/i);
    if (hit) {
        const m = hit.match;
        const value: Activity = /crepuscular|dusk/.test(m) ? "crepuscular" : /nocturnal|night|after dark/.test(m) ? "nocturnal" : "diurnal";
        return {value, src: {field: hit.field, phrase: hit.phrase}};
    }
    return {value: plan === "bat" ? "nocturnal" : "diurnal", src: {default: `plan ${plan}: ${plan === "bat" ? "nocturnal" : "awake by day"}`}};
}

/** The day's shape on top of the activity: busiest at the day's two ends, or resting through the midday heat. */
function rhythmOf(row: Row, activity: Activity): {value: string[]; src: Source[]} {
    const value: string[] = [];
    const src: Source[] = [];
    const twoPeaks = find(row, ["sleep", "time", "look"], /(early )?morning and (late )?(afternoon|evening)|dawn and dusk|early and late in the day|morning and evening/i);
    if (twoPeaks && activity !== "nocturnal") {
        value.push("two_peaks");
        src.push({field: twoPeaks.field, phrase: twoPeaks.phrase});
    }
    const siesta = find(row, ["sleep", "look", "facts"], /(midday|middle of the day|hottest|heat of the day)[^.]{0,40}(rest|shade|shelter)|(rest|shelter|shade)[^.]{0,40}(midday|hottest|heat of the day)/i);
    if (siesta) {
        value.push("siesta");
        src.push({field: siesta.field, phrase: siesta.phrase});
    }
    return {value, src};
}

type Roost = "tree" | "tree_hole" | "cliff" | "cave" | "crevice" | "rocks" | "burrow" | "den" | "ground_cover" | "reeds" | "water" | "bottom" | "reef" | "leaf" | "bark" | "wall" | "nest" | "attached" | "open" | "shore";
const ROOST_RULES: Array<[RegExp, Roost]> = [
    // (A tree's hollow only: "scraped hollows", "a snow hollow" and "hollow logs" are on the ground, below.)
    [/\b(tree[- ]?holes?|tree hollows?|hollow (trees?|trunks?|branch\w*|limbs?)|tree cavit\w*|cavities|nest[- ]?holes?|holes? in (a |the )?trees?)\b/i, "tree_hole"],
    [/\b(burrows?|underground|below (the )?ground|in(to)? the soil|tunnels?|dig(s|ging)? (itself|its own)|holes? in the (ground|soil|sand))\b/i, "burrow"],
    [/\b(dens?|lairs?)\b/i, "den"],
    [/\bcaves?\b|\bmines?\b|\broof spaces?\b|\battics?\b/i, "cave"],
    [/\b(crevices?|cracks?|under (rocks?|stones?|logs?)|rock piles?|beneath (rocks?|stones?))\b/i, "crevice"],
    [/\b(cliffs?|ledges?|rock faces?)\b/i, "cliff"],
    [/\b(buried|burying|bur(y|ies) (itself|themselves)|in (soft )?(mud|sand|silt)|on the bottom|on the (sea|river|lake) ?(bed|floor|bottom))\b/i, "bottom"],
    [/\b(among (the )?(coral|tentacles)|anemone|reef crevice|in the reef|on the reef)\b/i, "reef"],
    [/\b(undersides? of (a )?leaf|undersides? of leaves|on (a )?leaf|on leaves|among leaves|in (the )?foliage|(in|into|under) (the )?(leaf litter|moss))\b/i, "leaf"],
    [/\b(bark|trunks?)\b/i, "bark"],
    [/\b(reeds?|reedbeds?|marsh vegetation)\b/i, "reeds"],
    [/\b(on (the )?water|on or (beside|near) (the )?water|at sea|on the sea|rafts?|floating|afloat|on open water|on the surface)\b/i, "water"],
    [/\b(rocks|boulders|lava|wrecks|stones)\b/i, "rocks"],
    [/\b(in (\w+ )?trees|in a (\w+ )?tree|roosts? (high )?in (trees|a tree|the canopy)|(?<!under (?:\w+ ){0,2})branches|treetops?|canopy|perch(es)? (in|on) (trees|branches)|tree forks?|tree crowns?|conifers)\b/i, "tree"],
    [/\b(walls?|on buildings|in buildings|houses|eaves|roof spaces?)\b/i, "wall"],
    [/\b(on the ground|ground roost|scrapes?|in (dense |thick |tall )?(grass|cover|undergrowth|tussocks?|vegetation|thickets?|shrubs?|bushes|bamboo)|under (cover|bushes|shrubs)|under (\w+ ){0,2}branches|(in|inside|among|under) (dense |thick |low |tall )?(gorse|brambles?|heather|scrub|brush)|hollow logs?|fallen logs?|hollows?)\b/i, "ground_cover"],
    [/\b(sleeping nests?|nests?)\b/i, "nest"]
];

/**
 * A sleep text's clauses (split at sentence ends, semicolons, colons and "while/before/after/then/but"; not at commas,
 * which split lists), in order, with where each starts; a clause about feeding, basking or breeding and not about
 * resting is left out ("foraging on the ground", "basking on rocks", "hunting over shelves, walls and bedding").
 */
const FEEDING = /\b(forag\w*|feed\w*|fed|hunt\w*|graz\w*|brows\w*|eat\w*|walking|catch\w*|display\w*|bask\w*|sunn\w*|warm(s|ing)? up|breed\w*|eggs?|chicks?|young|incubat\w*)\b/i;
const RESTING = /\b(roost\w*|rest\w*|sleep\w*|slept|shelter\w*|hid(e|es|ing|den)|retreat\w*|lie[sd]? up|lying up|lies|bed(s|ded)? down|settles?|stays?|spends?|spent|each night|for the night|overnight|spending|day is spent|dormant|inactive|torpor|hibernat\w*|wedg\w*|tucked|curled|holes? up|nest(s|ing)?|return(s|ing)? to|lives? in|lie[s]? still|lying still)\b/i;
function restClauses(text: string): Array<{text: string; at: number}> {
    const out: Array<{text: string; at: number}> = [];
    const breaks = /(?<=[.;:])\s+|,?\s+(?:while|before|after|then|but|whereas)\s+/g;
    let at = 0;
    const push = (end: number) => {
        const part = text.slice(at, end);
        if (part.trim() && !(FEEDING.test(part) && !RESTING.test(part))) out.push({text: part, at});
    };
    for (let m = breaks.exec(text); m; m = breaks.exec(text)) {
        push(m.index);
        at = m.index + m[0].length;
    }
    push(text.length);
    return out;
}

const BUILDINGS = /\b(houses?|buildings?|homes?|roofs?|eaves|sheds?|barns?|verandas?|ceilings?|windows?|attics?|lofts?|towns?|cities|city|gardens?|human)\b/i;
const everything = (row: Row) => (Object.keys(FIELD_OF) as TextField[]).map((f) => FIELD_OF[f](row) ?? "").join(" ");

function roostOf(row: Row, plan: string, layer: string, zone: string): {value: Roost; src: Source} {
    // Where it spends the night (or the day, for a night animal): its sleep text first, then where it lives.
    for (const fields of [["sleep"], ["look", "habitat", "traits", "facts"]] as TextField[][]) {
        for (const field of fields) {
            const text = FIELD_OF[field](row);
            if (!text) continue;
            // In the sleep text its clauses in order, leaving out the ones about feeding or breeding ("foraging on the
            // ground", "breeding birds stay in the nest hole"); in the others only "roost/rest/shelter/sleep ... in X".
            if (field === "sleep") {
                for (const part of restClauses(text)) {
                    for (const [pattern, roost] of ROOST_RULES) {
                        // A wall is a building's (the mossy frog's "wet wall" of rock is not).
                        if (roost === "wall" && !BUILDINGS.test(everything(row))) continue;
                        const m = pattern.exec(part.text);
                        if (m && !NOT_ITS_OWN.test(part.text.slice(Math.max(0, m.index - 24), m.index))) return {value: roost, src: {field, phrase: clause(text, part.at + m.index, m[0].length)}};
                    }
                }
                continue;
            }
            for (const [pattern, roost] of ROOST_RULES) {
                if (roost === "wall" && !BUILDINGS.test(everything(row))) continue;
                const near = new RegExp(`\\b(roost|rests?|resting|shelter|sleep|hides?|hid|retreats?|spends? the (day|night))[^.]{0,50}${pattern.source}`, "i");
                const m = near.exec(text);
                if (m && !NOT_ITS_OWN.test(m[0].slice(0, m[0].length - (pattern.exec(m[0])?.[0].length ?? 0)).slice(-24))) return {value: roost, src: {field, phrase: clause(text, m.index, m[0].length)}};
            }
        }
    }
    const prior = priorOf(row);
    if (prior?.prior.roost) return {value: prior.prior.roost, src: {rule: `${prior.name}: ${prior.prior.roost}`}};
    const byPlan: Record<string, Roost> = {
        flying_bird: "tree", bat: "cave", primate: "tree", walking_bird: "ground_cover", flightless_bird: "ground_cover",
        quadruped: "ground_cover", insect: "leaf", flying_insect: "leaf", arachnid: "crevice", crustacean: "crevice",
        lizard: "crevice", legless: "crevice", amphibian: "crevice", turtle: "water", fish: "water", cephalopod_jelly: "water", other: "attached"
    };
    let value = byPlan[plan] ?? "open";
    if (layer === "underground") value = "burrow";
    else if (layer === "canopy" && value === "ground_cover") value = "tree";
    else if (SEA_ZONES.has(zone) && (plan === "fish" || plan === "crustacean" || plan === "cephalopod_jelly")) value = zone === "coral_reef" ? "reef" : "water";
    return {value, src: {default: `plan ${plan}${layer !== "ground" ? `, layer ${layer}` : ""}`}};
}

// MARK: Taxon priors (stored taxonomy; used only where the text is silent, and named as such)

type Prior = {social?: Social; diet?: Diet; move?: Move; also?: Move[]; roost?: Roost; extra?: Behaviour[]};
const FAMILY_PRIORS: Record<string, Prior> = {
    Bovidae: {social: "herd", diet: "grazer"},
    Cervidae: {social: "herd", diet: "browser"},
    Equidae: {social: "herd", diet: "grazer"},
    Camelidae: {social: "herd", diet: "browser"},
    Giraffidae: {social: "herd", diet: "browser"},
    Elephantidae: {social: "herd", diet: "browser"},
    Leporidae: {social: "group", diet: "grazer", roost: "burrow"},
    Suidae: {social: "group", diet: "omnivore"},
    Felidae: {diet: "meat"},
    Canidae: {diet: "meat", roost: "den"},
    Mustelidae: {diet: "meat", roost: "den"},
    Picidae: {also: ["climb"]},
    Sittidae: {also: ["climb"]},
    Certhiidae: {also: ["climb"]},
    Anatidae: {social: "flock", move: "swim", also: ["fly", "walk"], roost: "water"},
    Gaviidae: {move: "swim", also: ["fly"], roost: "water", extra: ["dive"]},
    Podicipedidae: {move: "swim", also: ["fly"], roost: "water", extra: ["dive"]},
    Phasianidae: {social: "flock", diet: "seeds", move: "walk", also: ["fly"], roost: "ground_cover"},
    Numididae: {social: "flock", diet: "seeds", move: "walk", also: ["fly"]},
    Odontophoridae: {social: "flock", diet: "seeds", move: "walk", also: ["fly"]},
    Megapodiidae: {move: "walk", also: ["fly"], extra: ["burrow"]},
    Columbidae: {social: "flock", diet: "seeds"},
    Delphinidae: {social: "group"},
    Phocoenidae: {social: "group"},
    Monodontidae: {social: "group"},
    Accipitridae: {social: "solitary"},
    // Crocodilians walk the bank and swim (their text often says neither).
    Crocodylidae: {also: ["swim"]},
    Alligatoridae: {also: ["swim"]},
    Gavialidae: {also: ["swim"]},
    // Ants and termites: the colony's nest (underground, in a mound or in wood) where the text does not say.
    Formicidae: {roost: "burrow"},
    Termitidae: {roost: "burrow"},
    Rhinotermitidae: {roost: "burrow"},
    Cyprinidae: {social: "school"},
    Clupeidae: {social: "school"},
    Scombridae: {social: "school"},
    Engraulidae: {social: "school"}
};
const ORDER_PRIORS: Record<string, Prior> = {
    Galliformes: {social: "flock", move: "walk", also: ["fly"]},
    Anseriformes: {social: "flock", move: "swim", also: ["fly", "walk"], roost: "water"},
    Sphenisciformes: {social: "colony", move: "swim", also: ["walk"], extra: ["dive"]},
    Cetacea: {social: "group"},
    Lagomorpha: {diet: "grazer"},
    Perissodactyla: {social: "herd", diet: "grazer"}
};
function priorOf(row: Row): {prior: Prior; name: string} | null {
    const family = row.family_name ?? "";
    if (FAMILY_PRIORS[family]) return {prior: FAMILY_PRIORS[family], name: `family ${family}`};
    const order = row.order_name ?? "";
    if (ORDER_PRIORS[order]) return {prior: ORDER_PRIORS[order], name: `order ${order}`};
    return null;
}

type Move = "walk" | "climb" | "perch" | "fly" | "swim" | "burrow" | "crawl" | "slither" | "hop" | "sessile" | "cling";

const VERTEBRATE_CLASS = /Aves|Mammalia|Reptilia|Amphibia|Actinopterygii|Chondrichthyes|Elasmobranchii|Sarcopterygii|Teleostei/;
const SESSILE = /(?:^|-)(coral|sponge|anemone|barnacle|mussel|oyster|clam|scallop|sea-squirt|tunicate|sea-pen|sea-fan|hydroid|bryozoan|feather-star|tube-worm|fan-worm|cockle|limpet)(?:-|$)/;
const CRAWLER = /(?:^|-)(snail|slug|worm|earthworm|leech|starfish|sea-star|urchin|sea-cucumber|nudibranch|chiton|whelk|periwinkle|conch|millipede|centipede|woodlouse|planarian|flatworm)(?:-|$)/;

/** Lives in the trees: climbs first (a koala, a tree kangaroo, a sloth), not just now and then. */
const ARBOREAL = /\b(arboreal|tree[- ]dwelling|anchored in trees|lives? in (the )?trees|spends? (most|much|nearly all|almost all) of (its|the|their) (life|lives|time) in (the )?(trees|canopy)|rarely (comes|descends) to the ground)\b/i;
const OTTER = /(?:^|-)otters?$/;
const WATER_SWIMMER = /(?:^|-)(shrimp|prawn|krill)(?:-|$)/;
const WATER_WALKER = /(?:^|-)(shrimp|prawn|krill|lobster|crayfish|horseshoe-crab)(?:-|$)/;
/** Hoofed and other big ground mammals: they never climb or roost in a tree. */
const BIG_GROUND = /^(Artiodactyla|Perissodactyla|Proboscidea|Cetartiodactyla)$/;
/** A bird's text that says it does not fly. */
const FLIGHTLESS = /\b(flightless|cannot fly|can't fly|unable to fly|does not fly|never flies)\b/i;

function movesOf(row: Row, plan: string, layer: string, mode: string, zone: string, rig: Rig | undefined, roost: Roost): {primary: Move; also: Move[]; src: Record<string, Source>} {
    const slug = row.slug!;
    const src: Record<string, Source> = {};
    const also = new Set<Move>();
    let primary: Move;
    const sea = SEA_ZONES.has(zone);
    const clips = new Set(rig?.clips_pass ?? []);
    // (Slug words name invertebrates only: the barnacle goose is a goose, the snail kite a kite.)
    const vertebrate = VERTEBRATE_CLASS.test(row.class_name ?? "");
    if (SESSILE.test(slug) && !vertebrate) {
        primary = "sessile";
        src.move = {rule: `slug names a sessile animal (${SESSILE.exec(slug)![1]})`};
    } else if (CRAWLER.test(slug) && !vertebrate && !["legless", "lizard", "fish"].includes(plan)) {
        primary = "crawl";
        src.move = {rule: `slug names a crawler (${CRAWLER.exec(slug)![1]})`};
    } else
        switch (plan) {
            case "fish":
            case "cephalopod_jelly":
                primary = "swim";
                src.move = {rule: `plan ${plan}`};
                break;
            case "turtle":
                primary = sea || /sea-turtle|turtle$/.test(slug) && sea ? "swim" : "walk";
                if (primary === "walk" && WATER_ZONES.has(zone)) also.add("swim");
                src.move = {rule: `plan turtle in ${zone}`};
                break;
            case "flying_bird":
            case "bat":
                primary = "fly";
                also.add("perch");
                if (clips.has("walk") || clips.has("hop")) also.add(clips.has("walk") ? "walk" : "hop");
                src.move = {rule: `plan ${plan}`};
                break;
            case "flying_insect":
                primary = "fly";
                also.add("cling");
                if (clips.has("walk")) also.add("walk");
                src.move = {rule: "plan flying_insect"};
                break;
            case "primate":
                primary = layer === "canopy" ? "climb" : "walk";
                also.add(primary === "climb" ? "walk" : "climb");
                src.move = {rule: `plan primate, layer ${layer}`};
                break;
            case "legless":
                // An eel is a fish however it looks; a slow-worm or a snake slithers.
                primary = /Actinopterygii|Chondrichthyes|Elasmobranchii|Teleostei/.test(row.class_name ?? "") || /Anguilliformes|Gymnotiformes|Synbranchiformes/.test(row.order_name ?? "") ? "swim" : "slither";
                src.move = {rule: primary === "swim" ? `plan legless, class ${row.class_name ?? row.order_name}: a fish` : "plan legless"};
                break;
            case "other":
                primary = sea ? "swim" : "crawl";
                src.move = {rule: `plan other in ${zone}`};
                break;
            default:
                primary = layer === "underground" ? "burrow" : layer === "canopy" && (mode === "climb" || mode === "hang" || mode === "leap") ? "climb" : "walk";
                src.move = {rule: `plan ${plan}, layer ${layer}${mode ? ` (${mode})` : ""}`};
        }
    // Water crustaceans by name: shrimps and prawns swim (and walk the bottom); lobsters, crayfish and horseshoe crabs
    // walk the bottom (`seabed`). Crabs are left to their text: many are land or shore crabs.
    if (plan === "crustacean" && WATER_ZONES.has(zone) && WATER_SWIMMER.test(slug)) {
        also.add("walk");
        primary = "swim";
        src.move = {rule: `a water crustacean (${WATER_SWIMMER.exec(slug)![1]}): swims`};
    }
    // Otters swim (the sea otter first: it lives on the water and floats on its back).
    if (OTTER.test(slug)) {
        also.add("swim");
        if (/^sea-/.test(slug) || SEA_ZONES.has(zone)) {
            also.add("walk");
            primary = "swim";
            src.move = {rule: "a sea otter: lives on the water"};
        }
        src.swim = {rule: "an otter: swims"};
    }
    // Seals, sea lions and walruses swim first and haul out.
    if (/^(Phocidae|Otariidae|Odobenidae)$/.test(row.family_name ?? "")) {
        also.add("walk");
        primary = "swim";
        src.move = {rule: `family ${row.family_name}: swims, hauls out`};
    }
    // An arboreal mammal its text puts in the trees climbs first.
    if (primary === "walk" && plan === "quadruped") {
        const trees = find(row, ["habitat", "sleep", "look", "traits"], /\b(arboreal|lives in trees|tree-dwelling|spends? (most of its|nearly all its) (life|time) in (the )?trees|in the canopy)\b/i);
        if (trees) {
            also.add("walk");
            primary = "climb";
            src.move = {field: trees.field, phrase: trees.phrase};
        }
    }
    // Its family's way of moving where the plan can't see it: ducks and loons on the water, fowl on the ground.
    const prior = priorOf(row);
    if (prior?.prior.move && primary !== "sessile" && prior.prior.move !== primary) {
        also.add(primary);
        primary = prior.prior.move;
        src.move = {rule: `${prior.name}: ${primary}`};
    }
    for (const extra of prior?.prior.also ?? []) {
        also.add(extra);
        src[`move.${extra}`] = {rule: `${prior!.name}: ${extra}`};
    }
    // A bird its text puts on the ground walks first (and flies when it must).
    if (primary === "fly" && (plan === "flying_bird" || plan === "walking_bird")) {
        const ground = find(row, BEHAVIOUR_TEXT, /\b(ground[- ](dwelling|bird|forager)|terrestrial|walks (steadily|through|on)|forages? (mostly |mainly )?on the ground|feeds? (mostly |mainly )?on the ground|rarely flies|seldom flies|reluctant to fly|prefers to (walk|run))\b/i);
        if (ground) {
            also.add("fly");
            primary = "walk";
            src.move = {field: ground.field, phrase: ground.phrase};
        }
    }
    // The text adds what the plan can't see: a swimmer, a climber, a digger, a hopper.
    const swim = find(row, BEHAVIOUR_TEXT, /\b(swim(s|ming)?|dives? (under|underwater|beneath|below|for fish|to the bottom)|diving (duck|bird|for fish|underwater)|paddl\w+|aquatic|semi-aquatic|float(s|ing)? on (its|the|their) backs?)\b/i);
    if (swim && primary !== "swim" && primary !== "sessile") {
        also.add("swim");
        src.swim = {field: swim.field, phrase: swim.phrase};
    }
    const climb = find(row, BEHAVIOUR_TEXT, /\b(climb(s|ing|er)?|arboreal|clambers?)\b/i);
    if (climb && !["climb", "swim", "sessile"].includes(primary)) {
        also.add("climb");
        src.climb = {field: climb.field, phrase: climb.phrase};
    }
    const dig = find(row, BEHAVIOUR_TEXT, /\b(dig(s|ging)?(?! (a |its |their )?nests?)|burrow(s|ing)?|excavat\w+|fossorial)\b/i);
    if (dig && primary !== "burrow" && primary !== "sessile" && primary !== "fly") {
        also.add("burrow");
        src.burrow = {field: dig.field, phrase: dig.phrase};
    }
    if (plan === "amphibian" && clips.has("leap")) also.add("hop");
    // A walking bird (a dove, a pigeon, a tinamou, a secretarybird) still flies: up to its roost, away from danger.
    if (plan === "walking_bird" && /Aves/.test(row.class_name ?? "") && !also.has("fly") && primary !== "fly") {
        const grounded = find(row, ALL, FLIGHTLESS);
        if (!grounded) {
            also.add("fly");
            src["move.fly"] = {rule: "plan walking_bird: a bird that flies"};
        }
    }
    // A mammal of the trees climbs first (the koala's "anchored in trees"); one that sleeps in a tree climbs to it.
    if ((plan === "quadruped" || plan === "primate") && primary === "walk") {
        const trees = find(row, ["habitat", "sleep", "look", "traits", "facts", "spotlight"], ARBOREAL);
        if (trees) {
            also.add("walk");
            primary = "climb";
            src.move = {field: trees.field, phrase: trees.phrase};
        }
    }
    const treeRoost = roost === "tree" || roost === "tree_hole" || roost === "bark" || (roost === "nest" && /\b(trees?|branch\w*|canopy|dreys?|tree cavit\w*)\b/i.test(FIELD_OF.sleep(row) ?? ""));
    if (treeRoost && !BIG_GROUND.test(row.order_name ?? "") && !["fly", "climb", "swim", "sessile"].includes(primary) && !also.has("fly") && !also.has("climb") && ["quadruped", "primate", "lizard", "legless", "amphibian", "insect", "arachnid", "crustacean"].includes(plan)) {
        also.add("climb");
        src.climb = {rule: `roost ${roost}: climbs to it`};
    }
    also.delete(primary);
    return {primary, also: [...also], src};
}

type Social = "solitary" | "pair" | "group" | "herd" | "flock" | "school" | "colony" | "pack" | "troop" | "swarm";
const GROUP_WORDS: Array<[RegExp, Social]> = [
    [/\bherds?\b/i, "herd"],
    [/\bflocks?\b|\bflocking\b/i, "flock"],
    [/\b(schools?|schooling|shoals?|shoaling)\b/i, "school"],
    [/\bcolon(y|ies|ial)\b/i, "colony"],
    [/\bpacks?\b(?! ice)/i, "pack"],
    [/\btroops?\b/i, "troop"],
    [/\bswarm(s|ing)?\b/i, "swarm"]
];

/** Another kind's group just before a group word ("seal colonies" for a shark; not "penguin colonies" for a penguin). */
const OTHER_KIND = /\b(seals?|sea lions?|penguins?|seabirds?|birds?|fish|prey|cattle|sheep|goats?|deer|antelopes?|wildebeest|zebras?|gazelles?|monkeys?|rodents?|bats?|ants?|termites?|bees?|wasps?|gulls?|terns?)\s+$/i;
/** Where the group is, not whose: "near seal colonies", "around the colony", "visits herds". */
const GROUP_PLACE = /\b(near|around|beside|outside|visit\w*|raid\w*|among)\s+(\w+\s+)?$/i;
/** Feeding into a group is the prey's group: the blue whale "lunging open-mouthed into a swarm". */
const FEEDING_INTO = /\b(lung\w*|charg\w*|plung\w*|div\w*|feed\w*|eat\w*|hunt\w*|attack\w*)\b[^.]{0,40}\binto\s+(a\s+|the\s+)?$/i;
function groupVeto(row: Row): (before: string) => boolean {
    const own = `${row.name ?? ""} ${row.slug ?? ""}`.toLowerCase();
    return (before) => {
        const kind = OTHER_KIND.exec(before);
        if (kind && !own.includes(kind[1].toLowerCase().replace(/s$/, "").replace(/ lion$/, "-lion"))) return true;
        return GROUP_PLACE.test(before) || FEEDING_INTO.test(before);
    };
}

function socialOf(row: Row, plan: string): {value: Social; src: Source} {
    const kindFromText = (text: string | null) => {
        if (!text) return null;
        for (const [pattern, kind] of GROUP_WORDS) {
            const m = pattern.exec(text);
            if (m) return {kind, phrase: clause(text, m.index, m[0].length)};
        }
        return null;
    };
    const stored = row.sociality;
    if (stored === "solitary" || stored === "pair") return {value: stored, src: {field: "sociality", phrase: row.sociality_phrase ?? stored}};
    if (stored === "group") {
        const own = kindFromText(row.sociality_phrase);
        if (own) return {value: own.kind, src: {field: "sociality", phrase: row.sociality_phrase ?? own.phrase}};
        // (Not the diet text: its groups are the prey's, "small schooling fish".)
        const hit = find(row, BEHAVIOUR_TEXT, new RegExp(GROUP_WORDS.map(([p]) => p.source).join("|"), "i"), groupVeto(row));
        const kind = hit ? kindFromText(hit.phrase) : null;
        if (hit && kind) return {value: kind.kind, src: {field: hit.field, phrase: hit.phrase}};
        return {value: "group", src: {field: "sociality", phrase: row.sociality_phrase ?? "group"}};
    }
    const group = find(row, BEHAVIOUR_TEXT, new RegExp(GROUP_WORDS.map(([p]) => p.source).join("|"), "i"), groupVeto(row));
    if (group) {
        const kind = kindFromText(group.phrase);
        if (kind) return {value: kind.kind, src: {field: group.field, phrase: group.phrase}};
    }
    // Insects and others gathering in numbers (the lanternfly's "large numbers"): a swarm.
    const crowd = find(row, BEHAVIOUR_TEXT, /\b(communit(y|ies) of|lives? in (\w+ )?communities|aggregat\w+|in large numbers|in (huge |great )?numbers|gather(s|ing)? in (groups|numbers|masses)|(several|many) (animals|individuals|adults) (often )?share|share (the same|a|one) (shelter|den|burrow|roost|nest|hollow))\b/i);
    if (crowd) return {value: ["insect", "flying_insect", "arachnid", "crustacean", "other"].includes(plan) ? "swarm" : "group", src: {field: crowd.field, phrase: crowd.phrase}};
    const alone = find(row, BEHAVIOUR_TEXT, /\b(solitary|alone|singly|territorial)\b/i);
    if (alone) return {value: "solitary", src: {field: alone.field, phrase: alone.phrase}};
    const pair = find(row, BEHAVIOUR_TEXT, /\b(in pairs|pairs|mated pair|with its mate)\b/i);
    if (pair) return {value: "pair", src: {field: pair.field, phrase: pair.phrase}};
    const prior = priorOf(row);
    if (prior?.prior.social) return {value: prior.prior.social, src: {rule: `${prior.name}: ${prior.prior.social}`}};
    return {value: "solitary", src: {default: `no sociality stored or written (plan ${plan})`}};
}

type Diet = "grazer" | "browser" | "seeds" | "fruit" | "nectar" | "insects" | "fish" | "meat" | "carrion" | "filter" | "algae" | "omnivore" | "detritus" | "blood";
const DIET_WORDS: Array<[RegExp, Diet]> = [
    [/\b(grass(es)?|graz\w+|sedges?|herbage)\b/i, "grazer"],
    [/\b(leaves|foliage|browse\w*|shoots|twigs|bark|buds|leafy|sap|plant juices)\b/i, "browser"],
    [/\b(seeds?|grains?|nuts?|acorns?)\b/i, "seeds"],
    [/\b(fruits?|berries|figs)\b/i, "fruit"],
    [/\b(nectar|pollen|feeds? (at|on) flowers)\b/i, "nectar"],
    [/\b(insects?|caterpillars?|beetles?|ants|termites|larvae|grubs|spiders?|invertebrates?|worms?|bugs|aphids|flies|aerial plankton)\b/i, "insects"],
    [/\b(fish|fishes|squid)\b/i, "fish"],
    [/\b(meat|prey|mammals|rodents?|rabbits?|hares?|squirrels?|voles?|mice|lemmings?|rats|grouse|ptarmigans?|birds|lizards?|snakes?|frogs?|deer|antelopes?|gazelles?|ungulates|monkeys?|seals|hunt\w*|vertebrates)\b/i, "meat"],
    [/\b(carrion|carcass\w*|scaveng\w+|dead animals)\b/i, "carrion"],
    // ("Aerial plankton" is a swift's insects, above; krill caught one by one is a hunter's, `dietOf`.)
    [/\b((?<!aerial )plankton|krill|filter\w*|suspended)\b/i, "filter"],
    [/\b(algae|seaweed|kelp|biofilm)\b/i, "algae"],
    [/\b(detritus|decaying|rotting|dung|leaf litter)\b/i, "detritus"],
    [/\b(blood[- ]?meals?|blood[- ]feed\w*|suck\w* blood|feeds? on (the )?blood|drinks? blood|on blood)\b/i, "blood"]
];

function dietOf(row: Row, plan: string): {value: Diet; also: Diet[]; src: Source} {
    // The adult's food: for an insect or an amphibian a sentence whose subject is its young ("Caterpillars eat the
    // leaves...") is left out (for a bird, "Caterpillars ... are the main food" is its food).
    const metamorphic = /Insecta|Amphibia/.test(row.class_name ?? "") || ["insect", "flying_insect", "amphibian"].includes(plan);
    const text = row.diet_summary && metamorphic ? row.diet_summary.split(/(?<=[.;])\s+/).filter((sentence) => !/^(the |its |their )?(larva|larvae|caterpillars?|nymphs?|naiads?|tadpoles?|grubs|maggots)\b/i.test(sentence)).join(" ") || null : row.diet_summary;
    const found: Array<{diet: Diet; index: number; phrase: string}> = [];
    if (text) {
        // Its own name is not its food ("Goitered Gazelle feeds on grasses", "Roloway Monkey feeds on fruit").
        const own = row.name ? new RegExp(row.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi") : null;
        const scan = own ? text.replace(own, (m) => " ".repeat(m.length)) : text;
        for (const [pattern, diet] of DIET_WORDS) {
            const m = pattern.exec(scan);
            if (m) found.push({diet, index: m.index, phrase: clause(text, m.index, m[0].length)});
        }
    }
    found.sort((a, b) => a.index - b.index);
    // Filter feeding is a way of eating (baleen, gill rakers, a sieving bill, a sessile animal's fan), not a food: a
    // penguin, a petrel, an auklet or a seal that catches krill one by one hunts in the water, as a fish eater does.
    const sieves = /\b(filter\w*|siev\w+|strain\w*|baleen|gill rakers|lamellae)\b/i.test(text ?? "") || /^(Balaenidae|Balaenopteridae|Eschrichtiidae|Neobalaenidae|Phoenicopteridae|Rhincodontidae|Cetorhinidae|Megachasmidae|Mobulidae)$/.test(row.family_name ?? "") || SESSILE.test(row.slug ?? "");
    const hunter = /Aves|Mammalia|Reptilia/.test(row.class_name ?? "") && !sieves;
    for (const f of found) if (f.diet === "filter" && hunter) f.diet = "fish";
    // "Grazes algae", "grazes biofilm": the verb, with no grass in the text, is the food named, not grass.
    const grassNamed = /\b(grass(es)?|sedges?|herbage|hay)\b/i.test(text ?? "");
    if (!grassNamed && found.some((f) => f.diet === "algae" || f.diet === "detritus")) found.splice(0, found.length, ...found.filter((f) => f.diet !== "grazer"));
    // A baleen whale's food is filtered whatever the text calls it (the gray whale's "amphipods"); a seal's or a
    // walrus's clams and crabs are caught in the water, as a fish eater's are (the diet kinds have no "invertebrates").
    const baleen = /^(Balaenidae|Balaenopteridae|Eschrichtiidae|Neobalaenidae)$/.test(row.family_name ?? "");
    const seaHunter = /Mammalia|Aves|Reptilia/.test(row.class_name ?? "") && (/^(Phocidae|Otariidae|Odobenidae|Spheniscidae|Alcidae|Delphinidae|Phocoenidae|Monodontidae|Physeteridae|Ziphiidae|Lutrinae|Enhydra)$/.test(row.family_name ?? "") || OTTER.test(row.slug ?? ""));
    for (const f of found) {
        if (baleen && (f.diet === "insects" || f.diet === "fish")) f.diet = "filter";
        else if (seaHunter && f.diet === "insects") f.diet = "fish";
    }
    if (found.length) {
        const kinds = [...new Set(found.map((f) => f.diet))];
        const plants = kinds.filter((k) => ["grazer", "browser", "seeds", "fruit", "nectar", "algae"].includes(k)).length;
        const animals = kinds.filter((k) => ["insects", "fish", "meat", "carrion"].includes(k)).length;
        const value: Diet = /omnivor/i.test(text ?? "") && plants >= 1 && animals >= 1 ? "omnivore" : found[0].diet;
        return {value, also: kinds.filter((k) => k !== value).slice(0, 3), src: {field: "diet", phrase: found[0].phrase}};
    }
    const ambient = row.ambient ?? [];
    const map: Record<string, Diet> = {grass: "grazer", plants: "browser", seeds: "seeds", fruit: "fruit", nectar: "nectar", insects: "insects", worms: "insects", plankton: "filter", algae: "algae", detritus: "detritus", dung: "detritus"};
    for (const [i, a] of ambient.entries()) if (map[a] && !(metamorphic && YOUNG.test(row.ambient_phrases?.[i] ?? ""))) return {value: map[a] === "filter" && hunter ? "fish" : map[a], also: [], src: {field: "ambient", phrase: row.ambient_phrases?.[i] ?? a}};
    const prior = priorOf(row);
    if (prior?.prior.diet) return {value: prior.prior.diet, also: [], src: {rule: `${prior.name}: ${prior.prior.diet}`}};
    const byPlan: Record<string, Diet> = {fish: "omnivore", insect: "omnivore", flying_insect: "nectar", arachnid: "insects", bat: "insects", lizard: "insects", amphibian: "insects", legless: "meat", other: "detritus"};
    return {value: byPlan[plan] ?? "omnivore", also: [], src: {default: `no diet written (plan ${plan})`}};
}

// MARK: Behaviours and interaction points

/** The states an animal can be in (visual only) and how much of its waking time each wants (0–1). */
export const BEHAVIOURS = ["rest", "wander", "forage", "graze", "drink", "perch", "soar", "fly", "swim", "dive", "bask", "burrow", "climb", "groom", "hide", "flee", "flock", "visit_flowers", "circle_light", "stalk"] as const;
type Behaviour = (typeof BEHAVIOURS)[number];

/** Places in the world an animal goes to (the map lane's spawn tags and the graphics lane's attach points). */
export const INTERACTIONS = ["drink_edge", "bask_rock", "graze_grass", "perch_branch", "perch_rock", "dig_soil", "leaf_litter", "flower", "porch_light", "cave_mouth", "cliff_ledge", "sea_dive", "tide_pool", "bark", "wall", "burrow_mouth", "reeds", "water_surface", "reef", "shade", "shore"] as const;
type Interaction = (typeof INTERACTIONS)[number];

type Profile = {
    slug: string;
    id: string;
    name: string;
    zone: string | null;
    excluded: string | null;
    plan: string;
    rig: string | null;
    /**
     * Its rig's fastest passing ground clip (walk, run, slither, hop, swim), in body lengths a second at the clip's
     * own pace (rig manifest `ground_speed`): the schedule never moves it faster than its feet can keep up with.
     */
    gait: number | null;
    /**
     * Its walk's and its run's own pace (body lengths a second): the clip's `ground_speed` over its duty (v1 measures
     * ground speed while a foot is planted: walk 0.62, run 0.38, 0.72 when it has none). The schedule moves it no faster
     * than 1.5 times its walk's pace (runs at its run's), so its feet keep up.
     */
    walkPace: number | null;
    runPace: number | null;
    move: Move;
    moves: Move[];
    activity: Activity;
    rhythm: string[];
    roost: Roost;
    social: Social;
    diet: Diet;
    diets: Diet[];
    size: number | null;
    speed: number | null;
    dominance: number | null;
    behaviours: Partial<Record<Behaviour, number>>;
    interactions: Interaction[];
    /** A flyer's height band: low (insects, small bats), mid (songbirds), high (raptors and other soarers). */
    altitude: "low" | "mid" | "high" | null;
    /** How it holds to a surface: "any" crawls along any surface aligned to its normal, "upside" also upside down (geckos, spiders). */
    surface: "any" | "upside" | null;
    /** A swimmer that breathes air: it comes up to breathe and dives back to its depth band. */
    breathes: boolean;
    /** Walks on the sea floor (crabs, lobsters, stars, urchins). */
    seabed: boolean;
    src: Record<string, Source | Source[]>;
    defaults: string[];
};

const PREY_SIZE = 40;

function profile(row: Row): Profile {
    const slug = row.slug!;
    const zone = row.zone ?? "";
    const rig = manifest[slug];
    const {plan, src: planSrc} = planOf(row);
    const layerRow = layers[slug];
    const layer = layerRow?.[0] ?? "ground";
    const mode = layerRow?.[1] ?? "";
    const microRow = micro[slug];
    const spawnInfo = b1.get(row.id);
    const spawn = new Set(spawnInfo?.spawn ?? []);
    const stats = row.stats ?? {};
    const size = row.size ?? stats.size ?? null;
    const speed = row.speed ?? stats.speed ?? null;
    const dominance = row.dominance ?? stats.dominance ?? null;

    const activity = activityOf(row, plan);
    const rhythm = rhythmOf(row, activity.value);
    const roostFound = roostOf(row, plan, layer, zone);
    const moves = movesOf(row, plan, layer, mode, zone, rig, roostFound.value);
    const social = socialOf(row, plan);
    const diet = dietOf(row, plan);

    // Seabed walkers (crabs, lobsters, stars, urchins, bottom fish): its ground is the sea floor.
    const allMoves = new Set([moves.primary, ...moves.also]);
    const bottomHit = ["fish", "crustacean", "other", "cephalopod_jelly"].includes(plan) ? find(row, ["habitat", "look", "sleep", "traits"], /\b(sea ?floor|seabed|sea bed|bottom[- ]dwell\w*|on the bottom|benthic|stream ?bed|river ?bed|lake ?bed)\b/i) : null;
    const bottomText: Source | null = bottomHit ? {field: bottomHit.field, phrase: bottomHit.phrase} : null;
    const seabed = (SEA_ZONES.has(zone) && (plan === "crustacean" || moves.primary === "crawl" || layer === "reef" && mode === "floor" || /(?:^|-)(crab|lobster|starfish|sea-star|urchin|sea-cucumber|octopus)(?:-|$)/.test(slug))) || (Boolean(bottomText) && moves.primary !== "fly") || (plan === "crustacean" && WATER_ZONES.has(zone) && (allMoves.has("swim") || WATER_WALKER.test(slug)));
    // Where it sleeps, fitted to how it lives (rules, 2026-11-11 audit):
    // - a water animal never sleeps on land: a burrow, crevice, cave or ledge it rests in is on the bottom (the reef
    //   on a coral reef), anything else is in the water (fish "among branches" of coral, catfish "in hollows in the mud");
    // - one that hauls out (seals, sea lions, the walrus, penguins) rests at the shore;
    // - one that climbs first (a koala) sleeps in the trees when its text does not say where.
    const waterLife = seabed || (moves.primary === "swim" && !moves.also.includes("walk"));
    const HAULS = find(row, ALL, /\b(haul(s|ed|ing)? out|haul-outs?|ashore|on (the )?(beach|beaches|shore|ice|sea ice|ice floes?|pack ice)|ice floes?)\b/i);
    const hauls = !waterLife && moves.primary === "swim" && moves.also.includes("walk") && (/^(Phocidae|Otariidae|Odobenidae|Spheniscidae)$/.test(row.family_name ?? "") || Boolean(HAULS));
    let roost = roostFound;
    const LAND_ROOSTS: Roost[] = ["tree", "tree_hole", "cliff", "cave", "crevice", "rocks", "burrow", "den", "ground_cover", "reeds", "leaf", "bark", "wall", "nest", "shore"];
    if (waterLife && LAND_ROOSTS.includes(roost.value)) {
        const under = ["burrow", "den", "cave", "crevice", "rocks", "cliff", "tree_hole", "nest"].includes(roost.value) || (roost.value === "tree" && zone === "coral_reef");
        const value: Roost = under ? (zone === "coral_reef" ? "reef" : "bottom") : "water";
        roost = {value, src: "default" in roost.src ? {default: `lives in the water: ${value}`} : {rule: `lives in the water: its ${roost.value} is ${value}${"phrase" in roost.src ? ` ("${roost.src.phrase}")` : ""}`}};
    } else if (hauls && ("default" in roost.src || ["ground_cover", "rocks", "cliff", "open", "water"].includes(roost.value))) {
        roost = {value: "shore", src: HAULS ? {field: HAULS.field, phrase: HAULS.phrase} : {rule: `family ${row.family_name}: hauls out at the shore`}};
    } else if (moves.primary === "swim" && !("phrase" in roost.src) && LAND_ROOSTS.includes(roost.value)) {
        // A swimmer whose text doesn't say where it sleeps sleeps on the water (the sea otter: not its family's den).
        roost = {value: "water", src: {rule: `swims first, no roost written: on the water (not ${roost.value})`}};
    } else if (moves.primary === "climb" && "default" in roost.src && roost.value !== "tree" && roost.value !== "tree_hole") {
        roost = {value: "tree", src: {rule: "climbs first: sleeps in the trees"}};
    } else if (BIG_GROUND.test(row.order_name ?? "") && ["tree", "tree_hole", "bark"].includes(roost.value)) {
        // A deer, an antelope, a rhino or an elephant rests among trees, never in one.
        roost = {value: "ground_cover", src: {rule: `order ${row.order_name}: rests on the ground${"phrase" in roost.src ? ` ("${roost.src.phrase}")` : ""}`}};
    }

    const src: Record<string, Source | Source[]> = {plan: planSrc, activity: activity.src, roost: roost.src, social: social.src, diet: diet.src, ...moves.src};
    if (rhythm.src.length) src.rhythm = rhythm.src;
    const defaults = Object.entries(src).filter(([, s]) => !Array.isArray(s) && "default" in s).map(([k]) => k);

    const b: Partial<Record<Behaviour, number>> = {};
    const add = (k: Behaviour, w: number, why?: Source) => {
        b[k] = Math.max(b[k] ?? 0, Math.round(w * 100) / 100);
        if (why) src[`b.${k}`] = why;
    };
    const textHit = (pattern: RegExp, fields: TextField[] = BEHAVIOUR_TEXT) => {
        const hit = find(row, fields, pattern);
        return hit ? ({field: hit.field, phrase: hit.phrase} as Source) : null;
    };
    const all = new Set([moves.primary, ...moves.also]);
    const mobile = moves.primary !== "sessile";
    add("rest", mobile ? 0.25 : 1);
    if (mobile) add("wander", moves.primary === "fly" ? 0.15 : 0.3);
    if (mobile) add("forage", 0.5);
    // Grazing only for a plant-eater whose food is grass (not a meat eater's "grassland rodents").
    if (diet.value === "grazer" || (diet.also.includes("grazer") && ["browser", "seeds", "omnivore"].includes(diet.value) && !all.has("fly"))) add("graze", 0.7, src.diet as Source);
    if (all.has("fly")) add("fly", plan === "flying_insect" ? 0.6 : 0.5);
    if (all.has("perch")) add("perch", 0.45);
    // (A swimmer's cruising is one of its states, not all of them: 0.55 against forage 0.5, so its days vary.)
    if (all.has("swim")) add("swim", moves.primary === "swim" ? 0.55 : 0.3);
    if (all.has("climb")) add("climb", moves.primary === "climb" ? 0.7 : 0.3);
    if (all.has("burrow")) add("burrow", moves.primary === "burrow" ? 0.8 : 0.3);
    const land = !SEA_ZONES.has(zone) && moves.primary !== "swim" && mobile;
    const drinker = land && ["quadruped", "primate", "walking_bird", "flightless_bird", "flying_bird", "bat", "lizard", "turtle"].includes(plan);
    if (drinker) add("drink", 0.15, textHit(/\b(drink\w*|waterholes?|water holes?)\b/i) ?? undefined);
    const soarText = textHit(/\b(soar\w*|thermals?|circl\w+ (high|overhead)|high overhead)\b/i);
    const SOARERS = /^(Accipitridae|Cathartidae|Pandionidae|Sagittariidae|Ciconiidae|Pelecanidae|Diomedeidae|Fregatidae|Gruidae|Procellariidae)$/;
    if (all.has("fly") && plan === "flying_bird" && (soarText || SOARERS.test(row.family_name ?? ""))) add("soar", soarText ? 0.6 : 0.35, soarText ?? {rule: `family ${row.family_name}: soars`});
    const diveText = textHit(/\b(plunge[- ]div\w*|dives? (into|for|from)|diving (for|into))\b/i);
    if (diveText && all.has("fly")) add("dive", 0.3, diveText);
    const baskText = textHit(/\b(bask\w*|sunn(ing|y rocks?)|in the sun|sun itself|warms? (up )?in)\b/i);
    const ectotherm = (["lizard", "turtle"].includes(plan) || /Reptilia/.test(row.class_name ?? "")) && !SEA_ZONES.has(zone);
    if (baskText || (ectotherm && mobile)) add("bask", baskText ? 0.5 : 0.3, baskText ?? {default: `plan ${plan}: warms in the sun`});
    const groomer = ["quadruped", "primate", "bat", "flying_bird", "walking_bird", "flightless_bird"].includes(plan);
    if (groomer) add("groom", plan === "primate" ? 0.3 : 0.12, textHit(/\b(groom\w*|preen\w*)\b/i) ?? undefined);
    const prey = (size ?? 50) <= PREY_SIZE && !["meat", "fish"].includes(diet.value);
    const hideText = textHit(/\b(hid(e|es|ing)|camouflag\w*|cryptic|freez(e|es|ing)|motionless|keeps? still)\b/i);
    if (hideText || prey) add("hide", hideText ? 0.3 : 0.15, hideText ?? {default: `small (size ${size}) and not a hunter`});
    if (prey && mobile) add("flee", 0.2);
    if (["herd", "flock", "school", "colony", "pack", "troop", "swarm", "group"].includes(social.value) && mobile) add("flock", 0.6, src.social as Source);
    const nectarText = textHit(/\b(nectar|pollen|visits? flowers|flower visitor|feeds? at flowers|on flowers)\b/i, ["diet", "look", "traits", "facts", "sleep"]);
    const nectar = Boolean(nectarText) && (diet.value === "nectar" || diet.also.includes("nectar") || plan === "flying_insect");
    if (nectar && all.has("fly")) add("visit_flowers", diet.value === "nectar" ? 0.6 : 0.35, nectarText!);
    const lightText = textHit(/\b(come[s]? to lights?|attracted to (artificial )?lights?|at lights|to lamps?|light traps?)\b/i, ["sleep", "look", "facts", "traits"]);
    const moth = microRow?.[2]?.includes("m");
    if (lightText || (moth && activity.value === "nocturnal")) add("circle_light", 0.5, lightText ?? {default: "the scene's moth flag (microhabitats.json m), awake at night"});
    if (["meat", "fish"].includes(diet.value) && mobile) add("stalk", 0.25, src.diet as Source);
    const prior = priorOf(row);
    for (const extra of prior?.prior.extra ?? []) add(extra, 0.3, {rule: `${prior!.name}: ${extra}`});

    // Places it goes to: from its behaviours, its spawn tags (B1) and its roost.
    const it = new Set<Interaction>();
    if (b.drink) it.add("drink_edge");
    // A seal or a penguin hauls out at the shore to rest and bask (not on a rock top inland).
    if (hauls) {
        add("bask", 0.3, (HAULS ? {field: HAULS.field, phrase: HAULS.phrase} : {rule: `family ${row.family_name}: hauls out`}) as Source);
        it.add("shore");
    }
    if (b.bask && !hauls) it.add("bask_rock");
    // Grass on land only: a sea turtle's or a manatee's grazing is on the bottom, where it is.
    if (b.graze && !waterLife) it.add("graze_grass");
    // Seabirds (albatrosses, petrels, auks, gulls, skuas, penguins) perch on rocks and ledges, never on branches.
    const seabird = /^(Procellariiformes|Sphenisciformes)$/.test(row.order_name ?? "") || /^(Alcidae|Laridae|Stercorariidae)$/.test(row.family_name ?? "");
    if (b.perch && seabird) it.add("perch_rock");
    else if (b.perch || roost.value === "tree" || roost.value === "tree_hole") if (all.has("fly") || all.has("climb")) it.add("perch_branch");
    const rocky = textHit(/\b(rocks?|boulders?|cliffs?|crags?|outcrops?|ledges?)\b/i, ["look", "habitat", "sleep", "traits"]);
    if (b.perch && (roost.value === "cliff" || roost.value === "rocks" || rocky)) it.add("perch_rock");
    if (b.burrow) it.add("dig_soil");
    if (roost.value === "burrow" || roost.value === "den" || (b.burrow && moves.primary !== "fly")) it.add("burrow_mouth");
    const smallGround = ["insect", "arachnid", "amphibian", "lizard", "legless", "other", "crustacean"].includes(plan) || (plan === "quadruped" && (size ?? 99) <= 15) || moves.primary === "crawl" || (plan === "walking_bird" || moves.primary === "walk" && /Aves/.test(row.class_name ?? ""));
    if ((spawn.has("leaves") || spawn.has("forest_floor") || spawn.has("logs_deadwood")) && smallGround && !SEA_ZONES.has(zone) && layer !== "canopy" && moves.primary !== "climb") it.add("leaf_litter");
    if (b.visit_flowers) it.add("flower");
    if (b.circle_light) it.add("porch_light");
    if (roost.value === "cave" || spawn.has("caves")) if (all.has("fly")) it.add("cave_mouth");
    if (roost.value === "cliff" || spawn.has("sea_cliffs") || spawn.has("cliffs")) if (all.has("fly")) it.add("cliff_ledge");
    if (b.dive && (WATER_ZONES.has(zone) || spawn.has("open_ocean") || spawn.has("sea_cliffs"))) it.add("sea_dive");
    if (spawn.has("rocky_shore") && (plan === "crustacean" || moves.primary === "crawl" || plan === "fish")) it.add("tide_pool");
    if (roost.value === "bark" || spawn.has("trunks_bark")) if (["insect", "arachnid", "lizard", "flying_insect", "other"].includes(plan) || moves.primary === "crawl") it.add("bark");
    if (all.has("climb") && all.has("fly")) it.add("bark");

    // The owner's additions (2026-11-11): altitude bands, surface crawlers, air-breathers, seabed walkers.
    // Low: insects, small bats, ground birds and nightjars; high: the soarers; mid: the rest.
    const groundBird = /^(Galliformes|Caprimulgiformes|Tinamiformes|Otidiformes)$/.test(row.order_name ?? "") || /^(Phasianidae|Caprimulgidae|Anatidae)$/.test(row.family_name ?? "") && !b.soar;
    const altitude: Profile["altitude"] = !all.has("fly") ? null : plan === "flying_insect" || (plan === "bat" && (size ?? 0) < 20) || groundBird ? "low" : b.soar ? "high" : "mid";
    if (altitude) src.altitude = b.soar ? (src["b.soar"] as Source) ?? {rule: "soars"} : {rule: `plan ${plan}, size ${size}`};
    const UPSIDE_FAMILIES = /^(Gekkonidae|Phyllodactylidae|Sphaerodactylidae|Diplodactylidae|Eublepharidae|Carphodactylidae)$/;
    const crawler = ["insect", "arachnid"].includes(plan) || moves.primary === "crawl" || (plan === "lizard" && (size ?? 99) <= 12) || /(?:^|-)(caterpillar|ant|beetle|snail|slug|gecko|spider)(?:-|$)/.test(slug);
    const spider = /Araneae/.test(row.order_name ?? "") && !/^(Theraphosidae|Ctenizidae|Atypidae|Hexathelidae|Atracidae)$/.test(row.family_name ?? "");
    const upside = UPSIDE_FAMILIES.test(row.family_name ?? "") || /(?:^|-)gecko(?:-|$)/.test(slug) || spider;
    const surface: Profile["surface"] = moves.primary === "sessile" || SEA_ZONES.has(zone) ? null : upside && crawler ? "upside" : crawler ? "any" : null;
    if (surface) src.surface = {rule: upside ? `${row.family_name ?? plan}: clings upside down` : `plan ${plan}, small crawler`};
    const swimmer = all.has("swim") && (moves.primary === "swim" || SEA_ZONES.has(zone) || ["turtle", "lizard", "legless"].includes(plan) || /^(Phocidae|Otariidae|Odobenidae|Lutrinae|Mustelidae)$/.test(row.family_name ?? ""));
    const airClass = /Mammalia|Reptilia|Aves/.test(row.class_name ?? "") || ["turtle", "quadruped", "flightless_bird"].includes(plan) || /(?:^|-)(whale|dolphin|porpoise|orca|seal|sea-lion|walrus|manatee|dugong|otter|sea-turtle|turtle|penguin|sea-snake)(?:-|$)/.test(slug) && !/(?:^|-)(shark|icefish)(?:-|$)/.test(slug);
    // Birds on the water only count when they dive (penguins, loons, grebes); a duck just floats.
    const breathes = swimmer && airClass && (plan !== "fish" || /Mammalia|Reptilia/.test(row.class_name ?? "")) && (!/Aves/.test(row.class_name ?? "") || Boolean(b.dive) || plan === "flightless_bird");
    if (breathes) src.breathes = {rule: `${row.class_name ?? plan} swimmer`};
    if (seabed) src.seabed = bottomText ?? {rule: layer === "reef" && mode === "floor" ? "layers.json floor" : `plan ${plan} in ${zone}`};
    if (roost.value === "wall" || spawn.has("house")) if (["insect", "arachnid", "lizard", "flying_insect", "other"].includes(plan)) it.add("wall");
    const reedText = textHit(/\breed(s|beds?)?\b/i, ["habitat", "look", "sleep"]);
    if (roost.value === "reeds" || (reedText && ["walking_bird", "flying_bird", "amphibian", "flying_insect"].includes(plan))) it.add("reeds");
    if (all.has("swim") && !SEA_ZONES.has(zone) && moves.primary !== "swim") it.add("water_surface");
    if (zone === "coral_reef") it.add("reef");
    if (rhythm.value.includes("siesta")) it.add("shade");

    return {
        slug,
        id: row.id,
        name: row.name,
        zone: row.zone,
        excluded: row.excluded_reason,
        plan,
        rig: rig ? rig.state : null,
        gait: (() => {
            const ok = new Set(rig?.clips_pass ?? []);
            const speeds = ["walk", "run", "slither", "hop", "swim"].filter((c) => ok.has(c)).map((c) => rig?.clips?.[c]?.ground_speed ?? 0).filter((v) => v > 0);
            return speeds.length ? Math.round(Math.max(...speeds) * 1000) / 1000 : null;
        })(),
        walkPace: clipPace(paceRig(slug), ["walk", "slither", "hop"]),
        runPace: clipPace(paceRig(slug), ["run"]),
        move: moves.primary,
        moves: moves.also,
        activity: activity.value,
        rhythm: rhythm.value,
        roost: roost.value,
        social: social.value,
        diet: diet.value,
        diets: diet.also,
        size,
        speed,
        dominance,
        behaviours: b,
        interactions: [...it],
        altitude,
        surface,
        breathes,
        seabed,
        src,
        defaults
    };
}

/**
 * The first passing clip's own pace of these (body lengths a second, the speed its feet stay planted at, as the
 * scene's rig player plays it), or null. A v2 clip says so (`bls`, else its `ground_speed`, which is sweep / duty
 * already); a v1 clip's `ground_speed` is the stance sweep, so over its duty.
 */
function clipPace({rig, v2}: {rig: Rig | undefined; v2: boolean}, names: string[]): number | null {
    const ok = new Set(rig?.clips_pass ?? []);
    for (const name of names) {
        const clip = rig?.clips?.[name];
        if (!ok.has(name) || !clip?.ground_speed || clip.ground_speed <= 0) continue;
        const pace = v2 ? (clip.bls && clip.bls > 0 ? clip.bls : clip.ground_speed) : clip.ground_speed / (clip.duty && clip.duty > 0 ? clip.duty : 0.72);
        return Math.round(pace * 1000) / 1000;
    }
    return null;
}

// MARK: Run

const profiles = rows.map(profile).sort((a, b) => a.slug.localeCompare(b.slug));
const outFull = path.join(root, "data/ark/behaviour-profiles.json");
fs.mkdirSync(path.dirname(outFull), {recursive: true});
const head = {
    about: "Generated by scripts/ark-behaviour-profiles.mts from the live catalogue (read-only export), the rig manifest and the map lane's B1 microhabitat inventory. Deterministic keyword rules and taxon priors, no AI calls. src: per field, {field, phrase} = the stored field and the verbatim phrase that decided it; {rule} = from the body plan or the stored taxonomy; {default} = data missing, a body-plan default (also listed in defaults). Visual only.",
    generated: new Date().toISOString().slice(0, 10),
    count: profiles.length,
    behaviours: BEHAVIOURS,
    interactions: INTERACTIONS
};
// One profile per line, so a re-run's diff reads species by species.
fs.writeFileSync(outFull, `${JSON.stringify(head).slice(0, -1)},"profiles":[\n${profiles.map((p) => JSON.stringify(p)).join(",\n")}\n]}\n`);

// The compact rows the scene reads: [move, moves, activity, rhythm, roost, social, diet, behaviours, interactions, defaults].
// Behaviours as "k:w" pairs (w ×10), interactions by index; empty strings for none.
const compact: Record<string, string> = {};
for (const p of profiles) {
    if (p.excluded) continue;
    const behaviours = Object.entries(p.behaviours).map(([k, w]) => `${BEHAVIOURS.indexOf(k as Behaviour).toString(36)}${Math.round((w ?? 0) * 9)}`).join("");
    const interactions = p.interactions.map((i) => INTERACTIONS.indexOf(i).toString(36)).join("");
    const flags = [p.defaults.length ? "d" : "", p.breathes ? "b" : "", p.seabed ? "s" : "", p.surface === "upside" ? "u" : p.surface === "any" ? "a" : "", p.altitude ? p.altitude[0] : ""].join("");
    compact[p.slug] = [p.move, p.moves.join(","), p.activity[0], p.rhythm.map((r) => r[0]).join(""), p.roost, p.social, p.diet, behaviours, interactions, flags, p.size ?? "", p.speed ?? "", p.dominance ?? "", p.gait ?? "", p.walkPace ?? "", p.runPace ?? ""].join("|");
}
fs.writeFileSync(
    path.join(root, "src/ark-scene/behaviours.json"),
    `{"about":"Generated by scripts/ark-behaviour-profiles.mts (full profiles with source phrases: data/ark/behaviour-profiles.json). Rows: move|moves|activity d n c a|rhythm (t two peaks, s siesta)|roost|social|diet|behaviours (index base 36 + weight 0-9)|interactions (index base 36)|flags (d a default, b breathes air, s seabed, u/a surface upside/any, l/m/h flight band)|size|speed|dominance|gait (the rig's fastest ground clip, body lengths/s)|walk pace|run pace (the clips' own, ground_speed/duty). Decoded by behaviour-profile.ts.",\n"species":{\n${Object.entries(compact)
        .map(([slug, row]) => `${JSON.stringify(slug)}:${JSON.stringify(row)}`)
        .join(",\n")}\n}}\n`
);

// Summary.
const count = (get: (p: Profile) => string) => profiles.reduce<Record<string, number>>((acc, p) => ((acc[get(p)] = (acc[get(p)] ?? 0) + 1), acc), {});
const live = profiles.filter((p) => !p.excluded);
console.log(`profiles ${profiles.length} (on the Ark, not excluded: ${live.length})`);
console.log("move", count((p) => p.move));
console.log("activity", count((p) => p.activity));
console.log("roost", count((p) => p.roost));
console.log("social", count((p) => p.social));
console.log("diet", count((p) => p.diet));
const defaultsPer: Record<string, number> = {};
for (const p of live) for (const d of p.defaults) defaultsPer[d] = (defaultsPer[d] ?? 0) + 1;
console.log("defaults per field (live)", defaultsPer, "profiles with any default", live.filter((p) => p.defaults.length).length);
const inter: Record<string, number> = {};
for (const p of live) for (const i of p.interactions) inter[i] = (inter[i] ?? 0) + 1;
console.log("interactions", inter);

// The food links the scene keeps predators' ranges apart by (visual only): vertebrate predators of size 15 and up,
// and the vertebrate prey from 0.15 to 1.2 of their size (what a viewer would read as a hunter and its quarry).
if (foodPath) {
    const food: Array<{predator: string; prey: string}> = (JSON.parse(fs.readFileSync(foodPath, "utf8")) as {rows: Array<{predator: string; prey: string}>}).rows;
    const bySlug = new Map(rows.map((r) => [r.slug!, r]));
    const sizeOf = (slug: string) => bySlug.get(slug)?.size ?? bySlug.get(slug)?.stats?.size ?? 0;
    const vertebrate = (slug: string) => {
        const r = bySlug.get(slug);
        return Boolean(r && (/Mammalia|Aves|Reptilia|Amphibia/.test(r.class_name ?? "") || (!r.class_name && r.family_name)));
    };
    const links: Record<string, string[]> = {};
    for (const f of food) {
        const ps = sizeOf(f.predator);
        if (ps < 15 || !vertebrate(f.predator)) continue;
        const prey = f.prey.split(",").filter((y) => vertebrate(y) && sizeOf(y) >= 0.15 * ps && sizeOf(y) <= 1.2 * ps);
        if (prey.length) links[f.predator] = prey;
    }
    const slugs = [...new Set([...Object.keys(links), ...Object.values(links).flat()])].sort();
    const index = new Map(slugs.map((slug, i) => [slug, i]));
    const compactLinks = Object.fromEntries(Object.entries(links).sort(([a], [b]) => a.localeCompare(b)).map(([p, prey]) => [p, prey.map((y) => index.get(y)!.toString(36)).join(",")]));
    fs.writeFileSync(
        path.join(root, "src/ark-scene/food-links.json"),
        `${JSON.stringify({about: "Generated by scripts/ark-behaviour-profiles.mts from voyage_food_links (read-only): predator slug -> its prey (indices into slugs, base 36). Vertebrate predators of size 15+, vertebrate prey of 0.15-1.2 their size. Used only to keep predators' ranges apart from their prey's in the scene (visual only).", slugs, links: compactLinks})}\n`
    );
    console.log(`food links: ${Object.keys(links).length} predators, ${Object.values(links).reduce((n, v) => n + v.length, 0)} links`);
}
