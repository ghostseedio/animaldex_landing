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
    };
    crossDomain: Array<{
        domain: string;
        entries: Array<{equivalent: string; reasoning: string}>;
    }>;
    failureModes: Array<{title: string; explanation: string}>;
    transition: {fromState: string; toState: string; trigger: string | null} | null;
};

export type AskSpeciesGrounding = {
    slug: string;
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
};

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

export function buildAskUserPrompt(params: {
    userQuestion: string;
    packet: AskGroundingPacket;
    conversationHistory?: AskConversationTurn[];
}): string {
    const {packet} = params;
    const history = (params.conversationHistory ?? [])
        .map((turn) => ({role: turn.role, content: String(turn.content ?? "").trim()}))
        .filter((turn) => turn.content.length > 0)
        .slice(-8);

    const pageLine = packet.pageContext
        ? `page_context:\n${JSON.stringify({
            kind: packet.pageContext.kind,
            path: packet.pageContext.path,
            title: packet.pageContext.title,
            summary: clean(packet.pageContext.summary, 400)
        })}`
        : "";

    const historyLine = history.length > 0 ? `recent_conversation:\n${JSON.stringify(history)}` : "";

    if (packet.scope === "species" && packet.species) {
        const species = packet.species;
        const contentIndex = buildAskContentIndex(species);
        return [
            `animal_name: ${species.name}`,
            `user_question: ${params.userQuestion}`,
            "",
            species.power
                ? `canonical_animal_power_profile:\n${JSON.stringify(species.power)}`
                : "canonical_animal_power_profile: not_available",
            "",
            `field_guide_context:\n${JSON.stringify(fieldGuideContext(species))}`,
            species.systemDynamics
                ? `system_dynamics:\n${JSON.stringify(species.systemDynamics)}`
                : "system_dynamics: not_available",
            contentIndex.length > 0
                ? `available_content — everything AnimalDex holds on this animal, for your follow-up offers:\n${contentIndex.join("\n")}`
                : "available_content: none",
            packet.hasReaderPhoto
                ? "reader_photo: the reader has their own photo of this animal on screen"
                : "reader_photo: none",
            packet.wildProfile
                ? packet.wildProfile.summary
                    ? `wild_profile_summary:\n${packet.wildProfile.summary}`
                    : "wild_profile_summary: not_set"
                : "",
            pageLine,
            historyLine,
            "",
            "Answer the reader's latest question in conversation.",
            "Prefer system_dynamics wording for states, triggers, failure modes and cross-domain equivalents when the question touches them.",
            "Base your follow-up offers on available_content, naming real destinations from it that this answer did not cover.",
            "Keep principle_name and core_pattern stable across follow-ups.",
            "Use recent_conversation for pronouns and follow-up context, but never replace canonical animal grounding.",
            packet.wildProfile
                ? "If the question asks for personal life application and wild_profile_summary is not_set, explain briefly that setting up Wild Profile helps AnimalDex tailor application — then still offer a general pattern-based answer."
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
        contentIndex.length > 0
            ? `available_content — what AnimalDex holds on those species, for your follow-up offers:\n${contentIndex.join("\n")}`
            : "available_content: none",
        pageLine,
        historyLine,
        "",
        "Answer the reader's latest question in conversation.",
        "Answer from candidate_species first; name only species that appear there.",
        "Base your follow-up offers on available_content, naming real destinations from it that this answer did not cover.",
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
