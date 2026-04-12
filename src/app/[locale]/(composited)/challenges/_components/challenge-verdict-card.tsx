type ChallengeVerdictCardProps = {
    title: string;
    description?: string;
    summary: string;
    paragraphs: string[];
};

export default function ChallengeVerdictCard({
    title,
    description,
    summary,
    paragraphs
}: ChallengeVerdictCardProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
                {description ? (
                    <p className="text-ink-200 text-lg md:text-xl">{description}</p>
                ) : null}
            </div>
            <p className="text-white text-xl md:text-2xl leading-8 font-medium">{summary}</p>
            {paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-ink-200 text-lg md:text-xl leading-8">
                    {paragraph}
                </p>
            ))}
        </section>
    );
}
