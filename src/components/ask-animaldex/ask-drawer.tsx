"use client";

/**
 * The conversation itself: a docked panel on desktop, a bottom sheet on mobile.
 *
 * The web counterpart of `AnimalPowerAskChatView`. The behaviour worth keeping
 * from it, all of which this reproduces:
 *   - the newest question is pinned to the top of the panel, so the answer
 *     renders *below* the question the way it reads on paper, instead of the
 *     reader landing on the last line of a long answer;
 *   - the waiting line names what is being consulted for this particular
 *     question, not a fixed script;
 *   - follow-up chips appear under the newest answer only — chips under every
 *     answer turn the scrollback into a wall of buttons;
 *   - stop is a real action with a real outcome, not a disabled send button.
 */

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import AssistantMarkdown from "@/components/ask-animaldex/assistant-markdown";
import {useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {useAskThread} from "@/components/ask-animaldex/use-ask-thread";
import {askMarkdownPlainText} from "@/lib/ask-animaldex/markdown";
import {askThreadKey, type AskMessage} from "@/lib/ask-animaldex/thread";
import {askThinkingPhases} from "@/lib/ask-animaldex/thinking-phases";
import {
    askSuggestions,
    EMPTY_ASK_HINTS,
    type AskHints,
    type AskSubject,
    type AskSuggestion
} from "@/lib/ask-animaldex/subject";
import {trackEvent} from "@/lib/analytics";
import {SPECIES_ASK_FUNNEL_EVENTS} from "@/lib/species-ask";

export type AskDrawerLabels = {
    title: string;
    aboutAnimal: string;
    aboutSite: string;
    emptyTitleAnimal: string;
    emptyTitleGeneral: string;
    emptyHint: string;
    placeholderAnimal: string;
    placeholderGeneral: string;
    placeholderFollowUp: string;
    send: string;
    stop: string;
    close: string;
    newConversation: string;
    clearConfirm: string;
    clearConfirmAction: string;
    clearCancel: string;
    copy: string;
    copied: string;
    share: string;
    retry: string;
    tryAgain: string;
    youAsked: string;
    thinking: string;
    remaining: string;
    limitTitle: string;
    limitBody: string;
    limitCta: string;
    limitHref: string;
    disclaimer: string;
};

type AskContextPayload = {
    subject: AskSubject;
    hints: AskHints;
    suggestions: AskSuggestion[];
    limit: number;
    signedIn: boolean;
    isPro: boolean;
    available: boolean;
};

const THINKING_PHASE_MS = 2200;

export default function AskDrawer({labels}: {labels: AskDrawerLabels}) {
    const {subject, photoUrl, locale, close, takePendingQuestion} = useAskAnimalDex();
    const [context, setContext] = useState<AskContextPayload | null>(null);
    const [composer, setComposer] = useState("");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [confirmingClear, setConfirmingClear] = useState(false);

    const threadKey = askThreadKey(subject);
    const hints = context?.hints ?? EMPTY_ASK_HINTS;
    const resolvedSubject = context?.subject ?? subject;

    const {messages, hasConversation, isSending, quota, send, stop, retry, regenerate, clear} = useAskThread({
        threadKey,
        subject: resolvedSubject,
        locale,
        principleName: hints.principleName,
        onAnswered: ({followUps}) => {
            trackEvent(SPECIES_ASK_FUNNEL_EVENTS.answered, {
                species_slug: resolvedSubject.slug ?? "",
                source: "drawer",
                layer_count: followUps
            });
        }
    });

    const panelRef = useRef<HTMLDivElement | null>(null);
    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const trailingQuestionRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const lastPinnedId = useRef<string | null>(null);

    // Context first: the opening suggestions have to name this animal's real
    // states and failure modes, and the waiting lines are derived from the same
    // material. A generic chip row is what this replaces.
    useEffect(() => {
        let cancelled = false;
        setContext(null);
        void fetch("/api/ask/context", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                subject: {
                    scope: subject.scope,
                    slug: subject.slug,
                    name: subject.name,
                    captureId: subject.captureId,
                    hasReaderPhoto: subject.hasReaderPhoto,
                    title: subject.title,
                    summary: subject.summary,
                    path: subject.path
                }
            })
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: AskContextPayload | null) => {
                if (!cancelled && payload) setContext(payload);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [subject]);

    // A question the launcher was opened with is sent once, and only once the
    // subject has resolved — otherwise it would be answered from the wrong
    // grounding.
    useEffect(() => {
        if (!context) return;
        const pending = takePendingQuestion();
        if (pending) void send(pending);
    }, [context, takePendingQuestion, send]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                if (confirmingClear) {
                    setConfirmingClear(false);
                    return;
                }
                close();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [close, confirmingClear]);

    useEffect(() => {
        if (!hasConversation) composerRef.current?.focus();
    }, [hasConversation]);

    /**
     * Pins the newest question to the top of the panel.
     *
     * Scrolling to the bottom drops the reader at the last line of a long answer
     * and makes them scroll back up to read it. A spacer below the exchange is
     * what lets the question actually reach the top instead of the scroll
     * stopping as soon as the content ends.
     */
    const trailingQuestionId = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (messages[index].role === "user") return messages[index].id;
        }
        return null;
    }, [messages]);

    useLayoutEffect(() => {
        if (!trailingQuestionId || trailingQuestionId === lastPinnedId.current) return;
        lastPinnedId.current = trailingQuestionId;
        const node = trailingQuestionRef.current;
        const scroller = scrollRef.current;
        if (!node || !scroller) return;
        scroller.scrollTo({
            top: node.offsetTop - scroller.offsetTop - 12,
            behavior: "smooth"
        });
    }, [trailingQuestionId]);

    const submit = useCallback((question: string, source: "form" | "chip" | "followup") => {
        if (!question.trim() || isSending) return;
        trackEvent(
            source === "followup"
                ? SPECIES_ASK_FUNNEL_EVENTS.followupClicked
                : source === "chip"
                    ? SPECIES_ASK_FUNNEL_EVENTS.chipClicked
                    : SPECIES_ASK_FUNNEL_EVENTS.submitted,
            {species_slug: resolvedSubject.slug ?? "", source: `drawer_${source}`}
        );
        setComposer("");
        void send(question);
    }, [isSending, resolvedSubject.slug, send]);

    const animalName = hints.animalName ?? resolvedSubject.name ?? null;
    const suggestions = context?.suggestions ?? askSuggestions(resolvedSubject, hints);

    const placeholder = hasConversation
        ? labels.placeholderFollowUp
        : animalName
            ? labels.placeholderAnimal.replace("{animal}", animalName)
            : labels.placeholderGeneral;

    const lastMessageId = messages[messages.length - 1]?.id ?? null;
    const remainingCopy = quota.remaining !== null && quota.limit !== null
        ? labels.remaining
            .replace("{remaining}", String(quota.remaining))
            .replace("{limit}", String(quota.limit))
        : null;

    return (
        <>
            {/* Mobile only: the sheet covers the page, so it gets a way out by tapping past it. */}
            <button
                type="button"
                aria-label={labels.close}
                onClick={close}
                className="fixed inset-0 z-[60] bg-canvas-950/60 backdrop-blur-[2px] lg:hidden"
            />

            <div
                ref={panelRef}
                role="dialog"
                aria-modal="false"
                aria-label={animalName ? labels.aboutAnimal.replace("{animal}", animalName) : labels.title}
                // Fully opaque, and no `backdrop-blur`: a translucent panel over this site
                // lets the page's lime radial glows ghost straight through the
                // conversation, even at 98% background opacity. It also matches the
                // field-guide look, which has no glassmorphism anywhere else.
                className="ask-panel fixed inset-x-0 bottom-0 z-[61] flex h-[85vh] flex-col border-t border-white/12 bg-canvas-950 shadow-[0_-12px_40px_rgba(0,0,0,0.5)] lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[26rem] lg:border-l lg:border-t-0 lg:shadow-[-12px_0_40px_rgba(0,0,0,0.45)]"
            >
                <header className="relative flex shrink-0 items-center gap-2 border-b border-white/10 px-4 pb-3 pt-4 lg:pt-3">
                    {/* Sheet grabber. Decorative on mobile only; the sheet is
                        dismissed by the close button or the backdrop. */}
                    <span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-1.5 mx-auto h-1 w-10 rounded-full bg-white/20 lg:hidden"
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        {photoUrl ? (
                            <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/15">
                                <Image src={photoUrl} alt="" fill sizes="28px" className="object-cover" />
                            </span>
                        ) : (
                            <span
                                aria-hidden="true"
                                className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-400/14 text-primary-200"
                            >
                                <SparkIcon />
                            </span>
                        )}
                        <p className="min-w-0 truncate text-sm font-semibold text-white">
                            {animalName ?? labels.title}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setConfirmingClear(true)}
                        disabled={!hasConversation}
                        aria-label={labels.newConversation}
                        title={labels.newConversation}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-35"
                    >
                        <PencilIcon />
                    </button>
                    <button
                        type="button"
                        onClick={close}
                        aria-label={labels.close}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-300 transition-colors hover:bg-white/8 hover:text-white"
                    >
                        <CloseIcon />
                    </button>
                </header>

                {confirmingClear ? (
                    <div className="shrink-0 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="text-sm text-ink-100">{labels.clearConfirm}</p>
                        <div className="mt-2.5 flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    clear();
                                    setConfirmingClear(false);
                                    composerRef.current?.focus();
                                }}
                                className="rounded-full bg-primary-400 px-3.5 py-1.5 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                            >
                                {labels.clearConfirmAction}
                            </button>
                            <button
                                type="button"
                                onClick={() => setConfirmingClear(false)}
                                className="rounded-full border border-white/12 px-3.5 py-1.5 text-xs font-semibold text-ink-200 transition-colors hover:text-white"
                            >
                                {labels.clearCancel}
                            </button>
                        </div>
                    </div>
                ) : null}

                <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                    {!hasConversation ? (
                        <div className="flex flex-col gap-4">
                            <div>
                                <h2 className="font-display text-xl font-bold leading-7 text-white">
                                    {animalName
                                        ? labels.emptyTitleAnimal.replace("{animal}", animalName)
                                        : labels.emptyTitleGeneral}
                                </h2>
                                <p className="mt-1.5 text-sm leading-6 text-ink-300">{labels.emptyHint}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                {suggestions.slice(0, 3).map((suggestion) => (
                                    <button
                                        key={suggestion.prompt}
                                        type="button"
                                        onClick={() => submit(suggestion.prompt, "chip")}
                                        className="group flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.035] px-3.5 py-3 text-left transition-colors hover:border-primary-300/35 hover:bg-white/[0.06]"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-primary-200/85">
                                                {suggestion.title}
                                            </span>
                                            <span className="mt-1 block text-sm font-semibold leading-6 text-white">
                                                {suggestion.prompt}
                                            </span>
                                        </span>
                                        <span aria-hidden="true" className="mt-1 shrink-0 text-ink-400 group-hover:text-primary-200">
                                            <ArrowUpRightIcon />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {messages.map((message) => (
                                <MessageBlock
                                    key={message.id}
                                    message={message}
                                    labels={labels}
                                    isLast={message.id === lastMessageId}
                                    isSending={isSending}
                                    photoUrl={photoUrl}
                                    photoAlt={animalName ?? ""}
                                    thinkingPhases={askThinkingPhases(
                                        lastQuestion(messages),
                                        hints
                                    )}
                                    copied={copiedId === message.id}
                                    questionRef={message.id === trailingQuestionId ? trailingQuestionRef : undefined}
                                    onCopy={() => {
                                        void navigator.clipboard?.writeText(askMarkdownPlainText(message.text));
                                        setCopiedId(message.id);
                                        setTimeout(() => {
                                            setCopiedId((current) => (current === message.id ? null : current));
                                        }, 1600);
                                    }}
                                    onShare={() => {
                                        const body = shareText(messages, message, animalName);
                                        if (navigator.share) {
                                            void navigator.share({text: body}).catch(() => undefined);
                                        } else {
                                            void navigator.clipboard?.writeText(body);
                                            setCopiedId(message.id);
                                        }
                                    }}
                                    onRegenerate={() => regenerate(message.id)}
                                    onRetry={() => retry(message.id)}
                                    onFollowUp={(prompt) => submit(prompt, "followup")}
                                />
                            ))}
                            {/* Room below the newest exchange, so the question can sit at the top. */}
                            <div aria-hidden="true" className="h-[40vh] shrink-0" />
                        </div>
                    )}

                    {quota.reached ? (
                        <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-400/[0.08] p-4">
                            <p className="text-sm font-semibold text-white">{labels.limitTitle}</p>
                            <p className="mt-1.5 text-sm leading-6 text-ink-100">{labels.limitBody}</p>
                            <Link
                                href={labels.limitHref}
                                onClick={() => {
                                    trackEvent(SPECIES_ASK_FUNNEL_EVENTS.collectClicked, {
                                        species_slug: resolvedSubject.slug ?? "",
                                        source: "drawer_limit"
                                    });
                                }}
                                className="mt-3 inline-flex rounded-full bg-primary-400 px-4 py-2 text-xs font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                            >
                                {labels.limitCta}
                            </Link>
                        </div>
                    ) : null}
                </div>

                <div className="shrink-0 border-t border-white/10 px-4 pb-4 pt-3">
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            submit(composer, "form");
                        }}
                        className="flex items-end gap-2 rounded-3xl border border-white/12 bg-white/[0.05] pl-4 pr-1.5 py-1.5 focus-within:border-primary-300/45"
                    >
                        <label className="sr-only" htmlFor="ask-animaldex-composer">{placeholder}</label>
                        <textarea
                            id="ask-animaldex-composer"
                            ref={composerRef}
                            value={composer}
                            rows={1}
                            maxLength={900}
                            placeholder={placeholder}
                            onChange={(event) => {
                                setComposer(event.target.value);
                                const node = event.target;
                                node.style.height = "auto";
                                // One to six lines, as the app's composer does.
                                node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    submit(composer, "form");
                                }
                            }}
                            className="max-h-[8.25rem] min-h-[2.25rem] w-full resize-none bg-transparent py-1.5 text-[15px] leading-6 text-white outline-none placeholder:text-ink-400"
                        />
                        <button
                            type={isSending ? "button" : "submit"}
                            onClick={isSending ? stop : undefined}
                            disabled={!isSending && composer.trim().length === 0}
                            aria-label={isSending ? labels.stop : labels.send}
                            className={`mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
                                isSending || composer.trim()
                                    ? "bg-primary-400 text-canvas-950 hover:bg-primary-300"
                                    : "bg-white/8 text-ink-400"
                            }`}
                        >
                            {isSending ? <StopIcon /> : <ArrowUpIcon />}
                        </button>
                    </form>
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-4 text-ink-400">
                        {remainingCopy ? <span>{remainingCopy}</span> : null}
                        <span className="min-w-0">{labels.disclaimer}</span>
                    </p>
                </div>
            </div>
        </>
    );
}

function lastQuestion(messages: AskMessage[]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].role === "user") return messages[index].text;
    }
    return "";
}

/** Shared text reads as prose, not as markdown source. */
function shareText(messages: AskMessage[], message: AskMessage, animalName: string | null): string {
    const index = messages.findIndex((entry) => entry.id === message.id);
    const question = index > 0 && messages[index - 1].role === "user" ? messages[index - 1].text : null;
    const heading = animalName ? `${animalName} — AnimalDex` : "AnimalDex";
    const body = askMarkdownPlainText(message.text);
    return question ? `${heading}\n\nQ: ${question}\n\n${body}` : `${heading}\n\n${body}`;
}

function MessageBlock({
    message,
    labels,
    isLast,
    isSending,
    photoUrl,
    photoAlt,
    thinkingPhases,
    copied,
    questionRef,
    onCopy,
    onShare,
    onRegenerate,
    onRetry,
    onFollowUp
}: {
    message: AskMessage;
    labels: AskDrawerLabels;
    isLast: boolean;
    isSending: boolean;
    photoUrl: string | null;
    photoAlt: string;
    thinkingPhases: string[];
    copied: boolean;
    questionRef?: React.RefObject<HTMLDivElement>;
    onCopy: () => void;
    onShare: () => void;
    onRegenerate: () => void;
    onRetry: () => void;
    onFollowUp: (prompt: string) => void;
}) {
    if (message.role === "user") {
        return (
            <div ref={questionRef} className="flex justify-end pl-8" aria-label={`${labels.youAsked} ${message.text}`}>
                <p className="rounded-3xl bg-primary-400/14 px-3.5 py-2.5 text-[15px] leading-7 text-white">
                    {message.text}
                </p>
            </div>
        );
    }

    if (message.status === "thinking") {
        return <ThinkingIndicator phases={thinkingPhases} label={labels.thinking} />;
    }

    if (message.status === "failed") {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
                <p className="text-sm leading-6 text-ink-200">{message.text}</p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-200 transition-colors hover:text-primary-100"
                >
                    <RefreshIcon />
                    {labels.tryAgain}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3.5">
            <AssistantMarkdown
                text={message.text}
                photoUrl={photoUrl}
                photoAlt={photoAlt}
                streaming={message.status === "streaming"}
            />

            {message.status === "complete" && isLast ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    <ActionButton onClick={onCopy} label={copied ? labels.copied : labels.copy}>
                        {copied ? <CheckIcon /> : <CopyIcon />}
                    </ActionButton>
                    <ActionButton onClick={onShare} label={labels.share}>
                        <ShareIcon />
                    </ActionButton>
                    <ActionButton onClick={onRegenerate} label={labels.retry} disabled={isSending}>
                        <RefreshIcon />
                    </ActionButton>
                </div>
            ) : null}

            {/* Only the newest answer offers next questions. */}
            {message.status === "complete" && isLast && message.followUpPrompts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {message.followUpPrompts.slice(0, 3).map((prompt) => (
                        <button
                            key={prompt}
                            type="button"
                            disabled={isSending}
                            onClick={() => onFollowUp(prompt)}
                            className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-ink-100 transition-colors hover:border-primary-300/40 hover:text-white disabled:opacity-40"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function ActionButton({children, label, onClick, disabled}: {
    children: React.ReactNode;
    label: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1.5 text-[11px] font-semibold text-ink-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
            {children}
            {label}
        </button>
    );
}

/**
 * The waiting state. A bare spinner reads as a stalled network; a pulsing dot
 * row plus a line naming what is being consulted reads as an assistant doing
 * something with this animal's content.
 */
function ThinkingIndicator({phases, label}: {phases: string[]; label: string}) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (phases.length <= 1) return;
        const timer = setInterval(() => {
            setIndex((current) => Math.min(current + 1, phases.length - 1));
        }, THINKING_PHASE_MS);
        return () => clearInterval(timer);
    }, [phases.length]);

    return (
        <div className="flex items-center gap-2.5" role="status" aria-label={label}>
            <span aria-hidden="true" className="flex gap-1">
                {[0, 1, 2].map((dot) => (
                    <span
                        key={dot}
                        className="ask-thinking-dot h-1.5 w-1.5 rounded-full bg-primary-400"
                        style={{animationDelay: `${dot * 160}ms`}}
                    />
                ))}
            </span>
            <span className="text-[13px] text-ink-300">{phases[Math.min(index, phases.length - 1)]}</span>
        </div>
    );
}

// MARK: - Icons

function icon(path: React.ReactNode, strokeWidth = 2) {
    return (
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {path}
        </svg>
    );
}

const SparkIcon = () => icon(<path d="M10 3.5 11.4 8 16 9.4 11.4 10.8 10 15.4 8.6 10.8 4 9.4 8.6 8Z" />);
const CloseIcon = () => icon(<path d="M5.5 5.5l9 9m0-9l-9 9" />);
const PencilIcon = () => icon(<path d="M4 16h3.5l8-8a2.1 2.1 0 0 0-3-3l-8 8V16Z" />);
const ArrowUpIcon = () => icon(<path d="M10 16V5m0 0-4.5 4.5M10 5l4.5 4.5" />, 2.4);
const StopIcon = () => (
    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        <rect x="5.5" y="5.5" width="9" height="9" rx="1.6" />
    </svg>
);
const ArrowUpRightIcon = () => icon(<path d="M6.5 13.5l7-7m0 0h-5m5 0v5" />, 2.2);
const CopyIcon = () => icon(<path d="M7.5 7.5V5.2A1.2 1.2 0 0 1 8.7 4h6.1A1.2 1.2 0 0 1 16 5.2v6.1a1.2 1.2 0 0 1-1.2 1.2H12.5M5.2 7.5h6.1A1.2 1.2 0 0 1 12.5 8.7v6.1A1.2 1.2 0 0 1 11.3 16H5.2A1.2 1.2 0 0 1 4 14.8V8.7A1.2 1.2 0 0 1 5.2 7.5Z" />);
const CheckIcon = () => icon(<path d="M4.5 10.5l3.5 3.5 7.5-8" />, 2.4);
const ShareIcon = () => icon(<path d="M10 13V4m0 0L6.5 7.5M10 4l3.5 3.5M4.5 12v2.8A1.2 1.2 0 0 0 5.7 16h8.6a1.2 1.2 0 0 0 1.2-1.2V12" />);
const RefreshIcon = () => icon(<path d="M15.5 10a5.5 5.5 0 1 1-1.9-4.2M15.5 4v3h-3" />);
