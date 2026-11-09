"use client";

/**
 * The Diary on your own profile (iOS `ProfileDiaryTab.swift`, owner
 * 2026-11-03): one list of the problems you have worked through, newest
 * first, each with the animal it was brought to, how it stands (Done,
 * Working on it, Moved on) and when. An entry opens like a pushed screen onto
 * its story: brought, debated, the way chosen or solved, the steps and what
 * you said, the Power earned. Private: only on your own profile; someone
 * else's Diary tab lists the debates they asked in public.
 */

import {useCallback, useEffect, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {StepRecordEntry} from "@/components/companions/step-views";
import {ArkDiaryHistory, ArkStateChip} from "@/components/ark/ark-views";
import {
    arkMoneyFormatter,
    setDiaryVisibility,
    undoArkRevision,
    useDisplayCurrency
} from "@/components/ark/use-ark";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import {trackEvent} from "@/lib/analytics";
import {talkRelativeTime} from "@/lib/ask-animaldex/talk";
import {
    ARK_EVENTS,
    arkDiaryVisibilityChoices,
    arkEffectiveVisibility,
    arkEntryState,
    type ArkChange,
    type ArkDiaryVisibility
} from "@/lib/ark";
import {COMPANION_WORDS_EN, type CompanionWords} from "@/lib/companion-bond";
import {
    diaryAnimalName,
    diaryEventAt,
    diaryEventDetail,
    diaryEventId,
    diaryEventIsWin,
    diaryEventTitle,
    diaryEvents,
    diaryOutcome,
    diaryOutcomeText,
    diaryStatusText,
    type ProblemDiaryEntry,
    type ProblemDiaryEvent,
    type ProblemDiaryStatus,
    type ProblemDiaryStep,
    type ProblemDiaryWords
} from "@/lib/problem-diary";

const NEON = "#A7F432";
/** iOS `CreditStoreMetrics.gutter` and the row rhythm shared with Companions: 72 tall, art 48, gap 12. */
const GUTTER = 18;
const ART = 48;
const ART_GAP = 12;

type Load = "loading" | "loaded" | "failed";

function yesterdayWord(locale: string): string {
    try {
        return new Intl.RelativeTimeFormat(locale, {numeric: "auto"}).format(-1, "day");
    } catch {
        return "";
    }
}

function formatDate(raw: string | null, locale: string, options: Intl.DateTimeFormatOptions): string | null {
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
    try {
        return new Intl.DateTimeFormat(locale, options).format(date);
    } catch {
        return null;
    }
}

function Glyph({name, className = "h-3 w-3"}: {name: "people" | "bubble" | "walk" | "seal" | "check" | "half" | "retry" | "bolt" | "photo" | "warning" | "book" | "paw"; className?: string}) {
    const common = {viewBox: "0 0 24 24", className, "aria-hidden": true} as const;
    switch (name) {
        case "people": return <svg {...common} fill="currentColor"><circle cx="12" cy="7" r="3.2" /><circle cx="5" cy="9" r="2.4" /><circle cx="19" cy="9" r="2.4" /><path d="M6 20c0-3.6 2.7-6.2 6-6.2s6 2.6 6 6.2H6Zm-5 0c0-2.6 1.6-4.5 4-4.7a7.7 7.7 0 0 0-1.4 4.7H1Zm22 0h-2.6a7.7 7.7 0 0 0-1.4-4.7c2.4.2 4 2.1 4 4.7Z" /></svg>;
        case "bubble": return <svg {...common} fill="currentColor"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.6c-.5.4-1.4.1-1.4-.6V5.5Z" /></svg>;
        case "walk": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4.2" r="1.6" fill="currentColor" stroke="none" /><path d="m9 21 2.5-6 2.5 2v4M8 11l3-4h3l2 4 3 1M11 7l-1 5 3.5 3" /></svg>;
        case "seal": return <svg {...common} fill="currentColor"><path d="m12 1.8 2.4 1.9 3-.4 1.1 2.9 2.8 1.2-.4 3 1.9 2.4-1.9 2.4.4 3-2.8 1.2-1.1 2.8-3-.4L12 22.2l-2.4-1.9-3 .4-1.1-2.8-2.8-1.2.4-3L1.2 12l1.9-2.4-.4-3 2.8-1.2 1.1-2.9 3 .4L12 1.8Zm-1.2 13.6 5.7-5.8-1.4-1.4-4.3 4.4-2.2-2.2-1.4 1.4 3.6 3.6Z" /></svg>;
        case "check": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
        case "half": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="8.5" /><path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor" /></svg>;
        case "retry": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8m0-4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4" /></svg>;
        case "bolt": return <svg {...common} fill="currentColor"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5L13.5 2Z" /></svg>;
        case "photo": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" /><path d="m4 17 5-4.5 3.5 3 3-2.5L20 17" /></svg>;
        case "warning": return <svg {...common} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5" strokeLinecap="round" /><circle cx="12" cy="17.2" r="1.1" fill="currentColor" stroke="none" /></svg>;
        case "book": return <svg {...common} fill="currentColor"><path d="M5 3.5A1.5 1.5 0 0 1 6.5 2H19v16H7a2 2 0 0 0-2 2V3.5ZM7 20h12v2H7a2 2 0 0 1 0-4" /></svg>;
        case "paw": return <svg {...common} fill="currentColor"><ellipse cx="6.5" cy="10" rx="2" ry="2.6" /><ellipse cx="17.5" cy="10" rx="2" ry="2.6" /><ellipse cx="9.5" cy="5.5" rx="2" ry="2.6" /><ellipse cx="14.5" cy="5.5" rx="2" ry="2.6" /><path d="M12 12c-3 0-6 4.2-6 6.4 0 1.6 1.2 2.6 2.7 2.6 1.4 0 2-.7 3.3-.7s1.9.7 3.3.7c1.5 0 2.7-1 2.7-2.6C18 16.2 15 12 12 12Z" /></svg>;
    }
}

/** Done in lime, Working on it in white on chrome, Moved on in grey: the same three everywhere. */
function StatusChip({status, words}: {status: ProblemDiaryStatus; words: ProblemDiaryWords}) {
    const tone = status === "done"
        ? "bg-primary-400/[0.14] text-primary-300"
        : status === "moved_on" ? "bg-white/[0.07] text-white/45" : "bg-[#1F1F1F] text-white";
    return (
        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold leading-none ${tone}`}>
            {diaryStatusText(status, words)}
        </span>
    );
}

/** The animal a problem was brought to, by its species icon (never a photo). */
function AnimalArt({entry, size}: {entry: ProblemDiaryEntry; size: number}) {
    if (entry.slug) return <AskAnimalFace url={getSpeciesArtworkRoute(entry.slug)} size={size} />;
    return (
        <span className="grid shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/40" style={{width: size, height: size}}>
            <Glyph name="paw" className="h-1/3 w-1/3" />
        </span>
    );
}

function SkeletonRows() {
    return (
        <div aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
                <div key={index} className="flex min-h-[72px] items-center gap-3 border-b border-white/[0.06] px-[18px] py-2">
                    <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-white/[0.07]" />
                    <span className="flex-1 space-y-2">
                        <span className="block h-3 w-4/5 animate-pulse bg-white/[0.07]" />
                        <span className="block h-3 w-2/5 animate-pulse bg-white/[0.05]" />
                    </span>
                    <span className="h-5 w-16 animate-pulse rounded-full bg-white/[0.06]" />
                </div>
            ))}
        </div>
    );
}

function Message({icon, title, action}: {icon: "warning" | "book"; title: string; action?: React.ReactNode}) {
    return (
        <div className="flex flex-col items-center gap-2.5 px-8 py-10 text-center">
            <span className="text-white/40"><Glyph name={icon} className="h-[22px] w-[22px]" /></span>
            <p className="text-[17px] font-semibold text-white">{title}</p>
            {action}
        </div>
    );
}

/** One problem, readable at a glance: the face, the problem in two lines, the chip and when. */
function DiaryRow({entry, words, arkWords, locale, onOpen}: {
    entry: ProblemDiaryEntry;
    words: ProblemDiaryWords;
    arkWords: CompanionWords["ark"];
    locale: string;
    onOpen: () => void;
}) {
    const at = entry.lastAt ? Date.parse(entry.lastAt) : Number.NaN;
    const when = Number.isNaN(at) ? null : talkRelativeTime(at, {locale, yesterday: yesterdayWord(locale)});
    const state = arkEntryState(entry.ark);
    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={[entry.problem, diaryStatusText(entry.status, words), diaryOutcomeText(diaryOutcome(entry), words)].join(", ")}
            className="relative flex min-h-[72px] w-full items-center gap-3 px-[18px] py-2 text-left transition hover:bg-white/[0.03] active:bg-white/[0.05]"
            data-testid="diary-row"
        >
            <span className="relative shrink-0">
                <AnimalArt entry={entry} size={ART} />
                {entry.debates.length > 0 ? (
                    // Others weighed in: the debate mark on the face.
                    <span className="absolute -bottom-[3px] -right-[3px] grid h-5 w-5 place-items-center rounded-full border-2 border-[#07100B] bg-[#1F1F1F] text-white">
                        <Glyph name="people" className="h-2.5 w-2.5" />
                    </span>
                ) : null}
            </span>
            <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold leading-5 text-white">{entry.problem}</span>
            <span className="flex shrink-0 flex-col items-end gap-1">
                <StatusChip status={entry.status} words={words} />
                {state ? <ArkStateChip state={state} words={arkWords} /> : null}
                {when ? (
                    <span className="whitespace-nowrap text-[11px] text-white/40">{when}</span>
                ) : null}
            </span>
            <span className="absolute bottom-0 right-0 h-px bg-white/[0.08]" style={{left: GUTTER + ART + ART_GAP}} aria-hidden="true" />
        </button>
    );
}

function eventGlyph(event: ProblemDiaryEvent) {
    switch (event.kind) {
        case "brought": return "bubble" as const;
        case "debate": return "people" as const;
        case "chose":
        case "stepSet": return "walk" as const;
        case "solved": return "seal" as const;
        case "stepDone": return event.step.outcome === "partly" ? "half" as const : event.step.outcome === "didnt_work" ? "retry" as const : "check" as const;
        case "earned": return "bolt" as const;
    }
}

const CHIP = "inline-flex min-h-8 items-center gap-1.5 self-start rounded-full px-3.5 text-xs font-bold transition";

/** One moment in a problem's story, on a thin line from the one before. */
function EventRow({event, isLast, entry, words, locale, onOpenStep}: {
    event: ProblemDiaryEvent;
    isLast: boolean;
    entry: ProblemDiaryEntry;
    words: ProblemDiaryWords;
    locale: string;
    onOpenStep: (step: ProblemDiaryStep) => void;
}) {
    const win = diaryEventIsWin(event);
    const detail = diaryEventDetail(event, words, locale);
    const at = formatDate(diaryEventAt(event), locale, {day: "numeric", month: "short"});
    const hasMedia = event.kind === "stepDone" && (event.step.media?.length ?? 0) > 0;
    return (
        <div className="flex gap-3">
            <div className="flex flex-col items-center">
                <span
                    className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full ${win ? "text-black/90" : "bg-white/[0.08] text-white"}`}
                    style={win ? {backgroundColor: NEON} : undefined}
                    aria-hidden="true"
                >
                    <Glyph name={eventGlyph(event)} />
                </span>
                {isLast ? null : <span className="w-0.5 flex-1 bg-white/[0.1]" aria-hidden="true" />}
            </div>
            <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${isLast ? "" : "pb-[22px]"}`}>
                <p className="pt-1 text-[15px] font-semibold leading-5" style={{color: win ? NEON : "#fff"}}>{diaryEventTitle(event, words, locale)}</p>
                {detail ? <p className="whitespace-pre-line text-xs leading-5 text-white/60">{detail}</p> : null}
                {event.kind === "debate" ? (
                    <Link href={`/app/debates/${encodeURIComponent(event.debate.id)}`} className={`${CHIP} border border-white/12 bg-white/[0.05] text-white hover:bg-white/10`} data-testid="diary-open-debate">
                        <Glyph name="people" className="h-3.5 w-3.5" />
                        {words.openDebate}
                    </Link>
                ) : null}
                {event.kind === "stepDone" && hasMedia ? (
                    <button type="button" onClick={() => onOpenStep(event.step)} className={`${CHIP} border border-white/12 bg-white/[0.05] text-white hover:bg-white/10`}>
                        <Glyph name="photo" className="h-3.5 w-3.5" />
                        {words.stepDoneTitle}
                    </button>
                ) : null}
                {event.kind === "stepSet" && entry.speciesProfileId && entry.captureId ? (
                    // I've done it: the animal's chat, on the report, as the step's card there does.
                    <Link href={`/app/capture/${encodeURIComponent(entry.captureId)}?talk=report`} className={`${CHIP} text-black hover:brightness-105`} style={{backgroundColor: NEON}} data-testid="diary-step-did-it">
                        {words.didIt}
                    </Link>
                ) : null}
                {at ? <p className="text-[11px] text-white/40">{at}</p> : null}
            </div>
        </div>
    );
}

const ACTION = "inline-flex min-h-8 items-center gap-1.5 self-start rounded-full px-3.5 text-xs font-bold transition disabled:opacity-50";

/** One problem's story, as a pushed screen: back, the animal's name, the problem, then what happened. */
function DiaryEntryScreen({entry, words, companionWords, locale, money, onChange, onClose}: {
    entry: ProblemDiaryEntry;
    words: ProblemDiaryWords;
    companionWords?: CompanionWords;
    locale: string;
    money: (usd: number) => string;
    /** The entry as it now stands (a revision undone), as an updater. */
    onChange: (update: (entry: ProblemDiaryEntry) => ProblemDiaryEntry) => void;
    onClose: () => void;
}) {
    const [openedStep, setOpenedStep] = useState<ProblemDiaryStep | null>(null);
    const allWords = companionWords ?? COMPANION_WORDS_EN;
    const [undoing, setUndoing] = useState<string | null>(null);
    const [undoProblem, setUndoProblem] = useState<{id: string; text: string} | null>(null);
    const undo = async (change: ArkChange) => {
        setUndoing(change.id);
        setUndoProblem(null);
        const result = await undoArkRevision(change.id);
        setUndoing(null);
        if (!result.ok) {
            setUndoProblem({id: change.id, text: allWords.ark.undoFailed});
            return;
        }
        trackEvent(ARK_EVENTS.revisionUndone, {source: change.source});
        const undoneAt = result.value?.undoneAt ?? new Date().toISOString();
        onChange((current) => {
            if (!current.ark) return current;
            const changes = current.ark.changes.map((item) => (item.id === change.id ? {...item, undoneAt} : item));
            // Undone, it no longer revises: the server's state is read again when the Diary reloads.
            return {...current, ark: {state: arkEntryState({state: null, changes}), changes}};
        });
    };
    const events = diaryEvents(entry);
    const name = diaryAnimalName(entry);
    const started = formatDate(entry.startedAt, locale, {day: "numeric", month: "long", year: "numeric"});

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !openedStep) onClose();
        };
        window.addEventListener("keydown", onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = previous;
        };
    }, [onClose, openedStep]);

    return (
        <div role="dialog" aria-modal="true" aria-label={name} className="fixed inset-0 z-[70] flex flex-col bg-[#07100B]" data-testid="diary-entry">
            <header className="grid shrink-0 grid-cols-[2.75rem_1fr_2.75rem] items-center border-b border-white/[0.06] px-2 py-1.5">
                <button type="button" onClick={onClose} aria-label={words.back} className="grid h-11 w-11 place-items-center rounded-full text-white transition hover:bg-white/[0.08]">
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <h2 className="truncate text-center text-[17px] font-bold text-white">{name}</h2>
                <span />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-2xl px-[18px] pb-10">
                    <div className="flex flex-col gap-3 pb-5 pt-3">
                        <div className="flex items-center gap-2.5">
                            <AnimalArt entry={entry} size={56} />
                            <div className="flex flex-col items-start gap-1">
                                <StatusChip status={entry.status} words={words} />
                                {started ? <p className="text-[11px] text-white/40">{started}</p> : null}
                            </div>
                        </div>
                        <h3 className="font-display text-2xl font-bold leading-tight text-white">{entry.problem}</h3>
                        {arkEntryState(entry.ark) ? <div className="flex"><ArkStateChip state={arkEntryState(entry.ark)!} words={allWords.ark} /></div> : null}
                    </div>
                    {events.map((event, index) => (
                        <EventRow
                            key={diaryEventId(event)}
                            event={event}
                            isLast={index === events.length - 1}
                            entry={entry}
                            words={words}
                            locale={locale}
                            onOpenStep={setOpenedStep}
                        />
                    ))}
                    {entry.ark && entry.ark.changes.length > 0 ? (
                        <div className="pt-6">
                            <ArkDiaryHistory
                                changes={entry.ark.changes}
                                words={allWords}
                                money={money}
                                locale={locale}
                                onUndo={(change) => void undo(change)}
                                undoingId={undoing}
                                problem={undoProblem}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
            {openedStep && companionWords ? (
                <StepRecordEntry
                    record={{...openedStep.record, media: openedStep.media ?? []}}
                    name={name}
                    words={companionWords}
                    locale={locale}
                    closeLabel={words.back}
                    onClose={() => setOpenedStep(null)}
                />
            ) : null}
        </div>
    );
}

// v2: the notice was rewritten when public summaries went (2026-11-09), so it shows once more.
const NOTICE_KEY = "animaldex-diary-public-notice-v2";

function noticeSeen(): boolean {
    try {
        return window.localStorage.getItem(NOTICE_KEY) === "1";
    } catch {
        return false;
    }
}

function rememberNotice() {
    try {
        window.localStorage.setItem(NOTICE_KEY, "1");
    } catch {
        // The notice shows again next time: harmless.
    }
}

/**
 * Life Sim (contract section 7): the profile-wide switch, at the top of the
 * Diary. A "Public" (or "Private") label always shows; the first time there
 * is an entry, a plain notice says what public means, and a caption under
 * the switch always says what others see: your public debates either way,
 * your Ark bars only while public (owner, 2026-11-09: no public summaries;
 * iOS ff32eac8). A teen's diary is private, with no public option.
 */
function DiaryVisibilityBand({visibility, teen, hasEntries, words, onChange}: {
    visibility: ArkDiaryVisibility;
    teen: boolean;
    hasEntries: boolean;
    words: CompanionWords["ark"]["diary"];
    onChange: (visibility: ArkDiaryVisibility) => Promise<boolean>;
}) {
    const [noticeOpen, setNoticeOpen] = useState(false);
    const [working, setWorking] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    useEffect(() => {
        if (hasEntries && !teen && visibility === "public" && !noticeSeen()) setNoticeOpen(true);
    }, [hasEntries, teen, visibility]);
    const choices = arkDiaryVisibilityChoices(teen);
    const other = choices.find((choice) => choice !== visibility) ?? null;
    const change = async () => {
        if (!other) return;
        setWorking(true);
        setProblem(null);
        const ok = await onChange(other);
        setWorking(false);
        if (!ok) setProblem(words.changeFailed);
    };
    const isPublic = visibility === "public";
    return (
        <div className="flex flex-col gap-2 border-b border-white/[0.06] px-[18px] py-3" data-testid="diary-visibility">
            <div className="flex items-center gap-2.5">
                <span className="text-[13px] font-semibold text-white">{words.visibility}</span>
                <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold leading-none ${isPublic ? "bg-primary-400/[0.14] text-primary-300" : "bg-white/[0.07] text-white/60"}`}
                    data-testid={`diary-visibility-${visibility}`}
                >
                    {isPublic ? words.public : words.private}
                </span>
                <span className="flex-1" />
                {other ? (
                    <button type="button" onClick={() => void change()} disabled={working} className={`${ACTION} border border-white/12 bg-white/[0.05] text-white hover:bg-white/10`} data-testid="diary-visibility-switch">
                        {working ? "…" : other === "private" ? words.makePrivate : words.makePublic}
                    </button>
                ) : null}
            </div>
            {teen ? <p className="text-[12px] leading-5 text-white/55">{words.teenNotice}</p> : null}
            {noticeOpen && isPublic ? (
                <div className="flex flex-col gap-2 bg-primary-400/[0.08] p-3" role="note" data-testid="diary-public-notice">
                    <p className="text-[12px] leading-5 text-white/80">{words.publicNotice}</p>
                    <button
                        type="button"
                        onClick={() => {
                            rememberNotice();
                            setNoticeOpen(false);
                        }}
                        className={`${ACTION} text-black`}
                        style={{backgroundColor: NEON}}
                    >
                        {words.gotIt}
                    </button>
                </div>
            ) : null}
            {/* What others see, always said (iOS ff32eac8): your public debates either way; your Ark bars only while public. */}
            {!teen && !(noticeOpen && isPublic) ? (
                <p className="text-[11px] leading-4 text-white/45" data-testid="diary-visibility-caption">{isPublic ? words.publicCaption : words.privateNotice}</p>
            ) : null}
            {problem ? <p role="alert" className="text-[11px] leading-4 text-white/60">{problem}</p> : null}
        </div>
    );
}

/** The own profile's Diary tab. */
export function ProfileDiaryTab({words, companionWords, locale, displayCurrency}: {
    words: ProblemDiaryWords;
    companionWords?: CompanionWords;
    locale: string;
    /** The page's display currency (Settings → Currency); the browser's own read otherwise. */
    displayCurrency?: string;
}) {
    const [entries, setEntries] = useState<ProblemDiaryEntry[]>([]);
    const [load, setLoad] = useState<Load>("loading");
    const [opened, setOpened] = useState<ProblemDiaryEntry | null>(null);
    const [ark, setArk] = useState<{on: boolean; visibility: ArkDiaryVisibility | null; teen: boolean}>({on: false, visibility: null, teen: false});
    const allWords = companionWords ?? COMPANION_WORDS_EN;
    const currency = useDisplayCurrency(displayCurrency ?? null);
    const money = useMemo(() => arkMoneyFormatter(currency, locale), [currency, locale]);
    const visibility = arkEffectiveVisibility(ark.visibility, ark.teen);

    const reload = useCallback(async () => {
        setLoad((current) => (current === "failed" ? "loading" : current));
        try {
            const response = await fetch("/api/app/diary", {headers: {Accept: "application/json"}, cache: "no-store"});
            const payload = response.ok ? await response.json() as {entries?: ProblemDiaryEntry[]; visibility?: ArkDiaryVisibility; teen?: boolean; ark?: boolean} : null;
            if (!payload || !Array.isArray(payload.entries)) throw new Error("diary");
            setEntries(payload.entries);
            setArk({on: payload.ark === true, visibility: payload.visibility ?? null, teen: payload.teen === true});
            setLoad("loaded");
        } catch {
            // What was shown stays; only an empty list says it failed.
            setLoad("failed");
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const close = useCallback(() => {
        setOpened(null);
        // Back from a problem, it reads again: a step told there shows here.
        void reload();
    }, [reload]);

    const changeEntry = useCallback((update: (entry: ProblemDiaryEntry) => ProblemDiaryEntry) => {
        setOpened((current) => (current ? update(current) : current));
        setEntries((current) => current.map((item) => (item.key === opened?.key ? update(item) : item)));
    }, [opened?.key]);

    const changeVisibility = useCallback(async (next: ArkDiaryVisibility) => {
        const before = ark.visibility;
        setArk((current) => ({...current, visibility: next}));
        const result = await setDiaryVisibility(next);
        if (!result.ok) {
            setArk((current) => ({...current, visibility: before}));
            return false;
        }
        trackEvent(ARK_EVENTS.diaryVisibilityChanged, {visibility: next});
        return true;
    }, [ark.visibility]);

    let body: React.ReactNode;
    if (entries.length === 0 && load === "loading") {
        body = <SkeletonRows />;
    } else if (entries.length === 0 && load === "failed") {
        body = (
            <Message
                icon="warning"
                title={words.loadFailed}
                action={(
                    <button type="button" onClick={() => void reload()} className="mt-1 inline-flex min-h-9 items-center rounded-full px-4 text-xs font-black text-black transition hover:brightness-105" style={{backgroundColor: NEON}}>
                        {words.tryAgain}
                    </button>
                )}
            />
        );
    } else if (entries.length === 0) {
        body = <Message icon="book" title={words.emptyTitle} />;
    } else {
        body = entries.map((entry) => (
            <DiaryRow
                key={entry.key}
                entry={entry}
                words={words}
                arkWords={allWords.ark}
                locale={locale}
                onOpen={() => setOpened(entry)}
            />
        ));
    }

    return (
        <section className="flex flex-col" data-testid="profile-diary">
            {ark.on && load === "loaded" ? (
                <DiaryVisibilityBand
                    visibility={visibility}
                    teen={ark.teen}
                    hasEntries={entries.length > 0}
                    words={allWords.ark.diary}
                    onChange={changeVisibility}
                />
            ) : null}
            {body}
            {opened ? (
                <DiaryEntryScreen
                    entry={opened}
                    words={words}
                    companionWords={companionWords}
                    locale={locale}
                    money={money}
                    onChange={changeEntry}
                    onClose={close}
                />
            ) : null}
        </section>
    );
}
