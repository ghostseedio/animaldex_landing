"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import MatchupOpponentCard from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-opponent-card";
import PopularBreakdownsRail from "@/app/[locale]/(authenticated)/app/matchups/_components/popular-breakdowns-rail";
import type {MatchupArenaFilter, MatchupOpponent, MatchupRosterCapture} from "@/data/matchups-types";
import type {SpeciesComparisonSummary} from "@/data/species-comparisons";
import {tierRank} from "@/lib/matchup-stats";

/** iOS `MatchupArenaFilter`, titles and order. */
const FILTERS: Array<{id: MatchupArenaFilter; label: string; icon: string}> = [
    {id: "all", label: "All", icon: "▦"},
    {id: "following", label: "Following", icon: "👥"},
    {id: "nearTier", label: "Near tier", icon: "≈"},
    {id: "lowStake", label: "Low stake", icon: "🍃"},
    {id: "highReward", label: "High reward", icon: "⚡"}
];

function filterOpponents(
    opponents: MatchupOpponent[],
    filter: MatchupArenaFilter,
    roster: MatchupRosterCapture[]
) {
    // Following membership was applied by `following_challenge_feed_v1` before its limit.
    if (filter === "all" || filter === "following") return opponents;

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
    const [following, setFollowing] = useState<MatchupOpponent[] | null>(null);
    const [loadingFollowing, setLoadingFollowing] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const request = useRef(0);

    // The Following chip re-reads the arena from the follow-scoped view (iOS `selectArenaFollowingOnly`).
    useEffect(() => {
        if (filter !== "following") return;
        const id = ++request.current;
        setLoadingFollowing(true);
        setFailure(null);
        fetch("/api/app/matchup-arena?following=1", {cache: "no-store"})
            .then(async (response) => {
                if (!response.ok) throw new Error("Couldn't load animals from people you follow.");
                return response.json() as Promise<{arena?: MatchupOpponent[]}>;
            })
            .then((payload) => {
                if (id === request.current) setFollowing(Array.isArray(payload.arena) ? payload.arena : []);
            })
            .catch((error: Error) => {
                if (id === request.current) setFailure(error.message);
            })
            .finally(() => {
                if (id === request.current) setLoadingFollowing(false);
            });
    }, [filter]);

    const filtered = useMemo(
        () => filterOpponents(filter === "following" ? following ?? [] : opponents, filter, roster),
        [filter, following, opponents, roster]
    );

    return (
        <div className="space-y-2">
            <PopularBreakdownsRail items={popularBreakdowns} />

            <div className="sticky top-16 z-10 -mx-4 flex gap-2 overflow-x-auto bg-black px-4 py-1.5 [scrollbar-width:none] lg:top-0 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
                {FILTERS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setFilter(item.id)}
                        aria-pressed={filter === item.id}
                        className={`inline-flex shrink-0 items-center gap-[5px] rounded-full px-3 py-2 text-xs font-bold transition ${filter === item.id ? "bg-primary-400 text-black/90" : "border border-white/10 bg-white/[0.03] text-white/60 hover:text-white"}`}
                    >
                        <span aria-hidden="true" className="text-[11px]">{item.icon}</span>
                        {item.label}
                    </button>
                ))}
            </div>

            {filter === "following" && loadingFollowing && !filtered.length ? (
                <div className="flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#141414] p-3.5 text-sm text-white/60">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" aria-hidden="true" />
                    Finding animals…
                </div>
            ) : failure && !filtered.length ? (
                <AppEmpty icon="spark" title="Comparisons unavailable" detail={failure} />
            ) : filtered.length ? (
                <div className="-mx-4 grid grid-cols-2 md:mx-0 md:gap-2 lg:grid-cols-3">
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
                    icon="search"
                    title="No animals to compare"
                    detail="Make an animal public and comparison-ready, or check back soon."
                    action={(
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-[13px] font-extrabold text-white"
                        >
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                                <path d="M3.5 6.5h13M5.5 10h9M7.5 13.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                            Settings
                        </button>
                    )}
                />
            )}
        </div>
    );
}
