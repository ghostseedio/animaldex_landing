"use client";

import {useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AppEmpty} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {
    PLAY_JOURNEY_COPY,
    PLAY_JOURNEY_FOLD_LIMIT,
    PLAY_JOURNEY_LOOP_STEPS,
    PLAY_JOURNEY_STEP_NUMBER,
    PLAY_JOURNEY_STEP_TITLE,
    type PlayJourney,
    type PlayJourneyEntry,
    type PlayJourneyStep,
    type PlayPowerHistoryItem,
    journeyFocus,
    journeyIsEmpty,
    journeyPowersEarned,
    journeyStatusLine,
    lockedSummaryLine,
    playJourneyAnchorId,
    powerHistoryDetailLine,
    sectionEmptyLine,
    sectionRailTrailing,
    showAllLine,
    visibleEntries
} from "@/lib/play-journey";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";

/**
 * The Play tab's Powers page — iOS `PlayJourneyViews`: an overview of the
 * three loop steps with a count each, then one section per step listing the
 * animals waiting on it, drawn with the same rail as an animal's own Play tab.
 * Every row opens that animal's card on its Play tab, the one place the steps
 * are actually done. This page only says where things stand.
 */

const NEON = "#A7F432";
const WARN = "rgb(250,184,61)";
const FAIL = "rgb(250,115,133)";
const VIOLET = "#8B5CF6";

/** The card, opened on its Play tab. */
export function playTabHref(captureId: string) {
    return `/app/capture/${encodeURIComponent(captureId)}?tab=play`;
}

function scrollToStep(step: PlayJourneyStep) {
    const element = document.getElementById(playJourneyAnchorId(step));
    if (!element) return;
    // The site sets smooth scrolling; one explicit call keeps it.
    const top = element.getBoundingClientRect().top + window.scrollY - 140;
    window.scrollTo({top, behavior: "smooth"});
}

function AnimalIcon({src, size, dim = false}: {src: string | null; size: number; dim?: boolean}) {
    return (
        <span
            className="grid shrink-0 place-items-center overflow-hidden bg-[#1c1c1c] text-white/35"
            style={{width: size, height: size, borderRadius: size * 0.25, opacity: dim ? 0.55 : 1}}
        >
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
                <span aria-hidden="true" style={{fontSize: size * 0.4}}>🐾</span>
            )}
        </span>
    );
}

function FusedChip() {
    return (
        <span className="rounded-full px-[5px] py-[2px] text-[8px] font-black tracking-[0.06em] text-black/85" style={{backgroundColor: VIOLET}}>
            {PLAY_JOURNEY_COPY.fused}
        </span>
    );
}

/** Three tiles — Train › Prove it › Battle & Fuse ↻ — with how many animals sit at each. */
function Overview({journey}: {journey: PlayJourney}) {
    const focus = journeyFocus(journey);
    const earned = journeyPowersEarned(journey);
    const captions: Record<(typeof PLAY_JOURNEY_LOOP_STEPS)[number], string> = {
        train: PLAY_JOURNEY_COPY.toTrain,
        proveIt: PLAY_JOURNEY_COPY.toProve,
        battleAndFuse: earned === 1 ? PLAY_JOURNEY_COPY.powerEarned : PLAY_JOURNEY_COPY.powersEarned
    };

    return (
        <div className="-mx-4 border-b border-white/[0.08] bg-[#141414] md:mx-0 md:border md:border-white/[0.08]">
            <div className="flex items-stretch px-3 py-3.5">
                {PLAY_JOURNEY_LOOP_STEPS.map((step, index) => {
                    const count = journey[step].length;
                    const isFocus = focus === step;
                    return (
                        <div key={step} className="flex min-w-0 flex-1 items-center">
                            {index > 0 ? <span aria-hidden="true" className="w-3.5 shrink-0 text-center text-[11px] font-black text-white/35">›</span> : null}
                            <button
                                type="button"
                                onClick={() => scrollToStep(step)}
                                aria-label={`${PLAY_JOURNEY_STEP_TITLE[step]}, ${count} ${captions[step]}`}
                                className={`flex min-w-0 flex-1 flex-col items-center gap-1 border py-2.5 transition ${isFocus ? "border-primary-400/55 bg-primary-400/10" : "border-transparent hover:bg-white/[0.03]"}`}
                            >
                                <span className="text-[9px] font-black tracking-[0.1em]" style={{color: isFocus ? NEON : "rgba(255,255,255,0.4)"}}>
                                    STEP {PLAY_JOURNEY_STEP_NUMBER[step]}{step === "battleAndFuse" ? " ↻" : ""}
                                </span>
                                <span className={`font-display text-[26px] font-black leading-none tabular-nums ${count === 0 ? "text-white/35" : "text-white"}`}>{count}</span>
                                <span className="max-w-full truncate px-1 text-xs font-extrabold text-white">{PLAY_JOURNEY_STEP_TITLE[step]}</span>
                                <span className="max-w-full truncate px-1 text-[10px] font-semibold text-white/40">{captions[step]}</span>
                            </button>
                        </div>
                    );
                })}
            </div>
            {journey.locked.length ? (
                <button
                    type="button"
                    onClick={() => scrollToStep("locked")}
                    className="flex w-full items-center gap-1.5 border-t border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-[11px] font-bold text-white/60"
                >
                    <span aria-hidden="true">🔒</span>
                    {lockedSummaryLine(journey.locked.length)}
                    <span aria-hidden="true" className="ml-auto">⌄</span>
                </button>
            ) : null}
        </div>
    );
}

function JourneyRow({entry}: {entry: PlayJourneyEntry}) {
    const status = journeyStatusLine(entry);
    const statusColor = status?.tone === "warn" ? WARN : status?.tone === "fail" ? FAIL : "rgba(255,255,255,0.6)";
    const isFused = entry.subject.kind === "fusedPower";
    const powerName = entry.subject.name;
    const earnedStep = entry.step === "battleAndFuse";

    return (
        <Link
            href={playTabHref(entry.captureId)}
            title={PLAY_JOURNEY_COPY.rowHint}
            className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.03]"
        >
            <AnimalIcon src={entry.imageSrc} size={44} dim={entry.step === "locked"} />
            <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="truncate text-[15px] font-extrabold text-white">{entry.animalName}</span>
                {powerName ? (
                    <span className="flex min-w-0 items-center gap-[5px] text-xs font-semibold" style={{color: earnedStep ? NEON : "rgba(255,255,255,0.6)"}}>
                        {isFused ? <FusedChip /> : earnedStep ? <span aria-hidden="true" className="text-[10px]">✔︎</span> : null}
                        <span className="truncate">
                            {/* The Power's icon leads its name; ⚡ where none is drawn yet. */}
                            {isFused ? null : (
                                <AnimalPowerIcon
                                    speciesProfileId={entry.speciesProfileId}
                                    fallback={earnedStep ? null : <span aria-hidden="true" className="mr-[5px] text-[10px]">⚡</span>}
                                />
                            )}
                            {powerName}
                        </span>
                    </span>
                ) : null}
                {status ? <span className="truncate text-[11px] font-bold" style={{color: statusColor}}>{status.text}</span> : null}
            </span>
            {(entry.step === "train" || entry.step === "proveIt") && entry.rewardXP && entry.rewardXP > 0 ? (
                <span className="shrink-0 rounded-full bg-primary-400/[0.12] px-2 py-1 text-xs font-extrabold" style={{color: NEON}}>+{entry.rewardXP} XP</span>
            ) : entry.step === "locked" ? (
                <span aria-hidden="true" className="shrink-0 text-xs text-white/35">🔒</span>
            ) : null}
            <span aria-hidden="true" className="shrink-0 text-xs font-bold text-white/35">›</span>
        </Link>
    );
}

/** One step: its rail, then a row per animal, or one line when none waits. */
function JourneySection({step, entries, onFindBattle}: {step: PlayJourneyStep; entries: PlayJourneyEntry[]; onFindBattle?: () => void}) {
    const [expanded, setExpanded] = useState(false);
    const visible = visibleEntries(entries, expanded);
    const lit = entries.length > 0;
    const showsToggle = entries.length > visible.length || (expanded && entries.length > PLAY_JOURNEY_FOLD_LIMIT + 1);

    const body = (
        <div className="pb-1">
            {step === "battleAndFuse" && entries.length && onFindBattle ? (
                <div className="px-5 pb-1.5 pt-3.5">
                    <button
                        type="button"
                        onClick={onFindBattle}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-400 py-3 text-base font-black text-black/90 transition hover:brightness-105"
                    >
                        {PLAY_JOURNEY_COPY.findBattle}
                        <span aria-hidden="true">→</span>
                    </button>
                </div>
            ) : null}
            {!entries.length ? (
                <p className="px-5 py-3.5 text-sm text-white/60">{sectionEmptyLine(step)}</p>
            ) : (
                <>
                    {visible.map((entry, index) => (
                        <div key={entry.id}>
                            {index > 0 ? <div className="ml-[76px] h-px bg-white/[0.06]" /> : null}
                            <JourneyRow entry={entry} />
                        </div>
                    ))}
                    {showsToggle ? (
                        <>
                            <div className="ml-[76px] h-px bg-white/[0.06]" />
                            <button
                                type="button"
                                onClick={() => setExpanded((value) => !value)}
                                className="flex w-full items-center justify-center gap-1.5 py-3 text-[13px] font-extrabold"
                                style={{color: NEON}}
                            >
                                {expanded ? PLAY_JOURNEY_COPY.showLess : showAllLine(entries.length)}
                                <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
                            </button>
                        </>
                    ) : null}
                </>
            )}
        </div>
    );

    if (step === "locked") {
        return (
            <section id={playJourneyAnchorId(step)} className="-mx-4 scroll-mt-36 border-b border-white/[0.08] bg-[#141414] md:mx-0">
                <div className="flex items-center gap-2 bg-white/[0.08] px-5 py-2 text-[11px] font-black tracking-[0.1em] text-white/60">
                    <span><span aria-hidden="true">🔒 </span>{PLAY_JOURNEY_COPY.locked}</span>
                    <span className="ml-auto truncate">{PLAY_JOURNEY_COPY.tryAgainTomorrow}</span>
                </div>
                {body}
            </section>
        );
    }

    return (
        <section
            id={playJourneyAnchorId(step)}
            className="-mx-4 scroll-mt-36 border-b border-white/[0.08] bg-[#141414] md:mx-0"
            style={{backgroundImage: `linear-gradient(to bottom, ${lit ? "rgba(167,244,50,0.16)" : "rgba(255,255,255,0.03)"}, transparent)`}}
        >
            <div
                className={`flex items-center gap-2 px-5 py-2 text-[11px] font-black tracking-[0.1em] ${lit ? "text-black/85" : "text-white/60"}`}
                style={{backgroundColor: lit ? NEON : "rgba(255,255,255,0.08)"}}
            >
                <span className="shrink-0">STEP {PLAY_JOURNEY_STEP_NUMBER[step]} · {PLAY_JOURNEY_STEP_TITLE[step].toUpperCase()}</span>
                <span className="ml-auto truncate">{sectionRailTrailing(step)}</span>
            </div>
            {body}
        </section>
    );
}

export function PlayPowersPage({
    journey,
    loaded,
    onFindBattle
}: {
    journey: PlayJourney;
    loaded: boolean;
    onFindBattle: () => void;
}) {
    if (journeyIsEmpty(journey)) {
        return loaded ? (
            <AppEmpty icon="camera" title={PLAY_JOURNEY_COPY.emptyTitle} detail={PLAY_JOURNEY_COPY.emptyDetail} />
        ) : (
            <div className="flex items-center gap-2.5 border border-white/[0.08] bg-[#141414] p-3.5 text-sm text-white/60">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" aria-hidden="true" />
                Finding animals…
            </div>
        );
    }

    return (
        <div className="md:overflow-hidden">
            <Overview journey={journey} />
            <div className="mt-3 space-y-3">
                {PLAY_JOURNEY_LOOP_STEPS.map((step) => (
                    <JourneySection
                        key={step}
                        step={step}
                        entries={journey[step]}
                        onFindBattle={step === "battleAndFuse" ? onFindBattle : undefined}
                    />
                ))}
                {journey.locked.length ? <JourneySection step="locked" entries={journey.locked} /> : null}
            </div>
        </div>
    );
}

/** The History segment's Powers page: every Power earned, newest first. */
export function PowerHistoryList({items, loaded}: {items: PlayPowerHistoryItem[]; loaded: boolean}) {
    if (!items.length) {
        return loaded ? (
            <AppEmpty icon="spark" title="No Powers yet" detail="Powers you earn show up here, with how and when you earned them." />
        ) : null;
    }
    return (
        <div className="-mx-4 md:mx-0 md:overflow-hidden md:border md:border-white/[0.08]">
            {items.map((item) => {
                const row = (
                    <>
                        <AnimalIcon src={item.imageSrc} size={40} />
                        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                            <span className="flex min-w-0 items-center gap-[5px]">
                                {item.isFused ? <FusedChip /> : null}
                                <span className="truncate text-sm font-extrabold text-white">
                                    {item.isFused ? null : (
                                        <AnimalPowerIcon
                                            speciesProfileId={item.speciesProfileId}
                                            style={{color: NEON}}
                                            fallback={<span aria-hidden="true" className="mr-[5px] text-[10px]" style={{color: NEON}}>⚡</span>}
                                        />
                                    )}
                                    {item.powerName}
                                </span>
                            </span>
                            <span className="truncate text-[11px] text-white/60">{powerHistoryDetailLine(item)}</span>
                        </span>
                        <span aria-hidden="true" className="shrink-0 text-xs font-bold text-white/35">›</span>
                    </>
                );
                const className = "flex w-full items-center gap-3 border-b border-white/[0.08] bg-[#141414] px-4 py-3 text-left transition hover:bg-white/[0.03]";
                return item.captureId ? (
                    <Link key={item.id} href={playTabHref(item.captureId)} className={className}>{row}</Link>
                ) : (
                    <div key={item.id} className={className}>{row}</div>
                );
            })}
        </div>
    );
}
