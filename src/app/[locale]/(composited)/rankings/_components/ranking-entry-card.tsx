import Link from "@/app/[locale]/_components/link";
import Image from "next/image";

type RankingEntryCardProps = {
    rank: number;
    speciesSlug: string;
    speciesName: string;
    iconSrc: string;
    primaryMetric: string;
    shortReason: string;
    summary: string;
    readSpeciesLabel: string;
};

export default function RankingEntryCard({
    rank,
    speciesSlug,
    speciesName,
    iconSrc,
    primaryMetric,
    shortReason,
    summary,
    readSpeciesLabel
}: RankingEntryCardProps) {
    return (
        <article className="flex flex-col gap-4 rounded-lg border border-line-300 bg-surface-900/75 p-5">
            <div className="flex items-start gap-4">
                <Link
                    href={`/animals/${speciesSlug}`}
                    className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line-300 bg-canvas-950/70 p-2 transition-colors hover:border-primary-400/60"
                    aria-label={speciesName}
                >
                    <Image
                        src={iconSrc}
                        alt={`${speciesName} AnimalDex icon`}
                        width={96}
                        height={96}
                        className="h-full w-full object-contain"
                    />
                </Link>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2 items-center">
                        <span className="rounded-md border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">
                            #{rank}
                        </span>
                        <span className="rounded-md border border-line-400 px-3 py-1 text-xs text-ink-200">
                            {primaryMetric}
                        </span>
                    </div>
                    <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-white">
                        <Link href={`/animals/${speciesSlug}`} className="hover:text-primary-100 transition-colors">
                            {speciesName}
                        </Link>
                    </h3>
                </div>
            </div>
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
