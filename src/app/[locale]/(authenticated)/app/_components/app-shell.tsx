"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import SideMenu from "@/app/[locale]/(authenticated)/app/_components/side-menu";
import {COMPANION_WORDS_EN, type CompanionWords} from "@/lib/companion-bond";
import {AppShellChromeContext, AppShellMenuOpenContext, isDiscoverShellRoute} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
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

function normalizedPath(pathname: string) {
    return pathname.replace(/^\/id(?=\/|$)/, "") || "/";
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

    const signOut = useCallback(async () => {
        await fetch("/api/auth/logout", {method: "POST"});
        router.push("/account");
        router.refresh();
    }, [router]);
    // The menu's props hold still while the menu opens and closes, so the sidebar is not drawn again.
    const menuProfileName = resolvedProfile?.displayName ?? null;
    const menuProfileUsername = resolvedProfile?.username ?? null;
    const menuProfileAvatar = resolvedProfile?.avatarUrl ?? null;
    const menuProfile = useMemo(
        () => (resolvedAuthenticated && menuProfileName !== null ? {displayName: menuProfileName, username: menuProfileUsername, avatarUrl: menuProfileAvatar} : null),
        [resolvedAuthenticated, menuProfileName, menuProfileUsername, menuProfileAvatar]
    );

    // One value while nothing in it changes, and a toggle that never changes: every screen that
    // reads the chrome (the Companions chat and its conversation) used to draw again on each
    // menu open and close (perf pass, 2026-11-06).
    const toggleMenu = useCallback(() => setMenuOpen((open) => !open), []);
    const closeMenu = useCallback(() => setMenuOpen(false), []);
    const profileName = resolvedAuthenticated ? resolvedProfile?.displayName ?? null : null;
    const chrome = useMemo(() => ({
        isAuthenticated: resolvedAuthenticated,
        unreadCount: resolvedAuthenticated ? unreadCount : 0,
        unreadMessageCount: resolvedAuthenticated ? unreadMessageCount : 0,
        words,
        toggleMenu,
        setBottomNavHidden,
        profileName
    }), [resolvedAuthenticated, unreadCount, unreadMessageCount, words, toggleMenu, profileName]);

    return (
        <AppShellChromeContext.Provider value={chrome}>
        <AppShellMenuOpenContext.Provider value={menuOpen}>
        {/* The web app mirrors the iOS app, which is dark-only, so it keeps its own
            palette when the marketing site is in the light theme. */}
        <div className={`theme-dark bg-black text-white ${isDiscoverRoute ? "flex h-[100dvh] flex-col overflow-hidden lg:block lg:h-auto lg:min-h-screen lg:overflow-visible" : "min-h-screen"}`}>
            {/* The side menu as the sidebar (the owner, 2026-11-06): one column beside the thread, as the Claude app has it. */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col border-r border-white/[0.08] bg-[#0b0b0b] lg:flex">
                <SideMenu
                    variant="sidebar"
                    words={words}
                    companionWords={companionWords ?? COMPANION_WORDS_EN}
                    profile={menuProfile}
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
                <div className="flex h-14 shrink-0 items-center px-3 pt-1 lg:hidden">
                    {/* Glass, as the chat's and Explore's floating controls (the owner, 2026-11-06, "like claude"). */}
                    <button type="button" onClick={() => setMenuOpen(true)} aria-label={words.openMenu} className="relative grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur-xl transition-colors hover:bg-white/15" data-testid="shell-menu">
                        <AppIcon name="menu" className="h-5 w-5" />
                        {resolvedAuthenticated && (unreadCount || unreadMessageCount || unreadAnimalMessages) ? <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full bg-primary-400" /> : null}
                    </button>
                </div>
            )}

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
            {/* Outside the inert page (it holds the hamburger row and the main content), or the open menu could not be touched. */}
            {menuOpen ? (
                <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={words.openMenu}>
                    <button type="button" aria-label={words.closeMenu} className="absolute inset-0 bg-black/70" onClick={closeMenu} />
                    <div ref={slideOverRef} tabIndex={-1} className="talk-slide-over absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col border-r border-white/10 shadow-[12px_0_40px_rgba(0,0,0,0.45)] outline-none">
                        <SideMenu
                            variant="slideover"
                            words={words}
                            companionWords={companionWords ?? COMPANION_WORDS_EN}
                            profile={menuProfile}
                            isAuthenticated={resolvedAuthenticated}
                            unreadCount={resolvedAuthenticated ? unreadCount : 0}
                            unreadMessageCount={resolvedAuthenticated ? unreadMessageCount : 0}
                            accountHref={accountHref}
                            onClose={closeMenu}
                            onSignOut={signOut}
                        />
                    </div>
                </div>
            ) : null}

            {/* No bottom nav (the owner, 2026-11-06): the side menu carries every place. */}
        </div>
        </AppShellMenuOpenContext.Provider>
        </AppShellChromeContext.Provider>
    );
}
