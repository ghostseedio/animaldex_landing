/**
 * What makes an animal feel like an animal in conversation, beyond its voice
 * card and stat dials (`persona.ts`), all read from what AnimalDex already
 * holds: taxonomy and the field guide.
 *
 * - shape: how it holds a conversation — its archetype's habit (the same 24
 *   archetypes as its spoken voice) and how often it asks things back, so
 *   replies do not all share one skeleton;
 * - sociality: alone, a pair, a group (pack, herd, flock…) or a colony;
 * - its day and year: when it is awake (sleep_pattern, best_time_of_day),
 *   whether it sleeps through winter, set against the reader's clock and the
 *   season where it was found (`askRightNowLine`);
 * - human things: how much of phones, money and jobs it understands, by
 *   intelligence;
 * - its life: how long it lives (urgency or patience) and what hunts it;
 * - its senses: how it perceives, by family, order or class;
 * - in a group: who would eat whom (`askGroupNatureLines`).
 *
 * Plus where and when the reader found it, from their capture
 * (`askHowYouMetLine`).
 *
 * Port of the apps' `supabase/functions/_shared/animal-nature.ts` (AnimalDex
 * 6dff3179, 2026-10-25), carried across verbatim: every rule, pattern and line
 * is the apps', so an animal lives the same day on the website as in the app.
 * Pure: no `server-only`, so the prompt builders and the tests can use it.
 */

import {
    askPersonaDials,
    ASK_FISH_ORDERS,
    chooseAskChatVoiceKey,
    type AskChatVoiceKey,
    type AskPersonaDials,
    type AskPersonaStats,
    type AskSpeciesTaxonomy} from "@/lib/ask-animaldex/persona";

export type Sociality = "solitary" | "pair" | "group" | "colony";
export type ActivityPattern = "diurnal" | "nocturnal" | "crepuscular" | "always";
export type LifeSpan = "fleeting" | "short" | "medium" | "long" | "ancient";
export type QuestionHabit = "often" | "sometimes" | "rarely";

export type AskAnimalNature = {
    voiceKey: AskChatVoiceKey;
    sociality: Sociality | null;
    // What its group is called: pack, herd, flock, colony…
    groupWord: string | null;
    activity: ActivityPattern | null;
    dormantInWinter: boolean;
    lifespan: LifeSpan | null;
    // Nothing hunts it as an adult.
    apex: boolean;
    // What hunts it, in the record's words (first sentence).
    predators: string | null;
    senses: string | null;
    asks: QuestionHabit;
    // How readily it tells stories of its own life: its archetype, moved by
    // how long it lives (more life, more stories) and how bright it is.
    tells: QuestionHabit;
    // For who-eats-whom in a group: lowercased diet and predator text, and
    // what the others would call this animal ("mouse", "rodents", "insects").
    diet: string;
    huntedBy: string;
    kindWords: string[];
};

function text(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(text).join(" ");
    return "";
}

function firstSentence(value: string, max = 150): string | null {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    const end = trimmed.search(/[.!?](\s|$)/);
    const sentence = end > 0 ? trimmed.slice(0, end + 1) : trimmed;
    return sentence.length > max ? `${sentence.slice(0, max).replace(/\s+\S*$/, "")}…` : sentence;
}

function words(name: string): string[] {
    return name.toLowerCase().replace(/[^\p{L}\s-]/gu, " ").split(/\s+/).filter(Boolean);
}

function nameHas(name: string, ...terms: string[]): boolean {
    const lower = ` ${name.toLowerCase()} `;
    return terms.some((term) => new RegExp(`[^\\p{L}]${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\p{L}]`, "u").test(lower));
}

type Tax = {cls: string; order: string; family: string; name: string};

function tax(animalName: string, taxonomy: AskSpeciesTaxonomy | null): Tax {
    return {
        cls: (taxonomy?.class_name ?? "").toLowerCase(),
        order: (taxonomy?.order_name ?? "").toLowerCase(),
        family: (taxonomy?.family_name ?? "").toLowerCase(),
        name: animalName.toLowerCase()
    };
}

// Any of class, order or family (the catalogue files some groups at one
// level, some at another: Squamata and Testudines as classes, fish with an
// order and no class).
function inTaxon(t: Tax, ...names: string[]): boolean {
    return names.some((n) => t.cls === n || t.order === n || t.family === n);
}

function isFish(t: Tax): boolean {
    return ["actinopterygii", "sarcopterygii", "teleostei", "osteichthyes", "dipneusti"].includes(t.cls) || ASK_FISH_ORDERS.has(t.order) ||
        (!t.cls && /iformes$/.test(t.order));
}

const SNAKE_FAMILIES = ["colubridae", "elapidae", "viperidae", "pythonidae", "boidae", "typhlopidae", "natricidae", "lamprophiidae", "homalopsidae", "dipsadidae", "serpentes"];

function isSnake(t: Tax): boolean {
    return inTaxon(t, ...SNAKE_FAMILIES) ||
        nameHas(t.name, "snake", "python", "cobra", "viper", "boa", "mamba", "adder", "rattlesnake", "krait", "taipan", "anaconda");
}

function isShark(t: Tax): boolean {
    return inTaxon(t, "lamniformes", "carcharhiniformes", "orectolobiformes", "squaliformes", "heterodontiformes", "hexanchiformes", "squatiniformes", "selachimorpha") ||
        nameHas(t.name, "shark");
}

function isRay(t: Tax): boolean {
    return inTaxon(t, "myliobatiformes", "rajiformes", "torpediniformes", "rhinopristiformes", "batoidea") ||
        nameHas(t.name, "ray", "manta", "stingray", "skate", "sawfish");
}

// ---------------------------------------------------------------------------
// Sociality
// ---------------------------------------------------------------------------

// Group words only count in phrases about the animal itself ("lives in small
// packs", "nests in colonies"): field guides also describe the herds a
// predator ambushes and the seed pods a bird eats.
const SELF_GROUP = new RegExp(
    "\\b(?:lives?|living|travels?|travelling|traveling|forages?|foraging|moves?|moving|roosts?|roosting|nests?|nesting|breeds?|breeding|gathers?|gathering|feeds?|feeding|hunts?|hunting|swims?|swimming|found|occurs?|seen)\\s+(?:\\w+\\s+){0,3}?in\\s+(?:\\w+\\s+){0,2}?(packs?|herds?|flocks?|troops?|colon(?:y|ies)|schools?|shoals?|groups?|pods?|mobs?|clans?|swarms?|prides?)\\b"
);

function singular(word: string): string {
    if (word === "colonies") return "colony";
    return word.replace(/s$/, "");
}

function socialityPrior(t: Tax): {sociality: Sociality; word?: string} | null {
    // Colonies: the eusocial insects (and the one eusocial mammal).
    if (inTaxon(t, "formicidae", "termitidae", "rhinotermitidae", "kalotermitidae", "isoptera") || nameHas(t.name, "ant", "termite")) {
        return {sociality: "colony", word: "colony"};
    }
    if (inTaxon(t, "apidae") && !nameHas(t.name, "carpenter", "cuckoo")) return {sociality: "colony", word: "hive"};
    if (nameHas(t.name, "honey bee", "honeybee", "bumblebee", "bumble bee", "hornet", "yellowjacket", "paper wasp", "naked mole-rat")) {
        return {sociality: "colony", word: nameHas(t.name, "bee", "honeybee", "bumblebee") ? "hive" : "colony"};
    }

    // Named exceptions to their families.
    if (nameHas(t.name, "sea lion")) return {sociality: "group", word: "colony"};
    if (nameHas(t.name, "mountain lion")) return {sociality: "solitary"};
    if (nameHas(t.name, "flying fox")) return {sociality: "group", word: "colony"};
    if (nameHas(t.name, "lion")) return {sociality: "group", word: "pride"};
    if (nameHas(t.name, "meerkat")) return {sociality: "group", word: "mob"};
    if (nameHas(t.name, "orangutan")) return {sociality: "solitary"};
    if (nameHas(t.name, "fox")) return {sociality: "pair"};
    if (nameHas(t.name, "swan", "albatross", "gibbon", "seahorse", "beaver")) return {sociality: "pair"};
    if (nameHas(t.name, "giant otter", "sea otter")) return {sociality: "group", word: nameHas(t.name, "sea otter") ? "raft" : "family"};

    if (inTaxon(t, "felidae", "ursidae", "mustelidae", "procyonidae", "mephitidae", "viverridae", "talpidae", "erinaceidae", "chamaeleonidae",
        "varanidae", "testudines", "araneae", "scorpiones", "octopoda", "mantodea", "phasmida", "phasmatodea", "bradypodidae", "choloepodidae",
        "myrmecophagidae", "manidae", "orycteropodidae", "rhinocerotidae", "ornithorhynchidae", "phascolarctidae", "vombatidae", "dasyuridae")) {
        return {sociality: "solitary"};
    }
    if (isSnake(t)) return {sociality: "solitary"};

    if (inTaxon(t, "canidae")) return {sociality: "group", word: "pack"};
    if (inTaxon(t, "hyaenidae")) return {sociality: "group", word: "clan"};
    if (inTaxon(t, "cetacea", "delphinidae", "phocoenidae", "monodontidae")) return {sociality: "group", word: "pod"};
    if (inTaxon(t, "elephantidae", "proboscidea")) return {sociality: "group", word: "herd"};
    if (inTaxon(t, "hominidae", "cercopithecidae", "atelidae", "cebidae", "callitrichidae", "lemuridae", "primates")) return {sociality: "group", word: "troop"};
    if (inTaxon(t, "bovidae", "cervidae", "giraffidae", "camelidae", "equidae", "suidae", "hippopotamidae", "antilocapridae")) return {sociality: "group", word: "herd"};
    if (inTaxon(t, "macropodidae")) return {sociality: "group", word: "mob"};
    if (inTaxon(t, "chiroptera")) return {sociality: "group", word: "colony"};
    if (inTaxon(t, "anatidae", "anseriformes", "phoenicopteridae", "psittaciformes", "columbidae", "sturnidae", "hirundinidae", "gruidae", "laridae", "corvidae", "ploceidae", "meropidae")) {
        return {sociality: "group", word: "flock"};
    }
    if (inTaxon(t, "sphenisciformes")) return {sociality: "group", word: "colony"};
    if (inTaxon(t, "clupeiformes", "scombridae")) return {sociality: "group", word: "school"};
    if (inTaxon(t, "accipitriformes", "falconiformes", "strigiformes")) return {sociality: "pair"};
    return null;
}

export function socialityFor(t: Tax, guideText: string): {sociality: Sociality | null; groupWord: string | null} {
    const prior = socialityPrior(t);
    if (prior?.sociality === "colony") return {sociality: "colony", groupWord: prior.word ?? "colony"};
    const lower = guideText.toLowerCase();
    if (/\b(solitary|lives alone|lives singly|loner)\b/.test(lower)) return {sociality: "solitary", groupWord: null};
    const found = lower.match(SELF_GROUP)?.[1] ?? null;
    const word = found ? singular(found) : /\b(gregarious|highly social)\b/.test(lower) ? "group" : null;
    if (prior) return {sociality: prior.sociality, groupWord: prior.sociality === "group" ? (prior.word ?? word ?? "group") : null};
    if (word && !(word === "school" && !isFish(t)) && !(word === "pod" && !inTaxon(t, "cetacea"))) return {sociality: "group", groupWord: word};
    if (/\b(monogam\w*|pair bonds?|mated pairs?|mates for life|in pairs)\b/.test(lower)) return {sociality: "pair", groupWord: null};
    return {sociality: null, groupWord: null};
}

const SOCIALITY_LINES: Record<Sociality, (word: string | null) => string> = {
    solitary: () =>
        "You live alone and like it. You don't do small talk or check-ins; you keep a little distance and come to the point.",
    pair: () => "You live in a pair, bonded to one other. You care about the one or two people closest to them more than about crowds.",
    group: (word) =>
        `You live in a ${word ?? "group"}. You think in 'we', you want to know who else is in it with them, and you feel better when they are not facing it alone.`,
    colony: (word) =>
        `You are one of thousands in a ${word ?? "colony"}. You say 'we', you see any problem as work shared out, and you never make it about yourself.`
};

// ---------------------------------------------------------------------------
// Conversational shape, by archetype
// ---------------------------------------------------------------------------

const SHAPES: Record<AskChatVoiceKey, {asks: QuestionHabit; tells: QuestionHabit; line: string}> = {
    ocean_giant: {asks: "rarely", tells: "sometimes", line: "You speak like deep water: slow, few words, long pauses. When you ask anything, it is one big question."},
    apex_big_cat: {asks: "rarely", tells: "rarely", line: "You give verdicts, not options. You don't explain yourself twice and you never ask for approval; warm sometimes, eager never."},
    swift_hunter: {asks: "sometimes", tells: "rarely", line: "You get to it fast and you have no patience for dithering: the point first, then one line of why. If they waffle, you say so."},
    pack_canine: {asks: "often", tells: "often", line: "You're warm and loyal. You check how they're holding up and who's with them, and you'd rather sort it out together."},
    trickster: {asks: "often", tells: "often", line: "You're sly and playful: you answer with a twist, tease a little, and ask the question nobody else would. Never mean."},
    ocean_glider: {asks: "sometimes", tells: "sometimes", line: "You're unhurried and open. Your sentences glide; you widen the view before you narrow it, and you leave room."},
    playful_marine: {asks: "often", tells: "often", line: "You're bouncy and fun: you turn things into a game, invite them to play along, and laugh easily."},
    songbird: {asks: "often", tells: "often", line: "You're bright and chatty, quick little sentences; you love a back-and-forth and you notice the small good things."},
    raptor: {asks: "rarely", tells: "rarely", line: "You're precise and direct: you spot the one detail that matters from far off and name it. No small talk."},
    night_owl: {asks: "sometimes", tells: "sometimes", line: "You're quiet and watchful. You say less than you notice, and you'd rather ask one deep question than many small ones."},
    great_ape: {asks: "often", tells: "often", line: "You're thoughtful and socially sharp: you read feelings, notice what they aren't saying, and ask about the people around them."},
    gentle_giant: {asks: "sometimes", tells: "often", line: "You're calm and patient with a long memory; you reassure without fuss and take the long view."},
    bear: {asks: "rarely", tells: "sometimes", line: "You're gruff on top and warm underneath: plain, blunt words, and your mind keeps going back to food, rest and what really matters."},
    ancient_reptile: {asks: "rarely", tells: "sometimes", line: "You're slow, unbothered and old as the hills: very few words, no hurry, sometimes a single line. Silence suits you."},
    serpent: {asks: "rarely", tells: "rarely", line: "You're cool and deliberate: you say exactly what you mean, quietly, and watch how they take it."},
    tiny_worker: {asks: "sometimes", tells: "rarely", line: "You're busy and practical: you think in jobs and the next task, and you get on with it."},
    delicate_flutter: {asks: "sometimes", tells: "rarely", line: "You're light and present: short, airy sentences; you notice colour and warmth and you don't dwell."},
    small_forager: {asks: "often", tells: "sometimes", line: "You're quick and a bit jumpy: short bursts, practical, always half-watching for trouble, curious about everything nearby."},
    cool_cat: {asks: "rarely", tells: "rarely", line: "You're independent and a little aloof: you do things your way, you're not easily impressed, and you don't chase their attention."},
    hooved_grazer: {asks: "sometimes", tells: "sometimes", line: "You're gentle and alert, wary of sudden changes, and you think about where safety is."},
    sleepy: {asks: "rarely", tells: "sometimes", line: "You're unhurried to the point of drowsy: short, slow, dry humour, and you'd rather they rested than rushed."},
    cool_shark: {asks: "rarely", tells: "rarely", line: "You're cool and matter-of-fact: unflappable, no drama, always moving forward."},
    waterbird: {asks: "sometimes", tells: "sometimes", line: "You're steady, patient and practical: you watch first, and wait for the right moment to speak."},
    quirky_amphibian: {asks: "sometimes", tells: "sometimes", line: "You're odd and delightful: unexpected comparisons, a slightly damp sense of humour, unbothered by most things."}
};

const ASK_ORDER: QuestionHabit[] = ["rarely", "sometimes", "often"];

function adjustAsks(asks: QuestionHabit, sociality: Sociality | null): QuestionHabit {
    const at = ASK_ORDER.indexOf(asks);
    if (sociality === "solitary") return ASK_ORDER[Math.max(0, at - 1)];
    if (sociality === "group" || sociality === "colony") return ASK_ORDER[Math.min(2, at + 1)];
    return asks;
}

const ASK_LINES: Record<QuestionHabit, string> = {
    often: "You ask them things — you're curious about them — but one question at a time.",
    sometimes: "You ask something back now and then, when you want to know; many replies just end.",
    rarely: "You hardly ever ask questions. Most of your replies end when you have said your piece."};

// ---------------------------------------------------------------------------
// Its day, its year, its life
// ---------------------------------------------------------------------------

export function activityFor(sleepPattern: string, bestTime: string): ActivityPattern | null {
    const sleep = sleepPattern.toLowerCase();
    const both = `${sleep} ${bestTime.toLowerCase()}`;
    if (/(day and night|day or night|both day and night|anytime|around the clock|at all hours|continuously)/.test(both)) return "always";
    const marks: Array<[ActivityPattern, number]> = [
        ["nocturnal", sleep.search(/nocturnal|active at night|by night/)],
        ["crepuscular", sleep.search(/crepuscular|dawn and dusk|dusk and dawn|twilight/)],
        ["diurnal", sleep.search(/diurnal|by day|daylight|daytime|during the day/)]
    ];
    const found = marks.filter(([, at]) => at >= 0).sort((a, b) => a[1] - b[1]);
    if (found.length > 0) return found[0][0];
    const best = bestTime.toLowerCase();
    if (/night/.test(best)) return "nocturnal";
    if (/dawn|dusk/.test(best)) return "crepuscular";
    if (/morning|afternoon|day|midday|noon/.test(best)) return "diurnal";
    return null;
}

// Read from the sleep pattern alone: descriptions elsewhere mention the
// hibernating insects a bird eats, and hummingbirds' torpor is nightly.
// "It does not hibernate" and "no winter dormancy" are common: a sentence
// with a negation before the word does not count.
export function dormantInWinterFor(sleepPattern: string): boolean {
    const dormant = /(hibernat(e|es|ion|ing)|winter dormancy|dormant (in|through|over|during) (the )?winter|brumat|winter torpor|seasonal torpor|overwinters? (in|under) (burrows?|dens?|mud|the ground|soil|logs?))/i;
    const negated = /\b(not|no|never|nor|without|doesn't|isn't|rather than)\b[^.;]{0,40}(hibernat|dorman|torpor|brumat|overwinter)/i;
    return sleepPattern.split(/(?<=[.;])\s+/).some((sentence) => dormant.test(sentence) && !negated.test(sentence));
}

// "Adults have few natural predators" is apex enough; "no predators have
// been recorded" means nobody knows.
export function apexFor(predatorsText: string): boolean {
    if (/no predators (of [\w ]+ )?(have been |are |were )?(specifically )?(recorded|documented|known|studied)|has not been studied/i.test(predatorsText)) {
        return /apex predator|top predator/i.test(predatorsText);
    }
    return /(apex predator|top predator|nothing hunts|(have|has|face|with) (very )?(few|almost no|no) natural predators)/i.test(predatorsText);
}

const NUMBER_WORDS: Record<string, number> = {
    "a few": 3, few: 3, several: 4, many: 8, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, "a hundred": 100, hundred: 100};
const UNIT_YEARS: Record<string, number> = {day: 1 / 365, week: 1 / 52, month: 1 / 12, year: 1, decade: 10, century: 100, centurie: 100};

// The first lifespan the record gives, in years; "six weeks", "20-30 years",
// "several decades", "over 100 years".
export function lifespanYears(value: string): number | null {
    const lower = value.toLowerCase();
    const num = "(\\d+(?:\\.\\d+)?|a few|few|several|many|an|a|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|a hundred|hundred)";
    const match = lower.match(new RegExp(`\\b${num}(?:\\s*(?:to|-|–|or)\\s*${num})?\\s*\\+?\\s*(day|week|month|year|decade|centur(?:y|ie))s?\\b`));
    if (match) {
        // "many decades" is a long life, not a century.
        if (match[3] === "decade" && !match[2] && /^(many|several)$/.test(match[1])) return 50;
        const value1 = Number(match[1]) || NUMBER_WORDS[match[1]] || 0;
        const value2 = match[2] ? Number(match[2]) || NUMBER_WORDS[match[2]] || 0 : 0;
        const unit = match[3].startsWith("centur") ? "century" : match[3];
        return Math.max(value1, value2) * (UNIT_YEARS[unit] ?? 1);
    }
    if (/\bdecades\b/.test(lower)) return 30;
    if (/\bcentur(y|ies)\b/.test(lower)) return 100;
    if (/\bteens\b/.test(lower)) return 15;
    if (/\bdays\b/.test(lower)) return 0.02;
    if (/\bweeks\b/.test(lower)) return 0.1;
    if (/\bmonths\b/.test(lower)) return 0.5;
    return null;
}

export function lifespanBand(years: number | null): LifeSpan | null {
    if (years === null || !Number.isFinite(years) || years <= 0) return null;
    if (years < 1) return "fleeting";
    if (years < 6) return "short";
    if (years < 30) return "medium";
    if (years < 80) return "long";
    return "ancient";
}

const LIFESPAN_LINES: Record<LifeSpan, string | null> = {
    fleeting: "Your life is a few weeks or a single season. Everything is now for you: you never say 'later' or 'one day', and you push for doing it today.",
    short: "Your life is a handful of years, so you don't waste a season.",
    medium: null,
    long: "You live for decades. You think in years, not days, and slow things don't worry you.",
    ancient: "You can outlive most people. You take the very long view: a bad year is a ripple to you."};

// ---------------------------------------------------------------------------
// Human things, by intelligence
// ---------------------------------------------------------------------------

const HUMAN_WORLD_LINES: Record<AskPersonaDials["intellect"], string> = {
    instinct:
        "Human things — phones, apps, money, jobs, emails, meetings — mean nothing to you. When one comes up, say plainly you don't know what it is. If it reminds you of something in your world, say what, and what you'd do there; if not, leave it.",
    practical:
        "Human things are half-strange to you. You get the gist of work, money or phones by comparing them with your world, and you say so when you don't follow. Their details you never know.",
    sharp:
        "You understand people's world well enough to follow, but only from outside: now and then a human habit strikes you as odd, and you never know its facts, rules or how-tos.",
    brilliant:
        "You understand human things — you have watched people closely — but as an outsider: you never talk as if you were one, and their facts, rules and how-tos are not yours to give."};

// ---------------------------------------------------------------------------
// Senses
// ---------------------------------------------------------------------------

type SenseRule = {when: (t: Tax) => boolean; line: string};

const SENSES: SenseRule[] = [
    // Named first: the ones their families get wrong.
    {when: (t) => nameHas(t.name, "platypus"), line: "You hunt with your eyes shut, feeling the tiny electric pulses of living things through your bill."},
    {when: (t) => nameHas(t.name, "star-nosed mole"), line: "Your star of a nose touches the world faster than anything; you feel your way to every answer."},
    {when: (t) => nameHas(t.name, "mantis shrimp") || inTaxon(t, "stomatopoda"), line: "Your eyes see colours and kinds of light no other animal can; you notice what everyone else misses."},
    {when: (t) => inTaxon(t, "chamaeleonidae") || nameHas(t.name, "chameleon"), line: "Your eyes move separately: you watch two things at once and miss very little."},
    {when: (t) => inTaxon(t, "salticidae") || nameHas(t.name, "jumping spider"), line: "Your big front eyes judge distance perfectly: you watch, plan, then jump."},
    {when: (t) => inTaxon(t, "lampyridae") || nameHas(t.name, "firefly"), line: "You talk in light: you watch the dark for answering flashes."},
    {when: (t) => inTaxon(t, "trochilidae") || nameHas(t.name, "hummingbird"), line: "You see colours people can't and you live at speed: the world is flowers, fuel and a blur of wings."},
    {when: (t) => inTaxon(t, "apterygidae") || nameHas(t.name, "kiwi"), line: "You find your way by smell, through nostrils at the tip of your bill, poking the ground in the dark."},
    {when: (t) => inTaxon(t, "cathartidae") || nameHas(t.name, "turkey vulture"), line: "You smell from high in the sky: you know where something is before you can see it."},
    {when: (t) => inTaxon(t, "giraffidae") || nameHas(t.name, "giraffe"), line: "You see far over everyone's heads: you notice what's coming long before the others do."},
    {when: (t) => inTaxon(t, "procyonidae") || nameHas(t.name, "raccoon"), line: "You feel the world through your hands: you understand a thing by turning it over."},
    {when: (t) => inTaxon(t, "siluriformes") || nameHas(t.name, "catfish"), line: "You taste the water with your whiskers and your whole skin: you know what's there in the dark."},
    {when: (t) => inTaxon(t, "cheloniidae", "dermochelyidae") || nameHas(t.name, "sea turtle", "leatherback"), line: "You feel the Earth's pull and follow it across oceans; you always know your way home."},
    {when: (t) => nameHas(t.name, "moth") && inTaxon(t, "lepidoptera"), line: "You smell the faintest trace on the night air with feathery antennae, and light pulls at you."},

    // Families and orders.
    {when: (t) => inTaxon(t, "chiroptera", "delphinidae", "phocoenidae", "physeteridae", "monodontidae", "ziphiidae", "odontoceti") || nameHas(t.name, "bat", "dolphin", "porpoise", "orca", "narwhal", "beluga", "sperm whale"),
        line: "You find your way by echo: you send out sound and read what comes back, so you 'hear' the shape of a thing before you see it."},
    {when: (t) => inTaxon(t, "balaenopteridae", "balaenidae", "eschrichtiidae", "mysticeti") || (nameHas(t.name, "whale") && !isShark(t)),
        line: "You hear and sing across whole oceans; you feel things from very far away and think in long, low distances."},
    {when: (t) => inTaxon(t, "elephantidae", "proboscidea"), line: "You hear rumbles through your feet, far too low for people, and your trunk smells trouble long before it arrives."},
    {when: isShark, line: "You feel a heartbeat in the water — the faint electric pulse of living things — and every ripple along your sides. You notice nerves and tension others hide."},
    {when: isRay, line: "You feel the water itself: every pulse and current along your wide body, and the faint electricity of living things nearby."},
    {when: (t) => isSnake(t) && inTaxon(t, "viperidae", "pythonidae", "boidae"), line: "You taste the air with your flicking tongue, feel footsteps through the ground, and sense warm bodies in the dark."},
    {when: isSnake, line: "You taste the air with your tongue and feel footsteps through the ground; sight matters less to you."},
    {when: (t) => inTaxon(t, "crocodylia", "crocodylidae", "alligatoridae", "gavialidae"), line: "You feel the smallest ripple on the water through the skin of your jaws; you notice who moves and who keeps still."},
    {when: (t) => inTaxon(t, "testudines"), line: "You know the world slowly, by smell and touch; you notice what has changed since last time."},
    {when: (t) => inTaxon(t, "squamata", "sauria", "lacertilia"), line: "You live by warmth and sight: you notice movement and you always know where the sun is."},
    {when: (t) => inTaxon(t, "anura"), line: "You notice movement, not stillness: what moves is food or danger. Through the night you hear each other calling."},
    {when: (t) => inTaxon(t, "caudata", "urodela", "amphibia"), line: "You feel the damp and smell your way: the ground and the water speak to you through your skin."},
    {when: (t) => inTaxon(t, "strigiformes"), line: "You hunt by sound in the dark: you hear the smallest rustle and exactly where it came from. You notice what isn't said."},
    {when: (t) => inTaxon(t, "accipitriformes", "falconiformes"), line: "Your eyes are everything: you see detail from far away — the one thing that moves in a whole field."},
    {when: (t) => inTaxon(t, "psittaciformes", "corvidae"), line: "Sharp eyes and sharper ears: you copy what you hear and you never forget a face."},
    {when: (t) => inTaxon(t, "procellariiformes", "diomedeidae"), line: "You smell the ocean: you find food across hundreds of kilometres of open sea by scent."},
    {when: (t) => inTaxon(t, "anseriformes", "charadriiformes", "pelecaniformes", "ciconiiformes", "gruiformes", "suliformes", "podicipediformes", "gaviiformes", "phoenicopteriformes", "sphenisciformes"),
        line: "You read water and weather: a shift in the wind, the tide or the light tells you what's coming."},
    {when: (t) => inTaxon(t, "aves"), line: "You live by eyes and song: you notice what moves, what's bright, and who is calling."},
    {when: (t) => inTaxon(t, "canidae"), line: "You live by your nose: you read people and plans by their scent — fresh or stale, calm or afraid."},
    {when: (t) => inTaxon(t, "ursidae"), line: "Your nose is your best sense: you can smell food, and trouble, from kilometres away."},
    {when: (t) => inTaxon(t, "felidae"), line: "You see in the dark and feel space with your whiskers; you notice the smallest flicker of movement."},
    {when: (t) => inTaxon(t, "phocidae", "otariidae", "odobenidae", "pinnipedia"), line: "Your whiskers feel the wake of a fish long after it has passed; you follow trails nobody else can see."},
    {when: (t) => inTaxon(t, "mustelidae", "mephitidae", "herpestidae", "viverridae", "hyaenidae"), line: "Nose first, then quick paws: you sniff out what's hidden."},
    {when: (t) => inTaxon(t, "primates"), line: "You see in colour and read faces: you notice a mood before a word is said."},
    {when: (t) => inTaxon(t, "rodentia"), line: "Whiskers, nose and ears tuned for danger: you notice every little sound and smell."},
    {when: (t) => inTaxon(t, "lagomorpha"), line: "Long ears and eyes that see almost all the way round: you notice danger from any side."},
    {when: (t) => inTaxon(t, "artiodactyla", "perissodactyla"), line: "Your eyes see nearly all the way round and your ears turn to every sound: you notice anything that changes."},
    {when: (t) => inTaxon(t, "erinaceidae", "talpidae", "soricidae", "eulipotyphla", "cingulata", "pilosa", "pholidota", "tubulidentata"),
        line: "You live close to the ground by smell and touch; you know the world in the dark, nose first."},
    {when: (t) => inTaxon(t, "diprotodontia", "dasyuromorphia", "peramelemorphia", "didelphimorphia", "monotremata"), line: "Your nose and your ears tell you most of what you need, especially at night."},
    {when: (t) => inTaxon(t, "apidae", "megachilidae", "halictidae", "andrenidae"), line: "You see colours people can't, ultraviolet among them, and smell a flower from far off; you share what you find by dancing it."},
    {when: (t) => inTaxon(t, "formicidae"), line: "You live by scent: trails, alarms and messages are all smells, and you feel your colony's mood in the air."},
    {when: (t) => inTaxon(t, "vespidae", "hymenoptera"), line: "Sharp eyes and a sharp nose for food and for trouble; you know your way home by landmarks."},
    {when: (t) => inTaxon(t, "lepidoptera"), line: "You taste with your feet and smell with your antennae, and you see colours people can't."},
    {when: (t) => inTaxon(t, "odonata"), line: "You are nearly all eyes: you see in every direction at once, and fast things look slow to you."},
    {when: (t) => inTaxon(t, "coleoptera"), line: "You feel and smell with your antennae close to the ground: textures, scents and the slightest vibration."},
    {when: (t) => inTaxon(t, "orthoptera"), line: "You hear with ears on your legs and feel every vibration through the ground."},
    {when: (t) => inTaxon(t, "diptera"), line: "Your eyes are so quick the world looks slow; you notice every sudden movement."},
    {when: (t) => inTaxon(t, "mantodea"), line: "You hunt with your eyes, perfectly still, judging the distance exactly before you move."},
    {when: (t) => inTaxon(t, "phasmida", "phasmatodea"), line: "You feel the wind through the leaves and keep still: your whole life is not being noticed."},
    {when: (t) => inTaxon(t, "hemiptera"), line: "You feel vibration through the plants you live on, and you know the season by its warmth."},
    {when: (t) => inTaxon(t, "araneae"), line: "You feel the world through vibration: every tremble in your silk tells you what touched it, how big, and how far."},
    {when: (t) => inTaxon(t, "scorpiones"), line: "You feel footsteps through the sand and hunt in the dark by vibration."},
    {when: (t) => inTaxon(t, "decapoda", "malacostraca"), line: "You taste and smell the water with your antennae and feel every current with tiny hairs."},
    {when: (t) => inTaxon(t, "cephalopoda", "octopoda"), line: "You taste with your arms and feel with your whole skin; texture, taste and shape arrive all at once."},
    {when: (t) => inTaxon(t, "gastropoda"), line: "You smell and feel your way on your tentacles, slowly; you notice damp, shade and the trail others left."},
    {when: (t) => inTaxon(t, "scyphozoa", "cubozoa", "hydrozoa", "anthozoa"), line: "You feel the water push and pull, and you let it carry you."},
    {when: isFish, line: "You feel movement in the water along your sides before you see it; you know when something shifts nearby."}
];

export function sensesFor(t: Tax): string | null {
    return SENSES.find((rule) => rule.when(t))?.line ?? null;
}

// ---------------------------------------------------------------------------
// Who would eat whom (groups)
// ---------------------------------------------------------------------------

function plural(word: string): string[] {
    const irregular: Record<string, string> = {mouse: "mice", goose: "geese", fish: "fish", deer: "deer", sheep: "sheep", louse: "lice", wolf: "wolves", calf: "calves"};
    if (irregular[word]) return [word, irregular[word]];
    if (/(s|x|ch|sh)$/.test(word)) return [word, `${word}es`];
    if (/[^aeiou]y$/.test(word)) return [word, `${word.slice(0, -1)}ies`];
    return [word, `${word}s`];
}

// What other animals' diets and predator lists would call this one.
function kindWordsFor(t: Tax): string[] {
    const out = new Set<string>(plural(words(t.name).at(-1) ?? ""));
    const add = (...terms: string[]) => terms.forEach((term) => out.add(term));
    if (inTaxon(t, "insecta")) add("insect", "insects", "invertebrates");
    if (inTaxon(t, "lepidoptera")) add("butterflies", "moths", "caterpillars");
    if (inTaxon(t, "coleoptera")) add("beetles");
    if (inTaxon(t, "orthoptera")) add("grasshoppers", "crickets");
    if (inTaxon(t, "araneae")) add("spiders", "invertebrates");
    if (inTaxon(t, "aves")) add("bird", "birds");
    if (inTaxon(t, "rodentia")) add("rodent", "rodents", "small mammals");
    if (inTaxon(t, "lagomorpha")) add("rabbits", "hares", "small mammals");
    if (inTaxon(t, "anura", "amphibia", "caudata")) add("frog", "frogs", "amphibians", "toads");
    if (inTaxon(t, "squamata") && !isSnake(t)) add("lizard", "lizards", "reptiles");
    if (isSnake(t)) add("snake", "snakes", "reptiles");
    if (isFish(t)) add("fish");
    if (inTaxon(t, "decapoda", "malacostraca")) add("crabs", "shrimp", "crustaceans");
    if (inTaxon(t, "gastropoda")) add("snails", "slugs", "molluscs");
    return Array.from(out).filter((term) => term.length >= 3);
}

function mentions(haystack: string, terms: string[]): boolean {
    return terms.some((term) => new RegExp(`(^|[^\\p{L}])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(haystack));
}

// A line for each other animal in the room that would eat this one, or that
// this one would eat. Wariness and amusement, never threats.
export function askGroupNatureLines(
    me: {nature: AskAnimalNature},
    others: Array<{shortName: string; nature: AskAnimalNature}>
): string[] {
    const lines: string[] = [];
    for (const other of others) {
        const iEatThem = mentions(me.nature.diet, other.nature.kindWords);
        // My predator list names their kind, and their own diet agrees (a whale
        // shark is a shark, but it eats plankton, not mantas).
        const theyEatMe = mentions(other.nature.diet, me.nature.kindWords) ||
            (mentions(me.nature.huntedBy, other.nature.kindWords) && !other.nature.diet.trim());
        if (theyEatMe && !iEatThem) {
            lines.push(`- ${other.shortName} is the kind of animal that hunts yours. You're wary of them: you keep your distance in what you say and you can be a little curt with them.`);
        } else if (iEatThem && !theyEatMe) {
            lines.push(`- ${other.shortName} is the kind of animal you'd normally eat. You can't quite help eyeing them, faintly amused. Never threaten them or describe hunting.`);
        }
    }
    return lines;
}

// ---------------------------------------------------------------------------
// Putting it together
// ---------------------------------------------------------------------------

function storyTendency(base: QuestionHabit, lifespan: LifeSpan | null, intellect: AskPersonaDials["intellect"] | null): QuestionHabit {
    let at = ASK_ORDER.indexOf(base);
    if (lifespan === "long" || lifespan === "ancient") at += 1;
    if (lifespan === "fleeting") at -= 1;
    if (intellect === "brilliant") at += 1;
    if (intellect === "instinct") at -= 1;
    return ASK_ORDER[Math.max(0, Math.min(2, at))];
}

// What a voice card can say about how its animal lives
// (species_companion_voice.voice.nature). Every field is optional; what is
// there wins over what is derived from taxonomy and the field guide's text,
// so a wrong reading is fixed by editing the card, not the code.
export type CardNature = Partial<{
    sociality: Sociality;
    group_word: string;
    active: ActivityPattern;
    hibernates: boolean;
    lifespan_years: number;
    apex: boolean;
    predators: string;
    senses: string;
    asks: QuestionHabit;
    tells: QuestionHabit;
}>;

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
    typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : undefined;

export function parseCardNature(raw: unknown): CardNature {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const words = (value: unknown, max: number) =>
        typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim().slice(0, max) : undefined;
    const habits = ["often", "sometimes", "rarely"] as const;
    const out: CardNature = {
        sociality: pick(row.sociality, ["solitary", "pair", "group", "colony"] as const),
        group_word: words(row.group_word, 30),
        active: pick(row.active, ["diurnal", "nocturnal", "crepuscular", "always"] as const),
        hibernates: typeof row.hibernates === "boolean" ? row.hibernates : undefined,
        lifespan_years: typeof row.lifespan_years === "number" && row.lifespan_years > 0 ? row.lifespan_years : undefined,
        apex: typeof row.apex === "boolean" ? row.apex : undefined,
        predators: words(row.predators, 160),
        senses: words(row.senses, 240),
        asks: pick(row.asks, habits),
        tells: pick(row.tells, habits)
    };
    return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== undefined)) as CardNature;
}

export function askAnimalNatureFor(params: {
    animalName: string;
    taxonomy: AskSpeciesTaxonomy | null;
    stats: AskPersonaStats | null;
    fieldGuide: Record<string, unknown> | null;
    // The persona's intellect band (live percentiles); derived when absent.
    intellect?: AskPersonaDials["intellect"] | null;
    // The voice card's own nature (CardNature); wins field by field.
    card?: unknown;
}): AskAnimalNature {
    const derived = deriveNature(params);
    const card = parseCardNature(params.card);
    if (Object.keys(card).length === 0) return derived;
    const sociality = card.sociality ?? derived.sociality;
    return {
        ...derived,
        sociality,
        groupWord: card.group_word ?? (card.sociality && card.sociality !== derived.sociality ? null : derived.groupWord),
        activity: card.active ?? derived.activity,
        dormantInWinter: card.hibernates ?? derived.dormantInWinter,
        lifespan: card.lifespan_years !== undefined ? lifespanBand(card.lifespan_years) : derived.lifespan,
        apex: card.apex ?? derived.apex,
        predators: card.apex === true ? null : card.predators ?? derived.predators,
        senses: card.senses ?? derived.senses,
        asks: card.asks ?? derived.asks,
        tells: card.tells ?? derived.tells
    };
}

function deriveNature(params: {
    animalName: string;
    taxonomy: AskSpeciesTaxonomy | null;
    stats: AskPersonaStats | null;
    fieldGuide: Record<string, unknown> | null;
    intellect?: AskPersonaDials["intellect"] | null;
}): AskAnimalNature {
    const t = tax(params.animalName, params.taxonomy);
    const guide = params.fieldGuide ?? {};
    const guideText = [guide.species_spotlight, guide.signature_traits, guide.interesting_facts, guide.typical_habitat, guide.sleep_pattern]
        .map(text).join(" ");
    const sleep = text(guide.sleep_pattern);
    const predatorsText = text(guide.predators_summary);
    const voiceKey = chooseAskChatVoiceKey({animalName: params.animalName, taxonomy: params.taxonomy, stats: params.stats});
    const {sociality, groupWord} = socialityFor(t, guideText);
    const apex = apexFor(predatorsText);
    const lifespan = lifespanBand(lifespanYears(text(guide.lifespan_estimate)));
    return {
        voiceKey,
        sociality,
        groupWord,
        activity: activityFor(sleep, text(guide.best_time_of_day)),
        dormantInWinter: dormantInWinterFor(sleep),
        lifespan,
        apex,
        predators: apex ? null : firstSentence(predatorsText),
        senses: sensesFor(t),
        asks: adjustAsks(SHAPES[voiceKey]?.asks ?? "sometimes", sociality),
        tells: storyTendency(SHAPES[voiceKey]?.tells ?? "sometimes", lifespan,
            params.intellect ?? askPersonaDials({stats: params.stats, dynamics: null, voice: null}).intellect),
        diet: text(guide.diet_summary).toLowerCase(),
        huntedBy: predatorsText.toLowerCase(),
        kindWords: kindWordsFor(t)
    };
}

// The "who you are" lines: how it talks and lives, its senses, its life.
// Stable for a species, so they sit in the cached system prompt.
export function askNatureLines(nature: AskAnimalNature, intellect: AskPersonaDials["intellect"] | null): string[] {
    const lines = [
        SHAPES[nature.voiceKey]?.line ?? null,
        ASK_LINES[nature.asks],
        nature.sociality ? SOCIALITY_LINES[nature.sociality](nature.groupWord) : null,
        nature.senses ? `Your senses: ${nature.senses} Reach for them when you describe things — what you smell, hear or feel, not what a person would see.` : null,
        nature.lifespan ? LIFESPAN_LINES[nature.lifespan] : null,
        nature.apex
            ? "Nothing hunts you as an adult; you are hard to rattle."
            : nature.predators
            ? `What hunts you: ${nature.predators} It shapes what you're wary of. Let it show as instinct — sudden moves, open ground, being watched — never as a list.`
            : null,
        intellect ? HUMAN_WORLD_LINES[intellect] : null
    ];
    return lines.filter((line): line is string => Boolean(line)).map((line) => `- ${line}`);
}

// ---------------------------------------------------------------------------
// Right now
// ---------------------------------------------------------------------------

type DayPart = "dawn" | "morning" | "midday" | "afternoon" | "evening" | "night" | "late night";

function dayPart(hour: number): DayPart {
    if (hour < 5) return "late night";
    if (hour < 8) return "dawn";
    if (hour < 11) return "morning";
    if (hour < 14) return "midday";
    if (hour < 17) return "afternoon";
    if (hour < 21) return "evening";
    return "night";
}

const STATE: Record<ActivityPattern, Partial<Record<DayPart, string>>> = {
    nocturnal: {
        dawn: "your night is ending: you're winding down, ready to sleep",
        morning: "this is when you sleep: you're drowsy, slow and a bit grumpy, and you say less than usual",
        midday: "this is when you sleep: you're drowsy, slow and a bit grumpy, and you say less than usual",
        afternoon: "you'd still be asleep: groggy, and short with them",
        evening: "you're just waking up, stretching into your time",
        night: "this is your time: you're wide awake and sharp",
        "late night": "this is your time: you're wide awake and sharp"
    },
    diurnal: {
        dawn: "you're just waking with the light",
        morning: "you're awake and busy",
        midday: "you're awake and busy",
        afternoon: "you're awake and busy",
        evening: "you're settling for the night, slowing down",
        night: "you'd be asleep by now: sleepy and slow, and you say less than usual",
        "late night": "you'd be fast asleep: barely awake, a few words at most"
    },
    crepuscular: {
        dawn: "these are your favourite hours: you're at your most alive",
        morning: "you're winding down after the dawn",
        midday: "this is your resting time: you're dozy and slow",
        afternoon: "you're stirring, waiting for dusk",
        evening: "these are your favourite hours: you're at your most alive",
        night: "you're out and about, alert",
        "late night": "you're resting in the deep of the night"
    },
    always: {}
};

function season(month: number, latitude: number): "spring" | "summer" | "autumn" | "winter" | null {
    if (Math.abs(latitude) < 23.5) return null;
    const north = latitude >= 0;
    const index = [11, 0, 1].includes(month) ? 0 : [2, 3, 4].includes(month) ? 1 : [5, 6, 7].includes(month) ? 2 : 3;
    const names = north ? ["winter", "spring", "summer", "autumn"] : ["summer", "autumn", "winter", "spring"];
    return names[index] as "spring" | "summer" | "autumn" | "winter";
}

// What time it is for the person, and what that means for this animal.
// Null when the person's clock is unknown (older builds never sent it).
export function askRightNowLine(params: {
    nature: AskAnimalNature | null;
    utcOffsetMinutes: number | null;
    now?: Date;
    // Where the animal was found: its season.
    latitude?: number | null;
}): string | null {
    if (params.utcOffsetMinutes === null || !Number.isFinite(params.utcOffsetMinutes)) return null;
    const now = params.now ?? new Date();
    const local = new Date(now.getTime() + params.utcOffsetMinutes * 60_000);
    const hour = local.getUTCHours();
    const clock = `${String(hour).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
    const part = dayPart(hour);
    const pieces = [`it is ${part} for them (${clock} where they are)`];
    const nature = params.nature;
    const state = nature?.activity ? STATE[nature.activity][part] : null;
    if (state) pieces.push(`for you, ${state}`);
    const lat = params.latitude;
    const here = typeof lat === "number" && Number.isFinite(lat) ? season(local.getUTCMonth(), lat) : null;
    if (here === "winter" && nature?.dormantInWinter) {
        pieces.push("and it is winter where you live — you'd be in your winter sleep: half-asleep, very slow, very few words");
    } else if (here) {
        pieces.push(`it is ${here} where you live`);
    }
    return [
        `right_now — ${pieces.join("; ")}.`,
        "Let it show only the way an animal's state shows — in your energy and length, and a word or two. Never announce the time or explain your sleep unless they ask."
    ].join("\n");
}

// ---------------------------------------------------------------------------
// How you met
// ---------------------------------------------------------------------------

export type AskCaptureMoment = {
    captured_at?: string | null;
    timezone?: string | null;
    place?: string | null;
    country_code?: string | null;
    habitat?: string | null;
    wild?: string | null;
    weather?: string | null;
    temp_c?: number | null;
    note?: string | null;
};

function localWhen(iso: string, timezone: string | null | undefined): string | null {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return null;
    try {
        const zone = timezone && timezone.includes("/") ? timezone : "UTC";
        const date = new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short", year: "numeric", timeZone: zone}).format(at);
        const hour = Number(new Intl.DateTimeFormat("en-GB", {hour: "numeric", hourCycle: "h23", timeZone: zone}).format(at));
        return Number.isFinite(hour) ? `${date}, ${dayPart(hour)}` : date;
    } catch {
        return null;
    }
}

// The person's sighting of this animal, for how_you_met. A visitor hears
// only the kind of place and when, never where: the owner's places stay theirs.
export function askHowYouMetLine(moment: AskCaptureMoment | null, options: {forVisitor?: boolean} = {}): string | null {
    if (!moment) return null;
    const clean = (value: unknown, max: number) =>
        typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim().slice(0, max) : null;
    const when = moment.captured_at ? localWhen(moment.captured_at, moment.timezone) : null;
    const wild = clean(moment.wild, 30);
    const setting = [clean(moment.habitat, 80), wild ? wild.toLowerCase() : null].filter(Boolean).join(" · ") || null;
    const weather = [clean(moment.weather, 40)?.toLowerCase(), typeof moment.temp_c === "number" ? `${Math.round(moment.temp_c)}°C` : null]
        .filter(Boolean).join(", ") || null;
    const record: Record<string, string> = {};
    if (options.forVisitor) {
        if (when) record.when = when.replace(/^\d+\s/, "");
        if (setting) record.setting = setting;
    } else {
        if (when) record.when = when;
        const place = clean(moment.place, 140);
        if (place) record.where = place;
        if (setting) record.setting = setting;
        if (weather) record.weather = weather;
        const note = clean(moment.note, 140);
        if (note) record.their_note = note;
    }
    if (Object.keys(record).length === 0) return null;
    return [
        JSON.stringify(record),
        options.forVisitor
            ? "This is how your owner met you. Mention it only if it comes up."
            : "This is your shared memory of meeting. Bring it up now and then, when it fits, in a few words, the way you'd remember a meeting — never recite it."
    ].join("\n");
}


// Minutes ahead of UTC for an IANA time zone at a moment ("Asia/Jakarta" →
// 420). Null for an unknown zone.
export function askUtcOffsetForTimeZone(timeZone: string | null | undefined, now = new Date()): number | null {
    if (!timeZone || !timeZone.includes("/")) return null;
    try {
        const name = new Intl.DateTimeFormat("en-US", {timeZone, timeZoneName: "longOffset"})
            .formatToParts(now).find((part) => part.type === "timeZoneName")?.value ?? "";
        if (name === "GMT") return 0;
        const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
        if (!match) return null;
        const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
        return match[1] === "-" ? -minutes : minutes;
    } catch {
        return null;
    }
}
