"use client";

/**
 * The Talk page's frame: the sidebar beside the main pane from 1024 px, a
 * slide-over below it, opened from the conversation's header (or the
 * picker's) and closed by a tap past it, Escape or a choice in it.
 */

import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {usePathname} from "next/navigation";
import TalkSidebar from "@/app/[locale]/talk/talk-sidebar";
import type {TalkWords} from "@/lib/ask-animaldex/talk";

type TalkShellValue = {openSidebar: () => void; words: TalkWords; locale: string};

const TalkShellContext = createContext<TalkShellValue>({openSidebar: () => undefined, words: {} as TalkWords, locale: "en"});

export function useTalkShell() {
    return useContext(TalkShellContext);
}

export default function TalkShell({locale, words, children}: {locale: string; words: TalkWords; children: React.ReactNode}) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    // A choice in the sidebar is a navigation: the slide-over goes with it.
    useEffect(() => setOpen(false), [pathname]);
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);
    const openSidebar = useCallback(() => setOpen(true), []);
    const value = useMemo(() => ({openSidebar, words, locale}), [openSidebar, words, locale]);
    return (
        <TalkShellContext.Provider value={value}>
            <div className="fixed inset-0 flex h-[100dvh] w-full overflow-hidden bg-canvas-950" data-testid="talk-shell">
                <aside className="hidden w-[280px] shrink-0 border-r border-white/10 bg-canvas-900 lg:flex lg:flex-col" aria-label={words.recentChats}>
                    <TalkSidebar locale={locale} words={words} />
                </aside>
                {open ? (
                    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={words.recentChats}>
                        <button type="button" aria-label={words.closeChats} onClick={() => setOpen(false)} className="absolute inset-0 bg-canvas-950/70" />
                        <aside className="talk-slide-over absolute inset-y-0 left-0 flex w-[86vw] max-w-[320px] flex-col border-r border-white/10 bg-canvas-900 shadow-[12px_0_40px_rgba(0,0,0,0.45)]" data-testid="talk-slide-over">
                            <TalkSidebar locale={locale} words={words} onClose={() => setOpen(false)} />
                        </aside>
                    </div>
                ) : null}
                <main className="flex min-w-0 flex-1 flex-col">{children}</main>
            </div>
        </TalkShellContext.Provider>
    );
}
