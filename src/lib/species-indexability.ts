import type {SpeciesEntry} from "@/data/species";
import {speciesHasSubstantiveFieldGuide} from "@/lib/species-field-guide";
import {shouldNoindexLifeStageAliasSlug} from "@/lib/species-life-stage-policy";

/**
 * Whether /animals/<requestedSlug> may be indexed: a substantive field guide,
 * not hidden from SEO in the catalog, not a life-stage alias. One function for
 * the page's robots tag and the sitemap, so the sitemap never lists a page
 * that tells Google not to index it (Oct 2026: ~1% of species URLs did).
 */
export function isSpeciesPageIndexable(entry: SpeciesEntry, requestedSlug: string = entry.slug) {
    return speciesHasSubstantiveFieldGuide({
        name: entry.name,
        summary: entry.analysis.summary,
        habitat: entry.analysis.habitat,
        nativeRange: entry.analysis.nativeRange,
        identification: entry.analysis.identification,
        behaviorTraits: entry.premiumDetails.behaviorTraits,
        interestingFacts: entry.premiumDetails.whyInteresting,
        diet: entry.databaseSource?.fieldGuide.dietSummary ?? null,
        predators: entry.databaseSource?.fieldGuide.predatorsSummary ?? null,
        sleepPattern: entry.databaseSource?.fieldGuide.sleepPattern ?? null,
        lifespan: entry.databaseSource?.fieldGuide.lifespanEstimate ?? null
    }) && !(entry.databaseSource && !entry.databaseSource.seoIndexable)
        && !shouldNoindexLifeStageAliasSlug(requestedSlug, entry.slug);
}
