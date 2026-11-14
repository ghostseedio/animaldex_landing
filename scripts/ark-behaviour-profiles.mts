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
    // (Lane MA3 water 2: a crane roosts standing in the shallows, in the marsh's reeds, never in a tree; only the crowned
    // cranes perch in trees, which their sleep text says.)
    Gruidae: {roost: "reeds"},
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
    // Coots live on the open water (the movement audit, lane MA3: the owner's coot ran on the lake): they swim first and
    // walk the bank; rails, crakes and swamphens walk.
    if (row.family_name === "Rallidae" && COOT.test(slug) && primary !== "swim") {
        also.add(primary);
        also.add("walk");
        primary = "swim";
        src.move = {rule: "family Rallidae, a coot: swims first"};
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
    const swim = find(row, BEHAVIOUR_TEXT, /\b(swim(s|ming)?|dives? (under|underwater|beneath|below|for fish|to the bottom)|diving (duck|bird|for fish|underwater)|paddl\w+|aquatic|semi-aquatic|float(s|ing)? on (its|the|their) backs?|rests? in (the )?water|spends? (the|its|their|most of the) days? (submerged|in (the )?water))\b/i);
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
    // Waterfowl, grebes, loons and coots do not perch in trees (the movement audit: a mute swan landed 6 m up in a
    // conifer), save the tree ducks their text says perch or roost in trees (whistling ducks, the wood duck, the
    // mandarin, the muscovy); grebes and loons come ashore only to nest (their legs are set far back): they swim.
    const family = row.family_name ?? "";
    if (WATERFOWL.test(family) || (family === "Rallidae" && primary === "swim")) {
        const perches = roost === "tree" || roost === "tree_hole" ? {rule: `roost ${roost}`} : PERCHING_DUCKS.test(slug) ? {rule: "a perching duck (Aix, Cairina, Dendrocygna, Chenonetta, Nettapus)"} : find(row, ALL, TREE_PERCH);
        if (perches) src["move.perch"] = "rule" in perches ? perches : {field: perches.field, phrase: perches.phrase};
        else if (also.delete("perch")) src["move.perch"] = {rule: `family ${family}: does not perch in trees`};
    }
    if (/^(Podicipedidae|Gaviidae)$/.test(family) && primary === "swim" && (also.has("walk") || also.has("hop"))) {
        also.delete("walk");
        also.delete("hop");
        src["move.walk"] = {rule: `family ${family}: ashore only to nest (legs set far back)`};
    }
    also.delete(primary);
    return {primary, also: [...also], src};
}

/** A coot (Fulica): swims first. */
const COOT = /(?:^|-)coot$/;
/** The waterfowl and the screamers. */
const WATERFOWL = /^(Anatidae|Anhimidae|Anseranatidae|Podicipedidae|Gaviidae)$/;
/** The perching ducks by name (their genera: the wood duck and the mandarin, the muscovy, the whistling ducks, the Australian wood duck, the pygmy geese). */
const PERCHING_DUCKS = /(?:^|-)(wood-duck|whistling-duck|mandarin-duck|muscovy-duck|pygmy-goose)$/;
/** A waterfowl's text that puts it up in the trees: it perches or roosts there (not only a nest hole). */
const TREE_PERCH = /\b(perch(es|ing)? (readily |often )?(in|on|high in) (trees|branches|stumps|the trees|tree branches)|perches readily|roosts? (at night )?(in|high in) trees|roost(s|ing)? in trees)\b/i;

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
    /** How it is in the water (`waterKindOf`): its float line, posture and feeding there; null if it neither swims nor wades. */
    water: WaterKind | null;
    /** Its `fly` weight where its family or way of life sets it (`flightPropensity`), finer than the compact row's ninths. */
    flight: number | null;
    /** Its day (`dayOf`, lane B3 needs): feeding and resting shares of its waking time, its cycle, drinks, sleep. */
    day: Day;
    /** Other weights finer than the compact row's ninths (a hoofed mammal's grooming, 0.05). */
    fine: Partial<Record<Behaviour, number>>;
    src: Record<string, Source | Source[]>;
    defaults: string[];
};

const PREY_SIZE = 40;

// MARK: Waterbirds and swimmers (the movement audit, lane MA3, 2026-11-13)

/**
 * A bird's appetite for flying (its `fly` weight) where its family or its way of life says it flies little: a bird
 * that walks or swims first (0.03, as the rails, grebes, loons and gamebirds), the swans (0.03), geese (0.04) and
 * ducks (0.06), a farmyard breed (0.01); the text's "rarely flies" halves it. Null: the body plan's own (0.5, a
 * flying insect 0.6), as before.
 */
const LOW_FLIERS: Record<string, number> = {
    Rallidae: 0.03, Podicipedidae: 0.03, Gaviidae: 0.03, Phasianidae: 0.03, Numididae: 0.03, Odontophoridae: 0.03, Megapodiidae: 0.03,
    Meleagrididae: 0.03, Cracidae: 0.03, Tinamidae: 0.03, Turnicidae: 0.03, Otididae: 0.05, Anhimidae: 0.04, Anseranatidae: 0.06
};
const RARELY_FLIES = /\b(rarely|seldom|reluctant to|reluctantly) (fly|flies|takes? flight|takes? to the air)|\b(weak|poor) (flier|flyer)s?\b|\b(usually )?unable to fly far\b/i;
function flightPropensity(row: Row, plan: string, primary: Move): {value: number; src: Source} | null {
    if (!/Aves/.test(row.class_name ?? "")) return null;
    const family = row.family_name ?? "";
    const slug = row.slug ?? "";
    let value: number | null = null;
    let why = "";
    if (family === "Anatidae") {
        value = /(?:^|-)swan$/.test(slug) ? 0.03 : /(?:^|-)goose$/.test(slug) && !/pygmy-goose/.test(slug) ? 0.04 : 0.06;
        why = `family Anatidae (${value === 0.03 ? "a swan" : value === 0.04 ? "a goose" : "a duck"}): flies a few times a day`;
    } else if (LOW_FLIERS[family] !== undefined) {
        value = LOW_FLIERS[family];
        why = `family ${family}: walks or swims, flies little`;
    } else if (primary === "walk" || primary === "swim") {
        value = 0.03;
        why = `${primary}s first: flies now and then`;
    }
    if (value === null) return null;
    // A farmyard breed of duck, goose or fowl hardly flies.
    if (/^(Anatidae|Phasianidae|Numididae|Meleagrididae)$/.test(family) && (row.parent_slug || /^domestic-/.test(slug) || row.zone === "farm_garden")) {
        value = 0.01;
        why = `a farmyard ${family === "Anatidae" ? "duck or goose" : "fowl"}: hardly flies`;
    }
    const rarely = find(row, ALL, RARELY_FLIES);
    if (rarely && value > 0.01) value = Math.max(Math.round(value * 50) / 100, 0.01);
    return {value, src: rarely ? {field: rarely.field, phrase: rarely.phrase} : {rule: why}};
}

/**
 * How it is in the water, for the scene's float line, posture and feeding (`sea-depth.ts` swimDepth): a dabbling
 * duck, a diving duck, a swan, a goose, a grebe or loon, a cormorant, a pelican, a coot, a wading bird, another bird
 * on the water; an otter, another mammal; a crocodilian, a turtle, a lizard, a snake; an amphibian; a fish; a skater
 * on the surface (whirligigs, fishing spiders); one on the bed. From the stored taxonomy (and the text's "dives" for
 * the diving ducks); null for one that neither swims nor wades.
 */
type WaterKind = "dabbler" | "diver" | "swan" | "goose" | "grebe" | "cormorant" | "pelican" | "coot" | "wader" | "bird" | "penguin" | "otter" | "seal" | "mammal" | "croc" | "turtle" | "lizard" | "snake" | "amphibian" | "fish" | "skater" | "bed";
const WADERS = /^(Ardeidae|Ciconiidae|Threskiornithidae|Phoenicopteridae|Gruidae|Aramidae|Jacanidae|Scolopacidae|Charadriidae|Recurvirostridae|Haematopodidae|Balaenicipitidae|Scopidae|Rallidae)$/;
const DIVING_DUCK = /\b(diving ducks? (body|species)|(is|are) (a )?diving ducks?|rare \w+ diving duck|diving-duck|div(es|ing) (underwater|for (food|mollusks|aquatic|fish|small)|in short bouts)|dives? for (food|mollusks|aquatic|fish|small)|gathered by diving|they dive for)\b/i;
function waterKindOf(row: Row, plan: string, primary: Move, all: Set<Move>): {value: WaterKind; src: Source} | null {
    const cls = row.class_name ?? "";
    const family = row.family_name ?? "";
    const order = row.order_name ?? "";
    const slug = row.slug ?? "";
    const swims = all.has("swim") || primary === "swim";
    const rule = (value: WaterKind, why: string) => ({value, src: {rule: why} as Source});
    if (/Aves/.test(cls)) {
        if (family === "Spheniscidae") return rule("penguin", "family Spheniscidae");
        if (/^(Anatidae|Anhimidae|Anseranatidae)$/.test(family)) {
            if (/(?:^|-)swan$/.test(slug)) return rule("swan", `family ${family}: a swan`);
            if ((/(?:^|-)(goose|screamer)$/.test(slug) && !/pygmy-goose/.test(slug)) || family !== "Anatidae") return rule("goose", `family ${family}: a goose`);
            const dives = find(row, ALL, DIVING_DUCK);
            return dives ? {value: "diver", src: {field: dives.field, phrase: dives.phrase}} : rule("dabbler", "family Anatidae: a dabbling duck");
        }
        if (/^(Podicipedidae|Gaviidae)$/.test(family)) return rule("grebe", `family ${family}`);
        if (/^(Phalacrocoracidae|Anhingidae)$/.test(family)) return rule("cormorant", `family ${family}`);
        if (family === "Pelecanidae") return rule("pelican", "family Pelecanidae");
        if (family === "Rallidae" && primary === "swim") return rule("coot", "family Rallidae: a coot");
        if (WADERS.test(family)) return rule("wader", `family ${family}: wades in the shallows`);
        return swims ? rule("bird", `${cls} that swims`) : null;
    }
    if (!swims) return null;
    if (/Mammalia/.test(cls)) {
        if (OTTER.test(slug)) return rule("otter", "an otter");
        if (/^(Phocidae|Otariidae|Odobenidae)$/.test(family)) return rule("seal", `family ${family}`);
        return rule("mammal", `${cls} that swims`);
    }
    if (/Crocodylia/.test(`${cls} ${order}`) || /^(Crocodylidae|Alligatoridae|Gavialidae)$/.test(family)) return rule("croc", `${family || order}: a crocodilian`);
    if (/Testudines/.test(`${cls} ${order}`) || plan === "turtle") return rule("turtle", `${family || order}: a turtle`);
    if (/Reptilia|Squamata/.test(cls)) return plan === "legless" ? rule("snake", `${cls}, legless`) : rule("lizard", `${cls} with legs`);
    if (/Amphibia/.test(cls)) return rule("amphibian", "Amphibia");
    if (/Actinopterygii|Chondrichthyes|Elasmobranchii|Sarcopterygii|Teleostei/.test(cls) || plan === "fish") return rule("fish", `${cls || plan}: a fish`);
    if (plan === "insect" || plan === "flying_insect" || plan === "arachnid") return rule("skater", `plan ${plan}: on the surface`);
    if (primary === "swim") return rule("fish", `plan ${plan}: swims in the water`);
    return rule("bed", `plan ${plan}: on the bed`);
}

// MARK: Its day (the behaviours pass, lane B3 needs, 2026-11-14)

/**
 * How its kind spends a day: the share of its waking time in feeding bouts and in the rest after them, the length of
 * one feeding cycle (minutes), its trips to water a day, the hours it sleeps (null: its activity's own, by the sun) and,
 * for one that gorges, how many days lie between its feeding days. From the stored taxonomy, diet, size and zone
 * (rules, never species one by one), then the text's own words about drinking and sleeping. The schedule turns it
 * into bouts in order (`behaviour-schedule.ts` needAt). Before this every species had the same weights (rest 0.25,
 * forage 0.5, drink 0.15...), so an elephant, a lion and a wren spent their waking time alike.
 *
 * Sources for the figures (rounded; the wild's where known): elephants feed 16-18 hours and sleep 2-4; giraffes sleep
 * about 4.5; horses about 3; cattle graze about 8 hours, chew the cud about 8 and sleep about 4; lions rest about 20
 * hours with 13 or so asleep; koalas sleep about 20 and feed 2-4; sloths sleep about 10 in the wild (15 kept); little
 * brown bats sleep about 19; armadillos 17-18; hummingbirds sit about 80% of the day and feed for a minute or less every
 * ten or so; small passerines feed most of a winter's day; herons stand and wait; cormorants fish for an hour or two
 * and dry off; big constrictors feed every week or two; crocodiles about weekly.
 */
type Day = {feed: number; cycle: number; rest: number; drinks: number; sleep: number | null; every: number; ruminates: boolean};

const NO_DRINK = /\b(rarely|seldom|never|hardly ever|does not|doesn't|do not|don't|without) (need(s|ing)? to |ever |having to )?drink(s|ing)?\b|\b(gets?|getting|obtains?|draws?|takes?|derives?|meets?) (nearly |almost |virtually )?(all|most|much) (of )?(its|their|the) (water|moisture|fluids?)( needs?)? from\b|\bwithout (free |standing |drinking |any )?water\b|\bno need (to|for) drink/i;
const MUST_DRINK = /\b(drinks? (daily|every day|each day|regularly|often|twice)|must drink|needs? to drink|has to drink|water[- ]dependent|never (strays? )?far from water|visits? (the )?water ?holes? (daily|every))\b/i;
const SLEEP_HOURS = /\b(sleep(s|ing)?|asleep|doz(es|ing))\b[^.;]{0,50}?\b(\d{1,2})(?:\s*(?:to|-|–|or)\s*(\d{1,2}))?\s*hours\b/i;

function dayOf(row: Row, plan: string, diet: Diet, primary: Move, all: Set<Move>, zone: string, size: number | null, roost: Roost, social: Social, seabed: boolean, drinker: boolean): {value: Day; src: Source[]} {
    const slug = row.slug!;
    const fam = row.family_name ?? "";
    const taxa = `${row.class_name ?? ""} ${row.order_name ?? ""} ${fam}`;
    const big = size ?? 40;
    const d = (feed: number, cycle: number, rest: number, drinks: number, sleep: number | null = null, extra: Partial<Day> = {}): Day => ({feed, cycle, rest, drinks, sleep, every: 1, ruminates: false, ...extra});
    const found = ((): [string, Day] => {
        if (primary === "sessile") return ["sessile: it feeds where it sits", d(0.5, 60, 0.5, 0)];
        if (/Mammalia/.test(taxa)) {
            if (/Cetacea/.test(taxa) || /^(Delphinidae|Balaenopteridae|Balaenidae|Physeteridae|Phocoenidae|Monodontidae|Eschrichtiidae|Ziphiidae|Iniidae|Platanistidae|Kogiidae|Pontoporiidae)$/.test(fam)) return diet === "filter" ? ["a baleen whale: feeds in long bouts, rests at the surface, never asleep on the schedule", d(0.45, 90, 0.25, 0, 0)] : ["a toothed whale: feeds, travels, rests at the surface, never asleep on the schedule", d(0.3, 60, 0.25, 0, 0)];
            if (/Sirenia/.test(taxa)) return ["Sirenia: grazes six to eight hours, rests in the water", d(0.5, 120, 0.4, 0, 0)];
            if (/^(Phocidae|Otariidae|Odobenidae)$/.test(fam)) return [`family ${fam}: fishes in bouts, hauls out to rest`, d(0.3, 180, 0.5, 0)];
            // (The house cat and dog and their breeds: the stored pet flag, or a breed's parent.)
            if ((row.pet || /^(domestic-dog|domestic-cat)$/.test(row.parent_slug ?? "")) && /^(Felidae|Canidae)$/.test(fam)) return [`a pet (${fam}): fed its meals, rests most of the day`, d(0.08, 360, 0.55, 2, fam === "Canidae" ? 9 : 12.5)];
            if (/Proboscidea/.test(taxa)) return ["Proboscidea: feeds about 16 hours, sleeps about 3", d(0.8, 240, 0.08, 1.5, 3)];
            if (fam === "Giraffidae") return ["Giraffidae: browses most of the day, chews the cud, sleeps about 4.5 hours", d(0.65, 150, 0.25, 0.5, 4.5, {ruminates: true})];
            if (fam === "Equidae") return ["Equidae: grazes about 16 hours, sleeps about 3", d(0.68, 180, 0.18, 1.5, 3)];
            if (fam === "Rhinocerotidae") return ["Rhinocerotidae: feeds morning and evening, wallows and rests", d(0.5, 180, 0.4, 1, 8)];
            if (fam === "Tapiridae") return ["Tapiridae", d(0.55, 150, 0.3, 1, 7)];
            if (fam === "Hippopotamidae") return ["Hippopotamidae: grazes five or six hours of the night, rests in the water", d(0.55, 300, 0.35, 0, 10)];
            if (/^(Bovidae|Cervidae|Antilocapridae|Moschidae|Tragulidae)$/.test(fam)) return [`family ${fam}: a ruminant grazes or browses, then lies down to chew; sleeps about 4.5 hours`, d(0.58, big < 35 ? 90 : 150, 0.32, zone === "desert" ? 0.3 : 1.5, 4.5, {ruminates: true})];
            if (fam === "Camelidae") return ["Camelidae", d(0.55, 150, 0.3, 0.3, 6, {ruminates: true})];
            if (/^(Suidae|Tayassuidae)$/.test(fam)) return [`family ${fam}: roots for food, wallows and rests`, d(0.5, 90, 0.35, 2, 8.5)];
            if (fam === "Felidae") return big >= 45 ? ["Felidae, large: one hunt a night, rests about 20 hours", d(0.12, 600, 0.68, 1, 13)] : ["Felidae, small: hunts in bouts, rests most of its day", d(0.25, 240, 0.5, 1, 12.5)];
            if (fam === "Canidae") return ["Canidae", d(0.3, 240, 0.4, 1.5, 10)];
            if (fam === "Hyaenidae") return ["Hyaenidae", d(0.2, 360, 0.55, 1, 10)];
            if (fam === "Ursidae") return ["Ursidae: forages most of its waking", d(0.6, 150, 0.25, 1.5, 9)];
            if (/Carnivora/.test(taxa)) return [`a small carnivore (${fam})`, d(0.45, 90, 0.3, 1, 12)];
            if (fam === "Hominidae") return ["Hominidae", d(0.5, 120, 0.3, 1, 9.5)];
            if (/^(Lorisidae|Galagidae|Tarsiidae|Daubentoniidae|Cheirogaleidae|Lepilemuridae|Aotidae)$/.test(fam)) return [`family ${fam}: a night primate`, d(0.5, 45, 0.2, 0.5, 12)];
            if (/Primates/.test(taxa)) return diet === "browser" ? ["a leaf-eating primate: feeds, then sits and digests", d(0.4, 120, 0.45, 0, 10)] : ["Primates", d(0.45, 60, 0.25, 1, 10)];
            if (/Chiroptera/.test(taxa)) return fam === "Pteropodidae" ? ["Pteropodidae: feeds at fruit and flowers, hangs up to rest", d(0.5, 60, 0.35, 0.5, 14)] : ["Chiroptera: hawks insects at dusk and before dawn, sleeps about 18 hours", d(0.7, 40, 0.2, 1, 18)];
            if (/Rodentia/.test(taxa)) {
                const dry = zone === "desert" || /^(Heteromyidae|Dipodidae)$/.test(fam);
                if (big >= 30) return ["Rodentia, large", d(0.5, 90, 0.3, 1, 9)];
                if (fam === "Sciuridae") return ["Sciuridae", d(0.55, 30, 0.2, dry ? 0 : 0.5, 13)];
                return ["Rodentia, small: feeds in many short bouts", d(0.5, 25, 0.25, dry ? 0 : 0.5, 12.5)];
            }
            if (/Lagomorpha/.test(taxa)) return ["Lagomorpha", d(0.5, 45, 0.3, 0.3, 8.5)];
            if (fam === "Soricidae") return ["Soricidae: feeds every quarter of an hour round the clock", d(0.75, 20, 0.1, 0.5, 8)];
            if (fam === "Talpidae") return ["Talpidae", d(0.6, 60, 0.25, 0, 9)];
            if (/Erinaceomorpha|Soricomorpha|Eulipotyphla/.test(taxa)) return ["a hedgehog or its kin", d(0.65, 60, 0.15, 1, 10)];
            if (/Cingulata/.test(taxa)) return ["Cingulata: sleeps 17 hours or so", d(0.7, 60, 0.15, 0.5, 17)];
            if (/^(Bradypodidae|Megalonychidae|Choloepodidae)$/.test(fam)) return [`family ${fam}: a sloth`, d(0.45, 120, 0.45, 0, 14)];
            if (/Pilosa|Pholidota|Tubulidentata/.test(taxa)) return ["an ant and termite eater: many short visits", d(0.7, 30, 0.15, 0.5, 14)];
            if (fam === "Phascolarctidae") return ["Phascolarctidae: sleeps about 20 hours, feeds most of the rest, drinks almost never", d(0.65, 120, 0.25, 0, 20)];
            if (/^(Macropodidae|Potoroidae)$/.test(fam)) return [`family ${fam}`, d(0.6, 120, 0.3, zone === "desert" ? 0.2 : 0.5, 8)];
            if (fam === "Vombatidae") return ["Vombatidae", d(0.6, 150, 0.2, 0.3, 15)];
            if (/Diprotodontia|Dermoptera/.test(taxa)) return ["a possum, a glider or a colugo", d(0.5, 45, 0.25, 0.3, 14)];
            if (/Didelphimorphia|Microbiotheria/.test(taxa)) return ["an opossum", d(0.5, 45, 0.2, 1, 17)];
            if (/Dasyuromorphia|Peramelemorphia|Notoryctemorphia/.test(taxa)) return ["a small marsupial hunter or digger", d(0.45, 60, 0.3, 0.5, 12)];
            if (fam === "Ornithorhynchidae") return ["Ornithorhynchidae: forages in the water most of its waking", d(0.7, 60, 0.15, 0, 14)];
            if (/Monotremata/.test(taxa)) return ["an echidna", d(0.6, 30, 0.2, 0.3, 12)];
            if (/Hyracoidea/.test(taxa)) return ["Hyracoidea: feeds about an hour, basks and rests the rest", d(0.2, 240, 0.65, 0.3, 6)];
            if (/Afrosoricida/.test(taxa)) return ["Afrosoricida", d(0.6, 30, 0.2, 0.5, 15)];
            if (/Macroscelidea|Scandentia/.test(taxa)) return ["a sengi or a treeshrew", d(0.6, 30, 0.15, 0.5, 9)];
            // Any other mammal: by what it eats, sleeping less the bigger it is.
            const sleep = big <= 10 ? 12.5 : big <= 25 ? 11 : big <= 45 ? 9.5 : big <= 70 ? 7 : 5;
            if (diet === "grazer" || diet === "browser") return ["a plant-eating mammal, by size", d(0.6, big < 35 ? 60 : 150, 0.25, 1, sleep)];
            if (diet === "meat" || diet === "fish" || diet === "carrion") return ["a hunting mammal, by size", d(big >= 45 ? 0.15 : 0.35, big >= 45 ? 480 : 120, big >= 45 ? 0.6 : 0.4, 1, sleep)];
            return ["a mammal, by size", d(0.5, big < 25 ? 30 : 90, 0.25, 1, sleep)];
        }
        if (/Aves/.test(taxa)) {
            if (fam === "Trochilidae") return ["Trochilidae: feeds for a minute every ten or so, sits on its perch between", d(0.28, 9, 0.58, 0)];
            if (/^(Nectariniidae|Meliphagidae|Dicaeidae|Zosteropidae|Thraupidae)$/.test(fam) && diet === "nectar") return [`family ${fam}: a nectar feeder`, d(0.45, 15, 0.3, 0.5)];
            if (/^(Cathartidae)$/.test(fam) || /(?:^|-)(vulture|condor|lammergeier)(?:-|$)/.test(slug)) return ["a vulture: sits, soars to search, feeds briefly at a carcass", d(0.08, 360, 0.55, 0.3)];
            if (/^(Accipitridae|Falconidae|Pandionidae|Sagittariidae|Strigidae|Tytonidae)$/.test(fam)) return [`family ${fam}: a raptor sits on its perch most of the day and hunts in short bouts`, d(0.15, 180, 0.6, 0.3)];
            if (fam === "Phoenicopteridae") return ["Phoenicopteridae: filters head down for hours", d(0.6, 90, 0.3, 0)];
            if (/^(Ardeidae|Ciconiidae|Threskiornithidae|Balaenicipitidae|Scopidae|Aramidae)$/.test(fam)) return [`family ${fam}: stands and waits or wades and probes`, d(0.5, 60, 0.35, 0)];
            if (/^(Scolopacidae|Charadriidae|Recurvirostridae|Haematopodidae|Jacanidae|Rostratulidae|Burhinidae|Glareolidae)$/.test(fam)) return [`family ${fam}: a shorebird feeds nearly all the time the tide lets it`, d(0.7, 45, 0.2, 0)];
            if (/^(Phalacrocoracidae|Anhingidae|Pelecanidae|Sulidae|Fregatidae)$/.test(fam)) return [`family ${fam}: fishes for an hour or two, loafs and dries off the rest`, d(0.2, 120, 0.6, 0)];
            if (/Sphenisciformes/.test(taxa)) return ["a penguin: fishes at sea in bouts, stands ashore between", d(0.35, 180, 0.45, 0)];
            if (/^(Laridae|Stercorariidae|Alcidae|Diomedeidae|Procellariidae|Hydrobatidae|Oceanitidae|Phaethontidae)$/.test(fam)) return [`family ${fam}: a seabird`, d(0.4, 60, 0.35, 0)];
            if (/^(Podicipedidae|Gaviidae)$/.test(fam)) return [`family ${fam}: dives for fish in bouts, rests and preens afloat`, d(0.4, 60, 0.4, 0)];
            if (fam === "Rallidae") return ["Rallidae", d(0.55, 45, 0.3, 0)];
            if (/Anseriformes/.test(taxa)) return /(?:^|-)(goose|swan)$/.test(slug) || diet === "grazer" ? ["a goose or a swan: grazes most of the day", d(0.6, 90, 0.28, 0)] : ["a duck: feeds in bouts, loafs and preens on the bank or the water", d(0.45, 60, 0.4, 0)];
            if (/Galliformes|Tinamiformes|Otidiformes|Pteroclidiformes/.test(taxa)) return ["a ground bird: pecks and scratches morning and evening, rests and dust-bathes at midday", d(0.5, 45, 0.3, /Pteroclidiformes/.test(taxa) ? 1 : 2)];
            if (/Columbiformes/.test(taxa)) return ["Columbiformes: fills its crop, then sits and digests; drinks twice a day", d(0.35, 60, 0.45, 2)];
            if (/Psittaciformes/.test(taxa)) return ["Psittaciformes: feeds morning and late afternoon, rests, preens and plays between", d(0.35, 90, 0.4, 1)];
            if (/Struthioniformes|Rheiformes|Casuariiformes|Apterygiformes/.test(taxa)) return ["a ratite", d(0.55, 90, 0.25, zone === "desert" ? 0.3 : 1)];
            if (/^(Hirundinidae|Apodidae|Hemiprocnidae|Artamidae)$/.test(fam)) return [`family ${fam}: feeds on the wing most of the day`, d(0.7, 30, 0.15, 1)];
            if (/^(Alcedinidae|Meropidae|Coraciidae|Brachypteraciidae|Laniidae|Tyrannidae|Bucconidae|Galbulidae|Trogonidae|Momotidae|Todidae|Podargidae|Nyctibiidae|Caprimulgidae|Steatornithidae|Monarchidae|Dicruridae)$/.test(fam)) return [`family ${fam}: sits and watches from a perch, sallies out to catch`, d(0.3, 30, 0.5, 0.3)];
            if (/^(Gruidae|Cariamidae|Anhimidae|Eurypygidae|Rhynochetidae|Bucorvidae)$/.test(fam)) return [`family ${fam}: walks and forages most of the day`, d(0.6, 90, 0.25, 1)];
            if (/^(Corvidae|Sturnidae)$/.test(fam)) return [`family ${fam}`, d(0.5, 40, 0.25, 1)];
            if (/^(Bucerotidae|Ramphastidae|Musophagidae|Cuculidae|Picidae|Megalaimidae|Lybiidae|Capitonidae|Opisthocomidae)$/.test(fam)) return [`family ${fam}`, d(diet === "browser" ? 0.3 : 0.45, 60, diet === "browser" ? 0.55 : 0.35, 0.5)];
            if (big <= 15) return ["a small bird: feeds most of the day in many short bouts", d(0.65, 20, 0.15, diet === "seeds" ? 2 : 1)];
            return ["a bird, by size", d(0.5, 40, 0.3, diet === "seeds" ? 2 : 1)];
        }
        // (Never asleep on the schedule: it lies still on the bank by day and in the water by night, and by its stored
        // activity, nocturnal for most, it was away in its roost through the hours it basks.)
        if (/Crocodylia/.test(taxa)) return ["Crocodylia: lies in the water or basks on the bank, day and night; feeds one day in three or so", d(0.04, 600, 0.8, 0, 0, {every: 3})];
        if (/Testudines/.test(taxa)) {
            if (fam === "Testudinidae") return ["Testudinidae: grazes morning and late afternoon, basks, shelters at midday", d(0.35, 120, 0.5, zone === "desert" ? 0.1 : 0.3)];
            if (/^(Cheloniidae|Dermochelyidae)$/.test(fam)) return [`family ${fam}: a sea turtle feeds for hours, rests on the bottom`, d(0.45, 120, 0.3, 0)];
            return ["a freshwater turtle: basks for hours, feeds in the water", d(0.25, 120, 0.6, 0)];
        }
        if (/Squamata|Sphenodontia|Reptilia/.test(taxa)) {
            if (plan === "legless" || /^(Boidae|Pythonidae|Viperidae|Elapidae|Colubridae|Pseudoxyrhophiidae|Atractaspididae|Xenopeltidae|Homalopsidae|Lamprophiidae|Natricidae|Dipsadidae)$/.test(fam)) return /^(Boidae|Pythonidae)$/.test(fam) ? [`family ${fam}: lies up for days, feeds one day in five`, d(0.03, 600, 0.88, 0.2, null, {every: 5})] : ["a snake: lies up, hunts one day in three", d(0.06, 480, 0.78, 0.2, null, {every: 3})];
            if (/^(Varanidae|Helodermatidae|Lanthanotidae|Teiidae)$/.test(fam)) return [`family ${fam}: basks, then ranges for food`, d(0.3, 180, 0.5, 0.3, null, fam === "Helodermatidae" ? {every: 3} : {})];
            if (diet === "browser" || diet === "grazer" || diet === "fruit" || diet === "algae") return ["a plant-eating lizard: basks, feeds for an hour or two, basks again", d(0.25, 180, 0.65, zone === "desert" ? 0 : 0.2)];
            return ["a lizard: basks and watches, darts out to feed", d(0.3, 45, 0.55, zone === "desert" ? 0 : 0.2)];
        }
        if (/Amphibia/.test(taxa)) return ["Amphibia: sits and waits; takes water through its skin", d(0.25, 60, 0.65, 0)];
        if (plan === "fish" || /Elasmobranchii|Actinopterygii|Chondrichthyes|Teleostei|Holocephali|Coelacanthi|Dipneusti|Myxini|Petromyzonti/.test(taxa)) {
            if (diet === "algae" || diet === "grazer" || diet === "detritus") return ["a grazing fish: feeds nearly all day", d(0.7, 40, 0.1, 0)];
            if (diet === "filter") return ["a plankton feeder: it swims on through the night, never asleep on the schedule", d(0.6, 60, 0.1, 0, 0)];
            if (diet === "meat" || diet === "fish") return seabed || ["crevice", "bottom", "reef", "cave", "burrow", "den"].includes(roost) && social === "solitary" ? ["a fish that lies in wait", d(0.1, 240, 0.7, 0)] : ["a hunting fish that cruises: it never stops swimming, so never asleep on the schedule", d(0.25, 120, 0.1, 0, 0)];
            return ["a fish", d(0.5, 40, 0.15, 0)];
        }
        if (plan === "arachnid") return ["an arachnid: waits most of its time", d(0.1, 240, 0.85, 0)];
        if (plan === "cephalopod_jelly") return /(?:^|-)(octopus|cuttlefish|nautilus)(?:-|$)/.test(slug) ? ["an octopus or its kin: keeps to its den, hunts in bouts", d(0.2, 180, 0.6, 0)] : ["a drifter", d(0.3, 60, 0.05, 0)];
        if (plan === "flying_insect" || plan === "insect") {
            if (social === "colony" || /(?:^|-)(ant|termite)(?:-|$)/.test(slug)) return ["a colony insect: works nearly all its waking", d(0.75, 30, 0.05, 0)];
            if (diet === "nectar") return ["a nectar-feeding insect: flower to flower, with rests in the sun", d(0.55, 12, 0.25, 0)];
            if (diet === "meat" || diet === "insects" || diet === "blood") return all.has("fly") ? ["a hunting insect on the wing", d(0.4, 20, 0.35, 0)] : ["a hunting insect that waits", d(0.15, 120, 0.75, 0)];
            return ["a plant-eating insect", d(0.5, 30, 0.4, 0)];
        }
        if (plan === "crustacean") return ["a crustacean: picks over its ground", d(0.5, 30, 0.3, 0)];
        // Anything else: by what it eats (the scene's own defaults for a species with no row, `behaviour-profile.ts` DIET_DAYS).
        const byDiet: Record<string, [number, number, number, number]> = {grazer: [0.6, 120, 0.25, 1], browser: [0.55, 120, 0.25, 1], seeds: [0.5, 25, 0.25, 1], fruit: [0.45, 40, 0.3, 1], nectar: [0.35, 12, 0.45, 0], insects: [0.5, 25, 0.25, 0.5], fish: [0.3, 90, 0.45, 0], meat: [0.2, 240, 0.55, 0.5], carrion: [0.15, 240, 0.5, 0.5], blood: [0.2, 120, 0.6, 0], filter: [0.6, 60, 0.2, 0], algae: [0.6, 40, 0.2, 0], detritus: [0.5, 40, 0.3, 0], omnivore: [0.45, 60, 0.3, 1]};
        const [feed, cycle, rest, drinks] = byDiet[diet] ?? byDiet.omnivore;
        return [`diet ${diet}`, d(feed, cycle, rest, drinks)];
    })();
    const value = {...found[1]};
    const src: Source[] = [{rule: found[0]}];
    // It drinks only if it is a land animal that goes to water at all (`drinker`).
    if (!drinker) value.drinks = 0;
    else {
        const dry = find(row, ["diet", "traits", "facts", "habitat", "spotlight"], NO_DRINK);
        const wet = dry ? null : find(row, ["diet", "traits", "facts", "habitat", "spotlight", "look"], MUST_DRINK);
        if (dry) {
            value.drinks = 0;
            src.push({field: dry.field, phrase: dry.phrase});
        } else if (wet && value.drinks < 1.5) {
            value.drinks = 1.5;
            src.push({field: wet.field, phrase: wet.phrase});
        }
    }
    const slept = find(row, ["sleep"], SLEEP_HOURS);
    if (slept) {
        const m = SLEEP_HOURS.exec(slept.phrase) ?? SLEEP_HOURS.exec(row.sleep_pattern ?? "");
        const a = m ? Number(m[4]) : NaN;
        const b = m && m[5] ? Number(m[5]) : a;
        const hours = (a + b) / 2;
        if (hours >= 2 && hours <= 22) {
            value.sleep = Math.round(hours * 2) / 2;
            src.push({field: slept.field, phrase: slept.phrase});
        }
    }
    return {value, src};
}

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
    // A swimming bird whose sleep text puts it on the water sleeps there, whatever else the clause names (the coot's
    // "roosting at night on the water, on nest platforms or among reeds": the reeds' rule came first).
    if (moves.primary === "swim" && /Aves/.test(row.class_name ?? "") && roost.value !== "water") {
        const onWater = find(row, ["sleep"], /\b(on (the )?(open )?water|afloat|floating on)\b/i);
        if (onWater) roost = {value: "water", src: {field: onWater.field, phrase: onWater.phrase}};
    }

    // (Water fixes on the merged tree, 2026-11-14.) A crocodilian, the common hippopotamus and an amphibian that never
    // leaves the water keep the roost their text names: the map places their homes by it (a crevice dweller by a rock,
    // `map/place.ts` denKindOf), and the server's positions module has those homes. That they sleep in the water is the
    // schedule's rule, by their way of life (`behaviour-schedule.ts` sleepsAfloat), not a roost written here: with the
    // roost "water" a siamese crocodile's home moved 27 m from where the server has it.

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
    // How often it takes to the air (the movement audit, problem 2: every flyer had the same 5/9, a coot took off 27
    // times an hour): by family and how it lives. A bird that walks or swims first flies little; its family's own
    // rate is lower still (rails, grebes, gamebirds, swans), and its text's "rarely flies" halves it.
    const flight = all.has("fly") ? flightPropensity(row, plan, moves.primary) : null;
    if (all.has("fly")) add("fly", flight ? flight.value : plan === "flying_insect" ? 0.6 : 0.5, flight?.src);
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
    // Ducks, geese and swans come out onto the bank to rest and preen (lane MA3: with no flights to land, the ones that
    // do not graze never left the water). Its rest goes to the water's edge: it swims to the bank and walks out.
    if (/^(Anatidae|Anhimidae|Anseranatidae)$/.test(row.family_name ?? "") && moves.primary === "swim" && !it.has("shore")) {
        it.add("shore");
        src["place.shore"] = {rule: `family ${row.family_name}: loafs on the bank`};
    }
    const water = waterKindOf(row, plan, moves.primary, all);
    if (water) src.water = water.src;
    // (Lane B3 needs: its day, and a hoofed mammal's grooming, a lick or a scratch now and then, as a fine weight.)
    const day = dayOf(row, plan, diet.value, moves.primary, all, zone, size, roost.value, social.value, seabed, Boolean(b.drink));
    src.day = day.src;
    const hoofed = /^(Artiodactyla|Perissodactyla|Proboscidea|Cetartiodactyla)$/.test(row.order_name ?? "") && Boolean(b.groom);

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
        water: water?.value ?? null,
        flight: flight?.value ?? null,
        day: day.value,
        fine: hoofed ? {groom: 0.05} : {},
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
    // (Lane MA3: its water kind, and its fly weight in hundredths where its family sets it, `k:w` by behaviour index.)
    // (Lane B3 needs: other fine weights the same way, and its day as a last field:
    // feed %,cycle minutes,rest %,drinks a day x10,sleep hours x10 (empty: its activity's own),every (days),flags (r ruminates).)
    const fine = [...(p.flight !== null ? [`${BEHAVIOURS.indexOf("fly").toString(36)}:${Math.round(p.flight * 100)}`] : []), ...Object.entries(p.fine).map(([k, w]) => `${BEHAVIOURS.indexOf(k as Behaviour).toString(36)}:${Math.round((w ?? 0) * 100)}`)].join(",");
    const d = p.day;
    const day = [Math.round(d.feed * 100), d.cycle, Math.round(d.rest * 100), Math.round(d.drinks * 10), d.sleep === null ? "" : Math.round(d.sleep * 10), d.every, d.ruminates ? "r" : ""].join(",");
    const tail = [p.water ?? "", fine, day];
    compact[p.slug] = [p.move, p.moves.join(","), p.activity[0], p.rhythm.map((r) => r[0]).join(""), p.roost, p.social, p.diet, behaviours, interactions, flags, p.size ?? "", p.speed ?? "", p.dominance ?? "", p.gait ?? "", p.walkPace ?? "", p.runPace ?? "", ...tail].join("|");
}
fs.writeFileSync(
    path.join(root, "src/ark-scene/behaviours.json"),
    `{"about":"Generated by scripts/ark-behaviour-profiles.mts (full profiles with source phrases: data/ark/behaviour-profiles.json). Rows: move|moves|activity d n c a|rhythm (t two peaks, s siesta)|roost|social|diet|behaviours (index base 36 + weight 0-9)|interactions (index base 36)|flags (d a default, b breathes air, s seabed, u/a surface upside/any, l/m/h flight band)|size|speed|dominance|gait (the rig's fastest ground clip, body lengths/s)|walk pace|run pace (the clips' own, ground_speed/duty)|water kind (how it is in the water: dabbler, diver, swan, goose, grebe, cormorant, pelican, coot, wader, bird, penguin, otter, seal, mammal, croc, turtle, lizard, snake, amphibian, fish, skater, bed; or empty)|fine weights (behaviour index base 36 : weight in hundredths, over the ninths; or empty)|its day (feed % of its waking time,feeding cycle minutes,rest % after feeding,drinks a day x10,sleep hours x10 or empty for its activity's own,days between feeding days,r if it ruminates). Decoded by behaviour-profile.ts.",\n"species":{\n${Object.entries(compact)
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
