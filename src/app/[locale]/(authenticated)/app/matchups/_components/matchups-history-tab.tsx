"use client";

import {useEffect, useState} from "react";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import MatchupResultDetailSheet from "@/app/[locale]/(authenticated)/app/matchups/_components/matchup-result-detail-sheet";
import type {MatchupHistoryItem} from "@/data/matchups-types";
import {battleHistoryStatus, isBattleComplete, isBattleVoting, isBestOfThreeBattle} from "@/lib/matchup-battle-rules";

const NEON = "#A7F432";
const FAIL = "rgb(250,115,133)";

/** "now", "5m ago", "3h ago", "2d ago", then a date — iOS `relativeTimestamp`. */
function relativeTimestamp(value: string, now: number) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return "";
    const minutes = Math.floor((now - parsed) / 60_000);
    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(parsed).toLocaleDateString(undefined, {day: "numeric", month: "short"});
}

/** iOS `historyVotingTimeRemaining`. */
function votingTimeRemaining(milliseconds: number) {
    const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
    if (minutes <= 0) return "Closing now";
    const hours = Math.floor(minutes / 60);
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${minutes % 60}m left`;
    return `${minutes}m left`;
}

function VotingCountdown({item, now}: {item: MatchupHistoryItem; now: number}) {
    if (!item.votingDeadlineAt) return null;
    const deadline = Date.parse(item.votingDeadlineAt);
    const created = Date.parse(item.date);
    if (!Number.isFinite(deadline)) return null;
    const total = Math.max(1, deadline - (Number.isFinite(created) ? created : now));
    const remaining = Math.max(0, deadline - now);
    const tint = remaining <= 3_600_000 ? "rgb(255,149,0)" : NEON;
    const label = votingTimeRemaining(remaining);
    return (
        <span
            className="mt-0.5 flex flex-col gap-1"
            role="img"
            aria-label={`Voting closes in ${label}. The animal with the most votes then wins Round 2, and a tie is a draw.`}
        >
            <span className="flex items-center gap-1" style={{color: tint}}>
                <span className="text-[10px] font-black tabular-nums">⏱ {label}</span>
                <span className="ml-auto text-[8px] font-bold text-white/40">Most votes wins</span>
            </span>
            <span className="h-1 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full rounded-full" style={{width: `${Math.min(100, (remaining / total) * 100)}%`, backgroundColor: tint}} />
            </span>
        </span>
    );
}

/** iOS `MatchupPersonalHistoryRow`. */
function HistoryRow({item, now, onOpen}: {item: MatchupHistoryItem; now: number; onOpen: () => void}) {
    const voting = isBattleVoting(item);
    const status = battleHistoryStatus(item);
    const delta = item.creditsDelta;
    return (
        <button
            type="button"
            onClick={onOpen}
            className="flex w-full items-center gap-3 border-b border-white/[0.08] bg-[#141414] px-4 py-3.5 text-left transition first:border-t hover:bg-white/[0.04]"
        >
            <span className="relative flex shrink-0 gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.attackerImageSrc} alt="" className="h-11 w-11 border border-white/10 object-cover" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.defenderImageSrc} alt="" className="h-11 w-11 border border-white/10 object-cover" />
                <span className="absolute left-1/2 top-1/2 grid h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-black/35 bg-primary-400 text-[9px] font-black text-black/90" aria-hidden="true">⇄</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="truncate text-sm font-extrabold text-white">{item.attackerAnimalName} vs {item.defenderAnimalName}</span>
                <span className="text-[11px] text-white/40">🕒 {relativeTimestamp(item.date, now)}</span>
                {status ? <span className="text-[11px] font-bold" style={{color: NEON}}>{status}</span> : null}
                {voting ? <VotingCountdown item={item} now={now} /> : null}
            </span>
            {voting ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                    <span aria-hidden="true" className="text-[13px] text-cyan-300">🔒</span>
                    <span className="text-[10px] font-extrabold text-white/60">{item.stakeAmount} staked</span>
                </span>
            ) : isBattleComplete(item) || !isBestOfThreeBattle(item) ? (
                <span className="flex shrink-0 flex-col items-end gap-1">
                    <span aria-hidden="true" className="text-sm" style={{color: item.viewerDrew ? "rgba(255,255,255,0.6)" : item.viewerWon ? NEON : FAIL}}>
                        {item.viewerDrew ? "=" : item.viewerWon ? "🏆" : "✕"}
                    </span>
                    <span className="text-xs font-extrabold" style={{color: delta >= 0 ? NEON : FAIL}}>{delta >= 0 ? `+${delta}` : delta}</span>
                </span>
            ) : null}
        </button>
    );
}

export default function MatchupsHistoryTab({
    history
}: {
    history: MatchupHistoryItem[];
    locale?: string;
}) {
    const [selected, setSelected] = useState<MatchupHistoryItem | null>(null);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    if (!history.length) {
        return (
            <AppEmpty
                icon="spark"
                title="No comparisons yet"
                detail="Your past animal comparisons will show up here."
            />
        );
    }

    const active = history.filter((item) => isBestOfThreeBattle(item) && !isBattleComplete(item));
    const complete = history.filter((item) => !isBestOfThreeBattle(item) || isBattleComplete(item));

    const section = (title: string, items: MatchupHistoryItem[]) => items.length ? (
        <section key={title}>
            <h3 className="px-4 pb-2 pt-1 text-xs font-black uppercase tracking-[0.08em] text-white/60 md:px-1">{title}</h3>
            <div className="-mx-4 md:mx-0 md:overflow-hidden md:border md:border-white/[0.08]">
                {items.map((item) => (
                    <HistoryRow key={item.id} item={item} now={now} onOpen={() => setSelected(item)} />
                ))}
            </div>
        </section>
    ) : null;

    return (
        <>
            <div className="space-y-3">
                {section("Active", active)}
                {section("Complete", complete)}
            </div>
            {selected ? <MatchupResultDetailSheet item={selected} onClose={() => setSelected(null)} /> : null}
        </>
    );
}
