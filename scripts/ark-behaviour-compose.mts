/**
 * Recipes from a species' stored behaviours (`ark-behaviour-text.mts`), as data for the engine
 * (`src/ark-scene/behaviour-recipes.ts`, templates in `recipe-templates.ts`).
 *
 * Every recipe keeps its source:
 * - {field, phrase}: the stored behaviour phrase that asked for it;
 * - {rule}: the taxonomy or body plan (a heron wades and spears; a kingfisher plunges), when the text is thin but
 *   the family settles it;
 * - {default}: no data, the body plan's default (flagged in `defaults`).
 * Phrase recipes weigh most, rules a little less, defaults least.
 */
import {TEMPLATES, ENTRY_STYLES, EXIT_STYLES, AFTER_STYLES, POSTURES} from "../src/ark-scene/recipe-templates.ts";
import {BLOCKS} from "../src/ark-scene/behaviour-blocks.ts";
import type {Hit, Nest, Season, SexInfo, SpeciesText} from "./ark-behaviour-text.mts";

export const RECIPE_VERSION = "recipes-v1";
export type RecipeSource = {field: string; phrase: string} | {rule: string} | {default: string};
export type ComposedRecipe = {id: string; weight: number; src: RecipeSource};
export type Crossing = {entry: string; exit: string; after: string; src: RecipeSource};
export type Composed = {recipes: ComposedRecipe[]; defaults: string[]; crossing: Crossing; posture: {value: string; src: RecipeSource} | null; hovers: boolean; nesting: number[]; nestingSrc: RecipeSource | null};

const BIRD = new Set(["flying_bird", "walking_bird", "flightless_bird"]);
/** The catalogue stores reptiles by order-level class names. */
const REPTILES = new Set(["Reptilia", "Squamata", "Testudines", "Crocodylia", "Rhynchocephalia"]);
const has = (b: Record<string, Hit[]>, ...ids: string[]) => ids.find((id) => b[id]?.length);
const fromHit = (b: Record<string, Hit[]>, id: string): RecipeSource => ({field: b[id][0].field, phrase: b[id][0].phrase});
const fam = (s: SpeciesText, ...names: string[]) => names.includes(s.family ?? "");
const named = (s: SpeciesText, pattern: RegExp) => pattern.test(s.name) || pattern.test(s.slug);
const swims = (s: SpeciesText) => s.move === "swim" || s.moves.includes("swim");
const flies = (s: SpeciesText) => s.move === "fly" || s.moves.includes("fly");
const fishEater = (s: SpeciesText) => s.diet === "fish" || /\bfish\b/i.test(s.text.diet ?? "");

export function composeRecipes(s: SpeciesText, b: Record<string, Hit[]>, ctx: {sex: SexInfo; mating: Season; nesting: Season; nest: Nest | null}): Composed {
    const out: ComposedRecipe[] = [];
    const add = (id: string, weight: number, src: RecipeSource) => {
        if (!TEMPLATES[id] || out.some((r) => r.id === id)) return;
        out.push({id, weight, src});
    };
    const phrase = (id: string, behaviour: string, weight = 7) => add(id, weight, fromHit(b, behaviour));
    const rule = (id: string, why: string, weight = 5) => add(id, weight, {rule: why});
    const bird = BIRD.has(s.plan);
    const mammal = s.className === "Mammalia";
    const reptile = REPTILES.has(s.className ?? "");

    // MARK: Fishing birds
    if (bird) {
        // (An osprey's plunge is feet-first: its own recipe below.)
        if (has(b, "plunge_dive") && !has(b, "feet_first") && !fam(s, "Pandionidae") && (fam(s, "Alcedinidae") || !has(b, "chase_fish"))) {
            if (fam(s, "Alcedinidae")) phrase("perch_plunge", "plunge_dive");
            else phrase("air_plunge", "plunge_dive");
        } else if (fam(s, "Alcedinidae") && fishEater(s)) rule("perch_plunge", "family Alcedinidae (kingfishers) that eat fish");
        if (fam(s, "Sulidae") || (fam(s, "Laridae") && named(s, /tern|noddy/i))) rule("air_plunge", `family ${s.family} (${fam(s, "Sulidae") ? "gannets and boobies" : "terns"})`, 6);
        if (has(b, "feet_first")) phrase("talon_grab", "feet_first", 7);
        else if (fam(s, "Pandionidae") || (fam(s, "Accipitridae") && named(s, /fish|sea.?eagle|bald.?eagle/i)) || (fam(s, "Strigidae") && named(s, /fish/i))) rule("talon_grab", `family ${s.family}: ${s.name} takes fish feet-first`, 6);
        if (has(b, "spear") || (has(b, "wade") && fam(s, "Ardeidae", "Ciconiidae", "Balaenicipitidae", "Anhingidae"))) phrase("wade_spear", has(b, "spear") ?? "wade", 7);
        else if (fam(s, "Ardeidae")) rule("wade_spear", "family Ardeidae (herons, egrets, bitterns)", 6);
        if (has(b, "bill_sweep") && !fam(s, "Anatidae")) phrase("bill_sweep", "bill_sweep", 6);
        else if (fam(s, "Phoenicopteridae", "Recurvirostridae") || named(s, /spoonbill/i)) rule("bill_sweep", `family ${s.family} (sweeps or filters with the bill)`, 6);
        if (has(b, "scoop") || fam(s, "Pelecanidae")) has(b, "scoop") ? phrase("pouch_scoop", "scoop", 6) : rule("pouch_scoop", "family Pelecanidae (pelicans)", 6);
        if (has(b, "dabble") || (fam(s, "Anatidae") && has(b, "bill_sweep"))) phrase("dabble", has(b, "dabble") ?? "bill_sweep", 6);
        else if (fam(s, "Anatidae") && swims(s)) rule("dabble", "family Anatidae on the water (ducks, swans, geese)", 4);
        if (has(b, "surface_dive") && swims(s)) phrase("surface_dive", "surface_dive", 6);
        else if (fam(s, "Podicipedidae", "Phalacrocoracidae", "Gaviidae", "Anhingidae", "Alcidae")) rule("surface_dive", `family ${s.family} (dives from the surface)`, 6);
        if (has(b, "wing_dry")) phrase("wing_dry", "wing_dry", 5);
        else if (fam(s, "Phalacrocoracidae", "Anhingidae")) rule("wing_dry", `family ${s.family} (dries its wings spread)`, 5);
    }
    // MARK: Chasing fish
    if (swims(s) && (has(b, "chase_fish") || fam(s, "Spheniscidae", "Phocidae", "Otariidae", "Delphinidae", "Phocoenidae", "Odobenidae") || (fam(s, "Mustelidae") && named(s, /otter/i)))) {
        if (named(s, /sea.?otter/i) || (has(b, "float_back") && has(b, "tool_use"))) has(b, "tool_use") ? phrase("shell_tool", "tool_use", 7) : rule("shell_tool", "the sea otter", 7);
        else if (has(b, "chase_fish")) phrase("chase_fish", "chase_fish", 6);
        else rule("chase_fish", `family ${s.family} (hunts fish underwater)`, 6);
    }
    // MARK: Fishing at the river
    if (!swims(s) || s.move !== "swim") {
        if (has(b, "bank_fishing")) phrase("river_fish", "bank_fishing", 6);
        else if (fam(s, "Ursidae") && /\b(salmon|fish)\b/i.test(`${s.text.diet ?? ""} ${s.text.facts ?? ""}`)) rule("river_fish", "family Ursidae with fish in its stored diet", 5);
    }
    // MARK: Foraging on land and in the air
    if (has(b, "pounce") && !bird) phrase("pounce", "pounce", 6);
    else if ((fam(s, "Canidae") && named(s, /fox/i)) || (fam(s, "Felidae") && (s.size ?? 50) < 45)) rule("pounce", `family ${s.family}: ${s.name} stalks and pounces`, 4);
    if ((has(b, "hawking") && (bird || s.plan === "bat")) || fam(s, "Tyrannidae", "Muscicapidae", "Meropidae", "Dicruridae", "Monarchidae")) has(b, "hawking") ? phrase("hawk_insects", "hawking", 6) : rule("hawk_insects", `family ${s.family} (sallies for flying insects)`, 4);
    if (s.plan === "flying_insect" && (s.order === "Odonata" || has(b, "hawking"))) has(b, "hawking") ? phrase("hawk_insects", "hawking", 6) : rule("hawk_insects", "order Odonata (dragonflies hawk from a perch)", 5);
    if (has(b, "hover") && bird && fam(s, "Falconidae", "Accipitridae")) phrase("hover_drop", "hover", 6);
    if (has(b, "worm_pull") && bird && !fam(s, "Strigidae", "Tytonidae", "Accipitridae")) phrase("worm_pull", "worm_pull", 5);
    else if (fam(s, "Turdidae")) rule("worm_pull", "family Turdidae (thrushes pull worms)", 4);
    if (has(b, "probe")) phrase("probe_feed", "probe", 5);
    else if (fam(s, "Scolopacidae", "Threskiornithidae", "Apterygidae") && !named(s, /spoonbill/i)) rule("probe_feed", `family ${s.family} (probes with the bill)`, 4);
    if (has(b, "dig") && !bird && s.diet !== "grazer" && (mammal || reptile) && !has(b, "beach_nest")) phrase(/burrow|tunnel/i.test(b.dig[0].phrase) ? "dig_burrow" : "root_dig", "dig", 5);
    else if (fam(s, "Suidae", "Orycteropodidae", "Dasypodidae", "Chlamyphoridae", "Myrmecophagidae", "Tachyglossidae") || (fam(s, "Mustelidae") && named(s, /badger/i))) rule("root_dig", `family ${s.family} (digs and roots)`, 5);
    if (!bird && !has(b, "dig") && (fam(s, "Leporidae") && named(s, /rabbit/i) || fam(s, "Vombatidae"))) rule("dig_burrow", `family ${s.family} (digs burrows)`, 4);
    if (has(b, "drumming") && fam(s, "Picidae")) phrase("drum_bark", "drumming", 6);
    else if (fam(s, "Picidae")) rule("drum_bark", "family Picidae (woodpeckers)", 6);
    if (has(b, "caching") && (mammal || bird) && !fam(s, "Laniidae")) phrase("cache_food", "caching", 4);
    else if (fam(s, "Sciuridae") && !named(s, /flying|prairie|marmot|ground/i)) rule("cache_food", "family Sciuridae (tree squirrels and chipmunks bury food)", 4);
    if (has(b, "tool_use") && (fam(s, "Corvidae") || s.plan === "primate")) phrase("stick_tool", "tool_use", 3);

    // MARK: Comfort
    if (has(b, "bask")) phrase("bask_sun", "bask", 6);
    else if (s.plan === "lizard" || s.plan === "turtle") rule("bask_sun", `plan ${s.plan}: basks`, 4);
    if (has(b, "dust_bathe")) phrase("dust_bathe", "dust_bathe", 5);
    else if (fam(s, "Phasianidae", "Numididae", "Odontophoridae", "Passeridae", "Equidae")) rule("dust_bathe", `family ${s.family} (dust-bathes)`, 4);
    if (has(b, "wallow") && !reptile) phrase("wallow", "wallow", 6);
    else if (fam(s, "Suidae", "Rhinocerotidae", "Elephantidae", "Tapiridae") || (fam(s, "Bovidae") && named(s, /buffalo|water buffalo|bison/i))) rule("wallow", `family ${s.family} (wallows)`, 5);
    if (fam(s, "Equidae") || (fam(s, "Bovidae") && named(s, /bison/i))) rule("roll", `family ${s.family} (rolls)`, 3);
    if (has(b, "sand_bury")) phrase("bury_sand", "sand_bury", 5);
    if (has(b, "groom") || has(b, "allogroom")) phrase(bird ? "preen_stretch" : "groom_self", has(b, "groom") ?? "allogroom", 4);
    if (has(b, "stretch_yawn")) phrase("stretch_yawn", "stretch_yawn", 4);

    // MARK: Display and voice
    const iguanian = reptile && fam(s, "Iguanidae", "Agamidae", "Dactyloidae", "Phrynosomatidae", "Tropiduridae", "Crotaphytidae", "Leiocephalidae", "Liolaemidae", "Corytophanidae");
    const pushPhrase = ["display", "courtship", "male_combat"].find((id) => b[id]?.some((h) => /push-?ups?|head[- ]?bob|bob\w* (its|their) head/i.test(h.phrase)));
    if (reptile && pushPhrase) phrase("pushup", pushPhrase, 6);
    else if (iguanian) rule("pushup", `family ${s.family} (push-up and head-bob displays)`, 5);
    if (bird && (has(b, "display") || has(b, "courtship")) && (ctx.sex.male.length || ctx.sex.duller === "female" || fam(s, "Phasianidae", "Paradisaeidae", "Otididae", "Fregatidae", "Pipridae", "Cotingidae", "Menuridae"))) phrase("strut_display", has(b, "display") ?? "courtship", 5);
    if (has(b, "call")) phrase("call_bout", "call", 3);
    if (has(b, "scent_mark")) phrase("scent_mark", "scent_mark", 3);

    // MARK: Pairs
    const contest = has(b, "male_combat");
    if (fam(s, "Cervidae") && !named(s, /water.?deer/i)) contest ? phrase("antler_clash", contest, 6) : rule("antler_clash", "family Cervidae (stags clash antlers in the rut)", 5);
    else if (fam(s, "Bovidae") && (named(s, /ibex|goat|sheep|markhor|tahr|argali|mouflon|bighorn|musk.?ox|urial|bharal|chamois|serow|goral|takin|aoudad|bison|buffalo|yak|gaur|banteng/i) || (contest && /horn|butt|clash|ram/i.test(b[contest][0].phrase)))) contest ? phrase("horn_clash", contest, 6) : rule("horn_clash", `family Bovidae: ${s.name} butts heads`, 5);
    else if (fam(s, "Hippopotamidae") || named(s, /elephant.?seal/i) || (fam(s, "Otariidae") && contest)) contest ? phrase("jaw_spar", contest, 6) : rule("jaw_spar", `family ${s.family} (bulls gape and push)`, 5);
    else if (fam(s, "Macropodidae") || (fam(s, "Leporidae") && named(s, /hare/i))) contest ? phrase("box_spar", contest, 6) : rule("box_spar", `family ${s.family} (males box)`, 4);
    else if (reptile && (contest || iguanian) && s.plan === "lizard") contest ? phrase("lizard_contest", contest, 5) : rule("lizard_contest", `family ${s.family} (rival males display and wrestle)`, 3);
    else if (contest) phrase("wrestle", contest, 4);
    const dance = ["courtship", "display"].find((id) => b[id]?.some((h) => /\bdanc/i.test(h.phrase)));
    if (dance && (bird || s.plan === "fish")) phrase("court_dance", dance, 5);
    else if (fam(s, "Gruidae", "Podicipedidae", "Diomedeidae")) rule("court_dance", `family ${s.family} (pairs dance)`, 5);
    else if ((has(b, "courtship") || (has(b, "display") && b.display.some((h) => h.field === "sexdiff" || /\b(male|court|mate|female)/i.test(h.phrase)))) && (ctx.sex.male.length || ctx.sex.female.length || ctx.sex.duller || has(b, "courtship"))) phrase("court_display", has(b, "courtship") ?? "display", 4);
    if (has(b, "allogroom")) phrase("allogroom", "allogroom", 5);
    else if (s.plan === "primate" && ["troop", "group", "pair"].includes(s.social ?? "")) rule("allogroom", `plan primate, social ${s.social} (grooms others)`, 4);

    // MARK: Flocks
    const small = (s.size ?? 50) <= 22;
    if (bird && small && (has(b, "murmuration") || (fam(s, "Sturnidae") && has(b, "flock")))) phrase("murmuration", has(b, "murmuration") ?? "flock", 6);
    if (has(b, "v_formation")) phrase("v_formation", "v_formation", 6);
    else if (bird && (fam(s, "Gruidae", "Pelecanidae") || (fam(s, "Anatidae") && named(s, /goose|swan/i)) || (fam(s, "Threskiornithidae") && named(s, /ibis/i)))) rule("v_formation", `family ${s.family} (flies in V or lines)`, 5);

    // MARK: Swarms, bats, mixed flocks, molehills (round 2)
    const insect = s.plan === "insect" || s.plan === "flying_insect";
    if (insect && has(b, "swarm")) {
        const clumps = b.swarm.every((h) => /aggregation|gather|cluster|clump|huddl/i.test(h.phrase) && !/swarm/i.test(h.phrase));
        const dusk = /^(Ephemeroptera|Blattodea|Isoptera)$/.test(s.order ?? "") || fam(s, "Formicidae", "Termitidae", "Rhinotermitidae", "Chironomidae", "Culicidae");
        phrase(clumps ? "cluster" : dusk ? "swarm_dusk" : "swarm", "swarm", 6);
    } else if (insect && has(b, "flock")) phrase("swarm", "flock", 4);
    if (s.plan === "bat") {
        rule("bat_emergence", "plan bat (streams out of its roost at dusk)", 6);
        if (/\bfish/i.test(s.text.diet ?? "") && /\b(fishing|trawl|catch\w* fish|fish (from|at) the (surface|water))/i.test(Object.values(s.text).join(" "))) rule("bat_trawl", "a fishing bat (its stored diet: fish, taken from the water)", 6);
        else if (s.diet === "insects" || /\binsects?\b|\bmoths?\b/i.test(s.text.diet ?? "")) rule("bat_hawk", "plan bat that eats insects (hawks them at night)", 6);
    }
    if (has(b, "mixed_flock") && (bird || s.plan === "primate" || s.plan === "quadruped")) phrase("mixed_follow", "mixed_flock", 5);
    const molePhrase = Object.values(s.text).join(" ").match(/\bmole-?hills?\b/i);
    if ((fam(s, "Talpidae", "Chrysochloridae", "Bathyergidae", "Spalacidae") && !named(s, /desman/i)) || molePhrase) molePhrase ? add("molehills", 5, {field: "facts", phrase: molePhrase[0]}) : rule("molehills", `family ${s.family} (pushes up mounds of earth)`, 5);

    // MARK: Nests
    let nesting = ctx.nesting.months;
    let nestingSrc: RecipeSource | null = ctx.nesting.src ? {field: ctx.nesting.src.field, phrase: ctx.nesting.src.phrase} : null;
    if (has(b, "nest_build") && ctx.nest && !(ctx.nest.kind === "cavity" && fam(s, "Picidae")) && ctx.nest.kind !== "burrow") {
        phrase("nest_build", "nest_build", 6);
        if (!nesting.length && bird) {
            nesting = [4, 5, 6];
            nestingSrc = {default: "no nesting months stored: northern spring (April to June) for a bird"};
        }
    }
    // Sea turtles come ashore for it (the episode crawls it up the beach and back, whatever its schedule's moves).
    if (has(b, "beach_nest") && s.plan === "turtle") phrase("beach_nest", "beach_nest", 5);
    else if (fam(s, "Cheloniidae", "Dermochelyidae")) rule("beach_nest", `family ${s.family} (sea turtles nest on beaches)`, 5);

    // MARK: Body-plan defaults (flagged)
    const defaults: string[] = [];
    const phraseOrRule = out.length;
    const fallback = (id: string, why: string, weight = 2) => {
        if (out.some((r) => r.id === id)) return;
        add(id, weight, {default: why});
        defaults.push(id);
    };
    if (bird) {
        fallback("preen_stretch", `plan ${s.plan}: preens and stretches`);
        if (s.interactions.includes("drink_edge") && !swims(s)) fallback("bathe", `plan ${s.plan}: bathes at the water's edge`);
    } else if (mammal && s.plan !== "fish") {
        fallback("groom_self", `class Mammalia: grooms`);
        fallback("stretch_yawn", "class Mammalia: stretches and yawns");
    } else if (s.plan === "insect" || s.plan === "flying_insect") {
        fallback("groom_self", `plan ${s.plan}: cleans its antennae and legs`, 1);
    }

    // MARK: Crossings and postures
    const crossing = crossingOf(s, b, bird, mammal, reptile);
    const posture = postureOf(s, b, bird);
    const hovers = Boolean(has(b, "hover")) || fam(s, "Laridae") && named(s, /tern/i) || named(s, /osprey|kestrel|pied.?kingfisher/i);
    void phraseOrRule;
    return {recipes: out, defaults, crossing, posture, hovers, nesting, nestingSrc};
}

function crossingOf(s: SpeciesText, b: Record<string, Hit[]>, bird: boolean, mammal: boolean, reptile: boolean): Crossing {
    const c = (entry: string, exit: string, after: string, src: RecipeSource): Crossing => ({entry, exit, after, src});
    if (fam(s, "Spheniscidae")) return c("slide", "hop", "preen", {rule: "family Spheniscidae (penguins slide in and leap out)"});
    if (fam(s, "Crocodylidae", "Alligatoridae", "Gavialidae", "Varanidae")) return c("slip", "walk", "bask", {rule: `family ${s.family} (slips in low and slow; basks after)`});
    if (s.plan === "turtle" || (reptile && s.plan === "legless")) return c("slip", "walk", "bask", {rule: `plan ${s.plan} (slips in; basks after)`});
    if (fam(s, "Phocidae", "Otariidae", "Odobenidae")) return c("slip", "haul", "none", {rule: `family ${s.family} (slips in; hauls out)`});
    if ((fam(s, "Mustelidae") && named(s, /otter|mink/i)) || fam(s, "Castoridae", "Ornithorhynchidae") || named(s, /water.?vole|capybara/i)) return c("dive", "walk", "shake", {rule: `family ${s.family} (dives in from the bank)`});
    if (s.className === "Amphibia") return c("dive", "walk", "none", {rule: "class Amphibia (jumps in)"});
    if (fam(s, "Anatidae", "Rallidae", "Podicipedidae", "Gaviidae")) return c("launch", "walk", "preen", {rule: `family ${s.family} (launches onto the water)`});
    if (fam(s, "Phalacrocoracidae", "Anhingidae")) return c("dive", "walk", "wing_dry", {rule: `family ${s.family} (dries its wings after)`});
    if (has(b, "flee_water")) return c(mammal || bird ? "dive" : "slip", "walk", mammal || bird ? "shake" : "none", {field: b.flee_water[0].field, phrase: b.flee_water[0].phrase});
    if (fam(s, "Hippopotamidae", "Elephantidae")) return c("wade", "walk", "none", {rule: `family ${s.family} (wades in; no shake)`});
    // Shaking off is for mammals and birds only (a turtle would sink with it).
    if (mammal) return c("wade", "walk", "shake", {default: "class Mammalia: wades in, shakes off after"});
    if (bird) return c("wade", "walk", "preen", {default: `plan ${s.plan}: wades in, preens after`});
    if (reptile) return c("wade", "walk", "bask", {default: "class Reptilia: basks after"});
    return c("wade", "walk", "none", {default: "no crossing style"});
}

function postureOf(s: SpeciesText, b: Record<string, Hit[]>, bird: boolean): {value: string; src: RecipeSource} | null {
    const hit = b.sleep_posture?.[0];
    if (hit) {
        const p = hit.phrase.toLowerCase();
        const value = /one leg/.test(p) ? "one_leg" : /upside|hang/.test(p) ? "hang" : /tuck/.test(p) ? "tuck" : /curl|coil|ball/.test(p) ? "curl" : /float|back/.test(p) ? "float" : /huddle/.test(p) ? "huddle" : /standing/.test(p) ? "stand" : null;
        if (value) return {value, src: {field: hit.field, phrase: hit.phrase}};
    }
    if (b.float_back) return {value: "float", src: {field: b.float_back[0].field, phrase: b.float_back[0].phrase}};
    if (fam(s, "Phoenicopteridae", "Ardeidae", "Ciconiidae", "Gruidae", "Threskiornithidae")) return {value: "one_leg", src: {rule: `family ${s.family} (sleeps on one leg)`}};
    if (s.plan === "bat" || fam(s, "Bradypodidae", "Choloepodidae", "Megalonychidae")) return {value: "hang", src: {rule: s.plan === "bat" ? "plan bat (hangs to sleep)" : `family ${s.family} (hangs to sleep)`}};
    if (bird) return {value: "tuck", src: {default: `plan ${s.plan}: head tucked`}};
    if (fam(s, "Felidae", "Canidae") || (REPTILES.has(s.className ?? "") && s.plan === "legless")) return {value: "curl", src: {rule: `${s.family}: sleeps curled`}};
    if (fam(s, "Equidae", "Giraffidae", "Elephantidae")) return {value: "stand", src: {rule: `family ${s.family} (sleeps standing)`}};
    return null;
}

/** The checks the generator stops on: every recipe a template, every template step a block, every crossing a style. */
export function validateRecipes(slug: string, c: Composed): string[] {
    const errors: string[] = [];
    for (const r of c.recipes) {
        const t = TEMPLATES[r.id];
        if (!t) errors.push(`${slug}: no template ${r.id}`);
        else for (const step of [...t.steps, ...(t.tail ?? [])]) if (!BLOCKS[step.b]) errors.push(`${slug}: template ${r.id} uses unknown block ${step.b}`);
        if (!(r.weight >= 1 && r.weight <= 9)) errors.push(`${slug}: ${r.id} weight ${r.weight}`);
    }
    if (!(ENTRY_STYLES as readonly string[]).includes(c.crossing.entry)) errors.push(`${slug}: entry ${c.crossing.entry}`);
    if (!(EXIT_STYLES as readonly string[]).includes(c.crossing.exit)) errors.push(`${slug}: exit ${c.crossing.exit}`);
    if (!(AFTER_STYLES as readonly string[]).includes(c.crossing.after)) errors.push(`${slug}: after ${c.crossing.after}`);
    if (c.posture && !(POSTURES as readonly string[]).includes(c.posture.value)) errors.push(`${slug}: posture ${c.posture.value}`);
    return errors;
}

const LETTERS = "abcdefghijkl";

/** The scene's compact row (decoded by `behaviour-recipes.ts` `decodeRecipeRow`). */
export function compactRow(c: Composed, sex: SexInfo, mating: Season, nest: Nest | null): string {
    const recipes = c.recipes.map((r) => `${r.id}.${r.weight}`).join(",");
    const system = {separate: "s", workers: "w", hermaphrodite: "h", changes: "c", parthenogenetic: "p"}[sex.system];
    const sexField = `${system}:${Math.round(sex.maleShare * 100)}:${sex.bigger === "male" ? "m" : sex.bigger === "female" ? "f" : "-"}:${Math.round(sex.sizeRatio * 100)}:${sex.duller === "male" ? "m" : sex.duller === "female" ? "f" : "-"}`;
    const months = (m: number[]) => m.map((n) => LETTERS[n - 1]).join("");
    const nestField = nest ? `${nest.kind}:${nest.materials.join("+")}` : "";
    const cross = `${c.crossing.entry}:${c.crossing.exit}:${c.crossing.after}`;
    const flags = `${c.hovers ? "h" : ""}${c.defaults.length && c.recipes.length === c.defaults.length ? "d" : ""}`;
    return [recipes, sexField, months(mating.months), months(c.nesting), c.recipes.some((r) => r.id === "nest_build") ? nestField : "", cross, c.posture?.value ?? "", flags].join("|");
}
