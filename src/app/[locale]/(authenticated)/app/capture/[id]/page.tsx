import {notFound} from "next/navigation";
import CaptureDetailClient from "@/app/[locale]/(authenticated)/app/capture/[id]/capture-detail-client";
import NativeRangeMapCard from "@/app/[locale]/(composited)/animals/[slug]/native-range-map-card";
import SpeciesGrowthPanel from "@/app/[locale]/(composited)/animals/[slug]/species-growth-panel";
import SpeciesRankingCarousel from "@/app/[locale]/(composited)/animals/[slug]/species-ranking-carousel";
import {getAppCaptureDetail} from "@/data/authenticated-app";
import {getResolvedSpeciesBySlug} from "@/data/database-species-pages";
import {resolveSpeciesBehaviorProfile} from "@/data/species-behavior-lessons";
import {getSpeciesGrowthContext} from "@/data/species-growth";
import {getSpeciesRankings} from "@/data/species-rankings";
import {getSpeciesSubtitle} from "@/data/species-subtitles";
import {getBattleTier} from "@/lib/battle-tier";
import {getScopedTranslator} from "@/loaders/translation";

function toQualitySlug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default async function CaptureResultPage({params}: {params: {locale: string; id: string}}) {
    const capture = await getAppCaptureDetail(params.id);

    if (!capture) {
        notFound();
    }

    const requestedSpeciesSlug = capture.speciesSlug?.trim().replace(/_/g, "-") ?? null;
    const entry = requestedSpeciesSlug ? await getResolvedSpeciesBySlug(requestedSpeciesSlug) : null;

    if (!entry) {
        return (
            <CaptureDetailClient
                capture={capture}
                speciesSlug={requestedSpeciesSlug}
                speciesName={capture.animalName}
            />
        );
    }

    const [t, subtitle, principle, rankingItems, growth] = await Promise.all([
        getScopedTranslator(params.locale, "animals"),
        getSpeciesSubtitle(entry.slug, params.locale),
        resolveSpeciesBehaviorProfile(entry.slug),
        getSpeciesRankings(entry),
        getSpeciesGrowthContext(entry, capture.id)
    ]);
    const primaryQuality = principle?.bestFor[0] ?? null;
    const primaryQualitySlug = primaryQuality ? toQualitySlug(primaryQuality) : null;
    const comparisonTier = getBattleTier(capture.effectiveGameStats);

    const rankings = (
        <SpeciesRankingCarousel
            speciesSlug={entry.slug}
            speciesName={entry.name}
            items={rankingItems}
            currentCaptureId={capture.id}
            currentCaptureGrade={capture.captureGrade}
            labels={{
                title: t("rankingsTitle", {animal: entry.name}),
                description: t("rankingsDescription"),
                empty: t("rankingsEmpty"),
                rankLabel: t("rankingsRankLabel"),
                scoreLabel: t("rankingsScoreLabel"),
                byPhotographer: t("rankingsByPhotographer")
            }}
        />
    );

    const nativeRange = (
        <NativeRangeMapCard
            entry={entry}
            variant="animal-card"
            settingTag={capture.settingTag}
            humanContext={capture.humanContext}
            labels={{
                title: t("nativeRangeCardTitle"),
                description: t("nativeRangeCardDescription"),
                missingAssets: t("nativeRangeMissingAssets")
            }}
        />
    );

    const compare = (
        <SpeciesGrowthPanel
            speciesSlug={entry.slug}
            speciesName={entry.name}
            lessonSlug={principle?.hasLessonPage ? entry.slug : null}
            qualitySlug={primaryQualitySlug}
            qualityName={primaryQuality}
            growth={growth}
            compareOnly
            comparisonTier={comparisonTier}
            settingTag={capture.settingTag}
            isZooComparisonBanned={capture.isZooComparisonBanned}
            isChallengeAnalysisEligible={capture.isChallengeAnalysisEligible}
            hasChallengeGameStats={capture.hasChallengeGameStats}
            labels={{
                apexPathEyebrow: t("growthApexPathEyebrow"),
                apexInsightTitle: t("growthApexInsightTitle"),
                apexInsightDescription: t("growthApexInsightDescription"),
                useThisPower: t("growthUseThisPower"),
                acceptChallenge: t("growthAcceptChallenge"),
                challengeInProgress: t("growthChallengeInProgress"),
                challengeCompleted: t("growthChallengeCompleted"),
                challengeProofApp: t("growthChallengeProofApp"),
                challengeWaiting: t("growthChallengeWaiting"),
                wildProfileCta: t("growthWildProfileCta"),
                refreshWildProfileCta: t("growthRefreshWildProfileCta"),
                powerFusionTitle: t("growthPowerFusionTitle"),
                powerFusionDescription: t("growthPowerFusionDescription"),
                fusePowers: t("growthFusePowers"),
                fusionCostLabel: t("growthFusionCostLabel"),
                fusionLearnedCount: t("growthFusionLearnedCount"),
                fusionNoDonors: t("growthFusionNoDonors"),
                fusionSelectDonor: t("growthFusionSelectDonor"),
                fusionSearchPlaceholder: t("growthFusionSearchPlaceholder"),
                fusionSubmit: t("growthFusionSubmit"),
                fusionSuccess: t("growthFusionSuccess"),
                bestFor: t("growthBestFor"),
                collectedAnimalsTitle: t("growthYourCapturesTitle", {animal: entry.name}),
                signInPrompt: t("growthSignInPrompt"),
                signInButton: t("growthSignInButton"),
                emptyCapturesTitle: t("growthEmptyCapturesTitle"),
                emptyCapturesDescription: t("growthEmptyCapturesDescription"),
                scoreLabel: t("growthScoreLabel"),
                openLesson: t("growthOpenLesson", {animal: entry.name}),
                openPower: t("growthOpenPower", {power: "{power}"})
            }}
        />
    );

    return (
        <CaptureDetailClient
            capture={capture}
            speciesSlug={entry.slug}
            speciesName={entry.name}
            descriptor={subtitle.descriptor}
            story={subtitle.subtitleStory ?? entry.analysis.summary}
            principle={principle ? {
                name: principle.principle,
                motto: principle.motto,
                expression: principle.principleExpression,
                coreLesson: principle.coreLesson,
                biologicalBasis: principle.biologicalBasis,
                applicationExample: principle.applicationExample,
                bestUseCases: principle.bestFor
            } : null}
            rankings={rankings}
            nativeRange={nativeRange}
            compare={compare}
        />
    );
}
