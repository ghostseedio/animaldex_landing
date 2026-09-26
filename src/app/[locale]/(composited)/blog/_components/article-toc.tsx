"use client";

import {useEffect, useRef, useState} from "react";

import {MINIMUM_TOC_SECTIONS} from "@/app/[locale]/(composited)/blog/_components/article-toc-config";

type TocItem = {id: string; title: string};

/**
 * Reading navigation.
 *
 * Desktop gets a quiet sticky rail — no panel, no border, just a hairline and a
 * list that recedes until a section is current. Mobile gets a collapsed
 * `<details>` so it costs one line instead of half the screen.
 *
 * A short article renders nothing: a two-entry contents list is furniture, not
 * navigation.
 */

const MINIMUM_SECTIONS = MINIMUM_TOC_SECTIONS;

function useActiveSection(items: TocItem[]) {
    const [activeId, setActiveId] = useState<string | null>(null);

    useEffect(() => {
        if (!items.length || typeof IntersectionObserver === "undefined") return undefined;

        const visible = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                // The topmost heading currently on screen wins, so the rail
                // never jumps back to a section the reader has scrolled past.
                const current = items.find((item) => visible.has(item.id));
                if (current) setActiveId(current.id);
            },
            {rootMargin: "-88px 0px -65% 0px", threshold: 0}
        );

        for (const item of items) {
            const element = document.getElementById(item.id);
            if (element) observer.observe(element);
        }

        return () => observer.disconnect();
    }, [items]);

    return activeId;
}

function useReadingProgress() {
    const [progress, setProgress] = useState(0);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        function measure() {
            frame.current = null;
            const scrollable = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(scrollable <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / scrollable)));
        }

        function onScroll() {
            if (frame.current !== null) return;
            frame.current = window.requestAnimationFrame(measure);
        }

        measure();
        window.addEventListener("scroll", onScroll, {passive: true});
        window.addEventListener("resize", onScroll);

        return () => {
            if (frame.current !== null) window.cancelAnimationFrame(frame.current);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, []);

    return progress;
}

export function ArticleTocRail({items, label}: {items: TocItem[]; label: string}) {
    const activeId = useActiveSection(items);
    const progress = useReadingProgress();

    if (items.length < MINIMUM_SECTIONS) return null;

    return (
        <nav aria-label={label} className="sticky top-24 hidden xl:block">
            <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-400)]">{label}</p>
                <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--rule)]" />
                <span className="font-mono text-[10px] tabular-nums text-[color:var(--text-400)]">
                    {Math.round(progress * 100)}%
                </span>
            </div>

            <ol className="mt-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
                {items.map((item) => {
                    const isActive = item.id === activeId;
                    return (
                        <li key={item.id} className="list-none">
                            <a
                                href={`#${item.id}`}
                                aria-current={isActive ? "true" : undefined}
                                className={`group flex gap-3 py-[7px] text-[13px] leading-[1.45] transition-colors ${
                                    isActive ? "text-[color:var(--text-100)]" : "text-[color:var(--text-400)] hover:text-[color:var(--text-200)]"
                                }`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`mt-[9px] h-px w-3 shrink-0 transition-all ${
                                        isActive ? "w-5 bg-[color:var(--lime)]" : "bg-[color:var(--rule-strong)] group-hover:w-4"
                                    }`}
                                />
                                <span className="min-w-0">{item.title}</span>
                            </a>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

export function ArticleTocInline({items, label}: {items: TocItem[]; label: string}) {
    if (items.length < MINIMUM_SECTIONS) return null;

    return (
        <details className="group xl:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between border-y border-[color:var(--rule)] py-3.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-300)] [&::-webkit-details-marker]:hidden">
                {label}
                <span aria-hidden="true" className="text-[color:var(--lime)] transition-transform group-open:rotate-180">▾</span>
            </summary>
            <ol className="border-b border-[color:var(--rule)] py-2">
                {items.map((item, index) => (
                    <li key={item.id} className="list-none">
                        <a
                            href={`#${item.id}`}
                            className="flex min-h-[44px] items-center gap-3 text-[15px] leading-snug text-[color:var(--text-200)]"
                        >
                            <span aria-hidden="true" className="font-mono text-[11px] tabular-nums text-[color:var(--text-400)]">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            {item.title}
                        </a>
                    </li>
                ))}
            </ol>
        </details>
    );
}
