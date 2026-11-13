/**
 * The /talk/<slug> landing pages (CC 5): the pure half. What the page says
 * is derived from the species' field guide as the static build has it (the
 * species overlay and the DB-only snapshot, `getPublishedSpeciesForContent`)
 * and nothing else: the opening line, the one sample exchange, the three
 * suggested questions and the FAQ are each a field-guide field, quoted, with
 * the field named. No fact on these pages is written here. Pure, so it is
 * tested over the whole snapshot list.
 */

import {TALK_WORDS_EN, talkAnimalTitle} from "@/lib/ask-animaldex/talk";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";

/** The catalogue field guide as the snapshots carry it (`databaseSource.fieldGuide`). */
export type TalkLandingFieldGuide = {
    dietSummary: string | null;
    predatorsSummary: string | null;
    sleepPattern: string | null;
    lifespanEstimate: string | null;
    femaleOffspringNotes: string | null;
    sexDifferenceNotes: string | null;
};

/** Everything the page derives its words from: the species page's field guide, as built. */
export type TalkLandingFacts = {
    name: string;
    /**
     * The animal's own greeting, when the catalogue snapshot carries one. No
     * snapshot does today (2026-11-13: neither the overlay nor the page
     * snapshot has a greeting column), so the opening falls back to a fact.
     */
    greeting: string | null;
    summary: string;
    habitat: string;
    identification: string[];
    /** The species page's "behaviour" facts (authored, or the DB overlay's interesting facts). */
    behaviorTraits: string[];
    /** The species page's "why interesting" facts (authored entries only). */
    interestingFacts: string[];
    fieldGuide: TalkLandingFieldGuide | null;
    powerName: string | null;
};

/** Which field of the species' field guide a line was taken from. */
export type TalkLandingField =
    | "fieldGuide.dietSummary"
    | "fieldGuide.sleepPattern"
    | "fieldGuide.predatorsSummary"
    | "fieldGuide.lifespanEstimate"
    | "fieldGuide.femaleOffspringNotes"
    | "fieldGuide.sexDifferenceNotes"
    | "analysis.habitat"
    | "analysis.identification"
    | "premiumDetails.behaviorTraits"
    | "premiumDetails.whyInteresting"
    | "analysis.summary";

export type TalkLandingOpening =
    /** The animal's own greeting, in its words. */
    | {kind: "greeting"; text: string}
    /** No greeting in the data: the first field-guide fact, as a neutral intro (never as the animal speaking). */
    | {kind: "fact"; text: string; field: TalkLandingField};

/** One question and the field-guide text that answers it, verbatim. */
export type TalkLandingAnswer = {
    /** Addressed to the animal, as the chat is ("What do you eat?"): the Ask chip's prompt. */
    prompt: string;
    /** About the animal, for the visible FAQ and its JSON-LD ("What does the Cheetah eat?"). */
    question: string;
    /** A short label for the chip and the field caption ("Diet"). */
    topic: string;
    answer: string;
    field: TalkLandingField;
};

const PLACEHOLDER_COPY = [
    "indexed animaldex species",
    "habitat data is maintained",
    "live animaldex field guide",
    "scientific classification under review",
    "recognized in animaldex as",
    "indexed profile #"
];

/** A field-guide line worth quoting: real words, not the catalogue's placeholder copy. */
export function substantiveFieldText(value: string | null | undefined, min = 24): string | null {
    const text = value?.replace(/\s+/g, " ").trim() ?? "";
    if (text.length < min) return null;
    const lower = text.toLowerCase();
    return PLACEHOLDER_COPY.some((marker) => lower.includes(marker)) ? null : text;
}

type FieldSource = {field: TalkLandingField; topic: string; prompt: string; question: (name: string) => string; text: string | null};

/**
 * Every field the page may quote, in the order it prefers them: the
 * catalogue's field guide first (diet, waking hours, threats, lifespan,
 * young, sexes), then the species page's own habitat, identification and
 * facts. Only fields with substantive text are returned.
 */
export function talkLandingFieldSources(facts: TalkLandingFacts): Array<Omit<FieldSource, "text"> & {text: string}> {
    const guide = facts.fieldGuide;
    const the = `the ${facts.name}`;
    const sources: FieldSource[] = [
        {field: "fieldGuide.dietSummary", topic: "Diet", prompt: "What do you eat?", question: () => `What does ${the} eat?`, text: guide?.dietSummary ?? null},
        {field: "fieldGuide.sleepPattern", topic: "Waking hours", prompt: "When are you awake?", question: () => `When is ${the} awake?`, text: guide?.sleepPattern ?? null},
        {field: "fieldGuide.predatorsSummary", topic: "Threats", prompt: "What threatens you?", question: () => `What threatens ${the}?`, text: guide?.predatorsSummary ?? null},
        {field: "fieldGuide.lifespanEstimate", topic: "Lifespan", prompt: "How long do you live?", question: () => `How long does ${the} live?`, text: guide?.lifespanEstimate ?? null},
        {field: "fieldGuide.femaleOffspringNotes", topic: "Young", prompt: "How do you raise your young?", question: () => `How does ${the} raise its young?`, text: guide?.femaleOffspringNotes ?? null},
        {field: "fieldGuide.sexDifferenceNotes", topic: "Males and females", prompt: "How do males and females differ?", question: () => `How do male and female ${facts.name}s differ?`, text: guide?.sexDifferenceNotes ?? null},
        {field: "analysis.habitat", topic: "Habitat", prompt: "Where do you live?", question: () => `Where does ${the} live?`, text: facts.habitat},
        {field: "analysis.identification", topic: "Recognising it", prompt: "How would I recognise you?", question: () => `How do you recognise ${the}?`, text: facts.identification.length >= 2 ? facts.identification.map((item) => item.replace(/\.?\s*$/, "")).join(". ") + "." : null},
        {field: "premiumDetails.behaviorTraits", topic: "Behaviour", prompt: "What are you known for?", question: () => `What is ${the} known for?`, text: facts.behaviorTraits[0] ?? null},
        {field: "premiumDetails.whyInteresting", topic: "What makes it unusual", prompt: "What makes you unusual?", question: () => `What makes ${the} unusual?`, text: facts.interestingFacts[0] ?? null},
        {field: "premiumDetails.behaviorTraits", topic: "Habits", prompt: "How do you behave?", question: () => `How does ${the} behave?`, text: facts.behaviorTraits[1] ?? null},
        {field: "premiumDetails.whyInteresting", topic: "Worth knowing", prompt: "What else should I know about you?", question: () => `What else is worth knowing about ${the}?`, text: facts.interestingFacts[1] ?? null},
        {field: "analysis.summary", topic: "Overview", prompt: "Tell me about yourself.", question: () => `What kind of animal is ${the}?`, text: facts.summary}
    ];
    return sources.flatMap((source) => {
        const text = substantiveFieldText(source.text);
        return text ? [{...source, text}] : [];
    });
}

/**
 * The page's opening line. The animal's greeting when the data has one; else
 * the first field-guide fact, shown as a neutral intro ("From the field
 * guide"), because the facts are written about the animal, not by it, and
 * rewriting them in the first person would put words in its mouth.
 */
export function talkLandingOpening(facts: TalkLandingFacts): TalkLandingOpening {
    const greeting = substantiveFieldText(facts.greeting, 8);
    if (greeting) return {kind: "greeting", text: greeting};
    const fact = substantiveFieldText(facts.interestingFacts[0]);
    if (fact) return {kind: "fact", text: fact, field: "premiumDetails.whyInteresting"};
    const trait = substantiveFieldText(facts.behaviorTraits[0]);
    if (trait) return {kind: "fact", text: trait, field: "premiumDetails.behaviorTraits"};
    return {kind: "fact", text: substantiveFieldText(facts.summary) ?? facts.summary, field: "analysis.summary"};
}

/**
 * The one sample exchange and the three suggested questions: the first four
 * quotable fields, in order. The exchange is the first; the three questions
 * follow it, so no question repeats the exchange. Fewer than four fields
 * (a page with no catalogue field guide and little else) gives fewer
 * questions, and then no FAQ. The line the opening quotes is skipped.
 */
export function talkLandingAnswers(facts: TalkLandingFacts, opening: TalkLandingOpening = talkLandingOpening(facts)): {exchange: TalkLandingAnswer | null; questions: TalkLandingAnswer[]} {
    // The opening already quotes one line: it is not asked again below.
    const sources = talkLandingFieldSources(facts).filter((source) => source.text !== opening.text).map((source) => ({
        prompt: source.prompt,
        question: source.question(facts.name),
        topic: source.topic,
        answer: source.text,
        field: source.field
    }));
    const [exchange = null, ...rest] = sources;
    return {exchange, questions: rest.slice(0, 3)};
}

/** The field-guide fields proper: the catalogue's own columns. */
const CATALOGUE_FIELDS = new Set<TalkLandingField>([
    "fieldGuide.dietSummary",
    "fieldGuide.sleepPattern",
    "fieldGuide.predatorsSummary",
    "fieldGuide.lifespanEstimate",
    "fieldGuide.femaleOffspringNotes",
    "fieldGuide.sexDifferenceNotes"
]);

/**
 * FAQ structured data only where the three questions each have a real answer
 * from the catalogue's field guide; a page whose questions lean on its own
 * summary or habitat line claims no FAQ.
 */
export function talkLandingFaq(questions: TalkLandingAnswer[]): Array<{question: string; answer: string}> | null {
    if (questions.length < 3) return null;
    if (!questions.every((item) => CATALOGUE_FIELDS.has(item.field))) return null;
    return questions.map((item) => ({question: item.question, answer: item.answer}));
}

/** "Talk to a Cheetah", "Talk to an Ostrich": the H1, the article by the name's first sound. */
export function talkLandingHeading(name: string): string {
    return talkAnimalTitle(name, TALK_WORDS_EN);
}

/** "Talk to a Cheetah (AI): Ask It Anything". */
export function talkLandingTitle(name: string): string {
    return `${talkLandingHeading(name)} (AI): Ask It Anything`;
}

export const TALK_LANDING_DESCRIPTION_MAX = 155;

/**
 * The meta description, under 155 characters: what the page offers and the
 * topics the field guide can actually answer, named from the fields it has.
 */
export function talkLandingDescription(facts: TalkLandingFacts): string {
    const fields = new Set(talkLandingFieldSources(facts).map((source) => source.field));
    const topics: string[] = [];
    if (fields.has("fieldGuide.dietSummary")) topics.push("what it eats");
    if (fields.has("analysis.habitat")) topics.push("where it lives");
    if (fields.has("fieldGuide.predatorsSummary")) topics.push("what it fears");
    if (fields.has("fieldGuide.lifespanEstimate")) topics.push("how long it lives");
    topics.push(facts.powerName ? "what it can teach you" : "how it lives");
    const heading = talkLandingHeading(facts.name).replace(/^Talk to /, "");
    const candidates = [
        `Talk to ${heading}, an AI that answers from its real field guide. Ask ${listWords(topics.slice(0, 3))}. Free, in your browser.`,
        `Talk to ${heading}, an AI that answers from its real field guide. Ask ${listWords(topics.slice(0, 2))}. Free.`,
        `Talk to ${heading}, an AI that answers from its field guide. Free, in your browser.`
    ];
    return candidates.find((text) => text.length <= TALK_LANDING_DESCRIPTION_MAX) ?? candidates[candidates.length - 1].slice(0, TALK_LANDING_DESCRIPTION_MAX);
}

function listWords(items: string[]): string {
    if (items.length <= 1) return items[0] ?? "";
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The landing's own English words. The page is English only (its facts are), so they are not in the locale files. */
export const TALK_LANDING_WORDS = {
    fromFieldGuide: "From the field guide",
    fieldGuideOf: "From the {animal} field guide",
    sampleExchange: "A sample exchange",
    sampleExchangeHint: "The reply below is the field guide's own line. In the chat, the {animal} answers in its own voice.",
    you: "You",
    questions: "Questions the {animal} can answer",
    openChat: "Open the full chat",
    readGuide: "Read the {animal} field guide",
    getApp: "Keep the {animal} with you",
    getAppHint: "In the app, your animals set you steps, keep your chats and bring other animals in to argue it out.",
    appStore: "App Store",
    googlePlay: "Google Play",
    backToTalk: "All animals",
    answersAsItself: "Answers as itself, from its own field guide."
} as const;

/**
 * Whether a visit to a landing slug wants the chat itself rather than the
 * landing (`TalkLandingSwitch`): a signed-in reader (the Supabase auth
 * cookie), their own card (`?card=`), a carried question (`?ask=`) or the
 * landing's own "Open the full chat" (`?chat=1`).
 */
export function talkLandingWantsChat(search: string, cookie: string): boolean {
    const params = new URLSearchParams(search);
    if (params.has("card") || params.has("ask") || params.get("chat") === "1") return true;
    return requestHasSupabaseAuthCookie(cookie);
}
