"use client";

import type {MatchupGameStats} from "@/lib/matchup-stats";
import {formatStatLabel} from "@/lib/matchup-stats";

const STAT_KEYS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

export default function MatchupStatBars({
    attackerLabel,
    defenderLabel,
    attackerStats,
    defenderStats,
    highlightStat
}: {
    attackerLabel: string;
    defenderLabel: string;
    attackerStats: MatchupGameStats;
    defenderStats: MatchupGameStats;
    highlightStat?: string | null;
}) {
    return (
        <div className="space-y-2.5">
            {STAT_KEYS.map((key) => {
                const left = attackerStats[key];
                const right = defenderStats[key];
                const total = Math.max(left + right, 1);
                const leftWidth = Math.round(left / total * 100);
                const highlighted = highlightStat?.toLowerCase() === key;

                return (
                    <div key={key} className={`rounded-2xl border px-3 py-2.5 ${highlighted ? "border-primary-400/35 bg-primary-400/5" : "border-white/10 bg-white/[0.03]"}`}>
                        <div className="mb-2 flex items-center justify-between text-[0.65rem] font-black uppercase tracking-[0.14em] text-white/35">
                            <span>{attackerLabel} {left}</span>
                            <span>{formatStatLabel(key)}</span>
                            <span>{right} {defenderLabel}</span>
                        </div>
                        <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full bg-primary-400 transition-all" style={{width: `${leftWidth}%`}} />
                            <div className="h-full flex-1 bg-violet-400/80" />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
