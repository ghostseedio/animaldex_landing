"use client";

import {useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppAvatar, AppPage, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {DirectMessage, DirectMessageProfile} from "@/data/direct-messages";
import {formatAppShortDateTime} from "@/lib/app-dates";

function formatWhen(value: string, locale: string) {
    return formatAppShortDateTime(value, locale);
}

export default function ConversationClient({
    partner,
    currentUserId,
    initialMessages,
    initialDraft = "",
    locale
}: {
    partner: DirectMessageProfile;
    currentUserId: string;
    initialMessages: DirectMessage[];
    initialDraft?: string;
    locale: string;
}) {
    const [messages, setMessages] = useState(initialMessages);
    const [draft, setDraft] = useState(initialDraft);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        fetch("/api/app/messages/read", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({otherUserId: partner.userId})
        }).catch(() => undefined);
    }, [partner.userId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({behavior: messages.length > initialMessages.length ? "smooth" : "auto"});
    }, [messages, initialMessages.length]);

    async function sendMessage() {
        const trimmed = draft.trim();
        if (!trimmed || sending) return;

        setSending(true);
        setError(null);

        try {
            const response = await fetch("/api/app/messages/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({recipientId: partner.userId, body: trimmed})
            });
            const payload = await response.json() as {message?: DirectMessage; error?: string};

            if (!response.ok || !payload.message) {
                throw new Error(payload.error || "Message could not be sent.");
            }

            setMessages((current) => [...current, payload.message!]);
            setDraft("");
        } catch (sendError) {
            setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
        } finally {
            setSending(false);
        }
    }

    return (
        <AppPage narrow>
            <div className="mb-5 flex items-center gap-3">
                <Link href="/app/messages" aria-label="Back to inbox" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:text-white">
                    <AppIcon name="back" className="h-5 w-5" />
                </Link>
                <div className="min-w-0 flex-1">
                    {partner.href
                        ? <Link href={partner.href} className="block truncate font-display text-2xl font-bold text-white hover:text-primary-100">{partner.displayName}</Link>
                        : <h1 className="truncate font-display text-2xl font-bold text-white">{partner.displayName}</h1>}
                    <p className="truncate text-sm text-white/40">
                        {partner.isSystem ? "Official AnimalDex support" : (partner.username ? `@${partner.username}` : null)}
                    </p>
                </div>
                <AppAvatar src={partner.avatarUrl} name={partner.displayName} />
            </div>

            <AppSurface className="flex min-h-[calc(100vh-16rem)] flex-col !p-0">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {messages.length ? messages.map((message) => {
                        const outgoing = message.senderId === currentUserId;
                        return (
                            <div key={message.id} className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] space-y-1 ${outgoing ? "text-right" : "text-left"}`}>
                                    <p className={`inline-block rounded-[1.1rem] px-4 py-3 text-sm leading-6 ${outgoing ? "bg-primary-400 text-black" : "border border-white/10 bg-[#1b1b1b] text-white"}`}>
                                        {message.body}
                                    </p>
                                    <p className="text-[0.68rem] font-bold text-white/25">{formatWhen(message.createdAt, locale)}</p>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="flex h-full min-h-[16rem] flex-col items-center justify-center px-6 text-center">
                            <AppIcon name="message" className="h-8 w-8 text-white/25" />
                            <p className="mt-4 font-display text-xl font-bold text-white">Start the conversation</p>
                            <p className="mt-2 max-w-md text-sm leading-6 text-white/45">Your messages with {partner.displayName} will show up here.</p>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                <div className="border-t border-white/[0.06] p-4">
                    {error ? <p className="mb-2 text-sm text-orange-300">{error}</p> : null}
                    <div className="flex items-end gap-3">
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    void sendMessage();
                                }
                            }}
                            rows={1}
                            maxLength={1000}
                            placeholder="Write a message"
                            className="min-h-[3rem] flex-1 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-primary-400/40"
                        />
                        <button
                            type="button"
                            onClick={() => void sendMessage()}
                            disabled={!draft.trim() || sending}
                            aria-label="Send message"
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-400 text-black transition enabled:hover:bg-primary-200 disabled:bg-white/10 disabled:text-white/30"
                        >
                            {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <AppIcon name="send" className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </AppSurface>
        </AppPage>
    );
}
