import {Suspense} from "react";
import {AppPage, AppPageHeader, AppPrimaryLink, AppProgress, AppSecondaryLink, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import CollectionPageClient from "@/app/[locale]/(authenticated)/app/collection/collection-page-client";
import type {CatalogSpecies} from "@/app/[locale]/(authenticated)/app/collection/collection-catalog";
import {getAppCaptures} from "@/data/authenticated-app";
import {getCollectionBinders} from "@/data/collection-binders";
import {getCatalogBehaviorPrincipleIndex, getUnifiedSpeciesEntries, resolveCatalogBehaviorPrinciple} from "@/data/database-species-pages";
import {getLegendaryEarthBeast} from "@/data/legendary-earth-beasts";
import {getBehavioralPrincipleProfile} from "@/data/species-behavioral-principles";
import {getSpeciesImageRoute} from "@/data/species-images";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {isBreedSpeciesEntry} from "@/lib/species-breed";
import {
    buildCollectionDiscoveryIndex,
    buildCollectionDiscoveryStats,
    isCatalogEntryDiscovered,
    latestCaptureForCatalogEntry
} from "@/lib/collection-discovery";

export default async function CollectionPage() {
    const [captures, catalogEntries, behaviorPrinciples, binderData] = await Promise.all([
        getAppCaptures(),
        getUnifiedSpeciesEntries(),
        getCatalogBehaviorPrincipleIndex(),
        getCollectionBinders()
    ]);
    const discoveryIndex = buildCollectionDiscoveryIndex(captures);
    const species: CatalogSpecies[] = catalogEntries.map((entry) => {
        const legendaryBeast = getLegendaryEarthBeast(entry.slug);
        const capture = latestCaptureForCatalogEntry({
            speciesProfileId: entry.speciesProfileId,
            normalizedIdentityKey: entry.normalizedIdentityKey
        }, discoveryIndex);
        const catalogPrinciple = resolveCatalogBehaviorPrinciple(
            behaviorPrinciples,
            entry.speciesProfileId,
            entry.normalizedIdentityKey,
            entry.analysis.scientificName
        );
        const staticPrinciple = getBehavioralPrincipleProfile(
            entry.slug,
            speciesSystemsIntelligence[entry.slug],
            speciesSystemsIntelligence
        );
        const animalDexNumber = getAnimalDexNumberFromEntry(entry);
        const captured = isCatalogEntryDiscovered({
            speciesProfileId: entry.speciesProfileId,
            normalizedIdentityKey: entry.normalizedIdentityKey
        }, discoveryIndex);
        return {
            slug: entry.slug,
            name: entry.name,
            scientificName: entry.analysis.scientificName,
            category: entry.analysis.category,
            number: animalDexNumber ?? Number.MAX_SAFE_INTEGER,
            rarity: entry.analysis.rarityScore,
            gameStats: entry.databaseSource?.canonicalGameStats ?? null,
            principle: legendaryBeast?.power ?? catalogPrinciple?.principleName ?? staticPrinciple?.principle ?? "Animal Intelligence",
            catalogLesson: legendaryBeast?.lesson ?? catalogPrinciple?.coreLesson ?? null,
            lesson: legendaryBeast?.lesson ?? catalogPrinciple?.coreLesson ?? staticPrinciple?.coreLesson ?? entry.analysis.summary,
            powers: legendaryBeast?.bestFor.length
                ? legendaryBeast.bestFor
                : catalogPrinciple?.bestUseCases.length
                    ? catalogPrinciple.bestUseCases
                    : (staticPrinciple?.bestFor ?? []),
            captured,
            captureId: capture?.captureId ?? null,
            capturedAt: capture?.capturedAt ?? null,
            score: capture?.score ?? null,
            context: capture?.contextLabel ?? null,
            imageSrc: getSpeciesImageRoute(entry.slug, capture?.captureId),
            hasIndexNumber: animalDexNumber != null,
            identityKind: entry.databaseSource?.identityKind ?? null,
            isBreed: isBreedSpeciesEntry(entry),
            isLegendary: Boolean(legendaryBeast),
            legendaryTier: legendaryBeast?.tier ?? null
        };
    });
    const discoveryStats = buildCollectionDiscoveryStats(discoveryIndex, species);
    const progress = discoveryStats.indexed
        ? Math.round(discoveryStats.found / discoveryStats.indexed * 100)
        : 0;

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="Collection"
                title="Collection"
                description="Browse the indexed catalog and fill curated binders with the animals you've captured."
                action={(
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <AppPrimaryLink href="/app/capture" icon="camera">Add capture</AppPrimaryLink>
                        <AppSecondaryLink href="/app/import/instagram">Check my Instagram</AppSecondaryLink>
                    </div>
                )}
            />

            <AppSurface>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Unique AnimalDex entries</p>
                        <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">{discoveryStats.found}<span className="text-white/35"> / {discoveryStats.indexed}</span></p>
                        <p className="mt-1 text-sm text-white/45">{discoveryStats.remaining} indexed animals left to discover. Totals include group-level identities, not only species.</p>
                    </div>
                    <div className="w-full sm:max-w-xs">
                        <div className="mb-2 flex justify-between text-xs font-bold text-white/40">
                            <span>Completion</span>
                            <span>{progress}%</span>
                        </div>
                        <AppProgress value={progress} />
                    </div>
                </div>
            </AppSurface>

            <Suspense fallback={<div className="h-40 animate-pulse rounded-[1.5rem] bg-white/[0.04]" />}>
                <CollectionPageClient
                    species={species}
                    discoveryStats={discoveryStats}
                    binders={binderData.binders}
                    binderSummary={binderData.summary}
                />
            </Suspense>
        </AppPage>
    );
}
