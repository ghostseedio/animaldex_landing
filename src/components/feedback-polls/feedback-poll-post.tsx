"use client";

/**
 * A feedback poll in the Discover feed (AnimalDex 20261201100000; iOS
 * `FeedbackPollDiscoverPost`): one feed page, like a debate. The label and
 * "Not now", the poll's title and intro, then each question as an
 * edge-to-edge band (flush, no gaps) with its options as chips, the optional
 * text, Send, and the privacy line. After Send the same page thanks the
 * reader and offers "Edit answer" while the poll is open.
 */

import {useState} from "react";
import {
    FEEDBACK_POLL_FREE_TEXT_MAX,
    feedbackPollAnswerPayload,
    feedbackPollCanSend,
    feedbackPollWords,
    toggleFeedbackPollChoice,
    type FeedbackPoll,
    type FeedbackPollChoices
} from "@/lib/feedback-polls";

const BAND = "-mx-5 flex flex-col gap-2.5 border-t border-white/[0.06] bg-white/[0.05] px-5 py-3.5";

export default function FeedbackPollPost({poll, locale, onDismiss}: {poll: FeedbackPoll; locale: string; onDismiss: (poll: FeedbackPoll) => void}) {
    const words = feedbackPollWords(locale);
    const answered = poll.myChoices !== null || poll.myFreeText !== null;
    const [choices, setChoices] = useState<FeedbackPollChoices>(poll.myChoices ?? {});
    const [freeText, setFreeText] = useState(poll.myFreeText ?? "");
    const [state, setState] = useState<"form" | "sending" | "thanks">(answered ? "thanks" : "form");
    const [hasAnswer, setHasAnswer] = useState(answered);
    const [problem, setProblem] = useState<string | null>(null);

    const send = async () => {
        if (!feedbackPollCanSend(poll, choices, freeText) || state === "sending") return;
        setState("sending");
        setProblem(null);
        const payload = feedbackPollAnswerPayload(poll, choices, freeText);
        try {
            const response = await fetch("/api/app/discover/poll", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "answer", pollId: poll.id, choices: payload.p_choices, freeText: payload.p_free_text})
            });
            const body = await response.json().catch(() => ({})) as {error?: string};
            if (!response.ok) {
                setProblem(body.error === "poll_closed" ? words.closed : words.failed);
                setState("form");
                return;
            }
            setHasAnswer(true);
            setState("thanks");
        } catch {
            setProblem(words.failed);
            setState("form");
        }
    };

    const dismiss = () => {
        onDismiss(poll);
        void fetch("/api/app/discover/poll", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "dismiss", pollId: poll.id})
        }).catch(() => undefined);
    };

    return (
        <article
            aria-label={poll.title}
            className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-black px-5 pb-28 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] [scrollbar-width:none] lg:pb-6 lg:pt-5 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0"
            data-testid="feedback-poll-post"
        >
            <div className="flex items-center gap-2 text-primary-200/85">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 5h16v11H8l-4 4V5Z" /><path d="M9 10h6" />
                </svg>
                <span className="truncate text-[10px] font-black uppercase tracking-[0.14em]">{words.label}</span>
                <span className="flex-1" />
                {state !== "thanks" || !hasAnswer ? (
                    <button type="button" onClick={dismiss} className="min-h-8 shrink-0 px-1 text-[12px] font-bold text-white/55 hover:text-white" data-testid="feedback-poll-dismiss">
                        {words.notNow}
                    </button>
                ) : null}
            </div>
            <h2 className="mt-3 line-clamp-2 font-display text-xl font-black leading-7 text-white">{poll.title}</h2>
            {poll.intro ? <p className="mt-1.5 line-clamp-3 text-[14px] leading-[22px] text-white/65">{poll.intro}</p> : null}

            {state === "thanks" ? (
                <div className={`${BAND} mt-5`} data-testid="feedback-poll-thanks">
                    <p className="flex items-start gap-2 text-[15px] font-bold leading-6 text-white">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-400 text-[12px] font-black text-black">✓</span>
                        {words.thanks}
                    </p>
                    <button type="button" onClick={() => setState("form")} className="self-start text-[13px] font-bold text-primary-300 hover:text-primary-200">
                        {words.edit}
                    </button>
                </div>
            ) : (
                <>
                    <div className="mt-4 flex flex-col">
                        {poll.questions.map((question) => (
                            <fieldset key={question.id} className={BAND}>
                                <legend className="sr-only">{question.prompt}</legend>
                                <span className="flex items-baseline gap-2">
                                    <span className="min-w-0 flex-1 text-[14px] font-bold leading-5 text-white">{question.prompt}</span>
                                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{question.multiple ? words.chooseAny : words.chooseOne}</span>
                                </span>
                                <span className="flex flex-wrap gap-2">
                                    {question.options.map((option) => {
                                        const on = (choices[question.id] ?? []).includes(option.id);
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                role={question.multiple ? "checkbox" : "radio"}
                                                aria-checked={on}
                                                onClick={() => setChoices((current) => toggleFeedbackPollChoice(current, question, option.id))}
                                                className={`min-h-9 rounded-full border px-3.5 text-left text-[13px] font-semibold leading-5 transition-colors ${on ? "border-primary-400 bg-primary-400 text-black" : "border-white/15 bg-black/30 text-white/85 hover:border-white/30"}`}
                                            >
                                                {on ? "✓ " : ""}{option.label}
                                            </button>
                                        );
                                    })}
                                </span>
                            </fieldset>
                        ))}
                        {poll.freeTextPrompt ? (
                            <label className={BAND}>
                                <span className="flex items-baseline gap-2">
                                    <span className="min-w-0 flex-1 text-[14px] font-bold leading-5 text-white">{poll.freeTextPrompt}</span>
                                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">{words.optional}</span>
                                </span>
                                <textarea
                                    value={freeText}
                                    onChange={(event) => setFreeText(event.target.value.slice(0, FEEDBACK_POLL_FREE_TEXT_MAX))}
                                    rows={2}
                                    maxLength={FEEDBACK_POLL_FREE_TEXT_MAX}
                                    className="w-full resize-none border-0 border-b border-white/15 bg-transparent px-0 py-1.5 text-[14px] leading-[22px] text-white placeholder:text-white/35 focus:border-primary-400 focus:outline-none focus:ring-0"
                                />
                            </label>
                        ) : null}
                    </div>
                    {problem ? <p className="mt-3 text-[12px] font-semibold text-[#FF8A80]" role="alert">{problem}</p> : null}
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={!feedbackPollCanSend(poll, choices, freeText) || state === "sending"}
                        className="mt-4 min-h-11 rounded-full bg-primary-400 px-6 text-[14px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500 disabled:opacity-40"
                        data-testid="feedback-poll-send"
                    >
                        {state === "sending" ? "…" : hasAnswer ? words.update : words.send}
                    </button>
                    <p className="mt-2.5 text-center text-[11px] leading-4 text-white/40">{words.privacy}</p>
                </>
            )}
        </article>
    );
}
