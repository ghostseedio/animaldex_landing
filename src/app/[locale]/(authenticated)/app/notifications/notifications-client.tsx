"use client";

import {useEffect, useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppBadge, AppListRow} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {AppNotification} from "@/data/authenticated-app";
import {formatAppShortDate} from "@/lib/app-dates";

function copy(item: AppNotification) {
    if (item.serverTitle || item.serverBody) {
        return {
            title: item.serverTitle || "AnimalDex update",
            detail: item.serverBody || "Open the linked AnimalDex screen for details.",
            icon: "bell" as const
        };
    }
    if (item.sourceKey?.startsWith("guide-seller-approved:")) {
        return {title: "Wildlife Guide approved", detail: "Open Wildlife Guides to publish listings and manage requests.", icon: "location" as const};
    }
    if (item.eventType.startsWith("campaign_")) {
        const label = item.eventType.replace("campaign_", "").replaceAll("_", " ");
        return {title: `Sponsored challenge ${label}`, detail: "Open the campaign to review progress and rewards.", icon: "arena" as const};
    }
    if (item.eventType.startsWith("battle_")) {
        return {title: "Arena battle update", detail: "Open Arena to review the latest round.", icon: "arena" as const};
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
    if (item.tradeOfferId || item.creditOfferId) return "/app/trades";
    if (item.challengeId) return "/app/arena";
    if (item.captureId) return `/app/capture/${encodeURIComponent(item.captureId)}`;
    if (item.campaignId) return "/app/missions";
    if (item.comparisonSlug?.trim()) return `/challenges/${encodeURIComponent(item.comparisonSlug.trim())}`;
    if (item.sourceKey?.startsWith("guide-seller-approved:")) return "/app/guides?tab=listings";
    if (item.actorUsername?.trim()) return `/u/${encodeURIComponent(item.actorUsername.trim().replace(/^@/, ""))}`;
    if (item.eventType === "credit_bonus") return "/app/earnings";
    return "/app/notifications";
}

export default function NotificationsClient({items, locale}: {items: AppNotification[]; locale: string}) {
    const [notifications, setNotifications] = useState(items);

    useEffect(() => {
        if (!items.some((item) => !item.readAt)) return;
        fetch("/api/app/notifications/read", {method: "POST"})
            .then(() => setNotifications((current) => current.map((item) => ({...item, readAt: item.readAt ?? new Date().toISOString()}))))
            .catch(() => undefined);
    }, [items]);

    return (
        <div className="mx-auto max-w-3xl space-y-3">
            {notifications.map((item) => {
                const text = copy(item);
                const href = notificationHref(item);
                return (
                    <AppListRow
                        key={item.id}
                        href={href}
                        unread={!item.readAt}
                        avatar={(
                            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-white/10 ${item.readAt ? "bg-white/5 text-white/35" : "bg-primary-400 text-black"}`}>
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
