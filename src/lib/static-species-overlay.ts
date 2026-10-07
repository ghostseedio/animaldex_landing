import overlaySnapshot from "@/data/published-seo-static-species-overlay.json";
import {speciesAuthoredDetails} from "@/data/species-authored-details";
import {speciesEntries, type SpeciesEntry} from "@/data/species";
import {getSnapshotSpeciesBySlug} from "@/lib/published-seo-page-data";

export type StaticSpeciesOverlay = {
    animalDexNumber: number;
    identityKind: string | null;
    canonicalGameStats: Record<string, number> | null;
    spotlight: string | null;
    typicalHabitat: string | null;
    signatureTraits: string[];
    interestingFacts: string[];
    fieldGuideVersion: string | null;
    fieldGuide: NonNullable<SpeciesEntry["databaseSource"]>["fieldGuide"];
};

const overlays = (overlaySnapshot as unknown as {entries: Record<string, StaticSpeciesOverlay>}).entries;

export function getStaticSpeciesOverlay(slug: string): StaticSpeciesOverlay | null {
    return overlays[slug] ?? null;
}

/**
 * Build-time species facts for any published animal slug, without a network
 * call: a hand-coded entry with its DB overlay applied, else the DB-only
 * snapshot entry. For pages that quote a real animal (Pokémon counterparts…).
 */
export function getPublishedSpeciesForContent(slug: string): SpeciesEntry | null {
    const staticEntry = speciesEntries.find((entry) => entry.slug === slug);
    if (staticEntry) {
        return applyStaticSpeciesOverlay(staticEntry);
    }
    return getSnapshotSpeciesBySlug(slug) ?? null;
}

/**
 * Merge the production catalog's field guide into a hand-coded species entry.
 *
 * Static entries never fetch Supabase during SSG, so without this the ~880
 * expansion-pack species rendered generated copy ("adjusts movement and
 * feeding to match light…") while the DB held a real field guide for them.
 * The overlay is refreshed by `npm run refresh:published-seo`.
 *
 * Authored entries keep their hand-written text and only gain the DB field
 * guide and stats. Template entries swap their generated summary,
 * identification and premium details for the DB spotlight, signature traits
 * and interesting facts; when the DB has none, the generated sections are
 * emptied rather than shown.
 */
export function applyStaticSpeciesOverlay(entry: SpeciesEntry): SpeciesEntry {
    const overlay = getStaticSpeciesOverlay(entry.slug);
    const isTemplate = entry.contentSource === "template";

    const databaseSource: SpeciesEntry["databaseSource"] = entry.databaseSource ?? (overlay ? {
        animalDexNumber: overlay.animalDexNumber,
        identityKind: overlay.identityKind,
        canonicalGameStats: overlay.canonicalGameStats,
        seoIndexable: true,
        fieldGuideVersion: overlay.fieldGuideVersion,
        fieldGuide: overlay.fieldGuide
    } : undefined);

    if (!isTemplate) {
        return databaseSource === entry.databaseSource ? entry : {...entry, databaseSource};
    }

    const authored = speciesAuthoredDetails[entry.slug];
    if (authored && !overlay?.spotlight) {
        return {
            ...entry,
            analysis: {...entry.analysis, summary: authored.summary, identification: authored.identification},
            premiumDetails: {
                ...entry.premiumDetails,
                behaviorTraits: authored.behaviorTraits,
                whyInteresting: authored.whyInteresting,
                lookalikes: authored.lookalikes
            },
            databaseSource
        };
    }

    const traits = overlay?.signatureTraits ?? [];
    const facts = overlay?.interestingFacts ?? [];

    return {
        ...entry,
        analysis: {
            ...entry.analysis,
            summary: overlay?.spotlight ?? entry.analysis.summary,
            identification: traits.length >= 2 ? traits : entry.analysis.identification
        },
        premiumDetails: {
            ...entry.premiumDetails,
            behaviorTraits: facts,
            // Identification already carries the traits; "why interesting" was
            // the most obviously generated block, so it only shows real facts.
            whyInteresting: [],
            lookalikes: []
        },
        databaseSource
    };
}
