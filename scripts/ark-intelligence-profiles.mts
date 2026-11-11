#!/usr/bin/env -S npx tsx
/**
 * Intelligence profiles for every Ark species (the behaviour intelligence
 * pass): how far it sees and hears, how it hunts, forages and defends
 * itself, whether it uses tools, whether it keeps watch for its group, who
 * it shares a place with, and how rich its behaviour is (its intelligence
 * stat). Visual only: the server's ecology decides life and death; these
 * only decide what an animal near the camera is seen doing.
 *
 * Sibling of the behaviour lane's profiles (`scripts/ark-behaviour-profiles.mts`,
 * `src/ark-scene/behaviours.json`): keyed the same way (model slug), read
 * beside them, never a second copy of their fields. The body plan, diet,
 * social kind, roost and size come from `data/ark/behaviour-profiles.json`.
 *
 * Judgement: the rules below are Claude Code's reading of the stored text,
 * written as keyword rules so every field keeps the verbatim phrase that
 * decided it (`src`). Where the text is silent a field takes its body plan's
 * archetype default, flagged in `defaults`. The rare, easily-misread fields
 * (tool use, sentinels, caching, mixed-species company, cleaners, playing
 * dead) were read candidate by candidate and settled in
 * `scripts/ark-intelligence-reviewed.json`; a keyword hit not confirmed
 * there is not used. Tool use only where the text says so.
 *
 * Sentences that are the Power's metaphor ("teaches", "shows us", "the
 * right tool", "lesson") and sentences about larvae are left out before
 * any rule reads the text.
 *
 * Inputs (read-only):
 *   1. a live export (from the AnimalDex repo, `supabase db query --linked -o json`, see docs/ark/intelligence.md);
 *   2. `data/ark/behaviour-profiles.json` (the behaviour lane's full profiles);
 *   3. the traits lane's food links (`food_links.json`, rules with group labels) and `traits.json` (num → id),
 *      for who can eat whom (the ecology's own links: the scene reacts only to an animal that could eat it);
 *   4. `scripts/ark-intelligence-reviewed.json` (the hand-checked rare fields).
 *
 *   npx tsx scripts/ark-intelligence-profiles.mts export.json food_links.json traits.json
 *
 * Outputs: `data/ark/intelligence-profiles.json` (full, with phrases) and
 * `src/ark-scene/intelligence.json` (compact rows, decoded by `intelligence-profile.ts`).
 */

import fs from "node:fs";
import path from "node:path";

type Row = {
    id: string;
    slug: string | null;
    zone: string | null;
    excluded_reason: string | null;
    name: string;
    stats: {size?: number; speed?: number; dominance?: number; rarity?: number; intelligence?: number} | null;
    activity: string | null;
    sociality: string | null;
    sociality_phrase: string | null;
    sleep_pattern: string | null;
    best_time_of_day: string | null;
    typical_habitat: string | null;
    where_to_look: string | null;
    diet_summary: string | null;
    predators_summary: string | null;
    signature_traits: string[] | null;
    interesting_facts: string[] | null;
    species_spotlight: string | null;
    species_subtitle_story: string | null;
    female_offspring_notes: string | null;
    class_name: string | null;
    order_name: string | null;
    family_name: string | null;
};

type Behaviour = {slug: string; id: string; excluded: string | null; zone: string | null; plan: string; move: string; moves: string[]; activity: string; roost: string; social: string; diet: string; diets: string[]; size: number | null; dominance: number | null; behaviours: Record<string, number>; interactions: string[]};

const [exportPath, foodPath, traitsPath] = process.argv.slice(2);
if (!exportPath || !foodPath || !traitsPath) {
    console.error("usage: ark-intelligence-profiles.mts export.json food_links.json traits.json");
    process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const exported = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const rows: Row[] = (Array.isArray(exported) ? exported : exported.rows).filter((r: Row) => r.slug);
const behaviours = new Map<string, Behaviour>((JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-profiles.json"), "utf8")).profiles as Behaviour[]).map((p) => [p.slug, p]));
const reviewed: Reviewed = JSON.parse(fs.readFileSync(path.join(root, "scripts/ark-intelligence-reviewed.json"), "utf8"));

type Verdict = {keep: boolean; why: string; value?: string; field?: Field; phrase?: string};
type Reviewed = Record<"tools" | "sentinel" | "cache" | "mixed" | "cleaner" | "play_dead", Record<string, Verdict>>;

// MARK: Text

type Field = "diet" | "facts" | "traits" | "sleep" | "look" | "predators" | "offspring" | "habitat" | "spotlight" | "story" | "sociality";
type Source = {field: Field; phrase: string} | {rule: string} | {default: string};

const YOUNG = /\b(larva|larvae|larval|caterpillars?|nymphs?|naiads?|tadpoles?|grubs|maggots|hellgrammites?)\b/i;
/** The Power's metaphor, not the animal's life: never evidence. */
const METAPHOR = /\b(teach(es|ing)?|shows? us|reminds? us|lesson|principle|survival tool|the right tool|strategy shows|it shows|this shows|metaphor|symbol)\b/i;

/**
 * The Power's name in a sentence ("Nuts, seeds and cones support Stashing because ..."): capitalised mid-sentence,
 * then "because". The clause from "support" on is the Power's; what comes before it is still the animal's own
 * (its diet), so only the clause is cut, not the sentence.
 */
const POWER_NAME = /\s*\bsupports? [A-Z][a-z]+( [A-Z][a-z]+)* because\b.*$/;

function sentences(text: string | null | undefined): string {
    if (!text) return "";
    return text
        .replace(/^Native range keys:[^.]*\.\s*/, "")
        .split(/(?<=[.;!?])\s+/)
        .map((s) => (POWER_NAME.test(s) ? s.replace(POWER_NAME, ".") : s))
        .filter((s) => s.length > 1 && !YOUNG.test(s) && !METAPHOR.test(s))
        .join(" ");
}

const FIELDS: Record<Field, (r: Row) => string> = {
    diet: (r) => sentences(r.diet_summary),
    facts: (r) => sentences((r.interesting_facts ?? []).join(" ")),
    traits: (r) => sentences((r.signature_traits ?? []).map((t) => (/[.!?]$/.test(t) ? t : `${t}.`)).join(" ")),
    sleep: (r) => sentences(r.sleep_pattern),
    look: (r) => sentences(r.where_to_look),
    predators: (r) => sentences(r.predators_summary),
    offspring: (r) => sentences(r.female_offspring_notes),
    habitat: (r) => sentences(r.typical_habitat),
    spotlight: (r) => sentences(r.species_spotlight),
    story: (r) => sentences(r.species_subtitle_story),
    sociality: (r) => sentences(r.sociality_phrase)
};

/** The clause round a match (a verbatim substring, at most ~110 characters). */
function clause(text: string, index: number, length: number): string {
    let start = 0;
    for (const stop of [". ", "; ", "! ", "? "]) {
        const at = text.lastIndexOf(stop, index);
        if (at >= 0) start = Math.max(start, at + 2);
    }
    let end = text.length;
    for (const stop of [". ", "; ", "! ", "? "]) {
        const at = text.indexOf(stop, index + length);
        if (at >= 0) end = Math.min(end, at + 1);
    }
    if (end - start > 110) {
        const comma = text.lastIndexOf(", ", index);
        if (comma >= 0 && comma + 2 > start && index - (comma + 2) < 60) start = comma + 2;
        const after = text.indexOf(", ", index + length);
        if (after >= 0 && after < end && after - start > 20) end = after;
        if (end - start > 130) {
            // Cut at word breaks, so a phrase never starts or ends mid-word.
            const from = text.lastIndexOf(" ", Math.max(start, index - 50));
            const to = text.indexOf(" ", Math.min(end, index + length + 60));
            if (from >= 0) start = Math.max(start, from + 1);
            end = to > 0 ? Math.min(end, to) : end;
        }
    }
    return text.slice(start, end).trim().replace(/[.;,!?]$/, "");
}

/** Words just before a match that make it about something else (its prey, its predator, a negation). */
const NOT_ITS_OWN = /\b(prey|preys|predators?|enemies|rarely|seldom|little|unlike|than)\s+([\w-]+\s+)?$|\b(no|not|never|without|lacks?|lacking|nor)\b[^,.;:]*$/i;

type Hit = {field: Field; phrase: string; match: string};
function find(row: Row, fields: Field[], pattern: RegExp, guard = true): Hit | null {
    const global = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    for (const field of fields) {
        const text = FIELDS[field](row);
        if (!text) continue;
        global.lastIndex = 0;
        for (let m = global.exec(text); m; m = global.exec(text)) {
            if (guard && NOT_ITS_OWN.test(text.slice(Math.max(0, m.index - 30), m.index))) continue;
            return {field, phrase: clause(text, m.index, m[0].length), match: m[0].toLowerCase()};
        }
    }
    return null;
}
const src = (hit: Hit): Source => ({field: hit.field, phrase: hit.phrase});

const OWN: Field[] = ["diet", "facts", "traits", "sleep", "look", "offspring", "spotlight", "story"];
const DEFENCE_TEXT: Field[] = ["predators", "facts", "traits", "sleep", "look", "spotlight", "story"];

// MARK: Vocabulary

export const HUNT = ["ambush", "pursuit", "stalk", "pack", "aerial_swoop", "aerial_hawk", "perch_wait", "filter", "scavenge", "probe_strike"] as const;
export const FORAGE = ["graze", "browse", "dig", "cache", "fish", "flower", "tide_pool", "glean", "probe", "fruit", "seed_pick", "filter", "scrape"] as const;
export const DEFENCE = ["flee_cover", "flee_water", "flee_tree", "flee_open", "fly_off", "freeze", "group", "play_dead", "threat", "armour", "chemical", "burrow"] as const;
type Hunt = (typeof HUNT)[number];
type Forage = (typeof FORAGE)[number];
type Defence = (typeof DEFENCE)[number];

const HUNT_RULES: Array<[RegExp, Hunt]> = [
    [/\b(ambush\w*|lies? in wait|lying in wait|sit[- ]and[- ]wait|waits? (motionless|patiently|still|in hiding|hidden|for (prey|passing|fish|insects|a))|lurk\w*|lures? (prey|fish)|strikes? (at )?(passing|prey that)|waits? at (the )?water)\b/i, "ambush"],
    [/\b(in packs?|pack[- ]hunt\w*|hunts? (together|cooperatively|in (groups|teams|pods|packs))|cooperative(ly)? (hunt\w*|herd\w*)|herd(s|ing)? (fish|prey|shoals)|work(s|ing)? together to (catch|hunt|herd)|coordinated (hunt|attack))\b/i, "pack"],
    [/\b(stalk\w*|creeps? (up|close|toward)|sneaks? up)\b/i, "stalk"],
    // Its own chase, with what it chases (a "client may chase the cleaner" or "the chase is not worth it" are not).
    [/\b(chas(es|ing) (down )?(its )?(prey|fish|insects|birds|mammals|rodents|lizards|hares|rabbits|squid|deer|antelope|gazelles|shoals?)|pursu(es|ing) (its )?(prey|fish|insects|birds|squid)|pursuit (div\w+|hunt\w*|predator)|runs? (prey )?down|sprint\w*|outrun\w*|high-speed (chases?|pursuits?)|fast (chases?|pursuits?))\b/i, "pursuit"],
    [/\b(swoop\w*|stoop\w*|plunge[- ]?div\w*|plung(e|es|ing) (into|onto|down)|dives? (on|onto|down on|from (a |the )?(air|height|above)|into the water for)|drops? (on|onto|down on)|snatch(es|ing)? (fish|prey|it) from|talons|hovers? (and|before|then) (drop|dive|pounce))\b/i, "aerial_swoop"],
    [/\b(hawk(s|ing)? (for )?(insects|flies|prey)|catch(es|ing)? (insects|prey|flies|moths)( \w+)? (in flight|on the wing|in the air|in mid-?air)|(in flight|on the wing|in mid-?air)[^.]{0,30}(catch\w*|snap\w*|insects)|echolocat\w+ (to find|to catch|insects|prey))\b/i, "aerial_hawk"],
    [/\b(from (a|an|its) (perch|branch|post|wire|vantage point|lookout)|perch(es|ed)? (and|to) (watch|scan|wait)|sall(y|ies|ying)|watch(es|ing)? (for prey )?from (a|an) (perch|branch)|pounces? from (a )?(perch|branch))\b/i, "perch_wait"],
    [/\b(filter[- ]?feed\w*|filters? (plankton|food|small|water|particles)|strain(s|ing)? (food|plankton|water|krill)|sieves?|baleen|lamellae|gill rakers)\b/i, "filter"],
    [/\b(scaveng\w*|carrion|carcass(es)?|dead (animals|fish|prey)|kills of other)\b/i, "scavenge"],
    [/\b(spear(s|ing)?|stab(s|bing)?|strikes? (fish|prey|quickly|with)|lunges?)\b/i, "probe_strike"]
];

const FORAGE_RULES: Array<[RegExp, Forage]> = [
    [/\b(graz(e|es|ing|ers?)|crops? (the )?grass)\b/i, "graze"],
    [/\b(brows(e|es|ing|er)|strips? (leaves|bark)|leaves (of|from) (trees|shrubs|bushes))\b/i, "browse"],
    [/\b(dig(s|ging)? (for|up|out|into|through)|root(s|ing)? (for|through|up|around)|excavat\w*|unearth\w*|scratch(es|ing)? (in|through|at) (the )?(soil|litter|ground|leaf)|grub(s|bing)? (for|in))\b/i, "dig"],
    [/\b(cach(e|es|ed|ing)|stor(e|es|ing) (food|nuts|seeds|acorns|prey|it)|hoard\w*|bur(y|ies|ying) (nuts|seeds|acorns|food|prey)|larders?|granar(y|ies))\b/i, "cache"],
    [/\b(fish(es|ing)? (for|from|in)|catch(es|ing)? fish|feeds? (mainly |mostly |largely )?on fish|fish-eat\w*|piscivor\w*)\b/i, "fish"],
    [/\b(nectar|pollen|visits? flowers|flower visitor|feeds? (at|on|from) flowers)\b/i, "flower"],
    [/\b(tide ?pools?|rock ?pools?|at low tide|intertidal|exposed at low)\b/i, "tide_pool"],
    [/\b(glean\w*|picks? (insects|food|prey|them|small) (from|off)|(insects|caterpillars|spiders) from (leaves|bark|foliage|twigs)|searches? (leaves|bark|foliage) for)\b/i, "glean"],
    [/\b(prob(e|es|ing) (in|into|for|the|soft|mud|sand)|sweeps? (its|the) bill|side-to-side|bill into (the )?(mud|sand|water))\b/i, "probe"],
    [/\b(fruits?|berries|figs)\b/i, "fruit"],
    [/\b(seeds?|grain|nuts)\b/i, "seed_pick"],
    [/\b(scrap(e|es|ing) (algae|food|films?)|rasp(s|ing)?|grazes? (algae|on algae))\b/i, "scrape"]
];

const DEFENCE_RULES: Array<[RegExp, Defence]> = [
    [/\b(play(s|ing)? dead|feign(s|ing)? death|death[- ]feign\w*|thanatosis|lies? still as if dead)\b/i, "play_dead"],
    [/\b((flee|escape|dive|retreat|slip|plunge|drop|jump|leap|dash|bolt|run)(s|es|ing)? (in|into|to|under|beneath|back into) (the )?(water|river|pond|lake|sea|stream|pool))\b/i, "flee_water"],
    [/\b((climb|flee|escape|retreat|run|scramble|scurr(y|ie)|dash|bound)(s|es|ing)? (quickly )?(up )?(in|into|up) (a |the )?(trees?|canopy|branches|trunk)|takes? refuge in (the )?trees)\b/i, "flee_tree"],
    [/\b((retreat|flee|escape|dash|bolt|run|dart|hide|disappear|scuttle|scurr(y|ie)|vanish|withdraw)(s|es|ing)? (quickly |rapidly |back )?(in|into|to|under|back into|for|down) (the |its |a |dense |thick |nearby )?(cover|burrows?|crevices?|holes?|dense|thick|vegetation|undergrowth|rocks|shelter|the reef|coral|sand|mud|leaf litter|thickets?|bushes|grass|reeds|tunnels?|den|cracks?))\b/i, "flee_cover"],
    [/\b(freez(e|es|ing)|keeps? (very )?still|stays? (very )?still|motionless|camouflag\w*|cryptic|blends? (in|into|with)|well hidden|resembl(es|ing) (a |an )?(twig|leaf|leaves|bark|stick|stone|pebble|seaweed|bird dropping|lichen|thorn)|mimics? (a |an )?(twig|leaf|leaves|bark|stick|stone|pebble|seaweed|bird dropping|lichen|thorn)|(twig|leaf|bark|stick|stone|seaweed|lichen)[- ](like )?mimic\w*|ghost-mimic|stick-like|leaf-like|bark-like)\b/i, "freeze"],
    [/\b(huddl\w*|bunch(es|ing)? (up|together)|close ranks|defensive (circle|ring)|forms? a (circle|ring)|mob(s|bing)? (predators|hawks|owls|intruders)?|safety in numbers|group vigilance|herd vigilance|many eyes)\b/i, "group"],
    [/\b(threat display|hiss(es|ing)?|puff(s|ing)? (itself |up)|inflat(es|ing) (itself|its)|rears? up|raises? (its |a )?(crest|hood|hackles|tail|quills|spines|frill)|spreads? (its )?(hood|frill)|eyespots?|warning colou?r\w*|aposematic|flash(es|ing)? (its|the|bright)|bluff\w*|gap(es|ing)|rattl(e|es|ing)|stamp(s|ing)?|thump(s|ing)?|snarl\w*|growl\w*|bares? (its )?teeth|charges? (at )?(intruders|predators|threats))\b/i, "threat"],
    [/\b(curls? (up )?into a (tight )?ball|rolls? (up )?into a (tight )?ball|withdraws? (into|its head|its limbs)|clos(e|es) (its|the) shell|armou?r(ed)?|bony plates|spines|quills|spiny)\b/i, "armour"],
    [/\b(sprays? (musk|fluid|a foul|acid|chemicals?)|squirts? (blood|ink|fluid)|ink|toxic|toxins?|poison(ous)?|noxious|foul[- ](smelling|tasting)|distasteful|bad-tasting|unpalatable|musk|secret(es|ions?)|venom(ous)? (spines|sting)|stings?)\b/i, "chemical"],
    [/\b(dig(s|ging)? (itself|themselves) in|burrows? (quickly|rapidly) into|buries itself)\b/i, "burrow"]
];

// MARK: Food links (who can eat whom)

type FoodRule = {predator: string; basis: string; group_label: string | null; prey_ok: number[]};
const food = JSON.parse(fs.readFileSync(foodPath, "utf8"));
const traits = JSON.parse(fs.readFileSync(traitsPath, "utf8"));
const idOfNum = new Map<number, string>((traits.traits as Array<{num: number; species_profile_id: string}>).map((t) => [t.num, t.species_profile_id]));
const slugOfId = new Map<string, string>(rows.map((r) => [r.id, r.slug!]));
const groupLabels: string[] = Object.keys(food.seed.groups).sort();
const groupIndex = new Map(groupLabels.map((g, i) => [g, i]));
const inGroups = new Map<string, Set<number>>();
for (const [label, nums] of Object.entries(food.seed.groups as Record<string, number[]>)) {
    for (const num of nums) {
        const slug = slugOfId.get(idOfNum.get(num) ?? "");
        if (!slug) continue;
        const set = inGroups.get(slug) ?? new Set<number>();
        set.add(groupIndex.get(label)!);
        inGroups.set(slug, set);
    }
}
const eatsGroups = new Map<string, Set<number>>();
const eatsSpecies = new Map<string, Set<string>>();
for (const rule of food.rules as FoodRule[]) {
    const predator = slugOfId.get(rule.predator);
    if (!predator) continue;
    if (rule.basis === "group" && rule.group_label && groupIndex.has(rule.group_label)) {
        const set = eatsGroups.get(predator) ?? new Set<number>();
        set.add(groupIndex.get(rule.group_label)!);
        eatsGroups.set(predator, set);
    } else if (rule.basis === "species") {
        for (const num of rule.prey_ok ?? []) {
            const prey = slugOfId.get(idOfNum.get(num) ?? "");
            if (!prey || prey === predator) continue;
            const set = eatsSpecies.get(predator) ?? new Set<string>();
            set.add(prey);
            eatsSpecies.set(predator, set);
        }
    }
}

// MARK: The profile

const RAPTOR_FAMILIES = /^(Accipitridae|Falconidae|Pandionidae|Sagittariidae|Cathartidae)$/;
const OWL_FAMILIES = /^(Strigidae|Tytonidae)$/;
const CAT = /^Felidae$/;
const DOG = /^Canidae$/;
const HERON = /^(Ardeidae|Ciconiidae|Balaenicipitidae)$/;
const KINGFISHER = /^(Alcedinidae|Halcyonidae|Cerylidae)$/;
const AERIAL = /^(Hirundinidae|Apodidae|Hemiprocnidae|Caprimulgidae|Meropidae)$/;
const CROC = /^(Crocodylidae|Alligatoridae|Gavialidae)$/;
const SPIDER_JUMP = /^Salticidae$/;
const DRAGONFLY = /^(Aeshnidae|Libellulidae|Gomphidae|Corduliidae|Coenagrionidae|Calopterygidae|Lestidae|Petaluridae|Cordulegastridae|Macromiidae)$/;
const PIT = /^(Viperidae|Pythonidae|Boidae)$/;
const CORVID = /^(Corvidae)$/;
const PARROT = /^(Psittacidae|Cacatuidae|Psittaculidae|Strigopidae|Nestoridae)$/;
const GREAT_APE = /^Hominidae$/;
const CETACEAN = /^(Delphinidae|Monodontidae|Phocoenidae|Iniidae|Platanistidae|Pontoporiidae|Physeteridae|Kogiidae|Ziphiidae|Balaenopteridae|Balaenidae|Eschrichtiidae|Neobalaenidae)$/;
const OCTOPUS = /^(Octopodidae|Enteroctopodidae|Amphitretidae|Argonautidae|Tremoctopodidae)$/;

const HUNTER_DIETS = new Set(["meat", "fish", "carrion", "blood"]);
const SMALL_PREY_DIETS = new Set(["insects"]);

export type Band = "instinct" | "practical" | "sharp" | "brilliant";
/** The chat's cuts (animal-persona.ts FALLBACK_CUTS 15/42/60), so an animal's mind is one band in the chat and the Ark. */
function bandOf(stat: number): Band {
    return stat < 15 ? "instinct" : stat < 42 ? "practical" : stat < 60 ? "sharp" : "brilliant";
}

type Perception = {sight: number; hearing: number; smell: number; night: number; sense: "sight" | "hearing" | "smell" | "touch"; src: Record<string, Source>};

const PLAN_SENSES: Record<string, [number, number, number, number]> = {
    // sight, hearing, smell (scene metres), touch-only reach
    quadruped: [28, 30, 26, 0],
    primate: [34, 26, 12, 0],
    flying_bird: [40, 24, 3, 0],
    walking_bird: [36, 22, 3, 0],
    flightless_bird: [44, 22, 4, 0],
    bat: [8, 40, 10, 0],
    lizard: [16, 8, 8, 0],
    legless: [8, 6, 14, 0],
    turtle: [14, 6, 10, 0],
    amphibian: [10, 10, 4, 0],
    fish: [12, 10, 10, 0],
    cephalopod_jelly: [16, 4, 6, 0],
    crustacean: [6, 3, 8, 0],
    insect: [4, 3, 6, 0],
    flying_insect: [10, 3, 8, 0],
    arachnid: [3, 4, 2, 0],
    other: [0, 0, 2, 1]
};

function perceptionOf(row: Row, b: Behaviour, defaults: string[]): Perception {
    const fam = row.family_name ?? "";
    const plan = b.plan;
    const [s0, h0, m0, t0] = PLAN_SENSES[plan] ?? PLAN_SENSES.other;
    const size = b.size ?? 20;
    // Bigger animals carry their eyes higher and see over more: a gentle size curve (a mouse 0.75×, an elephant 1.3×).
    const scale = 0.7 + Math.min(Math.max(size, 0), 100) / 160;
    let sight = s0 * scale;
    let hearing = h0 * scale;
    let smell = m0 * scale;
    const out: Record<string, Source> = {base: {rule: `plan ${plan}, size ${size}`}};
    if (RAPTOR_FAMILIES.test(fam)) {
        sight *= 2;
        out.sight = {rule: `${fam}: raptor eyesight`};
    }
    if (OWL_FAMILIES.test(fam)) {
        hearing *= 2;
        out.hearing = {rule: `${fam}: an owl's hearing`};
    }
    if (PIT.test(fam)) out.heat = {rule: `${fam}: heat-sensing pits or labial scales`};
    if (SPIDER_JUMP.test(fam)) {
        sight = 8;
        out.sight = {rule: "Salticidae: jumping spiders' eyes"};
    }
    if (DRAGONFLY.test(fam)) {
        sight = 22;
        out.sight = {rule: `${fam}: a dragonfly's eyes`};
    }
    // Burrowers live by hearing and touch, not eyes.
    // (Not a day-active surface forager that sleeps in a burrow: a meerkat or a prairie dog keeps watch by eye.)
    if (b.roost === "burrow" && b.move !== "fly" && (b.moves.includes("burrow") || b.move === "burrow") && (b.move === "burrow" || b.activity !== "diurnal")) {
        sight *= 0.5;
        hearing *= 1.3;
        out.burrow = {rule: "lives in a burrow: hearing over sight"};
    }
    const keenSight = find(row, OWN.concat(["predators"]), /\b(keen|sharp|excellent|acute|exceptional|superb|good|large|big|huge) (eyesight|vision|eyes)\b|\b(sees?|spots?) (prey|predators|danger|movement) (from )?(far|a long way|at great distances?)\b/i);
    // Not the young's text: pups born blind say nothing of the adult's eyes.
    const poorSight = find(row, ["diet", "facts", "traits", "sleep", "look", "spotlight", "story"], /\b(poor|weak|limited) (eyesight|vision)|\b(nearly|almost|virtually|functionally|completely|effectively) blind\b|\btiny eyes\b|\beyes are (tiny|small|reduced|vestigial)\b|\b(is|are) blind\b/i, false);
    if (keenSight) {
        sight *= 1.4;
        out.sight = src(keenSight);
    }
    if (poorSight && !keenSight) {
        sight *= 0.35;
        out.sight = src(poorSight);
    }
    const keenHearing = find(row, OWN.concat(["predators"]), /\b(keen|sharp|excellent|acute|exceptional|superb|good|sensitive) hearing\b|\b(large|big|huge|enormous) ears\b|\becholocat\w+/i);
    if (keenHearing) {
        hearing *= 1.5;
        out.hearing = src(keenHearing);
    }
    const keenSmell = find(row, OWN.concat(["predators"]), /\b(keen|sharp|excellent|acute|exceptional|superb|good|powerful|strong|sensitive) (sense of )?smell\b|\b(by|through|using) (scent|smell)\b|\bsniff\w*|\bforked tongue\b/i);
    if (keenSmell) {
        smell *= 1.6;
        out.smell = src(keenSmell);
    }
    const touch = find(row, OWN, /\b(lateral line|vibrations?|whiskers|barbels?|feel(s|ing)? for|by touch|electroreceptor\w*|electric fields?|ampullae)\b/i);
    if (touch) out.touch = src(touch);
    // Night: from the activity (the behaviour lane's), and large eyes or an owl's or a pit's sense in the dark.
    const night0 = b.activity === "nocturnal" ? 0.85 : b.activity === "crepuscular" ? 0.65 : b.activity === "any" ? 0.55 : 0.25;
    let night = night0;
    const darkText = find(row, OWN, /\b(see(s)? (well )?in (the )?(dark|dim light|low light)|night vision|large eyes|big eyes|huge eyes|eyes (adapted|suited) (to|for) (the )?(dark|night))\b/i);
    if (darkText) {
        night = Math.min(night + 0.15, 1);
        out.night = src(darkText);
    } else out.night = {rule: `activity ${b.activity}`};
    if (OWL_FAMILIES.test(fam) || out.heat || plan === "bat") night = Math.max(night, 0.9);
    if (!keenSight && !poorSight && !keenHearing && !keenSmell && !touch && !RAPTOR_FAMILIES.test(fam) && !OWL_FAMILIES.test(fam)) defaults.push("perception");
    const ranges = {sight, hearing, smell};
    let sense: Perception["sense"] = t0 ? "touch" : (Object.entries(ranges).sort((a, b) => b[1] - a[1])[0][0] as Perception["sense"]);
    if (touch && sight < 8 && hearing < 8) sense = "touch";
    return {sight: Math.round(sight), hearing: Math.round(hearing), smell: Math.round(smell), night: Math.round(night * 9) / 9, sense, src: out};
}

type Entry<T> = {style: T; src: Source};

function huntOf(row: Row, b: Behaviour, defaults: string[]): Entry<Hunt>[] {
    const fam = row.family_name ?? "";
    const diets = new Set([b.diet, ...b.diets]);
    const eater = [...diets].some((d) => HUNTER_DIETS.has(d)) || diets.has("filter") || (diets.has("insects") && ["bat", "flying_insect", "arachnid", "amphibian", "lizard"].includes(b.plan));
    const out: Entry<Hunt>[] = [];
    const add = (style: Hunt, source: Source) => {
        if (!out.some((e) => e.style === style)) out.push({style, src: source});
    };
    for (const [pattern, style] of HUNT_RULES) {
        const hit = find(row, style === "scavenge" ? ["diet", "facts", "traits", "spotlight"] : OWN, pattern);
        if (!hit) continue;
        // "Pursuit" read in a prey's text ("chased by") is not its own.
        if (style === "pursuit" && /chased by|pursued by/i.test(hit.phrase)) continue;
        if (style === "probe_strike" && !eater) continue;
        if (style === "filter" && !(eater || diets.has("filter"))) continue;
        if (style === "scavenge" && !(eater || diets.has("carrion"))) continue;
        if (!eater && !["filter", "scavenge"].includes(style)) continue;
        add(style, src(hit));
    }
    if (b.social === "pack" && eater && [...diets].some((d) => d === "meat" || d === "fish")) add("pack", {rule: "social pack (behaviour profile) and a meat or fish eater"});
    const AQUATIC = ["fish", "cephalopod_jelly", "crustacean", "other", "turtle"];
    if (diets.has("filter") && AQUATIC.includes(b.plan)) add("filter", {rule: "diet filter (behaviour profile)"});
    // Catching insects on the wing: the families and plans that do (swifts, swallows, nightjars, bee-eaters, bats, dragonflies).
    if ((AERIAL.test(fam) || DRAGONFLY.test(fam) || (b.plan === "bat" && diets.has("insects"))) && !out.some((e) => e.style === "aerial_hawk")) add("aerial_hawk", {default: `${fam || b.plan}: catches insects in the air`});
    if (diets.has("carrion") && b.diet === "carrion") add("scavenge", {rule: "diet carrion (behaviour profile)"});
    const ORDER: Hunt[] = ["pack", "ambush", "stalk", "pursuit", "aerial_swoop", "aerial_hawk", "perch_wait", "probe_strike", "filter", "scavenge"];
    out.sort((a, b) => ORDER.indexOf(a.style) - ORDER.indexOf(b.style));
    const active = out.some((e) => e.style !== "filter" && e.style !== "scavenge");
    // A default only for an animal whose main food is caught (an insect-digger with some meat on the side forages instead).
    if (out.some((e) => e.src && "default" in e.src)) defaults.push("hunt");
    const mainlyCaught = (HUNTER_DIETS.has(b.diet) && b.diet !== "carrion") || (b.diet === "insects" && ["arachnid", "amphibian", "lizard", "legless"].includes(b.plan));
    if (active || !eater || !mainlyCaught) return out;
    // A cleaner picks parasites off its clients: it hunts nothing.
    const cleaning = reviewedHit(reviewed.cleaner, row);
    if (cleaning && (cleaning.verdict.value ?? "cleaner") === "cleaner") return out;
    // Archetype defaults (flagged): the family's or the plan's way of hunting.
    defaults.push("hunt");
    const d = (style: Hunt, why: string) => add(style, {default: why});
    if (CAT.test(fam)) {
        d("stalk", "Felidae: stalk and pounce");
        d("ambush", "Felidae: stalk and pounce");
    } else if (DOG.test(fam)) d("pursuit", "Canidae: run prey down");
    else if (OWL_FAMILIES.test(fam)) {
        d("perch_wait", `${fam}: watch from a perch`);
        d("aerial_swoop", `${fam}: drop onto prey`);
    } else if (RAPTOR_FAMILIES.test(fam)) d("aerial_swoop", `${fam}: swoop from the air`);
    else if (KINGFISHER.test(fam)) {
        d("perch_wait", `${fam}: watch from a perch`);
        d("aerial_swoop", `${fam}: dive from the perch`);
    } else if (HERON.test(fam)) d("ambush", `${fam}: wait at the water's edge`);
    else if (AERIAL.test(fam)) d("aerial_hawk", `${fam}: catch insects in the air`);
    else if (CROC.test(fam)) d("ambush", `${fam}: wait at the water`);
    else if (DRAGONFLY.test(fam)) d("aerial_hawk", `${fam}: catch insects in the air`);
    else if (b.plan === "bat") d("aerial_hawk", "plan bat: catch insects in the air");
    else if (b.plan === "legless" || b.plan === "arachnid" || b.plan === "amphibian") d("ambush", `plan ${b.plan}: wait for prey to come close`);
    else if (b.plan === "lizard") d("ambush", "plan lizard: sit and wait");
    else if (b.plan === "fish" || b.plan === "cephalopod_jelly") d(b.diet === "filter" ? "filter" : "pursuit", `plan ${b.plan}: ${b.diet === "filter" ? "filter the water" : "chase prey"}`);
    else if (b.plan === "flying_bird") d(diets.has("fish") ? "aerial_swoop" : "perch_wait", `plan flying_bird, diet ${b.diet}`);
    else if (b.plan === "walking_bird" || b.plan === "flightless_bird") d("probe_strike", `plan ${b.plan}: peck and strike`);
    else if (b.plan === "flying_insect") d("aerial_hawk", "plan flying_insect, a hunter: catch prey in the air");
    else if (b.plan === "insect") d("ambush", "plan insect, a hunter: wait for prey");
    else if (b.plan === "crustacean" || b.plan === "other") d("scavenge", `plan ${b.plan}: pick over the bottom`);
    else d(b.size && b.size > 35 ? "pursuit" : "stalk", `plan ${b.plan}, size ${b.size}`);
    return out;
}

function forageOf(row: Row, b: Behaviour, defaults: string[], hunt: Entry<Hunt>[] = []): Entry<Forage>[] {
    const out: Entry<Forage>[] = [];
    const diets = new Set([b.diet, ...b.diets]);
    const add = (style: Forage, source: Source) => {
        if (!out.some((e) => e.style === style)) out.push({style, src: source});
    };
    for (const [pattern, style] of FORAGE_RULES) {
        // Food words only in the diet text (a fruit tree in its habitat is not what it eats).
        const fields: Field[] = ["fruit", "seed_pick"].includes(style) ? ["diet"] : style === "cache" ? OWN : OWN;
        const hit = find(row, fields, pattern);
        if (!hit) continue;
        if (style === "cache") continue;
        if (style === "fruit" && !(diets.has("fruit") || diets.has("omnivore"))) continue;
        if (style === "seed_pick" && !diets.has("seeds")) continue;
        if (style === "flower" && !diets.has("nectar")) continue;
        if (style === "fish" && !diets.has("fish")) continue;
        add(style, src(hit));
    }
    const cached = reviewedHit(reviewed.cache, row);
    if (cached) add("cache", cached.source);
    // From the behaviour lane's diet and places (stored, not text): the rule names the field.
    if (diets.has("grazer")) add("graze", {rule: "diet grazer (behaviour profile)"});
    if (diets.has("browser")) add("browse", {rule: "diet browser (behaviour profile)"});
    if (diets.has("nectar")) add("flower", {rule: "diet nectar (behaviour profile)"});
    if (diets.has("fish")) add("fish", {rule: "diet fish (behaviour profile)"});
    if (b.interactions.includes("tide_pool")) add("tide_pool", {rule: "uses tide pools (behaviour profile interaction)"});
    if (b.interactions.includes("dig_soil")) add("dig", {rule: "digs soil (behaviour profile interaction)"});
    if (diets.has("filter") && ["fish", "cephalopod_jelly", "crustacean", "other", "turtle"].includes(b.plan)) add("filter", {rule: "diet filter (behaviour profile)"});
    if (out.length) return out;
    defaults.push("forage");
    const d = (style: Forage, why: string) => add(style, {default: why});
    if (diets.has("insects") && hunt.some((h) => h.style === "aerial_hawk")) {
        // Bats, swifts and dragonflies take their insects in the air (their hunt says so): nothing to glean.
    } else if (diets.has("insects")) {
        // Fish at the surface: no default.
        if (["flying_bird", "primate", "lizard", "insect", "arachnid", "amphibian"].includes(b.plan)) d("glean", `diet insects, plan ${b.plan}`);
        else if (["quadruped", "walking_bird", "flightless_bird"].includes(b.plan)) d("dig", `diet insects, plan ${b.plan}`);
    }
    else if (diets.has("seeds")) d("seed_pick", "diet seeds");
    else if (diets.has("fruit")) d("fruit", "diet fruit");
    else if (diets.has("algae") || diets.has("detritus")) d("scrape", `diet ${b.diet}`);
    else if (diets.has("omnivore")) d(b.plan === "quadruped" ? "dig" : "glean", `diet omnivore, plan ${b.plan}`);
    return out;
}

function defenceOf(row: Row, b: Behaviour, defaults: string[], hunt: Entry<Hunt>[] = []): Entry<Defence>[] {
    const out: Entry<Defence>[] = [];
    const add = (style: Defence, source: Source) => {
        if (!out.some((e) => e.style === style)) out.push({style, src: source});
    };
    for (const [pattern, style] of DEFENCE_RULES) {
        const hit = find(row, DEFENCE_TEXT, pattern, style !== "freeze");
        if (!hit) continue;
        if (style === "play_dead") continue;
        // Keeping still as a defence, not ice ("survives its body water freezing") nor a hunter's camouflage ("camouflage-based ambush").
        if (style === "freeze" && /freez/.test(hit.match) && /\b(temperatures?|winters?|cold|ice|frost|body water|surviv\w*|toleran\w*)\b/i.test(hit.phrase)) continue;
        if (style === "freeze" && (/ambush/i.test(hit.phrase) || (hit.field !== "predators" && /\b(prey|strikes?|feeds? when)\b/i.test(hit.phrase) && !/bird of prey|birds of prey/i.test(hit.phrase)))) continue;
        // A chemical weapon counts as defence only where the text is about its predators or its defence.
        if (style === "chemical" && hit.field !== "predators" && !/defen|predator|threat|attack|enem/i.test(hit.phrase)) continue;
        add(style, src(hit));
    }
    const dead = reviewedHit(reviewed.play_dead, row);
    if (dead) add("play_dead", dead.source);
    const fly = b.move === "fly" || b.moves.includes("fly");
    const grouped = ["herd", "flock", "school", "troop", "colony", "group", "swarm"].includes(b.social);
    if (grouped) add("group", {rule: `social ${b.social} (behaviour profile)`});
    const hasFlee = out.some((e) => e.style.startsWith("flee") || e.style === "fly_off" || e.style === "burrow");
    if (!hasFlee) {
        // Where it runs to: from its body plan and its places (stored, not text), flagged as a default.
        defaults.push("flee");
        const d = (style: Defence, why: string) => add(style, {default: why});
        // A large animal that hunts (its hunt has a way of catching, not only scavenging or filtering) stands its ground;
        // a carrion-first eater counts too when it also hunts (a Komodo dragon), a vulture does not.
        const catches = hunt.some((h) => h.style !== "filter" && h.style !== "scavenge");
        const apex = HUNTER_DIETS.has(b.diet) && catches && (b.size ?? 0) >= 50 && !fly;
        // (Only the "other" plan: the behaviour profile also calls the barnacle goose sessile, from its name.)
        if (b.move === "sessile" && b.plan === "other") d("armour", "sessile: closes up where it is");
        else if (apex) d("threat", `a large hunter (size ${b.size}): stands its ground`);
        else if (fly && b.plan !== "flying_insect") d("fly_off", `plan ${b.plan}: takes to the air`);
        else if (b.plan === "primate" || (b.moves.includes("climb") && b.plan === "quadruped")) d("flee_tree", `plan ${b.plan}, climbs`);
        else if (["tree", "tree_hole"].includes(b.roost) && ["quadruped", "lizard", "legless", "amphibian", "insect", "arachnid"].includes(b.plan)) d("flee_tree", `roost ${b.roost}: up its tree`);
        else if (b.plan === "flightless_bird" && (b.move === "swim" || b.moves.includes("swim"))) d("flee_water", "plan flightless_bird, swims");
        else if ((b.plan === "fish" || b.plan === "cephalopod_jelly") && b.zone === "open_ocean") d("flee_open", "open ocean: swims off");
        else if (b.plan === "amphibian" || (b.plan === "turtle" && (b.moves.includes("swim") || b.move === "swim")) || b.interactions.includes("water_surface")) d("flee_water", `plan ${b.plan}, swims`);
        else if (b.roost === "burrow" || b.roost === "den" || b.roost === "crevice") d("flee_cover", `roost ${b.roost}: back to it`);
        else if (b.plan === "fish" || b.plan === "crustacean") d("flee_cover", `plan ${b.plan}: into cover`);
        else if (b.plan === "turtle") d("armour", "plan turtle: into its shell");
        else if (b.plan === "quadruped" && (b.size ?? 0) >= 35 && grouped) d("flee_open", "a large herd animal: runs in the open");
        else if (fly) d("fly_off", `plan ${b.plan}: takes to the air`);
        else d("flee_cover", `plan ${b.plan}: into cover`);
    }
    return out;
}

/** A hand-checked field (`ark-intelligence-reviewed.json`): kept ones carry their stored field and verbatim phrase, checked against the text here. */
function reviewedHit(table: Record<string, Verdict>, row: Row): {source: Source; verdict: Verdict} | null {
    const verdict = table[row.slug!];
    if (!verdict?.keep) return null;
    if (!verdict.field || !verdict.phrase) throw new Error(`${row.slug}: a kept review needs its field and phrase`);
    if (!FIELDS[verdict.field](row).includes(verdict.phrase)) throw new Error(`${row.slug}: the reviewed phrase is no longer in ${verdict.field}: ${verdict.phrase}`);
    return {source: {field: verdict.field, phrase: verdict.phrase}, verdict};
}

const ALARM = /\b(alarm (calls?|barks?|whistles?|signals?|notes?|cries?)|warning (calls?|barks?|whistles?|cries?)|barks? (a )?(warning|alarm)|whistles? (a )?(warning|alarm)|alerts? (the )?(group|others|herd|colony|troop|flock))\b/i;
/** Problem solving only where the text says so (experiments, puzzles, opening things). */
const SOLVER = /\b(problem[- ]solv\w*|solv(e|es|ed|ing) (problems|puzzles)|puzzles?|open(s|ing)? (containers|jars|latches|lids)|figures? out)\b/i;
const PLAY = /\b(play(s|ful)?(?! dead)|playing(?! dead)|frolic\w*|slid(e|es|ing) (down|on)|tumbl\w*)\b/i;
const LEADER = /\b(led by|leads? the (herd|group|troop|pack|flock|pod|family)|matriarch\w*|dominant (male|female|pair|bull|stag)|alpha|harem|herd (bull|stallion)|lead (mare|female))\b/i;
const CURIOUS = /\b(curious|inquisitive|investigat\w+|explor(es|ing) (new|novel|objects)|approach(es)? (divers|people|boats|humans|observers)|unafraid of (people|humans)|confiding|tame)\b/i;
const SHY = /\b(shy|wary|timid|skittish|nervous|secretive|elusive|easily (disturbed|startled)|flees? at the slightest|retiring)\b/i;
const LEARN = /\b(learn\w*|memor\w+|remembers?|problem[- ]solv\w*|intelligen\w+|clever|puzzles?|recogni[sz]es? (faces|individuals|people))\b/i;

function profile(row: Row) {
    const slug = row.slug!;
    const b = behaviours.get(slug);
    if (!b) return null;
    const defaults: string[] = [];
    const stat = row.stats?.intelligence ?? 32;
    const band = bandOf(stat);
    const perception = perceptionOf(row, b, defaults);
    const hunt = huntOf(row, b, defaults);
    const forage = forageOf(row, b, defaults, hunt);
    const defence = defenceOf(row, b, defaults, hunt);
    const toolHit = reviewedHit(reviewed.tools, row);
    const tools = toolHit ? [{what: toolHit.verdict.value ?? "tool use", src: toolHit.source}] : [];
    const sentinelHit = reviewedHit(reviewed.sentinel, row);
    const alarm = find(row, OWN.concat(["predators", "sociality"]), ALARM);
    const mixedHit = reviewedHit(reviewed.mixed, row);
    const cleanerHit = reviewedHit(reviewed.cleaner, row);
    const solver = find(row, ["facts", "traits", "spotlight", "diet", "offspring"], SOLVER);
    // Not the observer's advice ("look": "Explore the forest...") nor the young's own learning (offspring) for the adult's mind.
    const MIND: Field[] = ["diet", "facts", "traits", "sleep", "spotlight", "story"];
    const play = find(row, MIND.concat(["offspring"]), PLAY);
    const leader = find(row, OWN.concat(["sociality", "offspring"]), LEADER);
    const curious = find(row, MIND, CURIOUS);
    const shy = find(row, OWN.concat(["predators"]), SHY);
    const learn = find(row, MIND, LEARN);
    const grouped = ["herd", "flock", "school", "troop", "colony", "group", "pack", "swarm"].includes(b.social);
    const bigHunter = hunt.some((h) => !["filter", "scavenge"].includes(h.style)) && (b.size ?? 0) >= 45;
    const social = {
        sentinel: sentinelHit ? sentinelHit.source : null,
        alarm: alarm ? src(alarm) : grouped && !bigHunter && ["quadruped", "primate", "flying_bird", "walking_bird"].includes(b.plan) ? ({default: `social ${b.social}, plan ${b.plan}: warns its group`} as Source) : null,
        leader: leader ? src(leader) : ["herd", "troop", "pack", "flock", "school"].includes(b.social) ? ({rule: `social ${b.social}: the scene's leader and followers`} as Source) : null,
        manyEyes: grouped,
        mixed: mixedHit ? {with: mixedHit.verdict.value ?? null, src: mixedHit.source} : null,
        cleaner: cleanerHit ? {role: cleanerHit.verdict.value ?? "cleaner", src: cleanerHit.source} : null
    };
    if (alarm === null && social.alarm && "default" in social.alarm) defaults.push("alarm");
    // How rich its behaviour is: the stat's band (the same cuts as the chat), lifted a little by stored text of learning or play.
    const repertoire = {instinct: 3, practical: 5, sharp: 7, brilliant: 9}[band];
    const curiosity = Math.min(1, Math.max(0, stat / 80 + (curious ? 0.2 : 0) - (shy ? 0.15 : 0)));
    const playful = Math.min(1, Math.max(0, (["quadruped", "primate", "flying_bird", "bat"].includes(b.plan) ? stat / 90 : stat / 200) + (play ? 0.25 : 0)));
    const learning = Math.min(1, Math.max(0.1, stat / 75 + (learn ? 0.15 : 0)));
    // Flight distance (scene metres): the plan and size, then wary or bold text.
    const size = b.size ?? 20;
    const base = b.plan === "quadruped" ? 3 + size * 0.12 : ["flying_bird", "walking_bird", "flightless_bird"].includes(b.plan) ? 2.5 + size * 0.1 : b.plan === "primate" ? 3 + size * 0.08 : ["insect", "arachnid", "flying_insect", "crustacean", "other"].includes(b.plan) ? 0.4 + size * 0.03 : 1.5 + size * 0.06;
    const hunter = hunt.length > 0 && !hunt.every((h) => h.style === "filter" || h.style === "scavenge");
    const flight = Math.round(base * (shy ? 1.4 : 1) * (curious ? 0.7 : 1) * (hunter && size > 40 ? 0.5 : 1) * 10) / 10;
    return {
        slug,
        id: row.id,
        name: row.name,
        excluded: row.excluded_reason,
        plan: b.plan,
        intelligence: {stat, band, repertoire, solver: Boolean(solver), curiosity: round(curiosity), play: round(playful), learning: round(learning), src: {stat: {rule: "species_profiles.canonical_game_stats.intelligence"}, ...(learn ? {learning: src(learn)} : {}), ...(solver ? {solver: src(solver)} : {}), ...(curious ? {curious: src(curious)} : {}), ...(play ? {play: src(play)} : {})}},
        perception,
        hunt,
        forage,
        defence,
        tools,
        social,
        flight: {distance: flight, src: shy ? src(shy) : curious ? src(curious) : ({rule: `plan ${b.plan}, size ${size}`} as Source)},
        food: {eats: [...(eatsGroups.get(slug) ?? [])].map((g) => groupLabels[g]), prey: [...(eatsSpecies.get(slug) ?? [])], in: [...(inGroups.get(slug) ?? [])].map((g) => groupLabels[g])},
        defaults: [...new Set(defaults)]
    };
}
function round(v: number) {
    return Math.round(v * 100) / 100;
}

// MARK: Run

const profiles = rows.map(profile).filter((p): p is NonNullable<ReturnType<typeof profile>> => Boolean(p)).sort((a, b) => a.slug.localeCompare(b.slug));
const outFull = path.join(root, "data/ark/intelligence-profiles.json");
const head = {
    about: "Generated by scripts/ark-intelligence-profiles.mts from the live catalogue (read-only export), the behaviour lane's profiles (data/ark/behaviour-profiles.json), the traits lane's food links and the hand-checked rare fields (scripts/ark-intelligence-reviewed.json). Keyword rules written by Claude Code, no AI calls at build time. src per field: {field, phrase} = the stored field and the verbatim phrase that decided it; {rule} = a stored field or the taxonomy; {default} = data missing, the body plan's archetype default (listed in defaults). Distances are scene metres. Visual only.",
    generated: new Date().toISOString().slice(0, 10),
    count: profiles.length,
    hunt: HUNT,
    forage: FORAGE,
    defence: DEFENCE,
    groups: groupLabels
};
fs.writeFileSync(outFull, `${JSON.stringify(head).slice(0, -1)},"profiles":[\n${profiles.map((p) => JSON.stringify(p)).join(",\n")}\n]}\n`);

// Compact rows: band+stat|sight,hearing,smell,night0-9,sense|hunt|forage|defence|flags|flight|eats|in|prey slugs.
const code = (list: readonly string[], values: string[]) => values.map((v) => list.indexOf(v).toString(36)).join("");
const g2 = (labels: string[]) => labels.map((l) => groupIndex.get(l)!.toString(36).padStart(2, "0")).join("");
const compact: Record<string, string> = {};
for (const p of profiles) {
    if (p.excluded) continue;
    const flags = [
        p.tools.length ? "t" : "",
        p.intelligence.solver ? "p" : "",
        p.social.sentinel ? "s" : "",
        p.social.alarm ? "a" : "",
        p.social.leader ? "l" : "",
        p.social.manyEyes ? "m" : "",
        p.social.mixed ? "x" : "",
        p.social.cleaner ? "c" : "",
        p.perception.src.heat ? "h" : "",
        p.defaults.length ? "d" : ""
    ].join("");
    const senses = `${p.perception.sight},${p.perception.hearing},${p.perception.smell},${Math.round(p.perception.night * 9)},${p.perception.sense[0]}`;
    const mind = `${p.intelligence.stat},${Math.round(p.intelligence.curiosity * 9)},${Math.round(p.intelligence.play * 9)},${Math.round(p.intelligence.learning * 9)}`;
    compact[p.slug] = [mind, senses, code(HUNT, p.hunt.map((h) => h.style)), code(FORAGE, p.forage.map((f) => f.style)), code(DEFENCE, p.defence.map((d) => d.style)), flags, p.flight.distance, g2(p.food.eats), g2(p.food.in), p.food.prey.join(","), p.plan].join("|");
}
fs.writeFileSync(
    path.join(root, "src/ark-scene/intelligence.json"),
    `{"about":"Generated by scripts/ark-intelligence-profiles.mts (full profiles with source phrases: data/ark/intelligence-profiles.json). Rows: intelligence stat,curiosity 0-9,play 0-9,learning 0-9|sight,hearing,smell (scene m),night 0-9,main sense (s h m t)|hunt (index base 36)|forage|defence|flags (t tools, p problem solving, s sentinel, a alarm calls, l leader, m many eyes, x mixed-species, c cleaner, h heat sense, d a default)|flight distance (m)|food groups it eats (2 base-36 chars each)|food groups it is in|species it eats by name|body plan. Decoded by intelligence-profile.ts.",\n"hunt":${JSON.stringify(HUNT)},"forage":${JSON.stringify(FORAGE)},"defence":${JSON.stringify(DEFENCE)},"groups":${JSON.stringify(groupLabels)},\n"species":{\n${Object.entries(compact)
        .map(([slug, row]) => `${JSON.stringify(slug)}:${JSON.stringify(row)}`)
        .join(",\n")}\n}}\n`
);

// Summary.
const live = profiles.filter((p) => !p.excluded);
const tally = (get: (p: (typeof live)[number]) => string[]) => live.reduce<Record<string, number>>((acc, p) => {
    for (const k of get(p)) acc[k] = (acc[k] ?? 0) + 1;
    return acc;
}, {});
console.log(`profiles ${profiles.length} (on the Ark: ${live.length})`);
console.log("band", tally((p) => [p.intelligence.band]));
console.log("hunt", tally((p) => p.hunt.map((h) => h.style)));
console.log("forage", tally((p) => p.forage.map((f) => f.style)));
console.log("defence", tally((p) => p.defence.map((d) => d.style)));
console.log("sense", tally((p) => [p.perception.sense]));
console.log("social", tally((p) => [p.social.sentinel ? "sentinel" : "", p.social.alarm ? ("default" in p.social.alarm ? "alarm(default)" : "alarm(text)") : "", p.social.mixed ? "mixed" : "", p.social.cleaner ? "cleaner" : "", p.tools.length ? "tools" : ""].filter(Boolean)));
console.log("defaults", tally((p) => p.defaults), "with any default", live.filter((p) => p.defaults.length).length);
console.log("no food link as prey", live.filter((p) => !p.food.in.length).length, "as predator", live.filter((p) => p.food.eats.length || p.food.prey.length).length);
