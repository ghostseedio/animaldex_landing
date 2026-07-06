import {AppPage, AppPageHeader, AppPrimaryLink, AppProgress, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import CollectionPageClient from "@/app/[locale]/(authenticated)/app/collection/collection-page-client";
import type {CatalogSpecies} from "@/app/[locale]/(authenticated)/app/collection/collection-catalog";
import {getAppCaptures} from "@/data/authenticated-app";
import {getCatalogBehaviorPrincipleIndex, getUnifiedSpeciesEntries, resolveCatalogBehaviorPrinciple} from "@/data/database-species-pages";
import {getLegendaryEarthBeast, LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH} from "@/data/legendary-earth-beasts";
import {getBehavioralPrincipleProfile} from "@/data/species-behavioral-principles";
import {getSpeciesImageRoute} from "@/data/species-images";
import {speciesSystemsIntelligence} from "@/data/species-systems-intelligence";
import {getAnimalDexNumberFromEntry} from "@/lib/animaldex-number";
import {
    buildCollectionDiscoveryIndex,
    buildCollectionDiscoveryStats,
    isCatalogEntryDiscovered,
    latestCaptureForCatalogEntry
} from "@/lib/collection-discovery";

export default async function CollectionPage() {
    const [captures, catalogEntries, behaviorPrinciples] = await Promise.all([
        getAppCaptures(),
        getUnifiedSpeciesEntries(),
        getCatalogBehaviorPrincipleIndex()
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
            entry.normalizedIdentityKey
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
            isBreed: entry.databaseSource?.identityKind?.toLowerCase() === "breed",
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
                eyebrow="AnimalDex"
                title="Collection"
                description="Browse the indexed field guide, track discoveries, and explore the powers and lessons connected to every animal."
                action={(
                    <div className="flex flex-wrap gap-2">
                        <AppPrimaryLink href={LEGENDARY_EARTH_BEASTS_CANONICAL_BASE_PATH} icon="spark">
                            Legendary beasts
                        </AppPrimaryLink>
                        <AppPrimaryLink href="/app/capture" icon="camera">Add capture</AppPrimaryLink>
                    </div>
                )}
            />

            <AppSurface>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Catalog progress</p>
                        <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">{discoveryStats.found}<span className="text-white/35"> / {discoveryStats.indexed}</span></p>
                        <p className="mt-1 text-sm text-white/45">{discoveryStats.remaining} indexed species left to discover</p>
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

            <CollectionPageClient
                species={species}
                discoveryStats={discoveryStats}
            />
        </AppPage>
    );
}
