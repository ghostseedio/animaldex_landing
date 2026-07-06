"use client";

import {useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import type {CaptureProgressState} from "@/data/species-growth";

const ENDORSEMENT_STATS = ["dominance", "speed", "size", "intelligence", "rarity"] as const;

function levelPresentation(totalXP: number) {
    const xp = Math.max(0, totalXP);
    const level = Math.min(100, Math.floor(Math.sqrt(xp)) + 1);
    const currentThreshold = (level - 1) ** 2;
    const nextThreshold = level >= 100 ? 9801 : level ** 2;
    const span = Math.max(1, nextThreshold - currentThreshold);
    const progressXP = level >= 100 ? 0 : xp - currentThreshold;

    return {
        xp,
        level,
        progressXP,
        span,
        needed: level >= 100 ? 0 : nextThreshold - xp,
        fraction: level >= 100 ? 1 : Math.min(1, Math.max(0, progressXP / span))
    };
}

export function SpeciesLevelProgress({progress}: {progress: CaptureProgressState | null}) {
    if (!progress) return null;
    const level = levelPresentation(progress.totalProgressionXP);

    return (
        <section className="rounded-[18px] border border-white/10 bg-[#1f1f1f] p-3.5 font-sans">
            <div className="flex items-baseline gap-2.5">
                <span className="rounded-full border border-[#38fa47]/25 bg-[#38fa47]/10 px-2.5 py-1.5 text-[11px] font-extrabold text-[#38fa47]">{level.level >= 100 ? "Lvl 100 MAX" : `Lvl ${level.level}`}</span>
                <span className="text-xs font-medium text-white">{level.xp} XP</span>
                <span className="ml-auto text-[11px] font-semibold text-white/40">{level.level >= 100 ? "MAX" : `${level.needed} XP to next`}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-[#38fa47]/80" style={{width: `${level.fraction * 100}%`}} /></div>
            {level.level < 100 ? <p className="mt-2.5 text-[11px] font-semibold text-white/60">{level.progressXP}/{level.span} XP toward Level {level.level + 1}</p> : null}
        </section>
    );
}

export function SpeciesEndorsementAndSize({
    progress,
    speciesName,
    sizeScore,
    isAuthenticated
}: {
    progress: CaptureProgressState | null;
    speciesName: string;
    sizeScore: number | null;
    isAuthenticated: boolean;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const score = Math.min(100, Math.max(0, sizeScore ?? 0));
    const sizeLabel = score <= 3 ? "Microscopic edge" : score <= 10 ? "Tiny" : score <= 22 ? "Small" : score <= 40 ? "Medium" : score <= 60 ? "Large" : score <= 82 ? "Huge" : "Colossal";

    const endorse = (stat: string | null) => {
        if (!progress) return;
        setError(null);
        startTransition(() => { void (async () => {
            const response = await fetch("/api/app/endorsement", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({captureId: progress.captureId, endorsedStat: stat})});
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) { setError(typeof payload.error === "string" ? payload.error : "Unable to update this endorsement right now."); return; }
            setOpen(false);
            router.refresh();
        })(); });
    };

    return (
        <div className="space-y-3 font-sans">
            {progress && !progress.isOwnedByCurrentUser ? (
                isAuthenticated ? (
                    <button type="button" disabled={isPending} onClick={() => setOpen(true)} className="flex w-full items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#38fa47] px-3.5 py-3 text-left text-black disabled:opacity-60">
                        <span aria-hidden="true">👍</span><span className="min-w-0"><span className="block text-xs font-medium">{progress.viewerEndorsementStat ? `Endorsed ${progress.viewerEndorsementStat}` : "Endorse"}</span><span className="mt-0.5 block text-[11px] font-semibold text-black/70">{progress.viewerEndorsementStat ? `Withdraw your ${progress.viewerEndorsementStat} endorsement or keep it locked in.` : "Choose one trait carefully. You only get one endorsement on this animal at a time."}</span></span>
                    </button>
                ) : (
                    <Link href="/account" className="flex w-full items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-[#38fa47] px-3.5 py-3 text-left text-black"><span>👍</span><span><span className="block text-xs font-medium">Endorse</span><span className="mt-0.5 block text-[11px] font-semibold text-black/70">Sign in to choose one trait for this animal.</span></span></Link>
                )
            ) : null}

            {sizeScore != null ? (
                <section className="rounded-[20px] border border-[#38fa47]/15 bg-[linear-gradient(145deg,rgba(56,250,71,0.12),rgba(56,250,71,0.06),#1f1f1f)] p-4">
                    <p className="text-xs font-medium text-white/40">Size scale</p>
                    <div className="mt-3 flex items-start justify-between gap-3"><div><h3 className="text-[17px] font-semibold text-white">{sizeLabel}</h3><p className="mt-1 text-xs font-medium text-white/60">Uses the canonical size stat for consistent placement</p></div><span className="rounded-full bg-gradient-to-r from-[#38fa47]/20 to-violet-400/20 px-3 py-2 text-lg font-extrabold text-[#38fa47]">{score}/100</span></div>
                    <div className="mt-4 overflow-x-auto rounded-[20px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),#121212,rgba(148,84,250,0.08))]">
                        <div className="relative h-[150px] min-w-[560px]">
                            <div className="absolute left-[18px] right-[18px] top-[86px] h-2.5 rounded-full bg-gradient-to-r from-white/10 via-violet-400/15 to-[#38fa47]/10" />
                            <div className="absolute top-8 -translate-x-1/2 text-center" style={{left: `${score}%`}}><span className="block max-w-28 truncate rounded-lg bg-[#1f1f1f] px-2 py-1 text-[11px] font-semibold text-white">{speciesName}</span><span className="mx-auto mt-1 block h-16 w-[3px] bg-gradient-to-b from-[#38fa47] to-violet-400" /></div>
                            {[{p:2,l:"Butterfly"},{p:16,l:"Cat"},{p:30,l:"Dog"},{p:52,l:"Horse"},{p:82,l:"Elephant"},{p:98,l:"Whale Shark"}].map((anchor) => <div key={anchor.l} className="absolute top-[101px] w-[70px] -translate-x-1/2 text-center" style={{left:`${anchor.p}%`}}><span className="mx-auto block h-2 w-2 rounded-full bg-white/35"/><span className="mt-2 block text-[10px] font-semibold text-white/40">{anchor.l}</span></div>)}
                        </div>
                    </div>
                </section>
            ) : null}

            {open && progress ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 md:items-center"><div className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#1f1f1f] p-5"><h3 className="text-lg font-semibold text-white">Endorse one trait</h3><p className="mt-2 text-xs font-medium leading-5 text-white/60">Choose one trait carefully. Each endorsement adds one point to that stat until you withdraw it.</p><div className="mt-4 grid grid-cols-2 gap-2">{ENDORSEMENT_STATS.map((stat) => <button key={stat} type="button" disabled={isPending || progress.viewerEndorsementStat === stat} onClick={() => endorse(stat)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold capitalize text-white disabled:border-[#38fa47]/30 disabled:text-[#38fa47]">{stat}</button>)}</div>{progress.viewerEndorsementStat ? <button type="button" disabled={isPending} onClick={() => endorse(null)} className="mt-3 w-full rounded-full border border-red-400/20 px-3 py-2.5 text-xs font-semibold text-red-300">Withdraw {progress.viewerEndorsementStat} endorsement</button> : null}{error ? <p className="mt-3 text-xs text-orange-300">{error}</p> : null}<button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-full bg-white/10 px-3 py-2.5 text-xs font-semibold text-white">Cancel</button></div></div> : null}
        </div>
    );
}
