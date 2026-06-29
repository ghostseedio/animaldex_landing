import {ChallengeStatCategory} from "@/data/challenges";

type Props = {
    title: string;
    description: string;
    animalAName: string;
    animalBName: string;
    items: ChallengeStatCategory[];
    labels: {advantage: string; takeaway: string; animalAAdvantage: string; animalBAdvantage: string; even: string; depends: string};
};

export default function AnimalVsStatTable({title, description, animalAName, animalBName, items, labels}: Props) {
    const edge = (item: ChallengeStatCategory) => item.advantage === "animalA" ? animalAName : item.advantage === "animalB" ? animalBName : item.advantage === "even" ? labels.even : labels.depends;

    return (
        <section className="space-y-5">
            <div className="max-w-3xl"><h2 className="font-display text-2xl font-bold text-white md:text-4xl">{title}</h2><p className="mt-2 text-base leading-7 text-ink-200">{description}</p></div>
            <div className="overflow-x-auto rounded-[2rem] border border-line-300 bg-surface-900/70">
                <div className="min-w-[52rem]">
                    <div className="grid grid-cols-[1fr_10rem_1fr] border-b border-line-300 bg-surface-800/60 px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-ink-200"><span>{animalAName}</span><span className="text-center">{labels.advantage}</span><span className="text-right">{animalBName}</span></div>
                    {items.map((item) => (
                        <details key={item.key} className="group border-b border-line-300/60 last:border-0">
                            <summary className="grid cursor-pointer list-none grid-cols-[1fr_10rem_1fr] items-center gap-5 px-6 py-5 marker:hidden hover:bg-white/[0.025]">
                                <p className="text-sm leading-6 text-ink-200">{item.animalAValue}</p>
                                <div className="text-center"><p className="text-xs font-black uppercase tracking-[0.12em] text-primary-200">{item.label}</p><p className="mt-1 text-sm font-bold text-white">{edge(item)}</p></div>
                                <p className="text-right text-sm leading-6 text-ink-200">{item.animalBValue}</p>
                            </summary>
                            <div className="border-t border-line-300/40 bg-surface-950/45 px-6 py-4 text-center"><span className="mr-2 text-xs font-black uppercase tracking-[0.12em] text-primary-200">{labels.takeaway}</span><span className="text-sm text-ink-100">{item.takeaway}</span></div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
