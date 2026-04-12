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
        <article className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center">
                <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                    #{rank}
                </span>
                <span className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 text-xs">
                    {primaryMetric}
                </span>
            </div>
            <h3 className="font-display font-bold text-2xl text-white">
                <Link href={`/animals/${speciesSlug}`} className="hover:text-primary-100 transition-colors">
                    {speciesName}
                </Link>
            </h3>
            <p className="text-ink-200 text-base leading-7">{shortReason}</p>
            <p className="text-ink-300 text-sm md:text-base leading-7">{summary}</p>
            <Link
                href={`/animals/${speciesSlug}`}
                className="mt-auto text-primary-200 hover:text-primary-100 transition-colors"
                underline
            >
                {readSpeciesLabel}
            </Link>
        </article>
    );
}
