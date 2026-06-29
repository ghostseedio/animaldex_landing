import type {SpeciesStatsResolution} from "@/data/species-stats";

type Props = {
    title: string;
    description: string;
    animalAName: string;
    animalBName: string;
    animalAResult: SpeciesStatsResolution;
    animalBResult: SpeciesStatsResolution;
    animalABattleTier: string | null;
    animalBBattleTier: string | null;
    labels: Record<string, string>;
};

const ROWS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

export default function ChallengeSpeciesStatsComparison({title, description, animalAName, animalBName, animalAResult, animalBResult, animalABattleTier, animalBBattleTier, labels}: Props) {
    if (!animalAResult.stats || !animalBResult.stats) return null;

    return (
        <section id="stats" className="scroll-mt-28 space-y-6 py-4">
            <div className="max-w-3xl">
                <h2 className="font-display text-3xl font-bold text-white md:text-5xl">{title}</h2>
                <p className="mt-3 text-base leading-7 text-ink-200 md:text-lg">{description}</p>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-line-300 bg-surface-900/80">
                <div className="grid grid-cols-[1fr_6.5rem_1fr] items-center border-b border-line-300 bg-surface-800/70 px-3 py-5 text-center md:grid-cols-[1fr_11rem_1fr] md:px-6">
                    <div><p className="font-display text-xl font-bold text-white md:text-2xl">{animalAName}</p>{animalABattleTier ? <span className="text-xs font-bold text-emerald-300">{labels.battleTierChip.replace("{tier}", animalABattleTier)}</span> : null}</div>
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-ink-300">VS</span>
                    <div><p className="font-display text-xl font-bold text-white md:text-2xl">{animalBName}</p>{animalBBattleTier ? <span className="text-xs font-bold text-sky-300">{labels.battleTierChip.replace("{tier}", animalBBattleTier)}</span> : null}</div>
                </div>

                {ROWS.map((key) => {
                    const a = animalAResult.stats![key];
                    const b = animalBResult.stats![key];
                    const edge = a === b ? "even" : a > b ? "a" : "b";
                    return (
                        <div key={key} title={`${labels.advantage}: ${edge === "a" ? animalAName : edge === "b" ? animalBName : labels.even}`} className="group grid grid-cols-[1fr_6.5rem_1fr] items-center border-b border-line-300/60 px-3 py-5 last:border-0 hover:bg-white/[0.025] md:grid-cols-[1fr_11rem_1fr] md:px-6">
                            <div className={`flex items-center justify-end gap-3 ${edge === "a" ? "text-emerald-200" : "text-white"}`}>
                                <span className="text-xl font-black md:text-2xl">{a}</span>
                                <div className="hidden h-2 max-w-52 flex-1 overflow-hidden rounded-full bg-surface-950 sm:block"><div className="ml-auto h-full rounded-full bg-emerald-400 transition-all duration-700" style={{width: `${a}%`}} /></div>
                            </div>
                            <div className="text-center"><span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-200 md:text-sm">{labels[key]}</span>{edge !== "even" ? <span className="mt-1 block text-[10px] font-bold text-primary-300 opacity-0 transition group-hover:opacity-100">+{Math.abs(a - b)}</span> : null}</div>
                            <div className={`flex items-center gap-3 ${edge === "b" ? "text-sky-200" : "text-white"}`}>
                                <div className="hidden h-2 max-w-52 flex-1 overflow-hidden rounded-full bg-surface-950 sm:block"><div className="h-full rounded-full bg-sky-400 transition-all duration-700" style={{width: `${b}%`}} /></div>
                                <span className="text-xl font-black md:text-2xl">{b}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
