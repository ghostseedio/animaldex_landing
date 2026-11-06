import {Suspense} from "react";
import {AppPage, AppPageHeader, AppPrimaryLink, AppProgress, AppSecondaryLink, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import CollectionPageClient from "@/app/[locale]/(authenticated)/app/collection/collection-page-client";
import type {CatalogSpecies} from "@/app/[locale]/(authenticated)/app/collection/collection-catalog";
import {getAppCapturesChecked} from "@/data/authenticated-app";
import {getScopedTranslator} from "@/loaders/translation";
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
import {isHomoSapiens} from "@/lib/people-never-public";
import {collectionShowsCount, collectionShowsProgress} from "@/lib/collection-states";
import CollectionRetry from "@/app/[locale]/(authenticated)/app/collection/collection-retry";
import {loadAppFeatureFlags} from "@/data/app-feature-flags";
import {isAppFeatureOn} from "@/lib/app-feature-flags";

export default async function CollectionPage({params}: {params: {locale: string}}) {
    const [library, catalogEntries, behaviorPrinciples, binderData, t] = await Promise.all([
        getAppCapturesChecked(),
        getUnifiedSpeciesEntries(),
        getCatalogBehaviorPrincipleIndex(),
        getCollectionBinders(),
        getScopedTranslator(params.locale, "appCollection")
    ]);
    const captures = library.captures;
    const discoveryIndex = buildCollectionDiscoveryIndex(captures);
    // People are never public (DECISIONS section 11): no Homo sapiens entry in the catalog.
    const species: CatalogSpecies[] = catalogEntries.filter((entry) => !isHomoSapiens({slug: entry.slug, scientificName: entry.analysis.scientificName})).map((entry) => {
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

    // A failed read is never an empty collection (iOS d428026e, JRN-22): the
    // reason in plain words and Try again, never "0 found" or a table name.
    const loadFailed = library.failed || species.length === 0;
    const showsCount = !loadFailed && collectionShowsCount(discoveryStats.indexed);
    const showsProgress = showsCount && collectionShowsProgress(discoveryStats.found, discoveryStats.indexed);

    const instagramImportOn = isAppFeatureOn(await loadAppFeatureFlags(), "instagram_import");

    // Newcomer UX vet (2026-10-30, P1-4): what this page is, and a count rather than a percentage.
    return (
        <AppPage>
            <AppPageHeader
                eyebrow="AnimalDex"
                title={t("title")}
                description={t("description")}
                action={(
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <AppPrimaryLink href="/app/capture" icon="camera">{t("addCapture")}</AppPrimaryLink>
                        {/* Instagram import paused (shared SPEC section 3.2): no way in, as iOS hides it. */}
                        {instagramImportOn ? <AppSecondaryLink href="/app/import/instagram">{t("checkInstagram")}</AppSecondaryLink> : null}
                    </div>
                )}
            />

            {loadFailed ? (
                <CollectionRetry title={t("unavailableTitle")} message={t("serverMessage")} retryLabel={t("retry")} />
            ) : (
                <>
                    {showsCount ? (
                        <AppSurface>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                <p className={`font-display text-2xl font-bold tabular-nums ${discoveryStats.found > 0 ? "text-primary-400" : "text-white"}`}>
                                    {t("found", {
                                        found: discoveryStats.found.toLocaleString(params.locale),
                                        total: discoveryStats.indexed.toLocaleString(params.locale)
                                    })}
                                </p>
                                {/* Under 5% the bar reads as empty; the count already says it (iOS IOS-21). */}
                                {showsProgress ? (
                                    <div className="w-full sm:max-w-xs">
                                        <AppProgress value={progress} />
                                    </div>
                                ) : null}
                            </div>
                        </AppSurface>
                    ) : null}

                    <Suspense fallback={<div className="h-40 animate-pulse bg-white/[0.04]" />}>
                        <CollectionPageClient
                            species={species}
                            discoveryStats={discoveryStats}
                            binders={binderData.binders}
                            binderSummary={binderData.summary}
                            catalogWords={{
                                noMatchesEyebrow: t("noMatchesEyebrow"),
                                noMatchesTitle: t("noMatchesTitle"),
                                noMatchesDetail: t("noMatchesDetail"),
                                resetView: t("resetView")
                            }}
                        />
                    </Suspense>
                </>
            )}
        </AppPage>
    );
}
