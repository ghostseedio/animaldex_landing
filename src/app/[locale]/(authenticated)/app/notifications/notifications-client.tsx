"use client";

import {useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
import {useAppShellChrome} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {DmMenu, DmSymbol, useMounted, type DmMenuItem} from "@/app/[locale]/(authenticated)/app/messages/_components/dm-ui";
import type {AppNotification} from "@/data/authenticated-app";
import type {NotificationActor, NotificationPage} from "@/data/notifications";
import {
    appendNotificationPage,
    isSystemCategory,
    NOTIFICATION_FILTERS,
    notificationDebateId,
    notificationFilterTitle,
    notificationHref,
    notificationRelativeTime,
    notificationSections,
    notificationSectionTitle,
    notificationText,
    showsFollowBack,
    showsSayThanks,
    type NotificationFilter
} from "@/lib/notification-presentation";
import type {NotificationWords} from "@/lib/notification-words";

const NEON = "#A7F432";
/** iOS `AnimalDexTheme.violet`: messages from AnimalDex stand apart from the social rows. */
const VIOLET = "#9454FA";

type Glyph = "heart" | "thumbsUp" | "gift" | "swap" | "bolt" | "personPlus" | "people" | "camera" | "sparkles" | "debate" | "flag" | "play" | "star" | "binoculars";

const GLYPHS: Record<Glyph, ReactNode> = {
    heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" fill="currentColor" />,
    thumbsUp: <><path d="M7 11v9H4v-9Z" fill="currentColor" /><path d="M7 11l4-7a2 2 0 0 1 2.7 2.4L13 10h5.5a2 2 0 0 1 2 2.3l-1.1 6A2 2 0 0 1 17.4 20H7" /></>,
    gift: <><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M3 9h18M12 9v11M12 9S10.5 4 8 4.5 7 9 12 9Zm0 0s1.5-5 4-4.5S17 9 12 9Z" /></>,
    swap: <path d="M4 8h14l-3-3m3 3-3 3M20 16H6l3 3m-3-3 3-3" />,
    bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6Z" fill="currentColor" />,
    personPlus: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6" /></>,
    people: <><circle cx="8" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.5" /><path d="M2.5 19a5.5 5.5 0 0 1 11 0M13.5 19a4.5 4.5 0 0 1 8 0" /></>,
    camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4Z" fill="currentColor" /><circle cx="12" cy="13" r="3.5" stroke="#0b0b0b" /></>,
    sparkles: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" fill="currentColor" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z" fill="currentColor" /></>,
    debate: <><circle cx="7" cy="9" r="2.5" /><circle cx="17" cy="9" r="2.5" /><circle cx="12" cy="6" r="2.5" /><path d="M2.5 19a4.5 4.5 0 0 1 9 0M12.5 19a4.5 4.5 0 0 1 9 0" /></>,
    flag: <path d="M5 21V4m0 0h11l-2 4 2 4H5" fill="currentColor" />,
    play: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3Z" fill="currentColor" /></>,
    star: <path d="m12 3 2.7 5.6 6.1.8-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.8Z" fill="currentColor" />,
    binoculars: <><circle cx="7" cy="15" r="3.5" /><circle cx="17" cy="15" r="3.5" /><path d="M10.5 15h3M5 12l2-7h3l1 6M19 12l-2-7h-3l-1 6" /></>
};

/** iOS `UserNotification.iconSystemName`, as SVG. */
function glyphFor(item: AppNotification): Glyph {
    if (item.sourceKey?.startsWith("guide-seller-approved:")) return "binoculars";
    switch (item.eventType) {
        case "first_like_on_capture": case "like_milestone_5": case "like_milestone_10": case "like_milestone_25": return "heart";
        case "capture_endorsed": return "thumbsUp";
        case "capture_gift_received": return "gift";
        case "user_followed": return "personPlus";
        case "friend_connected": return "people";
        case "following_new_capture": return "camera";
        case "following_new_comparison": return "swap";
        case "system_message": return notificationDebateId(item) ? "debate" : "sparkles";
        case "credit_bonus": return "bolt";
        case "story_video_ready": return "play";
        case "capture_community_rating": return "star";
        default:
            if (item.eventType.startsWith("trade_offer")) return "swap";
            if (item.eventType.startsWith("credit_offer")) return "bolt";
            return "flag";
    }
}

function GlyphIcon({name, className}: {name: Glyph; className: string}) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            {GLYPHS[name]}
        </svg>
    );
}

/**
 * Notifications (iOS `NotificationsView`): All / Important / Following,
 * filtered on the server; Today / This week / Earlier; paging as you reach
 * the end; the face opens the person; Follow back and Say thanks; a row can be
 * marked read or unread.
 */
export default function NotificationsClient({initialPage, currentUserId, locale, words}: {
    initialPage: NotificationPage | null;
    currentUserId: string;
    locale: string;
    words: NotificationWords;
}) {
    const {words: shellWords} = useAppShellChrome();
    const mounted = useMounted();
    const [filter, setFilter] = useState<NotificationFilter>("all");
    const [items, setItems] = useState<AppNotification[]>(initialPage?.items ?? []);
    const [hasMore, setHasMore] = useState(initialPage?.hasMore ?? false);
    const [actors, setActors] = useState<Record<string, NotificationActor>>(initialPage?.actors ?? {});
    const [following, setFollowing] = useState<Set<string>>(() => new Set(initialPage?.followingIds ?? []));
    const [animalNames, setAnimalNames] = useState<Record<string, string>>(initialPage?.animalNames ?? {});
    const [syncState, setSyncState] = useState<"loaded" | "loading" | "failed">(initialPage ? "loaded" : "failed");
    const [followingBack, setFollowingBack] = useState<Set<string>>(() => new Set());
    const [menu, setMenu] = useState<{items: DmMenuItem[]; x: number; y: number} | null>(null);
    const [now, setNow] = useState(() => new Date());
    const loadingMoreRef = useRef(false);
    const requestRef = useRef(0);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const merge = useCallback((page: NotificationPage, replace: boolean) => {
        setItems((current) => replace ? page.items : appendNotificationPage(current, page.items));
        setHasMore(page.hasMore);
        setActors((current) => ({...current, ...page.actors}));
        setFollowing((current) => {
            const next = new Set(current);
            page.followingIds.forEach((id) => next.add(id));
            return next;
        });
        setAnimalNames((current) => ({...current, ...page.animalNames}));
    }, []);

    // Opening the list reads it, as iOS's drawer does once it has loaded.
    useEffect(() => {
        if (!initialPage?.items.some((item) => !item.readAt)) return;
        fetch("/api/app/notifications/read", {method: "POST"})
            .then((response) => {
                if (!response.ok) return;
                const readAt = new Date().toISOString();
                setItems((current) => current.map((item) => item.readAt ? item : {...item, readAt}));
            })
            .catch(() => undefined);
    }, [initialPage]);

    async function selectFilter(next: NotificationFilter) {
        if (next === filter) return;
        const request = ++requestRef.current;
        setFilter(next);
        setItems([]);
        setHasMore(false);
        setSyncState("loading");
        try {
            const response = await fetch(`/api/app/notifications?filter=${next}&offset=0`, {cache: "no-store"});
            if (!response.ok) throw new Error(String(response.status));
            const page = await response.json() as NotificationPage;
            if (request !== requestRef.current) return;
            merge(page, true);
            setNow(new Date());
            setSyncState("loaded");
        } catch {
            if (request === requestRef.current) setSyncState("failed");
        }
    }

    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMoreRef.current || syncState !== "loaded") return;
        loadingMoreRef.current = true;
        const request = requestRef.current;
        try {
            const response = await fetch(`/api/app/notifications?filter=${filter}&offset=${items.length}`, {cache: "no-store"});
            if (!response.ok) throw new Error(String(response.status));
            const page = await response.json() as NotificationPage;
            if (request === requestRef.current) merge(page, false);
        } catch {
            // Left quiet, as on iOS: the page on screen is still right.
        } finally {
            loadingMoreRef.current = false;
        }
    }, [hasMore, syncState, filter, items.length, merge]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasMore || !mounted) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) void loadMore();
        }, {rootMargin: "400px 0px"});
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loadMore, mounted]);

    /** Optimistic, as iOS's: the row changes now and goes back if the write fails. */
    function setReadState(item: AppNotification, isRead: boolean) {
        if (Boolean(item.readAt) === isRead) return;
        const previous = item.readAt;
        setItems((current) => current.map((row) => row.id === item.id ? {...row, readAt: isRead ? new Date().toISOString() : null} : row));
        fetch("/api/app/notifications/read-state", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id: item.id, read: isRead})
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
            })
            .catch(() => setItems((current) => current.map((row) => row.id === item.id ? {...row, readAt: previous} : row)));
    }

    async function followBack(item: AppNotification) {
        const actorId = item.actorUserId;
        if (!actorId || followingBack.has(actorId)) return;
        setFollowingBack((current) => new Set(current).add(actorId));
        setReadState(item, true);
        try {
            const response = await fetch("/api/app/profile/social", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "follow", profileUserId: actorId})
            });
            if (response.ok) setFollowing((current) => new Set(current).add(actorId));
        } catch {
            // As iOS: the button stays for another try.
        } finally {
            setFollowingBack((current) => {
                const next = new Set(current);
                next.delete(actorId);
                return next;
            });
        }
    }

    function openMenu(event: MouseEvent, item: AppNotification) {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const fromButton = event.type === "click";
        setMenu({
            x: fromButton ? rect.right - 220 : event.clientX,
            y: fromButton ? rect.bottom + 4 : event.clientY,
            items: [{
                kind: "action",
                label: item.readAt ? words.markUnread : words.markRead,
                icon: item.readAt ? "envelopeBadge" : "envelopeOpen",
                onSelect: () => setReadState(item, !item.readAt)
            }]
        });
    }

    const sections = useMemo(() => notificationSections(items, now), [items, now]);

    function actorFor(item: AppNotification): NotificationActor | null {
        if (!item.actorUserId) return null;
        return actors[item.actorUserId] ?? {userId: item.actorUserId, displayName: item.actorDisplayName, username: item.actorUsername?.replace(/^@/, "") ?? null, avatarUrl: null};
    }

    function capsule(label: string, icon: Glyph, working: boolean, props: {href?: string; onClick?: () => void}) {
        const content = (
            <>
                {working
                    ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/20 border-t-black/90" />
                    : <GlyphIcon name={icon} className="h-[11px] w-[11px]" />}
                <span className="text-xs font-black">{label}</span>
            </>
        );
        const className = "inline-flex items-center gap-1.5 rounded-full bg-[#A7F432] px-2.5 py-1.5 text-black/90 transition hover:bg-[#b8f65a] disabled:opacity-70";
        return props.href
            ? <Link href={props.href} onClick={props.onClick} className={className} aria-label={label}>{content}</Link>
            : <button type="button" onClick={props.onClick} disabled={working} className={className} aria-label={label}>{content}</button>;
    }

    function row(item: AppNotification) {
        const unread = !item.readAt;
        const system = isSystemCategory(item);
        const accent = system ? VIOLET : NEON;
        const actor = actorFor(item);
        const href = notificationHref(item);
        const animalName = item.captureId ? animalNames[item.captureId] ?? null : null;
        const text = notificationText(item, words, animalName);
        const glyph = glyphFor(item);
        const profileHref = actor?.username ? `/u/${encodeURIComponent(actor.username)}` : null;
        const actorName = actor?.displayName || (actor?.username ? `@${actor.username}` : words.openProfile);

        const avatar = actor ? (
            <span className="relative block h-[42px] w-[42px] shrink-0">
                {actor.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={actor.avatarUrl} alt="" className="h-[42px] w-[42px] rounded-full object-cover" style={{boxShadow: `0 0 0 1.5px ${accent}59`}} />
                ) : (
                    <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white/[0.06] text-base font-bold text-white/45" style={{boxShadow: `0 0 0 1.5px ${accent}59`}}>
                        {(actorName.replace(/^@/, "")[0] ?? "?").toUpperCase()}
                    </span>
                )}
                <span className="absolute -bottom-[3px] -right-[3px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#0b0b0b]" style={{color: accent}}>
                    <GlyphIcon name={glyph} className="h-[10px] w-[10px]" />
                </span>
            </span>
        ) : (
            <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full" style={{background: `${accent}29`, color: accent}}>
                <GlyphIcon name={glyph} className="h-[15px] w-[15px]" />
            </span>
        );

        const body = (
            <span className="flex min-w-0 flex-1 items-start gap-3.5">
                <span className="min-w-0 flex-1 space-y-[5px]">
                    {system ? <span className="block text-[11px] font-bold tracking-[0.08em]" style={{color: accent}}>{words.system}</span> : null}
                    <span className="block text-[17px] font-semibold leading-snug text-white">{text.title}</span>
                    {text.detail ? <span className="block text-[13px] leading-5 text-white/60">{text.detail}</span> : null}
                    <span suppressHydrationWarning className="block text-[11px] font-medium text-white/35">
                        {mounted ? notificationRelativeTime(item.createdAt, now, locale, words) : ""}
                    </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2.5 pt-1">
                    {unread ? <span className="h-2 w-2 rounded-full bg-[#A7F432]" /> : null}
                    {href ? <DmSymbol name="back" className="h-3 w-3 rotate-180 text-white/35" strokeWidth={2.6} /> : null}
                </span>
            </span>
        );

        return (
            <li
                key={item.id}
                onContextMenu={(event) => openMenu(event, item)}
                className={`group relative flex items-start gap-3.5 px-4 py-3.5 ${unread ? "bg-[#161616]" : "bg-[#111] opacity-[0.72]"}`}
                style={{boxShadow: `inset 0 -1px 0 ${unread ? `${accent}38` : "rgba(255,255,255,0.10)"}`}}
            >
                {actor && profileHref ? (
                    <Link href={profileHref} onClick={() => setReadState(item, true)} aria-label={`${actorName}, ${words.openProfile}`} className="shrink-0 rounded-full">
                        {avatar}
                    </Link>
                ) : avatar}
                <div className="min-w-0 flex-1 space-y-2">
                    {href ? (
                        <Link href={href} onClick={() => setReadState(item, true)} className="flex text-left">
                            {body}
                        </Link>
                    ) : (
                        <button type="button" onClick={() => setReadState(item, true)} className="flex w-full cursor-default text-left">
                            {body}
                        </button>
                    )}
                    {actor && showsFollowBack(item, currentUserId, following)
                        ? capsule(words.followBack, "personPlus", followingBack.has(actor.userId), {onClick: () => void followBack(item)})
                        : actor && showsSayThanks(item, currentUserId)
                            ? capsule(words.sayThanks, "heart", false, {
                                href: `/app/messages/${encodeURIComponent(actor.userId)}?draft=${encodeURIComponent(words.thanksDraft)}`,
                                onClick: () => setReadState(item, true)
                            })
                            : null}
                </div>
                <button
                    type="button"
                    onClick={(event) => openMenu(event, item)}
                    aria-label={words.moreOptions}
                    aria-haspopup="menu"
                    className="absolute bottom-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full text-white/35 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A7F432]/50 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                    <DmSymbol name="ellipsis" className="h-4 w-4" />
                </button>
            </li>
        );
    }

    const loading = !mounted || (syncState === "loading" && !items.length);
    const failed = syncState === "failed" && !items.length;
    const empty = syncState === "loaded" && !items.length;

    return (
        <div className="mx-auto w-full max-w-2xl pb-10">
            <header className="mb-1 flex h-11 items-center justify-center">
                <h1 className="truncate text-center text-[17px] font-bold text-white">{words.title}</h1>
            </header>

            {empty && filter === "all" ? null : (
                <div className="-mx-4 flex border-b border-white/10 sm:-mx-7 md:mx-0" role="tablist" aria-label={words.title}>
                    {NOTIFICATION_FILTERS.map((option) => {
                        const selected = option === filter;
                        return (
                            <button
                                key={option}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                onClick={() => void selectFilter(option)}
                                className="flex flex-1 flex-col items-center gap-2 pt-3 focus-visible:outline-none"
                            >
                                <span className={`truncate text-[13px] font-bold ${selected ? "text-white" : "text-white/55"}`}>{notificationFilterTitle(option, words)}</span>
                                <span className={`h-0.5 w-full ${selected ? "bg-[#A7F432]" : "bg-transparent"}`} />
                            </button>
                        );
                    })}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center gap-4 py-24" role="status">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#A7F432]/25 border-t-[#A7F432]" />
                    <p className="text-[15px] text-white/55">{words.loading}</p>
                </div>
            ) : failed ? (
                <div className="flex flex-col items-center px-7 py-24 text-center">
                    <DmSymbol name="bellSlash" className="h-7 w-7 text-white/35" />
                    <p className="mt-3.5 text-[17px] font-semibold text-white">{words.unavailableTitle}</p>
                    <p className="mt-2 max-w-sm text-[13px] text-white/55">{shellWords.errorServer}</p>
                </div>
            ) : empty ? (
                <div className="flex flex-col items-center px-7 py-24 text-center">
                    <DmSymbol name="bell" className="h-7 w-7 text-white/35" />
                    <p className="mt-3.5 text-[17px] font-semibold text-white">{words.emptyTitle}</p>
                    <p className="mt-2 max-w-sm text-[13px] text-white/55">{words.emptyDetail}</p>
                </div>
            ) : (
                <div className="-mx-4 sm:-mx-7 md:mx-0">
                    {sections.map((section, index) => (
                        <section key={section.kind}>
                            <h2 className={`px-4 pb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white/35 ${index === 0 ? "pt-4" : "pt-[22px]"}`}>
                                {notificationSectionTitle(section.kind, words)}
                            </h2>
                            <ul>{section.items.map(row)}</ul>
                        </section>
                    ))}
                    {hasMore ? (
                        <div ref={sentinelRef} className="flex justify-center py-3" aria-hidden="true">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#A7F432]/25 border-t-[#A7F432]" />
                        </div>
                    ) : null}
                </div>
            )}

            {menu ? <DmMenu items={menu.items} anchor={{x: menu.x, y: menu.y}} label={words.moreOptions} onClose={() => setMenu(null)} /> : null}
        </div>
    );
}
