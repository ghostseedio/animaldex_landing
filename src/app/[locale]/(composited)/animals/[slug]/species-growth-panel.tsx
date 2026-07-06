import SpeciesGrowthInteractive from "@/app/[locale]/(composited)/animals/[slug]/species-growth-interactive";
import type {SpeciesGrowthContext} from "@/data/species-growth";

type SpeciesGrowthPanelProps = {
    speciesSlug: string;
    speciesName: string;
    lessonSlug: string | null;
    qualitySlug: string | null;
    qualityName: string | null;
    growth: SpeciesGrowthContext;
    labels: {
        apexPathEyebrow: string;
        apexInsightTitle: string;
        apexInsightDescription: string;
        useThisPower: string;
        acceptChallenge: string;
        challengeInProgress: string;
        challengeCompleted: string;
        challengeProofApp: string;
        challengeWaiting: string;
        wildProfileCta: string;
        refreshWildProfileCta: string;
        powerFusionTitle: string;
        powerFusionDescription: string;
        fusePowers: string;
        fusionCostLabel: string;
        fusionLearnedCount: string;
        fusionNoDonors: string;
        fusionSelectDonor: string;
        fusionSearchPlaceholder: string;
        fusionSubmit: string;
        fusionSuccess: string;
        bestFor: string;
        collectedAnimalsTitle: string;
        signInPrompt: string;
        signInButton: string;
        emptyCapturesTitle: string;
        emptyCapturesDescription: string;
        scoreLabel: string;
        openLesson: string;
        openPower: string;
    };
};

export default function SpeciesGrowthPanel({
    speciesSlug,
    speciesName,
    lessonSlug,
    qualitySlug,
    qualityName,
    growth,
    labels
}: SpeciesGrowthPanelProps) {
    return (
        <SpeciesGrowthInteractive
            speciesSlug={speciesSlug}
            speciesName={speciesName}
            lessonSlug={lessonSlug}
            qualitySlug={qualitySlug}
            qualityName={qualityName}
            growth={growth}
            labels={labels}
        />
    );
}
