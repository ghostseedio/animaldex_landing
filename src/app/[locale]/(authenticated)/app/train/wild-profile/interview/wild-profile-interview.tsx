"use client";

import {FormEvent, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {getLocalePath} from "@/lib/site";
import {applyWildProfileChip, suggestedWildProfileChips} from "@/lib/wild-profile-interview-chips";
import type {
    WildProfileChatMessage,
    WildProfileInterviewPayload,
    WildProfileInterviewQuestion,
    WildProfileNextResponse,
    WildProfileSession
} from "@/lib/wild-profile-interview-types";

/**
 * Web port of the iOS Wild Profile interview (IdentityQuestionnaireView in
 * Views/IdentityProfileViews.swift). Copy, reveal timing and chip rules are
 * kept verbatim; the backend is the same identity-interview-next /
 * generate-identity-profile pair, reached through /api/app/wild-profile.
 */

const SKIPPED_TEXT = "Skipped this question.";
const GENERATION_STAGES = [
    "Reading your animal clues",
    "Matching habitats and instincts",
    "Shortlisting catalog species",
    "Choosing Origin, Apex, and Active",
    "Writing your private report"
];

type DisplayMessage = WildProfileChatMessage & {renderDelay?: number | null};

async function callWildProfile<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch("/api/app/wild-profile", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Identity Profile is unavailable right now.");
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
        .replace(/_/g, " ")
        .split(" ")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
}

function TypingDots() {
    return (
        <span className="inline-flex gap-1" aria-label="Wild Guide is typing">
            {[0, 1, 2].map((dot) => (
                <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50" style={{animationDelay: `${dot * 150}ms`}} />
            ))}
        </span>
    );
}

function GuideLabel({isUser}: {isUser: boolean}) {
    return <p className={`text-[0.62rem] font-black ${isUser ? "text-black/65" : "text-white/40"}`}>{isUser ? "You" : "Wild Guide"}</p>;
}

function GenerationLoading() {
    const [stage, setStage] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setStage((current) => Math.min(current + 1, GENERATION_STAGES.length - 1)), 4_000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex min-h-[24rem] flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-white/10 bg-[#151515] p-8 text-center" role="status" aria-live="polite">
            <span className="text-4xl text-primary-300" aria-hidden="true">🐾</span>
            <h2 className="font-display text-3xl font-bold text-white">Revealing Wild Profile</h2>
            <p className="text-sm font-semibold text-primary-200">{GENERATION_STAGES[stage]}</p>
            <p className="max-w-sm text-sm leading-6 text-white/50">Matching your habitat and instinct clues to real catalog animals.</p>
        </div>
    );
}

export default function WildProfileInterview({locale}: {locale: string}) {
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

    const question = response?.question ?? null;
    const state = response?.state ?? null;
    const signalPercent = state?.confidence_score != null ? Math.round(state.confidence_score * 100) : null;
    const resultPath = getLocalePath(locale, "/app/train/wild-profile");

    const load = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);
        try {
            const payload = await callWildProfile<WildProfileInterviewPayload>({action: "load"});
            setSession(payload.session);
            setIsGenerating(payload.generating);
            setResponse(payload.generating ? null : payload.response);
            setAnswerText("");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : String(error));
        }
        setIsLoading(false);
    }, []);

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
                    const {session: latest} = await callWildProfile<{session: WildProfileSession | null}>({action: "status"});
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
            if (!cancelled) setErrorMessage("Wild Profile is still revealing. Close this and check again in a moment.");
        })();
        return () => {
            cancelled = true;
        };
    }, [session, load, router, resultPath]);

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
        const text = answerText.trim();
        if (!skipped && !text) return;
        setIsSaving(true);
        setErrorMessage(null);
        setPendingUserMessage(skipped ? SKIPPED_TEXT : text);
        try {
            const payload = await callWildProfile<{response: WildProfileNextResponse}>({
                action: "answer",
                sessionId: session.id,
                questionId: question.id,
                freeText: skipped ? null : text,
                skipped
            });
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
            await callWildProfile({action: "generate", sessionId});
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
            aria-label={`Open Wild Profile animal signal details, ${signalPercent} percent`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5"
        >
            <span className="h-1.5 w-1.5 rounded-full bg-primary-300 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
            <span className="flex flex-col items-start leading-none">
                <span className="text-sm font-black text-white">{signalPercent}%</span>
                <span className="mt-0.5 text-[0.5rem] font-extrabold tracking-[0.1em] text-white/40">SIGNAL</span>
            </span>
        </button>
    ) : null;

    if (isLoading) {
        return (
            <div className="flex min-h-[20rem] items-center justify-center rounded-[1.5rem] border border-white/10 bg-[#151515] text-sm text-white/55" role="status">
                Loading interview
            </div>
        );
    }

    if (isGenerating) {
        return (
            <div className="space-y-3">
                <GenerationLoading />
                {errorMessage ? <p className="text-sm font-semibold text-red-400">{errorMessage}</p> : null}
            </div>
        );
    }

    if (!question) {
        if (!response) {
            return (
                <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-[#151515] p-6">
                    <p className="text-sm font-semibold text-red-400">{errorMessage ?? "Identity Profile is unavailable right now."}</p>
                    <button type="button" onClick={() => void load()} className="rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black">
                        Try again
                    </button>
                </div>
            );
        }

        return (
            <section className="space-y-4 rounded-[1.5rem] border border-white/10 bg-[#151515] p-6 md:p-8">
                <span className="text-4xl text-primary-300" aria-hidden="true">✦</span>
                <h2 className="font-display text-3xl font-bold text-white">Ready to reveal your animals</h2>
                <p className="text-sm font-semibold leading-6 text-white/60">
                    AnimalDex has enough habitat, instinct, and pressure clues to build your Wild Profile.
                </p>
                <button
                    type="button"
                    onClick={() => void generate()}
                    className="w-full rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black transition hover:bg-primary-300"
                >
                    🐾 Reveal My Wild Profile
                </button>
                {errorMessage ? <p className="text-sm font-semibold text-red-400">{errorMessage}</p> : null}
            </section>
        );
    }

    const showIntro = !hasDismissedIntro && question.question_index <= 1 && (state?.answered_count ?? 0) === 0;
    const lastAssistant = [...visibleMessages].reverse().find((message) => message.role === "assistant");
    const chips = suggestedWildProfileChips(`${question.question_text} ${lastAssistant?.content ?? ""}`);
    const busy = isSaving || isRevealing;
    const themes = (state?.recurring_themes ?? []).slice(0, 8);
    const covered = (state?.covered_dimensions ?? []).slice(0, 8);
    const sharedAnswers = (response?.messages ?? [])
        .filter((message) => message.role === "user" && message.content && message.content !== SKIPPED_TEXT)
        .map((message) => message.content)
        .slice(-8);
    const summary = state?.conversation_summary?.trim()
        ? `Wild Guide is collecting animal clues for your profile. Recent clues include: ${state.conversation_summary.trim().slice(0, 220)}`
        : (signalPercent ?? 0) < 25
            ? "Still light. A few more habitat and instinct answers will make your animals less generic."
            : (signalPercent ?? 0) < 60
                ? "Early patterns showing. More habitat, social, or defense clues will sharpen the match."
                : "Strong signal. AnimalDex has enough clues to build your Origin, Apex, and Active profile.";

    return (
        <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#101010]">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
                <p className="font-display text-lg font-bold text-white">Wild Profile</p>
                {signalBadge}
            </div>

            {showSignal ? (
                <div className="space-y-4 border-b border-white/10 bg-[#151515] p-5">
                    <div>
                        <p className="font-display text-2xl font-bold text-primary-300">{signalPercent ?? 0}% Animal Signal</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white/60">{summary}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            ["Answers", state?.answered_count ?? 0],
                            ["Skipped", state?.skipped_count ?? 0],
                            ["Ready", `${Math.round((state?.readiness_score ?? 0) * 100)}%`]
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-lg bg-black/40 p-2.5">
                                <p className="text-sm font-black text-white">{value}</p>
                                <p className="text-[0.55rem] font-black uppercase text-white/40">{label}</p>
                            </div>
                        ))}
                    </div>
                    {[
                        ["Animal clues found", themes],
                        ["Habitats explored", covered.map(readableDimension)],
                        ["Still learning", (signalPercent ?? 0) < 60 && themes.length > 0 ? ["More habitat clues", "More instinct clues"] : []]
                    ].map(([title, items]) => (items as string[]).length > 0 ? (
                        <div key={title as string}>
                            <p className="text-sm font-black text-white">{title as string}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {(items as string[]).map((item) => (
                                    <span key={item} className="rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-black text-primary-300">{item}</span>
                                ))}
                            </div>
                        </div>
                    ) : null)}
                    {sharedAnswers.length > 0 ? (
                        <div>
                            <p className="text-sm font-black text-white">Recent things you shared</p>
                            <ul className="mt-2 space-y-2">
                                {sharedAnswers.map((answer, index) => (
                                    <li key={`${index}-${answer}`} className="line-clamp-3 rounded-lg bg-black/40 p-2.5 text-xs font-semibold text-white/60">{answer}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                        <button type="button" onClick={() => void generate()} className="rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black">
                            🐾 Reveal My Wild Profile
                        </button>
                        <button type="button" onClick={() => setShowSignal(false)} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white">
                            Keep Answering
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="max-h-[60vh] min-h-[22rem] space-y-3.5 overflow-y-auto p-5" aria-live="polite">
                {showIntro ? (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-[#151515] p-4">
                        <h2 className="text-xl font-black text-white">Find your three animals</h2>
                        <p className="text-sm leading-6 text-white/60">
                            Answer a few animal-style questions. AnimalDex will match you to your Origin, Apex, and Active animals.
                        </p>
                        <ul className="space-y-1.5 text-sm text-white/60">
                            <li><span className="text-primary-300">•</span> Origin: your root pattern</li>
                            <li><span className="text-primary-300">•</span> Apex: your pressure power</li>
                            <li><span className="text-primary-300">•</span> Active: the animal showing up right now</li>
                        </ul>
                        <button
                            type="button"
                            onClick={() => {
                                setHasDismissedIntro(true);
                                inputRef.current?.focus();
                            }}
                            className="w-full rounded-2xl bg-primary-400 px-5 py-2.5 text-sm font-bold text-black"
                        >
                            Start
                        </button>
                        <p className="text-xs text-white/40">Private by default. Reflective, not a diagnosis.</p>
                    </div>
                ) : null}

                <div className="flex items-center justify-between">
                    <p className="text-[0.8rem] font-black text-white/60">Question {question.question_index}</p>
                </div>

                {visibleMessages.map((message) => {
                    const isUser = message.role === "user";
                    const isCurrentQuestion = !isUser && message.question_id === question.id && !message.answer_id;
                    const canSkip = isCurrentQuestion && question.skip_allowed === true && message.content.includes("?");
                    return (
                        <div key={message.id} className={`flex ${isUser ? "justify-end pl-10" : "justify-start pr-10"}`}>
                            <div className={`max-w-xl space-y-1 rounded-lg p-3 ${isUser ? "bg-primary-400 text-black" : "border border-white/10 bg-[#1a1a1a] text-white"}`}>
                                {shouldShowLabel(message) ? <GuideLabel isUser={isUser} /> : null}
                                <p className="whitespace-pre-line text-[0.95rem] font-semibold leading-6">{message.content}</p>
                                {canSkip ? (
                                    <button
                                        type="button"
                                        onClick={() => void submit(true)}
                                        disabled={isSaving}
                                        className="mt-1 rounded-md border border-white/20 px-2.5 py-1 text-xs font-black text-white/80 hover:border-white/40 disabled:opacity-50"
                                    >
                                        ⏭ Skip
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    );
                })}

                {busy ? (
                    <div className="flex justify-start pr-10">
                        <div className="space-y-1.5 rounded-lg border border-white/10 bg-[#1a1a1a] p-3">
                            <GuideLabel isUser={false} />
                            <TypingDots />
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
                    <label htmlFor="wild-profile-answer" className="sr-only">Your answer</label>
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
                        placeholder="Type a short answer"
                        rows={1}
                        maxLength={1200}
                        disabled={busy}
                        className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-[0.95rem] font-medium text-white placeholder:text-white/35 focus:border-primary-300/60 focus:outline-none disabled:opacity-60"
                    />
                    <button
                        type="submit"
                        aria-label="Send"
                        disabled={busy || !answerText.trim()}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary-400 text-lg font-black text-black transition hover:bg-primary-300 disabled:opacity-40"
                    >
                        {isSaving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : "↑"}
                    </button>
                </div>
                {errorMessage ? <p className="text-sm font-semibold text-red-400">{errorMessage}</p> : null}
            </form>
        </section>
    );
}
