"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {
    buildLocalSuggestions,
    normalizeSuggestionQuery,
    type LocalSuggestion,
    type SuggestionCatalogEntry
} from "@/lib/universal-search-suggestions";

export type UniversalSearchFieldCopy = {
    placeholder: string;
    searchLabel: string;
    clearLabel: string;
    voiceLabel: string;
    voiceListening: string;
    recentTitle: string;
    clearAll: string;
    seeMore: string;
    trendingTitle: string;
    popularBadge: string;
    suggestionsTitle: string;
    submit: string;
    filterDirectory: string;
};

type UniversalSearchFieldProps = {
    basePath: string;
    locale: string;
    initialQuery?: string;
    catalogEntries: SuggestionCatalogEntry[];
    trending: Array<{query: string; isPopular: boolean}>;
    copy: UniversalSearchFieldCopy;
    autoFocus?: boolean;
    /** Keeps the directory's in-page name filter reachable from the same field. */
    directoryFilterPath?: string;
};

const RECENT_STORAGE_KEY = "animaldex.catalog.recent_searches.v1";
const MAX_RECENT = 20;
const COLLAPSED_RECENT_LIMIT = 4;
const SUGGEST_DEBOUNCE_MS = 220;

function loadRecent(): string[] {
    try {
        const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        if (!Array.isArray(parsed)) return [];
        return parsed.map((item) => String(item).trim()).filter(Boolean).slice(0, MAX_RECENT);
    } catch {
        return [];
    }
}

type SpeechRecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    onresult: ((event: {results: ArrayLike<ArrayLike<{transcript: string}>>}) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
    if (typeof window === "undefined") return null;
    const candidate = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export default function UniversalSearchField({
    basePath,
    locale,
    initialQuery = "",
    catalogEntries,
    trending,
    copy,
    autoFocus = false,
    directoryFilterPath
}: UniversalSearchFieldProps) {
    const router = useRouter();
    const [query, setQuery] = useState(initialQuery);
    const [focused, setFocused] = useState(false);
    const [recent, setRecent] = useState<string[]>([]);
    const [showAllRecent, setShowAllRecent] = useState(false);
    const [remote, setRemote] = useState<LocalSuggestion[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [listening, setListening] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

    useEffect(() => {
        setRecent(loadRecent());
        setVoiceSupported(Boolean(getSpeechRecognition()));
    }, []);

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setFocused(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, []);

    // Local suggestions paint immediately; the remote ones arrive behind them.
    const localSuggestions = useMemo(
        () => buildLocalSuggestions(query, catalogEntries),
        [catalogEntries, query]
    );

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setRemote([]);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/animals/search/suggest?q=${encodeURIComponent(trimmed)}&locale=${encodeURIComponent(locale)}`,
                    {signal: controller.signal}
                );
                if (!response.ok) return;
                const payload = (await response.json()) as {
                    suggestions?: Array<{query: string; subtitle: string}>;
                };
                setRemote(
                    (payload.suggestions ?? []).map((item, index) => ({
                        id: `remote:${index}:${item.query}`,
                        title: item.query,
                        subtitle: item.subtitle || "Suggested"
                    }))
                );
            } catch {
                // Aborted or offline: local suggestions still stand.
            }
        }, SUGGEST_DEBOUNCE_MS);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [locale, query]);

    const suggestions = useMemo(() => {
        const merged: LocalSuggestion[] = [];
        const seen = new Set<string>();
        for (const item of [...localSuggestions, ...remote]) {
            const key = normalizeSuggestionQuery(item.title);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            merged.push(item);
        }
        return merged.slice(0, 18);
    }, [localSuggestions, remote]);

    const rememberQuery = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        const normalized = normalizeSuggestionQuery(trimmed);
        const next = [trimmed, ...recent.filter((item) => normalizeSuggestionQuery(item) !== normalized)]
            .slice(0, MAX_RECENT);
        setRecent(next);
        try {
            window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
        } catch {
            // Private mode: recents just don't persist.
        }
    }, [recent]);

    const submit = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        rememberQuery(trimmed);
        setFocused(false);
        setActiveIndex(-1);
        router.push(`${basePath}/search?q=${encodeURIComponent(trimmed)}`);
    }, [basePath, rememberQuery, router]);

    const clearRecent = useCallback(() => {
        setRecent([]);
        setShowAllRecent(false);
        try {
            window.localStorage.removeItem(RECENT_STORAGE_KEY);
        } catch {
            // No-op.
        }
    }, []);

    const toggleVoice = useCallback(() => {
        const Recognition = getSpeechRecognition();
        if (!Recognition) return;

        if (listening) {
            recognitionRef.current?.stop();
            setListening(false);
            return;
        }

        const recognition = new Recognition();
        recognitionRef.current = recognition;
        recognition.lang = locale === "id" ? "id-ID" : "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript?.trim();
            if (transcript) {
                setQuery(transcript);
                submit(transcript);
            }
        };
        recognition.onerror = () => setListening(false);
        recognition.onend = () => setListening(false);
        recognition.start();
        setListening(true);
    }, [listening, locale, submit]);

    const showPanel = focused;
    const visibleRecent = showAllRecent ? recent : recent.slice(0, COLLAPSED_RECENT_LIMIT);
    const showDiscovery = !query.trim();

    return (
        <div ref={containerRef} className="relative">
            <form
                role="search"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit(query);
                }}
                className="relative"
            >
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-ink-400" aria-hidden="true">⌕</span>
                <input
                    ref={inputRef}
                    value={query}
                    autoFocus={autoFocus}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(-1);
                    }}
                    onFocus={() => setFocused(true)}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            setFocused(false);
                        } else if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setFocused(true);
                            setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setActiveIndex((index) => Math.max(index - 1, -1));
                        } else if (event.key === "Enter" && activeIndex >= 0) {
                            event.preventDefault();
                            submit(suggestions[activeIndex].title);
                        }
                    }}
                    placeholder={copy.placeholder}
                    aria-label={copy.searchLabel}
                    className="h-14 w-full rounded-2xl border border-white/12 bg-black/25 pl-12 pr-28 text-base text-white outline-none placeholder:text-ink-400 focus:border-primary-400/60"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    {query ? (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                inputRef.current?.focus();
                            }}
                            aria-label={copy.clearLabel}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-400 transition hover:bg-white/10 hover:text-white"
                        >
                            ✕
                        </button>
                    ) : null}
                    {voiceSupported ? (
                        <button
                            type="button"
                            onClick={toggleVoice}
                            aria-label={listening ? copy.voiceListening : copy.voiceLabel}
                            aria-pressed={listening}
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition ${listening ? "animate-pulse bg-primary-400 text-black" : "text-ink-300 hover:bg-white/10 hover:text-white"}`}
                        >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
                                <path d="M18 11a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.09A6 6 0 0 0 18 11Z" />
                            </svg>
                        </button>
                    ) : null}
                    <button
                        type="submit"
                        className="h-10 rounded-xl bg-primary-400 px-4 text-sm font-bold text-black transition hover:bg-primary-300"
                    >
                        {copy.submit}
                    </button>
                </div>
            </form>

            {showPanel ? (
                <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[28rem] overflow-y-auto rounded-2xl border border-white/12 bg-[#0e1411] p-2 shadow-2xl shadow-black/50">
                    {showDiscovery && recent.length ? (
                        <>
                            <div className="flex items-center justify-between px-3 pb-1 pt-2">
                                <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{copy.recentTitle}</span>
                                <button type="button" onClick={clearRecent} className="text-xs font-black text-primary-300 hover:text-primary-200">
                                    {copy.clearAll}
                                </button>
                            </div>
                            {visibleRecent.map((item) => (
                                <button
                                    key={`recent:${item}`}
                                    type="button"
                                    onClick={() => submit(item)}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
                                >
                                    <span className="text-ink-500" aria-hidden="true">↺</span>
                                    <span className="min-w-0 flex-1 truncate text-sm text-white">{item}</span>
                                </button>
                            ))}
                            {recent.length > COLLAPSED_RECENT_LIMIT && !showAllRecent ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAllRecent(true)}
                                    className="px-3 py-2 text-xs font-bold text-primary-300 hover:text-primary-200"
                                >
                                    {copy.seeMore}
                                </button>
                            ) : null}
                        </>
                    ) : null}

                    {showDiscovery && trending.length ? (
                        <>
                            <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{copy.trendingTitle}</p>
                            {trending.slice(0, 8).map((item) => (
                                <button
                                    key={`trending:${item.query}`}
                                    type="button"
                                    onClick={() => submit(item.query)}
                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
                                >
                                    <span className="text-ink-500" aria-hidden="true">↗</span>
                                    <span className="min-w-0 flex-1 truncate text-sm text-white">{item.query}</span>
                                    {item.isPopular ? (
                                        <span className="shrink-0 rounded-full bg-primary-400/20 px-2 py-0.5 text-[0.65rem] font-black uppercase text-primary-100">
                                            {copy.popularBadge}
                                        </span>
                                    ) : null}
                                </button>
                            ))}
                        </>
                    ) : null}

                    {directoryFilterPath && query.trim() ? (
                        <a
                            href={`${directoryFilterPath}?q=${encodeURIComponent(query.trim())}#all-animals`}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
                        >
                            <span className="text-ink-500" aria-hidden="true">☰</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-white">
                                {copy.filterDirectory.replace("{query}", query.trim())}
                            </span>
                        </a>
                    ) : null}

                    {suggestions.length ? (
                        <>
                            <p className="px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{copy.suggestionsTitle}</p>
                            {suggestions.map((item, index) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => submit(item.title)}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-primary-400/15" : "hover:bg-white/5"}`}
                                >
                                    <span className="text-ink-500" aria-hidden="true">⌕</span>
                                    <span className="min-w-0 flex-1 truncate text-sm text-white">{item.title}</span>
                                    <span className="shrink-0 text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink-500">{item.subtitle}</span>
                                </button>
                            ))}
                        </>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
