"use client";

import {useState} from "react";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import MatchupResultDetailSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-result-detail-sheet";
import type {MatchupHistoryItem} from "@/data/matchups-types";
import {formatAppShortDateWithYear} from "@/lib/app-dates";

export default function MatchupsHistoryTab({
    history,
    locale
}: {
    history: MatchupHistoryItem[];
    locale: string;
}) {
    const [selected, setSelected] = useState<MatchupHistoryItem | null>(null);

    if (!history.length) {
        return (
            <AppEmpty
                icon="spark"
                title="No matchup history yet"
                detail="Your resolved Scenario Arena battles will appear here."
            />
        );
    }

    return (
        <>
            <div className="space-y-3">
                {history.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelected(item)}
                        className="flex w-full items-center gap-4 rounded-[1.2rem] border border-white/10 bg-[#121212] px-4 py-4 text-left transition hover:border-primary-400/25"
                    >
                        <div className="flex items-center gap-2">
                            <img src={item.attackerImageSrc} alt="" className="h-12 w-12 rounded-xl object-cover" />
                            <span className="text-xs font-black text-white/25">VS</span>
                            <img src={item.defenderImageSrc} alt="" className="h-12 w-12 rounded-xl object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-display text-lg font-bold text-white">
                                {item.scenarioTitle ?? "Scenario Arena"}
                            </p>
                            <p className="mt-1 truncate text-sm text-white/45">
                                {item.attackerAnimalName} vs {item.defenderAnimalName}
                            </p>
                            <p className="mt-1 text-xs text-white/30">
                                {formatAppShortDateWithYear(item.date, locale)}
                            </p>
                        </div>
                        <div className="shrink-0 text-right">
                            <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] ${item.viewerWon ? "bg-primary-400/15 text-primary-200" : "bg-rose-400/10 text-rose-200"}`}>
                                {item.viewerWon ? "Won" : "Lost"}
                            </span>
                            <p className={`mt-2 text-sm font-bold ${item.creditsDelta >= 0 ? "text-primary-200" : "text-rose-300"}`}>
                                {item.creditsDelta >= 0 ? "+" : ""}{item.creditsDelta}
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            {selected ? <MatchupResultDetailSheet item={selected} onClose={() => setSelected(null)} /> : null}
        </>
    );
}
