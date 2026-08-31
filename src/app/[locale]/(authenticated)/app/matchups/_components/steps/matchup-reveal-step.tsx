"use client";

import {useEffect, useRef, useState} from "react";
import type {MatchupOpponent, MatchupResolveResult, MatchupRosterCapture} from "@/data/matchups-types";
import {
    MATCHUP_STAT_KEYS,
    MATCHUP_STAT_THEME,
    formatStatValue,
    normalizeStatKey,
    statLabel,
    statValue,
    type MatchupStatKey
} from "@/lib/matchup-stat-theme";
import {
    playChallengeCharge,
    playChallengeResolve,
    playMatchupLoss,
    playMatchupWin
} from "@/lib/matchup-sounds";

const FAST_STEP_MS = 150;
const SLOW_STEP_MS = 220;
const SETTLE_MS = 550;
const SUSPENSE_CYCLES = MATCHUP_STAT_KEYS.length * 6;
const CHARGE_SOUND_GAP_MS = 550;

export default function MatchupRevealStep({
    attacker,
    opponent,
    result,
    viewerUserId,
    onRevealComplete
}: {
    attacker: MatchupRosterCapture;
    opponent: MatchupOpponent;
    result: MatchupResolveResult | null;
    viewerUserId: string;
    onRevealComplete: () => void;
}) {
    const [highlightedStat, setHighlightedStat] = useState<MatchupStatKey>("dominance");
    const [hasResolvedReveal, setHasResolvedReveal] = useState(false);
    const [statusLine, setStatusLine] = useState("Generating scenario…");
    const lastChargeAt = useRef(0);
    const completedRef = useRef(false);
    const revealedRef = useRef(false);

    const chosenStat = normalizeStatKey(result?.chosenStat);
    const viewerWon = result ? result.winnerUserId === viewerUserId : false;
    const bestOfThree = result?.challengeFormat === "best_of_3_v2";
    const winnerName = result
        ? (result.winnerCaptureId === attacker.captureId ? attacker.animalName : opponent.animalName)
        : null;

    useEffect(() => {
        if (!result || completedRef.current) return;

        const resolved = result;
        let cancelled = false;
        const timeouts: number[] = [];

        function sleep(ms: number) {
            return new Promise<void>((resolve) => {
                const id = window.setTimeout(resolve, ms);
                timeouts.push(id);
            });
        }

        function highlight(stat: MatchupStatKey) {
            if (cancelled) return;
            setHighlightedStat((current) => {
                if (current !== stat) {
                    const now = performance.now();
                    if (!revealedRef.current && now - lastChargeAt.current >= CHARGE_SOUND_GAP_MS) {
                        lastChargeAt.current = now;
                        playChallengeCharge();
                    }
                }
                return stat;
            });
            setStatusLine(`Reading ${statLabel(stat).toLowerCase()}…`);
        }

        async function runReveal() {
            setStatusLine("Comparing instincts…");
            let index = 0;

            for (let step = 0; step < SUSPENSE_CYCLES; step += 1) {
                if (cancelled) return;
                highlight(MATCHUP_STAT_KEYS[index]);
                await sleep(FAST_STEP_MS);
                index = (index + 1) % MATCHUP_STAT_KEYS.length;
            }

            const targetIndex = MATCHUP_STAT_KEYS.indexOf(chosenStat);
            while (!cancelled && index !== targetIndex) {
                highlight(MATCHUP_STAT_KEYS[index]);
                await sleep(SLOW_STEP_MS);
                index = (index + 1) % MATCHUP_STAT_KEYS.length;
            }

            if (cancelled) return;
            highlight(chosenStat);
            setStatusLine("Judging scenario fit…");
            await sleep(SETTLE_MS);

            if (cancelled) return;
            revealedRef.current = true;
            playChallengeResolve();
            setHasResolvedReveal(true);
            setStatusLine(resolved.scenarioTitle);

            const viewerWonReveal = resolved.winnerUserId === viewerUserId;
            if (viewerWonReveal) {
                playMatchupWin();
            } else {
                playMatchupLoss();
            }

            await sleep(1200);
            if (cancelled || completedRef.current) return;
            completedRef.current = true;
            onRevealComplete();
        }

        void runReveal();

        return () => {
            cancelled = true;
            timeouts.forEach((id) => window.clearTimeout(id));
        };
    }, [chosenStat, onRevealComplete, result, viewerUserId]);

    if (!result) {
        return (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-5 text-center">
                <div className="relative h-20 w-20">
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary-400/20" />
                    <div className="absolute inset-2 rounded-full border-2 border-primary-400/40 border-t-primary-400 animate-spin" />
                </div>
                <div>
                    <p className="font-display text-2xl font-bold text-white">Generating scenario</p>
                    <p className="mt-2 text-sm text-white/45">{statusLine}</p>
                </div>
            </div>
        );
    }

    const theme = MATCHUP_STAT_THEME[highlightedStat];
    const attackerValue = statValue(
        attacker.gameStats,
        highlightedStat,
        normalizeStatKey(result.chosenStat) === highlightedStat ? result.attackerStatValue : null
    );
    const defenderValue = statValue(
        opponent.gameStats,
        highlightedStat,
        normalizeStatKey(result.chosenStat) === highlightedStat ? result.defenderStatValue : null
    );
    const total = Math.max(attackerValue + defenderValue, 1);
    const attackerWidth = Math.round(attackerValue / total * 100);

    return (
        <div className="space-y-5">
            <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(160deg,rgba(16,24,18,0.98),rgba(8,10,9,0.98))] p-4 shadow-[0_24px_60px_-34px_rgba(0,0,0,0.95)]">
                <div className="relative space-y-4">
                    <div className="text-center">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-primary-200">
                            {hasResolvedReveal ? (bestOfThree ? "Round 1 of 3 resolved" : "Scenario fit resolved") : "Revealing scenario"}
                        </p>
                        <h3 className="mt-2 font-display text-2xl font-bold text-white">
                            {hasResolvedReveal ? result.scenarioTitle : "Reading matchup"}
                        </h3>
                        <p className="mt-2 text-sm text-white/45">{statusLine}</p>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <div className={`text-center transition ${hasResolvedReveal && result.winnerCaptureId !== attacker.captureId ? "opacity-45" : ""}`}>
                            <img src={attacker.imageSrc} alt="" className={`mx-auto h-16 w-16 rounded-2xl border object-cover ${hasResolvedReveal && result.winnerCaptureId === attacker.captureId ? "border-primary-400 shadow-[0_0_24px_rgba(167,244,50,0.35)]" : "border-white/10"}`} />
                            <p className="mt-2 text-xs font-bold text-white">{attacker.animalName}</p>
                            <p className="text-[0.62rem] text-white/35">You</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${hasResolvedReveal ? "bg-primary-400 text-black" : "bg-white/10 text-white/55"}`}>VS</span>
                        <div className={`text-center transition ${hasResolvedReveal && result.winnerCaptureId !== opponent.captureId ? "opacity-45" : ""}`}>
                            <img src={opponent.imageSrc} alt="" className={`mx-auto h-16 w-16 rounded-2xl border object-cover ${hasResolvedReveal && result.winnerCaptureId === opponent.captureId ? "border-primary-400 shadow-[0_0_24px_rgba(167,244,50,0.35)]" : "border-white/10"}`} />
                            <p className="mt-2 text-xs font-bold text-white">{opponent.animalName}</p>
                            <p className="text-[0.62rem] text-white/35">Opponent</p>
                        </div>
                    </div>

                    <div
                        className="rounded-[1.2rem] border px-4 py-4 transition duration-200"
                        style={{
                            borderColor: `${theme.color}55`,
                            background: `linear-gradient(180deg, ${theme.glow}, rgba(255,255,255,0.02))`,
                            boxShadow: `0 16px 40px -28px ${theme.glow}`
                        }}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-[0.62rem] font-black uppercase tracking-[0.16em]" style={{color: theme.color}}>
                                {theme.short}
                            </span>
                            <span className="font-display text-lg font-bold text-white">{statLabel(highlightedStat)}</span>
                            <span className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/25">Live</span>
                        </div>

                        <div className="mt-4 flex items-end justify-between gap-4">
                            <div className="text-center">
                                <p className="font-display text-3xl font-bold tabular-nums text-white">{formatStatValue(highlightedStat, attackerValue)}</p>
                                <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/35">You</p>
                            </div>
                            <div className="text-center">
                                <p className="font-display text-3xl font-bold tabular-nums text-white">{formatStatValue(highlightedStat, defenderValue)}</p>
                                <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/35">Them</p>
                            </div>
                        </div>

                        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="h-full bg-primary-400 transition-all duration-150" style={{width: `${attackerWidth}%`}} />
                            <div className="h-full flex-1 bg-violet-400/80 transition-all duration-150" />
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                        {MATCHUP_STAT_KEYS.map((key) => {
                            const active = key === highlightedStat;
                            const item = MATCHUP_STAT_THEME[key];
                            return (
                                <span
                                    key={key}
                                    className={`rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] transition ${active ? "text-black" : "text-white/35"}`}
                                    style={active ? {backgroundColor: item.color} : {backgroundColor: "rgba(255,255,255,0.05)"}}
                                >
                                    {item.short}
                                </span>
                            );
                        })}
                    </div>

                    {hasResolvedReveal && winnerName ? (
                        <div className={`rounded-[1.1rem] border px-4 py-4 text-center transition ${viewerWon ? "border-primary-400/35 bg-primary-400/10" : "border-rose-400/25 bg-rose-400/10"}`}>
                            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/35">
                                {viewerWon ? "You won" : "You lost"}
                            </p>
                            <p className="mt-2 font-display text-2xl font-bold text-white">{winnerName}</p>
                            <p className="mt-1 text-sm text-white/50">
                                {bestOfThree
                                    ? `${result.decidingEdgeLabel ?? statLabel(chosenStat)} decided Round 1.`
                                    : `${result.decidingEdgeLabel ?? statLabel(chosenStat)} decided the scenario.`}
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-3 py-2 text-sm text-white/45">
                            <span className="relative h-8 w-8">
                                <span className="absolute inset-0 animate-ping rounded-full bg-primary-400/15" />
                                <span className="absolute inset-1 rounded-full border-2 border-primary-400/30 border-t-primary-400 animate-spin" />
                            </span>
                            Cycling stats before the final reveal…
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
