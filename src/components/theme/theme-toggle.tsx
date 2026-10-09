"use client";

import {useEffect, useState} from "react";
import {DEFAULT_THEME, THEME_STORAGE_KEY, type Theme} from "@/lib/theme";

function readTheme(): Theme {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

type ThemeToggleProps = {
    toLightLabel: string;
    toDarkLabel: string;
    className?: string;
};

export default function ThemeToggle({toLightLabel, toDarkLabel, className = ""}: ThemeToggleProps) {
    // The server cannot know the saved choice, so the label starts at the default
    // and is corrected after mount.
    const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

    useEffect(() => {
        setTheme(readTheme());
    }, []);

    const next: Theme = theme === "dark" ? "light" : "dark";
    const label = next === "light" ? toLightLabel : toDarkLabel;

    return (
        <button
            type="button"
            onClick={() => {
                document.documentElement.setAttribute("data-theme", next);
                try {
                    localStorage.setItem(THEME_STORAGE_KEY, next);
                } catch {
                    // Private mode or blocked storage: the switch still applies for this page.
                }
                setTheme(next);
            }}
            aria-label={label}
            title={label}
            className={"inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[2px] border border-line-200 bg-white/[0.02] text-ink-200 transition-colors duration-150 hover:border-line-100 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 motion-reduce:transition-none " + className}
        >
            {/* The icon follows data-theme through CSS rather than state, so it is right
                from first paint, before hydration has read the saved choice. Moon shows
                the current dark theme, matching how the locale toggle shows the current locale. */}
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 light:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.5 6.5 0 0 0 11 11Z" />
            </svg>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="hidden h-4 w-4 light:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
        </button>
    );
}
