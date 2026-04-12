import {ChallengeStatCategory} from "@/data/challenges";

type AnimalVsStatTableProps = {
    title: string;
    description: string;
    animalAName: string;
    animalBName: string;
    items: ChallengeStatCategory[];
    labels: {
        advantage: string;
        takeaway: string;
        animalAAdvantage: string;
        animalBAdvantage: string;
        even: string;
        depends: string;
    };
};

function getAdvantageClassName(advantage: ChallengeStatCategory["advantage"]) {
    switch (advantage) {
        case "animalA":
            return "border-emerald-300/25 bg-emerald-500/15 text-emerald-100";
        case "animalB":
            return "border-sky-300/25 bg-sky-500/15 text-sky-100";
        case "even":
            return "border-amber-300/25 bg-amber-500/15 text-amber-100";
        default:
            return "border-violet-300/25 bg-violet-500/15 text-violet-100";
    }
}

function getAdvantageLabel(
    advantage: ChallengeStatCategory["advantage"],
    labels: AnimalVsStatTableProps["labels"]
) {
    switch (advantage) {
        case "animalA":
            return labels.animalAAdvantage;
        case "animalB":
            return labels.animalBAdvantage;
        case "even":
            return labels.even;
        default:
            return labels.depends;
    }
}

export default function AnimalVsStatTable({
    title,
    description,
    animalAName,
    animalBName,
    items,
    labels
}: AnimalVsStatTableProps) {
    return (
        <section className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
                <p className="text-ink-200 text-lg md:text-xl">{description}</p>
            </div>

            <div className="flex flex-col gap-4">
                {items.map((item) => (
                    <article
                        key={item.key}
                        className="rounded-3xl border border-line-300/80 bg-surface-800/60 p-5 md:p-6 flex flex-col gap-5"
                    >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <h3 className="text-white text-2xl font-semibold">{item.label}</h3>
                            <div className={`rounded-full border px-3 py-1 text-sm font-semibold ${getAdvantageClassName(item.advantage)}`}>
                                {labels.advantage}: {getAdvantageLabel(item.advantage, labels)}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-line-300/80 bg-surface-950/60 p-4 flex flex-col gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{animalAName}</p>
                                <p className="text-ink-200 text-base md:text-lg leading-7">{item.animalAValue}</p>
                            </div>
                            <div className="rounded-2xl border border-line-300/80 bg-surface-950/60 p-4 flex flex-col gap-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{animalBName}</p>
                                <p className="text-ink-200 text-base md:text-lg leading-7">{item.animalBValue}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-line-300/80 bg-surface-950/60 p-4 flex flex-col gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-200">{labels.takeaway}</p>
                            <p className="text-ink-200 text-base md:text-lg leading-7">{item.takeaway}</p>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
