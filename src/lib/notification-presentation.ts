/**
 * The notifications list as iOS draws it (`NotificationsView`,
 * `UserNotification`): which rows are listed, their words, where a row
 * leads, the Today / This week / Earlier sections, and the person-actions
 * (Follow back, Say thanks).
 */

import type {AppNotification} from "@/data/authenticated-app";
import type {NotificationWords} from "@/lib/notification-words";

export type NotificationFilter = "all" | "important" | "following";

/** `list_user_notifications`'s `p_filter` values, in iOS's order. */
export const NOTIFICATION_FILTERS: NotificationFilter[] = ["all", "important", "following"];

export const NOTIFICATION_PAGE_SIZE = 20;

export function notificationFilterTitle(filter: NotificationFilter, words: Pick<NotificationWords, "filterAll" | "filterImportant" | "filterFollowing">): string {
    return filter === "important" ? words.filterImportant : filter === "following" ? words.filterFollowing : words.filterAll;
}

export function parseNotificationFilter(value: unknown): NotificationFilter {
    return value === "important" || value === "following" ? value : "all";
}

/** The event types iOS reads; anything else (old battle rows among them) is left out, as there. */
const KNOWN_EVENTS = new Set([
    "first_like_on_capture", "like_milestone_5", "like_milestone_10", "like_milestone_25",
    "capture_endorsed",
    "trade_offer_received", "trade_offer_accepted", "trade_offer_rejected", "trade_offer_expired", "trade_offer_cancelled",
    "credit_offer_received", "credit_offer_accepted", "credit_offer_rejected", "credit_offer_expired", "credit_offer_cancelled",
    "user_followed", "friend_connected", "following_new_capture", "following_new_comparison",
    "system_message", "credit_bonus", "capture_gift_received", "story_video_ready", "capture_community_rating",
    "campaign_started", "campaign_progress", "campaign_completed", "campaign_ending_soon"
]);

export function isListedNotification(item: Pick<AppNotification, "eventType">): boolean {
    return KNOWN_EVENTS.has(item.eventType);
}

function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

type Row = Pick<AppNotification,
    "eventType" | "actorDisplayName" | "actorUsername" | "actorUserId" | "likeCount" | "endorsedStat" | "giftSlug"
    | "subjectAnimalName" | "subjectAnimalDexNumber" | "serverTitle" | "serverBody" | "sourceKey" | "captureId"
    | "tradeOfferId" | "creditOfferId" | "campaignId" | "challengeId" | "comparisonSlug">;

/** Operator messages and events: labelled SYSTEM and drawn in violet. */
export function isSystemCategory(item: Pick<AppNotification, "eventType">): boolean {
    return item.eventType === "system_message" || item.eventType.startsWith("campaign_");
}

function statTitle(stat: string | null | undefined, words: NotificationWords): string | null {
    switch (stat?.trim().toLowerCase()) {
        case "dominance": return words.statDominance;
        case "speed": return words.statSpeed;
        case "size": return words.statSize;
        case "intelligence": return words.statIntelligence;
        case "rarity": return words.statRarity;
        default: return null;
    }
}

/** `GiftPresentation.displayName(forSlug:)`. */
export function giftDisplayName(slug: string | null | undefined, words: NotificationWords): string {
    const value = slug?.trim() ?? "";
    switch (value) {
        case "big_brain": return words.giftBigBrain;
        case "great_capture": return words.giftAbsoluteUnit;
        case "electric_find": return words.giftLightningBolt;
        case "wild": return words.giftPowerhouse;
        case "legendary_capture": return words.giftLegendary;
        case "": return words.gift;
        default: return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
}

/** `GiftPresentation.endorsedStat(forSlug:)`. */
function giftStat(slug: string | null | undefined): string | null {
    switch (slug?.trim()) {
        case "big_brain": return "intelligence";
        case "electric_find": return "speed";
        case "great_capture": return "size";
        case "wild": return "dominance";
        case "legendary_capture": return "rarity";
        default: return null;
    }
}

/** The animal a row is about: its name as written, lowercased; "public" when unknown. */
function animalSubject(animalName: string | null | undefined, words: NotificationWords): string {
    const trimmed = animalName?.trim() ?? "";
    return trimmed ? trimmed.toLowerCase() : words.subjectPublic;
}

/** The person a row is about, or our own noun when we do not know them. */
function actorName(item: Row, words: NotificationWords): string {
    const display = item.actorDisplayName?.trim() ?? "";
    if (display) return display;
    const username = item.actorUsername?.trim() ?? "";
    return username ? `@${username.replace(/^@/, "")}` : words.aCollector;
}

/**
 * The row's headline and supporting line (`titleDescriptor` /
 * `detailDescriptor`). `animalName` is the reader's own capture's animal,
 * for the like and endorsement rows.
 */
export function notificationText(item: Row, words: NotificationWords, animalName: string | null = null): {title: string; detail: string} {
    const subject = animalSubject(animalName, words);
    const actor = actorName(item, words);
    const stat = statTitle(item.endorsedStat, words);
    switch (item.eventType) {
        case "system_message":
            return {title: item.serverTitle?.trim() || words.systemFallback, detail: item.serverBody?.trim() || words.systemDetailFallback};
        case "credit_bonus":
            return {title: item.serverTitle?.trim() || words.creditFallback, detail: item.serverBody?.trim() || words.creditDetailFallback};
        case "first_like_on_capture":
            return {title: fill(words.firstLike, {subject}), detail: words.firstLikeDetail};
        case "like_milestone_5":
            return {title: fill(words.likes5, {subject}), detail: words.likes5Detail};
        case "like_milestone_10":
            return {title: fill(words.likes10, {subject}), detail: words.likes10Detail};
        case "like_milestone_25":
            return {title: fill(words.likes25, {subject}), detail: words.likes25Detail};
        case "capture_endorsed":
            return stat
                ? {title: fill(words.endorsedStat, {subject, stat}), detail: fill(words.endorsedStatDetail, {stat})}
                : {title: fill(words.endorsed, {subject}), detail: words.endorsedDetail};
        case "capture_gift_received": {
            const recognised = statTitle(giftStat(item.giftSlug), words);
            return {
                title: fill(words.giftSent, {actor, gift: giftDisplayName(item.giftSlug, words), subject}),
                detail: recognised ? fill(words.giftStatDetail, {stat: recognised}) : words.giftDetail
            };
        }
        case "trade_offer_received": return {title: words.tradeReceived, detail: words.tradeReceivedDetail};
        case "trade_offer_accepted": return {title: words.tradeAccepted, detail: words.tradeAcceptedDetail};
        case "trade_offer_rejected": return {title: words.tradeRejected, detail: words.tradeRejectedDetail};
        case "trade_offer_expired": return {title: words.tradeExpired, detail: words.tradeExpiredDetail};
        case "trade_offer_cancelled": return {title: words.tradeCancelled, detail: words.tradeCancelledDetail};
        case "credit_offer_received": return {title: words.creditOfferReceived, detail: words.creditOfferReceivedDetail};
        case "credit_offer_accepted": return {title: words.creditOfferAccepted, detail: words.creditOfferAcceptedDetail};
        case "credit_offer_rejected": return {title: words.creditOfferRejected, detail: words.creditOfferRejectedDetail};
        case "credit_offer_expired": return {title: words.creditOfferExpired, detail: words.creditOfferExpiredDetail};
        case "credit_offer_cancelled": return {title: words.creditOfferCancelled, detail: words.creditOfferCancelledDetail};
        case "user_followed": return {title: fill(words.followed, {actor}), detail: words.followedDetail};
        case "friend_connected": return {title: fill(words.friends, {actor}), detail: words.friendsDetail};
        case "following_new_capture": {
            // The headline says who captured what; the row shows no detail (iOS audit IOS-13).
            const name = item.subjectAnimalName?.trim() || animalName?.trim() || "";
            const number = item.subjectAnimalDexNumber && item.subjectAnimalDexNumber >= 1 ? String(item.subjectAnimalDexNumber).padStart(3, "0") : null;
            const title = name && number
                ? fill(words.capturedNumbered, {actor, number, name})
                : name ? fill(words.captured, {actor, name}) : fill(words.capturedNew, {actor});
            return {title, detail: ""};
        }
        case "following_new_comparison": return {title: fill(words.sideBySide, {actor}), detail: words.sideBySideDetail};
        case "story_video_ready": {
            const name = item.subjectAnimalName?.trim() ?? "";
            return {title: words.videoReady, detail: name ? fill(words.videoReadyNamed, {name}) : words.videoReadyDetail};
        }
        case "capture_community_rating": {
            const stars = item.likeCount;
            return {
                title: fill(words.rated, {actor, subject: animalSubject(animalName ?? item.subjectAnimalName, words)}),
                detail: stars === 1 ? words.ratedOneStar : stars && stars > 1 ? fill(words.ratedStars, {stars}) : words.ratedDetail
            };
        }
        default:
            // campaign_* rows: written when they are sent.
            return {title: item.serverTitle?.trim() || words.campaignFallback, detail: item.serverBody?.trim() || words.campaignDetailFallback};
    }
}

/** `debate-joined:<id>` or `debate-result:<id>` (3.2): the debate a row is about. */
export function notificationDebateId(item: Pick<AppNotification, "sourceKey">): string | null {
    const match = /^debate-[a-z]+:\s*([0-9a-f-]{36})\s*$/i.exec(item.sourceKey?.trim() ?? "");
    return match ? match[1].toLowerCase() : null;
}

/**
 * Where tapping a row leads, in iOS's order (`UserNotification.destination`):
 * the offer before the capture it names, the capture before the person who
 * took it; a row about a person opens their profile. Null when it leads
 * nowhere, so the row stops advertising a destination.
 */
export function notificationHref(item: Row): string | null {
    const key = item.sourceKey?.trim() ?? "";
    if (item.eventType === "story_video_ready" && key.startsWith("story-video:")) {
        const capture = key.slice("story-video:".length).split("#")[0] || item.captureId;
        if (capture) return `/app/capture/${encodeURIComponent(capture)}`;
    }
    if (item.tradeOfferId || item.creditOfferId) return "/app/trades";
    const debateId = notificationDebateId(item);
    if (debateId) return `/app/debates/${encodeURIComponent(debateId)}`;
    if (item.captureId) return `/app/capture/${encodeURIComponent(item.captureId)}`;
    if (item.campaignId) return "/app/missions";
    const slug = item.comparisonSlug?.trim();
    if (slug) return `/challenges/${encodeURIComponent(slug)}`;
    if (key.startsWith("guide-seller-approved:")) return "/app/guides";
    if (item.actorUserId) {
        const username = item.actorUsername?.trim().replace(/^@/, "");
        return username ? `/u/${encodeURIComponent(username)}` : null;
    }
    if (item.eventType === "credit_bonus") return "/app/credits";
    return null;
}

/** Follow back: someone followed you whom you do not follow yet. */
export function showsFollowBack(item: Pick<AppNotification, "eventType" | "actorUserId">, currentUserId: string | null, following: ReadonlySet<string>): boolean {
    return item.eventType === "user_followed"
        && Boolean(item.actorUserId)
        && item.actorUserId !== currentUserId
        && !following.has(item.actorUserId!);
}

/** Say thanks: a Gift from someone else opens a message to them. */
export function showsSayThanks(item: Pick<AppNotification, "eventType" | "actorUserId">, currentUserId: string | null): boolean {
    return item.eventType === "capture_gift_received" && Boolean(item.actorUserId) && item.actorUserId !== currentUserId;
}

export type NotificationSectionKind = "today" | "thisWeek" | "earlier";

/** Today, the last seven days, then everything older; empty sections are left out. */
export function notificationSections<T extends Pick<AppNotification, "createdAt">>(items: T[], now: Date): Array<{kind: NotificationSectionKind; items: T[]}> {
    const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const buckets: Record<NotificationSectionKind, T[]> = {today: [], thisWeek: [], earlier: []};
    for (const item of items) {
        const date = new Date(item.createdAt);
        const today = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
        buckets[today ? "today" : date.getTime() >= weekAgo ? "thisWeek" : "earlier"].push(item);
    }
    return (["today", "thisWeek", "earlier"] as NotificationSectionKind[])
        .filter((kind) => buckets[kind].length)
        .map((kind) => ({kind, items: buckets[kind]}));
}

export function notificationSectionTitle(kind: NotificationSectionKind, words: Pick<NotificationWords, "today" | "thisWeek" | "earlier">): string {
    return kind === "today" ? words.today : kind === "thisWeek" ? words.thisWeek : words.earlier;
}

/** iOS `relativeTimestamp`: "a moment ago" inside 45 seconds, then the locale's own "3 hours ago". */
export function notificationRelativeTime(value: string, now: Date, locale: string | null | undefined, words: Pick<NotificationWords, "momentAgo">): string {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return "";
    const seconds = (time - now.getTime()) / 1000;
    if (Math.abs(seconds) < 45) return words.momentAgo;
    const format = new Intl.RelativeTimeFormat(locale === "id" ? "id-ID" : "en-US", {numeric: "auto", style: "long"});
    const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(Math.round(seconds), "second");
}

/** Pages are offset-paged; a row that arrived while scrolling is not shown twice. */
export function appendNotificationPage<T extends Pick<AppNotification, "id">>(current: T[], page: T[]): T[] {
    const known = new Set(current.map((item) => item.id));
    return [...current, ...page.filter((item) => !known.has(item.id))];
}
