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
 *   npx tsx scripts/ark-behaviour-profiles.mts export.json manifest.json b1-microhabitats.json
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

type Rig = {plan: string; state: string; clips_pass: string[]; flight_fallback?: boolean; pose?: unknown; clips?: Record<string, {pass?: boolean; ground_speed?: number}>};
type B1 = {id: string; slug: string; plan: string | null; spawn: string[]; microhabitats: Array<{type: string; field: string; phrase: string}>};

const [exportPath, manifestPath, b1Path] = process.argv.slice(2);
if (!exportPath || !manifestPath || !b1Path) {
    console.error("usage: ark-behaviour-profiles.mts export.json manifest.json b1-microhabitats.json");
    process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const rows: Row[] = (Array.isArray(exported) ? exported : exported.rows).filter((r: Row) => r.slug);
const manifest: Record<string, Rig> = JSON.parse(fs.readFileSync(manifestPath, "utf8")).species;
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

/** The clause (between sentence or comma breaks, at most ~90 characters) round a match: a verbatim substring of the text. */
function clause(text: string, index: number, length: number): string {
    const sentenceStart = Math.max(text.lastIndexOf(". ", index) + 2, text.lastIndexOf("; ", index) + 2, 0);
    let sentenceEnd = text.length;
    for (const stop of [". ", "; "]) {
        const at = text.indexOf(stop, index + length);
        if (at >= 0) sentenceEnd = Math.min(sentenceEnd, at + 1);
    }
    let start = sentenceStart;
    let end = sentenceEnd;
    if (end - start > 90) {
        const comma = text.lastIndexOf(", ", index);
        if (comma + 2 > start && index - (comma + 2) < 60) start = comma + 2;
        const after = text.indexOf(", ", index + length);
        if (after >= 0 && after < end) end = after;
        if (end - start > 110) {
            start = Math.max(start, index - 40);
            end = Math.min(end, index + length + 50);
        }
    }
    return text.slice(start, end).trim().replace(/[.;,]$/, "");
}

/** The first field (in order) whose text matches, with its phrase. */
/**
 * The words before a match that make it about something else: a prey's colony, an insect's nest, three pairs of eyes,
 * a negation ("little gliding"), new colonies started by people.
 */
const NOT_ITS_OWN = /\b(weaver|weavers'?|ant|ants'?|termite|termites'?|bee|bees'?|wasp|wasps'?|insect|insects'?|bird|birds'?|seabird|prey|new|introduced|three|four|two|eight|six|little|no|rarely|seldom|without|not|never)\s+$/i;

/** The first field (in order) whose text matches, with its phrase (a match about something else is passed over). */
function find(row: Row, fields: TextField[], pattern: RegExp): {field: TextField; phrase: string; match: string} | null {
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    for (const field of fields) {
        const text = FIELD_OF[field](row);
        if (!text) continue;
        global.lastIndex = 0;
        for (let m = global.exec(text); m; m = global.exec(text)) {
            if (NOT_ITS_OWN.test(text.slice(Math.max(0, m.index - 24), m.index))) continue;
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
    [/dawn and dusk|early morning and (late afternoon|evening)|morning and (late afternoon|evening)|twilight/i, "crepuscular"],
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

type Roost = "tree" | "tree_hole" | "cliff" | "cave" | "crevice" | "rocks" | "burrow" | "den" | "ground_cover" | "reeds" | "water" | "bottom" | "reef" | "leaf" | "bark" | "wall" | "nest" | "attached" | "open";
const ROOST_RULES: Array<[RegExp, Roost]> = [
    [/\b(tree[- ]?holes?|hollows?|tree cavit\w*|cavities|nest[- ]?holes?|hollow trees?|hollow logs?)\b/i, "tree_hole"],
    [/\b(burrows?|underground|tunnels?|dig(s|ging)? (itself|its own)|holes? in the (ground|soil|sand))\b/i, "burrow"],
    [/\b(dens?|lairs?)\b/i, "den"],
    [/\bcaves?\b|\bmines?\b|\broof spaces?\b|\battics?\b/i, "cave"],
    [/\b(crevices?|cracks?|under (rocks?|stones?|logs?)|rock piles?|beneath (rocks?|stones?))\b/i, "crevice"],
    [/\b(cliffs?|ledges?|rock faces?)\b/i, "cliff"],
    [/\b(buried|burying|bur(y|ies) (itself|themselves)|in (soft )?(mud|sand|silt)|on the bottom|on the (sea|river|lake) ?(bed|floor|bottom))\b/i, "bottom"],
    [/\b(among (the )?(coral|tentacles)|anemone|reef crevice|in the reef|on the reef)\b/i, "reef"],
    [/\b(undersides? of (a )?leaf|undersides? of leaves|on (a )?leaf|on leaves|among leaves|in (the )?foliage)\b/i, "leaf"],
    [/\b(bark|trunks?)\b/i, "bark"],
    [/\b(walls?|on buildings|in buildings|houses|eaves|roof spaces?)\b/i, "wall"],
    [/\b(reeds?|reedbeds?|marsh vegetation)\b/i, "reeds"],
    [/\b(on (the )?water|on or (beside|near) (the )?water|at sea|on the sea|rafts?|floating|afloat|on open water|on the surface)\b/i, "water"],
    [/\b(rocks|boulders|lava|wrecks|stones)\b/i, "rocks"],
    [/\b(in trees|in a tree|roosts? (high )?in (trees|a tree|the canopy)|branches|treetops?|canopy|perch(es)? (in|on) (trees|branches))\b/i, "tree"],
    [/\b(on the ground|ground roost|scrapes?|in (dense |thick |tall )?(grass|cover|undergrowth|tussocks?|vegetation|thickets?|shrubs?|bushes|bamboo)|under (cover|bushes|shrubs))\b/i, "ground_cover"],
    [/\b(sleeping nests?|nests?)\b/i, "nest"]
];

function roostOf(row: Row, plan: string, layer: string, zone: string): {value: Roost; src: Source} {
    // Where it spends the night (or the day, for a night animal): its sleep text first, then where it lives.
    for (const fields of [["sleep"], ["look", "habitat", "traits", "facts"]] as TextField[][]) {
        for (const field of fields) {
            const text = FIELD_OF[field](row);
            if (!text) continue;
            // In the sleep text only the sentences about resting count; in the others only "roost/rest/shelter/sleep ... in X".
            const restText = field === "sleep" ? text : null;
            for (const [pattern, roost] of ROOST_RULES) {
                if (restText) {
                    const m = pattern.exec(restText);
                    if (m && !NOT_ITS_OWN.test(restText.slice(Math.max(0, m.index - 24), m.index))) return {value: roost, src: {field, phrase: clause(restText, m.index, m[0].length)}};
                } else {
                    const near = new RegExp(`\\b(roost|rests?|resting|shelter|sleep|hides?|hid|retreats?|spends? the (day|night))[^.]{0,50}${pattern.source}`, "i");
                    const m = near.exec(text);
                    if (m && !NOT_ITS_OWN.test(m[0].slice(0, m[0].length - (pattern.exec(m[0])?.[0].length ?? 0)).slice(-24))) return {value: roost, src: {field, phrase: clause(text, m.index, m[0].length)}};
                }
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
    Suidae: {social: "group", diet: "omnivore", extra: ["burrow"]},
    Felidae: {diet: "meat", also: ["climb"]},
    Canidae: {diet: "meat", roost: "den"},
    Mustelidae: {diet: "meat", roost: "den"},
    Picidae: {also: ["climb"]},
    Sittidae: {also: ["climb"]},
    Certhiidae: {also: ["climb"]},
    Anatidae: {social: "flock", move: "swim", also: ["fly", "walk"], roost: "water"},
    Gaviidae: {move: "swim", also: ["fly"], roost: "water", extra: ["dive"]},
    Podicipedidae: {move: "swim", also: ["fly"], roost: "water", extra: ["dive"]},
    Phasianidae: {social: "flock", diet: "seeds", move: "walk", also: ["fly"], roost: "ground_cover", extra: ["burrow"]},
    Numididae: {social: "flock", diet: "seeds", move: "walk", also: ["fly"]},
    Odontophoridae: {social: "flock", diet: "seeds", move: "walk", also: ["fly"]},
    Megapodiidae: {move: "walk", also: ["fly"], extra: ["burrow"]},
    Columbidae: {social: "flock", diet: "seeds"},
    Delphinidae: {social: "group"},
    Phocoenidae: {social: "group"},
    Monodontidae: {social: "group"},
    Accipitridae: {social: "solitary"},
    Cyprinidae: {social: "school"},
    Clupeidae: {social: "school"},
    Scombridae: {social: "school"},
    Engraulidae: {social: "school"}
};
const ORDER_PRIORS: Record<string, Prior> = {
    Galliformes: {social: "flock", move: "walk", also: ["fly"], extra: ["burrow"]},
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

const SESSILE = /(?:^|-)(coral|sponge|anemone|barnacle|mussel|oyster|clam|scallop|sea-squirt|tunicate|sea-pen|sea-fan|hydroid|bryozoan|feather-star|tube-worm|fan-worm|cockle|limpet)(?:-|$)/;
const CRAWLER = /(?:^|-)(snail|slug|worm|earthworm|leech|starfish|sea-star|urchin|sea-cucumber|nudibranch|chiton|whelk|periwinkle|conch|millipede|centipede|woodlouse|planarian|flatworm)(?:-|$)/;

function movesOf(row: Row, plan: string, layer: string, mode: string, zone: string, rig: Rig | undefined): {primary: Move; also: Move[]; src: Record<string, Source>} {
    const slug = row.slug!;
    const src: Record<string, Source> = {};
    const also = new Set<Move>();
    let primary: Move;
    const sea = SEA_ZONES.has(zone);
    const clips = new Set(rig?.clips_pass ?? []);
    if (SESSILE.test(slug)) {
        primary = "sessile";
        src.move = {rule: `slug names a sessile animal (${SESSILE.exec(slug)![1]})`};
    } else if (CRAWLER.test(slug)) {
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
                primary = "slither";
                src.move = {rule: "plan legless"};
                break;
            case "other":
                primary = sea ? "swim" : "crawl";
                src.move = {rule: `plan other in ${zone}`};
                break;
            default:
                primary = layer === "underground" ? "burrow" : layer === "canopy" && (mode === "climb" || mode === "hang" || mode === "leap") ? "climb" : "walk";
                src.move = {rule: `plan ${plan}, layer ${layer}${mode ? ` (${mode})` : ""}`};
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
    const swim = find(row, BEHAVIOUR_TEXT, /\b(swim(s|ming)?|dives? (under|underwater|beneath|below|for fish|to the bottom)|diving (duck|bird|for fish|underwater)|paddl\w+|aquatic|semi-aquatic)\b/i);
    if (swim && primary !== "swim" && primary !== "sessile") {
        also.add("swim");
        src.swim = {field: swim.field, phrase: swim.phrase};
    }
    const climb = find(row, BEHAVIOUR_TEXT, /\b(climb(s|ing|er)?|arboreal|clambers?)\b/i);
    if (climb && !["climb", "swim", "sessile"].includes(primary)) {
        also.add("climb");
        src.climb = {field: climb.field, phrase: climb.phrase};
    }
    const dig = find(row, BEHAVIOUR_TEXT, /\b(dig(s|ging)?|burrow(s|ing)?|excavat\w+|fossorial)\b/i);
    if (dig && primary !== "burrow" && primary !== "sessile" && primary !== "fly") {
        also.add("burrow");
        src.burrow = {field: dig.field, phrase: dig.phrase};
    }
    if (plan === "amphibian" && clips.has("leap")) also.add("hop");
    also.delete(primary);
    return {primary, also: [...also], src};
}

type Social = "solitary" | "pair" | "group" | "herd" | "flock" | "school" | "colony" | "pack" | "troop" | "swarm";
const GROUP_WORDS: Array<[RegExp, Social]> = [
    [/\bherds?\b/i, "herd"],
    [/\bflocks?\b|\bflocking\b/i, "flock"],
    [/\b(schools?|schooling|shoals?|shoaling)\b/i, "school"],
    [/\bcolon(y|ies|ial)\b/i, "colony"],
    [/\bpacks?\b/i, "pack"],
    [/\btroops?\b/i, "troop"],
    [/\bswarm(s|ing)?\b/i, "swarm"]
];

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
        const hit = find(row, ALL, new RegExp(GROUP_WORDS.map(([p]) => p.source).join("|"), "i"));
        const kind = hit ? kindFromText(hit.phrase) : null;
        if (hit && kind) return {value: kind.kind, src: {field: hit.field, phrase: hit.phrase}};
        return {value: "group", src: {field: "sociality", phrase: row.sociality_phrase ?? "group"}};
    }
    const group = find(row, BEHAVIOUR_TEXT, new RegExp(GROUP_WORDS.map(([p]) => p.source).join("|"), "i"));
    if (group) {
        const kind = kindFromText(group.phrase);
        if (kind) return {value: kind.kind, src: {field: group.field, phrase: group.phrase}};
    }
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
    [/\b(nectar|pollen|flowers?)\b/i, "nectar"],
    [/\b(insects?|caterpillars?|beetles?|ants|termites|larvae|grubs|spiders?|invertebrates?|worms?|bugs|aphids|flies)\b/i, "insects"],
    [/\b(fish|fishes|squid)\b/i, "fish"],
    [/\b(meat|prey|mammals|rodents?|rabbits?|birds|lizards?|snakes?|frogs?|deer|antelopes?|hunt\w*|vertebrates)\b/i, "meat"],
    [/\b(carrion|carcass\w*|scaveng\w+|dead animals)\b/i, "carrion"],
    [/\b(plankton|krill|filter\w*|suspended)\b/i, "filter"],
    [/\b(algae|seaweed|kelp|biofilm)\b/i, "algae"],
    [/\b(detritus|decaying|rotting|dung|leaf litter)\b/i, "detritus"],
    [/\b(blood[- ]?meals?|blood[- ]feed\w*|suck\w* blood|feeds? on (the )?blood|drinks? blood|on blood)\b/i, "blood"]
];

function dietOf(row: Row, plan: string): {value: Diet; also: Diet[]; src: Source} {
    const text = row.diet_summary;
    const found: Array<{diet: Diet; index: number; phrase: string}> = [];
    if (text) {
        for (const [pattern, diet] of DIET_WORDS) {
            const m = pattern.exec(text);
            if (m) found.push({diet, index: m.index, phrase: clause(text, m.index, m[0].length)});
        }
    }
    found.sort((a, b) => a.index - b.index);
    if (found.length) {
        const kinds = [...new Set(found.map((f) => f.diet))];
        const plants = kinds.filter((k) => ["grazer", "browser", "seeds", "fruit", "nectar", "algae"].includes(k)).length;
        const animals = kinds.filter((k) => ["insects", "fish", "meat", "carrion"].includes(k)).length;
        const value: Diet = /omnivor/i.test(text ?? "") && plants >= 1 && animals >= 1 ? "omnivore" : found[0].diet;
        return {value, also: kinds.filter((k) => k !== value).slice(0, 3), src: {field: "diet", phrase: found[0].phrase}};
    }
    const ambient = row.ambient ?? [];
    const map: Record<string, Diet> = {grass: "grazer", plants: "browser", seeds: "seeds", fruit: "fruit", nectar: "nectar", insects: "insects", worms: "insects", plankton: "filter", algae: "algae", detritus: "detritus", dung: "detritus"};
    for (const [i, a] of ambient.entries()) if (map[a]) return {value: map[a], also: [], src: {field: "ambient", phrase: row.ambient_phrases?.[i] ?? a}};
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
export const INTERACTIONS = ["drink_edge", "bask_rock", "graze_grass", "perch_branch", "perch_rock", "dig_soil", "leaf_litter", "flower", "porch_light", "cave_mouth", "cliff_ledge", "sea_dive", "tide_pool", "bark", "wall", "burrow_mouth", "reeds", "water_surface", "reef", "shade"] as const;
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
    const roost = roostOf(row, plan, layer, zone);
    const moves = movesOf(row, plan, layer, mode, zone, rig);
    const social = socialOf(row, plan);
    const diet = dietOf(row, plan);

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
    if (diet.value === "grazer" || diet.also.includes("grazer")) add("graze", 0.7, src.diet as Source);
    if (all.has("fly")) add("fly", plan === "flying_insect" ? 0.6 : 0.5);
    if (all.has("perch")) add("perch", 0.45);
    if (all.has("swim")) add("swim", moves.primary === "swim" ? 0.9 : 0.3);
    if (all.has("climb")) add("climb", moves.primary === "climb" ? 0.7 : 0.3);
    if (all.has("burrow")) add("burrow", moves.primary === "burrow" ? 0.8 : 0.3);
    const land = !SEA_ZONES.has(zone) && moves.primary !== "swim" && mobile;
    const drinker = land && ["quadruped", "primate", "walking_bird", "flightless_bird", "flying_bird", "bat", "lizard", "turtle"].includes(plan);
    if (drinker) add("drink", 0.15, textHit(/\b(drink\w*|waterholes?|water holes?)\b/i) ?? undefined);
    const soarText = textHit(/\b(soar\w*|thermals?|glid\w+|circl\w+ (high|overhead)|high overhead)\b/i);
    if (all.has("fly") && plan === "flying_bird" && (soarText || (size ?? 0) >= 30)) add("soar", soarText ? 0.6 : 0.35, soarText ?? {default: `a large flying bird (size ${size})`});
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
    if (["herd", "flock", "school", "colony", "pack", "troop", "swarm", "group"].includes(social.value)) add("flock", 0.6, src.social as Source);
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
    if (b.bask) it.add("bask_rock");
    if (b.graze) it.add("graze_grass");
    if (b.perch || roost.value === "tree" || roost.value === "tree_hole") if (all.has("fly") || all.has("climb")) it.add("perch_branch");
    const rocky = textHit(/\b(rocks?|boulders?|cliffs?|crags?|outcrops?|ledges?)\b/i, ["look", "habitat", "sleep", "traits"]);
    if (b.perch && (roost.value === "cliff" || roost.value === "rocks" || rocky)) it.add("perch_rock");
    if (b.burrow) it.add("dig_soil");
    if (roost.value === "burrow" || roost.value === "den" || (b.burrow && moves.primary !== "fly")) it.add("burrow_mouth");
    const smallGround = ["insect", "arachnid", "amphibian", "lizard", "legless", "other", "crustacean"].includes(plan) || (plan === "quadruped" && (size ?? 99) <= 15) || moves.primary === "crawl" || (plan === "walking_bird" || moves.primary === "walk" && /Aves/.test(row.class_name ?? ""));
    if ((spawn.has("leaves") || spawn.has("forest_floor") || spawn.has("logs_deadwood")) && smallGround && !SEA_ZONES.has(zone)) it.add("leaf_litter");
    if (b.visit_flowers) it.add("flower");
    if (b.circle_light) it.add("porch_light");
    if (roost.value === "cave" || spawn.has("caves")) if (all.has("fly")) it.add("cave_mouth");
    if (roost.value === "cliff" || spawn.has("sea_cliffs") || spawn.has("cliffs")) if (all.has("fly")) it.add("cliff_ledge");
    if (b.dive && (WATER_ZONES.has(zone) || spawn.has("open_ocean") || spawn.has("sea_cliffs"))) it.add("sea_dive");
    if (spawn.has("rocky_shore") && (plan === "crustacean" || moves.primary === "crawl" || plan === "fish")) it.add("tide_pool");
    if (roost.value === "bark" || spawn.has("trunks_bark")) if (["insect", "arachnid", "lizard", "flying_insect", "other"].includes(plan) || moves.primary === "crawl") it.add("bark");
    if (all.has("climb") && all.has("fly")) it.add("bark");

    // The owner's additions (2026-11-11): altitude bands, surface crawlers, air-breathers, seabed walkers.
    const altitude: Profile["altitude"] = !all.has("fly") ? null : plan === "flying_insect" || (plan === "bat" && (size ?? 0) < 20) ? "low" : b.soar ? "high" : plan === "bat" ? "mid" : (size ?? 0) >= 35 ? "high" : "mid";
    if (altitude) src.altitude = b.soar ? (src["b.soar"] as Source) ?? {rule: "soars"} : {rule: `plan ${plan}, size ${size}`};
    const UPSIDE_FAMILIES = /^(Gekkonidae|Phyllodactylidae|Sphaerodactylidae|Diplodactylidae|Eublepharidae|Carphodactylidae)$/;
    const crawler = ["insect", "arachnid"].includes(plan) || moves.primary === "crawl" || (plan === "lizard" && (size ?? 99) <= 12) || /(?:^|-)(caterpillar|ant|beetle|snail|slug|gecko|spider)(?:-|$)/.test(slug);
    const upside = UPSIDE_FAMILIES.test(row.family_name ?? "") || /(?:^|-)gecko(?:-|$)/.test(slug) || plan === "arachnid";
    const surface: Profile["surface"] = moves.primary === "sessile" || SEA_ZONES.has(zone) ? null : upside && crawler ? "upside" : crawler ? "any" : null;
    if (surface) src.surface = {rule: upside ? `${row.family_name ?? plan}: clings upside down` : `plan ${plan}, small crawler`};
    const swimmer = all.has("swim") && (moves.primary === "swim" || SEA_ZONES.has(zone));
    const airClass = /Mammalia|Reptilia|Aves/.test(row.class_name ?? "") || ["turtle", "quadruped", "flightless_bird"].includes(plan) || /(?:^|-)(whale|dolphin|porpoise|orca|seal|sea-lion|walrus|manatee|dugong|otter|sea-turtle|turtle|penguin|sea-snake)(?:-|$)/.test(slug) && !/(?:^|-)(shark|icefish)(?:-|$)/.test(slug);
    // Birds on the water only count when they dive (penguins, loons, grebes); a duck just floats.
    const breathes = swimmer && airClass && (plan !== "fish" || /Mammalia|Reptilia/.test(row.class_name ?? "")) && (!/Aves/.test(row.class_name ?? "") || Boolean(b.dive) || plan === "flightless_bird");
    if (breathes) src.breathes = {rule: `${row.class_name ?? plan} swimmer`};
    const seabed = SEA_ZONES.has(zone) && (plan === "crustacean" || moves.primary === "crawl" || layer === "reef" && mode === "floor" || /(?:^|-)(crab|lobster|starfish|sea-star|urchin|sea-cucumber|octopus)(?:-|$)/.test(slug));
    if (seabed) src.seabed = {rule: layer === "reef" && mode === "floor" ? "layers.json floor" : `plan ${plan} in ${zone}`};
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
    compact[p.slug] = [p.move, p.moves.join(","), p.activity[0], p.rhythm.map((r) => r[0]).join(""), p.roost, p.social, p.diet, behaviours, interactions, flags, p.size ?? "", p.speed ?? "", p.dominance ?? "", p.gait ?? ""].join("|");
}
fs.writeFileSync(
    path.join(root, "src/ark-scene/behaviours.json"),
    `{"about":"Generated by scripts/ark-behaviour-profiles.mts (full profiles with source phrases: data/ark/behaviour-profiles.json). Rows: move|moves|activity d n c a|rhythm (t two peaks, s siesta)|roost|social|diet|behaviours (index base 36 + weight 0-9)|interactions (index base 36)|flags (d a default, b breathes air, s seabed, u/a surface upside/any, l/m/h flight band)|size|speed|dominance|gait (the rig's fastest ground clip, body lengths/s). Decoded by behaviour-profile.ts.",\n"species":{\n${Object.entries(compact)
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
