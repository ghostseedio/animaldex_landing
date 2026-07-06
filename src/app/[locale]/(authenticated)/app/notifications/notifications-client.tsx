"use client";

import {useEffect, useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {AppBadge, AppListRow} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {AppNotification} from "@/data/authenticated-app";
import {formatAppShortDate} from "@/lib/app-dates";

function copy(item: AppNotification) {
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
                const href = item.tradeOfferId || item.creditOfferId ? "/app/trades" : "/app/collection";
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
