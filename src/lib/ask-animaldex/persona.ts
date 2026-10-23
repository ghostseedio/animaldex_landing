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
 * the same on the website as in the app. Left out on purpose: the spoken voice
 * (archetype choice and ElevenLabs settings) — the website does not speak —
 * and group ordering, since the website has no group chat. Pure: no
 * `server-only`, so the prompt builders, the drawer and the tests can use it.
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

export function askPersonaDials(params: {
    stats: AskPersonaStats | null;
    dynamics: AskRhythmSource | null;
    voice: Pick<AskCompanionVoice, "pace"> | null;
}): AskPersonaDials {
    const stats = params.stats ?? ASK_MEDIAN_STATS;
    const intellect = band<AskIntellect>(stats.intelligence, [[15, "instinct"], [42, "practical"], [60, "sharp"]], "brilliant");
    const presence = band<AskPresence>(stats.dominance, [[14, "yielding"], [44, "steady"], [58, "assertive"]], "commanding");
    // Size bands are wider than the percentiles: the catalogue is mostly insects
    // and birds, so its 90th percentile (46) is a cheetah, not a giant.
    const build = band<AskBuild>(stats.size, [[6, "tiny"], [22, "small"], [46, "medium"], [70, "large"]], "huge");
    const tempo = band<AskTempo>(stats.speed, [[20, "slow"], [52, "steady"]], "fast");
    const rarity = band<AskRarity>(stats.rarity, [[22, "common"], [64, "uncommon"], [78, "rare"]], "legendary");

    // The authored card's pace wins for typing speed; the speed stat nudges it.
    const pace = params.voice?.pace ?? (tempo === "fast" ? "quick" : tempo === "slow" ? "slow" : "measured");
    const baseCps = pace === "slow" ? 11 : pace === "quick" ? 16 : 13.5;
    const typingCharsPerSecond = Math.round((baseCps + (tempo === "fast" ? 1 : tempo === "slow" ? -1 : 0)) * 10) / 10;

    const wordBudget = {tiny: 95, small: 85, medium: 75, large: 60, huge: 45}[build]
        + (intellect === "brilliant" ? 10 : intellect === "instinct" ? -10 : 0);

    return {
        intellect,
        presence,
        build,
        tempo,
        rarity,
        rhythm: askRhythmFromDynamics(params.dynamics),
        effort: intellect === "brilliant" ? "high" : intellect === "sharp" ? "medium" : "low",
        wordBudget,
        typingCharsPerSecond
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

const BUILD_LINES: Record<AskBuild, string | null> = {
    huge:
        "Your size: you are enormous, and big animals do not waste words. Say what matters and stop — two or three sentences, even when you are helping with something real. Silence does not bother you.",
    large: "Your size: you are big, and you keep things short and weighty — a few sentences, not paragraphs.",
    medium: null,
    small: "Your size: you are small, so you notice the small things everyone else walks past.",
    tiny:
        "Your size: you are tiny and busy. You chatter a little, with quick asides about your small world, but every reply still answers them."
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
export function askPersonaLines(dials: AskPersonaDials): string[] {
    const lines = [
        INTELLECT_LINES[dials.intellect],
        PRESENCE_LINES[dials.presence],
        BUILD_LINES[dials.build],
        RARITY_LINES[dials.rarity],
        RHYTHM_LINES[dials.rhythm]
    ].filter((line): line is string => Boolean(line));
    lines.push(
        dials.build === "huge" || dials.build === "large"
            ? `Length: about ${dials.wordBudget} words, even for a real problem. Go longer only when they ask you to explain more.`
            : `Length: about ${dials.wordBudget} words is your natural reply in conversation. Go longer only when they ask you to explain something or work through a real problem with them.`
    );
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
