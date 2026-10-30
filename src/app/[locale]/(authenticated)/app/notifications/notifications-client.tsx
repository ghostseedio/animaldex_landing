"use client";

import {useEffect, useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppBadge, AppListRow} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {AppNotification} from "@/data/authenticated-app";
import {formatAppShortDate} from "@/lib/app-dates";

/** The Debates words a row falls back on when the server sent none. */
export type NotificationDebateWords = {title: string; joined: string; settled: string; draw: string};

/** 3.2 Debates replaced battles: an old battle row is no longer listed (as on iOS). */
export function listedNotification(item: Pick<AppNotification, "eventType">): boolean {
    return !item.eventType.startsWith("battle_");
}

/**
 * A debate notice (AnimalDex 20261031150000: a `system_message` row keyed
 * `debate-joined:<debate>` or `debate-result:<debate>`): its kind and debate.
 */
export function debateNotice(item: Pick<AppNotification, "sourceKey">): {kind: "joined" | "result"; debateId: string | null} | null {
    const match = /^debate-(joined|result):([0-9a-f-]{36})$/i.exec(item.sourceKey?.trim() ?? "");
    return match ? {kind: match[1].toLowerCase() as "joined" | "result", debateId: match[2].toLowerCase()} : null;
}

function copy(item: AppNotification, debate: NotificationDebateWords) {
    const notice = debateNotice(item);
    if (notice) {
        // "Your Gray Wolf joined a debate", or how one went: written when it is sent.
        return {
            title: item.serverTitle || debate.title,
            detail: item.serverBody || (notice.kind === "joined" ? debate.joined : debate.settled),
            icon: "debate" as const
        };
    }
    if (item.serverTitle || item.serverBody) {
        return {
            title: item.serverTitle || "AnimalDex update",
            detail: item.serverBody || "Open the linked AnimalDex screen for details.",
            icon: "bell" as const
        };
    }
    if (item.sourceKey?.startsWith("guide-seller-approved:")) {
        return {title: "Wildlife Guides update", detail: "Open Wildlife Guides to check your guides.", icon: "location" as const};
    }
    if (item.eventType.startsWith("campaign_")) {
        const label = item.eventType.replace("campaign_", "").replaceAll("_", " ");
        return {title: `Sponsored challenge ${label}`, detail: "Open the campaign to review progress and rewards.", icon: "arena" as const};
    }
    if (item.eventType === "capture_gift_received") {
        return {title: "Your capture received a Gift", detail: "Open the capture to see the community support.", icon: "spark" as const};
    }
    if (item.eventType === "following_new_capture") {
        const animal = item.subjectAnimalName ? `: ${item.subjectAnimalName}` : "";
        return {title: `New capture${animal}`, detail: "Someone you follow posted a public capture.", icon: "camera" as const};
    }
    if (item.eventType === "following_new_comparison") {
        return {title: "New comparison from someone you follow", detail: "Open the comparison breakdown.", icon: "matchup" as const};
    }
    if (item.eventType === "user_followed") {
        const name = item.actorDisplayName || (item.actorUsername ? `@${item.actorUsername}` : "A collector");
        return {title: `${name} followed you`, detail: "Open their profile.", icon: "profile" as const};
    }
    if (item.eventType === "friend_connected") {
        const name = item.actorDisplayName || (item.actorUsername ? `@${item.actorUsername}` : "A collector");
        return {title: `${name} connected with you`, detail: "Open their profile.", icon: "profile" as const};
    }
    if (item.eventType === "credit_bonus") {
        return {title: "Credits added", detail: "Open your Credits and rewards area.", icon: "spark" as const};
    }
    if (item.eventType === "capture_endorsed") {
        return {title: `Your capture got a ${item.endorsedStat ?? "new"} endorsement`, detail: "A collector endorsed one of this animal's traits.", icon: "spark" as const};
    }
    if (item.eventType.startsWith("trade_offer")) {
        return {title: item.eventType === "trade_offer_received" ? "You received a trade offer" : `Trade offer ${item.eventType.replace("trade_offer_", "")}`, detail: "Open Trades to review the exchange.", icon: "trade" as const};
    }
    if (item.eventType.startsWith("credit_offer")) {
        return {title: item.eventType === "credit_offer_received" ? "You received a credit offer" : `Credit offer ${item.eventType.replace("credit_offer_", "")}`, detail: "Open Trades to review the credit offer.", icon: "trade" as const};
    }
    return {title: item.likeCount === 1 ? "Your capture got its first like" : `Your capture reached ${item.likeCount ?? "a new milestone"} likes`, detail: "Your public capture is getting noticed in Discover.", icon: "spark" as const};
}

function notificationHref(item: AppNotification) {
    // The debate push and row open the debate (3.2).
    const notice = debateNotice(item);
    if (notice) return notice.debateId ? `/app/debates/${encodeURIComponent(notice.debateId)}` : "/app/debates";
    if (item.tradeOfferId || item.creditOfferId) return "/app/trades";
    if (item.captureId) return `/app/capture/${encodeURIComponent(item.captureId)}`;
    if (item.campaignId) return "/app/missions";
    if (item.comparisonSlug?.trim()) return `/challenges/${encodeURIComponent(item.comparisonSlug.trim())}`;
    if (item.sourceKey?.startsWith("guide-seller-approved:")) return "/app/guides";
    if (item.actorUsername?.trim()) return `/u/${encodeURIComponent(item.actorUsername.trim().replace(/^@/, ""))}`;
    if (item.eventType === "credit_bonus") return "/app/earnings";
    return "/app/notifications";
}

export default function NotificationsClient({items, locale, debateWords}: {items: AppNotification[]; locale: string; debateWords: NotificationDebateWords}) {
    const [notifications, setNotifications] = useState(() => items.filter(listedNotification));

    useEffect(() => {
        if (!items.some((item) => !item.readAt)) return;
        fetch("/api/app/notifications/read", {method: "POST"})
            .then(() => setNotifications((current) => current.map((item) => ({...item, readAt: item.readAt ?? new Date().toISOString()}))))
            .catch(() => undefined);
    }, [items]);

    return (
        <div className="mx-auto max-w-3xl space-y-3">
            {notifications.map((item) => {
                const text = copy(item, debateWords);
                const href = notificationHref(item);
                return (
                    <AppListRow
                        key={item.id}
                        href={href}
                        unread={!item.readAt}
                        avatar={(
                            <span className={`flex h-12 w-12 items-center justify-center ring-1 ring-white/10 ${item.readAt ? "bg-white/5 text-white/35" : "bg-primary-400 text-black"}`}>
                                <AppIcon name={text.icon} />
                            </span>
                        )}
                        title={text.title}
                        preview={text.detail}
                        meta={formatAppShortDate(item.createdAt, locale)}
                        badge={!item.readAt ? <AppBadge tone="primary">New</AppBadge> : undefined}
                    />
                );
            })}
        </div>
    );
}
