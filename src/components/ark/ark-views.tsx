"use client";

/**
 * Life Sim, drawn (docs/life-sim/CONTRACT.md, sections 3, 4 and 9; the
 * owner's spec, "UI and UX guidance"): everything inline in the chat, no
 * window, no toast.
 *
 *   - the reveal once a step is done (owner, 2026-11-09: made after their
 *     report, shaped by how it went, and drawn under the animal's reply that
 *     finished the step): the animal's reaction and its story beats as its
 *     own messages, one after another, then the numbers in the same special
 *     message as the step's (`AskSpecialBubble`), headed by the animal's own
 *     Power icon and name ("{Power} earned" on the step that earned it,
 *     "{Power} · Step done" after; a Lesson stays a Lesson); each
 *     stat that moved in its own row (name, +3 / −2, a bar that fills or
 *     drains) and Money counting up or down in the reader's currency. Gains
 *     are neon; a loss is a Lesson, amber, with the Experience it gave;
 *   - a revision: its own card under the message that caused it, the
 *     numbers animating the same way;
 *   - the profile's Ark Score card, its five bars with their latest change,
 *     and the Steps / Powers tiles.
 *
 * Every word an animal says here is the model's (`story`, `reaction`); the
 * labels are UI. Under Reduce Motion everything is drawn at once, at its
 * final values.
 */

import {useEffect, useRef, useState, type ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import AnimalPowerIcon from "@/components/animal-detail/animal-powers/animal-power-icon";
import {AskReplyBubbles, AskSpecialBubble, AskSpecialLabel} from "@/components/ask-animaldex/ask-messenger";
import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {
    arkBarValue,
    arkChangeHasLoss,
    arkChangeRows,
    arkCountAt,
    arkRevisionDirection,
    arkRowIsLoss,
    arkSignedMoney,
    arkSignedNumber,
    arkVisibleStats,
    arkRevealHeading,
    arkRevealLines,
    arkWithUndone,
    type ArkChange,
    type ArkRevealPower,
    type ArkStat,
    type ArkStats
} from "@/lib/ark";

type ArkWords = CompanionWords["ark"];

const NEON = "#A7F432";
/** A loss reads as a lesson, not a failure: warm amber, never red. */
const LESSON = "#FFC24B";
const COUNT_MS = 1100;
const BEAT_MS = 900;

/** 0 → 1 over `duration` once `start` turns true (at once when not animating). */
function useArkProgress(animate: boolean, start: boolean, duration = COUNT_MS): number {
    const [progress, setProgress] = useState(animate ? 0 : 1);
    const frame = useRef<number | null>(null);
    useEffect(() => {
        if (!animate) {
            setProgress(1);
            return;
        }
        if (!start) return;
        const began = performance.now();
        const tick = (now: number) => {
            const value = Math.min(1, (now - began) / duration);
            setProgress(value);
            if (value < 1) frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
        return () => {
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, [animate, start, duration]);
    return progress;
}

function statName(stat: ArkStat, words: ArkWords): string {
    return words.stats[stat];
}

function Bar({value, tint, track = "bg-white/[0.08]"}: {value: number; tint: string; track?: string}) {
    return (
        <span className={`relative block h-1.5 w-full overflow-hidden rounded-full ${track}`} aria-hidden="true">
            <span className="absolute inset-y-0 left-0 rounded-full" style={{width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: tint}} />
        </span>
    );
}

/** One stat that moved: its name, the change, a bar from the old value to the new one. */
function ChangeRow({change, row, words, money, locale, progress}: {
    change: ArkChange;
    row: {stat: ArkStat; before: number; after: number; delta: number};
    words: ArkWords;
    money: (usd: number) => string;
    locale: string;
    progress: number;
}) {
    const loss = arkRowIsLoss(change, row);
    const tint = row.stat === "experience" ? NEON : loss ? LESSON : NEON;
    const value = arkCountAt(row.before, row.after, progress);
    const isMoney = row.stat === "money" && change.money;
    const amount = isMoney && change.money ? money(arkCountAt(change.money.beforeCents, change.money.afterCents, progress) / 100) : null;
    const delta = isMoney && change.money ? arkSignedMoney(change.money.deltaCents, money) : arkSignedNumber(row.delta, locale);
    return (
        <li className="flex flex-col gap-1" data-testid={`ark-row-${row.stat}`} data-loss={loss ? "true" : "false"}>
            <div className="flex items-baseline justify-between gap-3 text-[13px] leading-5">
                <span className="font-semibold text-white">{statName(row.stat, words)}</span>
                <span className="flex items-baseline gap-2 tabular-nums">
                    {amount ? <span className="text-white/60" data-testid="ark-money-amount">{amount}</span> : <span className="text-white/45">{value}</span>}
                    <span className="font-black" style={{color: tint}}>{delta}</span>
                </span>
            </div>
            <Bar value={value} tint={tint} />
        </li>
    );
}

/** A stat that did not move (the chat's card, all five bars): its name, its value, its bar, quiet and with no change. */
function StillRow({stat, value, stats, words, money}: {stat: ArkStat; value: number; stats: ArkStats | null; words: ArkWords; money: (usd: number) => string}) {
    const amount = stat === "money" && stats?.bars.money ? money(stats.bars.money.balanceCents / 100) : null;
    return (
        <li className="flex flex-col gap-1 opacity-[0.42]" data-testid={`ark-row-${stat}`} data-still="true">
            <div className="flex items-baseline justify-between gap-3 text-[13px] leading-5">
                <span className="font-semibold text-white/60">{statName(stat, words)}</span>
                <span className="tabular-nums text-white/40">{amount ?? value}</span>
            </div>
            <Bar value={value} tint={NEON} />
        </li>
    );
}

/**
 * The numbers of a reveal or a revision: the rows, a lesson's Experience, and
 * Ark Score before → after. `stats` (the chat passes it, null until it reads):
 * Money, Relationships, Energy, Reputation and Experience, every bar, the
 * still ones quiet (`arkRevealLines`); left out (the Diary): the moved rows.
 */
export function ArkChangeNumbers({change, words, money, locale, progress, stats}: {
    change: ArkChange;
    words: ArkWords;
    money: (usd: number) => string;
    locale: string;
    progress: number;
    stats?: ArkStats | null;
}) {
    const rows = stats === undefined
        ? arkChangeRows(change).map((row) => ({kind: "moved" as const, ...row}))
        : arkRevealLines(change, stats);
    const lessonExperience = change.experienceDelta > 0 && arkChangeHasLoss(change)
        ? fillWords(words.lessonExperience, {n: change.experienceDelta})
        : null;
    return (
        <div className="flex flex-col gap-2.5">
            {rows.length > 0 ? (
                <ul className="flex flex-col gap-2.5">
                    {rows.map((row) => (row.kind === "moved"
                        ? <ChangeRow key={row.stat} change={change} row={row} words={words} money={money} locale={locale} progress={progress} />
                        : <StillRow key={row.stat} stat={row.stat} value={row.value} stats={stats ?? null} words={words} money={money} />
                    ))}
                </ul>
            ) : null}
            {lessonExperience ? <p className="text-[12px] font-semibold leading-4" style={{color: LESSON}}>{lessonExperience}</p> : null}
            {change.arkScore ? (
                <p className="text-[12px] font-bold leading-4 text-white/60 tabular-nums" data-testid="ark-score-change">
                    {fillWords(words.scoreChange, {before: change.arkScore.before, after: arkCountAt(change.arkScore.before, change.arkScore.after, progress)})}
                </p>
            ) : null}
        </div>
    );
}

function SparkIcon() {
    return (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M8 0.8c.5 3.6 2.1 5.9 6.9 7.2-4.8 1.3-6.4 3.6-6.9 7.2C7.5 11.6 5.9 9.3 1.1 8 5.9 6.7 7.5 4.4 8 .8Z" />
        </svg>
    );
}

function LessonIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 1 4 17.5v-12ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 0 1.5-1.5v-12Z" />
        </svg>
    );
}

function ReviseIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8m0-4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4" />
        </svg>
    );
}

/**
 * The reveal, as messages: the animal's reaction, each story beat after it,
 * then the numbers in a special message. `fresh`: it has just been played
 * here, so it arrives a message at a time and counts; otherwise (the thread
 * reopened) it is all there, at its final values.
 */
export function ArkRevealMessages({reveal, stats, power = null, plain = true, fresh, reducedMotion, faceUrl, speakerName, words, money, locale, onPlayed}: {
    reveal: ArkChange;
    /** The reader's own `ark_stats_v1` (null until it reads): every bar on the card, see `ArkChangeNumbers`. */
    stats?: ArkStats | null;
    /**
     * The chat's plain thread (its replies have no bubble and no face): the
     * numbers take the same full-width special card as the step card in the
     * reply above them. False: beside the animal's face, as a bubbled thread.
     */
    plain?: boolean;
    /** The animal's Power, for the header; null draws the header without it. */
    power?: ArkRevealPower | null;
    fresh: boolean;
    reducedMotion: boolean;
    faceUrl: string | null;
    speakerName: string;
    words: CompanionWords;
    money: (usd: number) => string;
    locale: string;
    /** Once everything has arrived (fresh only): the thread can follow it down. */
    onPlayed?: () => void;
}) {
    const animate = fresh && !reducedMotion;
    const beats = [...(reveal.reaction ? [reveal.reaction] : []), ...reveal.story];
    const [shown, setShown] = useState(animate ? 0 : beats.length + 1);
    useEffect(() => {
        if (!animate) {
            setShown(beats.length + 1);
            return;
        }
        if (shown > beats.length) return;
        const timer = window.setTimeout(() => setShown((current) => current + 1), shown === 0 ? 350 : BEAT_MS);
        return () => window.clearTimeout(timer);
    }, [animate, shown, beats.length]);
    const numbersIn = shown > beats.length;
    const progress = useArkProgress(animate, numbersIn);
    const played = useRef(false);
    useEffect(() => {
        if (!fresh || played.current || progress < 1 || !numbersIn) return;
        played.current = true;
        onPlayed?.();
    }, [fresh, numbersIn, progress, onPlayed]);
    const lesson = reveal.kind === "lesson" || arkChangeHasLoss(reveal);
    const heading = arkRevealHeading(lesson, power, words.ark);
    return (
        <div className="flex flex-col" data-testid={`ark-reveal-${lesson ? "lesson" : "earned"}`}>
            {beats.slice(0, shown).map((beat, index) => (
                <div key={index} className={`pt-1 ${animate ? "ask-ark-arrive" : ""}`} data-testid="ark-beat">
                    <AskReplyBubbles plain={plain} text={beat} isLive={false} avatarUrl={faceUrl} speakerName={speakerName} photoUrl={null} photoAlt="" />
                </div>
            ))}
            {numbersIn ? (
                <div className={`pt-1.5 ${animate ? "ask-ark-arrive" : ""}`}>
                    {/* The step card's own container (AskSpecialBubble → AskSpecialShell): its radius, width, inset and neon outline. */}
                    <AskSpecialBubble avatarUrl={faceUrl} plain={plain} testId="ark-numbers">
                        <section className="flex flex-col gap-2.5" aria-label={heading} aria-live={fresh ? "polite" : undefined}>
                            <AskSpecialLabel
                                tint={lesson ? LESSON : null}
                                icon={(
                                    <span className="grid h-3.5 w-3.5 shrink-0 place-items-center" data-testid="ark-power-icon">
                                        <AnimalPowerIcon speciesProfileId={power?.speciesProfileId ?? reveal.speciesProfileId} size={14} gap={0} fallback={lesson ? <LessonIcon /> : <SparkIcon />} />
                                    </span>
                                )}
                            >
                                <span data-testid="ark-reveal-heading">{heading}</span>
                            </AskSpecialLabel>
                            <ArkChangeNumbers change={reveal} words={words.ark} money={money} locale={locale} progress={progress} stats={stats} />
                        </section>
                    </AskSpecialBubble>
                </div>
            ) : null}
        </div>
    );
}

/**
 * A revision, under the message that caused it: what it was ("it went
 * better" / "worse"), what they said, and the numbers, animating when it has
 * just arrived. Undo is the Diary's (`onUndo` there).
 */
export function ArkRevisionCard({revision, stats, animate, words, money, locale, onUndo, undoing = false, problem = null, framed = true, plain = true}: {
    revision: ArkChange;
    /** The chat's: the reader's own `ark_stats_v1`, every bar on the card (see `ArkChangeNumbers`). */
    stats?: ArkStats | null;
    animate: boolean;
    words: CompanionWords;
    money: (usd: number) => string;
    locale: string;
    onUndo?: () => void;
    undoing?: boolean;
    problem?: string | null;
    /** In the chat: its own card, lined up with the animal's messages. In the Diary: bare, inside the entry. */
    framed?: boolean;
    /** The chat's plain thread: full width, as the step card in a reply (see `ArkRevealMessages`). */
    plain?: boolean;
}) {
    const progress = useArkProgress(animate, true);
    const direction = arkRevisionDirection(revision);
    const undone = Boolean(revision.undoneAt);
    const tint = undone ? "rgba(255,255,255,0.5)" : direction === "worse" ? LESSON : NEON;
    const title = undone
        ? words.ark.undone
        : direction === "better" ? words.ark.revisedBetter : direction === "worse" ? words.ark.revisedWorse : words.ark.revisedSame;
    const said = revision.statement
        ? fillWords(words.ark.revisedFrom, {words: revision.statement})
        : revision.source === "report" ? words.ark.revisedFromReport : null;
    const body = (
        <section className={`flex flex-col gap-2.5 ${undone ? "opacity-60" : ""}`} aria-label={title} data-testid={`ark-revision-${undone ? "undone" : direction}`}>
            <AskSpecialLabel icon={<ReviseIcon />} tint={tint}>{title}</AskSpecialLabel>
            {said ? <p className="text-[13px] italic leading-5 text-white/70">{said}</p> : null}
            <ArkChangeNumbers change={revision} words={words.ark} money={money} locale={locale} progress={progress} stats={stats} />
            {onUndo && !undone ? (
                <div>
                    <button
                        type="button"
                        onClick={onUndo}
                        disabled={undoing}
                        className="inline-flex min-h-8 items-center rounded-full border border-white/12 bg-white/[0.07] px-3.5 text-xs font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
                        data-testid="ark-undo"
                    >
                        {undoing ? "…" : words.ark.undo}
                    </button>
                </div>
            ) : null}
            {problem ? <p role="alert" className="text-[11px] leading-4 text-white/60">{problem}</p> : null}
        </section>
    );
    if (!framed) return body;
    // The step card's own container, lined up with the animal's messages.
    return (
        <div className={`pt-1.5 ${animate ? "ask-ark-arrive" : ""}`}>
            <AskSpecialBubble avatarUrl={null} showsFace={false} plain={plain} testId="ark-revision-card">{body}</AskSpecialBubble>
        </div>
    );
}

// MARK: - The profile (contract section 9)

function Tile({title, value, children, href, onOpen}: {title: string; value: string; children?: ReactNode; href?: string; onOpen?: () => void}) {
    const content = (
        <>
            <p className="text-[11px] font-medium uppercase text-white/40">{title}</p>
            <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums text-white">{value}</p>
            {children}
        </>
    );
    if (onOpen) {
        return <button type="button" onClick={onOpen} className="block min-w-0 flex-1 px-[18px] py-4 text-left transition hover:bg-white/[0.03]">{content}</button>;
    }
    return href ? (
        <Link href={href} className="block min-w-0 flex-1 px-[18px] py-4 transition hover:bg-white/[0.03]">{content}</Link>
    ) : (
        <div className="min-w-0 flex-1 px-[18px] py-4">{content}</div>
    );
}

/** 1. The headline: Ark Score, 0–500. */
export function ArkScoreCard({stats, words, locale}: {stats: Pick<ArkStats, "arkScore">; words: ArkWords; locale: string}) {
    return (
        <section className="border-b border-white/[0.06] px-[18px] py-5" data-testid="profile-ark-score">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/40">{words.score}</p>
            <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-[44px] font-black leading-none tabular-nums" style={{color: NEON}}>
                    {new Intl.NumberFormat(locale).format(stats.arkScore)}
                </span>
                <span className="text-sm font-semibold text-white/40">{words.outOf}</span>
            </p>
            <span className="mt-3 block"><Bar value={(stats.arkScore / 500) * 100} tint={NEON} /></span>
        </section>
    );
}

/** 2. The five bars (Experience alone for others without a public diary), each with its latest change. */
export function ArkBarsPanel({stats, words, money, locale}: {stats: ArkStats; words: ArkWords; money: (usd: number) => string; locale: string}) {
    const visible = arkVisibleStats(stats);
    return (
        <section className="flex flex-col gap-3 border-b border-white/[0.06] px-[18px] py-4" data-testid="profile-ark-bars">
            <ul className="flex flex-col gap-3">
                {visible.map((stat) => {
                    const value = arkBarValue(stats, stat);
                    if (value === null) return null;
                    const latest = stats.lastChanges[stat];
                    const tint = latest && latest.delta < 0 && stat !== "experience" ? LESSON : NEON;
                    return (
                        <li key={stat} className="flex flex-col gap-1" data-testid={`profile-ark-bar-${stat}`}>
                            <div className="flex items-baseline justify-between gap-3 text-[13px] leading-5">
                                <span className="font-semibold text-white">{statName(stat, words)}</span>
                                <span className="flex items-baseline gap-2 tabular-nums">
                                    {stat === "money" && stats.bars.money ? <span className="text-white/60">{money(stats.bars.money.balanceCents / 100)}</span> : null}
                                    <span className="font-bold text-white">{value}</span>
                                    {latest ? (
                                        <span className="text-[11px] font-bold" style={{color: tint}}>
                                            {fillWords(words.latest, {delta: arkSignedNumber(latest.delta, locale)})}
                                        </span>
                                    ) : null}
                                </span>
                            </div>
                            <Bar value={value} tint={stat === "money" ? "rgba(52,199,89,0.92)" : NEON} />
                        </li>
                    );
                })}
            </ul>
            {!stats.isSelf && !stats.barsVisible ? <p className="text-[11px] leading-4 text-white/40">{words.barsPrivate}</p> : null}
        </section>
    );
}

/** 3 and 4. Steps taken (worked / partly / didn't work, to the Diary) beside Powers earned. */
export function ArkStepsPowersTiles({steps, powersEarned, words, locale, diaryHref, onOpenDiary}: {
    steps: ArkStats["steps"];
    powersEarned: number;
    words: ArkWords;
    locale: string;
    /** The Diary: a link, or (on the profile, where it is a tab) a callback. */
    diaryHref?: string;
    onOpenDiary?: () => void;
}) {
    const format = (n: number) => new Intl.NumberFormat(locale).format(n);
    return (
        <section className="flex border-b border-white/[0.06]" data-testid="profile-ark-steps">
            <Tile title={words.stepsTaken} value={format(steps.total)} href={diaryHref} onOpen={onOpenDiary}>
                <p className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-semibold text-white/50">
                    <span><span style={{color: NEON}}>{format(steps.worked)}</span> {words.worked}</span>
                    <span><span className="text-white">{format(steps.partly)}</span> {words.partly}</span>
                    <span><span style={{color: LESSON}}>{format(steps.didntWork)}</span> {words.didntWork}</span>
                </p>
            </Tile>
            <span className="w-px bg-white/[0.06]" aria-hidden="true" />
            <Tile title={words.powersEarned} value={format(powersEarned)} />
        </section>
    );
}

// MARK: - The Diary (contract section 7)

/** Earned / Lesson / Revised, as a chip on a Diary row and on its entry. */
export function ArkStateChip({state, words}: {state: "earned" | "lesson" | "revised"; words: ArkWords}) {
    const tint = state === "lesson" ? LESSON : NEON;
    return (
        <span
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold leading-none"
            style={{color: tint, backgroundColor: state === "lesson" ? "rgba(255,194,75,0.12)" : "rgba(167,244,50,0.12)"}}
            data-testid={`ark-state-${state}`}
        >
            {state === "revised" ? <ReviseIcon /> : state === "lesson" ? <LessonIcon /> : <SparkIcon />}
            {state === "earned" ? words.earned : state === "lesson" ? words.lesson : words.revised}
        </span>
    );
}

/**
 * An entry's history, oldest first: each reveal (its story and what it
 * moved; a loss as a Lesson with its Experience), then each revision with
 * what caused it and Undo. Drawn at its final values: the Diary is for
 * looking back.
 */
export function ArkDiaryHistory({changes, words, money, locale, onUndo, undoingId = null, problem = null}: {
    changes: readonly ArkChange[];
    words: CompanionWords;
    money: (usd: number) => string;
    locale: string;
    onUndo?: (change: ArkChange) => void;
    undoingId?: string | null;
    /** Why the last Undo did not go through, under that revision. */
    problem?: {id: string; text: string} | null;
}) {
    const ordered = arkWithUndone(changes)
        .sort((a, b) => (Date.parse(a.createdAt ?? "") || 0) - (Date.parse(b.createdAt ?? "") || 0));
    if (ordered.length === 0) return null;
    return (
        <section className="flex flex-col gap-3" aria-label={words.ark.diary.history} data-testid="ark-diary-history">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/40">{words.ark.diary.history}</p>
            {ordered.map((change) => {
                if (change.kind === "revised") {
                    return (
                        <div key={change.id} className="border border-white/[0.08] bg-white/[0.03] p-3.5">
                            <ArkRevisionCard
                                revision={change}
                                animate={false}
                                words={words}
                                money={money}
                                locale={locale}
                                framed={false}
                                onUndo={onUndo ? () => onUndo(change) : undefined}
                                undoing={undoingId === change.id}
                                problem={problem?.id === change.id ? problem.text : null}
                            />
                        </div>
                    );
                }
                const lesson = change.kind === "lesson" || arkChangeHasLoss(change);
                const beats = [...(change.reaction ? [change.reaction] : []), ...change.story];
                return (
                    <div key={change.id} className="flex flex-col gap-2.5 border border-white/[0.08] bg-white/[0.03] p-3.5" data-testid={`ark-diary-${lesson ? "lesson" : "earned"}`}>
                        <p className="flex items-center gap-1.5 text-[11px] font-black uppercase leading-4 tracking-[0.12em]" style={{color: lesson ? LESSON : NEON}}>
                            {lesson ? <LessonIcon /> : <SparkIcon />}
                            <span>{lesson ? words.ark.lesson : words.ark.earned}</span>
                        </p>
                        {beats.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                                {beats.map((beat, index) => <p key={index} className="text-[13px] leading-5 text-white/75">{beat}</p>)}
                            </div>
                        ) : null}
                        <ArkChangeNumbers change={change} words={words.ark} money={money} locale={locale} progress={1} />
                    </div>
                );
            })}
        </section>
    );
}
