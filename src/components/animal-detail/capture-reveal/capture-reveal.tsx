"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {SpeciesBinderLink} from "@/data/collection-binder-types";
import {AddedToBinders} from "@/components/animal-detail/capture-card-bands";
import {type RewardShowcaseItem, newSpeciesMessage} from "@/lib/capture-reveal";
import {captureRevealHeader, captureRevealTimeline, type CaptureRevealPhase} from "@/lib/capture-reveal-flow";
import {MAX_STARS} from "@/lib/capture-star-rating";
import {CAPTURE_WORDS_EN, fillCaptureWords, type CaptureWords} from "@/lib/capture-words";
import {getSpeciesImageRoute} from "@/lib/species-image-public";

/**
 * What a newly identified capture opens with: the reveal (iOS
 * `CaptureRevealFlowView`), then the card with its discovery and reward.
 */

const NEON = "#A7F432";

type RevealWords = CaptureWords["reveal"];

const SETTING_TINT: Record<string, string> = {
    wild: "56,250,71",
    zoo: "250,219,71",
    domestic: "140,199,255",
    farm: "209,166,89",
    unknown: "158,158,173"
};

export function NewSpeciesCard({animalName, settingTag, words = CAPTURE_WORDS_EN.reveal}: {animalName: string; settingTag?: string | null; words?: RevealWords}) {
    const tint = SETTING_TINT[settingTag?.trim().toLowerCase() ?? "unknown"] ?? SETTING_TINT.unknown;

    return (
        <section
            className="flex items-center gap-3 border-b px-5 py-4 font-sans"
            style={{backgroundColor: `rgba(${tint},0.14)`, borderColor: `rgba(${tint},0.32)`}}
        >
            <span aria-hidden="true" className="text-lg font-bold" style={{color: NEON}}>✦</span>
            <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-base font-bold text-white">{words.newSpeciesDiscovered}</h3>
                <p className="text-sm leading-6 text-white/60">{newSpeciesMessage(animalName, words)}</p>
            </div>
        </section>
    );
}

/** How long each reward card holds the screen before the next one takes it. */
const REWARD_CARD_MS = 3400;

/**
 * The reward cards, played once and then gone. A tap moves on, so nobody has
 * to wait out a card they have already read.
 */
export function RewardShowcase({items, onFinished, words = CAPTURE_WORDS_EN.reveal}: {items: RewardShowcaseItem[]; onFinished: () => void; words?: RevealWords}) {
    const [index, setIndex] = useState(0);
    const item = items[index] ?? null;

    useEffect(() => {
        if (!item) {
            onFinished();
            return undefined;
        }
        const timer = window.setTimeout(() => setIndex((current) => current + 1), REWARD_CARD_MS);
        return () => window.clearTimeout(timer);
    }, [item, onFinished]);

    if (!item) return null;

    return (
        <button
            type="button"
            onClick={() => setIndex((current) => current + 1)}
            aria-label={`${item.title}. ${item.totalLabel} ${item.totalValueText}. ${item.subtitle}. ${words.tapToContinue}`}
            className="fixed inset-0 z-[62] flex items-center justify-center bg-[#090909]/70 px-6 font-sans"
        >
            <span
                key={index}
                role="status"
                className="flex w-full max-w-xs flex-col gap-3 border border-primary-400/40 bg-gradient-to-b from-primary-400/25 to-primary-400/5 px-5 py-6 text-left shadow-2xl"
            >
                <span className="flex items-center gap-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/60">
                    <span aria-hidden="true" style={{color: NEON}}>✦</span>
                    {item.title}
                </span>
                <span className="flex flex-col gap-1.5">
                    {item.lines.map((line) => (
                        <span key={line.title} className="flex items-baseline justify-between gap-3 text-sm text-white/75">
                            <span>{line.title}</span>
                            <span className="font-mono font-bold tabular-nums text-white">
                                {line.points >= 0 ? `+${line.points}` : line.points}
                            </span>
                        </span>
                    ))}
                </span>
                <span className="flex items-baseline justify-between gap-3 border-t border-white/15 pt-3">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">{item.totalLabel}</span>
                    <span className="font-display text-3xl font-bold text-white">{item.totalValueText}</span>
                </span>
                <span className="text-sm text-white/60">{item.subtitle}</span>
                {item.educationChip ? (
                    <span className="w-fit rounded-full bg-[#090909]/35 px-3 py-1.5 text-[11px] font-semibold" style={{color: NEON}}>
                        {item.educationChip}
                    </span>
                ) : null}
            </span>
        </button>
    );
}

/** The photo's stars, landing one by one like a pull (iOS `RevealCardGradeRow`). No tier letter. */
function RevealStars({stars, words, reduceMotion}: {stars: number; words: RevealWords; reduceMotion: boolean}) {
    const [shown, setShown] = useState(reduceMotion ? stars : 0);
    useEffect(() => {
        if (reduceMotion) {
            setShown(stars);
            return undefined;
        }
        setShown(0);
        const timers: number[] = [];
        for (let count = 1; count <= Math.max(1, stars); count += 1) {
            timers.push(window.setTimeout(() => setShown(count), 220 + (count - 1) * 110));
        }
        return () => timers.forEach((timer) => window.clearTimeout(timer));
    }, [reduceMotion, stars]);
    return (
        <span className="flex items-center gap-0.5 text-[13px]" role="img" aria-label={fillCaptureWords(words.starsOf, {n: stars, max: MAX_STARS})}>
            {Array.from({length: MAX_STARS}, (_, index) => (
                <span key={index} aria-hidden="true" className="transition-opacity duration-200" style={{color: index < shown ? NEON : "rgba(255,255,255,0.18)", opacity: shown === 0 ? 0 : 1}}>★</span>
            ))}
        </span>
    );
}

function SpeciesArt({slug, size, className = ""}: {slug: string; size: number; className?: string}) {
    const [failed, setFailed] = useState(false);
    if (failed) return <span style={{width: size, height: size}} className={`block ${className}`} />;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={getSpeciesImageRoute(slug)} alt="" width={size} height={size} className={`object-contain ${className}`} style={{width: size, height: size}} onError={() => setFailed(true)} />
    );
}

export type CaptureRevealCompanion = {
    powerName: string;
    /** The Power's motto, else the first sentence of its lesson. */
    lesson: string | null;
};

/**
 * The reveal (iOS `CaptureRevealFlowView`). Identity first: the name, the
 * novelty and the photo are on screen in the first frame; the subject locks;
 * a first-time species gets its discovery; then the animal itself, its Power
 * and its lesson, with Talk to it and See your card. Without a Power the
 * last beat is skipped and the card opens. A tap anywhere moves on; nothing
 * here is a gate.
 */
export function CaptureRevealFlow({
    photoSrc,
    slug,
    animalName,
    scientificName,
    dexNumber,
    isNewSpecies,
    totalSightings,
    isUncertain,
    companion,
    powerEarned,
    stars,
    binders,
    awardsFreeCredit,
    onTalk,
    onSeeCard,
    onShare,
    words = CAPTURE_WORDS_EN.reveal
}: {
    photoSrc: string;
    slug: string;
    animalName: string;
    scientificName: string | null;
    dexNumber: number | null;
    isNewSpecies: boolean;
    totalSightings: number;
    /** Not a confident identification: said plainly, never "Identified". */
    isUncertain: boolean;
    companion: CaptureRevealCompanion | null;
    /** A repeat sighting of an animal whose Power is already yours. */
    powerEarned: boolean;
    stars: number | null;
    /** The binders a new species joined. */
    binders: SpeciesBinderLink[];
    awardsFreeCredit: boolean;
    onTalk: () => void;
    onSeeCard: () => void;
    onShare?: (() => void) | null;
    words?: RevealWords;
}) {
    const [reduceMotion, setReduceMotion] = useState(false);
    const [phase, setPhase] = useState<CaptureRevealPhase>("identify");
    const finishedRef = useRef(false);
    const discovery = isNewSpecies && !isUncertain && dexNumber != null;

    useEffect(() => {
        try {
            setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        } catch {
            setReduceMotion(false);
        }
    }, []);

    const finish = useCallback(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onSeeCard();
    }, [onSeeCard]);

    /** The beats are over: the animal, when it has a Power, else the card. */
    const toCompanion = useCallback(() => {
        if (companion && !isUncertain) setPhase("companion");
        else finish();
    }, [companion, finish, isUncertain]);

    // The timeline: lock, then the discovery for a first-time species, then the animal.
    useEffect(() => {
        if (phase === "companion") return undefined;
        const steps = captureRevealTimeline({discovery, reduceMotion});
        const timers: number[] = [];
        let at = 0;
        for (const step of steps) {
            at += step.afterMs;
            const next = step.phase;
            timers.push(window.setTimeout(() => {
                if (next === "done") toCompanion();
                else setPhase(next);
            }, at));
        }
        return () => timers.forEach((timer) => window.clearTimeout(timer));
        // Runs once per reveal; a tap jumps ahead on its own.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [discovery, reduceMotion]);

    // Escape is the escape hatch, as a tap is.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") finish();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [finish]);

    const header = captureRevealHeader({phase, isNewSpecies, isUncertain, words});
    const showsDiscovery = discovery && (phase === "catalog" || phase === "morph");
    const backdrop = (
        <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl" />
            <div className="absolute inset-0 bg-[#090909]/[0.72]" />
        </>
    );

    if (phase === "companion" && companion) {
        return (
            <div className="fixed inset-0 z-[80] flex justify-center overflow-y-auto font-sans" role="dialog" aria-modal="true" aria-label={animalName} data-testid="capture-reveal">
                {backdrop}
                <div className="relative flex min-h-full w-full max-w-[520px] flex-col items-center gap-5 px-[18px] py-6 text-center">
                    <div className="flex flex-1 flex-col items-center justify-center gap-5">
                        <span className="grid h-[132px] w-[132px] place-items-center overflow-hidden rounded-full bg-white/[0.06] ring-[1.5px] ring-primary-400/45 shadow-[0_0_18px_rgba(167,244,50,.22)]">
                            <SpeciesArt slug={slug} size={104} />
                        </span>
                        <div className="flex flex-col items-center gap-2">
                            <p className="text-sm font-semibold text-white/60">{animalName}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em]" style={{color: NEON}}>{words.itsPower}</p>
                            <p className="font-display text-[30px] font-black leading-tight text-white">{companion.powerName}</p>
                            {companion.lesson ? <p className="mt-1 text-base italic leading-6" style={{color: NEON}}>“{companion.lesson}”</p> : null}
                            {stars != null ? <span className="mt-1.5"><RevealStars stars={stars} words={words} reduceMotion={reduceMotion} /></span> : null}
                            {!powerEarned ? <p className="mt-0.5 text-[15px] leading-6 text-white/60">{words.yoursWhen}</p> : null}
                        </div>
                    </div>
                    {isNewSpecies && binders.length ? (
                        <div className="-mx-[18px] w-[calc(100%+36px)]">
                            <AddedToBinders binders={binders.slice(0, 2)} words={words} onView={() => {finishedRef.current = true;}} />
                        </div>
                    ) : null}
                    {awardsFreeCredit ? (
                        <p className="flex items-center justify-center gap-2 text-xs font-semibold text-white">
                            <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded-full bg-primary-400 text-[9px] font-black text-black">+</span>
                            {words.freeCredit}
                        </p>
                    ) : null}
                    <div className="flex w-full flex-col gap-2.5">
                        <button
                            type="button"
                            onClick={() => {
                                finishedRef.current = true;
                                onTalk();
                            }}
                            className="flex min-h-[52px] w-full items-center justify-center rounded-full text-base font-black text-black/90"
                            style={{backgroundColor: NEON}}
                            data-testid="reveal-talk"
                        >
                            {words.talkToIt}
                        </button>
                        <div className="flex gap-2.5">
                            <button type="button" onClick={finish} className="flex min-h-12 flex-1 items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08] text-base font-bold text-white" data-testid="reveal-see-card">
                                {words.seeYourCard}
                            </button>
                            {onShare ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        finish();
                                        onShare();
                                    }}
                                    className="flex min-h-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-[18px] text-base font-bold text-white/60"
                                >
                                    {words.share}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[80] flex justify-center font-sans" role="dialog" aria-modal="true" aria-label={animalName} data-testid="capture-reveal">
            {backdrop}
            {/* The whole screen is the escape hatch; the button is the invitation. */}
            <button type="button" aria-label={words.continue} className="absolute inset-0 cursor-default" onClick={toCompanion} tabIndex={-1} />
            <div className="pointer-events-none relative flex h-full w-full max-w-[520px] flex-col gap-4 px-[18px] py-4 sm:py-6">
                <div className="flex flex-col items-center gap-1.5 text-center">
                    <p className="font-display text-2xl font-bold text-white">{header.title}</p>
                    <p className="text-xs text-white/60">{header.detail}</p>
                </div>
                <div className="relative flex min-h-[120px] flex-1 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={photoSrc}
                        alt=""
                        className={`max-h-[420px] max-w-full object-contain transition-[box-shadow] duration-500 ${phase === "identify" ? "shadow-[0_0_0_1px_rgba(255,255,255,.12)]" : "shadow-[0_0_0_2px_rgba(167,244,50,.85),0_0_22px_rgba(167,244,50,.3)]"}`}
                    />
                </div>
                {showsDiscovery ? (
                    <div className="flex items-center gap-3.5 border border-primary-400/30 bg-[#141414]/95 p-4 shadow-[0_4px_12px_rgba(167,244,50,.12)]" data-testid="reveal-discovery">
                        <span className="relative h-20 w-20 shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoSrc} alt="" className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${phase === "morph" ? "opacity-0" : "opacity-100"}`} />
                            <span className={`absolute inset-0 grid place-items-center transition-opacity duration-700 ${phase === "morph" ? "opacity-100" : "opacity-0"}`}>
                                <SpeciesArt slug={slug} size={80} />
                            </span>
                        </span>
                        <div className="flex min-w-0 flex-col gap-1.5 text-left">
                            <p className="font-display text-xl font-bold text-white">{animalName}</p>
                            {scientificName ? <p className="truncate text-xs italic text-white/60">{scientificName}</p> : null}
                            {dexNumber != null ? <p className="text-[10px] font-bold" style={{color: NEON}}>{fillCaptureWords(words.dexNumber, {n: String(dexNumber).padStart(3, "0")})}</p> : null}
                            {stars != null ? <RevealStars stars={stars} words={words} reduceMotion={reduceMotion} /> : null}
                        </div>
                    </div>
                ) : (
                    <div className={`flex flex-col gap-2 border bg-[#141414]/95 p-[18px] text-left ${isNewSpecies ? "border-primary-400/30" : "border-primary-400/[0.16]"}`} data-testid="reveal-identity">
                        <p className="font-display text-2xl font-bold leading-tight text-white">{animalName}</p>
                        {scientificName ? <p className="truncate text-xs italic text-white/60">{scientificName}</p> : null}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${isNewSpecies ? "bg-primary-400 text-black/85" : "border border-white/15 text-white/70"}`}>
                                {isNewSpecies ? words.newSpecies : fillCaptureWords(words.seenTimes, {n: Math.max(1, totalSightings)})}
                            </span>
                            {dexNumber != null && dexNumber > 0 ? <span className="text-[10px] font-bold" style={{color: NEON}}>{fillCaptureWords(words.dexNumber, {n: String(dexNumber).padStart(3, "0")})}</span> : null}
                        </div>
                        {stars != null && !isUncertain ? <span className="pt-0.5"><RevealStars stars={stars} words={words} reduceMotion={reduceMotion} /></span> : null}
                    </div>
                )}
                <button
                    type="button"
                    onClick={toCompanion}
                    title={words.opensFullResult}
                    className="pointer-events-auto flex min-h-12 w-full items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08] text-base font-bold text-white"
                    data-testid="reveal-continue"
                >
                    {showsDiscovery || isUncertain ? words.seeYourCard : words.continue}
                </button>
            </div>
        </div>
    );
}
