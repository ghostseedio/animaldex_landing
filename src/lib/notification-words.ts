/**
 * Notifications in the reader's language. English is iOS's own copy
 * (NotificationsView, UserNotification's title and detail descriptors,
 * GiftPresentation and CaptureEndorsementStat), the locale's
 * `appNotifications` over it.
 */

export const NOTIFICATION_WORDS_EN = {
    title: "Notifications",
    filterAll: "All",
    filterImportant: "Important",
    filterFollowing: "Following",
    today: "Today",
    thisWeek: "This week",
    earlier: "Earlier",
    loading: "Loading notifications…",
    unavailableTitle: "Notifications are unavailable",
    emptyTitle: "No notifications yet",
    emptyDetail: "Updates to your captures, follows, new friends, activity on your public captures, and Credit bonuses will appear here.",
    system: "SYSTEM",
    followBack: "Follow back",
    sayThanks: "Say thanks",
    thanksDraft: "Thanks for the gift!",
    markRead: "Mark as read",
    markUnread: "Mark as unread",
    openProfile: "Open profile",
    moreOptions: "More options",
    momentAgo: "a moment ago",
    // Arguments iOS translates (NotificationTextArgument.localized).
    subjectPublic: "public",
    aCollector: "A collector",
    statDominance: "Dominance",
    statSpeed: "Speed",
    statSize: "Size",
    statIntelligence: "Intelligence",
    statRarity: "Rarity",
    giftBigBrain: "Big Brain",
    giftAbsoluteUnit: "Absolute Unit",
    giftLightningBolt: "Lightning Bolt",
    giftPowerhouse: "Powerhouse",
    giftLegendary: "Legendary",
    gift: "Gift",
    // Headlines (UserNotification.titleDescriptor).
    systemFallback: "A note from AnimalDex",
    creditFallback: "You earned Credits",
    firstLike: "Your {subject} capture got its first like",
    likes5: "Your {subject} capture reached 5 likes",
    likes10: "Your {subject} capture reached 10 likes",
    likes25: "Your {subject} capture reached 25 likes",
    endorsedStat: "Your {subject} got a {stat} endorsement",
    endorsed: "Your {subject} got a new endorsement",
    giftSent: "{actor} sent {gift} to your {subject} capture",
    tradeReceived: "You received a trade offer",
    tradeAccepted: "Your trade offer was accepted",
    tradeRejected: "Your trade offer was rejected",
    tradeExpired: "A trade offer expired",
    tradeCancelled: "A trade offer was cancelled",
    creditOfferReceived: "You received a Credit offer",
    creditOfferAccepted: "Your Credit offer was accepted",
    creditOfferRejected: "Your Credit offer was declined",
    creditOfferExpired: "A Credit offer expired",
    creditOfferCancelled: "A Credit offer was canceled",
    followed: "{actor} followed you",
    friends: "You and {actor} are now friends",
    capturedNumbered: "{actor} captured #{number} {name}",
    captured: "{actor} captured {name}",
    capturedNew: "{actor} captured a new animal",
    sideBySide: "{actor} put two animals side by side",
    campaignFallback: "Open this event in AnimalDex",
    videoReady: "Your video is ready",
    rated: "{actor} rated your {subject} capture",
    // Supporting lines (UserNotification.detailDescriptor).
    systemDetailFallback: "Open AnimalDex to see what changed.",
    creditDetailFallback: "Open AnimalDex to see your balance.",
    firstLikeDetail: "It is starting to get noticed in Discover.",
    likes5Detail: "Your public capture is getting noticed.",
    likes10Detail: "Your capture is building momentum in Discover.",
    likes25Detail: "Your capture is resonating with the community.",
    endorsedStatDetail: "A collector added +1 to {stat} on this animal.",
    endorsedDetail: "A collector endorsed one of this animal's traits.",
    giftStatDetail: "A collector recognised {stat} on this animal.",
    giftDetail: "Open this capture to see the Gift.",
    tradeReceivedDetail: "Review the two animals and choose whether to accept the exchange.",
    tradeAcceptedDetail: "Your pending trade was accepted and the two captures have been exchanged.",
    tradeRejectedDetail: "The other collector declined your trade offer.",
    tradeExpiredDetail: "The pending offer timed out and the two captures are available again.",
    tradeCancelledDetail: "The sender cancelled the pending trade offer.",
    creditOfferReceivedDetail: "Review the Credit offer and choose whether to sell this animal.",
    creditOfferAcceptedDetail: "Your Credits were transferred and the animal is now in your collection.",
    creditOfferRejectedDetail: "The owner declined your Credit offer, and your Credits were returned.",
    creditOfferExpiredDetail: "Your Credit offer timed out, and the Credits it held were returned.",
    creditOfferCancelledDetail: "The Credit offer was canceled, and the Credits it held were returned.",
    followedDetail: "Open their profile or follow back to become friends.",
    friendsDetail: "You now follow each other.",
    sideBySideDetail: "See their side by side in AnimalDex.",
    campaignDetailFallback: "Open AnimalDex to see this event.",
    ratedOneStar: "They gave it 1 star.",
    ratedStars: "They gave it {stars} stars.",
    ratedDetail: "Open the capture to see the rating.",
    videoReadyDetail: "Your story video is ready to watch.",
    videoReadyNamed: "The {name} story video is ready to watch."
};

export type NotificationWords = typeof NOTIFICATION_WORDS_EN;

export function notificationWords(raw: unknown): NotificationWords {
    const given = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(NOTIFICATION_WORDS_EN).map(([key, value]) => {
        const candidate = given[key];
        return [key, typeof candidate === "string" && candidate.trim() ? candidate : value];
    })) as NotificationWords;
}
