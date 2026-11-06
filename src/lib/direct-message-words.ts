/**
 * Messages (people) in the reader's language: the inbox, a conversation and
 * the New Message picker. English is iOS's own copy (MessagesCenterView,
 * DirectMessageThreadView, DirectMessagePickers, DirectMessageComposer,
 * DirectMessageBubbleRow and DirectMessageServiceError), the locale's
 * `appMessages` over it. `{name}`-style slots are filled with `fillWords`.
 */

export const DIRECT_MESSAGE_WORDS_EN = {
    title: "Messages",
    newMessage: "New Message",
    newMessageLabel: "New message",
    search: "Search",
    noMatches: "No chats match “{query}”.",
    emptyTitle: "No messages yet",
    emptyDetail: "Start a chat with another collector, or send someone one of your animals.",
    unavailableTitle: "Messages are unavailable",
    retry: "Retry",
    loading: "Loading messages…",
    support: "AnimalDex Support",
    official: "Official",
    pinned: "Pinned",
    unreadCount: "{count} unread",
    muted: "Muted",
    youPrefix: "You: {text}",
    read: "Read",
    unread: "Unread",
    markRead: "Mark as Read",
    markUnread: "Mark as Unread",
    pin: "Pin",
    unpin: "Unpin",
    mute: "Mute",
    unmute: "Unmute",
    mute8Hours: "8 hours",
    mute1Week: "1 week",
    muteAlways: "Always",
    viewProfile: "View Profile",
    delete: "Delete",
    deleteConversation: "Delete Conversation",
    blockUser: "Block User",
    deleteTitle: "Delete conversation?",
    deleteDetail: "This removes the chat from your inbox. If they message you again, it will come back.",
    blockTitle: "Block this collector?",
    block: "Block",
    blockDetail: "They won’t be able to message you, and their content will be hidden from your feed.",
    cancel: "Cancel",
    ok: "OK",
    today: "Today",
    yesterday: "Yesterday",
    photo: "Photo",
    message: "Message",
    deletedMessage: "This message was deleted",
    youUnsent: "You unsent this message",
    photoNotDelivered: "Photo not delivered",
    mayBreakRules: "It may break the community rules.",
    checkingPhoto: "Checking photo…",
    animalCard: "ANIMAL CARD",
    byOwner: "by {name}",
    grade: "Grade {grade}",
    sent: "Sent",
    delivered: "Delivered",
    seen: "Seen",
    // The conversation (DirectMessageThreadView).
    inbox: "Inbox",
    opensProfile: "Opens their profile",
    conversationOptions: "Conversation options",
    moreOptions: "More options",
    viewNamesProfile: "View {name}'s profile",
    pinChat: "Pin Chat",
    unpinChat: "Unpin Chat",
    reportConversation: "Report Conversation",
    typing: "typing…",
    startConversation: "Start a conversation",
    sayHi: "Say hi to {name}, or send them one of your animals.",
    sendToSupport: "Send a message to AnimalDex Support.",
    loadingConversation: "Loading conversation",
    conversationUnavailable: "Conversation is unavailable",
    unsendTitle: "Unsend this message?",
    unsend: "Unsend",
    unsendDetail: "It will be removed for you and {name}.",
    copy: "Copy",
    report: "Report",
    openCard: "Open Card",
    unreadOne: "1 unread message",
    unreadMany: "{count} unread messages",
    newMessages: "{count} new messages",
    scrollToLatest: "Scroll to latest",
    placeholder: "Message",
    send: "Send",
    blockedComposer: "You blocked this user. Their content is hidden from your feed.",
    messageReported: "Message reported. AnimalDex will review the report within 24 hours.",
    conversationReported: "Conversation reported. AnimalDex will review the report within 24 hours.",
    // DirectMessageServiceError.
    errorEmpty: "Type a message first.",
    errorSelf: "You cannot message yourself.",
    errorBlocked: "You blocked this user. Unblock them before sending messages.",
    errorSendFailed: "Message could not be sent.",
    errorSupportStays: "AnimalDex Support stays in your inbox.",
    errorPinLimit: "You can pin up to 5 chats. Unpin one first.",
    errorUnsendWindow: "Messages can only be unsent within 48 hours.",
    errorCardNotShareable: "That card can't be shared any more.",
    errorTooLong: "That caption is too long.",
    errorUnavailable: "This isn't available yet. Update AnimalDex and try again.",
    // Sending an animal (the composer's attach, DirectMessageCardPickerView).
    attach: "Attach",
    animalCardAttach: "Animal Card",
    sendAnAnimal: "Send an Animal",
    searchYourAnimals: "Search your animals",
    noAnimalsYet: "No animals yet",
    noAnimalsDetail: "Cards you capture appear here to send.",
    privateCard: "Private card",
    // The New Message picker (DirectMessagePickers).
    searchCollectors: "Search collectors",
    recent: "RECENT",
    following: "FOLLOWING",
    noCollectors: "No collectors found for “{query}”.",
    searchHint: "Search for a collector by name or @username.",
    close: "Close"
};

export type DirectMessageWords = typeof DIRECT_MESSAGE_WORDS_EN;

/** "{name}" slots filled; an unknown slot stays as written. */
export function fillWords(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export function directMessageWords(raw: unknown): DirectMessageWords {
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(DIRECT_MESSAGE_WORDS_EN).map(([key, value]) => {
        const candidate = given[key];
        return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
    })) as DirectMessageWords;
}

/**
 * The codes the message routes answer with, in the reader's words
 * (`userFacingError`'s `known`). The SQL refusals are iOS's
 * `DirectMessageServiceError` cases.
 */
export function directMessageKnownErrors(words: DirectMessageWords): Record<string, string> {
    return {
        empty_message: words.errorEmpty,
        self_message: words.errorSelf,
        blocked_user: words.errorBlocked,
        send_failed: words.errorSendFailed,
        cannot_hide_system_conversation: words.errorSupportStays,
        pin_limit_reached: words.errorPinLimit,
        unsend_window_passed: words.errorUnsendWindow,
        capture_not_shareable: words.errorCardNotShareable,
        capture_not_found: words.errorCardNotShareable,
        caption_too_long: words.errorTooLong,
        settings_unavailable: words.errorUnavailable
    };
}
