"use client";

import {usePathname} from "next/navigation";
import {useEffect, useRef, useState} from "react";

const navigationStartEvent = "animaldex:navigation-start";
const navigationCancelEvent = "animaldex:navigation-cancel";

export default function NavigationProgress() {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const isPendingRef = useRef(false);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousPathnameRef = useRef(pathname);

    useEffect(() => {
        function clearTimers() {
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
            }

            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
                hideTimerRef.current = null;
            }
        }

        function handleNavigationStart() {
            // The start event fires on pointerdown and again on click; the
            // first one owns the bar and its 8 s fallback.
            if (isPendingRef.current) {
                return;
            }

            isPendingRef.current = true;
            clearTimers();
            setIsVisible(true);
            fallbackTimerRef.current = setTimeout(() => {
                isPendingRef.current = false;
                setIsVisible(false);
            }, 8000);
        }

        function handleNavigationCancel() {
            if (!isPendingRef.current) {
                return;
            }

            isPendingRef.current = false;
            clearTimers();
            setIsVisible(false);
        }

        window.addEventListener(navigationStartEvent, handleNavigationStart);
        window.addEventListener(navigationCancelEvent, handleNavigationCancel);

        return () => {
            clearTimers();
            window.removeEventListener(navigationStartEvent, handleNavigationStart);
            window.removeEventListener(navigationCancelEvent, handleNavigationCancel);
        };
    }, []);

    useEffect(() => {
        if (previousPathnameRef.current === pathname) {
            return;
        }

        previousPathnameRef.current = pathname;
        isPendingRef.current = false;

        if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
        }

        hideTimerRef.current = setTimeout(() => setIsVisible(false), 180);
    }, [pathname]);

    return (
        <div
            aria-hidden="true"
            className={"fixed left-0 top-0 z-[100] h-1 bg-primary-400 shadow-[0_0_18px_rgba(167,244,50,0.8)] transition-all duration-500 ease-out " +
                (isVisible ? "w-2/3 opacity-100" : "w-0 opacity-0")}
        />
    );
}
