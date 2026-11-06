"use client";

/**
 * The app's one menu (the owner, 2026-11-06: "remove header topbar and
 * mobile nav at the bottom now, we are slowly transitioning to an llm
 * interface, everything will be accessed via the hamburger side menu now
 * like claude app"). On a wide screen it is the sidebar; on a phone the
 * slide-over the hamburger opens. It leads with the places, then their
 * animals, and ends with Capture and the account row, as iOS has it.
 */

import {usePathname, useRouter} from "next/navigation";
import {memo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon, {type AppIconName} from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {CompanionRow} from "@/app/[locale]/(authenticated)/app/companions/companion-row";
import {COMPANIONS_SWITCH_EVENT, useCompanionRoster} from "@/components/companions/use-companion-roster";
import type {AppShellWords} from "@/lib/app-shell-words";
import type {CompanionWords} from "@/lib/companion-bond";
import {rememberCompanion} from "@/lib/companions-opening";
import {TRY_TALKING_HREF} from "@/lib/try-talking";

/** How many animals the menu lists before View all, as the Claude app lists its recents. */
const RECENTS_LIMIT = 10;

export type SideMenuProfile = {displayName: string; username: string | null; avatarUrl: string | null} | null;

export default memo(function SideMenu({variant, words, companionWords, profile, isAuthenticated, unreadCount, unreadMessageCount, accountHref, onClose, onSignOut}: {
    variant: "sidebar" | "slideover";
    words: AppShellWords;
    companionWords: CompanionWords;
    profile: SideMenuProfile;
    isAuthenticated: boolean;
    unreadCount: number;
    unreadMessageCount: number;
    accountHref: string;
    onClose?: () => void;
    onSignOut?: () => void;
}) {
    const router = useRouter();
    // The reader's language, from the address (the app's links carry it the same way).
    const pathname = usePathname() ?? "/";
    const localePrefix = pathname.match(/^\/([a-z]{2})(?=\/|$)/)?.[0] ?? "";
    const locale = localePrefix.slice(1) || "en";
    const {entries} = useCompanionRoster(companionWords, isAuthenticated);
    const [query, setQuery] = useState("");
    // The search drawer over the whole menu (the owner, 2026-11-06: as the Claude app's).
    const [searchOpen, setSearchOpen] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const needle = query.trim().toLowerCase();
    const recents = showAll ? entries : entries.slice(0, RECENTS_LIMIT);
    const hasMore = entries.length > recents.length;
    // The drawer's animals: the recents with nothing typed, else every animal whose name, kind or last line matches; and the places that match.
    const found = needle
        ? entries.filter(({row, line}) => row.displayName.toLowerCase().includes(needle) || row.animal.toLowerCase().includes(needle) || (line.text ?? "").toLowerCase().includes(needle))
        : entries.slice(0, RECENTS_LIMIT);
    const closeSearch = () => { setSearchOpen(false); setQuery(""); };
    const places: {href: string; label: string; icon: AppIconName; badge?: number; testId: string}[] = [
        {href: "/app/collection", label: words.collection, icon: "collection", testId: "collection"},
        {href: "/app/explore", label: words.explore, icon: "explore", testId: "explore"},
        {href: "/app/messages", label: words.messages, icon: "message", badge: unreadMessageCount, testId: "messages"},
        {href: "/app/missions", label: words.missions, icon: "mission", testId: "missions"}
    ];
    const band = (text: string) => (
        <p className="bg-[#12351C]/60 px-4 pb-2 pt-3.5 text-[11px] font-black uppercase tracking-[0.08em] text-white/40">{text}</p>
    );
    const pick = (speciesProfileId: string) => {
        rememberCompanion(speciesProfileId);
        window.dispatchEvent(new CustomEvent(COMPANIONS_SWITCH_EVENT, {detail: speciesProfileId}));
        onClose?.();
        // Already on the tab, the chat takes the switch itself: no round trip for the page it is on.
        if ((pathname.slice(localePrefix.length) || "/") !== "/app") router.push(`${localePrefix}/app`);
    };
    return (
        <div className="relative flex h-full min-h-0 flex-col bg-[#0b0b0b]" data-testid={`side-menu-${variant}`}>
            {/* The title band: the name, the bell, and on a phone a way out. */}
            <div className="flex h-14 shrink-0 items-center gap-1 pl-4 pr-1">
                <h2 className="min-w-0 flex-1 truncate font-display text-[20px] font-bold leading-6 text-white">AnimalDex</h2>
                <button type="button" onClick={() => setSearchOpen(true)} aria-label={words.search} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-xl transition-colors hover:bg-white/15" data-testid="side-menu-search">
                    <AppIcon name="search" className="h-5 w-5" />
                </button>
                <Link href="/app/notifications" aria-label={words.notifications} onClick={onClose} className="relative grid h-11 w-11 place-items-center rounded-full text-ink-200 transition-colors hover:bg-white/8 hover:text-white">
                    <AppIcon name="bell" className="h-5 w-5" />
                    {isAuthenticated && unreadCount ? (
                        <span className="absolute right-1 top-1 min-w-[1.05rem] rounded-full bg-primary-400 px-1 text-center text-[0.55rem] font-black leading-4 text-black">{unreadCount > 99 ? "99+" : unreadCount}</span>
                    ) : null}
                </Link>
                {/* No ✕ (the owner, 2026-11-06): it closes as the Claude app's does, with a tap past it or a pick. */}
            </div>
            <div className="shrink-0 px-2 pb-1">
                {places.map((place) => (
                    <Link
                        key={place.href}
                        href={place.href}
                        onClick={onClose}
                        prefetch
                        className="flex h-[52px] items-center gap-3.5 rounded-card px-3.5 text-[17px] text-white transition-colors hover:bg-white/[0.06]"
                        data-testid={`side-menu-${place.testId}`}
                    >
                        <AppIcon name={place.icon} className="h-[22px] w-[22px]" />
                        <span className="min-w-0 flex-1 truncate">{place.label}</span>
                        {isAuthenticated && place.badge ? <span className="min-w-[1.05rem] rounded-full bg-primary-400 px-1 text-center text-[0.55rem] font-black leading-4 text-black">{place.badge}</span> : null}
                    </Link>
                ))}
            </div>
            {/* Recents: ten of their animals, the rest behind View all, as the Claude app lists its recent chats. The list runs under the floating foot. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-20">
                {entries.length > 0 ? <p className="px-4 pb-1 pt-4 text-[15px] text-white/60">{companionWords.list.recents ?? "Recents"}</p> : null}
                {recents.map(({row, line, time}) => (
                    <CompanionRow key={row.speciesProfileId} row={row} line={line} time={time} locale={locale} words={companionWords} href={null} onSelect={() => pick(row.speciesProfileId)} compact />
                ))}
                {hasMore ? (
                    <button type="button" onClick={() => setShowAll(true)} className="flex h-11 w-full items-center gap-1.5 px-4 text-[15px] font-medium text-white/60 transition-colors hover:text-white" data-testid="side-menu-view-all">
                        {companionWords.list.viewAll ?? "View all"} <span aria-hidden="true">›</span>
                    </button>
                ) : null}
                {/* No "meet one now" row here (parity with iOS, 2026-11-06): the full switcher behind View all keeps Meet one now. */}
            </div>
            {searchOpen ? (
                // The search over the whole menu (the owner, 2026-11-06: as the Claude app's): the field, a round × beside it, then the recents or whatever matches of their animals and the places.
                <div className="absolute inset-0 z-10 flex flex-col bg-[#0b0b0b]" data-testid="side-menu-search-drawer" onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }}>
                    <div className="flex shrink-0 items-center gap-2.5 px-4 pb-2 pt-2.5">
                        <input
                            type="search"
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={companionWords.list.searchPlaceholder ?? "Search animals and places"}
                            aria-label={words.search}
                            className="h-11 min-w-0 flex-1 rounded-card border border-white/10 bg-white/[0.06] px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:border-primary-400/60"
                            data-testid="side-menu-search-field"
                        />
                        <button type="button" onClick={closeSearch} aria-label={words.closeMenu} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white backdrop-blur-xl transition-colors hover:bg-white/15" data-testid="side-menu-search-close">
                            <AppIcon name="close" className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
                        {!needle && found.length > 0 ? <p className="px-4 pb-1 pt-2 text-[15px] text-white/60">{companionWords.list.recents ?? "Recents"}</p> : null}
                        {needle ? places.filter((place) => place.label.toLowerCase().includes(needle)).map((place) => (
                            <Link key={place.href} href={place.href} onClick={onClose} prefetch className="flex h-[52px] items-center gap-3.5 rounded-card px-3.5 text-[17px] text-white transition-colors hover:bg-white/[0.06]">
                                <AppIcon name={place.icon} className="h-[22px] w-[22px]" />
                                <span className="min-w-0 flex-1 truncate">{place.label}</span>
                            </Link>
                        )) : null}
                        {found.map(({row, line, time}) => (
                            <CompanionRow key={row.speciesProfileId} row={row} line={line} time={time} locale={locale} words={companionWords} href={null} onSelect={() => pick(row.speciesProfileId)} compact />
                        ))}
                        {needle && found.length === 0 && !places.some((place) => place.label.toLowerCase().includes(needle)) ? (
                            <p className="px-4 pt-4 text-[15px] text-white/60">{companionWords.list.nothingMatches ?? "Nothing matches"}</p>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {/* The person's face bottom-left and Capture bottom-right, floating as glass over the list, no bar (the owner, 2026-11-06: "floating in the sidemenu"). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 pb-2.5 pl-4 pr-3 [&>*]:pointer-events-auto">
                {isAuthenticated && profile ? (
                    <Link href="/app/profile" onClick={onClose} aria-label={words.openProfile} className="grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur-xl transition hover:bg-white/15" data-testid="side-menu-profile">
                        {profile.avatarUrl
                            ? <img src={profile.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" />
                            : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-400/10 text-primary-200 ring-1 ring-primary-400/10"><AppIcon name="profile" /></span>}
                    </Link>
                ) : (
                    <Link href={accountHref} onClick={onClose} className="flex min-h-11 items-center gap-2 border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white">
                        <AppIcon name="profile" />
                        {words.signIn}
                    </Link>
                )}
                <Link
                    href="/app/capture"
                    onClick={onClose}
                    className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-pill bg-primary-400 px-[18px] text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500"
                    data-testid="side-menu-capture"
                >
                    <AppIcon name="camera" /> {words.capture}
                </Link>
            </div>
            {isAuthenticated && onSignOut ? (
                <button onClick={onSignOut} className="shrink-0 px-4 pb-3 text-left text-xs font-bold text-white/35 transition hover:text-white">{words.signOut}</button>
            ) : null}
        </div>
    );
});
