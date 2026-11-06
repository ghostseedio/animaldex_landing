/**
 * Messages v2 (AnimalDex 20261020230000) as the web shows it: the shapes the
 * routes hand the client, and the pure rules iOS keeps in
 * `DirectMessagePresentation` and `DirectMessage`: inbox order and search,
 * the preview line, timestamps, the thread's day pills, unread line and
 * bubble groups, unsend's window and the mute durations.
 */

import {fillWords, type DirectMessageWords} from "@/lib/direct-message-words";

export type DirectMessageProfile = {
    userId: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    href: string | null;
    isSystem?: boolean;
};

/** A photo or animal card sent from the app, with URLs signed for this page view. */
export type DirectMessageAttachment =
    | {
        kind: "image";
        bubbleUrl: string | null;
        fullUrl: string | null;
        width: number | null;
        height: number | null;
        caption?: string | null;
    }
    | {
        kind: "capture";
        captureId: string;
        title: string;
        animalName: string | null;
        ownerName?: string | null;
        grade: number | null;
        imageUrl: string | null;
        caption?: string | null;
    };

export type DirectMessage = {
    id: string;
    senderId: string;
    recipientId: string;
    /** The plain-text stand-in older clients show ("📷 Photo", "🐾 Red Fox"). */
    body: string;
    /** What the sender typed: a photo or card's caption, else the body. */
    text: string;
    createdAt: string;
    readAt: string | null;
    deliveredAt?: string | null;
    deletedAt: string | null;
    /** Photos only: "pending" until screening decides, then "approved" or "removed". */
    photoReview: "pending" | "approved" | "removed" | null;
    attachment: DirectMessageAttachment | null;
    sender: DirectMessageProfile | null;
    recipient: DirectMessageProfile | null;
};

/** One person's own view of a conversation. The other person never sees it. */
export type DirectMessageSettings = {
    pinnedAt: string | null;
    mutedUntil: string | null;
    markedUnreadAt: string | null;
};

export const NO_DIRECT_MESSAGE_SETTINGS: DirectMessageSettings = {pinnedAt: null, mutedUntil: null, markedUnreadAt: null};

export type DirectMessageConversationSummary = {
    otherUser: DirectMessageProfile;
    lastMessage: DirectMessage;
    unreadCount: number;
    settings: DirectMessageSettings;
};

/** How long after sending a message can still be taken back (`unsend_direct_message`). */
export const UNSEND_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Consecutive same-sender messages within this stay one visual group. */
export const GROUPING_INTERVAL_MS = 5 * 60 * 1000;

/** The cap `set_direct_conversation_pinned` enforces. */
export const PIN_LIMIT = 5;

function time(value: string | null | undefined): number {
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : 0;
}

export function isMuted(settings: DirectMessageSettings, now: Date = new Date()): boolean {
    return Boolean(settings.mutedUntil) && time(settings.mutedUntil) > now.getTime();
}

export function isPinned(summary: Pick<DirectMessageConversationSummary, "settings">): boolean {
    return Boolean(summary.settings.pinnedAt);
}

export function isMarkedUnread(summary: Pick<DirectMessageConversationSummary, "settings">): boolean {
    return Boolean(summary.settings.markedUnreadAt);
}

/** Unread messages, or marked unread by hand. */
export function showsUnread(summary: Pick<DirectMessageConversationSummary, "settings" | "unreadCount">): boolean {
    return summary.unreadCount > 0 || isMarkedUnread(summary);
}

export function conversationTitle(partner: DirectMessageProfile, words: Pick<DirectMessageWords, "support">): string {
    if (partner.isSystem) return words.support;
    const trimmed = partner.displayName.trim();
    return trimmed || (partner.username ? `@${partner.username}` : "");
}

/** Real identity only: the @handle for collectors, Official for system accounts. */
export function conversationSubtitle(partner: DirectMessageProfile, words: Pick<DirectMessageWords, "official">): string | null {
    if (partner.isSystem) return words.official;
    return partner.username ? `@${partner.username}` : null;
}

export function isPhotoRemoved(message: Pick<DirectMessage, "photoReview" | "deletedAt">): boolean {
    return message.photoReview === "removed" && !message.deletedAt;
}

export function isPhotoBeingChecked(message: Pick<DirectMessage, "photoReview" | "deletedAt" | "attachment">): boolean {
    return message.photoReview === "pending" && message.attachment?.kind === "image" && !message.deletedAt;
}

/** One line for inbox rows and reports (`DirectMessage.summaryText`). */
export function messageSummary(
    message: Pick<DirectMessage, "body" | "attachment" | "deletedAt" | "photoReview">,
    words: Pick<DirectMessageWords, "deletedMessage" | "photoNotDelivered" | "photo" | "message">
): string {
    if (isPhotoRemoved(message)) return words.photoNotDelivered;
    if (message.deletedAt) return words.deletedMessage;
    const attachment = message.attachment;
    if (attachment?.kind === "image") {
        const caption = attachment.caption?.trim() ?? "";
        return `📷 ${caption || words.photo}`;
    }
    if (attachment?.kind === "capture") return `🐾 ${attachment.title}`;
    const trimmed = message.body.trim();
    return trimmed || words.message;
}

/** The inbox line under a name: "You: …" for your own last message. */
export function inboxPreview(
    summary: Pick<DirectMessageConversationSummary, "lastMessage">,
    currentUserId: string | null,
    words: Pick<DirectMessageWords, "deletedMessage" | "photoNotDelivered" | "photo" | "message" | "youPrefix">
): string {
    const text = messageSummary(summary.lastMessage, words);
    if (summary.lastMessage.senderId !== currentUserId || summary.lastMessage.deletedAt) return text;
    return fillWords(words.youPrefix, {text});
}

/**
 * Support first, then pinned conversations (most recently pinned on top),
 * then everything else by its latest message.
 */
export function sortedInbox<T extends DirectMessageConversationSummary>(inbox: T[]): T[] {
    return [...inbox].sort((left, right) => {
        const leftSupport = Boolean(left.otherUser.isSystem);
        const rightSupport = Boolean(right.otherUser.isSystem);
        if (leftSupport !== rightSupport) return leftSupport ? -1 : 1;
        const leftPin = left.settings.pinnedAt ? time(left.settings.pinnedAt) : null;
        const rightPin = right.settings.pinnedAt ? time(right.settings.pinnedAt) : null;
        if (leftPin !== null && rightPin !== null && leftPin !== rightPin) return rightPin - leftPin;
        if (leftPin !== null && rightPin === null) return -1;
        if (leftPin === null && rightPin !== null) return 1;
        return time(right.lastMessage.createdAt) - time(left.lastMessage.createdAt);
    });
}

/** The inbox search: the name, the @handle (with or without "@") and the preview. */
export function filteredInbox<T extends DirectMessageConversationSummary>(
    inbox: T[],
    query: string,
    words: Pick<DirectMessageWords, "support" | "deletedMessage" | "photoNotDelivered" | "photo" | "message">
): T[] {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return inbox;
    const handleNeedle = needle.replace(/@/g, "");
    return inbox.filter((summary) =>
        conversationTitle(summary.otherUser, words).toLocaleLowerCase().includes(needle)
        || (handleNeedle.length > 0 && (summary.otherUser.username ?? "").toLocaleLowerCase().includes(handleNeedle))
        || messageSummary(summary.lastMessage, words).toLocaleLowerCase().includes(needle)
    );
}

/** A conversation's settings changed: the new row, and the inbox in its order again. */
export function applySettings<T extends DirectMessageConversationSummary>(inbox: T[], partnerId: string, settings: DirectMessageSettings): T[] {
    return sortedInbox(inbox.map((summary) => summary.otherUser.userId === partnerId ? {...summary, settings} : summary));
}

/** A conversation read here: no count, no hand-made mark. */
export function markedRead<T extends DirectMessageConversationSummary>(inbox: T[], partnerId: string): T[] {
    return inbox.map((summary) => summary.otherUser.userId === partnerId
        ? {...summary, unreadCount: 0, settings: {...summary.settings, markedUnreadAt: null}}
        : summary);
}

export type MuteDuration = "eightHours" | "oneWeek" | "always";

export const MUTE_DURATIONS: MuteDuration[] = ["eightHours", "oneWeek", "always"];

export function muteDurationTitle(duration: MuteDuration, words: Pick<DirectMessageWords, "mute8Hours" | "mute1Week" | "muteAlways">): string {
    return duration === "eightHours" ? words.mute8Hours : duration === "oneWeek" ? words.mute1Week : words.muteAlways;
}

/** When a mute chosen now ends; "Always" is 9999-01-01, as on iOS. */
export function muteEndDate(duration: MuteDuration, now: Date = new Date()): Date {
    if (duration === "eightHours") return new Date(now.getTime() + 8 * 60 * 60 * 1000);
    if (duration === "oneWeek") return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return new Date(Date.UTC(9999, 0, 1));
}

export function canUnsend(message: Pick<DirectMessage, "senderId" | "deletedAt" | "createdAt">, userId: string | null, now: Date = new Date()): boolean {
    return Boolean(userId)
        && message.senderId === userId
        && !message.deletedAt
        && now.getTime() - time(message.createdAt) < UNSEND_WINDOW_MS;
}

export type DirectMessageReceipt = "sent" | "delivered" | "read";

export function receiptFor(message: Pick<DirectMessage, "readAt" | "deliveredAt">): DirectMessageReceipt {
    if (message.readAt) return "read";
    if (message.deliveredAt) return "delivered";
    return "sent";
}

export function receiptLabel(receipt: DirectMessageReceipt, words: Pick<DirectMessageWords, "sent" | "delivered" | "seen">): string {
    return receipt === "read" ? words.seen : receipt === "delivered" ? words.delivered : words.sent;
}

// ---------------------------------------------------------------------------
// Dates. Computed in the reader's own time zone, so only ever on the client.
// ---------------------------------------------------------------------------

function appDateLocale(locale?: string | null): string {
    return locale === "id" ? "id-ID" : "en-US";
}

function sameDay(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

/** "14:02", as iOS's HH:mm. */
export function clockTime(value: string | Date, locale?: string | null): string {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(appDateLocale(locale), {hour: "2-digit", minute: "2-digit", hourCycle: "h23"}).format(date);
}

/**
 * The inbox column: a time today, then Yesterday, a weekday within the
 * week, and a short date after that.
 */
export function inboxTimestamp(value: string, now: Date, locale: string | null | undefined, words: Pick<DirectMessageWords, "yesterday">): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() <= 0) return "";
    if (sameDay(date, now)) return clockTime(date, locale);
    if (sameDay(date, addDays(now, -1))) return words.yesterday;
    if (date >= addDays(startOfDay(now), -6)) {
        return new Intl.DateTimeFormat(appDateLocale(locale), {weekday: "long"}).format(date);
    }
    const sameYear = date.getFullYear() === now.getFullYear();
    return new Intl.DateTimeFormat(appDateLocale(locale), sameYear
        ? {day: "numeric", month: "short"}
        : {day: "numeric", month: "short", year: "2-digit"}).format(date);
}

/** The day pill in a thread. */
export function dateSeparatorLabel(value: string, now: Date, locale: string | null | undefined, words: Pick<DirectMessageWords, "today" | "yesterday">): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    if (sameDay(date, now)) return words.today;
    if (sameDay(date, addDays(now, -1))) return words.yesterday;
    if (date >= addDays(startOfDay(now), -6)) {
        return new Intl.DateTimeFormat(appDateLocale(locale), {weekday: "long"}).format(date);
    }
    if (date.getFullYear() === now.getFullYear()) {
        return new Intl.DateTimeFormat(appDateLocale(locale), {weekday: "short", month: "short", day: "numeric"}).format(date);
    }
    return new Intl.DateTimeFormat(appDateLocale(locale), {year: "numeric", month: "short", day: "numeric"}).format(date);
}

export function unreadDividerLabel(count: number, words: Pick<DirectMessageWords, "unreadOne" | "unreadMany">): string {
    return count === 1 ? words.unreadOne : fillWords(words.unreadMany, {count});
}

// ---------------------------------------------------------------------------
// The thread
// ---------------------------------------------------------------------------

export type DirectMessageThreadRow =
    | {kind: "day"; id: string; date: string}
    | {kind: "unread"; id: "unread-divider"; count: number}
    | {
        kind: "bubble";
        id: string;
        message: DirectMessage;
        isOutgoing: boolean;
        /** The partner's avatar sits beside the last bubble of their run. */
        showsAvatar: boolean;
        isGroupStart: boolean;
        isGroupEnd: boolean;
    };

/** Day pills, the unread line where the unread run began, and bubble groups (`buildRows`). */
export function buildThreadRows(
    messages: DirectMessage[],
    currentUserId: string | null,
    unreadAnchorId: string | null = null,
    unreadCount = 0
): DirectMessageThreadRow[] {
    const rows: DirectMessageThreadRow[] = [];
    let previousDay: Date | null = null;
    let previous: DirectMessage | null = null;

    messages.forEach((message, index) => {
        const created = new Date(message.createdAt);
        if (!previousDay || !sameDay(previousDay, created)) {
            rows.push({kind: "day", id: `day-${message.id}`, date: message.createdAt});
            previousDay = created;
            previous = null;
        }
        if (message.id === unreadAnchorId && unreadCount > 0) {
            rows.push({kind: "unread", id: "unread-divider", count: unreadCount});
            previous = null;
        }
        const next = messages[index + 1] ?? null;
        const before: DirectMessage | null = previous;
        const sameAsPrevious = before !== null
            && before.senderId === message.senderId
            && time(message.createdAt) - time(before.createdAt) <= GROUPING_INTERVAL_MS;
        const sameAsNext = next !== null
            && next.senderId === message.senderId
            && next.id !== unreadAnchorId
            && time(next.createdAt) - time(message.createdAt) <= GROUPING_INTERVAL_MS
            && sameDay(new Date(next.createdAt), created);
        const isOutgoing = message.senderId === currentUserId;
        rows.push({
            kind: "bubble",
            id: message.id,
            message,
            isOutgoing,
            showsAvatar: !isOutgoing && !sameAsNext,
            isGroupStart: !sameAsPrevious,
            isGroupEnd: !sameAsNext
        });
        previous = message;
    });

    return rows;
}

/** Rows from a page or a sync, merged by id, in the order they were sent. */
export function mergeThreadMessages(current: DirectMessage[], incoming: DirectMessage[]): DirectMessage[] {
    if (!incoming.length) return current;
    const byId = new Map<string, DirectMessage>();
    current.forEach((message) => byId.set(message.id, message));
    incoming.forEach((message) => byId.set(message.id, message));
    return Array.from(byId.values()).sort((left, right) => {
        const delta = time(left.createdAt) - time(right.createdAt);
        return delta !== 0 ? delta : left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
}

/** What a report of the whole conversation carries: their latest message, else the last five lines. */
export function conversationReportSnapshot(
    messages: DirectMessage[],
    partnerId: string,
    words: Pick<DirectMessageWords, "deletedMessage" | "photoNotDelivered" | "photo" | "message">
): {contentId: string | null; snapshot: string} {
    const incoming = messages.filter((message) => message.senderId === partnerId);
    const latest = incoming[incoming.length - 1] ?? null;
    if (latest) return {contentId: latest.id, snapshot: messageSummary(latest, words)};
    return {contentId: null, snapshot: messages.slice(-5).map((message) => messageSummary(message, words)).join("\n")};
}
