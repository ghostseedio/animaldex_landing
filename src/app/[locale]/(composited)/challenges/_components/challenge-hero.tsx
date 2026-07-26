import Image from "next/image";
import {ChallengeEntry} from "@/data/challenges";

type ChallengeHeroProps = {
    challenge: ChallengeEntry;
    comparisonTypeLabel: string;
    animalAName: string;
    animalBName: string;
    updatedLabel: string;
    updatedValue: string;
    winnerLabel: string;
    readTimeLabel: string;
    quickVerdictLabel: string;
};

export default function ChallengeHero({
    challenge,
    comparisonTypeLabel,
    animalAName,
    animalBName,
    updatedLabel,
    updatedValue,
    winnerLabel,
    readTimeLabel,
    quickVerdictLabel
}: ChallengeHeroProps) {
    return (
        <section id="overview" className="relative min-h-[32rem] overflow-hidden rounded-[2rem] border border-line-300 bg-surface-900 shadow-2xl md:min-h-[38rem]">
            <div className="absolute inset-0">
                <Image
                    src={challenge.featuredImage.src}
                    alt={challenge.featuredImage.alt}
                    width={challenge.featuredImage.width}
                    height={challenge.featuredImage.height}
                    priority
                    sizes="(min-width: 1280px) 960px, (min-width: 768px) 80vw, 100vw"
                    className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-surface-950/45" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/60 to-surface-950/25" />
                <div className="absolute inset-0 bg-gradient-to-r from-surface-950/85 via-transparent to-transparent" />
            </div>

            <div className="relative z-10 flex min-h-[32rem] flex-col justify-between p-6 md:min-h-[38rem] md:p-10 lg:p-12">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-primary-300/30 bg-primary-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary-100 backdrop-blur">
                        {comparisonTypeLabel}
                    </span>
                    <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">{winnerLabel}</span>
                    <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-xs text-ink-100 backdrop-blur">{readTimeLabel}</span>
                    <span className="rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-xs text-ink-100 backdrop-blur">{updatedLabel} {updatedValue}</span>
                </div>

                <div className="max-w-4xl space-y-4">
                    <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-surface-950">{quickVerdictLabel}</span>
                    <h1 className="font-display text-4xl font-bold leading-[0.98] text-white md:text-6xl lg:text-7xl">
                        {challenge.title}
                    </h1>
                    <p className="max-w-3xl text-base leading-7 text-ink-100 md:text-xl md:leading-8">
                        {challenge.description}
                    </p>
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary-100">
                        {animalAName} <span className="mx-2 text-white/50">vs</span> {animalBName}
                    </p>
                </div>
            </div>
        </section>
    );
}
