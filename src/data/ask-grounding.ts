import "server-only";

/**
 * Assembles the grounding packet Ask AnimalDex answers from.
 *
 * On iOS the app already holds the capture, its Animal Power profile and its
 * System Dynamics in memory, and posts them to the edge function. The web has
 * no such client state, so the same packet is assembled server-side from the
 * same rows: `species_catalog_v1` + field guide, `species_animal_power_profiles`
 * and `species_system_dynamics`.
 *
 * Nothing here is taken from the request body except the slug and the question.
 * A client that claims a different Power for a species would otherwise be
 * grounding the model in content AnimalDex never wrote.
 */

import {getEnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {getSpeciesDietContent} from "@/data/species-diet";
import {getSpeciesSpottingContent} from "@/data/species-spotting";
import {getSpeciesSystemDynamics} from "@/data/species-system-dynamics";
import {getLocationsFeaturingSpecies} from "@/data/species-ask-grounding";
import {getRelatedSpecies, getSpeciesBySlug, speciesEntries, type SpeciesEntry} from "@/data/species";
import {resolveSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import {
    behaviorDisplayTitle,
    domainDisplayTitle,
    frequencyCompactLabel,
    mechanismLabel,
    modeStateName,
    resolveVisualSignature,
    type SpeciesSystemDynamics
} from "@/lib/system-dynamics";
import type {
    AskAnimalPower,
    AskGroundingPacket,
    AskSpeciesGrounding,
    AskSystemDynamics
} from "@/lib/ask-animaldex/grounding";
import {EMPTY_ASK_HINTS, type AskHints, type AskSubject} from "@/lib/ask-animaldex/subject";

function text(value: string | null | undefined): string | null {
    const trimmed = value?.replace(/\s+/g, " ").trim();
    return trimmed ? trimmed : null;
}

function askSystemDynamics(dynamics: SpeciesSystemDynamics): AskSystemDynamics {
    const signature = resolveVisualSignature(dynamics);
    return {
        archetypeName: mechanismLabel(dynamics),
        mechanism: text(dynamics.signatureExplanation),
        frequency: {
            primary: frequencyCompactLabel(signature.primaryFrequency),
            behavior: behaviorDisplayTitle(dynamics.frequencyProfile.behavior),
            modes: dynamics.frequencyProfile.modes.map((mode) => ({
                name: modeStateName(mode),
                frequency: mode.frequency === "UNKNOWN" ? null : frequencyCompactLabel(mode.frequency)
            }))
        },
        crossDomain: dynamics.crossDomainMatrix.slice(0, 8).map((mapping) => ({
            domain: domainDisplayTitle(mapping.domain),
            entries: mapping.entries.slice(0, 3).map((entry) => ({
                equivalent: entry.equivalent,
                reasoning: entry.reasoning
            }))
        })),
        failureModes: dynamics.failureModes.slice(0, 6).map((mode) => ({
            title: mode.title,
            explanation: mode.explanation
        })),
        transition: signature.transition
            ? {
                fromState: signature.transition.sourceName,
                toState: signature.transition.destinationName,
                trigger: signature.transition.triggerName
            }
            : null
    };
}

function askAnimalPower(
    power: Awaited<ReturnType<typeof getEnhancedAnimalPowerProfile>>,
    fallback: Awaited<ReturnType<typeof resolveSpeciesBehaviorProfile>>
): AskAnimalPower | null {
    const principleName = text(power?.principleName) ?? text(fallback?.principle);
    if (!principleName) return null;

    return {
        principleName,
        principleExpression: text(power?.principleExpression) ?? text(fallback?.principleExpression),
        coreLesson: text(power?.coreLesson) ?? text(fallback?.coreLesson),
        shortMotto: text(power?.shortMotto) ?? text(fallback?.motto),
        corePattern: text(power?.corePattern),
        biologicalBasis: text(power?.biologicalBasis) ?? text(fallback?.biologicalBasis),
        applicationExample: text(power?.applicationExample),
        behavioralEvidence: (power?.behavioralEvidence ?? []).slice(0, 6),
        powerContinuum: power?.powerContinuum ?? null,
        embodimentPractices: (power?.embodimentPractices ?? []).slice(0, 4),
        reflectionQuestions: (power?.reflectionQuestions ?? []).slice(0, 6),
        relatedPowers: (power?.relatedPowers ?? []).slice(0, 6)
    };
}

function relatedSpeciesFor(slug: string) {
    return getRelatedSpecies(slug)
        .map((entry) => ({slug: entry.slug, name: entry.name}))
        .slice(0, 4);
}

/**
 * One species' full grounding.
 *
 * `withDynamics` exists because the general scope resolves several candidate
 * species and only the leading one earns a second round trip for its System
 * Dynamics row.
 */
export async function buildAskSpeciesGrounding(
    slug: string,
    options: {withDynamics?: boolean} = {}
): Promise<AskSpeciesGrounding | null> {
    const resolved = await getResolvedSpeciesBySlug(slug);
    if (!resolved) return null;

    const [power, principle] = await Promise.all([
        getEnhancedAnimalPowerProfile(resolved.speciesProfileId),
        resolveSpeciesBehaviorProfile(resolved.slug)
    ]);
    const dynamics = options.withDynamics === false
        ? null
        : await getSpeciesSystemDynamics(resolved.speciesProfileId);

    const spotting = getSpeciesSpottingContent(resolved);
    const diet = getSpeciesDietContent(resolved);
    const guide = resolved.databaseSource?.fieldGuide;

    return {
        slug: resolved.slug,
        name: resolved.name,
        scientificName: text(resolved.analysis.scientificName),
        category: text(resolved.analysis.category),
        summary: text(resolved.analysis.summary),
        identification: resolved.analysis.identification.slice(0, 8),
        habitat: text(resolved.analysis.habitat),
        nativeRange: text(resolved.analysis.nativeRange),
        diet: text(guide?.dietSummary) ?? text(diet.summary),
        predators: text(guide?.predatorsSummary),
        sleepPattern: text(guide?.sleepPattern),
        lifespan: text(guide?.lifespanEstimate),
        reproduction: text(guide?.femaleOffspringNotes),
        sexDifference: text(guide?.sexDifferenceNotes),
        interestingFacts: resolved.premiumDetails.whyInteresting.slice(0, 8),
        behaviorTraits: resolved.premiumDetails.behaviorTraits.slice(0, 8),
        spottingTips: spotting.tips.slice(0, 4),
        power: askAnimalPower(power, principle),
        systemDynamics: dynamics ? askSystemDynamics(dynamics) : null,
        relatedSpecies: relatedSpeciesFor(resolved.slug),
        relatedLocations: getLocationsFeaturingSpecies(resolved.slug)
    };
}

/** Suggestion and waiting-line material, derived from the same grounding. */
export function buildAskHints(species: AskSpeciesGrounding | null): AskHints {
    if (!species) return EMPTY_ASK_HINTS;
    const dynamics = species.systemDynamics;
    return {
        animalName: species.name,
        principleName: species.power?.principleName ?? null,
        archetypeName: dynamics?.archetypeName ?? null,
        domains: dynamics?.crossDomain.map((mapping) => mapping.domain) ?? [],
        failureModes: dynamics?.failureModes.map((mode) => mode.title) ?? [],
        transition: dynamics?.transition
            ? {
                // The signature's own kind is not carried in the packet, so a
                // named trigger is what separates "this switches when X" from
                // "this changes phase": the first is a trigger, the second is
                // a one-way development.
                kind: dynamics.transition.trigger ? "trigger" : "phaseChange",
                from: dynamics.transition.fromState,
                to: dynamics.transition.toState,
                fromFrequency: dynamics.frequency.modes[0]?.frequency ?? null,
                toFrequency: dynamics.frequency.modes[1]?.frequency ?? null
            }
            : null,
        frequencyBehavior: dynamics ? dynamics.frequency.behavior.toLowerCase() : null,
        primaryFrequency: dynamics?.frequency.primary ?? null,
        hasDynamics: Boolean(dynamics)
    };
}

// MARK: - Candidate matching for the general scope

function singularize(word: string): string {
    if (word.length <= 3) return word;
    if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
    if (word.endsWith("ves")) return `${word.slice(0, -3)}f`;
    if (/(s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
    if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
    return word;
}

function questionWordSet(question: string): Set<string> {
    const words = question
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((word) => word.length > 2);
    const set = new Set<string>();
    for (const word of words) {
        set.add(word);
        set.add(singularize(word));
    }
    return set;
}

/**
 * Which species this question is about, matched against the local catalogue.
 *
 * Name-word overlap rather than substring search, so "grey wolves" finds the
 * Grey Wolf and "wolf spider" does not quietly answer about a wolf. Entirely
 * local: a question that names no animal must not cost a database round trip.
 */
export function matchAskCandidateSpecies(question: string, limit = 3): SpeciesEntry[] {
    const lowered = question.toLowerCase();
    const words = questionWordSet(question);

    const scored = speciesEntries.flatMap((entry) => {
        const name = entry.name.toLowerCase();
        if (lowered.includes(name)) return [{entry, score: name.length + 40}];

        const nameWords = name.split(/[^a-z]+/).filter((word) => word.length > 3).map(singularize);
        if (nameWords.length > 0 && nameWords.every((word) => words.has(word))) {
            return [{entry, score: nameWords.join("").length + 20}];
        }

        const scientific = entry.analysis.scientificName?.toLowerCase();
        if (scientific && scientific.length > 6 && lowered.includes(scientific)) {
            return [{entry, score: scientific.length}];
        }

        const intent = entry.searchIntents.find((candidate) => {
            const value = candidate.toLowerCase();
            return value.length > 8 && lowered.includes(value);
        });
        if (intent) return [{entry, score: intent.length / 2}];

        return [];
    });

    return scored
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map((item) => item.entry);
}

/**
 * Everything the model is given for one question.
 *
 * The species scope is the iOS shape: one animal, all of its content. The
 * general scope resolves what the question names — the leading candidate with
 * its System Dynamics, the others as field-guide rows — so a reader who asks
 * about an animal from the home page gets a grounded answer rather than the
 * model's own recollection of that species.
 */
export async function buildAskPacket(params: {
    subject: AskSubject;
    question: string;
}): Promise<AskGroundingPacket> {
    const {subject, question} = params;

    if (subject.scope === "species" && subject.slug) {
        const species = await buildAskSpeciesGrounding(subject.slug);
        if (species) {
            return {
                scope: "species",
                species,
                candidateSpecies: [],
                pageContext: {
                    path: subject.path,
                    title: subject.title ?? species.name,
                    kind: subject.kind,
                    summary: subject.summary
                },
                hasReaderPhoto: subject.hasReaderPhoto
            };
        }
    }

    const candidateSlugs = matchAskCandidateSpecies(question).map((entry) => entry.slug);
    // A general question asked on a species page still has that animal as its
    // most likely subject, so it leads the candidate list.
    const slugs = Array.from(new Set([
        ...(subject.slug ? [subject.slug] : []),
        ...candidateSlugs
    ])).slice(0, 3);

    const candidates = (await Promise.all(
        slugs.map((slug, index) => buildAskSpeciesGrounding(slug, {withDynamics: index === 0}))
    )).filter((entry): entry is AskSpeciesGrounding => entry !== null);

    return {
        scope: "general",
        species: null,
        candidateSpecies: candidates,
        pageContext: {
            path: subject.path,
            title: subject.title,
            kind: subject.kind,
            summary: subject.summary
        },
        hasReaderPhoto: subject.hasReaderPhoto
    };
}

/** The static catalogue row for a slug, without a database round trip. */
export function askCatalogEntry(slug: string) {
    return getSpeciesBySlug(slug);
}
