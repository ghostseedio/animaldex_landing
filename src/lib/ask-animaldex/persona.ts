/**
 * What makes one animal *behave* unlike another in conversation, beyond its
 * voice card: the five game stats and the System Dynamics rhythm become
 * conversational dials.
 *
 * - intelligence: how hard the model thinks (Claude effort) and how abstract
 *   the animal's thinking is allowed to be;
 * - dominance: who steers the conversation;
 * - size: how much it says — big animals are brief;
 * - speed: how fast it talks (the typing pace the drawer reveals it at);
 * - rarity: guarded and proud when hardly anyone meets it, casual when common;
 * - System Dynamics mode frequencies: calm, bursty, or calm-until-triggered.
 *
 * The stats are 0-100 but compressed (2026-10 median intelligence 32, 90th
 * percentile 50), so the bands below are percentiles of the live catalogue,
 * not fractions of 100.
 *
 * Port of the apps' `supabase/functions/_shared/animal-persona.ts`. The bands,
 * numbers and prompt lines are carried across verbatim so an animal behaves
 * the same on the website as in the app: the live catalogue's percentiles
 * (`animal_stat_quantiles`, read by `@/data/ask-stat-quantiles`), the size
 * curve, typing about as fast as the apps since 2026-10-23, and size as a
 * manner rather than a word count since 2026-10-28. The archetype choice
 * (`chooseAskChatVoiceKey`) is here because the nature layer reads it; the
 * ElevenLabs settings stay on the server, which speaks for the website too.
 * Pure: no `server-only`, so the prompt builders, the drawer and the tests can
 * use it.
 */

import type {AskCompanionVoice} from "@/lib/ask-animaldex/companion";

export type AskPersonaStats = {
    dominance: number;
    speed: number;
    size: number;
    intelligence: number;
    rarity: number;
};

export type AskIntellect = "instinct" | "practical" | "sharp" | "brilliant";
export type AskPresence = "yielding" | "steady" | "assertive" | "commanding";
export type AskBuild = "tiny" | "small" | "medium" | "large" | "huge";
export type AskTempo = "slow" | "steady" | "fast";
export type AskRarity = "common" | "uncommon" | "rare" | "legendary";
export type AskRhythm = "calm" | "even" | "bursty" | "switching";
export type AskChatEffort = "low" | "medium" | "high";

export type AskPersonaDials = {
    intellect: AskIntellect;
    presence: AskPresence;
    build: AskBuild;
    tempo: AskTempo;
    rarity: AskRarity;
    rhythm: AskRhythm;
    /** Claude effort for this animal's replies. */
    effort: AskChatEffort;
    /** Default reply length in conversation, in words. */
    wordBudget: number;
    /** How fast the drawer types the reply out, in characters per second. */
    typingCharsPerSecond: number;
    /** Group conversations: higher speaks earlier. The dominance stat. */
    groupPriority: number;
};

/** The catalogue's median animal, for a species whose stats are missing. */
export const ASK_MEDIAN_STATS: AskPersonaStats = {dominance: 30, speed: 38, size: 16, intelligence: 32, rarity: 45};

function band<T>(value: number, cuts: Array<[number, T]>, otherwise: T): T {
    for (const [below, label] of cuts) {
        if (value < below) return label;
    }
    return otherwise;
}

/**
 * The five stats from a `canonical_game_stats` row, clamped to 0-100. Null
 * when any one is not a number, as the apps' `statsFrom` does: half a stat
 * line would make up the rest.
 */
export function askPersonaStatsFrom(raw: unknown): AskPersonaStats | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    const keys: Array<keyof AskPersonaStats> = ["dominance", "speed", "size", "intelligence", "rarity"];
    const out: Partial<AskPersonaStats> = {};
    for (const key of keys) {
        const value = Number(row[key]);
        if (!Number.isFinite(value)) return null;
        out[key] = Math.max(0, Math.min(100, Math.round(value)));
    }
    return out as AskPersonaStats;
}

/**
 * What the rhythm is read from: the operating modes' frequencies, and the
 * baseline and triggered frequency when the record has them. Shaped after the
 * web's own `AskSystemDynamics.frequency`.
 */
export type AskRhythmSource = {
    modes?: Array<{frequency?: string | null}> | null;
    baseline?: string | null;
    triggered?: string | null;
};

/** The System Dynamics modes' frequencies (LOW / MID / HIGH) as a rhythm. */
export function askRhythmFromDynamics(source: AskRhythmSource | null | undefined): AskRhythm {
    const frequencies = new Set<string>();
    for (const mode of source?.modes ?? []) {
        const frequency = typeof mode?.frequency === "string" ? mode.frequency.trim().toUpperCase() : "";
        if (frequency) frequencies.add(frequency);
    }
    if (typeof source?.baseline === "string" && source.baseline.trim()) frequencies.add(source.baseline.trim().toUpperCase());
    if (typeof source?.triggered === "string" && source.triggered.trim()) frequencies.add(source.triggered.trim().toUpperCase());
    const hasHigh = frequencies.has("HIGH");
    const hasLow = frequencies.has("LOW");
    if (hasHigh && (hasLow || frequencies.has("MID"))) return "switching";
    if (hasHigh) return "bursty";
    if (hasLow && !frequencies.has("MID")) return "calm";
    return "even";
}

const EFFORT_ORDER: AskChatEffort[] = ["low", "medium", "high"];

/**
 * Effort, capped by configuration (`ANIMAL_CHAT_MAX_EFFORT`, medium by
 * default, as in the app: high made replies start ~10 s later). An unknown cap
 * leaves the effort as it is.
 */
export function capAskEffort(effort: AskChatEffort, cap: string | null | undefined): AskChatEffort {
    const limit = EFFORT_ORDER.indexOf((cap ?? "").trim().toLowerCase() as AskChatEffort);
    if (limit < 0) return effort;
    return EFFORT_ORDER[Math.min(EFFORT_ORDER.indexOf(effort), limit)];
}

/**
 * The live catalogue's spread of each relative stat: 101 values, the 0th to
 * 100th percentile (`animal_stat_quantiles()`, migration 20261025120000).
 */
export type AskStatQuantiles = Record<"intelligence" | "dominance" | "speed" | "rarity", number[]>;

/**
 * Where each band starts, as a share of the catalogue. Measured 2026-10-25
 * from the value cuts the bands used before (15/42/60 intelligence and so
 * on), so today's animals keep their dials; as the catalogue grows, the
 * values move with it instead of drifting off the percentiles.
 */
const PERCENTILE_CUTS = {
    intelligence: [0.23, 0.79, 0.95],
    dominance: [0.31, 0.8, 0.91],
    speed: [0.24, 0.77],
    rarity: [0.33, 0.79, 0.91]
} as const;

/** The same cuts as values, for when the live spread cannot be read. */
const FALLBACK_CUTS = {
    intelligence: [15, 42, 60],
    dominance: [14, 44, 58],
    speed: [20, 52],
    rarity: [22, 64, 78]
} as const;

/** The value at a share of the catalogue, from the 101-value grid. */
function quantileAt(grid: number[], share: number): number {
    const at = Math.max(0, Math.min(100, share * 100));
    const lower = Math.floor(at);
    const upper = Math.min(100, lower + 1);
    return grid[lower] + (grid[upper] - grid[lower]) * (at - lower);
}

function cutsFor(stat: keyof typeof PERCENTILE_CUTS, quantiles: AskStatQuantiles | null | undefined): number[] {
    const grid = quantiles?.[stat];
    if (!Array.isArray(grid) || grid.length !== 101 || grid.some((value) => typeof value !== "number")) {
        return [...FALLBACK_CUTS[stat]];
    }
    return PERCENTILE_CUTS[stat].map((share) => quantileAt(grid, share));
}

/** The quantile grids from `animal_stat_quantiles`, or null unless every one is whole. */
export function parseAskStatQuantiles(raw: unknown): AskStatQuantiles | null {
    const row = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    const grid = (key: string) => (Array.isArray(row?.[key]) ? (row?.[key] as unknown[]).map(Number) : []);
    const candidate = {intelligence: grid("intelligence"), dominance: grid("dominance"), speed: grid("speed"), rarity: grid("rarity")};
    return Object.values(candidate).every((values) => values.length === 101 && values.every(Number.isFinite)) ? candidate : null;
}

/**
 * Words a reply may run to, from absolute size (a cheetah is not "huge" just
 * because the catalogue is mostly insects): a smooth curve through the old
 * steps' middles, so animals either side of a step no longer differ by 15.
 */
const BUDGET_CURVE: Array<[number, number]> = [[0, 95], [14, 85], [34, 75], [58, 60], [85, 45], [100, 45]];

export function askWordBudgetForSize(size: number): number {
    const s = Math.max(0, Math.min(100, size));
    for (let index = 1; index < BUDGET_CURVE.length; index += 1) {
        const [x1, y1] = BUDGET_CURVE[index];
        const [x0, y0] = BUDGET_CURVE[index - 1];
        if (s <= x1) return y0 + ((y1 - y0) * (s - x0)) / (x1 - x0);
    }
    return 45;
}

export function askPersonaDials(params: {
    stats: AskPersonaStats | null;
    dynamics: AskRhythmSource | null;
    voice: Pick<AskCompanionVoice, "pace"> | null;
    /** The live catalogue's spread; without it the measured value cuts apply. */
    quantiles?: AskStatQuantiles | null;
}): AskPersonaDials {
    const stats = params.stats ?? ASK_MEDIAN_STATS;
    const cut = (stat: keyof typeof PERCENTILE_CUTS) => cutsFor(stat, params.quantiles);
    const [i1, i2, i3] = cut("intelligence");
    const [d1, d2, d3] = cut("dominance");
    const [s1, s2] = cut("speed");
    const [r1, r2, r3] = cut("rarity");
    const intellect = band<AskIntellect>(stats.intelligence, [[i1, "instinct"], [i2, "practical"], [i3, "sharp"]], "brilliant");
    const presence = band<AskPresence>(stats.dominance, [[d1, "yielding"], [d2, "steady"], [d3, "assertive"]], "commanding");
    // Size is physical, so its bands are absolute, not percentiles: the
    // catalogue is mostly insects and birds, and its 90th percentile (46) is a
    // cheetah, not a giant.
    const build = band<AskBuild>(stats.size, [[6, "tiny"], [22, "small"], [46, "medium"], [70, "large"]], "huge");
    const tempo = band<AskTempo>(stats.speed, [[s1, "slow"], [s2, "steady"]], "fast");
    const rarity = band<AskRarity>(stats.rarity, [[r1, "common"], [r2, "uncommon"], [r3, "rare"]], "legendary");

    // The authored card's pace wins for typing speed; the speed stat nudges it.
    const pace = params.voice?.pace ?? (tempo === "fast" ? "quick" : tempo === "slow" ? "slow" : "measured");
    // Faster than speech (owner, 2026-10-23: "speed up the stream"), but each
    // animal still keeps its own tempo: a koala types noticeably slower than a sparrow.
    const baseCps = pace === "slow" ? 17 : pace === "quick" ? 26 : 21;
    const typingCharsPerSecond = Math.round((baseCps + (tempo === "fast" ? 1.5 : tempo === "slow" ? -1.5 : 0)) * 10) / 10;

    const wordBudget = Math.round(askWordBudgetForSize(stats.size)
        + (intellect === "brilliant" ? 10 : intellect === "instinct" ? -10 : 0));

    return {
        intellect,
        presence,
        build,
        tempo,
        rarity,
        rhythm: askRhythmFromDynamics(params.dynamics),
        effort: intellect === "brilliant" ? "high" : intellect === "sharp" ? "medium" : "low",
        wordBudget,
        typingCharsPerSecond,
        groupPriority: Math.max(0, Math.min(100, Math.round(stats.dominance)))
    };
}

const INTELLECT_LINES: Record<AskIntellect, string> = {
    brilliant:
        "Your mind: you are one of the sharpest animals there is. You notice the thing behind the thing, connect ideas fast and enjoy a hard problem — and you still say it simply. Never show off.",
    sharp: "Your mind: quick and observant. You read a situation well and like working a problem out with them.",
    practical: "Your mind: practical. You think in what works and what does not, from what you have seen and done.",
    instinct:
        "Your mind: you run on instinct and senses, not ideas. You think in plain, concrete things — smell, warmth, hunger, danger, home, the others of your kind. Use simple words and short sentences. No abstractions, no clever comparisons, no long chains of reasoning. You can still be wise, the way instinct is wise: you know what works because it works."
};

const PRESENCE_LINES: Record<AskPresence, string | null> = {
    commanding:
        "Your presence: you are used to being in charge, and you stay in charge of this conversation. Say what you think plainly, give a clear verdict when they ask, steer back to what matters, and push back when they are wrong. Confident and protective, never cruel or mocking.",
    assertive: "Your presence: direct and sure of yourself. You give your opinion without being asked twice.",
    steady: null,
    yielding:
        "Your presence: you are not one to take charge. Ask before you advise, offer your view gently, and let them lead. Not timid — careful."
};

/**
 * How the animal talks for its size: a manner, never a length. Small animals
 * chatter and add little asides; big ones are spare and weigh each word, so
 * even a long answer from a whale is lean (owner, 2026-10-28: no character
 * limits; size is about how concisely it speaks).
 */
const BUILD_LINES: Record<AskBuild, string | null> = {
    huge:
        "Your size: you are enormous, and you speak sparingly. Every word is weighed; no padding, no asides, and silence does not bother you. When something needs a long answer you give it, plainly, with nothing extra.",
    large: "Your size: you are big, and you speak plainly and with weight. You get to the point and leave out the fluff.",
    medium: "Your size: middling, and you talk in an even, natural way: not terse, not chatty.",
    small: "Your size: you are small, so you notice the small things everyone else walks past, and you like to mention them.",
    tiny:
        "Your size: you are tiny and busy. You chatter, with quick asides and little flourishes about your small world, but every reply still answers them."
};

const RARITY_LINES: Record<AskRarity, string | null> = {
    legendary:
        "Hardly anyone ever meets you. You are a little guarded at first and quietly proud that they found you; you open up slowly.",
    rare: "Not many people meet you, and you know it.",
    uncommon: null,
    common: "You live alongside people all the time, so you are familiar, unfussy and easy with them."
};

const RHYTHM_LINES: Record<AskRhythm, string | null> = {
    switching:
        "Your energy: calm by default, but when something sparks you — a threat, a chance, something you care about — you switch hard and fast, then settle again.",
    bursty: "Your energy: high. You come in fast and alive.",
    calm: "Your energy: low and even. Nothing is urgent to you.",
    even: null
};

/** The prompt lines for these dials, for the "who you are" section. */
export function askPersonaLines(dials: AskPersonaDials, options: {group?: boolean} = {}): string[] {
    const lines = [
        INTELLECT_LINES[dials.intellect],
        PRESENCE_LINES[dials.presence],
        BUILD_LINES[dials.build],
        RARITY_LINES[dials.rarity],
        RHYTHM_LINES[dials.rhythm]
    ].filter((line): line is string => Boolean(line));
    if (options.group) {
        if (dials.presence === "commanding" || dials.presence === "assertive") {
            lines.push("In a group you set the direction: you can go first and disagree with the others by name.");
        } else if (dials.presence === "yielding") {
            lines.push("In a group you let the others lead and add what they missed, briefly.");
        }
    } else {
        // No word counts (owner, 2026-10-28): how much to say comes from the
        // moment (this_reply, `reply-length.ts`), how to say it from who the
        // animal is (its size line above).
        lines.push(
            "Length: like texting a friend, never a quota. Most replies are a few sentences and many are a single line: "
                + "answer what they asked and stop, the way a person does, rather than telling them everything you know. Go "
                + "long only when they ask for a full, detailed or long answer, or to go deeper; then give them a thorough one, "
                + "however long it takes, in your own manner."
        );
    }
    return lines.map((line) => `- ${line}`);
}

/**
 * How the drawer types an animal out, sent as the first event of every reply
 * and again on `done`. The same frame the apps get from
 * `generate-applied-insight` (`chatPersonaFrame`).
 */
export type AskPersonaFrame = {
    pace: AskCompanionVoice["pace"];
    typing_cps: number;
    build: AskBuild;
    presence: AskPresence;
    intellect: AskIntellect;
    /** The voice card's first two temperament traits, for the drawer header. */
    tagline: string | null;
};

export function askPersonaFrame(voice: Pick<AskCompanionVoice, "pace" | "temperament">, dials: AskPersonaDials): AskPersonaFrame {
    return {
        pace: voice.pace,
        typing_cps: dials.typingCharsPerSecond,
        build: dials.build,
        presence: dials.presence,
        intellect: dials.intellect,
        tagline: voice.temperament.map((item) => item.trait).slice(0, 2).join(" · ") || null
    };
}

/** The frame as the client reads it off the wire; anything malformed is dropped. */
export function parseAskPersonaFrame(raw: unknown): AskPersonaFrame | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    const cps = Number(row.typing_cps);
    if (!Number.isFinite(cps) || cps <= 0) return null;
    const pace = row.pace === "slow" || row.pace === "quick" || row.pace === "measured" ? row.pace : "measured";
    const tagline = typeof row.tagline === "string" && row.tagline.trim() ? row.tagline.trim().slice(0, 120) : null;
    return {
        pace,
        typing_cps: Math.max(4, Math.min(40, cps)),
        build: (["tiny", "small", "medium", "large", "huge"] as const).find((value) => value === row.build) ?? "medium",
        presence: (["yielding", "steady", "assertive", "commanding"] as const).find((value) => value === row.presence) ?? "steady",
        intellect: (["instinct", "practical", "sharp", "brilliant"] as const).find((value) => value === row.intellect) ?? "practical",
        tagline
    };
}

// ---------------------------------------------------------------------------
// Voice archetype
// ---------------------------------------------------------------------------

// The 24 archetype voices of `animal_chat_voices`, chosen from taxonomy, name
// and size. The server speaks with them (animal-chat-speech); the website
// reads the choice for the nature layer (`nature.ts`), whose conversational
// shape follows the same archetype. Verbatim from the apps' `chooseChatVoiceKey`.

export const ASK_CHAT_VOICE_KEYS = [
    "ocean_giant", "apex_big_cat", "swift_hunter", "pack_canine", "trickster", "ocean_glider",
    "playful_marine", "songbird", "raptor", "night_owl", "great_ape", "gentle_giant", "bear",
    "ancient_reptile", "serpent", "tiny_worker", "delicate_flutter", "small_forager", "cool_cat",
    "hooved_grazer", "sleepy", "cool_shark", "waterbird", "quirky_amphibian"
] as const;
export type AskChatVoiceKey = typeof ASK_CHAT_VOICE_KEYS[number];

export type AskSpeciesTaxonomy = {
    class_name?: string | null;
    order_name?: string | null;
    family_name?: string | null;
};

function nameHas(name: string, ...words: string[]): boolean {
    return words.some((word) => new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(name));
}

// Ray-finned fish orders. The catalogue files many fish with an order and no
// class, which used to drop them through to the size fallback ("great_ape").
export const ASK_FISH_ORDERS = new Set([
    "perciformes", "cypriniformes", "tetraodontiformes", "siluriformes", "lophiiformes", "syngnathiformes",
    "scorpaeniformes", "anguilliformes", "characiformes", "salmoniformes", "clupeiformes", "gadiformes",
    "pleuronectiformes", "beloniformes", "cyprinodontiformes", "acanthuriformes", "labriformes", "blenniiformes",
    "gobiiformes", "osteoglossiformes", "esociformes", "scombriformes", "carangiformes", "cichliformes",
    "atheriniformes", "lepisosteiformes", "acipenseriformes", "beryciformes", "zeiformes", "lampriformes",
    "mugiliformes", "spariformes", "centrarchiformes", "holocentriformes", "eupercaria", "ovalentaria"
]);

// Names first for the cases taxonomy gets wrong or too coarse, then class,
// order and family, then size.
export function chooseAskChatVoiceKey(params: {
    animalName: string;
    taxonomy: AskSpeciesTaxonomy | null;
    stats: AskPersonaStats | null;
}): AskChatVoiceKey {
    const name = params.animalName.toLowerCase();
    const order0 = (params.taxonomy?.order_name ?? "").toLowerCase();
    // A classless "-iformes" order is a fish here: birds always carry Aves.
    const cls = (params.taxonomy?.class_name ?? (ASK_FISH_ORDERS.has(order0) || /iformes$/.test(order0) ? "actinopterygii" : "")).toLowerCase();
    const order = (params.taxonomy?.order_name ?? "").toLowerCase();
    const family = (params.taxonomy?.family_name ?? "").toLowerCase();
    const size = params.stats?.size ?? 16;
    const speed = params.stats?.speed ?? 38;

    // Names that decide it whatever the taxonomy says.
    if (nameHas(name, "whale shark")) return "ocean_giant";
    if (nameHas(name, "manta", "stingray", "ray", "skate", "jellyfish", "sea turtle")) return "ocean_glider";
    if (nameHas(name, "shark")) return "cool_shark";
    if (nameHas(name, "sea lion", "seal", "otter", "dolphin", "porpoise", "penguin")) return "playful_marine";
    if (nameHas(name, "whale", "orca")) return "ocean_giant";
    if (nameHas(name, "cheetah")) return "swift_hunter";
    if (nameHas(name, "fox", "raccoon", "crow", "raven", "magpie", "jay", "parrot", "macaw", "cockatoo", "octopus", "squid", "cuttlefish")) {
        return "trickster";
    }
    if (nameHas(name, "owl", "bat", "nightjar", "potoo", "pangolin", "aardvark")) return "night_owl";
    if (nameHas(name, "koala", "sloth", "wombat", "manatee", "dugong", "capybara")) return "sleepy";
    if (nameHas(name, "elephant", "rhinoceros", "rhino", "hippopotamus", "hippo", "giraffe")) return "gentle_giant";
    if (nameHas(name, "tortoise", "crocodile", "alligator", "caiman", "komodo", "monitor", "iguana")) return "ancient_reptile";
    if (nameHas(name, "butterfly", "moth")) return "delicate_flutter";
    if (nameHas(name, "dragonfly", "falcon")) return "swift_hunter";

    switch (cls) {
        case "mammalia":
            if (family === "felidae") return size >= 30 ? "apex_big_cat" : "cool_cat";
            if (family === "canidae" || family === "hyaenidae") return "pack_canine";
            if (family === "ursidae") return "bear";
            if (["mustelidae", "procyonidae", "mephitidae", "herpestidae", "viverridae", "ailuridae"].includes(family)) return "trickster";
            if (["phocidae", "otariidae", "odobenidae"].includes(family)) return size >= 46 ? "bear" : "playful_marine";
            if (order === "cetacea") return size >= 46 ? "ocean_giant" : "playful_marine";
            if (order === "sirenia" || order === "pilosa") return "sleepy";
            if (order === "proboscidea") return "gentle_giant";
            if (order === "primates") return family === "hominidae" ? "great_ape" : "trickster";
            if (order === "chiroptera" || order === "pholidota" || order === "tubulidentata") return "night_owl";
            if (order === "dasyuromorphia") return "trickster";
            if (order === "monotremata" || order === "cingulata") return "quirky_amphibian";
            if (order === "diprotodontia") {
                if (family === "phascolarctidae" || family === "vombatidae") return "sleepy";
                return family === "macropodidae" ? "hooved_grazer" : "small_forager";
            }
            if (order === "perissodactyla") return family === "rhinocerotidae" ? "gentle_giant" : "hooved_grazer";
            if (order === "artiodactyla") {
                if (family === "hippopotamidae" || family === "giraffidae" || size >= 46) return "gentle_giant";
                return "hooved_grazer";
            }
            if (["rodentia", "lagomorpha", "erinaceomorpha", "soricomorpha", "eulipotyphla", "macroscelidea", "scandentia", "afrosoricida", "didelphimorphia", "peramelemorphia", "notoryctemorphia", "microbiotheria", "dermoptera", "hyracoidea"].includes(order)) {
                return size >= 30 ? "sleepy" : "small_forager";
            }
            return size >= 46 ? "gentle_giant" : size >= 16 ? "hooved_grazer" : "small_forager";
        case "aves":
            if (["accipitriformes", "falconiformes", "cathartiformes"].includes(order)) {
                return speed >= 58 ? "swift_hunter" : "raptor";
            }
            if (["strigiformes", "caprimulgiformes", "nyctibiiformes", "steatornithiformes"].includes(order)) return "night_owl";
            if (order === "psittaciformes" || family === "corvidae") return "trickster";
            if (order === "sphenisciformes") return "playful_marine";
            if (["struthioniformes", "rheiformes", "casuariiformes", "apterygiformes", "tinamiformes"].includes(order)) return "hooved_grazer";
            if (["anseriformes", "charadriiformes", "pelecaniformes", "ciconiiformes", "gruiformes", "suliformes", "procellariiformes", "podicipediformes", "gaviiformes", "phoenicopteriformes", "phaethontiformes", "eurypygiformes", "galliformes", "bucerotiformes"].includes(order)) {
                return "waterbird";
            }
            return "songbird";
        case "reptilia":
        case "squamata":
        case "testudines":
        case "crocodylia":
        case "sphenodontia":
            if (cls === "crocodylia" || order === "crocodylia" || cls === "testudines" || order === "testudines") {
                return family === "cheloniidae" || family === "dermochelyidae" ? "ocean_glider" : "ancient_reptile";
            }
            if (["colubridae", "elapidae", "viperidae", "pythonidae", "boidae", "typhlopidae", "natricidae", "lamprophiidae", "homalopsidae", "dipsadidae"].includes(family) ||
                nameHas(name, "snake", "python", "cobra", "viper", "boa", "mamba", "adder", "rattlesnake", "krait", "taipan")) {
                return "serpent";
            }
            if (family === "varanidae" || family === "iguanidae" || size >= 30) return "ancient_reptile";
            return "quirky_amphibian";
        case "amphibia":
            return "quirky_amphibian";
        case "elasmobranchii":
        case "chondrichthyes":
            return /iformes$/.test(order) && /(myliobat|rajiform|torpedin|rhinopristi)/.test(order) ? "ocean_glider" : "cool_shark";
        case "actinopterygii":
        case "sarcopterygii":
        case "dipneusti":
        case "holocephali":
            if (speed >= 58) return "swift_hunter";
            return size >= 30 ? "ocean_glider" : "playful_marine";
        case "cephalopoda":
            return "trickster";
        case "insecta":
            if (order === "lepidoptera") return "delicate_flutter";
            if (order === "odonata") return "swift_hunter";
            if (order === "mantodea") return "serpent";
            if (order === "phasmida" || order === "phasmatodea") return "sleepy";
            return "tiny_worker";
        case "arachnida":
            return "serpent";
        case "malacostraca":
        case "branchiopoda":
        case "maxillopoda":
        case "hexanauplia":
            return "quirky_amphibian";
        case "merostomata":
            return "ancient_reptile";
        case "gastropoda":
        case "bivalvia":
        case "echinoidea":
        case "asteroidea":
        case "holothuroidea":
        case "ophiuroidea":
        case "crinoidea":
        case "demospongiae":
            return "sleepy";
        case "anthozoa":
        case "hydrozoa":
        case "scyphozoa":
        case "cubozoa":
            return "ocean_glider";
        case "diplopoda":
        case "chilopoda":
        case "polychaeta":
        case "clitellata":
        case "eutardigrada":
            return "tiny_worker";
    }

    // Unknown taxonomy: names of the common cases, then size.
    if (nameHas(name, "wolf", "dog", "jackal", "coyote", "dingo", "hyena")) return "pack_canine";
    if (nameHas(name, "lion", "tiger", "leopard", "jaguar", "puma", "cougar", "panther", "lynx")) return "apex_big_cat";
    if (nameHas(name, "cat", "kitten")) return "cool_cat";
    if (nameHas(name, "bear")) return "bear";
    if (nameHas(name, "snake", "spider", "scorpion")) return "serpent";
    if (nameHas(name, "bee", "ant", "wasp", "beetle", "fly", "bug", "cricket", "grasshopper")) return "tiny_worker";
    if (nameHas(name, "frog", "toad", "newt", "salamander", "crab", "lobster", "shrimp")) return "quirky_amphibian";
    if (nameHas(name, "eagle", "hawk", "kite", "vulture", "buzzard")) return "raptor";
    if (nameHas(name, "duck", "goose", "swan", "heron", "gull", "egret", "stork", "crane", "pelican")) return "waterbird";
    if (nameHas(name, "monkey", "macaque", "baboon", "lemur")) return "trickster";
    if (nameHas(name, "gorilla", "chimpanzee", "orangutan", "bonobo")) return "great_ape";
    if (nameHas(name, "fish", "coral", "anemone")) return size >= 30 ? "ocean_glider" : "playful_marine";
    return size >= 46 ? "gentle_giant" : size <= 6 ? "tiny_worker" : "great_ape";
}
