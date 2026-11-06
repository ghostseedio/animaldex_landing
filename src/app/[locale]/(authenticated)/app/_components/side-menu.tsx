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
import {useState} from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon, {type AppIconName} from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {CreditBalanceChip} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {CompanionRow} from "@/app/[locale]/(authenticated)/app/companions/companion-row";
import {COMPANIONS_SWITCH_EVENT, useCompanionRoster} from "@/components/companions/use-companion-roster";
import type {AppShellWords} from "@/lib/app-shell-words";
import type {CompanionWords} from "@/lib/companion-bond";
import {rememberCompanion} from "@/lib/companions-opening";
import {TRY_TALKING_HREF} from "@/lib/try-talking";

const SEARCH_FROM = 9;

export type SideMenuProfile = {displayName: string; username: string | null; avatarUrl: string | null} | null;

export default function SideMenu({variant, words, companionWords, profile, isAuthenticated, unreadCount, unreadMessageCount, accountHref, onClose, onSignOut}: {
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
    const needle = query.trim().toLowerCase();
    const shown = needle
        ? entries.filter(({row}) => row.displayName.toLowerCase().includes(needle) || row.animal.toLowerCase().includes(needle))
        : entries;
    const talking = shown.filter(({time}) => time !== null);
    const quiet = shown.filter(({time}) => time === null);
    const headers = talking.length > 0 && quiet.length > 0;
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
        router.push(`${localePrefix}/app`);
    };
    return (
        <div className="flex h-full min-h-0 flex-col bg-[#0b0b0b]" data-testid={`side-menu-${variant}`}>
            {/* The title band: the name, the bell, and on a phone a way out. */}
            <div className="flex h-14 shrink-0 items-center gap-1 pl-4 pr-1">
                <h2 className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold leading-6 text-white">{companionWords.list.switcher}</h2>
                <Link href="/app/notifications" aria-label={words.notifications} onClick={onClose} className="relative grid h-11 w-11 place-items-center rounded-full text-ink-200 transition-colors hover:bg-white/8 hover:text-white">
                    <AppIcon name="bell" className="h-5 w-5" />
                    {isAuthenticated && unreadCount ? (
                        <span className="absolute right-1 top-1 min-w-[1.05rem] rounded-full bg-primary-400 px-1 text-center text-[0.55rem] font-black leading-4 text-black">{unreadCount > 99 ? "99+" : unreadCount}</span>
                    ) : null}
                </Link>
                {onClose ? (
                    <button type="button" onClick={onClose} aria-label={words.closeMenu} className="grid h-11 w-11 place-items-center rounded-full text-ink-200 transition-colors hover:bg-white/8 hover:text-white">
                        <AppIcon name="close" className="h-4 w-4" />
                    </button>
                ) : null}
            </div>
            {/* The places, two to a row, as the Claude app leads with its places. */}
            <div className="grid shrink-0 grid-cols-2 gap-2 px-4 pb-3">
                {places.map((place) => (
                    <Link
                        key={place.href}
                        href={place.href}
                        onClick={onClose}
                        prefetch
                        className="relative inline-flex h-[38px] items-center justify-center gap-1.5 rounded-pill bg-[#12351C] text-[13px] font-semibold text-white transition-colors hover:bg-[#1a4526]"
                        data-testid={`side-menu-${place.testId}`}
                    >
                        <AppIcon name={place.icon} className="h-4 w-4" />
                        <span className="truncate">{place.label}</span>
                        {isAuthenticated && place.badge ? <span className="ml-1 min-w-[1.05rem] rounded-full bg-primary-400 px-1 text-center text-[0.55rem] font-black leading-4 text-black">{place.badge}</span> : null}
                    </Link>
                ))}
            </div>
            {entries.length >= SEARCH_FROM ? (
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label={companionWords.list.switcher}
                    className="mx-4 mb-2.5 h-10 shrink-0 rounded-pill border border-white/10 bg-white/[0.05] px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:border-primary-400/60"
                />
            ) : null}
            {/* Their animals: talking first, then the ones to say hello to, then the other ways in. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
                {headers ? band(companionWords.list.talking) : null}
                {talking.map(({row, line, time}) => (
                    <CompanionRow key={row.speciesProfileId} row={row} line={line} time={time} locale={locale} words={companionWords} href={null} onSelect={() => pick(row.speciesProfileId)} compact />
                ))}
                {headers ? band(companionWords.list.shelf) : null}
                {quiet.map(({row, line, time}) => (
                    <CompanionRow key={row.speciesProfileId} row={row} line={line} time={time} locale={locale} words={companionWords} href={null} onSelect={() => pick(row.speciesProfileId)} compact />
                ))}
                {needle ? null : (
                    <div className="flex flex-col items-start gap-3 px-4 py-5">
                        <Link href={TRY_TALKING_HREF} onClick={onClose} className="text-[13px] font-semibold text-white/60 transition-colors hover:text-white">
                            {companionWords.tab.meetOneNow}
                        </Link>
                        <Link
                            href="/app/capture"
                            onClick={onClose}
                            className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-primary-400 px-5 text-[13px] font-black text-black transition-colors hover:bg-primary-300 active:bg-primary-500"
                            data-testid="side-menu-capture"
                        >
                            <AppIcon name="camera" /> {words.capture}
                        </Link>
                    </div>
                )}
            </div>
            {/* The account row at the foot, as the Claude app keeps it: Profile, the credits, the gear for Settings. */}
            <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.08] py-2 pl-4 pr-1">
                {isAuthenticated && profile ? (
                    <>
                        <Link href="/app/profile" onClick={onClose} aria-label={words.openProfile} className="flex min-w-0 flex-1 items-center gap-3 py-1 transition hover:opacity-80" data-testid="side-menu-profile">
                            {profile.avatarUrl
                                ? <img src={profile.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" />
                                : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-400/10 text-primary-200 ring-1 ring-primary-400/10"><AppIcon name="profile" /></span>}
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-white">{profile.displayName}</span>
                                <span className="block truncate text-xs text-white/35">{profile.username ? `@${profile.username}` : words.viewProfile}</span>
                            </span>
                        </Link>
                        <CreditBalanceChip />
                        <Link href="/app/settings" onClick={onClose} aria-label={words.settings} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-200 transition-colors hover:bg-white/8 hover:text-white" data-testid="side-menu-settings">
                            <AppIcon name="settings" className="h-5 w-5" />
                        </Link>
                    </>
                ) : (
                    <Link href={accountHref} onClick={onClose} className="flex min-h-11 flex-1 items-center justify-center gap-2 border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-white">
                        <AppIcon name="profile" />
                        {words.signIn}
                    </Link>
                )}
            </div>
            {isAuthenticated && onSignOut ? (
                <button onClick={onSignOut} className="shrink-0 px-4 pb-3 text-left text-xs font-bold text-white/35 transition hover:text-white">{words.signOut}</button>
            ) : null}
        </div>
    );
}
