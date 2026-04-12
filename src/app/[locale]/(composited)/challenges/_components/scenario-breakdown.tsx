import {ChallengeScenario} from "@/data/challenges";

type ScenarioBreakdownProps = {
    title: string;
    description: string;
    items: ChallengeScenario[];
    labels: {
        winner: string;
        animalA: string;
        animalB: string;
        draw: string;
        depends: string;
    };
};

function getWinnerLabel(winner: ChallengeScenario["winner"], labels: ScenarioBreakdownProps["labels"]) {
    switch (winner) {
        case "animalA":
            return labels.animalA;
        case "animalB":
            return labels.animalB;
        case "draw":
            return labels.draw;
        default:
            return labels.depends;
    }
}

export default function ScenarioBreakdown({
    title,
    description,
    items,
    labels
}: ScenarioBreakdownProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                    <article
                        key={item.slug}
                        className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 flex flex-col gap-3"
                    >
                        <h3 className="text-white text-2xl font-semibold">{item.title}</h3>
                        <div className="flex flex-wrap gap-2 items-center">
                            <span className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs uppercase tracking-[0.22em] font-semibold">
                                {labels.winner}
                            </span>
                            <span className="rounded-full border border-line-300/80 px-3 py-1 text-ink-200 text-sm">
                                {getWinnerLabel(item.winner, labels)}
                            </span>
                        </div>
                        <p className="text-white text-lg font-medium">{item.verdict}</p>
                        <p className="text-ink-200 text-base md:text-lg leading-7">{item.explanation}</p>
                    </article>
                ))}
            </div>
        </section>
    );
}
