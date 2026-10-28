/**
 * The grounding packet handed to the model, and the user-prompt that frames it.
 *
 * Ported from `buildAnimalPowerAssistantUserPrompt` and
 * `buildAnimalPowerContentIndex` in the iOS backend. The shapes are the web's
 * own (they come from `@/lib/system-dynamics` and `@/data/species-animal-power`
 * rather than from Swift DTOs), but what the model is told, and in what order,
 * is the same.
 *
 * Pure on purpose: no `server-only`, no fetching. The fetching lives in
 * `@/data/ask-grounding`, so the prompt shape can be tested without a network.
 */

import type {AskConversationTurn, AskScope} from "@/lib/ask-animaldex/prompt";
import {askMemorySection, type AskMemoryFact} from "@/lib/ask-animaldex/memory-prompt";
import {
    ANIMAL_AUTO_CLOSING_INSTRUCTION,
    ANIMAL_CHAT_CLOSING_INSTRUCTION,
    type AskConversationMode
} from "@/lib/ask-animaldex/companion";
import type {AskPersonaStats} from "@/lib/ask-animaldex/persona";
import {REFERRAL_OPENING_RULES} from "@/lib/ask-animaldex/companion-focus";

export type AskPowerEvidence = {
    title: string;
    observation: string;
    biologicalFunction: string;
    interpretation: string;
};

export type AskPowerPractice = {
    title: string;
    instruction: string;
    animalConnection: string;
    timeframe: string | null;
};

export type AskAnimalPower = {
    principleName: string;
    principleExpression: string | null;
    coreLesson: string | null;
    shortMotto: string | null;
    corePattern: string | null;
    biologicalBasis: string | null;
    applicationExample: string | null;
    behavioralEvidence: AskPowerEvidence[];
    powerContinuum: {
        deficientExpression: string;
        balancedExpression: string;
        excessExpression: string;
    } | null;
    embodimentPractices: AskPowerPractice[];
    reflectionQuestions: string[];
    relatedPowers: string[];
};

/**
 * The System Dynamics content, flattened to what the model needs.
 *
 * The web's `SpeciesSystemDynamics` carries waveform geometry the model cannot
 * use and would only be tempted to quote numbers from, so it is left out.
 */
export type AskSystemDynamics = {
    archetypeName: string;
    mechanism: string | null;
    frequency: {
        primary: string;
        behavior: string;
        modes: Array<{name: string; frequency: string | null}>;
        /** LOW / MID / HIGH the system idles at, when the record says. */
        baseline?: string | null;
        /** LOW / MID / HIGH it jumps to when triggered, when the record says. */
        triggered?: string | null;
    };
    crossDomain: Array<{
        domain: string;
        entries: Array<{equivalent: string; reasoning: string}>;
    }>;
    failureModes: Array<{title: string; explanation: string}>;
    transition: {fromState: string; toState: string; trigger: string | null} | null;
};

/** One of the animal's Trials, as the apps' record carries it (`species_trials`, ready). */
export type AskAnimalTrial = {
    frequency: string;
    title: string;
    objective: string;
    instructions: string;
    animal_rule: string;
    mechanism_connection: string;
};

export type AskSpeciesGrounding = {
    slug: string;
    /**
     * The animal's Trials and the curated qualities its Power is best for,
     * when the route has read them (`@/data/ask-animal-record`): part of its
     * record, as in the apps.
     */
    trials?: AskAnimalTrial[];
    qualities?: string[];
    /** The field guide's best time of day, for when the animal is awake (`nature.ts`). */
    bestTimeOfDay?: string | null;
    /** The catalogue's species row, when the species is in the database. */
    speciesProfileId?: string | null;
    name: string;
    scientificName: string | null;
    category: string | null;
    summary: string | null;
    identification: string[];
    habitat: string | null;
    nativeRange: string | null;
    diet: string | null;
    predators: string | null;
    sleepPattern: string | null;
    lifespan: string | null;
    reproduction: string | null;
    sexDifference: string | null;
    interestingFacts: string[];
    behaviorTraits: string[];
    spottingTips: string[];
    power: AskAnimalPower | null;
    systemDynamics: AskSystemDynamics | null;
    relatedSpecies: Array<{slug: string; name: string}>;
    relatedLocations: Array<{slug: string; name: string}>;
};

/**
 * What one capture's own analysis says about its animal: the field guide
 * written for that sighting, which is what the card shows when the catalogue
 * has nothing of its own.
 */
export type AskCaptureGrounding = {
    name: string;
    scientificName: string | null;
    summary: string | null;
    identification: string[];
    habitat: string | null;
    diet: string | null;
    predators: string | null;
    sleepPattern: string | null;
    lifespan: string | null;
    sexDifference: string | null;
    interestingFacts: string[];
    power: AskAnimalPower | null;
};

/**
 * One animal's grounding for a reader who is looking at their own capture of
 * it.
 *
 * The catalogue leads, because it is the content AnimalDex wrote and reviewed
 * for the species. The capture fills what the catalogue leaves empty — and
 * when the catalogue has no such species at all, the capture stands alone, so
 * a question asked on that card is still answered about that animal instead of
 * falling back to a general search.
 */
export function mergeCaptureGrounding(
    species: AskSpeciesGrounding | null,
    capture: AskCaptureGrounding | null,
    fallbackSlug: string
): AskSpeciesGrounding | null {
    if (!capture) return species;

    if (!species) {
        return {
            slug: fallbackSlug,
            name: capture.name,
            scientificName: capture.scientificName,
            category: null,
            summary: capture.summary,
            identification: capture.identification,
            habitat: capture.habitat,
            nativeRange: null,
            diet: capture.diet,
            predators: capture.predators,
            sleepPattern: capture.sleepPattern,
            lifespan: capture.lifespan,
            reproduction: null,
            sexDifference: capture.sexDifference,
            interestingFacts: capture.interestingFacts,
            behaviorTraits: [],
            spottingTips: [],
            power: capture.power,
            systemDynamics: null,
            relatedSpecies: [],
            relatedLocations: []
        };
    }

    return {
        ...species,
        scientificName: species.scientificName ?? capture.scientificName,
        summary: species.summary ?? capture.summary,
        identification: species.identification.length ? species.identification : capture.identification,
        habitat: species.habitat ?? capture.habitat,
        diet: species.diet ?? capture.diet,
        predators: species.predators ?? capture.predators,
        sleepPattern: species.sleepPattern ?? capture.sleepPattern,
        lifespan: species.lifespan ?? capture.lifespan,
        sexDifference: species.sexDifference ?? capture.sexDifference,
        interestingFacts: species.interestingFacts.length ? species.interestingFacts : capture.interestingFacts,
        power: species.power ?? capture.power
    };
}

/** What the reader is looking at, so pronouns resolve before a subject is assumed. */
export type AskPageContext = {
    /** Route path, without locale prefix. */
    path: string;
    /** Human title of the page, when the surface knows it. */
    title: string | null;
    /** What kind of surface this is: species, comparison, location, article, collection, app. */
    kind: string;
    /** A short description of what is on the page, for article and location surfaces. */
    summary: string | null;
};

export type AskGroundingPacket = {
    scope: AskScope;
    /** The one animal the page is about, in `species` scope. */
    species: AskSpeciesGrounding | null;
    /** What AnimalDex holds that matches the question, in `general` scope. */
    candidateSpecies: AskSpeciesGrounding[];
    pageContext: AskPageContext | null;
    /** The reader's own photo of this animal exists, so the photo medium is offered. */
    hasReaderPhoto: boolean;
    /**
     * Present for a signed-in reader only, with a null summary when they have no
     * Wild Profile. Absent for a signed-out one, who cannot have a profile and
     * is not told to go and make one.
     */
    wildProfile?: {summary: string | null};
    /**
     * What the animals remember about a signed-in reader from earlier
     * conversations, on any surface. Only read in `species` scope, where the
     * animal itself is speaking.
     */
    memory?: AskMemoryFact[];
    /**
     * The canonical species the animal speaking is, so facts told to it are
     * listed first and read as "told to you".
     */
    memorySpeciesProfileId?: string | null;
    /**
     * Species scope only: automatic, as in the apps since 2026-10-28 (a Trial
     * thread is training); absent keeps the original advice-led closing
     * instruction.
     */
    mode?: AskConversationMode;
    /** how_you_met — where and when the reader met this animal, from their card (`askHowYouMetLine`). */
    howYouMet?: string | null;
    /** right_now — the reader's clock against the animal's day and season (`askRightNowLine`). */
    rightNow?: string | null;
    /** your_own_life — the stories it has told (`askOwnLifePromptSection`). */
    ownLife?: string | null;
    /** This reply's length and whether a story is welcome, last in the reader's part. */
    thisReply?: string[] | null;
    /** The most words this animal puts in a hello (`shortWordsFor`); 45 when absent. */
    shortWords?: number | null;
    /** The owner's chat: something they asked this animal to check back on. */
    invitedFollowUp?: {topic: string; invitedAt: string | null} | null;
    /** The owner's chat: who visited this animal on their card, not yet passed on. */
    visitorNotes?: string | null;
    /** On someone else's card: what the animal may say about its owner (`animal_chat_owner_context`). */
    ownerContext?: Record<string, unknown> | null;
    /**
     * Species scope: the five game stats from the species' canonical row,
     * when the catalogue has them. Part of the animal's record, as in the apps.
     */
    stats?: AskPersonaStats | null;
    /**
     * The Animal Trial the person is looking at. Set, the answer is about that
     * Trial — what it means, how to do it, an example — and the content index
     * is withheld so the offers cannot wander off it.
     */
    trialContext?: string | null;
    /**
     * The owner's own chat: what the two of them share so far (the bond's
     * stage and what counted), as the apps' `relationship` line.
     */
    relationship?: {stage: string; counted: Record<string, unknown>} | null;
    /**
     * The owner's own chat with the companion loop on: the loop as it stands
     * and their other animals (`companionPromptLines`).
     */
    companionLines?: string[] | null;
};

const TRIAL_GROUNDING_LEAD = "animal_trial — the person is looking at this Trial. Answer what it means, how to do it, and give concrete examples of this Trial. Do not replace it with a different task.";
const TRIAL_CLOSING_INSTRUCTION = "The question is about animal_trial. Explain what this Trial means, how to do it, and give a concrete example of this Trial. Use the animal's Power only to explain that Trial. Follow-ups stay on this Trial: its meaning, an example, how to start, or what the evidence should show. Do not offer System Dynamics, the field guide, or the Power as the next question.";
/** The species branch: the animal is the one being asked, and the one answering. */
const SPECIES_TRIAL_GROUNDING_LEAD = "animal_trial — the reader is looking at this Trial of yours. Explain what it means, how to do it, and give a concrete example. Do not replace it with a different task.";
const SPECIES_TRIAL_CLOSING_INSTRUCTION = "The message is about animal_trial. Explain what your Trial means, how to do it, and give a concrete example of it. Use your Power only to explain that Trial. Follow-ups stay on this Trial: its meaning, an example, how to start, or what the evidence should show.";

const SITE_CONTEXT = [
    "AnimalDex is an animal identification and collection app. A reader photographs an animal, the app identifies it, and",
    "the capture is added to their collection with a field guide, game stats and an Animal Power profile.",
    "Animal Power is AnimalDex's reading of one species' behaviour as a named operating pattern a person can borrow.",
    "System Dynamics is the same species' pattern written as a system: its operating states, what triggers a switch between",
    "them, where the same pattern appears in other domains, and the ways it fails.",
    "The website also holds species pages, head-to-head comparisons, location guides and articles."
].join(" ");

function clean(value: string | null | undefined, max = 600): string | null {
    const trimmed = value?.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function list(values: string[] | null | undefined, maxItems: number, itemMax = 240): string[] {
    return (values ?? [])
        .map((value) => clean(value, itemMax))
        .filter((value): value is string => Boolean(value))
        .slice(0, maxItems);
}

/**
 * An inventory of everything AnimalDex holds on this animal.
 *
 * The follow-up offers are the only navigation the thread has, so they have to
 * be a map of the animal's index rather than three generic prompts. This lists
 * what actually exists for THIS species — the domains it has been mapped into,
 * its named failure modes, its practices, its contrasts — so the offers can
 * name real destinations instead of inventing plausible ones.
 */
export function buildAskContentIndex(species: AskSpeciesGrounding): string[] {
    const lines: string[] = [];
    const add = (key: string, values: string[]) => {
        if (values.length === 0) return;
        lines.push(`- ${key} (${values.length}): ${values.slice(0, 14).join("; ")}`);
    };

    const power = species.power;
    if (power) {
        add("behavioral_evidence", power.behavioralEvidence.map((item) => item.title));
        add("embodiment_practices", power.embodimentPractices.map((item) => item.title));
        add("related_powers", power.relatedPowers);
        if (power.powerContinuum) {
            lines.push("- power_continuum: has a too-little, balanced and too-much expression");
        }
        if (power.reflectionQuestions.length > 0) {
            lines.push(`- reflection_questions (${power.reflectionQuestions.length})`);
        }
    }

    const dynamics = species.systemDynamics;
    if (dynamics) {
        if (dynamics.mechanism) lines.push(`- system mechanism: ${dynamics.mechanism}`);
        add("operating_states", dynamics.frequency.modes.map((mode) => mode.name));
        add("cross_domain_mappings", dynamics.crossDomain.map((mapping) => mapping.domain));
        add("failure_modes", dynamics.failureModes.map((mode) => mode.title));
        if (dynamics.transition) {
            lines.push(`- state transition: ${dynamics.transition.fromState} -> ${dynamics.transition.toState}`);
        }
    }

    const trials = species.trials ?? [];
    if (trials.length > 0) lines.push(`- trials (${trials.length}): ${trials.map((trial) => `${trial.frequency} ${trial.title}`.trim()).join("; ")}`);
    const qualities = species.qualities ?? [];
    if (qualities.length > 0) lines.push(`- qualities (${qualities.length}): ${qualities.join("; ")}`);

    add("related_species_pages", species.relatedSpecies.map((item) => item.name));
    add("location_guides", species.relatedLocations.map((item) => item.name));

    const fieldGuideSections = [
        species.diet ? "diet" : null,
        species.habitat ? "habitat" : null,
        species.predators ? "predators" : null,
        species.sleepPattern ? "sleep_pattern" : null,
        species.lifespan ? "lifespan" : null,
        species.reproduction ? "reproduction" : null,
        species.sexDifference ? "sex_differences" : null,
        species.interestingFacts.length > 0 ? "interesting_facts" : null,
        species.spottingTips.length > 0 ? "spotting_tips" : null
    ].filter((value): value is string => Boolean(value));
    add("field_guide_sections", fieldGuideSections);

    return lines;
}

/** The field-guide half of the packet, kept separate from the Power half. */
function fieldGuideContext(species: AskSpeciesGrounding) {
    return {
        scientific_name: species.scientificName,
        category: species.category,
        species_spotlight: clean(species.summary, 900),
        signature_traits: list(species.identification, 8, 160),
        behavior_traits: list(species.behaviorTraits, 8, 160),
        typical_habitat: clean(species.habitat, 400),
        native_range: clean(species.nativeRange, 300),
        diet_summary: clean(species.diet, 400),
        predators_summary: clean(species.predators, 300),
        sleep_pattern: clean(species.sleepPattern, 300),
        lifespan_estimate: clean(species.lifespan, 160),
        reproduction_notes: clean(species.reproduction, 300),
        sex_difference_notes: clean(species.sexDifference, 300),
        interesting_facts: list(species.interestingFacts, 8, 240),
        spotting_tips: list(species.spottingTips, 4, 200)
    };
}

/** The whole species row, compressed, for the general scope's candidate list. */
function candidateSummary(species: AskSpeciesGrounding) {
    return {
        name: species.name,
        slug: species.slug,
        scientific_name: species.scientificName,
        summary: clean(species.summary, 400),
        habitat: clean(species.habitat, 200),
        native_range: clean(species.nativeRange, 160),
        diet: clean(species.diet, 200),
        signature_traits: list(species.identification, 4, 120),
        interesting_facts: list(species.interestingFacts, 3, 200),
        animal_power: species.power
            ? {
                principle_name: species.power.principleName,
                core_pattern: clean(species.power.corePattern, 300),
                biological_basis: clean(species.power.biologicalBasis, 300)
            }
            : null,
        system_archetype: species.systemDynamics?.archetypeName ?? null
    };
}

/** The Power in the apps' record shape (snake_case), so the rules can name its fields. */
function recordPower(power: AskAnimalPower) {
    return {
        principle_name: power.principleName,
        principle_expression: power.principleExpression,
        core_lesson: power.coreLesson,
        short_motto: power.shortMotto,
        core_pattern: power.corePattern,
        biological_basis: power.biologicalBasis,
        application_example: power.applicationExample,
        behavioral_evidence: power.behavioralEvidence.map((item) => ({
            title: item.title,
            observation: item.observation,
            biological_function: item.biologicalFunction,
            interpretation: item.interpretation
        })),
        power_continuum: power.powerContinuum
            ? {
                deficient_expression: power.powerContinuum.deficientExpression,
                balanced_expression: power.powerContinuum.balancedExpression,
                excess_expression: power.powerContinuum.excessExpression
            }
            : null,
        embodiment_practices: power.embodimentPractices.map((item) => ({
            title: item.title,
            instruction: item.instruction,
            animal_connection: item.animalConnection,
            timeframe: item.timeframe
        })),
        reflection_questions: power.reflectionQuestions,
        related_powers: power.relatedPowers
    };
}

/** System Dynamics in the apps' record shape: modes, transition, cross_domain by domain_title, failure_modes. */
function recordDynamics(dynamics: AskSystemDynamics) {
    return {
        archetype_name: dynamics.archetypeName,
        mechanism: dynamics.mechanism,
        system_behavior: dynamics.frequency.behavior,
        primary_frequency: dynamics.frequency.primary,
        baseline_frequency: dynamics.frequency.baseline ?? null,
        triggered_frequency: dynamics.frequency.triggered ?? null,
        modes: dynamics.frequency.modes,
        transition: dynamics.transition
            ? {from_state: dynamics.transition.fromState, to_state: dynamics.transition.toState, trigger: dynamics.transition.trigger}
            : null,
        cross_domain: dynamics.crossDomain.map((mapping) => ({domain_title: mapping.domain, entries: mapping.entries})),
        failure_modes: dynamics.failureModes
    };
}

/**
 * The animal's whole record as one JSON object, shaped like the apps'
 * `animalRecordJSON`: power, field guide, System Dynamics, stats, Trials and
 * qualities. Trials and qualities are absent, not empty, when they were not
 * read.
 */
export function askAnimalRecordJSON(species: AskSpeciesGrounding, stats: AskPersonaStats | null = null): string {
    return JSON.stringify({
        power: species.power ? recordPower(species.power) : null,
        field_guide: fieldGuideContext(species),
        system_dynamics: species.systemDynamics ? recordDynamics(species.systemDynamics) : null,
        stats: stats ? {...stats, scale: "0-100, relative to every animal in AnimalDex"} : null,
        ...(species.trials ? {trials: species.trials} : {}),
        ...(species.qualities ? {qualities: species.qualities} : {})
    });
}

/**
 * The record as the model reads it: who it is, the whole record, and what it
 * can offer to go into next. Mirrors the apps' `animalRecordLines`; this is
 * the part of a species request that is identical turn after turn, so it goes
 * at the END of the system prompt, where a provider can cache it. In a Trial
 * thread the index is withheld on purpose: the offers must stay on the Trial,
 * and an index is an invitation to leave it.
 */
export function askAnimalRecordLines(
    species: AskSpeciesGrounding,
    options: {stats?: AskPersonaStats | null; withIndex?: boolean} = {}
): string[] {
    const contentIndex = options.withIndex === false ? null : buildAskContentIndex(species);
    return [
        `animal_name: ${species.name}`,
        ...(species.scientificName ? [`scientific_name: ${species.scientificName}`] : []),
        "animal_record — everything AnimalDex holds on you; fixed truth about yourself:",
        askAnimalRecordJSON(species, options.stats ?? null),
        ...(contentIndex === null
            ? []
            : [contentIndex.length > 0
                ? `available_content — what you can offer to go into next, for your follow-up offers:\n${contentIndex.join("\n")}`
                : "available_content: none"])
    ];
}

type AskSpeciesPromptParams = {
    packet: AskGroundingPacket;
    /** The record already sits at the end of the system prompt. */
    recordInSystem?: boolean;
};

/**
 * Everything about the reader and this moment: the parts of a species turn
 * that change, so they go after the cached system prompt. The apps'
 * `contextLines`, with the website's own reader_photo and page_context.
 */
function speciesContextLines(params: AskSpeciesPromptParams & {pageLine: string}): string[] {
    const {packet} = params;
    const species = packet.species as AskSpeciesGrounding;
    const trialContext = packet.trialContext?.trim() || null;
    const contentIndex = trialContext ? [] : buildAskContentIndex(species);
    return [
        ...(params.recordInSystem
            ? []
            : [
                "animal_record — everything AnimalDex holds on you; fixed truth about yourself:",
                askAnimalRecordJSON(species, packet.stats ?? null),
                ""
            ]),
        packet.howYouMet
            ? `how_you_met — ${packet.ownerContext ? "how your owner found you" : "when and where they found you"}:\n${packet.howYouMet}`
            : "",
        packet.rightNow ?? "",
        packet.ownLife ?? "",
        ...(packet.thisReply ?? []),
        params.recordInSystem || trialContext
            ? ""
            : contentIndex.length > 0
                ? `available_content — what you can offer to go into next, for your follow-up offers:\n${contentIndex.join("\n")}`
                : "available_content: none",
        packet.hasReaderPhoto
            ? "reader_photo: the reader has their own photo of you on screen"
            : "reader_photo: none",
        // A signed-out reader cannot have a Wild Profile or a memory, and is
        // not told to go and make one.
        packet.wildProfile
            ? packet.wildProfile.summary
                ? `wild_profile_summary — the person's own AnimalDex profile, for tailoring your advice:\n${packet.wildProfile.summary}`
                : "wild_profile_summary: not_set"
            : "",
        packet.wildProfile ? askMemorySection(packet.memory ?? [], packet.memorySpeciesProfileId ?? null) : "",
        packet.relationship
            ? `relationship — what you and this person share so far: ${JSON.stringify(packet.relationship)}`
            : "",
        packet.invitedFollowUp
            ? `invited_follow_up — they asked you to check back on this (${packet.invitedFollowUp.invitedAt ?? "earlier"}): ${JSON.stringify(packet.invitedFollowUp.topic)}`
            : "",
        packet.visitorNotes ?? "",
        packet.ownerContext
            ? `speaking_to: visitor\nyour_owner — the person who captured you; everything you know about them, and all you may say:\n${JSON.stringify(packet.ownerContext)}`
            : "",
        ...(packet.companionLines ?? []),
        trialContext ? `${SPECIES_TRIAL_GROUNDING_LEAD}\n${trialContext}` : "",
        params.pageLine
    ];
}

function pageContextLine(packet: AskGroundingPacket): string {
    return packet.pageContext
        ? `page_context:\n${JSON.stringify({
            kind: packet.pageContext.kind,
            path: packet.pageContext.path,
            title: packet.pageContext.title,
            summary: clean(packet.pageContext.summary, 400)
        })}`
        : "";
}

/**
 * The first thing the animal says, before the person has said anything.
 * Verbatim from the apps' `ANIMAL_GREETING_RULES`: one to three sentences, as
 * short as this animal's hello is (`{words}`, from `shortWordsFor`).
 */
export const ANIMAL_GREETING_RULES = [
    "greeting_request — the person has just opened a conversation with you. Nobody has said anything yet. Speak first.",
    "- One to three short sentences, under {words} words. Say hello the way only you would — your rhythm, your world, your",
    "  temperament. This first line is how they will know you are not any other animal.",
    "- If you have not met (relationship is missing or 'met', and nothing in what_you_remember_about_them was told to",
    "  you): introduce yourself in one line only you could say, with what your lesson is in your own words, then ask",
    "  them one thing about their life in the spirit of the kind of question you ask.",
    "- If you know them (a later relationship stage, or things they told you): greet them like you know them. Pick up",
    "  one remembered thing that matters — or invited_follow_up, if present — lightly. Never 'I missed you', never how",
    "  long it has been.",
    "- If how_you_met is given, you may say where they found you, in a few words.",
    "- To a visitor: say whose you are (your owner's name from your_owner) and invite them to ask about your time with",
    "  your owner, or about you. Never ask about the visitor's own life. Their 3 replies below: one about your owner,",
    "  one about you, one about your Power.",
    "- If animal_trial is given, greet them about that Trial.",
    "- No Training, Trial or battle offers, no cards, no drawings, no 'How can I help you today?', no list of what you",
    "  can do.",
    "- Then the follow-ups line, and 3 short replies the person might send back, each under 40 characters, written AS",
    "  THEM, to you: one answering what you asked, one asking about you, one bringing something of theirs ('I need help",
    "  with a decision')."
];

/**
 * A hello is short, and how short is the animal's: about half its usual reply
 * length, between 15 and 45 words. A whale says less than a sparrow. The
 * apps' `shortWordsFor`.
 */
export function shortWordsFor(wordBudget: number): number {
    return Math.max(15, Math.min(45, Math.round(wordBudget * 0.55)));
}

function withWords(rules: string[], shortWords: number | null | undefined): string[] {
    const words = Math.max(12, Math.round(shortWords ?? 45));
    return rules.map((line) => line.replace("{words}", String(words)));
}

/**
 * The greeting turn. Built for the same system prompt as the turns that
 * follow, so the greeting's request warms the cache the first real reply reads.
 */
export function buildAskGreetingUserPrompt(params: AskSpeciesPromptParams & {
    /** Another of their animals sent them here (companion.referral): it opens with the problem. */
    referral?: boolean;
}): string {
    const {packet} = params;
    if (packet.scope !== "species" || !packet.species) throw new Error("greeting_needs_species");
    return [
        ...(params.recordInSystem ? [] : [`animal_name: ${packet.species.name}`]),
        ...speciesContextLines({...params, pageLine: pageContextLine(packet)}),
        "",
        ...(params.referral ? REFERRAL_OPENING_RULES : withWords(ANIMAL_GREETING_RULES, packet.shortWords))
    ].filter(Boolean).join("\n");
}

export function buildAskUserPrompt(params: {
    userQuestion: string;
    packet: AskGroundingPacket;
    conversationHistory?: AskConversationTurn[];
    /** Species scope: the record already sits at the end of the system prompt. */
    recordInSystem?: boolean;
    /** Species scope: the history goes to the model as real turns; leave it out of this text. */
    historyAsTurns?: boolean;
}): string {
    const {packet} = params;
    const history = (params.conversationHistory ?? [])
        .map((turn) => ({role: turn.role, content: String(turn.content ?? "").trim()}))
        .filter((turn) => turn.content.length > 0)
        .slice(-8);

    const pageLine = pageContextLine(packet);

    const historyLine = history.length > 0 ? `recent_conversation:\n${JSON.stringify(history)}` : "";
    const trialContext = packet.trialContext?.trim() || null;
    const trialBlock = trialContext ? `${TRIAL_GROUNDING_LEAD}\n${trialContext}` : "";

    if (packet.scope === "species" && packet.species) {
        const species = packet.species;
        return [
            ...(params.recordInSystem
                ? []
                : [`animal_name: ${species.name}`, species.scientificName ? `scientific_name: ${species.scientificName}` : ""]),
            `user_message: ${params.userQuestion}`,
            "",
            ...speciesContextLines({packet, recordInSystem: params.recordInSystem, pageLine}),
            params.historyAsTurns ? "" : historyLine,
            "",
            "Answer the person's latest message, as yourself.",
            ...(trialContext
                ? [SPECIES_TRIAL_CLOSING_INSTRUCTION]
                : packet.mode === "auto"
                ? ANIMAL_AUTO_CLOSING_INSTRUCTION
                : packet.mode === "chat"
                ? ANIMAL_CHAT_CLOSING_INSTRUCTION
                : [
                    "Lead with what you would do and why your biology makes it the move. Prefer system_dynamics wording for states, triggers, failure modes and cross-domain equivalents when they come up.",
                    "If the message asks where your Power applies, how it translates to other areas or domains, or where else it shows up, answer from animal_record.system_dynamics.cross_domain — the domains by domain_title, their entries as what you do and why.",
                    "Base your follow-up offers on available_content, naming real things from it that this answer did not cover.",
                    "End with one short question offering the next step.",
                    "Keep your Power's name and pattern stable across the conversation."
                ]),
            "Use the earlier conversation for pronouns and context, but never let it replace animal_record.",
            packet.wildProfile
                ? "Only if they explicitly ask you to fit advice to them personally, wild_profile_summary is not_set, and you have not mentioned it earlier in this conversation: say once, in a few words, that their Wild Profile would let you tailor it — then answer anyway. Otherwise never bring the Wild Profile up."
                : ""
        ].filter(Boolean).join("\n");
    }

    const candidates = packet.candidateSpecies.slice(0, 4);
    const contentIndex = candidates.flatMap((species) => {
        const lines = buildAskContentIndex(species);
        return lines.length > 0 ? [`${species.name}:`, ...lines] : [];
    });

    return [
        `user_question: ${params.userQuestion}`,
        "",
        `site_context:\n${SITE_CONTEXT}`,
        candidates.length > 0
            ? `candidate_species — what AnimalDex holds that matches this question:\n${JSON.stringify(candidates.map(candidateSummary))}`
            : "candidate_species: none matched",
        trialContext
            ? ""
            : contentIndex.length > 0
                ? `available_content — what AnimalDex holds on those species, for your follow-up offers:\n${contentIndex.join("\n")}`
                : "available_content: none",
        trialBlock,
        pageLine,
        historyLine,
        "",
        "Answer the reader's latest question in conversation.",
        ...(trialContext
            ? [TRIAL_CLOSING_INSTRUCTION]
            : [
                "Answer from candidate_species first; name only species that appear there.",
                "Base your follow-up offers on available_content, naming real destinations from it that this answer did not cover."
            ]),
        "Use recent_conversation for pronouns and follow-up context, and page_context to resolve what 'this' refers to."
    ].filter(Boolean).join("\n");
}

/**
 * Trims a thread to the turns that are worth sending.
 *
 * Eight complete turns is what iOS sends, and it is the window the prompt's
 * "recent_conversation" rules were written against.
 */
export function askConversationHistory(
    messages: Array<{role: "user" | "assistant"; text: string; status?: string}>
): AskConversationTurn[] {
    return messages
        .filter((message) => (message.status ?? "complete") === "complete" && message.text.trim().length > 0)
        .slice(-8)
        .map((message) => ({role: message.role, content: message.text}));
}
