import Link from "@/app/[locale]/_components/link";

type RankingEntryCardProps = {
    rank: number;
    speciesSlug: string;
    speciesName: string;
    primaryMetric: string;
    shortReason: string;
    summary: string;
    readSpeciesLabel: string;
};

export default function RankingEntryCard({
    rank,
    speciesSlug,
    speciesName,
    primaryMetric,
    shortReason,
    summary,
    readSpeciesLabel
}: RankingEntryCardProps) {
    return (
        <article className="flex flex-col gap-3 rounded-lg border border-line-300 bg-surface-900/75 p-5">
            <div className="flex flex-wrap gap-2 items-center">
                <span className="rounded-md border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">
                    #{rank}
                </span>
                <span className="rounded-md border border-line-400 px-3 py-1 text-xs text-ink-200">
                    {primaryMetric}
                </span>
            </div>
            <h3 className="font-display text-2xl font-bold leading-tight text-white">
                <Link href={`/animals/${speciesSlug}`} className="hover:text-primary-100 transition-colors">
                    {speciesName}
                </Link>
            </h3>
            <p className="text-base leading-7 text-ink-200">{shortReason}</p>
            <p className="text-sm leading-6 text-ink-300">{summary}</p>
            <Link
                href={`/animals/${speciesSlug}`}
                className="mt-auto w-fit text-sm font-semibold text-primary-200 hover:text-primary-100 transition-colors"
                underline
            >
                {readSpeciesLabel}
            </Link>
        </article>
    );
}
