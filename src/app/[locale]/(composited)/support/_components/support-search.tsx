"use client";

import Link from "@/app/[locale]/_components/link";
import {LifeBuoyIcon} from "@/app/[locale]/_components/icons";
import {useCallback, useEffect, useId, useRef, useState} from "react";

type SearchHit = {
    id: string;
    title: string;
    categoryTitle: string;
    snippet: string;
    href: string;
};

type SupportSearchProps = {
    locale: string;
    placeholder: string;
    emptyTitle: string;
    emptyBody: string;
    talkToSupportLabel: string;
    talkToSupportHref: string;
};

export default function SupportSearch({
    locale,
    placeholder,
    emptyTitle,
    emptyBody,
    talkToSupportLabel,
    talkToSupportHref
}: SupportSearchProps) {
    const listboxId = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchHit[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [hasSearched, setHasSearched] = useState(false);

    const search = useCallback(async (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) {
            setResults([]);
            setHasSearched(false);
            setActiveIndex(-1);
            return;
        }

        setLoading(true);
        setHasSearched(true);

        try {
            const params = new URLSearchParams({q: trimmed, locale, limit: "8"});
            const response = await fetch(`/api/support/search?${params.toString()}`);
            const payload = await response.json() as {results?: SearchHit[]};
            setResults(payload.results ?? []);
            setActiveIndex(payload.results?.length ? 0 : -1);
        } catch {
            setResults([]);
            setActiveIndex(-1);
        } finally {
            setLoading(false);
        }
    }, [locale]);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            void search(query);
        }, 180);

        return () => window.clearTimeout(handle);
    }, [query, search]);

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (!results.length) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % results.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
        } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            const hit = results[activeIndex];
            if (hit) window.location.href = hit.href;
        } else if (event.key === "Escape") {
            setQuery("");
            setResults([]);
            setHasSearched(false);
            setActiveIndex(-1);
        }
    }

    return (
        <div className="relative w-full">
            <label htmlFor={`${listboxId}-input`} className="sr-only">
                {placeholder}
            </label>
            <div className="relative overflow-hidden rounded-[1.35rem] border border-primary-200/20 bg-[#071B0F]/90 shadow-[0_24px_80px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.05)] focus-within:border-primary-200/45">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(167,244,50,0.08),transparent_55%)]" />
                <div className="relative flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-primary-200/80" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M16.5 16.5 21 21" strokeLinecap="round" />
                    </svg>
                    <input
                        ref={inputRef}
                        id={`${listboxId}-input`}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder={placeholder}
                        role="combobox"
                        aria-expanded={results.length > 0}
                        aria-controls={`${listboxId}-listbox`}
                        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
                        autoComplete="off"
                        className="min-w-0 flex-1 bg-transparent font-medium text-white placeholder:text-ink-500 outline-none"
                    />
                    {loading ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">Searching</span> : null}
                </div>
            </div>

            {hasSearched ? (
                <div
                    id={`${listboxId}-listbox`}
                    role="listbox"
                    className="mt-3 overflow-hidden rounded-[1.2rem] border border-white/[0.07] bg-[#071B0F]/95 shadow-[0_20px_70px_rgba(0,0,0,0.35)]"
                >
                    {results.length ? results.map((hit, index) => (
                        <Link
                            key={hit.id}
                            id={`${listboxId}-option-${index}`}
                            href={hit.href}
                            role="option"
                            aria-selected={index === activeIndex}
                            className={`block border-b border-white/[0.05] px-4 py-4 transition-colors last:border-b-0 sm:px-5 ${
                                index === activeIndex ? "bg-primary-400/10" : "hover:bg-white/[0.03]"
                            }`}
                        >
                            <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-primary-200">{hit.categoryTitle}</p>
                            <p className="mt-1 font-display text-lg font-bold text-white">{hit.title}</p>
                            <p className="mt-1 text-sm leading-relaxed text-ink-300">{hit.snippet}</p>
                        </Link>
                    )) : (
                        <div className="px-5 py-8 text-center">
                            <p className="font-display text-sm font-black uppercase tracking-[0.22em] text-ink-400">{emptyTitle}</p>
                            <p className="mt-3 text-sm leading-relaxed text-ink-300">{emptyBody}</p>
                            <Link
                                href={talkToSupportHref}
                                className="mt-5 inline-flex min-h-[2.75rem] items-center justify-center rounded-full border border-primary-200/35 px-5 font-display text-xs font-bold uppercase tracking-[0.14em] text-primary-200 transition-colors hover:border-primary-200/60 hover:bg-primary-400/10 hover:text-white"
                            >
                                {talkToSupportLabel} →
                            </Link>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
