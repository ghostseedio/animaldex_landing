/**
 * Search-phrased meaning sections for a species page, built only from data the
 * page already has: the AnimalDex principle profile (catalog / local lessons)
 * and the systems-intelligence entry (body "hardware" + the strategy people can
 * borrow). Each section is also returned as an FAQ pair for the page's
 * FAQPage JSON-LD.
 *
 * Intent split: /animal-lessons/<slug> owns "what can we learn from the X";
 * the species page owns meaning, symbolism, spirit animal, what it helps with,
 * the biological "why" and biomimicry, and dreams.
 */
import {commonNameInSentence} from "@/lib/animal-dream-reading";

export type MeaningSectionsInput = {
    name: string;
    principle: string;
    principleExpression?: string | null;
    coreLesson: string;
    motto?: string | null;
    biologicalBasis?: string | null;
    applicationExample?: string | null;
    bestFor: string[];
    /** From species-systems-intelligence, when the animal has one. */
    systems?: {roleTitle?: string; specializedHardware?: string; strategicInsight?: string} | null;
};

export type MeaningQuality = {name: string; slug: string};

export type AnimalMeaningSections = {
    symbolism: {question: string; answer: string};
    spiritAnimal: {question: string; answer: string};
    lifeAreas: {question: string; intro: string; qualities: string[]; example: string | null};
    biomimicry: {question: string; role: string | null; hardware: string; insight: string} | null;
    faq: Array<{question: string; answer: string}>;
};

function sentence(text: string) {
    const trimmed = text.trim();
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function lowerFirst(text: string) {
    return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Generated placeholder systems copy ("…a body plan tuned for its niche") is not biomimicry. */
function isTemplateSystemsText(text: string) {
    return /^[a-z]/.test(text.trim()) || /body plan tuned for its niche|links movement, shelter, feeding, and survival/i.test(text);
}

function list(items: string[]) {
    if (items.length <= 1) return items.join("");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function buildAnimalMeaningSections(input: MeaningSectionsInput): AnimalMeaningSections {
    const animal = commonNameInSentence(input.name);
    const the = `the ${animal}`;
    const qualities = input.bestFor.map((quality) => quality.trim()).filter(Boolean);
    const lowerQualities = qualities.map((quality) => quality.toLowerCase());
    const expression = input.principleExpression?.trim();

    const symbolismAnswer = [
        `${the.charAt(0).toUpperCase()}${the.slice(1)} symbolizes ${input.principle.toLowerCase()}${expression ? `: ${lowerFirst(sentence(expression))}` : "."}`,
        lowerQualities.length ? `It represents ${list(lowerQualities)}.` : "",
        input.motto ? `Its AnimalDex motto: "${input.motto.trim().replace(/[.!?]+$/, "")}."` : ""
    ].filter(Boolean).join(" ");

    const spiritAnswer = `If ${the} is your spirit animal, the AnimalDex reading is ${input.principle}: ${lowerFirst(sentence(input.coreLesson))}${lowerQualities.length ? ` It suggests a strength in ${list(lowerQualities.slice(0, 2))}, and a reminder to use it on purpose.` : ""}`;

    const lifeQuestion = `What can ${the} help you with in life?`;
    const lifeIntro = lowerQualities.length
        ? `${the.charAt(0).toUpperCase()}${the.slice(1)} is a guide for ${list(lowerQualities)}. Its lesson applies wherever ${lowerQualities[0]} matters: ${lowerFirst(sentence(input.coreLesson))}`
        : sentence(input.coreLesson);

    const systems = input.systems;
    const hasRealSystems = Boolean(systems?.specializedHardware && systems.strategicInsight)
        && !isTemplateSystemsText(systems!.specializedHardware!);
    const insightRepeatsLesson = hasRealSystems && normalize(systems!.strategicInsight!).startsWith(normalize(input.coreLesson).slice(0, 60));
    const biomimicry = hasRealSystems ? {
        question: `What can humans learn from the ${animal}'s biology?`,
        role: systems!.roleTitle?.trim() || null,
        hardware: sentence(systems!.specializedHardware!),
        // When the core lesson already is this insight, say it once (in the lesson).
        insight: insightRepeatsLesson ? "" : sentence(systems!.strategicInsight!)
    } : null;
    const basis = input.biologicalBasis?.trim();
    const basisUsable = basis && !isTemplateSystemsText(basis)
        && !(biomimicry && normalize(basis).startsWith(normalize(biomimicry.hardware).slice(0, 60)));

    const faq = [
        {question: `What does ${the} symbolize?`, answer: symbolismAnswer},
        {question: `What does it mean if ${the} is your spirit animal?`, answer: spiritAnswer},
        {question: lifeQuestion, answer: `${lifeIntro}${input.applicationExample ? ` For example: ${lowerFirst(sentence(input.applicationExample))}` : ""}`},
        ...(biomimicry ? [{question: biomimicry.question, answer: `${biomimicry.hardware} ${biomimicry.insight}`.trim()}] : []),
        ...(basisUsable ? [{question: `Why does ${the} represent ${input.principle.toLowerCase()}?`, answer: sentence(basis!)}] : [])
    ];

    return {
        symbolism: {question: `What does ${the} symbolize?`, answer: symbolismAnswer},
        spiritAnimal: {question: `${the.charAt(0).toUpperCase()}${the.slice(1)} as a spirit animal`, answer: spiritAnswer},
        lifeAreas: {question: lifeQuestion, intro: lifeIntro, qualities, example: input.applicationExample?.trim() || null},
        biomimicry,
        faq
    };
}
