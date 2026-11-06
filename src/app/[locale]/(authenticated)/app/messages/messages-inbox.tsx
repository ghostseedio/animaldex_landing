"use client";

import {useCallback, useEffect, useMemo, useState, type MouseEvent} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
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
import NewMessagePicker from "@/app/[locale]/(authenticated)/app/messages/_components/new-message-picker";
import {
    applySettings,
    conversationTitle,
    filteredInbox,
    inboxPreview,
    inboxTimestamp,
    isMuted,
    isPinned,
    isMarkedUnread,
    markedRead,
    MUTE_DURATIONS,
    muteDurationTitle,
    muteEndDate,
    receiptFor,
    receiptLabel,
    showsUnread,
    sortedInbox,
    type DirectMessageConversationSummary,
    type DirectMessageProfile,
    type DirectMessageSettings
} from "@/lib/direct-message-presentation";
import {directMessageKnownErrors, fillWords, type DirectMessageWords} from "@/lib/direct-message-words";
import {AppRequestError, userFacingError} from "@/lib/user-facing-error";

type SyncState = "loaded" | "loading" | "failed";

/** iOS refreshes an open inbox every eight seconds. */
const INBOX_POLL_MS = 8000;

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const payload = await response.json().catch(() => ({})) as T & {error?: string};
    if (!response.ok) throw new AppRequestError(response.status, payload.error ?? null);
    return payload;
}

function postConversation(otherUserId: string, action: string, extra: Record<string, unknown> = {}) {
    return requestJson<{settings?: DirectMessageSettings; ok?: boolean}>("/api/app/messages/conversation", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({otherUserId, action, ...extra})
    });
}

/**
 * The Messages inbox (iOS `DirectMessageInboxView`): people only, support
 * first, then pins, then the latest; search once there is something to
 * search; each row's menu reads, pins, mutes, opens the profile, deletes and
 * blocks, as iOS's swipe actions and context menu do.
 */
export default function MessagesInbox({initialInbox, currentUserId, locale, words}: {
    initialInbox: DirectMessageConversationSummary[] | null;
    currentUserId: string;
    locale: string;
    words: DirectMessageWords;
}) {
    const router = useRouter();
    const {words: shellWords} = useAppShellChrome();
    const mounted = useMounted();
    const visible = usePageVisible();
    const [inbox, setInbox] = useState<DirectMessageConversationSummary[]>(() => sortedInbox(initialInbox ?? []));
    const [syncState, setSyncState] = useState<SyncState>(initialInbox ? "loaded" : "failed");
    const [query, setQuery] = useState("");
    const [menu, setMenu] = useState<{summary: DirectMessageConversationSummary; x: number; y: number} | null>(null);
    const [pendingDelete, setPendingDelete] = useState<DirectMessageConversationSummary | null>(null);
    const [pendingBlock, setPendingBlock] = useState<DirectMessageConversationSummary | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [showsNewMessage, setShowsNewMessage] = useState(false);
    const [now, setNow] = useState(() => new Date());

    const describe = useCallback((error: unknown) => userFacingError(error, shellWords, {
        known: directMessageKnownErrors(words),
        context: "messages"
    }).message, [shellWords, words]);

    const refresh = useCallback(async (silent: boolean) => {
        if (!silent) setSyncState("loading");
        try {
            const payload = await requestJson<{inbox: DirectMessageConversationSummary[]}>("/api/app/messages/inbox");
            setInbox(sortedInbox(payload.inbox ?? []));
            setSyncState("loaded");
            setNow(new Date());
        } catch {
            if (!silent) setSyncState("failed");
        }
    }, []);

    // On arrival as well as every few seconds: a page the router kept from an
    // earlier visit would otherwise show a conversation read or blocked since.
    useEffect(() => {
        if (!visible) return;
        void refresh(true);
        const timer = window.setInterval(() => void refresh(true), INBOX_POLL_MS);
        return () => window.clearInterval(timer);
    }, [visible, refresh]);

    const displayed = useMemo(() => filteredInbox(inbox, query, words), [inbox, query, words]);

    async function setUnread(unread: boolean, summary: DirectMessageConversationSummary) {
        try {
            const {settings} = await postConversation(summary.otherUser.userId, unread ? "unread" : "read");
            setInbox((current) => {
                const next = settings ? applySettings(current, summary.otherUser.userId, settings) : current;
                return unread ? next : markedRead(next, summary.otherUser.userId);
            });
        } catch (error) {
            setNotice(describe(error));
        }
    }

    async function setPinned(pinned: boolean, summary: DirectMessageConversationSummary) {
        try {
            const {settings} = await postConversation(summary.otherUser.userId, pinned ? "pin" : "unpin");
            if (settings) setInbox((current) => applySettings(current, summary.otherUser.userId, settings));
        } catch (error) {
            setNotice(describe(error));
        }
    }

    async function setMuted(until: Date | null, summary: DirectMessageConversationSummary) {
        try {
            const {settings} = await postConversation(summary.otherUser.userId, until ? "mute" : "unmute", until ? {mutedUntil: until.toISOString()} : {});
            if (settings) setInbox((current) => applySettings(current, summary.otherUser.userId, settings));
        } catch (error) {
            setNotice(describe(error));
        }
    }

    async function deleteConversation(summary: DirectMessageConversationSummary) {
        setPendingDelete(null);
        try {
            await postConversation(summary.otherUser.userId, "delete");
            setInbox((current) => current.filter((row) => row.otherUser.userId !== summary.otherUser.userId));
        } catch (error) {
            setNotice(describe(error));
        }
    }

    async function blockConversation(summary: DirectMessageConversationSummary) {
        setPendingBlock(null);
        try {
            await postConversation(summary.otherUser.userId, "block");
            setInbox((current) => current.filter((row) => row.otherUser.userId !== summary.otherUser.userId));
        } catch (error) {
            setNotice(describe(error));
        }
    }

    function menuItems(summary: DirectMessageConversationSummary): DmMenuItem[] {
        const unread = showsUnread(summary);
        const items: DmMenuItem[] = [{
            kind: "action",
            label: unread ? words.markRead : words.markUnread,
            icon: unread ? "envelopeOpen" : "envelopeBadge",
            onSelect: () => void setUnread(!unread, summary)
        }];
        if (summary.otherUser.isSystem) return items;
        const pinned = isPinned(summary);
        items.push({kind: "action", label: pinned ? words.unpin : words.pin, icon: pinned ? "pinSlash" : "pin", onSelect: () => void setPinned(!pinned, summary)});
        if (isMuted(summary.settings)) {
            items.push({kind: "action", label: words.unmute, icon: "bell", onSelect: () => void setMuted(null, summary)});
        } else {
            items.push({
                kind: "submenu",
                label: words.mute,
                icon: "bellSlash",
                items: MUTE_DURATIONS.map((duration) => ({label: muteDurationTitle(duration, words), onSelect: () => void setMuted(muteEndDate(duration), summary)}))
            });
        }
        if (summary.otherUser.href) {
            const href = summary.otherUser.href;
            items.push({kind: "action", label: words.viewProfile, icon: "person", onSelect: () => router.push(localeHref(locale, href))});
        }
        items.push(
            {kind: "divider"},
            {kind: "action", label: words.deleteConversation, icon: "trash", destructive: true, onSelect: () => setPendingDelete(summary)},
            {kind: "action", label: words.blockUser, icon: "hand", destructive: true, onSelect: () => setPendingBlock(summary)}
        );
        return items;
    }

    function openMenu(event: MouseEvent, summary: DirectMessageConversationSummary) {
        event.preventDefault();
        event.stopPropagation();
        const target = event.currentTarget.getBoundingClientRect();
        const fromButton = event.type === "click";
        setMenu({summary, x: fromButton ? target.right - 220 : event.clientX, y: fromButton ? target.bottom + 4 : event.clientY});
    }

    function rowLabel(summary: DirectMessageConversationSummary) {
        const parts: string[] = [];
        if (summary.otherUser.isSystem || isPinned(summary)) parts.push(words.pinned);
        parts.push(conversationTitle(summary.otherUser, words));
        if (summary.unreadCount > 0) parts.push(fillWords(words.unreadCount, {count: summary.unreadCount}));
        else if (isMarkedUnread(summary)) parts.push(words.unread);
        if (isMuted(summary.settings, now)) parts.push(words.muted);
        parts.push(inboxPreview(summary, currentUserId, words));
        return parts.join(", ");
    }

    function row(summary: DirectMessageConversationSummary) {
        const unread = showsUnread(summary);
        const muted = isMuted(summary.settings, now);
        const isSupport = Boolean(summary.otherUser.isSystem);
        const last = summary.lastMessage;
        const isOwnLast = last.senderId === currentUserId;
        const receipt = receiptFor(last);
        return (
            <li key={summary.otherUser.userId} className="group relative" onContextMenu={(event) => openMenu(event, summary)}>
                <Link
                    href={`/app/messages/${encodeURIComponent(summary.otherUser.userId)}`}
                    aria-label={rowLabel(summary)}
                    className="flex min-h-[72px] items-center gap-3 px-4 py-[11px] pr-12 transition hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none"
                >
                    <DmAvatar profile={summary.otherUser} size={50} unreadRing={unread} />
                    <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5">
                            <span className={`truncate text-base text-white ${unread ? "font-bold" : "font-semibold"}`}>{conversationTitle(summary.otherUser, words)}</span>
                            {isSupport ? <span className="shrink-0 self-center rounded-full bg-[#A7F432] px-1.5 py-px text-[10px] font-bold text-[#0b0b0b]">{words.official}</span> : null}
                            {muted ? <DmSymbol name="bellSlash" className="h-[12px] w-[12px] shrink-0 self-center text-white/35" strokeWidth={2.2} /> : null}
                            <span className="min-w-2 flex-1" />
                            <span suppressHydrationWarning className={`shrink-0 text-xs ${unread ? "font-semibold text-[#A7F432]" : "font-medium text-white/35"}`}>
                                {mounted ? inboxTimestamp(last.createdAt, now, locale, words) : ""}
                            </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                            {isOwnLast && !last.deletedAt ? <span className="text-white/35"><DmReceiptMark receipt={receipt} label={receiptLabel(receipt, words)} /></span> : null}
                            <span className={`line-clamp-2 min-w-0 flex-1 text-sm leading-5 ${last.deletedAt ? "italic" : ""} ${summary.unreadCount > 0 ? "font-medium" : ""} ${unread ? "text-white" : "text-white/55"}`}>
                                {inboxPreview(summary, currentUserId, words)}
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5">
                                {isPinned(summary) || isSupport ? <DmSymbol name="pin" className="h-[12px] w-[12px] rotate-[40deg] text-white/35" strokeWidth={2.2} /> : null}
                                {summary.unreadCount > 0 ? (
                                    <span className={`rounded-full px-[7px] py-[3px] text-[11px] font-bold leading-none text-[#0b0b0b] ${muted ? "bg-white/35" : "bg-[#A7F432]"}`}>
                                        {summary.unreadCount > 99 ? "99+" : summary.unreadCount}
                                    </span>
                                ) : isMarkedUnread(summary) ? <span className="h-2.5 w-2.5 rounded-full bg-[#A7F432]" /> : null}
                            </span>
                        </span>
                    </span>
                </Link>
                <button
                    type="button"
                    onClick={(event) => openMenu(event, summary)}
                    aria-label={words.conversationOptions}
                    aria-haspopup="menu"
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-white/45 opacity-100 transition hover:bg-white/[0.08] hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7F432]/50 md:opacity-0 md:group-hover:opacity-100"
                >
                    <DmSymbol name="ellipsis" className="h-5 w-5" />
                </button>
                <div className="absolute bottom-0 left-[78px] right-0 h-px bg-white/[0.08]" aria-hidden="true" />
            </li>
        );
    }

    const loading = syncState === "loading" && !inbox.length;
    const failed = syncState === "failed" && !inbox.length;

    return (
        <div className="mx-auto w-full max-w-2xl pb-10">
            <header className="mb-2 grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
                <span />
                <h1 className="truncate text-center text-[17px] font-bold text-white">{words.title}</h1>
                <button
                    type="button"
                    onClick={() => setShowsNewMessage(true)}
                    aria-label={words.newMessageLabel}
                    className="grid h-11 w-11 place-items-center justify-self-end rounded-full text-[#A7F432] transition hover:bg-white/[0.06]"
                >
                    <DmSymbol name="compose" className="h-5 w-5" strokeWidth={2.1} />
                </button>
            </header>

            {loading ? (
                <div className="-mx-4 sm:-mx-7 md:mx-0" aria-label={words.loading} role="status">
                    {[[130, 210], [96, 170], [150, 190], [110, 230], [140, 160], [90, 200]].map(([top, bottom], index) => (
                        <div key={index} className="relative flex h-[72px] items-center gap-3 px-4">
                            <span className="h-[50px] w-[50px] shrink-0 animate-pulse rounded-full bg-white/[0.08]" />
                            <span className="space-y-2">
                                <span className="block h-3 animate-pulse rounded-full bg-white/[0.08]" style={{width: top}} />
                                <span className="block h-2.5 animate-pulse rounded-full bg-white/[0.05]" style={{width: bottom}} />
                            </span>
                            <span className="absolute bottom-0 left-[78px] right-0 h-px bg-white/[0.08]" />
                        </div>
                    ))}
                </div>
            ) : failed ? (
                <div className="flex flex-col items-center px-7 py-20 text-center">
                    <DmSymbol name="bubbles" className="h-7 w-7 text-white/35" />
                    <p className="mt-3 text-lg font-semibold text-white">{words.unavailableTitle}</p>
                    <p className="mt-2 max-w-sm text-sm font-medium text-white/55">{shellWords.errorServer}</p>
                    <button type="button" onClick={() => void refresh(false)} className="mt-3 text-sm font-bold text-[#A7F432] hover:text-[#c4ff6a]">
                        {words.retry}
                    </button>
                </div>
            ) : !inbox.length ? (
                <div className="flex flex-col items-center px-7 py-20 text-center">
                    <DmSymbol name="bubbles" className="h-7 w-7 text-white/35" />
                    <p className="mt-3 text-lg font-semibold text-white">{words.emptyTitle}</p>
                    <p className="mt-2 max-w-sm text-sm font-medium text-white/55">{words.emptyDetail}</p>
                    <button
                        type="button"
                        onClick={() => setShowsNewMessage(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#A7F432] px-[18px] py-[11px] text-[15px] font-bold text-[#0b0b0b] transition hover:bg-[#b8f65a]"
                    >
                        <DmSymbol name="compose" className="h-4 w-4" strokeWidth={2.3} />
                        {words.newMessage}
                    </button>
                </div>
            ) : (
                <>
                    <div className="mb-2">
                        <label className="flex items-center gap-2 rounded-panel bg-white/[0.08] px-3 py-2 text-white/45 focus-within:ring-1 focus-within:ring-[#A7F432]/40">
                            <DmSymbol name="search" className="h-4 w-4" />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={words.search}
                                aria-label={words.search}
                                className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
                            />
                        </label>
                    </div>
                    <ul className="-mx-4 border-y border-white/[0.08] bg-[#111] sm:-mx-7 md:mx-0 md:border">
                        {displayed.map(row)}
                    </ul>
                    {!displayed.length ? (
                        <p className="py-8 text-center text-sm font-medium text-white/55">{fillWords(words.noMatches, {query})}</p>
                    ) : null}
                </>
            )}

            {menu ? (
                <DmMenu
                    items={menuItems(menu.summary)}
                    anchor={{x: menu.x, y: menu.y}}
                    label={words.conversationOptions}
                    onClose={() => setMenu(null)}
                />
            ) : null}

            {pendingDelete ? (
                <DmAlert
                    title={words.deleteTitle}
                    message={words.deleteDetail}
                    onCancel={() => setPendingDelete(null)}
                    actions={[
                        {label: words.cancel, role: "cancel", onSelect: () => setPendingDelete(null)},
                        {label: words.delete, role: "destructive", onSelect: () => void deleteConversation(pendingDelete)}
                    ]}
                />
            ) : null}

            {pendingBlock ? (
                <DmAlert
                    title={words.blockTitle}
                    message={words.blockDetail}
                    onCancel={() => setPendingBlock(null)}
                    actions={[
                        {label: words.cancel, role: "cancel", onSelect: () => setPendingBlock(null)},
                        {label: words.block, role: "destructive", onSelect: () => void blockConversation(pendingBlock)}
                    ]}
                />
            ) : null}

            {notice ? (
                <DmAlert title={words.title} message={notice} onCancel={() => setNotice(null)} actions={[{label: words.ok, onSelect: () => setNotice(null)}]} />
            ) : null}

            {showsNewMessage ? (
                <NewMessagePicker
                    words={words}
                    recents={inbox.map((summary) => summary.otherUser)}
                    onClose={() => setShowsNewMessage(false)}
                    onPick={(profile: DirectMessageProfile) => {
                        setShowsNewMessage(false);
                        router.push(localeHref(locale, `/app/messages/${encodeURIComponent(profile.userId)}`));
                    }}
                />
            ) : null}
        </div>
    );
}
