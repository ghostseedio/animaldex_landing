"use client";

import {createContext, useContext} from "react";
import {useCallback} from "react";
import {APP_SHELL_WORDS_EN, type AppShellWords} from "@/lib/app-shell-words";
import {userFacingError} from "@/lib/user-facing-error";

export type AppShellChrome = {
    isAuthenticated: boolean;
    unreadCount: number;
    unreadMessageCount: number;
    /** The frame's words, and the error lines every screen shares (DECISIONS section 4). */
    words: AppShellWords;
    toggleMenu: () => void;
    /**
     * The Companions tab as the chat (the owner, 2026-11-06, after the Claude
     * app): the phone's tab bar goes away under the conversation; its drawer
     * carries the other tabs.
     */
    setBottomNavHidden: (hidden: boolean) => void;
    /** The person's name, for the chat's fixed greeting (the owner, 2026-11-06). */
    profileName?: string | null;
};

const noopChrome: AppShellChrome = {
    isAuthenticated: false,
    unreadCount: 0,
    unreadMessageCount: 0,
    words: APP_SHELL_WORDS_EN,
    toggleMenu: () => undefined,
    setBottomNavHidden: () => undefined
};

export const AppShellChromeContext = createContext<AppShellChrome>(noopChrome);

/**
 * Whether the side menu is open, apart from the rest of the chrome: only the
 * Explore bar's toggle shows it, and the screens that read the chrome must not
 * draw again on every open and close (perf pass, 2026-11-06).
 */
export const AppShellMenuOpenContext = createContext(false);

export function useAppShellMenuOpen() {
    return useContext(AppShellMenuOpenContext);
}

/**
 * Lets a screen draw its own top bar (the Discover tab mirrors iOS
 * `DiscoverTopBar`) while still reaching the shell's badges and menu.
 */
export function useAppShellChrome() {
    return useContext(AppShellChromeContext);
}

/** Routes whose phone layout is a fixed-height surface (snap feed) rather than a scrolling page. */
export function isDiscoverShellRoute(pathname: string) {
    return pathname === "/app/explore" || pathname.startsWith("/p/");
}

/**
 * What a screen says when something fails (DECISIONS section 4; WEB-40):
 * offline as offline, a route's own sentence as it is, anything else as our
 * side, in the reader's language. The raw text goes to the console only.
 */
export function useUserFacingError() {
    const {words} = useAppShellChrome();
    return useCallback((error: unknown, context?: string) => userFacingError(error, words, {context}).message, [words]);
}
