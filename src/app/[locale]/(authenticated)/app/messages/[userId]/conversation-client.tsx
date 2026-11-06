"use client";

import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import SupportMessageBody from "@/app/[locale]/(composited)/support/_components/support-message-body";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {
    DmAlert,
    DmAvatar,
    DmMenu,
    DmReceiptMark,
    DmSymbol,
    localeHref,
    useMounted,
    usePageVisible,
    type DmMenuItem
} from "@/app/[locale]/(authenticated)/app/messages/_components/dm-ui";
import {
    buildThreadRows,
    canUnsend,
    clockTime,
    conversationReportSnapshot,
    conversationSubtitle,
    conversationTitle,
    dateSeparatorLabel,
    isMuted,
    isPhotoBeingChecked,
    isPhotoRemoved,
    mergeThreadMessages,
    messageSummary,
    MUTE_DURATIONS,
    muteDurationTitle,
    muteEndDate,
    NO_DIRECT_MESSAGE_SETTINGS,
    receiptFor,
    receiptLabel,
    unreadDividerLabel,
    type DirectMessage,
    type DirectMessageAttachment,
    type DirectMessageProfile,
    type DirectMessageSettings,
    type DirectMessageThreadRow
} from "@/lib/direct-message-presentation";
import {directMessageKnownErrors, fillWords, type DirectMessageWords} from "@/lib/direct-message-words";
import {AppRequestError, userFacingError} from "@/lib/user-facing-error";

/** The thread's first page as the server read it (`direct_message_thread_page`). */
export type ConversationInitialPage = {
    messages: DirectMessage[];
    hasMore: boolean;
    serverNow: string;
    partnerTyping: boolean;
    settings: DirectMessageSettings;
    firstUnreadId: string | null;
    unreadCount: number;
};

/** Layout work before paint in the browser; nothing on the server render. */
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** iOS polls an open thread every 2.5 seconds. */
const SYNC_MS = 2500;
const NEAR_BOTTOM_PX = 140;

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const payload = await response.json().catch(() => ({})) as T & {error?: string};
    if (!response.ok) throw new AppRequestError(response.status, payload.error ?? null);
    return payload;
}

function postJson<T>(input: string, body: Record<string, unknown>) {
    return requestJson<T>(input, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
}

/** Width over height, held to the range the apps draw. */
function photoAspect(attachment: Extract<DirectMessageAttachment, {kind: "image"}>) {
    if (!attachment.width || !attachment.height) return 4 / 3;
    return Math.min(1.9, Math.max(0.56, attachment.width / attachment.height));
}

/** iOS `DirectMessageBubbleStyle.shape`: the sender's corners tighten inside a run. */
function bubbleRadius(isOutgoing: boolean, isGroupStart: boolean, isGroupEnd: boolean) {
    const large = "var(--r-bubble)";
    const small = "var(--r-bubble-tight)";
    const top = isGroupStart ? large : small;
    const bottom = isGroupEnd ? large : small;
    return isOutgoing
        ? `${large} ${top} ${bottom} ${large}`
        : `${top} ${large} ${large} ${bottom}`;
}

const OUTGOING_FILL = "#1F5A35";
const INCOMING_FILL = "#1A2520";

export default function ConversationClient({
    partner,
    currentUserId,
    initialPage,
    initialDraft = "",
    initiallyBlocked,
    locale,
    words
}: {
    partner: DirectMessageProfile;
    currentUserId: string;
    /** Null when the first read failed: the screen says so and offers Retry. */
    initialPage: ConversationInitialPage | null;
    initialDraft?: string;
    initiallyBlocked: boolean;
    locale: string;
    words: DirectMessageWords;
}) {
    const router = useRouter();
    const {words: shellWords} = useAppShellChrome();
    const mounted = useMounted();
    const visible = usePageVisible();

    const [messages, setMessages] = useState<DirectMessage[]>(initialPage?.messages ?? []);
    const [loadState, setLoadState] = useState<"loaded" | "loading" | "failed">(initialPage ? "loaded" : "failed");
    const [hasOlder, setHasOlder] = useState(initialPage?.hasMore ?? false);
    const [settings, setSettings] = useState<DirectMessageSettings>(initialPage?.settings ?? NO_DIRECT_MESSAGE_SETTINGS);
    const [partnerTyping, setPartnerTyping] = useState(initialPage?.partnerTyping ?? false);
    const [unreadAnchor] = useState(() => ({id: initialPage?.firstUnreadId ?? null, count: initialPage?.unreadCount ?? 0}));
    const [blocked, setBlocked] = useState(initiallyBlocked);
    const [draft, setDraft] = useState(initialDraft);
    const [sending, setSending] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [menu, setMenu] = useState<{items: DmMenuItem[]; x: number; y: number; label: string} | null>(null);
    const [pendingUnsend, setPendingUnsend] = useState<DirectMessage | null>(null);
    const [pendingBlock, setPendingBlock] = useState(false);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [unseenIncoming, setUnseenIncoming] = useState(0);
    const [now, setNow] = useState(() => new Date());

    const listRef = useRef<HTMLDivElement | null>(null);
    const topSentinelRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const cursorRef = useRef<string | null>(initialPage?.serverNow ?? null);
    const messagesRef = useRef<DirectMessage[]>(messages);
    messagesRef.current = messages;
    const syncingRef = useRef(false);
    const loadingOlderRef = useRef(false);
    const nearBottomRef = useRef(true);
    const prependAnchorRef = useRef<number | null>(null);
    const scrollAfterRenderRef = useRef<"instant" | "smooth" | null>("instant");

    const title = conversationTitle(partner, words);
    const isSystem = Boolean(partner.isSystem);
    const muted = isMuted(settings, now);
    const describe = useCallback((error: unknown) => userFacingError(error, shellWords, {
        known: directMessageKnownErrors(words),
        context: "messages"
    }).message, [shellWords, words]);

    const rows = useMemo(
        () => buildThreadRows(messages, currentUserId, unreadAnchor.id, unreadAnchor.count),
        [messages, currentUserId, unreadAnchor]
    );

    // Opening the thread reads it, as iOS's first page does while the app is in front.
    useEffect(() => {
        if (loadState !== "loaded" || !visible) return;
        fetch("/api/app/messages/read", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({otherUserId: partner.userId})
        }).catch(() => undefined);
    }, [partner.userId, loadState, visible]);

    const scrollToBottom = useCallback((behavior: "instant" | "smooth") => {
        const list = listRef.current;
        if (!list) return;
        list.scrollTo({top: list.scrollHeight, behavior: behavior === "smooth" ? "smooth" : "auto"});
    }, []);

    // After a render: hold an older page's prepend in place, or go to the latest when asked.
    useBrowserLayoutEffect(() => {
        const list = listRef.current;
        if (!list || !mounted) return;
        if (prependAnchorRef.current !== null) {
            list.scrollTop += list.scrollHeight - prependAnchorRef.current;
            prependAnchorRef.current = null;
            return;
        }
        if (scrollAfterRenderRef.current) {
            scrollToBottom(scrollAfterRenderRef.current);
            scrollAfterRenderRef.current = null;
        }
    }, [rows, partnerTyping, mounted, scrollToBottom]);

    const onScroll = useCallback(() => {
        const list = listRef.current;
        if (!list) return;
        const near = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
        nearBottomRef.current = near;
        setIsNearBottom(near);
        if (near) setUnseenIncoming(0);
    }, []);

    const loadInitial = useCallback(async () => {
        setLoadState((state) => (state === "loaded" ? state : "loading"));
        try {
            const {page} = await requestJson<{page: ConversationInitialPage}>(`/api/app/messages/thread?with=${encodeURIComponent(partner.userId)}&markRead=1`);
            setMessages(page.messages);
            setHasOlder(page.hasMore);
            setSettings(page.settings);
            setPartnerTyping(page.partnerTyping);
            cursorRef.current = page.serverNow;
            scrollAfterRenderRef.current = "instant";
            setLoadState("loaded");
        } catch {
            setLoadState("failed");
        }
    }, [partner.userId]);

    const syncNow = useCallback(async () => {
        if (syncingRef.current || loadState !== "loaded") return;
        syncingRef.current = true;
        try {
            const since = cursorRef.current ? `&since=${encodeURIComponent(cursorRef.current)}` : "";
            const {sync} = await requestJson<{sync: {messages: DirectMessage[]; serverNow: string; partnerTyping: boolean}}>(
                `/api/app/messages/sync?with=${encodeURIComponent(partner.userId)}${since}&markRead=${document.visibilityState === "visible" ? "1" : "0"}`
            );
            cursorRef.current = sync.serverNow;
            setPartnerTyping(sync.partnerTyping);
            setNow(new Date());
            if (sync.messages.length) {
                const known = new Set(messagesRef.current.map((message) => message.id));
                const fresh = sync.messages.filter((message) => !known.has(message.id));
                const incoming = fresh.filter((message) => message.senderId !== currentUserId).length;
                if (fresh.length && (nearBottomRef.current || incoming < fresh.length)) {
                    scrollAfterRenderRef.current = "smooth";
                } else if (incoming) {
                    setUnseenIncoming((count) => count + incoming);
                }
                setMessages((current) => mergeThreadMessages(current, sync.messages));
            }
        } catch {
            // Quiet: the next tick tries again.
        } finally {
            syncingRef.current = false;
        }
    }, [loadState, partner.userId, currentUserId]);

    useEffect(() => {
        if (!visible || loadState !== "loaded") return;
        void syncNow();
        const timer = window.setInterval(() => void syncNow(), SYNC_MS);
        return () => window.clearInterval(timer);
    }, [visible, loadState, syncNow]);

    const loadOlder = useCallback(async () => {
        const oldest = messages[0];
        if (!oldest || !hasOlder || loadingOlderRef.current || loadState !== "loaded") return;
        loadingOlderRef.current = true;
        try {
            const {page} = await requestJson<{page: ConversationInitialPage}>(
                `/api/app/messages/thread?with=${encodeURIComponent(partner.userId)}&before=${encodeURIComponent(oldest.id)}`
            );
            prependAnchorRef.current = listRef.current?.scrollHeight ?? null;
            setMessages((current) => mergeThreadMessages(current, page.messages));
            setHasOlder(page.hasMore);
        } catch {
            // The top of the list asks again when it comes back into view.
        } finally {
            loadingOlderRef.current = false;
        }
    }, [messages, hasOlder, loadState, partner.userId]);

    useEffect(() => {
        const sentinel = topSentinelRef.current;
        const list = listRef.current;
        if (!sentinel || !list || !hasOlder || !mounted) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) void loadOlder();
        }, {root: list, rootMargin: "200px 0px 0px 0px"});
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasOlder, loadOlder, mounted]);

    // The composer grows with what is typed, to five lines.
    useEffect(() => {
        const element = textareaRef.current;
        if (!element) return;
        element.style.height = "auto";
        element.style.height = `${Math.min(element.scrollHeight, 132)}px`;
    }, [draft]);

    async function send() {
        const trimmed = draft.trim();
        if (!trimmed || sending) return;
        setSending(true);
        setErrorMessage(null);
        try {
            const {message} = await postJson<{message: DirectMessage}>("/api/app/messages/send", {recipientId: partner.userId, body: trimmed});
            scrollAfterRenderRef.current = "smooth";
            setMessages((current) => mergeThreadMessages(current, [message]));
            setDraft("");
        } catch (error) {
            setErrorMessage(describe(error));
        } finally {
            setSending(false);
        }
    }

    async function unsend(message: DirectMessage) {
        setPendingUnsend(null);
        try {
            const {message: updated} = await postJson<{message: DirectMessage}>("/api/app/messages/unsend", {
                messageId: message.id,
                wasPhoto: message.attachment?.kind === "image" || message.body.startsWith("📷")
            });
            setMessages((current) => mergeThreadMessages(current, [updated]));
        } catch (error) {
            setErrorMessage(describe(error));
        }
    }

    async function conversationAction(action: string, extra: Record<string, unknown> = {}) {
        return postJson<{settings?: DirectMessageSettings; ok?: boolean}>("/api/app/messages/conversation", {otherUserId: partner.userId, action, ...extra});
    }

    async function setPinned(pinned: boolean) {
        try {
            const result = await conversationAction(pinned ? "pin" : "unpin");
            if (result.settings) setSettings(result.settings);
        } catch (error) {
            setNotice(describe(error));
        }
    }

    async function setMutedUntil(until: Date | null) {
        try {
            const result = await conversationAction(until ? "mute" : "unmute", until ? {mutedUntil: until.toISOString()} : {});
            if (result.settings) {
                setSettings(result.settings);
                setNow(new Date());
            }
        } catch (error) {
            setNotice(describe(error));
        }
    }

    async function reportConversation() {
        const {contentId, snapshot} = conversationReportSnapshot(messages, partner.userId, words);
        try {
            await conversationAction("report", {contentId, snapshot});
            setNotice(words.conversationReported);
        } catch (error) {
            setNotice(describe(error));
        }
    }

    async function reportMessage(message: DirectMessage) {
        try {
            await conversationAction("report", {contentId: message.id, snapshot: messageSummary(message, words)});
            setNotice(words.messageReported);
        } catch (error) {
            setNotice(describe(error));
        }
    }

    async function blockPartner() {
        setPendingBlock(false);
        try {
            await conversationAction("block");
            setBlocked(true);
            router.push(localeHref(locale, "/app/messages"));
        } catch (error) {
            setNotice(describe(error));
        }
    }

    function openProfile() {
        if (isSystem || !partner.href) return;
        router.push(localeHref(locale, partner.href));
    }

    function conversationMenu(): DmMenuItem[] {
        const items: DmMenuItem[] = [];
        if (partner.href) items.push({kind: "action", label: words.viewProfile, icon: "person", onSelect: openProfile});
        items.push({kind: "action", label: settings.pinnedAt ? words.unpinChat : words.pinChat, icon: settings.pinnedAt ? "pinSlash" : "pin", onSelect: () => void setPinned(!settings.pinnedAt)});
        if (muted) {
            items.push({kind: "action", label: words.unmute, icon: "bell", onSelect: () => void setMutedUntil(null)});
        } else {
            items.push({
                kind: "submenu",
                label: words.mute,
                icon: "bellSlash",
                items: MUTE_DURATIONS.map((duration) => ({label: muteDurationTitle(duration, words), onSelect: () => void setMutedUntil(muteEndDate(duration))}))
            });
        }
        items.push(
            {kind: "divider"},
            {kind: "action", label: words.reportConversation, icon: "report", destructive: true, onSelect: () => void reportConversation()},
            {kind: "action", label: words.blockUser, icon: "hand", destructive: true, onSelect: () => setPendingBlock(true)}
        );
        return items;
    }

    /** iOS `actions(for:)`, less what a browser does itself (reply, save photo, info). */
    function messageMenu(message: DirectMessage): DmMenuItem[] {
        const outgoing = message.senderId === currentUserId;
        const items: DmMenuItem[] = [];
        if (message.deletedAt) return items;
        if (isPhotoRemoved(message)) {
            if (canUnsend(message, currentUserId)) items.push({kind: "action", label: words.unsend, icon: "unsend", destructive: true, onSelect: () => setPendingUnsend(message)});
            return items;
        }
        if (message.text) {
            items.push({kind: "action", label: words.copy, icon: "copy", onSelect: () => void navigator.clipboard?.writeText(message.text).catch(() => undefined)});
        }
        if (message.attachment?.kind === "capture") {
            const captureId = message.attachment.captureId;
            items.push({kind: "action", label: words.openCard, icon: "card", onSelect: () => router.push(localeHref(locale, `/app/capture/${encodeURIComponent(captureId)}`))});
        }
        if (outgoing) {
            if (canUnsend(message, currentUserId)) items.push({kind: "action", label: words.unsend, icon: "unsend", destructive: true, onSelect: () => setPendingUnsend(message)});
        } else if (!isSystem) {
            items.push({kind: "action", label: words.report, icon: "report", destructive: true, onSelect: () => void reportMessage(message)});
        }
        return items;
    }

    function openMenu(event: MouseEvent, items: DmMenuItem[], label: string) {
        if (!items.length) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const fromButton = event.type === "click";
        setMenu({items, label, x: fromButton ? rect.right - 220 : event.clientX, y: fromButton ? rect.bottom + 4 : event.clientY});
    }

    function meta(message: DirectMessage, outgoing: boolean, onMedia = false) {
        const receipt = receiptFor(message);
        return (
            <span suppressHydrationWarning className={`inline-flex shrink-0 items-center gap-[3px] text-[11px] font-medium ${onMedia ? "text-white" : "text-white/55"}`}>
                {mounted ? clockTime(message.createdAt, locale) : ""}
                {outgoing ? <DmReceiptMark receipt={receipt} label={receiptLabel(receipt, words)} /> : null}
            </span>
        );
    }

    function bubbleBody(row: Extract<DirectMessageThreadRow, {kind: "bubble"}>): ReactNode {
        const {message, isOutgoing} = row;
        const radius = bubbleRadius(isOutgoing, row.isGroupStart, row.isGroupEnd);
        if (message.deletedAt) {
            return (
                <div className="inline-flex items-center gap-1.5 border border-white/10 px-3 py-[9px] text-white/40" style={{borderRadius: radius}}>
                    <DmSymbol name="nosign" className="h-[14px] w-[14px]" />
                    <span className="text-[15px] italic">{isOutgoing ? words.youUnsent : words.deletedMessage}</span>
                    <span className="pl-1">{meta(message, false)}</span>
                </div>
            );
        }
        if (isPhotoRemoved(message)) {
            return (
                <div className="inline-flex items-baseline gap-2 border border-white/10 px-3 py-[9px] text-white/40" style={{borderRadius: radius}}>
                    <DmSymbol name="eyeSlash" className="h-[14px] w-[14px] self-center" />
                    <span className="flex flex-col">
                        <span className="text-[15px] font-semibold text-white/60">{words.photoNotDelivered}</span>
                        <span className="text-[13px]">{words.mayBreakRules}</span>
                    </span>
                    <span className="pl-1">{meta(message, false)}</span>
                </div>
            );
        }
        const attachment = message.attachment;
        const text = message.text;
        const withArticle = text.includes("[[adex-article:");
        return (
            <div
                className={`overflow-hidden text-left ${attachment ? "w-[248px] max-w-full" : "max-w-full"}`}
                style={{borderRadius: radius, background: isOutgoing ? OUTGOING_FILL : INCOMING_FILL}}
            >
                {attachment?.kind === "image" ? (
                    <a
                        href={attachment.fullUrl ?? attachment.bubbleUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="relative block w-full bg-white/[0.04]"
                        style={{aspectRatio: photoAspect(attachment)}}
                        aria-label={words.photo}
                    >
                        {attachment.bubbleUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={attachment.bubbleUrl} alt={words.photo} loading="lazy" className="h-full w-full object-cover" />
                        ) : null}
                        {isOutgoing && isPhotoBeingChecked(message) ? (
                            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px] font-semibold text-white">
                                <DmSymbol name="hourglass" className="h-[10px] w-[10px]" strokeWidth={2.4} />
                                {words.checkingPhoto}
                            </span>
                        ) : null}
                        {!text ? <span className="absolute bottom-2 right-2 rounded-full bg-black/45 px-[7px] py-[3px]">{meta(message, isOutgoing, true)}</span> : null}
                    </a>
                ) : null}
                {attachment?.kind === "capture" ? <CardAttachment attachment={attachment} words={words} /> : null}
                {text ? (
                    <div className={`px-3 pb-[7px] ${attachment ? "pt-1.5" : "pt-2"}`}>
                        {withArticle ? (
                            <div className="text-[15px] text-white"><SupportMessageBody body={text} /></div>
                        ) : (
                            <p className="whitespace-pre-wrap break-words text-base leading-[1.35] text-white">
                                {text}
                                <span className="float-right ml-2 mt-[5px] translate-y-[3px]">{meta(message, isOutgoing)}</span>
                            </p>
                        )}
                        {withArticle ? <div className="mt-1 flex justify-end">{meta(message, isOutgoing)}</div> : null}
                    </div>
                ) : attachment?.kind === "capture" ? (
                    <div className="flex justify-end px-3 pb-[7px]">{meta(message, isOutgoing)}</div>
                ) : null}
            </div>
        );
    }

    function threadRow(row: DirectMessageThreadRow) {
        if (row.kind === "day") {
            return (
                <div key={row.id} className="flex justify-center py-3" role="heading" aria-level={2}>
                    <span suppressHydrationWarning className="rounded-full bg-white/[0.08] px-3 py-[5px] text-xs font-semibold text-white/60">
                        {dateSeparatorLabel(row.date, now, locale, words)}
                    </span>
                </div>
            );
        }
        if (row.kind === "unread") {
            return (
                <div key={row.id} className="-mx-3.5 my-2.5 bg-white/[0.06] py-1.5 text-center text-xs font-semibold text-[#A7F432]">
                    {unreadDividerLabel(row.count, words)}
                </div>
            );
        }
        const {message, isOutgoing} = row;
        const actions = messageMenu(message);
        return (
            <div
                key={row.id}
                className={`group/bubble flex items-end gap-2 ${row.isGroupStart ? "pt-2" : "pt-0.5"} ${isOutgoing ? "justify-end" : "justify-start"}`}
                onContextMenu={actions.length ? (event) => openMenu(event, actions, words.moreOptions) : undefined}
            >
                {!isOutgoing ? (
                    <span className="w-7 shrink-0">
                        {row.showsAvatar ? (
                            isSystem || !partner.href ? <DmAvatar profile={partner} size={28} /> : (
                                <button type="button" onClick={openProfile} aria-label={fillWords(words.viewNamesProfile, {name: title})} className="block rounded-full">
                                    <DmAvatar profile={partner} size={28} />
                                </button>
                            )
                        ) : null}
                    </span>
                ) : null}
                {isOutgoing && actions.length ? <BubbleOptions label={words.moreOptions} onOpen={(event) => openMenu(event, actions, words.moreOptions)} /> : null}
                <div className={`flex max-w-[min(300px,78%)] flex-col ${isOutgoing ? "items-end" : "items-start"}`}>
                    {bubbleBody(row)}
                </div>
                {!isOutgoing && actions.length ? <BubbleOptions label={words.moreOptions} onOpen={(event) => openMenu(event, actions, words.moreOptions)} /> : null}
            </div>
        );
    }

    const showsSkeleton = !mounted || (loadState === "loading" && !messages.length);
    const subtitle = partnerTyping ? words.typing : conversationSubtitle(partner, words);

    return (
        <div className="-mx-4 -my-7 flex h-[calc(100dvh-4.5rem)] flex-col sm:-mx-7 lg:-mx-10 lg:-my-10 lg:h-[100dvh]">
            <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.08] bg-[#0b0b0b]/95 px-2 py-1.5 backdrop-blur-xl">
                <Link href="/app/messages" aria-label={words.inbox} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#A7F432] transition hover:bg-white/[0.06]">
                    <DmSymbol name="back" className="h-5 w-5" strokeWidth={2.4} />
                </Link>
                <button
                    type="button"
                    onClick={openProfile}
                    disabled={isSystem || !partner.href}
                    title={isSystem ? undefined : words.opensProfile}
                    className="flex min-w-0 flex-1 items-center justify-center gap-2.5 rounded-panel px-2 py-1 text-left transition enabled:hover:bg-white/[0.04] disabled:cursor-default"
                >
                    <DmAvatar profile={partner} size={32} />
                    <span className="min-w-0">
                        <span className="flex items-center gap-1">
                            <span className="truncate text-base font-semibold text-white">{title}</span>
                            {muted ? <DmSymbol name="bellSlash" className="h-[11px] w-[11px] shrink-0 text-white/35" strokeWidth={2.2} /> : null}
                        </span>
                        {subtitle ? (
                            <span className={`block truncate text-[11px] ${partnerTyping ? "font-semibold text-[#A7F432]" : isSystem ? "font-medium text-[#A7F432]/85" : "font-medium text-white/40"}`}>{subtitle}</span>
                        ) : null}
                    </span>
                </button>
                {isSystem ? <span className="h-11 w-11 shrink-0" /> : (
                    <button
                        type="button"
                        onClick={(event) => openMenu(event, conversationMenu(), words.conversationOptions)}
                        aria-label={words.conversationOptions}
                        aria-haspopup="menu"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#A7F432] transition hover:bg-white/[0.06]"
                    >
                        <DmSymbol name="ellipsis" className="h-5 w-5" />
                    </button>
                )}
            </header>

            <div className="relative min-h-0 flex-1">
                {showsSkeleton ? (
                    <div className="mx-auto w-full max-w-3xl space-y-3.5 px-3.5 pt-6" role="status" aria-label={words.loadingConversation}>
                        {[180, 120, 220, 150, 200, 110].map((width, index) => (
                            <div key={index} className={`flex ${index % 2 === 0 ? "justify-end" : "justify-start"}`}>
                                <span className="animate-pulse rounded-bubble bg-white/[0.07]" style={{width, height: index === 2 ? 56 : 38}} />
                            </div>
                        ))}
                    </div>
                ) : loadState === "failed" && !messages.length ? (
                    <div className="flex h-full flex-col items-center justify-center px-7 text-center">
                        <DmSymbol name="bubbles" className="h-7 w-7 text-white/35" />
                        <p className="mt-3 text-lg font-semibold text-white">{words.conversationUnavailable}</p>
                        <p className="mt-2 max-w-sm text-sm font-medium text-white/55">{shellWords.errorServer}</p>
                        <button type="button" onClick={() => void loadInitial()} className="mt-3 text-sm font-bold text-[#A7F432] hover:text-[#c4ff6a]">{words.retry}</button>
                    </div>
                ) : (
                    <div ref={listRef} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain">
                        <div className="mx-auto w-full max-w-3xl px-3.5 pb-1.5 pt-1.5">
                            {hasOlder ? (
                                <div ref={topSentinelRef} className="flex justify-center py-3.5" aria-hidden="true">
                                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#A7F432]/25 border-t-[#A7F432]" />
                                </div>
                            ) : null}
                            {!messages.length ? (
                                <div className="flex flex-col items-center px-6 pt-14 text-center">
                                    <DmAvatar profile={partner} size={64} />
                                    <p className="mt-2.5 text-lg font-semibold text-white">{words.startConversation}</p>
                                    <p className="mt-1.5 max-w-sm text-sm font-medium text-white/55">
                                        {isSystem ? words.sendToSupport : fillWords(words.sayHi, {name: title})}
                                    </p>
                                </div>
                            ) : null}
                            {rows.map(threadRow)}
                            {partnerTyping ? (
                                <div className="flex items-end gap-2 pt-2" aria-label={words.typing}>
                                    <DmAvatar profile={partner} size={28} />
                                    <span className="flex h-9 w-[58px] items-center justify-center gap-1 rounded-bubble" style={{background: INCOMING_FILL}}>
                                        {[0, 150, 300].map((delay) => <span key={delay} className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60" style={{animationDelay: `${delay}ms`}} />)}
                                    </span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
                {!isNearBottom && !showsSkeleton ? (
                    <button
                        type="button"
                        onClick={() => {
                            setUnseenIncoming(0);
                            scrollToBottom("smooth");
                        }}
                        aria-label={unseenIncoming > 0 ? fillWords(words.newMessages, {count: unseenIncoming}) : words.scrollToLatest}
                        className="absolute bottom-3 right-3.5 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-[#1b1b1d] text-white shadow-[0_3px_8px_rgba(0,0,0,0.35)] transition hover:bg-[#232326]"
                    >
                        <DmSymbol name="chevronDown" className="h-4 w-4" strokeWidth={2.6} />
                        {unseenIncoming > 0 ? (
                            <span className="absolute -left-1.5 -top-1.5 rounded-full bg-[#A7F432] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[#0b0b0b]">{unseenIncoming}</span>
                        ) : null}
                    </button>
                ) : null}
            </div>

            <div className="shrink-0 border-t border-white/[0.08] bg-[#0b0b0b]/95 px-3 pb-3 pt-2 backdrop-blur-xl">
                <div className="mx-auto w-full max-w-3xl">
                    {blocked ? (
                        <p className="px-2 py-3 text-center text-[13px] font-medium text-white/55">{words.blockedComposer}</p>
                    ) : (
                        <>
                            {errorMessage ? (
                                <div className="mb-2 flex items-start gap-2 rounded-panel bg-[#FF9F43]/10 px-3 py-2 text-[13px] text-[#FFB26B]">
                                    <span className="flex-1">{errorMessage}</span>
                                    <button type="button" onClick={() => setErrorMessage(null)} aria-label={words.cancel} className="text-[#FFB26B]/80 hover:text-[#FFB26B]">
                                        <DmSymbol name="close" className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : null}
                            <div className="flex items-end gap-2">
                                <textarea
                                    ref={textareaRef}
                                    value={draft}
                                    onChange={(event) => setDraft(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                                            event.preventDefault();
                                            void send();
                                        }
                                    }}
                                    rows={1}
                                    maxLength={1000}
                                    placeholder={words.placeholder}
                                    aria-label={words.placeholder}
                                    className="max-h-[132px] min-h-[40px] flex-1 resize-none rounded-bubble border border-white/10 bg-white/[0.06] px-4 py-[9px] text-base leading-[1.35] text-white outline-none transition placeholder:text-white/35 focus:border-[#A7F432]/40"
                                />
                                <button
                                    type="button"
                                    onClick={() => void send()}
                                    disabled={!draft.trim() || sending}
                                    aria-label={words.send}
                                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#A7F432] text-[#0b0b0b] transition enabled:hover:bg-[#b8f65a] disabled:bg-white/10 disabled:text-white/30"
                                >
                                    {sending
                                        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                                        : <DmSymbol name="send" className="h-5 w-5" strokeWidth={2.6} />}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {menu ? <DmMenu items={menu.items} anchor={{x: menu.x, y: menu.y}} label={menu.label} onClose={() => setMenu(null)} /> : null}

            {pendingUnsend ? (
                <DmAlert
                    title={words.unsendTitle}
                    message={fillWords(words.unsendDetail, {name: title})}
                    onCancel={() => setPendingUnsend(null)}
                    actions={[
                        {label: words.cancel, role: "cancel", onSelect: () => setPendingUnsend(null)},
                        {label: words.unsend, role: "destructive", onSelect: () => void unsend(pendingUnsend)}
                    ]}
                />
            ) : null}

            {pendingBlock ? (
                <DmAlert
                    title={words.blockTitle}
                    message={words.blockDetail}
                    onCancel={() => setPendingBlock(false)}
                    actions={[
                        {label: words.cancel, role: "cancel", onSelect: () => setPendingBlock(false)},
                        {label: words.block, role: "destructive", onSelect: () => void blockPartner()}
                    ]}
                />
            ) : null}

            {notice ? <DmAlert title={words.title} message={notice} onCancel={() => setNotice(null)} actions={[{label: words.ok, onSelect: () => setNotice(null)}]} /> : null}
        </div>
    );
}

function BubbleOptions({label, onOpen}: {label: string; onOpen: (event: MouseEvent) => void}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={label}
            aria-haspopup="menu"
            className="mb-1 grid h-7 w-7 shrink-0 place-items-center self-center rounded-full text-white/40 opacity-100 transition hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7F432]/50 md:opacity-0 md:group-hover/bubble:opacity-100"
        >
            <DmSymbol name="ellipsis" className="h-4 w-4" />
        </button>
    );
}

/** iOS `DirectMessageCardBubble`: the card's still, its grade, ANIMAL CARD, the name, the species and whose it is. */
function CardAttachment({attachment, words}: {
    attachment: Extract<DirectMessageAttachment, {kind: "capture"}>;
    words: DirectMessageWords;
}) {
    const subtitle = attachment.animalName && attachment.animalName.toLowerCase() !== attachment.title.toLowerCase() ? attachment.animalName : null;
    return (
        <Link href={`/app/capture/${encodeURIComponent(attachment.captureId)}`} className="block text-left text-white">
            <span className="relative block w-full overflow-hidden bg-white/[0.04]" style={{aspectRatio: "1 / 1.08"}}>
                {attachment.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={attachment.imageUrl} alt={attachment.title} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                    <span className="flex h-full w-full items-center justify-center text-5xl text-[#A7F432]/35" aria-hidden="true">🐾</span>
                )}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-50% to-black/55" />
                {attachment.grade !== null && attachment.grade > 0 ? (
                    <span className="absolute left-2 top-2 rounded-full bg-[#A7F432] px-2 py-0.5 text-[11px] font-bold text-[#0b0b0b]">
                        {fillWords(words.grade, {grade: attachment.grade})}
                    </span>
                ) : null}
            </span>
            <span className="block space-y-[3px] px-3 pb-1 pt-2.5">
                <span className="flex items-center gap-1 text-[10px] font-black tracking-[0.11em] text-[#A7F432]">
                    <span aria-hidden="true">🐾</span>
                    {words.animalCard}
                </span>
                <span className="line-clamp-2 block text-base font-bold">{attachment.title}</span>
                {subtitle ? <span className="block truncate text-[13px] font-medium text-white/60">{subtitle}</span> : null}
                {attachment.ownerName ? <span className="block truncate text-xs font-medium text-white/40">{fillWords(words.byOwner, {name: attachment.ownerName})}</span> : null}
            </span>
        </Link>
    );
}
