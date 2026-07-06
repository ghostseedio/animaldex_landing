"use client";

import {useMemo, useState} from "react";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import MatchupOpponentCard from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-opponent-card";
import ChallengeSettingsSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/challenge-settings-sheet";
import type {MatchupArenaFilter, MatchupOpponent, MatchupRosterCapture} from "@/data/matchups-types";
import {tierRank} from "@/lib/matchup-stats";

const FILTERS: Array<{id: MatchupArenaFilter; label: string; disabled?: boolean}> = [
    {id: "all", label: "All"},
    {id: "nearTier", label: "Near my tier"},
    {id: "lowStake", label: "Low stake"},
    {id: "highReward", label: "High reward"}
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
    onChallenge
}: {
    opponents: MatchupOpponent[];
    roster: MatchupRosterCapture[];
    onChallenge: (opponent: MatchupOpponent) => void;
}) {
    const [filter, setFilter] = useState<MatchupArenaFilter>("all");
    const [settingsOpen, setSettingsOpen] = useState(false);

    const filtered = useMemo(
        () => filterOpponents(opponents, filter, roster),
        [filter, opponents, roster]
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => setFilter(item.id)}
                        className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${filter === item.id ? "bg-primary-400 text-black" : "border border-white/10 bg-white/[0.03] text-white/55 hover:text-white"} ${item.disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
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
                    title="No matchups available"
                    detail="Make an animal public and comparison-ready, or check back soon."
                    action={(
                        <button
                            type="button"
                            onClick={() => setSettingsOpen(true)}
                            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white"
                        >
                            Manage challenge settings
                        </button>
                    )}
                />
            )}

            {filtered.length ? (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className="text-sm font-black text-primary-300"
                    >
                        Manage challenge settings
                    </button>
                </div>
            ) : null}

            {settingsOpen ? <ChallengeSettingsSheet roster={roster} onClose={() => setSettingsOpen(false)} /> : null}
        </div>
    );
}
