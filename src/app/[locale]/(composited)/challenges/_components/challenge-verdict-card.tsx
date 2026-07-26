import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";

type ChallengeVerdictCardProps = {
    title: string;
    description?: string;
    summary: string;
    paragraphs: string[];
    winner?: {slug: string; name: string; imageFile?: string | null};
    winnerLabel?: string;
    confidence?: number;
    confidenceLabel?: string;
    fullAnalysisLabel?: string;
};

export default function ChallengeVerdictCard({
    title,
    description,
    summary,
    paragraphs,
    winner,
    winnerLabel,
    confidence = 78,
    confidenceLabel,
    fullAnalysisLabel
}: ChallengeVerdictCardProps) {
    return (
        <section id="winner" className="overflow-hidden rounded-[2rem] border border-primary-500/25 bg-gradient-to-br from-primary-500/12 via-surface-900 to-violet-500/10 shadow-xl">
            <div className={winner ? "grid lg:grid-cols-[19rem_1fr]" : "grid"}>
                {winner ? (
                    <div className="relative min-h-64 lg:min-h-full">
                        <SpeciesArtworkImage slug={winner.slug} alt={winner.name} imageFile={winner.imageFile} className="absolute inset-0 h-full w-full" sizes="(min-width: 1024px) 19rem, 100vw" />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-transparent to-transparent lg:bg-gradient-to-r" />
                        <div className="absolute bottom-5 left-5">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-100">{winnerLabel}</p>
                            <p className="font-display text-3xl font-bold text-white">{winner.name}</p>
                        </div>
                    </div>
                ) : null}

                <div className="flex flex-col gap-5 p-6 md:p-9 lg:p-10">
                    <div>
                        <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-primary-200">{title}</p>
                        {description ? <p className="text-sm text-ink-300 md:text-base">{description}</p> : null}
                    </div>
                    <p className="font-display text-2xl font-bold leading-tight text-white md:text-4xl">{summary}</p>

                    {confidenceLabel ? (
                        <div className="max-w-xl">
                            <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-ink-200">
                                <span>{confidenceLabel}</span><span>{confidence}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-surface-950">
                                <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-amber-300" style={{width: `${confidence}%`}} />
                            </div>
                        </div>
                    ) : null}

                    {paragraphs.length > 0 ? (
                        <details className="group border-t border-white/10 pt-4">
                            <summary className="cursor-pointer list-none font-semibold text-primary-100 marker:hidden">
                                {fullAnalysisLabel || title} <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-45">+</span>
                            </summary>
                            <div className="mt-4 space-y-4">
                                {paragraphs.map((paragraph) => <p key={paragraph} className="max-w-3xl text-base leading-7 text-ink-200 md:text-lg">{paragraph}</p>)}
                            </div>
                        </details>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
