import type {SpeciesStatsResolution} from "@/data/species-stats";
import SpeciesRadarStats from "@/app/[locale]/(composited)/animals/[slug]/species-radar-stats";

type SpeciesStatsLabels = {
    title: string;
    description: string;
    sourceLabel: string;
    dominance: string;
    speed: string;
    size: string;
    intelligence: string;
    rarity: string;
    sourceSpeciesProfile: string;
    sourceAnalysisBase: string;
    sourceAnalysisEffective: string;
    sourceRawJson: string;
    sourceGenerated: string;
    sourceNone: string;
    unavailableTitle: string;
    unavailableDescription: string;
};

type SpeciesStatsSectionProps = {
    result: SpeciesStatsResolution;
    labels: SpeciesStatsLabels;
};

function getSourceLabel(source: SpeciesStatsResolution["statsSource"], labels: SpeciesStatsLabels) {
    switch (source) {
        case "species_profile":
            return labels.sourceSpeciesProfile;
        case "analysis_base":
            return labels.sourceAnalysisBase;
        case "analysis_effective":
            return labels.sourceAnalysisEffective;
        case "raw_json":
            return labels.sourceRawJson;
        case "generated":
            return labels.sourceGenerated;
        default:
            return labels.sourceNone;
    }
}

export default function SpeciesStatsSection({result, labels}: SpeciesStatsSectionProps) {
    if (!result.stats || result.statsSource === "none") {
        return (
            <section className="  border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{labels.unavailableTitle}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{labels.unavailableDescription}</p>
            </section>
        );
    }

    const stats = result.stats;
    const statLabels = {
        dominance: labels.dominance,
        speed: labels.speed,
        size: labels.size,
        intelligence: labels.intelligence,
        rarity: labels.rarity
    };

    return (
        <section className="  border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-3">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{labels.title}</h2>
                    <p className="text-ink-200 text-lg md:text-xl leading-8">{labels.description}</p>
                    <p className="text-sm md:text-base text-ink-300">
                        <span className="text-white">{labels.sourceLabel}: </span>
                        {getSourceLabel(result.statsSource, labels)}
                    </p>
                </div>
            </div>

            <SpeciesRadarStats stats={stats} labels={statLabels} />
        </section>
    );
}
