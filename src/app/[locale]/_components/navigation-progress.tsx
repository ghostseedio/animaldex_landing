"use client";

import {usePathname} from "next/navigation";
import {useEffect, useRef, useState} from "react";

const navigationStartEvent = "animaldex:navigation-start";

export default function NavigationProgress() {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);
    const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousPathnameRef = useRef(pathname);

    useEffect(() => {
        function clearTimers() {
            if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
            }

            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        }

        function handleNavigationStart() {
            clearTimers();
            setIsVisible(true);
            fallbackTimerRef.current = setTimeout(() => setIsVisible(false), 8000);
        }

        window.addEventListener(navigationStartEvent, handleNavigationStart);

        return () => {
            clearTimers();
            window.removeEventListener(navigationStartEvent, handleNavigationStart);
        };
    }, []);

    useEffect(() => {
        if (previousPathnameRef.current === pathname) {
            return;
        }

        previousPathnameRef.current = pathname;

        if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
        }

        hideTimerRef.current = setTimeout(() => setIsVisible(false), 180);
    }, [pathname]);

    return (
        <div
            aria-hidden="true"
            className={"fixed left-0 top-0 z-[100] h-1 bg-primary-500 shadow-[0_0_18px_rgba(27,196,81,0.8)] transition-all duration-500 ease-out " +
                (isVisible ? "w-2/3 opacity-100" : "w-0 opacity-0")}
        />
    );
}
