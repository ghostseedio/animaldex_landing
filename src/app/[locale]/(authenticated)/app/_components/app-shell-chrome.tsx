"use client";

import {createContext, useContext} from "react";

export type AppShellChrome = {
    isAuthenticated: boolean;
    unreadCount: number;
    unreadMessageCount: number;
    menuOpen: boolean;
    toggleMenu: () => void;
};

const noopChrome: AppShellChrome = {
    isAuthenticated: false,
    unreadCount: 0,
    unreadMessageCount: 0,
    menuOpen: false,
    toggleMenu: () => undefined
};

export const AppShellChromeContext = createContext<AppShellChrome>(noopChrome);

/**
 * Lets a screen draw its own top bar (the Discover tab mirrors iOS
 * `DiscoverTopBar`) while still reaching the shell's badges and menu.
 */
export function useAppShellChrome() {
    return useContext(AppShellChromeContext);
}

/** Routes whose phone layout is a fixed-height surface (snap feed) rather than a scrolling page. */
export function isDiscoverShellRoute(pathname: string) {
    return pathname === "/app" || pathname.startsWith("/p/");
}
