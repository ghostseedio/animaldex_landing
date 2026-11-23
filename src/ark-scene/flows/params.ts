/**
 * Behaviour flows (docs/ark/behaviour-flows.md, lane ARK-EATING pilot): each species' flow parameters from the stored
 * data, by deterministic rules (no model calls), each with the field and phrase it came from. Run at build time by
 * `scripts/ark-flow-params.mts`; the scene reads the generated table.
 */

import {nestProfile, type NestForm} from "@/ark-scene/props/nest-kinds";

export type FlowGuild = "grazer" | "browser" | "seed" | "nectar" | "glean" | "hawk" | "sitwait" | "stalker" | "pursuit" | "web" | "filter" | "fish" | "scavenger";
export type SearchMode = "graze" | "browse" | "sight" | "listen" | "watch" | "sitwait" | "web" | "flowers" | "probe" | "scent" | "swim";
export type CacheMethod = "bury" | "hide" | "hoard" | "larder" | "impale";
export type MatingSystem = "pair" | "rut" | "lek" | "none";

/** A food as the lines say it: "a rodent", "seeds"; `the`: "the rodent" for a prey that can get away, null for a mass food. */
export type FoodWord = {eat: string; the: string | null};

export type FlowParams = {
    slug: string;
    guild: FlowGuild;
    mode: SearchMode;
    /**
     * What it eats outside the server's own events: its background food as the engine stores it
     * (`voyage_species_traits.ambient_phrases`, `data/ark/ambient-foods.json`), in the engine's order. Empty: it eats only
     * the server's kills, caches and keepers' food (owner rule 2026-11-23: no fake events).
     */
    foods: FoodWord[];
    /** Seconds it searches on average before an attempt, before giving up, and handling a catch (size-scaled). */
    search: number;
    patience: number;
    handle: number;
    cache: {method: CacheMethod; chance: number} | null;
    /** A forage bout's length goal (s) before it is full, and what keepers feed it. */
    bout: number;
    kept: FoodWord;
    activity: "diurnal" | "nocturnal" | "crepuscular" | "any";
    twoPeaks: boolean;
    size: number;
    flock: boolean;
    /** The honey bee's waggle dance after a good bout (its stored text), and other foraging communication. */
    dance: boolean;
    repro: {system: MatingSystem; /** What a bird's nest is built of (its nest kind, `props/nest-kinds.ts`); null: no built nest. */ material: string | null; display: string | null; contest: string | null; call: boolean; scent: boolean; nest: boolean; incubates: "female" | "both" | null; provision: boolean; lek: boolean};
    src: Record<string, string>;
};

type Phrase = {field: string; phrase: string; match?: string};
export type FlowSources = {
    profiles: Array<{slug: string; name?: string; zone?: string; plan: string; move: string; activity: string; rhythm: string[]; diet: string; diets: string[]; size: number | null; social: string; roost: string; behaviours: Record<string, number>; src?: Record<string, {field?: string; phrase?: string; default?: string; rule?: string}>}>;
    recipes: Array<{slug: string; recipes?: Array<{id: string; weight: number; src?: {field?: string; phrase?: string}}>; behaviours?: Record<string, Phrase[]>}>;
    acts: Array<{slug: string; act: string; quote?: string | null; because?: string}>;
    tactics: Array<{slug: string; style?: {style: string; phrase: string} | null}>;
    /** The engine's background food per kind (`voyage_species_traits.ambient_phrases`). */
    ambient?: Record<string, string[]>;
};

export const PILOT_SLUGS = ["red-fox", "grey-heron", "house-sparrow", "red-deer", "western-honey-bee", "domestic-cat", "eurasian-jay", "black-and-yellow-garden-spider", "orb-weaver-spider", "greater-sage-grouse"];

// MARK: Food words from the stored diet sentence

/** Count nouns, plural → singular. */
const COUNT: Record<string, string> = {
    rodents: "rodent", rabbits: "rabbit", birds: "bird", eggs: "egg", insects: "insect", acorns: "acorn", nuts: "nut", flies: "fly", mosquitoes: "mosquito",
    moths: "moth", wasps: "wasp", beetles: "beetle", grasshoppers: "grasshopper", bees: "bee", frogs: "frog", worms: "worm", earthworms: "earthworm",
    snails: "snail", slugs: "slug", mice: "mouse", voles: "vole", lizards: "lizard", snakes: "snake", crabs: "crab", shrimps: "shrimp", spiders: "spider",
    caterpillars: "caterpillar", ants: "ant", termites: "termite", larvae: "larva", fruits: "fruit", berries: "berry", "small animals": "small animal",
    "small reptiles": "small reptile", "small mammals": "small mammal", "flying insects": "flying insect", "other flying insects": "flying insect", fish: "fish", squid: "squid"
};
/** Mass foods (said as they are). */
const MASS = new Set(["seeds", "crumbs", "grain", "grains", "scraps", "grass", "grasses", "heather", "herbs", "leaves", "shoots", "bark", "fruit", "carrion", "nectar", "pollen", "sagebrush leaves", "algae", "plankton", "honey", "meat-based food"]);

function article(noun: string): string {
    return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

export function foodWordsOf(phrase: string | null | undefined): FoodWord[] {
    if (!phrase) return [];
    const out: FoodWord[] = [];
    const seen = new Set<string>();
    const text = phrase.toLowerCase().replace(/\.$/, "").replace(/that blunder into the web make up most meals|caught in the web|converted to honey and stored|for protein|make up nearly the whole winter diet and much of the rest of the year/g, "");
    for (let item of text.split(/,|;|\band\b|\bor\b/)) {
        item = item.replace(/\b(other|opportunistic|mainly|mostly|especially|some)\b/g, "").replace(/\s+/g, " ").trim();
        if (!item) continue;
        let word: FoodWord | null = null;
        if (item === "small prey" || item === "prey") word = {eat: "small prey", the: "the prey"};
        else if (COUNT[item]) word = {eat: article(COUNT[item]), the: `the ${COUNT[item]}`};
        else if (MASS.has(item)) word = {eat: item === "grasses" ? "grass" : item, the: null};
        else {
            const last = item.split(" ").pop()!;
            if (COUNT[last]) word = {eat: article(COUNT[last]), the: `the ${COUNT[last]}`};
            else if (MASS.has(last)) word = {eat: last === "grasses" ? "grass" : last, the: null};
        }
        if (word && !seen.has(word.eat)) {
            seen.add(word.eat);
            out.push(word);
        }
    }
    return out;
}


// MARK: Guild priors (docs section 4.2: model numbers, not species facts)

/** search (s, mean to the next try), patience (s), handle (s, at size 30), success, near-miss share, forage bout goal (s). */
const PRIOR: Record<FlowGuild, [number, number, number, number, number, number]> = {
    grazer: [25, 900, 150, 0.97, 0, 1800],
    browser: [30, 900, 120, 0.95, 0, 1500],
    seed: [12, 300, 8, 0.8, 0.3, 600],
    nectar: [6, 360, 5, 0.6, 0, 700],
    glean: [20, 420, 10, 0.5, 0.5, 900],
    hawk: [35, 600, 12, 0.4, 0.75, 900],
    sitwait: [120, 1500, 25, 0.5, 0.7, 2100],
    stalker: [140, 1500, 90, 0.3, 0.75, 2400],
    pursuit: [200, 1800, 300, 0.25, 0.8, 2700],
    web: [600, 7200, 120, 0.8, 1, 7200],
    filter: [20, 600, 15, 0.9, 0, 1200],
    fish: [90, 1200, 20, 0.45, 0.75, 1500],
    scavenger: [300, 2400, 400, 0.6, 0.5, 3000]
};

function guildOf(diet: string, act: string | null, style: string | null, recipes: Set<string>, move: string): {guild: FlowGuild; why: string} {
    if (act === "web" || style === "trap") return {guild: "web", why: `hunt act ${act ?? style}`};
    if (act === "wade" || recipes.has("wade_spear")) return {guild: "sitwait", why: "hunt act wade"};
    if (act === "leap" || act === "pounce" || recipes.has("pounce")) return {guild: "stalker", why: `hunt act ${act ?? "pounce recipe"}`};
    if (act === "hawk" || recipes.has("hawk_insects")) return {guild: "hawk", why: `hunt act ${act ?? "hawk_insects"}`};
    if (act === "talon" || act === "plunge" || recipes.has("perch_plunge") || recipes.has("air_plunge") || diet === "fish") return {guild: "fish", why: act ? `hunt act ${act}` : `diet ${diet}`};
    switch (diet) {
        case "grazer":
            return {guild: "grazer", why: "diet grazer"};
        case "browser":
            return {guild: "browser", why: "diet browser"};
        case "seeds":
        case "fruit":
            return {guild: "seed", why: `diet ${diet}`};
        case "nectar":
            return {guild: "nectar", why: "diet nectar"};
        case "carrion":
            return {guild: "scavenger", why: "diet carrion"};
        case "filter":
        case "algae":
        case "detritus":
            return {guild: "filter", why: `diet ${diet}`};
        case "meat":
            return {guild: style === "ambush" ? "sitwait" : style === "stalk" ? "stalker" : "pursuit", why: `diet meat, style ${style ?? "none"}`};
        default:
            return {guild: move === "swim" ? "filter" : "glean", why: `diet ${diet}`};
    }
}

function phrasesOf(row: FlowSources["recipes"][number] | undefined, ...keys: string[]): Phrase[] {
    return keys.flatMap((k) => row?.behaviours?.[k] ?? []);
}

export function flowParamsOf(profile: FlowSources["profiles"][number], recipeRow: FlowSources["recipes"][number] | undefined, act: FlowSources["acts"][number] | undefined, tactic: FlowSources["tactics"][number] | undefined, ambient: readonly string[] = []): FlowParams {
    const src: Record<string, string> = {};
    const recipes = new Set((recipeRow?.recipes ?? []).map((r) => r.id));
    const style = tactic?.style?.style ?? null;
    const {guild, why} = guildOf(profile.diet, act?.act ?? null, style, recipes, profile.move);
    src.guild = why;
    // Its foods: the engine's background food only (never the diet sentence's prey: those are the server's kills).
    const foods = ambient.length ? foodWordsOf(ambient.join(", ")) : [];
    src.foods = ambient.length ? `engine: voyage_species_traits.ambient_phrases ${JSON.stringify(ambient)}` : "engine: no background food stored (eats only the server's kills, caches and keepers' food)";
    const [search, patience0, handle0, , , bout] = PRIOR[guild];
    const size = profile.size ?? 30;
    const scale = Math.min(Math.max(0.6 + size / 60, 0.6), 2.5);
    // (Timings: the guild's prior scaled by body size. No stored field gives them yet; each says so. Section 4.2.)
    const prior = `estimate: ${guild} guild prior x size scale ${scale.toFixed(2)} (size ${profile.size === null ? "30 default" : `${profile.size} from profile size`})`;
    src.search = prior;
    src.patience = prior;
    src.handle = prior;
    src.bout = prior;
    src.size = profile.size === null ? "default 30 (no profile size)" : "profile size";
    src.activity = profile.src?.activity?.phrase ? `profile activity: "${profile.src.activity.phrase}"` : `profile activity (${profile.activity})`;
    // Patience from the stored text: a kind said to wait long waits long.
    const waits = [...phrasesOf(recipeRow, "pounce", "wade", "freeze"), ...(act?.quote ? [{field: "hunt act", phrase: act.quote}] : [])].find((p) => /many minutes|extended periods|motionless|patience/i.test(p.phrase));
    let patience = patience0;
    if (waits) {
        patience *= 2;
        src.patience = `${prior}, doubled by ${waits.field}: "${waits.phrase}"`;
    }
    // Search mode.
    let mode: SearchMode = guild === "grazer" ? "graze" : guild === "browser" ? "browse" : guild === "nectar" ? "flowers" : guild === "web" ? "web" : guild === "sitwait" ? "sitwait" : guild === "filter" || guild === "fish" ? (profile.move === "swim" ? "swim" : "sitwait") : "sight";
    // (Its hunt act's own sentence first: a cat "crouched motionless" watches, a fox that hears "rodents moving" listens.)
    const actHears = act?.quote && /hearing|listen/i.test(act.quote) ? {field: "hunt act", phrase: act.quote} : null;
    const hearing = actHears ?? (waits ? null : phrasesOf(recipeRow, "pounce").find((p) => /hearing|listen/i.test(p.phrase)));
    if (guild === "stalker" && hearing) {
        mode = "listen";
        src.mode = `${hearing.field}: "${hearing.phrase}"`;
    } else if (guild === "stalker" && waits) {
        mode = "watch";
        src.mode = `${waits!.field}: "${waits!.phrase}"`;
    } else if (recipes.has("probe_feed") || recipes.has("worm_pull")) mode = "probe";
    // Caching: only with a stored caching phrase.
    const caching = phrasesOf(recipeRow, "caching")[0] ?? (recipeRow?.recipes ?? []).filter((r) => r.id === "cache_food").map((r) => ({field: r.src?.field ?? "recipe", phrase: r.src?.phrase ?? "cache_food"}))[0];
    let cache: FlowParams["cache"] = null;
    if (caching) {
        const text = caching.phrase.toLowerCase();
        const method: CacheMethod = /impal/.test(text) ? "impale" : /larder/.test(text) ? "larder" : /underground|bur(y|ied)/.test(text) ? "bury" : /hoard|store/.test(text) ? "hoard" : "hide";
        cache = {method, chance: guild === "seed" ? 0.45 : 0.25};
        src.cache = `${caching.field}: "${caching.phrase}"`;
    }
    const kept: FoodWord = guild === "grazer" ? {eat: "hay", the: null} : guild === "browser" ? {eat: "pellets", the: null} : guild === "seed" ? {eat: "seed", the: null} : guild === "fish" ? {eat: "fish", the: null} : guild === "stalker" || guild === "pursuit" ? foods.find((f) => /food/.test(f.eat)) ?? {eat: "meat", the: null} : {eat: "its food", the: null};
    // Reproduction (section 5).
    const court = phrasesOf(recipeRow, "courtship", "display");
    const dance = court.some((p) => /waggle/i.test(p.phrase));
    if (dance) src.dance = `${court.find((p) => /waggle/i.test(p.phrase))!.field}: "${court.find((p) => /waggle/i.test(p.phrase))!.phrase}"`;
    const lekPhrase = court.find((p) => /\blek/i.test(p.phrase));
    const rutPhrase = [...court, ...phrasesOf(recipeRow, "male_combat")].find((p) => /\brut\b/i.test(p.phrase));
    const incubate = phrasesOf(recipeRow, "incubate")[0];
    const provision = phrasesOf(recipeRow, "provision")[0];
    const system: MatingSystem = dance && !lekPhrase ? "none" : lekPhrase ? "lek" : rutPhrase ? "rut" : provision || incubate || profile.social === "pair" ? "pair" : "none";
    if (lekPhrase) src.system = `${lekPhrase.field}: "${lekPhrase.phrase}"`;
    else if (rutPhrase) src.system = `${rutPhrase.field}: "${rutPhrase.phrase}"`;
    else if (provision) src.system = `${provision.field}: "${provision.phrase}"`;
    const display = dance ? null : (["strut_display", "court_dance", "court_display", "pushup"].find((r) => recipes.has(r)) ?? null);
    const contest = ["antler_clash", "horn_clash", "jaw_spar", "box_spar", "lizard_contest", "wrestle"].find((r) => recipes.has(r)) ?? null;
    const incubates = incubate ? (/alone|female/i.test(incubate.phrase) ? "female" : /both/i.test(incubate.phrase) ? "both" : "female") : null;
    if (incubate) src.incubates = `${incubate.field}: "${incubate.phrase}"`;
    return {
        slug: profile.slug,
        guild,
        mode,
        foods,
        search: Math.round(search * scale),
        patience: Math.round(patience * scale),
        handle: Math.round(handle0 * scale),
        cache,
        bout: Math.round(bout * scale),
        kept,
        activity: (["diurnal", "nocturnal", "crepuscular", "any"].includes(profile.activity) ? profile.activity : "diurnal") as FlowParams["activity"],
        twoPeaks: profile.rhythm.includes("two_peaks"),
        size,
        flock: ["flock", "herd", "group", "colony"].includes(profile.social),
        dance,
        repro: {system, material: nestMaterial(profile, Boolean(incubate || provision || recipes.has("nest_build"))), display, contest, call: recipes.has("call_bout"), scent: recipes.has("scent_mark"), nest: Boolean(incubate || provision || recipes.has("nest_build")), incubates, provision: Boolean(provision), lek: Boolean(lekPhrase)},
        src
    };
}

/** A nest kind's building material, as a trip carries it (the nest forms' own words, `props/nest-kinds.ts`). */
const MATERIAL: Partial<Record<NestForm, string>> = {
    cup: "twigs and grass", platform: "sticks", eyrie: "sticks", down_bowl: "grass", mud_cup: "mud", ball: "grass", dome: "moss", pendant: "grass strips", floating: "water weed", mound: "reeds", pebbles: "a pebble", megapode: "leaf litter"
};

function nestMaterial(profile: FlowSources["profiles"][number], nests: boolean): string | null {
    if (!nests || !/bird/.test(profile.plan)) return null;
    const form = nestProfile({model_slug: profile.slug, name: profile.name ?? profile.slug, zone: (profile.zone ?? "grassland") as never}).form;
    return MATERIAL[form] ?? null;
}

export function buildFlowParams(sources: FlowSources, only: readonly string[] | null): Record<string, FlowParams> {
    const recipes = new Map(sources.recipes.map((r) => [r.slug, r]));
    const acts = new Map(sources.acts.map((a) => [a.slug, a]));
    const tactics = new Map(sources.tactics.map((t) => [t.slug, t]));
    const out: Record<string, FlowParams> = {};
    for (const profile of sources.profiles) {
        if (only && !only.includes(profile.slug)) continue;
        out[profile.slug] = flowParamsOf(profile, recipes.get(profile.slug), acts.get(profile.slug), tactics.get(profile.slug), sources.ambient?.[profile.slug] ?? []);
    }
    return out;
}
