/**
 * The inline Ask box on the big tier lists and the comparison pages (CC 2,
 * Nov 2026): which animal it is addressed to and the one question it comes
 * pre-filled with. Everything here is derived from the page's own data (its
 * headline, its #1 entry, a comparison's scenario and stat columns); nothing
 * states a fact the page does not.
 *
 * Pure, so the question wording and the target choice are tested.
 */

import {commonNameInSentence} from "@/lib/animal-dream-reading";

/** The twelve largest tier lists by search impressions (GSC, Oct–Nov 2026): the box goes on these. */
export const TIER_LIST_ASK_SLUGS = [
    "strongest-animals",
    "smartest-animals",
    "fastest-animals",
    "most-dangerous-animals",
    "animals-with-highest-mating-drive",
    "most-loyal-animals",
    "most-adaptable-animals",
    "most-resilient-animals",
    "most-agile-animals",
    "ugliest-animals",
    "rarest-animals",
    "animals-with-best-teamwork"
] as const;

/** The four that also carry install buttons under the box and after the #1 entry. */
export const TIER_LIST_INSTALL_SLUGS = [
    "strongest-animals",
    "most-dangerous-animals",
    "smartest-animals",
    "animals-with-highest-mating-drive"
] as const;

export function hasTierListAskBox(slug: string) {
    return (TIER_LIST_ASK_SLUGS as readonly string[]).includes(slug);
}

export function hasTierListInstallButtons(slug: string) {
    return (TIER_LIST_INSTALL_SLUGS as readonly string[]).includes(slug);
}

/** `utm_content` of a tier list's install buttons: "tierlist_strongest-animals". */
export function tierListUtmContent(slug: string) {
    return `tierlist_${slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 100)}`;
}

/** "Strongest Animals in the World: Top 10 Ranked" → "strongest animals" (the ranking page's own rule). */
export function rankingSubject(headline: string) {
    return headline
        .replace(/^.*\?\s*/, "")
        .replace(/^the\s+/i, "")
        .replace(/^(top\s+)?\d+\s+/i, "")
        .replace(/:.*$/, "")
        .replace(/,?\s+ranked$/i, "")
        .replace(/\s+in the (animal )?world$/i, "")
        .trim()
        .toLowerCase();
}

/**
 * The question a tier list's box opens with, addressed to its #1 animal and
 * built from the list's headline alone:
 *   "strongest animals"                      → "Why are you the strongest?"
 *   "most dangerous animals"                 → "Why are you the most dangerous?"
 *   "animals with the highest mating drive"  → "Why do you have the highest mating drive?"
 * A headline shaped some other way falls back to the list's own name.
 */
export function tierListAskQuestion(headline: string) {
    const subject = rankingSubject(headline);
    const withThe = /^animals? with the (.+)$/.exec(subject);
    if (withThe) return `Why do you have the ${withThe[1]}?`;
    const superlative = /^(.+?)\s+animals?$/.exec(subject);
    if (superlative) return `Why are you the ${superlative[1]}?`;
    return `Why are you #1 among the ${subject}?`;
}

export type ComparisonAskSide = {slug: string; name: string};

export type ComparisonAskTarget = {
    /** The animal the box speaks to. */
    target: ComparisonAskSide;
    /** The other one, named in the question. */
    other: ComparisonAskSide;
    question: string;
    /** How the target was chosen, for the eyebrow: more scenario wins, more stat edges, or the first animal. */
    basis: "scenarios" | "stats" | "first";
};

function article(word: string) {
    return /^[aeiou]/i.test(word) ? "an" : "a";
}

/** "How would you beat a bull shark?" */
export function comparisonAskQuestion(otherName: string) {
    const name = commonNameInSentence(otherName.trim());
    return `How would you beat ${article(name)} ${name}?`;
}

/**
 * Which of a comparison's two animals the box addresses: the one the page's
 * own scenario column gives more wins, else the one with more stat edges,
 * else the first. The page itself names no winner (WEB-9); the box only
 * picks who to ask, and asks it how it would beat the other.
 */
export function comparisonAskTarget(input: {
    animalA: ComparisonAskSide;
    animalB: ComparisonAskSide;
    scenarios: ReadonlyArray<{winner: string}>;
    stats: ReadonlyArray<{advantage: string}>;
}): ComparisonAskTarget {
    const scenarioA = input.scenarios.filter((scenario) => scenario.winner === "animalA").length;
    const scenarioB = input.scenarios.filter((scenario) => scenario.winner === "animalB").length;
    const statA = input.stats.filter((stat) => stat.advantage === "animalA").length;
    const statB = input.stats.filter((stat) => stat.advantage === "animalB").length;
    let basis: ComparisonAskTarget["basis"] = "first";
    let bIsTarget = false;
    if (scenarioA !== scenarioB) {
        basis = "scenarios";
        bIsTarget = scenarioB > scenarioA;
    } else if (statA !== statB) {
        basis = "stats";
        bIsTarget = statB > statA;
    }
    const target = bIsTarget ? input.animalB : input.animalA;
    const other = bIsTarget ? input.animalA : input.animalB;
    return {target, other, question: comparisonAskQuestion(other.name), basis};
}

/** The box's words, in English; `inlineAsk` in the locale files overrides them (loaders/inline-ask-words). */
export const INLINE_ASK_WORDS_EN = {
    eyebrowTierList: "Ask the #1 animal",
    eyebrowComparison: "Ask the animal with the edge",
    eyebrowHub: "Ask the animal from the most-read matchup",
    title: "Ask the {animal}",
    hint: "It answers as itself, from how it lives.",
    quota: "{limit} free messages a day. More in the app.",
    remaining: "{remaining} of {limit} messages left today",
    limitReached: "You’ve used today’s messages. Keep going in the app, free.",
    placeholder: "Ask the {animal} anything…",
    submit: "Ask",
    moreQuestions: "Or ask",
    installTitle: "Talk to the {animal} in the app, free",
    installBody: "Every animal has a lesson.",
    appStore: "App Store",
    googlePlay: "Google Play"
} as const;

export type InlineAskWords = {-readonly [K in keyof typeof INLINE_ASK_WORDS_EN]: string};

/** The locale's `inlineAsk` words over the English, key by key. */
export function inlineAskWords(raw: unknown): InlineAskWords {
    const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const words = {...INLINE_ASK_WORDS_EN} as InlineAskWords;
    for (const key of Object.keys(INLINE_ASK_WORDS_EN) as Array<keyof InlineAskWords>) {
        const value = source[key];
        if (typeof value === "string" && value.trim()) words[key] = value;
    }
    return words;
}
