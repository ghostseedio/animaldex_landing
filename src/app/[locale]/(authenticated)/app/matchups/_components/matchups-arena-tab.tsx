"use client";

import {useMemo, useState} from "react";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import MatchupOpponentCard from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-opponent-card";
import PopularBreakdownsRail from "@/app/[locale]/(authenticated)/app/matchups/_components/popular-breakdowns-rail";
import type {MatchupArenaFilter, MatchupOpponent, MatchupRosterCapture} from "@/data/matchups-types";
import type {SpeciesComparisonSummary} from "@/data/species-comparisons";
import {tierRank} from "@/lib/matchup-stats";

const FILTERS: Array<{id: MatchupArenaFilter; label: string; icon: string}> = [
    {id: "all", label: "All", icon: "◎"},
    {id: "nearTier", label: "Near my tier", icon: "≈"},
    {id: "lowStake", label: "Low stake", icon: "↓"},
    {id: "highReward", label: "High reward", icon: "★"}
];

function filterOpponents(
    opponents: MatchupOpponent[],
    filter: MatchupArenaFilter,
    roster: MatchupRosterCapture[]
) {
    if (filter === "all") return opponents;

    const rosterTiers = roster.map((capture) => tierRank(capture.battleTier));

    return opponents.filter((opponent) => {
        if (filter === "nearTier") {
            if (!rosterTiers.length) return true;
            const opponentRank = tierRank(opponent.battleTier);
            return rosterTiers.some((rank) => Math.abs(rank - opponentRank) <= 1);
        }
        if (filter === "lowStake") return opponent.challengeStake <= 5;
        if (filter === "highReward") return opponent.estimatedPayout >= 15;
        return true;
    });
}

export default function MatchupsArenaTab({
    opponents,
    roster,
    popularBreakdowns,
    onOpenSettings,
    onChallenge
}: {
    opponents: MatchupOpponent[];
    roster: MatchupRosterCapture[];
    popularBreakdowns: SpeciesComparisonSummary[];
    onOpenSettings: () => void;
    onChallenge: (opponent: MatchupOpponent) => void;
}) {
    const [filter, setFilter] = useState<MatchupArenaFilter>("all");

    const filtered = useMemo(
        () => filterOpponents(opponents, filter, roster),
        [filter, opponents, roster]
    );

    return (
        <div className="space-y-5">
            <PopularBreakdownsRail items={popularBreakdowns} />

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {FILTERS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setFilter(item.id)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition ${filter === item.id ? "bg-primary-400 text-black" : "border border-white/10 bg-white/[0.03] text-white/55 hover:text-white"}`}
                    >
                        <span aria-hidden="true" className="text-[0.72rem] opacity-80">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </div>

            {filtered.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                    {filtered.map((opponent) => (
                        <MatchupOpponentCard
                            key={opponent.captureId}
                            opponent={opponent}
                            onChallenge={() => onChallenge(opponent)}
                        />
                    ))}
                </div>
            ) : (
                <AppEmpty
                    icon="spark"
                    title="No animals to compare"
                    detail="Make an animal public and comparison-ready, or check back soon."
                    action={(
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white"
                        >
                            Settings
                        </button>
                    )}
                />
            )}
        </div>
    );
}
