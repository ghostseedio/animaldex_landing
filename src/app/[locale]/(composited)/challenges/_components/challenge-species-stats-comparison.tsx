import type {SpeciesStatsResolution} from "@/data/species-stats";

type ChallengeSpeciesStatsComparisonProps = {
    title: string;
    description: string;
    animalAName: string;
    animalBName: string;
    animalAResult: SpeciesStatsResolution;
    animalBResult: SpeciesStatsResolution;
    animalABattleTier: string | null;
    animalBBattleTier: string | null;
    labels: {
        advantage: string;
        even: string;
        battleTierChip: string;
        statsSourceLabel: string;
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
    };
};

const STAT_ROWS = [
    {
        key: "dominance",
        accentClassName: "from-amber-300 via-orange-300 to-rose-300",
        badgeClassName: "border-amber-300/25 bg-amber-500/15 text-amber-100"
    },
    {
        key: "speed",
        accentClassName: "from-sky-300 via-cyan-300 to-emerald-300",
        badgeClassName: "border-sky-300/25 bg-sky-500/15 text-sky-100"
    },
    {
        key: "size",
        accentClassName: "from-lime-300 via-emerald-300 to-teal-300",
        badgeClassName: "border-emerald-300/25 bg-emerald-500/15 text-emerald-100"
    },
    {
        key: "intelligence",
        accentClassName: "from-fuchsia-300 via-pink-300 to-rose-300",
        badgeClassName: "border-fuchsia-300/25 bg-fuchsia-500/15 text-fuchsia-100"
    },
    {
        key: "rarity",
        accentClassName: "from-yellow-200 via-amber-300 to-orange-400",
        badgeClassName: "border-yellow-300/25 bg-yellow-500/15 text-yellow-100"
    }
] as const;

type ComparisonSide = "animalA" | "animalB" | "even";

function getSourceLabel(source: SpeciesStatsResolution["statsSource"], labels: ChallengeSpeciesStatsComparisonProps["labels"]) {
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

function getSourceClassName(source: SpeciesStatsResolution["statsSource"]) {
    switch (source) {
        case "species_profile":
            return "border-emerald-300/25 bg-emerald-500/12 text-emerald-100";
        case "analysis_base":
            return "border-sky-300/25 bg-sky-500/12 text-sky-100";
        case "analysis_effective":
            return "border-amber-300/25 bg-amber-500/12 text-amber-100";
        case "raw_json":
            return "border-violet-300/25 bg-violet-500/12 text-violet-100";
        case "generated":
            return "border-slate-300/25 bg-slate-500/12 text-slate-100";
        default:
            return "border-line-300/80 bg-surface-900/70 text-ink-200";
    }
}

function getEdge(a: number, b: number): ComparisonSide {
    if (a === b) {
        return "even";
    }

    return a > b ? "animalA" : "animalB";
}

function getEdgeClassName(edge: ComparisonSide) {
    switch (edge) {
        case "animalA":
            return "border-emerald-300/25 bg-emerald-500/15 text-emerald-100";
        case "animalB":
            return "border-sky-300/25 bg-sky-500/15 text-sky-100";
        default:
            return "border-amber-300/25 bg-amber-500/15 text-amber-100";
    }
}

function getStatLabel(
    key: (typeof STAT_ROWS)[number]["key"],
    labels: ChallengeSpeciesStatsComparisonProps["labels"]
) {
    switch (key) {
        case "dominance":
            return labels.dominance;
        case "speed":
            return labels.speed;
        case "size":
            return labels.size;
        case "intelligence":
            return labels.intelligence;
        default:
            return labels.rarity;
    }
}

function getEdgeLabel(
    edge: ComparisonSide,
    animalAName: string,
    animalBName: string,
    labels: ChallengeSpeciesStatsComparisonProps["labels"]
) {
    if (edge === "animalA") {
        return animalAName;
    }

    if (edge === "animalB") {
        return animalBName;
    }

    return labels.even;
}

export default function ChallengeSpeciesStatsComparison({
    title,
    description,
    animalAName,
    animalBName,
    animalAResult,
    animalBResult,
    animalABattleTier,
    animalBBattleTier,
    labels
}: ChallengeSpeciesStatsComparisonProps) {
    if (!animalAResult.stats || !animalBResult.stats) {
        return null;
    }

    const animalAStats = animalAResult.stats;
    const animalBStats = animalBResult.stats;

    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
                <p className="text-ink-200 text-lg md:text-xl leading-8">{description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    {
                        name: animalAName,
                        result: animalAResult,
                        battleTier: animalABattleTier,
                        tierClassName: "border-emerald-300/25 bg-emerald-500/15 text-emerald-100"
                    },
                    {
                        name: animalBName,
                        result: animalBResult,
                        battleTier: animalBBattleTier,
                        tierClassName: "border-sky-300/25 bg-sky-500/15 text-sky-100"
                    }
                ].map((animal) => (
                    <article
                        key={animal.name}
                        className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-4"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-col gap-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">
                                    {animal.name}
                                </p>
                                <p className="text-sm md:text-base text-ink-300">
                                    <span className="text-white">{labels.statsSourceLabel}: </span>
                                    {getSourceLabel(animal.result.statsSource, labels)}
                                </p>
                            </div>
                            {animal.battleTier ? (
                                <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${animal.tierClassName}`}>
                                    {labels.battleTierChip.replace("{tier}", animal.battleTier)}
                                </span>
                            ) : null}
                        </div>
                        <div className={`rounded-2xl border px-4 py-3 text-sm md:text-base ${getSourceClassName(animal.result.statsSource)}`}>
                            {getSourceLabel(animal.result.statsSource, labels)}
                        </div>
                    </article>
                ))}
            </div>

            <div className="flex flex-col gap-4">
                {STAT_ROWS.map((stat) => {
                    const animalAValue = animalAStats[stat.key];
                    const animalBValue = animalBStats[stat.key];
                    const edge = getEdge(animalAValue, animalBValue);

                    return (
                        <article
                            key={stat.key}
                            className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-4 md:p-5"
                        >
                            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)_10rem] gap-4 xl:items-center">
                                <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${edge === "animalA" ? "border-emerald-300/25 bg-emerald-500/10" : "border-line-300/80 bg-surface-950/60"}`}>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">
                                            {animalAName}
                                        </span>
                                        <span className="font-display font-bold text-3xl text-white">{animalAValue}</span>
                                    </div>
                                    <div className="h-3 rounded-full bg-surface-950 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${stat.accentClassName}`}
                                            style={{width: `${Math.max(6, animalAValue)}%`}}
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col items-center justify-center gap-2 text-center">
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${stat.badgeClassName}`}>
                                        {getStatLabel(stat.key, labels)}
                                    </span>
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${getEdgeClassName(edge)}`}>
                                        {labels.advantage}: {getEdgeLabel(edge, animalAName, animalBName, labels)}
                                    </span>
                                    {edge !== "even" ? (
                                        <span className="text-xs md:text-sm text-ink-300">
                                            +{Math.abs(animalAValue - animalBValue)}
                                        </span>
                                    ) : null}
                                </div>

                                <div className={`rounded-2xl border p-4 flex flex-col gap-3 ${edge === "animalB" ? "border-sky-300/25 bg-sky-500/10" : "border-line-300/80 bg-surface-950/60"}`}>
                                    <div className="flex items-center justify-between gap-4">
                                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">
                                            {animalBName}
                                        </span>
                                        <span className="font-display font-bold text-3xl text-white">{animalBValue}</span>
                                    </div>
                                    <div className="h-3 rounded-full bg-surface-950 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full bg-gradient-to-r ${stat.accentClassName}`}
                                            style={{width: `${Math.max(6, animalBValue)}%`}}
                                        />
                                    </div>
                                </div>

                                <div className="xl:col-start-4">
                                    <div className={`rounded-2xl border px-4 py-3 text-center text-sm font-semibold ${getEdgeClassName(edge)}`}>
                                        {getEdgeLabel(edge, animalAName, animalBName, labels)}
                                    </div>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
