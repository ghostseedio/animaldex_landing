"use client";

import {useEffect, useRef, useState} from "react";
import {GUIDE_BAND, GUIDE_NEON, GuideGlyph} from "@/components/wildlife-guides/guide-ui";
import {
    AGENT_DELETE_MESSAGE,
    AGENT_INTRO,
    AGENT_UNAVAILABLE_MESSAGE,
    agentSuggestions,
    confirmationKey,
    confirmationTitle,
    type AgentConfirmation,
    type AgentReply
} from "@/lib/wildlife-guide-agent";
import {CloseIconButton} from "@/components/ui/icon-buttons";

/**
 * Ask AnimalDex for Wildlife Guides (iOS WildlifeGuideAgentView), as a panel
 * that opens in place on /app/guides and on a guide's editor. Deleting,
 * sharing and hiding come back as buttons under a reply and run through the
 * same owner routes as the editor, only when the author clicks.
 */

type ChatMessage = {
    id: number;
    role: "user" | "assistant";
    text: string;
    confirmations: AgentConfirmation[];
    done: string[];
    /** Errors and limits: shown, never sent back to the agent. */
    isNotice?: boolean;
};

let messageSeed = 0;

async function readError(response: Response, fallback: string) {
    const payload = await response.json().catch(() => ({})) as {error?: string};
    return payload.error || fallback;
}

/** Runs a confirmation with the owner routes the editor uses. */
async function runConfirmation(confirmation: AgentConfirmation) {
    const id = confirmation.guideId ? encodeURIComponent(confirmation.guideId) : "";
    let response: Response;
    switch (confirmation.kind) {
        case "delete_guide":
            response = await fetch(`/api/app/wildlife-guides/${id}`, {method: "DELETE"});
            break;
        case "share_guide":
        case "hide_guide":
            response = await fetch(`/api/app/wildlife-guides/${id}`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({visibility: confirmation.kind === "share_guide" ? "published" : "paused"})
            });
            break;
        case "share_all":
        case "hide_all":
            response = await fetch("/api/app/wildlife-guides/settings", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({autoPublish: confirmation.kind === "share_all", acknowledgeNotice: false})
            });
            break;
    }
    if (!response.ok) throw new Error(await readError(response, "That change could not be made. Try again."));
}

export function GuideAgentEntry({title, detail, onOpen}: {title: string; detail?: string; onOpen: () => void}) {
    return (
        <button type="button" onClick={onOpen} className={`${GUIDE_BAND} flex w-full items-center gap-3 px-[18px] py-3 text-left transition hover:bg-[#262626]`}>
            <span className="w-6 shrink-0" style={{color: GUIDE_NEON}}><GuideGlyph name="sparkles" className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">{title}</span>
                {detail ? <span className="mt-0.5 block text-xs text-white/60">{detail}</span> : null}
            </span>
            <span className="shrink-0 text-xs text-white/40" aria-hidden="true">›</span>
        </button>
    );
}

export default function GuideAgentPanel({guideTitle, onChange, onClose}: {
    /** Starts the chat about one guide (from its editor). */
    guideTitle?: string;
    /** Guides changed: reload the list or the editor. */
    onChange: () => void;
    onClose: () => void;
}) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{messageId: number; confirmation: AgentConfirmation} | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        composerRef.current?.focus({preventScroll: true});
    }, []);

    useEffect(() => {
        if (messages.length > 0 || sending) endRef.current?.scrollIntoView({behavior: "smooth", block: "nearest"});
    }, [messages.length, sending]);

    const notice = (text: string) => setMessages((current) => [
        ...current,
        {id: (messageSeed += 1), role: "assistant", text, confirmations: [], done: [], isNotice: true}
    ]);

    async function ask(history: ChatMessage[]) {
        setSending(true);
        try {
            const response = await fetch("/api/app/wildlife-guides/agent", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    messages: history.filter((message) => !message.isNotice).map((message) => ({role: message.role, text: message.text}))
                })
            });
            if (!response.ok) {
                notice(await readError(response, AGENT_UNAVAILABLE_MESSAGE));
                return;
            }
            const reply = await response.json() as AgentReply;
            setMessages((current) => [...current, {
                id: (messageSeed += 1),
                role: "assistant",
                text: reply.reply || "Done.",
                confirmations: reply.confirmations ?? [],
                done: []
            }]);
            if ((reply.changedGuideIds ?? []).length > 0) onChange();
        } catch {
            notice(AGENT_UNAVAILABLE_MESSAGE);
        } finally {
            setSending(false);
        }
    }

    function send(text: string) {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setDraft("");
        const next = [...messages, {id: (messageSeed += 1), role: "user" as const, text: trimmed, confirmations: [], done: []}];
        setMessages(next);
        void ask(next);
    }

    async function run(messageId: number, confirmation: AgentConfirmation) {
        setSending(true);
        setPendingDelete(null);
        try {
            await runConfirmation(confirmation);
            setMessages((current) => current.map((message) => message.id === messageId
                ? {...message, done: [...message.done, confirmationKey(confirmation)]}
                : message));
            onChange();
        } catch (error) {
            notice(error instanceof Error ? error.message : "That change could not be made. Try again.");
        } finally {
            setSending(false);
        }
    }

    const canSend = !sending && draft.trim().length > 0;

    return (
        <section aria-label="Ask AnimalDex" className="border-b border-white/10">
            <div className={`${GUIDE_BAND} flex items-center justify-between gap-3 px-[18px] py-2.5`}>
                <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em]" style={{color: GUIDE_NEON}}>
                    <GuideGlyph name="sparkles" className="h-4 w-4" />
                    Ask AnimalDex
                </span>
                <CloseIconButton onClick={onClose} color="rgba(255,255,255,0.7)" />
            </div>

            <div className={`${GUIDE_BAND} px-[18px] py-4`} style={{backgroundColor: "rgba(31,31,31,0.6)"}}>
                <p className="text-sm leading-6 text-white">{AGENT_INTRO}</p>
                {messages.length === 0 ? (
                    <div className="mt-3 grid gap-2.5">
                        {agentSuggestions(guideTitle).map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                disabled={sending}
                                onClick={() => send(suggestion)}
                                className="flex items-start gap-2.5 text-left text-xs font-semibold text-white hover:underline disabled:opacity-50"
                            >
                                <span className="mt-0.5 shrink-0" style={{color: GUIDE_NEON}}><GuideGlyph name="sparkles" className="h-3.5 w-3.5" /></span>
                                {suggestion}
                            </button>
                        ))}
                    </div>
                ) : null}
            </div>

            {messages.map((message) => (
                <div
                    key={message.id}
                    className={`${GUIDE_BAND} px-[18px] py-3.5`}
                    style={message.role === "user" ? {backgroundColor: "rgba(31,31,31,0.35)"} : undefined}
                >
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{color: message.role === "user" ? "rgba(255,255,255,0.42)" : GUIDE_NEON}}>
                        {message.role === "user" ? "You" : "Ask AnimalDex"}
                    </p>
                    <p className={`mt-1.5 whitespace-pre-line text-sm leading-6 ${message.isNotice ? "text-white/60" : "text-white"}`}>{message.text}</p>
                    {message.confirmations.length > 0 ? (
                        <div className="mt-3 grid gap-2">
                            {message.confirmations.map((confirmation) => {
                                const key = confirmationKey(confirmation);
                                const title = confirmationTitle(confirmation);
                                if (message.done.includes(key)) {
                                    return (
                                        <p key={key} className="flex items-center gap-1.5 text-xs font-semibold text-white/60">
                                            <GuideGlyph name="check" className="h-4 w-4" />
                                            Done: {title}
                                        </p>
                                    );
                                }
                                if (confirmation.kind === "delete_guide") {
                                    const confirming = pendingDelete?.messageId === message.id && confirmationKey(pendingDelete.confirmation) === key;
                                    return confirming ? (
                                        <div key={key} className="border-t border-white/10 pt-3">
                                            <p className="text-sm font-semibold text-white">Delete &ldquo;{confirmation.guideTitle?.trim() || "this guide"}&rdquo;?</p>
                                            <p className="mt-1 text-xs leading-5 text-white/60">{AGENT_DELETE_MESSAGE}</p>
                                            <div className="mt-2.5 flex flex-wrap gap-2.5">
                                                <button type="button" disabled={sending} onClick={() => void run(message.id, confirmation)} className="rounded-full bg-red-500 px-4 py-2 text-xs font-extrabold text-white hover:bg-red-400 disabled:opacity-50">
                                                    Delete guide
                                                </button>
                                                <button type="button" disabled={sending} onClick={() => setPendingDelete(null)} className="rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white hover:bg-white/[0.06]">
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            key={key}
                                            type="button"
                                            disabled={sending}
                                            onClick={() => setPendingDelete({messageId: message.id, confirmation})}
                                            className="w-fit rounded-full border border-red-400/60 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                                        >
                                            {title}
                                        </button>
                                    );
                                }
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        disabled={sending}
                                        onClick={() => void run(message.id, confirmation)}
                                        className="w-fit rounded-full px-4 py-2 text-xs font-extrabold text-black hover:opacity-90 disabled:opacity-50"
                                        style={{backgroundColor: GUIDE_NEON}}
                                    >
                                        {title}
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            ))}

            {sending ? (
                <p className={`${GUIDE_BAND} flex items-center gap-2.5 px-[18px] py-3.5 text-xs text-white/60`} aria-live="polite">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20" style={{borderTopColor: GUIDE_NEON}} aria-hidden="true" />
                    Working on your guides…
                </p>
            ) : null}
            <div ref={endRef} />

            <form
                className="flex items-end gap-2.5 bg-[#1F1F1F] px-[18px] py-2.5"
                onSubmit={(event) => {
                    event.preventDefault();
                    send(draft);
                }}
            >
                <textarea
                    ref={composerRef}
                    rows={1}
                    value={draft}
                    maxLength={4000}
                    placeholder="Ask for a change…"
                    aria-label="Ask for a change"
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            send(draft);
                        }
                    }}
                    className="max-h-32 min-h-[40px] flex-1 resize-y border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
                />
                <button
                    type="submit"
                    disabled={!canSend}
                    aria-label="Send"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-black transition disabled:opacity-35"
                    style={{backgroundColor: canSend ? GUIDE_NEON : "rgba(255,255,255,0.25)"}}
                >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                </button>
            </form>
        </section>
    );
}
