import {getBattleTier, type AnimalBattleTier, type SpeciesStats} from "@/lib/battle-tier";

const STAT_LABELS: Array<{key: keyof SpeciesStats; label: string}> = [
    {key: "dominance", label: "Dominance"},
    {key: "speed", label: "Speed"},
    {key: "size", label: "Size"},
    {key: "intelligence", label: "Intelligence"},
    {key: "rarity", label: "Rarity"}
];

const TIER_NOTE: Record<AnimalBattleTier, string> = {
    S: "Apex across the catalogue",
    A: "Top tier in most matchups",
    B: "Strong in its weight class",
    C: "Even matchup against most species",
    D: "Wins on evasion rather than force",
    E: "Survives by avoiding contests"
};

/**
 * The five canonical stats for one species.
 *
 * Every bar measures the same thing on the same 0–100 scale, so this is a single
 * series: one hue throughout, no legend, and the value direct-labelled on each row
 * rather than an axis. A radar plot was the obvious temptation and the wrong one —
 * it makes area, not length, carry the number, and the shape changes meaning with
 * the order of the spokes.
 *
 * Square bar ends, matching the flat surfaces used across these pages.
 */
export default function SpeciesStatMeters({stats}: {stats: SpeciesStats}) {
    const tier = getBattleTier(stats);

    return (
        <figure className="m-0 flex flex-col gap-5">
            <div className="flex flex-col gap-3.5">
                {STAT_LABELS.map(({key, label}) => {
                    const value = Math.max(0, Math.min(100, Math.round(Number(stats[key]) || 0)));

                    return (
                        <div key={key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 sm:grid-cols-[9rem_1fr_3rem] sm:gap-4">
                            <span className="text-[13px] font-semibold text-ink-200 sm:text-sm">{label}</span>
                            <span className="relative block h-2 bg-white/[0.06]">
                                <span
                                    className="absolute inset-y-0 left-0 bg-primary-400"
                                    style={{width: `${value}%`}}
                                />
                            </span>
                            <span className="text-right font-mono text-[13px] tabular-nums text-white sm:text-sm">{value}</span>
                        </div>
                    );
                })}
            </div>
            {tier ? (
                <figcaption className="flex items-center gap-2.5 border-t border-line-300 pt-4 text-[13px] text-ink-300">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center border border-primary-500/30 bg-primary-400/10 px-1.5 font-mono text-xs font-bold text-primary-200">
                        {tier}
                    </span>
                    <span>{TIER_NOTE[tier]}</span>
                </figcaption>
            ) : null}
        </figure>
    );
}
