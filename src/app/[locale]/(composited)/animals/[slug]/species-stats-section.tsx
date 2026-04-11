import type {SpeciesStatsResolution} from "@/data/species-stats";

type SpeciesStatsLabels = {
    title: string;
    description: string;
    battleTierChip: string;
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
    battleTier?: string | null;
    labels: SpeciesStatsLabels;
};

const STAT_LABEL_ORDER = [
    {key: "dominance", colorClassName: "from-amber-300 via-orange-300 to-rose-300"},
    {key: "speed", colorClassName: "from-sky-300 via-cyan-300 to-emerald-300"},
    {key: "size", colorClassName: "from-lime-300 via-emerald-300 to-teal-300"},
    {key: "intelligence", colorClassName: "from-fuchsia-300 via-pink-300 to-rose-300"},
    {key: "rarity", colorClassName: "from-yellow-200 via-amber-300 to-orange-400"}
] as const;

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

export default function SpeciesStatsSection({result, battleTier = null, labels}: SpeciesStatsSectionProps) {
    if (!result.stats || result.statsSource === "generated") {
        return (
            <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4">
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
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex flex-col gap-3">
                    <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{labels.title}</h2>
                    <p className="text-ink-200 text-lg md:text-xl leading-8">{labels.description}</p>
                    <p className="text-sm md:text-base text-ink-300">
                        <span className="text-white">{labels.sourceLabel}: </span>
                        {getSourceLabel(result.statsSource, labels)}
                    </p>
                </div>
                {battleTier ? (
                    <div className="md:pt-1">
                        <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-primary-300/25 bg-primary-500/18 px-4 py-2 text-sm md:text-base font-semibold text-primary-100">
                            {labels.battleTierChip.replace("{tier}", battleTier)}
                        </span>
                    </div>
                ) : null}
            </div>

            <div className="flex flex-col gap-4">
                {STAT_LABEL_ORDER.map((stat) => (
                    <article
                        key={stat.key}
                        className="rounded-3xl border border-line-300 bg-surface-950/60 p-5 flex flex-col gap-4"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <h3 className="text-white text-sm uppercase tracking-[0.24em]">{statLabels[stat.key]}</h3>
                            <span className="font-display font-bold text-4xl text-white shrink-0">{stats[stat.key]}</span>
                        </div>
                        <div className="h-3 rounded-full bg-surface-800 overflow-hidden">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${stat.colorClassName}`}
                                style={{width: `${Math.max(6, Math.min(100, stats[stat.key]))}%`}}
                            />
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
