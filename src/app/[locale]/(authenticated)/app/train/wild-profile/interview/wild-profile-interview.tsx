"use client";

import {FormEvent, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {getLocalePath} from "@/lib/site";
import {applyWildProfileChip, suggestedWildProfileChips} from "@/lib/wild-profile-interview-chips";
import {
    isDeepWildProfileQuestion,
    wildProfileAnswerInput,
    wildProfileBirthDateAnswer,
    wildProfileBirthDateBounds
} from "@/lib/wild-profile-interview-answers";
import type {
    WildProfileChatMessage,
    WildProfileInterviewLabels,
    WildProfileInterviewPayload,
    WildProfileInterviewQuestion,
    WildProfileNextResponse,
    WildProfileSession
} from "@/lib/wild-profile-interview-types";

/**
 * Web port of the iOS Wild Profile interview (IdentityQuestionnaireView in
 * Views/IdentityProfileViews.swift). Reveal timing and chip rules follow iOS;
 * the copy is localized (wildProfile.interview) and speaks to the deep (v2)
 * interview. The backend is the same identity-interview-next /
 * generate-identity-profile pair, reached through /api/app/wild-profile.
 */

// What the server records for a skipped answer, in English.
const SKIPPED_TEXT = "Skipped this question.";

type DisplayMessage = WildProfileChatMessage & {renderDelay?: number | null};

async function callWildProfile<T>(body: Record<string, unknown>, fallbackError: string): Promise<T> {
    const response = await fetch("/api/app/wild-profile", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : fallbackError);
    }
    return payload as T;
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function chatMessages(response: WildProfileNextResponse | null, question: WildProfileInterviewQuestion, pendingUserMessage: string | null) {
    const messages: WildProfileChatMessage[] = [...(response?.messages ?? [])];
    const hasCurrent = messages.some((message) => message.question_id === question.id && message.role === "assistant");
    if (!hasCurrent) {
        messages.push({
            id: `question-${question.id}`,
            role: "assistant",
            content: question.question_text,
            question_id: question.id,
            sensitivity: question.sensitivity
        });
    }
    if (pendingUserMessage) {
        messages.push({id: "pending-user-message", role: "user", content: pendingUserMessage, question_id: question.id});
    }
    return messages;
}

/** Splits an assistant turn into its render_messages (or paragraphs), as iOS does. */
function displayMessages(messages: WildProfileChatMessage[]): DisplayMessage[] {
    return messages.flatMap((message): DisplayMessage[] => {
        if (message.role !== "assistant") return [message];
        const structured = (message.render_messages ?? [])
            .map((part) => ({text: part.text?.trim() ?? "", delay: part.delay_ms ?? null}))
            .filter((part) => part.text);
        const parts = structured.length > 0
            ? structured
            : message.content
                .split("\n\n")
                .map((text) => text.trim())
                .filter(Boolean)
                .map((text, index) => ({text, delay: index === 0 ? 0 : 520}));
        if (parts.length <= 1) return [message];

        const splitBaseId = message.question_id ? `question-${message.question_id}` : message.id;
        return parts.map((part, index) => ({
            ...message,
            id: `${splitBaseId}-part-${index}`,
            content: part.text,
            renderDelay: part.delay
        }));
    });
}

function isCurrentAssistantTurn(message: WildProfileChatMessage, question: WildProfileInterviewQuestion) {
    if (message.role !== "assistant" || message.answer_id) return false;
    return message.question_id === question.id || message.id.includes(question.id);
}

function shouldShowLabel(message: WildProfileChatMessage) {
    if (message.role !== "assistant") return true;
    const index = message.id.lastIndexOf("-part-");
    return index < 0 || message.id.slice(index + "-part-".length) === "0";
}

function readableDimension(value: string) {
    return value
        .replace(/^(deep|identity)_/, "")
        .replace(/_/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function TypingDots({label}: {label: string}) {
    return (
        <span className="inline-flex gap-1" aria-label={label}>
            {[0, 1, 2].map((dot) => (
                <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" style={{animationDelay: `${dot * 150}ms`}} />
            ))}
        </span>
    );
}

function GuideLabel({isUser, labels}: {isUser: boolean; labels: WildProfileInterviewLabels}) {
    return <p className={`text-[0.62rem] font-black ${isUser ? "text-black/65" : "text-white/40"}`}>{isUser ? labels.you : labels.guide}</p>;
}

/** "14 March 1998" for the bubble; the answer itself stays yyyy-MM-dd. */
function readableBirthDate(iso: string, locale: string) {
    const [year, month, day] = iso.split("-").map(Number);
    try {
        return new Date(year, month - 1, day).toLocaleDateString(locale, {day: "numeric", month: "long", year: "numeric"});
    } catch {
        return iso;
    }
}

function GenerationLoading({labels}: {labels: WildProfileInterviewLabels}) {
    const stages = [labels.stageReading, labels.stagePatterns, labels.stageCatalog, labels.stageRoles, labels.stageReport];
    const [stage, setStage] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 4_000);
        return () => clearInterval(timer);
    }, [stages.length]);

    return (
        <div className="flex min-h-[24rem] flex-col items-center justify-center gap-4 border border-white/10 bg-[#151515] p-8 text-center" role="status" aria-live="polite">
            <span className="text-4xl text-primary-300" aria-hidden="true">🐾</span>
            <h2 className="font-display text-3xl font-bold text-white">{labels.revealingTitle}</h2>
            <p className="text-sm font-semibold text-primary-200">{stages[stage]}</p>
            <p className="max-w-sm text-sm leading-6 text-white/50">{labels.revealingBody}</p>
        </div>
    );
}

export default function WildProfileInterview({locale, labels}: {locale: string; labels: WildProfileInterviewLabels}) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<WildProfileSession | null>(null);
    const [response, setResponse] = useState<WildProfileNextResponse | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [answerText, setAnswerText] = useState("");
    const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());
    const [isRevealing, setIsRevealing] = useState(false);
    const [hasDismissedIntro, setHasDismissedIntro] = useState(false);
    const [showSignal, setShowSignal] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);

    const question = response?.question ?? null;
    const state = response?.state ?? null;
    const signalPercent = state?.confidence_score != null ? Math.round(state.confidence_score * 100) : null;
    const resultPath = getLocalePath(locale, "/app/train/wild-profile");
    const unavailable = labels.unavailable;
    const answerInput = wildProfileAnswerInput(question);
    const birthDateBounds = useMemo(() => wildProfileBirthDateBounds(), []);
    const birthDateAnswer = answerInput === "birth_date" ? wildProfileBirthDateAnswer(answerText) : null;
    const canSend = answerInput === "birth_date" ? birthDateAnswer !== null : Boolean(answerText.trim());

    const load = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const payload = await callWildProfile<WildProfileInterviewPayload>({action: "load"}, unavailable);
            setSession(payload.session);
            setIsGenerating(payload.generating);
            setResponse(payload.generating ? null : payload.response);
            setAnswerText("");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : String(error));
        }
        setIsLoading(false);
    }, [unavailable]);

    useEffect(() => {
        void load();
    }, [load]);

    // Mirrors monitorGeneration: a session already generating elsewhere (the app,
    // another tab) is polled until it leaves "generating".
    useEffect(() => {
        if (!session || session.status !== "generating") return;
        let cancelled = false;
        (async () => {
            for (let attempt = 0; attempt < 80 && !cancelled; attempt += 1) {
                await wait(3_000);
                if (cancelled) return;
                try {
                    const {session: latest} = await callWildProfile<{session: WildProfileSession | null}>({action: "status"}, unavailable);
                    if (!latest || latest.id !== session.id) {
                        router.push(resultPath);
                        return;
                    }
                    if (latest.status === "generating") continue;
                    setIsGenerating(false);
                    setSession(latest);
                    setErrorMessage(latest.generation_error ?? null);
                    if (latest.status === "ready_for_generation") await load();
                    return;
                } catch {
                    // Keep polling; a single failed check is not fatal.
                }
            }
            if (!cancelled) setErrorMessage(labels.stillRevealing);
        })();
        return () => {
            cancelled = true;
        };
    }, [session, load, router, resultPath, unavailable, labels.stillRevealing]);

    const messages = useMemo(
        () => (question ? displayMessages(chatMessages(response, question, pendingUserMessage)) : []),
        [response, question, pendingUserMessage]
    );
    const revealSignature = messages.map((message) => message.id).join("|");

    // Reveal the current assistant turn one bubble at a time, like revealMessages on iOS.
    useEffect(() => {
        if (!question) return;
        let cancelled = false;
        const immediate = messages.filter((message) => !isCurrentAssistantTurn(message, question)).map((message) => message.id);
        setRevealedIds((current) => new Set(Array.from(current).concat(immediate)));
        const turn = messages.filter((message) => isCurrentAssistantTurn(message, question));
        if (turn.length === 0) return;

        (async () => {
            for (let index = 0; index < turn.length; index += 1) {
                if (index > 0) {
                    await wait(Math.max(250, Math.min(2_000, turn[index].renderDelay ?? 520)));
                }
                if (cancelled) return;
                setIsRevealing(false);
                setRevealedIds((current) => new Set(Array.from(current).concat(turn[index].id)));
                if (index < turn.length - 1) {
                    await wait(120);
                    if (cancelled) return;
                    setIsRevealing(true);
                }
            }
            setIsRevealing(false);
        })();
        return () => {
            cancelled = true;
            setIsRevealing(false);
        };
        // The signature captures every change to the message list.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealSignature]);

    const visibleMessages = question
        ? messages.filter((message) => !isCurrentAssistantTurn(message, question) || revealedIds.has(message.id))
        : [];

    useEffect(() => {
        const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        bottomRef.current?.scrollIntoView({behavior: reduceMotion ? "auto" : "smooth", block: "end"});
    }, [visibleMessages.length, isSaving, isRevealing]);

    async function submit(skipped: boolean) {
        if (!session || !question || isSaving) return;
        // A birth date goes in as free text, yyyy-MM-dd, like any other answer.
        const text = answerInput === "birth_date" ? (birthDateAnswer ?? "") : answerText.trim();
        if (!skipped && !text) return;
        setIsSaving(true);
        setErrorMessage(null);
        setPendingUserMessage(skipped
            ? labels.skipped
            : answerInput === "birth_date" ? readableBirthDate(text, locale) : text);
        try {
            const payload = await callWildProfile<{response: WildProfileNextResponse}>({
                action: "answer",
                sessionId: session.id,
                questionId: question.id,
                freeText: skipped ? null : text,
                skipped
            }, unavailable);
            setResponse(payload.response);
            setAnswerText("");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : String(error));
        }
        setPendingUserMessage(null);
        setIsSaving(false);
    }

    async function generate() {
        const sessionId = response?.session_id ?? session?.id;
        if (!sessionId) return;
        setShowSignal(false);
        setIsGenerating(true);
        setErrorMessage(null);
        try {
            await callWildProfile({action: "generate", sessionId}, unavailable);
            router.push(resultPath);
            router.refresh();
            return;
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : String(error));
        }
        setIsGenerating(false);
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void submit(false);
    }

    const signalBadge = signalPercent != null ? (
        <button
            type="button"
            onClick={() => setShowSignal((current) => !current)}
            aria-expanded={showSignal}
            aria-label={labels.signalAria.replace("{percent}", String(signalPercent))}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5"
        >
            <span className="h-1.5 w-1.5 rounded-full bg-primary-300 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
            <span className="flex flex-col items-start leading-none">
                <span className="text-sm font-black text-white">{signalPercent}%</span>
                <span className="mt-0.5 text-[0.5rem] font-extrabold tracking-[0.1em] text-white/40">{labels.signalShort}</span>
            </span>
        </button>
    ) : null;

    if (isLoading) {
        return (
            <div className="flex min-h-[20rem] items-center justify-center border border-white/10 bg-[#151515] text-sm text-white/55" role="status">
                {labels.loading}
            </div>
        );
    }

    if (isGenerating) {
        return (
            <div className="space-y-3">
                <GenerationLoading labels={labels} />
                {errorMessage ? <p className="text-sm font-semibold text-red-400">{errorMessage}</p> : null}
            </div>
        );
    }

    if (!question) {
        if (!response) {
            return (
                <div className="space-y-4 border border-white/10 bg-[#151515] p-6">
                    <p className="text-sm font-semibold text-red-400">{errorMessage ?? labels.unavailable}</p>
                    <button type="button" onClick={() => void load()} className="bg-primary-400 px-5 py-3 text-sm font-black text-black">
                        {labels.tryAgain}
                    </button>
                </div>
            );
        }

        return (
            <section className="space-y-4 border border-white/10 bg-[#151515] p-6 md:p-8">
                <span className="text-4xl text-primary-300" aria-hidden="true">✦</span>
                <h2 className="font-display text-3xl font-bold text-white">{labels.readyTitle}</h2>
                <p className="text-sm font-semibold leading-6 text-white/60">{labels.readyBody}</p>
                <button
                    type="button"
                    onClick={() => void generate()}
                    className="w-full bg-primary-400 px-5 py-3 text-sm font-black text-black transition hover:bg-primary-300"
                >
                    🐾 {labels.revealCta}
                </button>
                {errorMessage ? <p className="text-sm font-semibold text-red-400">{errorMessage}</p> : null}
            </section>
        );
    }

    const showIntro = !hasDismissedIntro && question.question_index <= 1 && (state?.answered_count ?? 0) === 0;
    const lastAssistant = [...visibleMessages].reverse().find((message) => message.role === "assistant");
    const chips = isDeepWildProfileQuestion(question) || answerInput === "birth_date"
        ? []
        : suggestedWildProfileChips(`${question.question_text} ${lastAssistant?.content ?? ""}`);
    const busy = isSaving || isRevealing;
    const themes = (state?.recurring_themes ?? []).slice(0, 8);
    const covered = (state?.covered_dimensions ?? []).slice(0, 8);
    const sharedAnswers = (response?.messages ?? [])
        .filter((message) => message.role === "user" && message.content && message.content !== SKIPPED_TEXT && message.content !== labels.skipped)
        .map((message) => message.content)
        .slice(-8);
    const summary = state?.conversation_summary?.trim()
        ? labels.summaryRecent.replace("{summary}", state.conversation_summary.trim().slice(0, 220))
        : (signalPercent ?? 0) < 25
            ? labels.summaryLight
            : (signalPercent ?? 0) < 60
                ? labels.summaryEarly
                : labels.summaryStrong;

    return (
        <section className="overflow-hidden border border-white/10 bg-[#101010]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                <p className="font-display text-lg font-bold text-white">Wild Profile</p>
                {signalBadge}
            </div>

            {showSignal ? (
                <div className="space-y-4 border-b border-white/10 bg-[#151515] p-5">
                    <div>
                        <p className="font-display text-2xl font-bold text-primary-300">{labels.signalTitle.replace("{percent}", String(signalPercent ?? 0))}</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white/60">{summary}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            [labels.statAnswers, state?.answered_count ?? 0],
                            [labels.statSkipped, state?.skipped_count ?? 0],
                            [labels.statReady, `${Math.round((state?.readiness_score ?? 0) * 100)}%`]
                        ].map(([label, value]) => (
                            <div key={label} className="bg-black/40 p-2.5">
                                <p className="text-sm font-black text-white">{value}</p>
                                <p className="text-[0.55rem] font-black uppercase text-white/40">{label}</p>
                            </div>
                        ))}
                    </div>
                    {[
                        [labels.themesTitle, themes],
                        [labels.coveredTitle, covered.map(readableDimension)],
                        [labels.stillLearningTitle, (signalPercent ?? 0) < 60 && themes.length > 0 ? [labels.stillLearningItem] : []]
                    ].map(([title, items]) => (items as string[]).length > 0 ? (
                        <div key={title as string}>
                            <p className="text-sm font-black text-white">{title as string}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(items as string[]).map((item) => (
                                    <span key={item} className="bg-black/40 px-2.5 py-1.5 text-xs font-black text-primary-300">{item}</span>
                                ))}
                            </div>
                        </div>
                    ) : null)}
                    {sharedAnswers.length > 0 ? (
                        <div>
                            <p className="text-sm font-black text-white">{labels.sharedTitle}</p>
                            <ul className="mt-2 space-y-2">
                                {sharedAnswers.map((answer, index) => (
                                    <li key={`${index}-${answer}`} className="line-clamp-3 bg-black/40 p-2.5 text-xs font-semibold text-white/60">{answer}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" onClick={() => void generate()} className="bg-primary-400 px-5 py-3 text-sm font-black text-black">
                            🐾 {labels.revealCta}
                        </button>
                        <button type="button" onClick={() => setShowSignal(false)} className="border border-white/15 px-5 py-3 text-sm font-bold text-white">
                            {labels.keepAnswering}
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="max-h-[60vh] min-h-[22rem] space-y-3.5 overflow-y-auto p-5" aria-live="polite">
                {showIntro ? (
                    <div className="space-y-3 border border-white/10 bg-[#151515] p-4">
                        <h2 className="text-xl font-black text-white">{labels.introTitle}</h2>
                        <p className="text-sm leading-6 text-white/60">{labels.introBody}</p>
                        <ul className="space-y-1.5 text-sm text-white/60">
                            <li><span className="text-primary-300">•</span> {labels.introOrigin}</li>
                            <li><span className="text-primary-300">•</span> {labels.introApex}</li>
                            <li><span className="text-primary-300">•</span> {labels.introActive}</li>
                        </ul>
                        <button
                            type="button"
                            onClick={() => {
                                setHasDismissedIntro(true);
                                (answerInput === "birth_date" ? dateInputRef.current : inputRef.current)?.focus();
                            }}
                            className="w-full bg-primary-400 px-5 py-2.5 text-sm font-bold text-black"
                        >
                            {labels.start}
                        </button>
                        <p className="text-xs text-white/40">{labels.introFootnote}</p>
                        <p className="text-xs leading-5 text-white/40">{labels.privacyNote}</p>
                    </div>
                ) : null}

                <div className="flex items-center justify-between">
                    <p className="text-[0.8rem] font-black text-white/60">{labels.question.replace("{number}", String(question.question_index))}</p>
                </div>

                {visibleMessages.map((message) => {
                    const isUser = message.role === "user";
                    const isCurrentQuestion = !isUser && message.question_id === question.id && !message.answer_id;
                    const canSkip = isCurrentQuestion && question.skip_allowed === true && message.content.includes("?");
                    return (
                        <div key={message.id} className={`flex ${isUser ? "justify-end pl-10" : "justify-start pr-10"}`}>
                            <div className={`max-w-xl space-y-1 p-3 ${isUser ? "bg-primary-400 text-black" : "border border-white/10 bg-[#1a1a1a] text-white"}`}>
                                {shouldShowLabel(message) ? <GuideLabel isUser={isUser} labels={labels} /> : null}
                                <p className="whitespace-pre-line text-[0.95rem] font-semibold leading-6">{message.content}</p>
                                {canSkip ? (
                                    <button
                                        type="button"
                                        onClick={() => void submit(true)}
                                        disabled={isSaving}
                                        className="mt-1 border border-white/20 px-2.5 py-1 text-xs font-black text-white/80 hover:border-white/40 disabled:opacity-50"
                                    >
                                        ⏭ {labels.skip}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    );
                })}

                {busy ? (
                    <div className="flex justify-start pr-10">
                        <div className="space-y-1.5 border border-white/10 bg-[#1a1a1a] p-3">
                            <GuideLabel isUser={false} labels={labels} />
                            <TypingDots label={labels.typing} />
                        </div>
                    </div>
                ) : null}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5 border-t border-white/10 bg-[#151515] p-4">
                {chips.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {chips.map((chip) => (
                            <button
                                key={chip.id}
                                type="button"
                                onClick={() => {
                                    setAnswerText((current) => applyWildProfileChip(current, chip));
                                    setHasDismissedIntro(true);
                                }}
                                className="rounded-full bg-primary-400/10 px-2.5 py-1.5 text-xs font-semibold text-primary-300 hover:bg-primary-400/20"
                            >
                                {chip.label}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className="flex items-end gap-2.5">
                    {answerInput === "birth_date" ? (
                        <>
                            <label htmlFor="wild-profile-birth-date" className="sr-only">{labels.birthDateLabel}</label>
                            <input
                                id="wild-profile-birth-date"
                                ref={dateInputRef}
                                type="date"
                                value={answerText}
                                min={birthDateBounds.min}
                                max={birthDateBounds.max}
                                onChange={(event) => setAnswerText(event.target.value)}
                                disabled={busy}
                                className="min-h-[2.75rem] flex-1 border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-[0.95rem] font-medium text-white [color-scheme:dark] focus:border-primary-300/60 focus:outline-none disabled:opacity-60"
                            />
                        </>
                    ) : (
                        <>
                            <label htmlFor="wild-profile-answer" className="sr-only">{labels.answerLabel}</label>
                            <textarea
                                id="wild-profile-answer"
                                ref={inputRef}
                                value={answerText}
                                onChange={(event) => setAnswerText(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && !event.shiftKey) {
                                        event.preventDefault();
                                        if (!busy) void submit(false);
                                    }
                                }}
                                placeholder={labels.placeholder}
                                rows={1}
                                maxLength={1200}
                                disabled={busy}
                                className="max-h-32 min-h-[2.75rem] flex-1 resize-none border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-[0.95rem] font-medium text-white placeholder:text-white/35 focus:border-primary-300/60 focus:outline-none disabled:opacity-60"
                            />
                        </>
                    )}
                    <button
                        type="submit"
                        aria-label={labels.send}
                        disabled={busy || !canSend}
                        className="grid h-11 w-11 shrink-0 place-items-center bg-primary-400 text-lg font-black text-black transition hover:bg-primary-300 disabled:opacity-40"
                    >
                        {isSaving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : "↑"}
                    </button>
                </div>
                {errorMessage ? <p className="text-sm font-semibold text-red-400">{errorMessage}</p> : null}
            </form>
        </section>
    );
}
