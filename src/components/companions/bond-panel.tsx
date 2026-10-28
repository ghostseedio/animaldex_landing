"use client";

/**
 * The bond screen (docs/companion-loop/SPEC.md, phase 2): the card's Bond tab,
 * and the sheet the chat's bond chip opens. One animal, one level: how well
 * you know, practise and live its lesson, what the two of you are working on,
 * what you have done together, and its Power.
 *
 * Edge-to-edge bands, as everywhere on the card. Every part fails quietly:
 * without `animal_bond_v1` the screen still shows its actions and Trials.
 */

import {useCallback, useEffect, useState} from "react";
import Image from "next/image";
import AnimalTrialDetail from "@/components/animal-detail/animal-trials/animal-trial-detail";
import {
    BOND_COPY,
    bondChipText,
    bondLevelProgress,
    bondPowerLine,
    bondXpText,
    trialDifficulty,
    type AnimalBond
} from "@/lib/companion-bond";
import {type AnimalTrial, isComplete, trialId} from "@/lib/animal-trials";
import {getSpeciesArtworkUrl} from "@/lib/species-artwork";

const NEON = "#A7F432";

/** One Trial's state, in a word. */
function trialStatus(trial: AnimalTrial): string {
    switch (trial.status) {
        case "completed": return "Complete";
        case "active":
        case "proof_submitted": return "Under way";
        case "pending_activation": return "Armed";
        case "expired":
        case "abandoned": return "Missed";
        default: return "Not started";
    }
}

function shortDate(raw: string | null): string | null {
    if (!raw) return null;
    const date = new Date(raw.length === 10 ? `${raw}T00:00:00Z` : raw);
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"});
}

function BandHeader({children}: {children: React.ReactNode}) {
    return <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{children}</h3>;
}

function StrandBar({label, value}: {label: string; value: number}) {
    return (
        <div className="flex flex-col gap-1.5" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-white">{label}</span>
                <span className="text-xs font-bold text-white/55">{value}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full" style={{width: `${value}%`, backgroundColor: NEON}} />
            </div>
        </div>
    );
}

export default function BondPanel({
    bond,
    didLoad,
    speciesProfileId,
    slug,
    name,
    powerName,
    onTalk,
    onAsk,
    onLessonCheck,
    onBondChanged,
    onRefresh,
    canAttemptTrials = true,
    locale = null
}: {
    bond: AnimalBond | null;
    didLoad: boolean;
    speciesProfileId: string | null;
    /** The species' icon-art slug: the animal is shown as its art, never a capture photo. */
    slug: string | null;
    /** "Leo the African Lion", or the animal. */
    name: string;
    /** The Power's name when the bond has not said it. */
    powerName: string | null;
    onTalk: () => void;
    /** Opens the chat and sends this as the person's own message. */
    onAsk: (message: string) => void;
    /** The lesson check. Null hides the action. */
    onLessonCheck: (() => void) | null;
    /** The focus was cleared, or a Trial moved: re-read the bond. */
    onBondChanged: (next: AnimalBond | null) => void;
    /** A Trial moved (and may have earned the Power): re-read the bond. */
    onRefresh: () => void;
    canAttemptTrials?: boolean;
    /** The site's locale, for grouping thousands in the XP. */
    locale?: string | null;
}) {
    const [trials, setTrials] = useState<AnimalTrial[]>([]);
    const [openTrialId, setOpenTrialId] = useState<string | null>(null);
    const [artFailed, setArtFailed] = useState(false);

    useEffect(() => {
        if (!speciesProfileId) return;
        const controller = new AbortController();
        void fetch(`/api/app/animal-trials?speciesProfileId=${encodeURIComponent(speciesProfileId)}`, {
            headers: {Accept: "application/json"},
            signal: controller.signal
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {trials?: AnimalTrial[]} | null) => {
                const loaded = payload?.trials;
                setTrials(Array.isArray(loaded) ? loaded : []);
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, [speciesProfileId]);

    /** "Not this any more": cleared at once, put back if the clear fails. */
    const clearFocus = useCallback(() => {
        if (!bond || !speciesProfileId) return;
        const previous = bond;
        onBondChanged({...bond, focus: null, openTrial: null});
        void fetch("/api/ask/companion", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "clear", speciesProfileId})
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
            })
            .catch(() => onBondChanged(previous));
    }, [bond, onBondChanged, speciesProfileId]);

    const openTrial = trials.find((trial) => trialId(trial) === openTrialId) ?? null;
    const power = bond?.power.name ?? powerName;
    const artUrl = slug && !artFailed ? getSpeciesArtworkUrl(slug) : null;

    return (
        <div className="flex flex-col" data-testid="bond-panel">
            {/* 1. The animal, its level and the bar through it. */}
            <section className="flex items-center gap-4 border-b border-white/[0.08] px-5 py-5">
                {artUrl ? (
                    <span className="relative h-16 w-16 shrink-0">
                        <Image src={artUrl} alt="" fill sizes="64px" unoptimized className="object-contain" onError={() => setArtFailed(true)} />
                    </span>
                ) : null}
                <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-2xl font-black leading-tight text-white">{name}</p>
                    {bond ? (
                        <>
                            <p className="mt-0.5 text-sm font-semibold text-white/70">{bondChipText(bond)}</p>
                            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]" aria-hidden="true">
                                <div className="h-full rounded-full" style={{width: `${bondLevelProgress(bond) * 100}%`, backgroundColor: NEON}} />
                            </div>
                            <p className="mt-1.5 text-[11px] font-semibold text-white/45">{bondXpText(bond.xp, locale)}</p>
                        </>
                    ) : !didLoad ? (
                        <p className="mt-1 text-sm text-white/40">…</p>
                    ) : null}
                </div>
            </section>

            {/* 2. Mastered. */}
            {bond?.mastered ? (
                <section className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4">
                    <span className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-black" style={{backgroundColor: NEON}}>
                        {BOND_COPY.mastered}
                    </span>
                    <span className="text-sm font-semibold text-white">{BOND_COPY.livesItsLesson}</span>
                </section>
            ) : null}

            {/* 3. The three strands. */}
            {bond ? (
                <section className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5">
                    <StrandBar label={BOND_COPY.knowsTheLesson} value={bond.strands.lesson} />
                    <StrandBar label={BOND_COPY.putsItIntoPractice} value={bond.strands.practice} />
                    <StrandBar label={BOND_COPY.changedYourLife} value={bond.strands.life} />
                </section>
            ) : null}

            {/* 4. Working on, and 5. your step. */}
            {bond ? (
                <section className="flex flex-col gap-2 border-b border-white/[0.08] px-5 py-5">
                    <BandHeader>{BOND_COPY.workingOnTitle}</BandHeader>
                    {bond.focus ? (
                        <div className="flex items-start gap-3">
                            <p className="min-w-0 flex-1 text-[15px] font-semibold leading-6 text-white">{bond.focus}</p>
                            <button
                                type="button"
                                onClick={clearFocus}
                                className="shrink-0 text-xs font-semibold text-white/50 underline-offset-2 transition-colors hover:text-white hover:underline"
                            >
                                {BOND_COPY.notThisAnyMore}
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm leading-6 text-white/60">{BOND_COPY.noFocus.replace("{name}", name)}</p>
                    )}
                    {bond.openTrial ? (
                        <div className="mt-3 flex flex-col gap-1">
                            <BandHeader>{BOND_COPY.yourStep}</BandHeader>
                            <p className="text-[15px] leading-6 text-white">{bond.openTrial}</p>
                        </div>
                    ) : null}
                </section>
            ) : null}

            {/* 6. Done together, newest first. */}
            {bond && bond.recentDone.length > 0 ? (
                <section className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-5">
                    <BandHeader>{BOND_COPY.doneTogether}</BandHeader>
                    <ul className="flex flex-col gap-2.5">
                        {bond.recentDone.map((done, index) => (
                            <li key={`${done.step}-${index}`} className="flex items-start gap-3">
                                <span aria-hidden="true" className="mt-0.5 text-sm" style={{color: NEON}}>✓</span>
                                <span className="min-w-0 flex-1 text-sm leading-6 text-white">{done.step}</span>
                                {shortDate(done.doneAt) ? <span className="shrink-0 text-[11px] text-white/45">{shortDate(done.doneAt)}</span> : null}
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {/* 7. Its Power. */}
            {power ? (
                <section className="flex flex-col gap-1.5 border-b border-white/[0.08] px-5 py-5">
                    <BandHeader>{BOND_COPY.itsPower}</BandHeader>
                    <p className="font-display text-xl font-black text-white">{power}</p>
                    {bond ? (
                        <p className="text-sm leading-6" style={{color: bond.power.earned ? NEON : "rgb(255 255 255 / 0.6)"}}>
                            {bondPowerLine(bond, name)}
                        </p>
                    ) : null}
                </section>
            ) : null}

            {/* 8. Actions: Talk to it first. */}
            <section className="flex flex-wrap gap-2 border-b border-white/[0.08] px-5 py-5">
                <button
                    type="button"
                    onClick={onTalk}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-black transition-colors hover:bg-primary-300"
                >
                    {BOND_COPY.talkToIt}
                </button>
                {onLessonCheck && bond && !bond.lessonCheckPassed ? (
                    <button
                        type="button"
                        onClick={onLessonCheck}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                        {BOND_COPY.takeLessonCheck}
                    </button>
                ) : null}
            </section>

            {trials.length > 0 ? (
                <section className="flex flex-col border-b border-white/[0.08]">
                    <div className="px-5 pb-2 pt-5">
                        <BandHeader>{BOND_COPY.animalTrials}</BandHeader>
                    </div>
                    {trials.map((trial) => {
                        const difficulty = trialDifficulty(trial.frequency);
                        return (
                            <div key={trialId(trial)} className="flex items-center gap-3 border-t border-white/[0.06] px-5 py-3.5">
                                <button
                                    type="button"
                                    onClick={() => setOpenTrialId(trialId(trial))}
                                    className="min-w-0 flex-1 text-left"
                                >
                                    <span className="block truncate text-[15px] font-bold text-white">{trial.title}</span>
                                    <span className="mt-0.5 block text-[11px] font-semibold text-white/50">
                                        {[difficulty, trialStatus(trial)].filter(Boolean).join(" · ")}
                                    </span>
                                </button>
                                {difficulty && !isComplete(trial) ? (
                                    <button
                                        type="button"
                                        onClick={() => onAsk(BOND_COPY.askAboutTrialMessage.replace("{difficulty}", difficulty))}
                                        className="shrink-0 rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                                    >
                                        {BOND_COPY.askAboutIt}
                                    </button>
                                ) : null}
                            </div>
                        );
                    })}
                </section>
            ) : null}

            {openTrial ? (
                <AnimalTrialDetail
                    trial={openTrial}
                    canAttempt={canAttemptTrials}
                    onChange={(updated) => {
                        setTrials((current) => current.map((item) => (trialId(item) === trialId(updated) ? updated : item)));
                        onRefresh();
                    }}
                    onClose={() => setOpenTrialId(null)}
                />
            ) : null}
        </div>
    );
}
