import "server-only";

import {getEnhancedAnimalPowerProfile} from "@/data/species-animal-power";
import {getSpeciesSpottingContent} from "@/data/species-spotting";
import {resolveSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {locationPages} from "@/data/locations";
import {getMergedChallengesForSpecies} from "@/data/species-comparisons";
import {getRelatedSpecies, getSpeciesBySlug, type SpeciesEntry} from "@/data/species";
import {getSpeciesDietContent} from "@/data/species-diet";
import type {SpeciesAskGrounding} from "@/lib/species-ask";

export function getLocationsFeaturingSpecies(slug: string, limit = 4) {
    return locationPages
        .filter((page) => page.animalsToSpot.some((animal) => animal.speciesSlug === slug))
        .slice(0, limit)
        .map((page) => ({slug: page.slug, name: page.name}));
}

export async function buildSpeciesAskGrounding(
    slug: string,
    entry?: SpeciesEntry | null
): Promise<SpeciesAskGrounding | null> {
    const resolved = entry ?? await getResolvedSpeciesBySlug(slug);
    if (!resolved) return null;

    const [principle, power] = await Promise.all([
        resolveSpeciesBehaviorProfile(resolved.slug),
        getEnhancedAnimalPowerProfile(resolved.speciesProfileId)
    ]);
    const spotting = getSpeciesSpottingContent(resolved);
    const diet = getSpeciesDietContent(resolved);
    const challengeRelated = (await getMergedChallengesForSpecies(resolved.slug, 4))
        .map((challenge) => {
            const otherSlug = challenge.animalASlug === resolved.slug ? challenge.animalBSlug : challenge.animalASlug;
            const other = getSpeciesBySlug(otherSlug);
            return other ? {slug: other.slug, name: other.name} : null;
        })
        .filter((item): item is {slug: string; name: string} => Boolean(item));
    const explicitRelated = getRelatedSpecies(resolved.slug)
        .map((item) => ({slug: item.slug, name: item.name}))
        .slice(0, 4);
    const catalogRelated = (challengeRelated.length > 0 ? challengeRelated : explicitRelated).slice(0, 4);

    return {
        slug: resolved.slug,
        name: resolved.name,
        scientificName: resolved.analysis.scientificName,
        category: resolved.analysis.category,
        summary: resolved.analysis.summary,
        identification: resolved.analysis.identification,
        habitat: resolved.analysis.habitat,
        nativeRange: resolved.analysis.nativeRange,
        diet: resolved.databaseSource?.fieldGuide.dietSummary ?? diet.summary,
        predators: resolved.databaseSource?.fieldGuide.predatorsSummary ?? null,
        sleepPattern: resolved.databaseSource?.fieldGuide.sleepPattern ?? null,
        lifespan: resolved.databaseSource?.fieldGuide.lifespanEstimate ?? null,
        reproduction: resolved.databaseSource?.fieldGuide.femaleOffspringNotes ?? null,
        sexDifference: resolved.databaseSource?.fieldGuide.sexDifferenceNotes ?? null,
        interestingFacts: resolved.premiumDetails.whyInteresting,
        behaviorTraits: resolved.premiumDetails.behaviorTraits,
        spottingTips: spotting.tips,
        principleName: power?.principleName ?? principle?.principle ?? null,
        principleExpression: power?.principleExpression ?? principle?.principleExpression ?? null,
        coreLesson: power?.coreLesson ?? principle?.coreLesson ?? null,
        corePattern: power?.corePattern ?? null,
        biologicalBasis: power?.biologicalBasis ?? principle?.biologicalBasis ?? null,
        shortMotto: power?.shortMotto ?? principle?.motto ?? null,
        relatedSpecies: catalogRelated,
        relatedLocations: getLocationsFeaturingSpecies(resolved.slug)
    };
}
