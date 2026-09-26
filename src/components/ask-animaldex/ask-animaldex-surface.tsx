"use client";

/**
 * The launcher, and the conversation it opens.
 *
 * Mounted once for the whole site. The panel itself is loaded on demand, so a
 * reader who never opens it never downloads the markdown renderer, the visual
 * mediums or the chart — this sits on every page, including the SEO ones.
 *
 * It also answers the `animaldex:ask` event that species pages already
 * dispatch, which is how an inline "Why?" link anywhere on a page starts a real
 * conversation without that page knowing anything about this component.
 */

import {useEffect, useState} from "react";
import dynamic from "next/dynamic";
import {useAskAnimalDex} from "@/components/ask-animaldex/ask-animaldex-provider";
import {SPECIES_ASK_EVENT} from "@/lib/ask-animaldex/events";
import type {AskDrawerLabels} from "@/components/ask-animaldex/ask-drawer";

const AskDrawer = dynamic(() => import("@/components/ask-animaldex/ask-drawer"), {ssr: false});

export default function AskAnimalDexSurface({labels}: {labels: AskDrawerLabels & {launcher: string}}) {
    const {isOpen, open, subject} = useAskAnimalDex();
    const [mounted, setMounted] = useState(false);

    // The launcher is client-only chrome. Rendering it during hydration of a
    // statically generated page would put it in the HTML of every cached SEO
    // page for no benefit.
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        const onAsk = (event: Event) => {
            const detail = (event as CustomEvent<{question?: string}>).detail;
            open(detail?.question);
        };
        window.addEventListener(SPECIES_ASK_EVENT, onAsk);
        return () => window.removeEventListener(SPECIES_ASK_EVENT, onAsk);
    }, [open]);

    if (!mounted) return null;

    if (isOpen) return <AskDrawer labels={labels} />;

    // The authenticated app carries a floating tab bar at the bottom of the
    // screen on mobile, so the launcher clears it there rather than sitting on
    // top of it.
    const inAppShell = subject.kind === "capture" || subject.kind === "collection";

    return (
        <button
            type="button"
            onClick={() => open()}
            aria-label={labels.launcher}
            className={`group fixed right-4 z-[55] flex items-center gap-2 rounded-full border border-primary-300/35 bg-canvas-950 py-2.5 pl-3 pr-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)] transition-colors hover:border-primary-300/70 hover:bg-canvas-900 lg:right-6 ${
                inAppShell ? "bottom-[5.75rem] lg:bottom-6" : "bottom-5 lg:bottom-6"
            }`}
        >
            <span
                aria-hidden="true"
                className="grid h-6 w-6 place-items-center rounded-full bg-primary-400/16 text-primary-200 transition-colors group-hover:bg-primary-400/24"
            >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 3.5 11.4 8 16 9.4 11.4 10.8 10 15.4 8.6 10.8 4 9.4 8.6 8Z" />
                </svg>
            </span>
            {labels.launcher}
        </button>
    );
}
