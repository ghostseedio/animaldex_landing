"use client";

import {useEffect, useState, useRef} from "react";
import {usePathname, useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon, {AppIconName} from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import SideMenu from "@/app/[locale]/(authenticated)/app/_components/side-menu";
import {COMPANION_WORDS_EN, type CompanionWords} from "@/lib/companion-bond";
import {CreditBalanceChip} from "@/app/[locale]/(authenticated)/app/_components/app-credits";
import {AppShellChromeContext, isDiscoverShellRoute} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {useUnreadAnimalMessages} from "@/components/companions/use-animal-conversations";
import {APP_SHELL_WORDS_EN, type AppShellWords} from "@/lib/app-shell-words";

type AppShellProps = {
    children: React.ReactNode;
    profile: {displayName: string; username: string | null; avatarUrl: string | null} | null;
    /** The side menu's words for the animals (the owner, 2026-11-06); English where a page passes none. */
    companionWords?: CompanionWords;
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
    words = APP_SHELL_WORDS_EN, companionWords}: AppShellProps) {
    const pathname = normalizedPath(usePathname() || "/app");
    const router = useRouter();
    const [menuOpen, setMenuOpen] = useState(false);
    // The phone's slide-over is a dialog in deed, not only in name (bug hunt,
    // 2026-11-06): focus moves into it, Escape closes it, and the page behind
    // is inert while it is up, so nobody tabs behind the menu.
    const slideOverRef = useRef<HTMLDivElement>(null);
    const pageRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!menuOpen) return;
        const previous = document.activeElement as HTMLElement | null;
        const page = pageRef.current;
        page?.setAttribute("inert", "");
        slideOverRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            page?.removeAttribute("inert");
            previous?.focus?.();
        };
    }, [menuOpen]);
    // The Companions chat hides the phone's tab bar while it is up.
    const [bottomNavHidden, setBottomNavHidden] = useState(false);
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
                toggleMenu: () => setMenuOpen((open) => !open),
                setBottomNavHidden,
                profileName: resolvedAuthenticated ? resolvedProfile?.displayName ?? null : null
            }}
        >
        {/* The web app mirrors the iOS app, which is dark-only, so it keeps its own
            palette when the marketing site is in the light theme. */}
        <div className={`theme-dark bg-black text-white ${isDiscoverRoute ? "flex h-[100dvh] flex-col overflow-hidden lg:block lg:h-auto lg:min-h-screen lg:overflow-visible" : "min-h-screen"}`}>
            {/* The side menu as the sidebar (the owner, 2026-11-06): one column beside the thread, as the Claude app has it. */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col border-r border-white/[0.08] bg-[#0b0b0b] lg:flex">
                <SideMenu
                    variant="sidebar"
                    words={words}
                    companionWords={companionWords ?? COMPANION_WORDS_EN}
                    profile={resolvedAuthenticated && resolvedProfile ? {displayName: resolvedProfile.displayName, username: resolvedProfile.username ?? null, avatarUrl: resolvedProfile.avatarUrl ?? null} : null}
                    isAuthenticated={resolvedAuthenticated}
                    unreadCount={resolvedAuthenticated ? unreadCount : 0}
                    unreadMessageCount={resolvedAuthenticated ? unreadMessageCount : 0}
                    accountHref={accountHref}
                    onSignOut={signOut}
                />
            </aside>

            {/* No top bar (the owner, 2026-11-06): on a phone a lone hamburger leads the page, the way the Claude app's screens do; the chat draws its own. */}
            <div ref={pageRef} className="contents">
            {bottomNavHidden || isDiscoverRoute ? null : (
                <div className="flex h-12 shrink-0 items-center px-1 lg:hidden">
                    <button type="button" onClick={() => setMenuOpen(true)} aria-label={words.openMenu} className="relative grid h-11 w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/8" data-testid="shell-menu">
                        <AppIcon name="menu" className="h-5 w-5" />
                        {resolvedAuthenticated && (unreadCount || unreadMessageCount || unreadAnimalMessages) ? <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full bg-primary-400" /> : null}
                    </button>
                </div>
            )}

            {menuOpen ? (
                <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={words.openMenu}>
                    <button type="button" aria-label={words.closeMenu} className="absolute inset-0 bg-black/70" onClick={() => setMenuOpen(false)} />
                    <div ref={slideOverRef} tabIndex={-1} className="talk-slide-over absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col border-r border-white/10 shadow-[12px_0_40px_rgba(0,0,0,0.45)] outline-none">
                        <SideMenu
                            variant="slideover"
                            words={words}
                            companionWords={companionWords ?? COMPANION_WORDS_EN}
                                    profile={resolvedAuthenticated && resolvedProfile ? {displayName: resolvedProfile.displayName, username: resolvedProfile.username ?? null, avatarUrl: resolvedProfile.avatarUrl ?? null} : null}
                            isAuthenticated={resolvedAuthenticated}
                            unreadCount={resolvedAuthenticated ? unreadCount : 0}
                            unreadMessageCount={resolvedAuthenticated ? unreadMessageCount : 0}
                            accountHref={accountHref}
                            onClose={() => setMenuOpen(false)}
                            onSignOut={signOut}
                        />
                    </div>
                </div>
            ) : null}

            <main
                className={`bg-[radial-gradient(ellipse_at_top,_rgba(26,26,26,0.55)_0%,_rgba(0,0,0,0)_45%)] lg:ml-[17rem] lg:pb-0 ${
                    isDiscoverRoute
                        // Bottom padding = floating tab bar (bottom-3 + ~4.2rem) so the last
                        // snap slot ends above it, like iOS's safe-area inset.
                        ? "min-h-0 flex-1 pb-4 lg:min-h-screen"
                        : "min-h-screen pb-6"
                }`}
            >
                <div className={`mx-auto w-full max-w-[92rem] ${isDiscoverRoute ? "h-full lg:px-10 lg:py-10" : "px-4 py-7 sm:px-7 lg:px-10 lg:py-10"}`}>{children}</div>
            </main>
            </div>

            {/* No bottom nav (the owner, 2026-11-06): the side menu carries every place. */}
        </div>
        </AppShellChromeContext.Provider>
    );
}
