"use client";

import {useEffect, useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon, {AppIconName} from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {CreditBalanceChip} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {AppShellChromeContext, isDiscoverShellRoute} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {useUnreadAnimalMessages} from "@/components/companions/use-animal-conversations";
import {APP_SHELL_WORDS_EN, type AppShellWords} from "@/lib/app-shell-words";

type AppShellProps = {
    children: React.ReactNode;
    profile: {displayName: string; username: string | null; avatarUrl: string | null} | null;
    isAuthenticated: boolean;
    unreadCount: number;
    unreadMessageCount: number;
    hydrateFromSession?: boolean;
    /** The frame's words in the reader's language. */
    words?: AppShellWords;
};

/**
 * The tabs (docs/companion-loop/SPEC.md, phase 4): Companions · Collection ·
 * Capture · Explore · Profile. Capture is the round button between them on a
 * phone and the "Capture" button on a desktop: one label (UX pass WEB-39).
 */
const mainLinks: {href: string; label: keyof AppShellWords; icon: AppIconName}[] = [
    {href: "/app", label: "companions", icon: "companions"},
    {href: "/app/collection", label: "collection", icon: "collection"},
    {href: "/app/explore", label: "explore", icon: "explore"},
    {href: "/app/profile", label: "profile", icon: "profile"}
];

/**
 * The drawer: everything that is not a tab. The web has no Widgets page, and
 * gifts and credit offers live on the cards and the Credits page. Events
 * (sponsored campaigns) are listed on Missions, so the row opens them there
 * (JRN-1: it used to go to a redirect onto the comparisons hub).
 */
const drawerLinks: {href: string; label: keyof AppShellWords; icon: AppIconName}[] = [
    {href: "/app/missions", label: "missions", icon: "mission"},
    {href: "/app/credits", label: "credits", icon: "spark"},
    {href: "/app/earnings", label: "earnings", icon: "boltShield"},
    {href: "/app/profile?tab=shop", label: "shop", icon: "sets"},
    {href: "/app/profile?tab=locations", label: "locations", icon: "location"},
    {href: "/app/guides", label: "guides", icon: "search"},
    {href: "/app/trades", label: "trades", icon: "trade"},
    {href: "/app/missions#events", label: "events", icon: "matchup"},
    {href: "/app/import/instagram", label: "instagram", icon: "camera"},
    {href: "/app/settings", label: "settings", icon: "settings"}
];

const PREFETCH_ROUTES = [
    "/app",
    "/app/collection",
    "/app/explore",
    "/app/profile",
    "/app/settings",
    "/app/missions",
    "/app/trades",
    "/app/messages",
    "/app/notifications",
    "/app/earnings",
    "/app/guides"
];

function localePrefix(pathname: string) {
    return pathname.startsWith("/id/") ? "/id" : "";
}

/** Explore: the feed (and its posts), Debates and Collectors; old Battles links redirect into it. */
function isExploreRoute(pathname: string) {
    if (pathname.startsWith("/p/")) return true;
    return ["/app/explore", "/app/debates", "/app/arena", "/app/train", "/app/matchups"].some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
}

function normalizedPath(pathname: string) {
    return pathname.replace(/^\/id(?=\/|$)/, "") || "/";
}

function NavBadge({count}: {count: number}) {
    if (!count) return null;
    return <span className="ml-auto rounded-full bg-primary-400 px-2 py-0.5 text-[0.65rem] font-black tabular-nums text-black">{count > 99 ? "99+" : count}</span>;
}

export default function AppShell({
    children,
    profile,
    isAuthenticated,
    unreadCount,
    unreadMessageCount,
    hydrateFromSession = false,
    words = APP_SHELL_WORDS_EN
}: AppShellProps) {
    const pathname = normalizedPath(usePathname() || "/app");
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    const [sessionProfile, setSessionProfile] = useState<AppShellProps["profile"]>(null);
    const [sessionAuthenticated, setSessionAuthenticated] = useState(false);
    const accountHref = "/account";
    const resolvedProfile = sessionProfile ?? profile;
    const resolvedAuthenticated = isAuthenticated || sessionAuthenticated;
    // The animals' unread messages, on the Companions tab (iOS MainTabBar).
    const unreadAnimalMessages = useUnreadAnimalMessages(resolvedAuthenticated);
    // The Discover tab owns its top bar on phones (iOS DiscoverTopBar) and the
    // snap feed must fill the space between it and the tab bar without the
    // document scrolling underneath — so the shell becomes a fixed column.
    const isDiscoverRoute = isDiscoverShellRoute(pathname);
    const isActive = (href: string) => {
        if (href === "/app") return pathname === href || pathname.startsWith("/app/companions");
        if (href === "/app/explore") return isExploreRoute(pathname);
        const path = href.split(/[?#]/)[0];
        return pathname.startsWith(path) && !href.includes("?") && !href.includes("#");
    };
    // The feed is open signed out; everything else asks to sign in first.
    const navHref = (href: string) => resolvedAuthenticated || href === "/app/explore" ? href : accountHref;

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!hydrateFromSession || typeof document === "undefined") return;
        if (!requestHasSupabaseAuthCookie(document.cookie)) return;

        let cancelled = false;
        void fetch("/api/auth/session", {cache: "no-store"})
            .then((response) => response.ok ? response.json() : null)
            .then((payload: {user?: {id: string} | null; username?: string | null; displayName?: string | null} | null) => {
                if (cancelled || !payload?.user) return;
                setSessionAuthenticated(true);
                setSessionProfile({
                    displayName: payload.displayName?.trim() || payload.username?.trim() || "Collector",
                    username: payload.username?.trim() || null,
                    avatarUrl: null
                });
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [hydrateFromSession]);

    useEffect(() => {
        // Lets /admin/metrics count web users by platform; at most once a day.
        if (!resolvedAuthenticated || typeof window === "undefined") return;
        const key = "animaldex.web-device-recorded-at";
        try {
            if (Date.now() - Number(window.localStorage.getItem(key) ?? 0) < 24 * 60 * 60 * 1000) return;
        } catch {
            return;
        }
        void fetch("/api/app/device", {method: "POST"})
            .then((response) => response.ok ? response.json() : null)
            .then((payload: {recorded?: boolean} | null) => {
                if (!payload?.recorded) return;
                try {
                    window.localStorage.setItem(key, String(Date.now()));
                } catch {
                    // Storage can be unavailable in private windows.
                }
            })
            .catch(() => undefined);
    }, [resolvedAuthenticated]);

    useEffect(() => {
        const prefix = localePrefix(pathname);
        for (const route of resolvedAuthenticated ? PREFETCH_ROUTES : ["/app", "/account"]) {
            router.prefetch(`${prefix}${route}`);
        }
    }, [resolvedAuthenticated, pathname, router]);

    async function signOut() {
        await fetch("/api/auth/logout", {method: "POST"});
        router.push("/account");
        router.refresh();
    }

    const navClass = (active: boolean, mobile = false) => {
        const base = mobile
            ? "flex flex-1 flex-col items-center gap-1 py-2 text-[0.62rem] font-bold transition"
            : "flex items-center gap-3 px-3 py-3 text-sm font-bold transition";
        // Selected: the neon edge and wash of the product's special rows, never a white block (WEB-39);
        // on the phone's tab bar, the neon tab.
        return active
            ? mobile
                ? `${base} text-primary-300`
                : `${base} bg-primary-400/[0.08] text-white shadow-[inset_2px_0_0_rgb(var(--c-accent))]`
            : `${base} text-white/50 hover:bg-white/5 hover:text-white`;
    };

    const navLink = (item: (typeof mainLinks)[number], mobile = false) => {
        const badge = item.href === "/app" ? unreadAnimalMessages : 0;
        return (
            <Link key={item.href} href={navHref(item.href)} prefetch className={navClass(isActive(item.href), mobile)}>
                {mobile ? (
                    <span className="relative">
                        <AppIcon name={item.icon} className="h-5 w-5" />
                        {badge ? (
                            <span className="absolute -right-3 -top-1.5 min-w-[1.05rem] rounded-full bg-primary-400 px-1 text-center text-[0.55rem] font-black leading-[1.05rem] tabular-nums text-black">
                                {badge > 99 ? "99+" : badge}
                            </span>
                        ) : null}
                    </span>
                ) : (
                    <AppIcon name={item.icon} className="h-[1.15rem] w-[1.15rem]" />
                )}
                <span>{words[item.label]}</span>
                {!mobile && badge ? <NavBadge count={badge} /> : null}
            </Link>
        );
    };

    const utilityLink = (href: string, label: string, icon: AppIconName, badge = 0) => (
        <Link key={href} href={navHref(href)} prefetch className={navClass(isActive(href))}>
            <AppIcon name={icon} />
            {label}
            {resolvedAuthenticated ? <NavBadge count={badge} /> : null}
        </Link>
    );

    return (
        <AppShellChromeContext.Provider
            value={{
                isAuthenticated: resolvedAuthenticated,
                unreadCount: resolvedAuthenticated ? unreadCount : 0,
                unreadMessageCount: resolvedAuthenticated ? unreadMessageCount : 0,
                words,
                menuOpen,
                toggleMenu: () => setMenuOpen((open) => !open)
            }}
        >
        {/* The web app mirrors the iOS app, which is dark-only, so it keeps its own
            palette when the marketing site is in the light theme. */}
        <div className={`theme-dark bg-black text-white ${isDiscoverRoute ? "flex h-[100dvh] flex-col overflow-hidden lg:block lg:h-auto lg:min-h-screen lg:overflow-visible" : "min-h-screen"}`}>
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col border-r border-white/[0.08] bg-[#0b0b0b]/95 p-5 backdrop-blur-xl lg:flex">
                <Link href="/app" className="flex items-center gap-3 px-2 py-2 transition hover:bg-white/[0.04]">
                    <img src="/icon-192.webp" alt="" className="h-11 w-11 ring-1 ring-white/10" />
                    <div>
                        <p className="font-display text-xl font-bold">AnimalDex</p>
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-primary-200">{words.webApp}</p>
                    </div>
                </Link>

                <nav className="mt-8 space-y-1">{mainLinks.map((item) => navLink(item))}</nav>

                <p className="mb-2 mt-8 px-3 text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/25">{words.more}</p>
                <nav className="min-h-0 space-y-1 overflow-y-auto">
                    {utilityLink("/app/messages", words.messages, "message", unreadMessageCount)}
                    {utilityLink("/app/notifications", words.notifications, "bell", unreadCount)}
                    {drawerLinks.map((item) => utilityLink(item.href, words[item.label], item.icon))}
                </nav>

                <div className="mt-auto space-y-4 pt-4">
                    {resolvedAuthenticated ? <CreditBalanceChip className="w-full justify-center px-4 py-2.5" /> : null}
                    <Link href={navHref("/app/capture")} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-400 px-4 py-3.5 text-sm font-black text-black transition-colors hover:bg-primary-300">
                        <AppIcon name="camera" />
                        {words.capture}
                    </Link>
                    {resolvedAuthenticated && resolvedProfile ? (
                    <div className="flex items-center gap-2 border-t border-white/[0.08] px-1 pt-4">
                        <Link href="/app/profile" aria-label={words.openProfile} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 transition hover:bg-white/[0.04]">
                            {resolvedProfile.avatarUrl
                                ? <img src={resolvedProfile.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/10" />
                                : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-400/10 text-primary-200 ring-1 ring-primary-400/10"><AppIcon name="profile" /></span>}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold">{resolvedProfile.displayName}</p>
                                <p className="truncate text-xs text-white/35">{resolvedProfile.username ? `@${resolvedProfile.username}` : words.collector}</p>
                            </div>
                        </Link>
                        <button onClick={signOut} className="ml-auto min-h-9 px-1 text-xs font-bold text-white/35 transition hover:text-white">{words.signOut}</button>
                    </div>
                    ) : (
                    <div className="border-t border-white/[0.08] px-1 pt-4">
                        <Link href={accountHref} className="flex min-h-11 items-center justify-center gap-2 border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:border-primary-400/35 hover:bg-white/[0.07] hover:text-primary-100">
                            <AppIcon name="profile" />
                            {words.signIn}
                        </Link>
                    </div>
                    )}
                </div>
            </aside>

            <header className={`sticky top-0 z-30 border-b border-white/[0.08] bg-black/80 backdrop-blur-xl lg:hidden ${isDiscoverRoute ? "hidden" : ""}`}>
                <div className="flex h-16 items-center justify-between px-4">
                    <Link href="/app" aria-label="AnimalDex" className="flex items-center">
                        <img src="/icon-192.webp" alt="" className="h-9 w-9 ring-1 ring-white/10" />
                    </Link>
                    <div className="flex items-center gap-2">
                        {resolvedAuthenticated ? <CreditBalanceChip /> : null}
                        <Link href={navHref("/app/messages")} aria-label={words.messages} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/70">
                            <AppIcon name="message" />
                            {resolvedAuthenticated && unreadMessageCount ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary-400" /> : null}
                        </Link>
                        <Link href={navHref("/app/notifications")} aria-label={words.notifications} className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/70">
                            <AppIcon name="bell" />
                            {resolvedAuthenticated && unreadCount ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary-400" /> : null}
                        </Link>
                        <button onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? words.closeMenu : words.openMenu} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/70">
                            <AppIcon name={menuOpen ? "close" : "menu"} />
                        </button>
                    </div>
                </div>
            </header>

            {menuOpen ? (
                <>
                    {/* Above the z-40 tab bar so a tap on it closes the menu instead of navigating. */}
                    <button type="button" aria-label={words.closeMenu} className="fixed inset-0 z-[45] bg-black/60 backdrop-blur-[2px] lg:hidden" onClick={() => setMenuOpen(false)} />
                    <div className="fixed inset-x-4 top-[4.75rem] z-50 max-h-[70vh] overflow-y-auto border border-white/10 bg-[#141414]/95 p-3 shadow-2xl backdrop-blur-xl lg:hidden">
                        {resolvedAuthenticated && resolvedProfile ? (
                        <Link href="/app/profile" className="mb-2 flex items-center gap-3 border border-white/10 bg-white/[0.04] px-3 py-3 transition hover:bg-white/[0.07]">
                            {resolvedProfile.avatarUrl
                                ? <img src={resolvedProfile.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10" />
                                : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-400/10 text-primary-200 ring-1 ring-primary-400/10"><AppIcon name="profile" /></span>}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">{resolvedProfile.displayName}</p>
                                <p className="truncate text-xs text-white/35">{resolvedProfile.username ? `@${resolvedProfile.username}` : words.viewProfile}</p>
                            </div>
                        </Link>
                        ) : (
                        <Link href={accountHref} className="mb-2 flex min-h-12 items-center justify-center gap-2 border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-black text-white transition hover:bg-white/[0.07] hover:text-primary-100">
                            <AppIcon name="profile" />
                            {words.signIn}
                        </Link>
                        )}
                        <p className="px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/25">{words.more}</p>
                        {utilityLink("/app/messages", words.messages, "message", unreadMessageCount)}
                        {utilityLink("/app/notifications", words.notifications, "bell", unreadCount)}
                        {drawerLinks.map((item) => utilityLink(item.href, words[item.label], item.icon))}
                        {resolvedAuthenticated ? (
                            <button onClick={signOut} className="mt-2 w-full border border-white/10 px-3 py-3 text-left text-sm font-bold text-white/50 transition hover:text-white">{words.signOut}</button>
                        ) : null}
                    </div>
                </>
            ) : null}

            <main
                className={`bg-[radial-gradient(ellipse_at_top,_rgba(26,26,26,0.55)_0%,_rgba(0,0,0,0)_45%)] lg:ml-[17rem] lg:pb-0 ${
                    isDiscoverRoute
                        // Bottom padding = floating tab bar (bottom-3 + ~4.2rem) so the last
                        // snap slot ends above it, like iOS's safe-area inset.
                        ? "min-h-0 flex-1 pb-[5rem] lg:min-h-screen"
                        : "min-h-screen pb-28"
                }`}
            >
                <div className={`mx-auto w-full max-w-[92rem] ${isDiscoverRoute ? "h-full lg:px-10 lg:py-10" : "px-4 py-7 sm:px-7 lg:px-10 lg:py-10"}`}>{children}</div>
            </main>

            <nav className="fixed inset-x-3 bottom-3 z-40 flex items-center border border-white/10 bg-[#141414]/95 p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:hidden">
                {mainLinks.slice(0, 2).map((item) => navLink(item, true))}
                <Link href={navHref("/app/capture")} aria-label={words.capture} className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-400 text-black shadow-lg shadow-primary-400/20 ring-4 ring-black">
                    <AppIcon name="plus" className="h-6 w-6" />
                </Link>
                {mainLinks.slice(2).map((item) => navLink(item, true))}
            </nav>
        </div>
        </AppShellChromeContext.Provider>
    );
}
