"use client";

/**
 * New chat: the animal picker (docs/rich-chat/SPEC.md, section 4.3). The
 * first animals offered (the featured ones, then the ones people talk to
 * most) and "They'll disagree", pairs whose Powers pull apart on one
 * question, both drawn by the server into the page (WEB-18, WEB-24); a search
 * over the whole catalog by common name, whose index loads only once someone
 * searches. Each card is the animal's icon art, its name and its Power; a tap
 * starts its chat. Opened from "Ask another animal", the question rides
 * along into the new chat's composer, ready to send, never sent for them
 * (DECISIONS section 6).
 */

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getLocalePath} from "@/lib/site";
import {onIdle} from "@/lib/on-idle";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {askContextIntentHandlers, prefetchAskContext} from "@/components/ask-animaldex/ask-context-prefetch";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";
import {talkSearch, type TalkAnimal, type TalkDisagreePair, type TalkWords} from "@/lib/ask-animaldex/talk";
import {useTalkShell} from "@/app/[locale]/talk/talk-shell";

type Catalog = {
    animals: TalkAnimal[];
    popular: string[];
    disagree: Array<[string, string]>;
    disagreeTopics?: Array<string | null>;
};

let catalogCache: Promise<Catalog> | null = null;

/** The search index (every animal by name and Power), once per tab; a failure is forgotten so Try again asks again. */
function loadCatalog(): Promise<Catalog> {
    catalogCache ??= fetch("/api/talk/animals", {headers: {Accept: "application/json"}})
        .then((response) => (response.ok ? response.json() as Promise<Catalog> : Promise.reject(new Error(String(response.status)))))
        .catch((error) => {
            catalogCache = null;
            throw error;
        });
    return catalogCache;
}

export default function TalkPicker({words, initial}: {
    words: TalkWords;
    /** The first rows, from the server; empty when the catalog could not be read then. */
    initial: {popular: TalkAnimal[]; disagree: TalkDisagreePair[]};
}) {
    const {openSidebar, locale} = useTalkShell();
    const router = useRouter();
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [catalogState, setCatalogState] = useState<"idle" | "loading" | "ready" | "failed">("idle");
    const [query, setQuery] = useState("");
    // "Ask another animal": the question the last chat was about, from the address.
    const [carried, setCarried] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);

    const fetchCatalog = useCallback(() => {
        setCatalogState("loading");
        void loadCatalog().then((value) => {
            setCatalog(value);
            setCatalogState("ready");
        }).catch(() => setCatalogState("failed"));
    }, []);
    /** The search index, on the first sign of a search (a tap in the field, a key), never on load. */
    const wantCatalog = useCallback(() => {
        if (catalogState === "idle") fetchCatalog();
    }, [catalogState, fetchCatalog]);

    useEffect(() => {
        const ask = new URLSearchParams(window.location.search).get("ask")?.trim();
        setCarried(ask ? ask.slice(0, 900) : null);
        // Rows the server could not draw: read them here instead.
        if (initial.popular.length === 0) fetchCatalog();
    }, [initial.popular.length, fetchCatalog]);
    useEffect(() => {
        const coarse = window.matchMedia?.("(pointer: coarse)").matches;
        if (!coarse) searchRef.current?.focus();
    }, []);
    // Nearly everyone here opens a chat next, and every chat shares one set
    // of scripts: once the picker is idle, one chat page is fetched, which
    // brings those scripts in, so the first tap opens with them already here
    // (a touch comes too late to download them first).
    const firstSlug = initial.popular[0]?.slug ?? null;
    useEffect(() => {
        if (!firstSlug) return;
        return onIdle(() => router.prefetch(getLocalePath(locale, `/talk/${firstSlug}`)), 1200);
    }, [firstSlug, router, locale]);

    const bySlug = useMemo(() => new Map((catalog?.animals ?? []).map((animal) => [animal.slug, animal])), [catalog]);
    const results = useMemo(() => talkSearch(catalog?.animals ?? [], query), [catalog, query]);
    const popular = useMemo(() => (initial.popular.length > 0
        ? initial.popular
        : (catalog?.popular ?? []).map((slug) => bySlug.get(slug)).filter((animal): animal is TalkAnimal => Boolean(animal))), [initial.popular, catalog, bySlug]);
    const pairs = useMemo<TalkDisagreePair[]>(() => (initial.disagree.length > 0
        ? initial.disagree
        : (catalog?.disagree ?? []).flatMap(([left, right], index) => {
            const a = bySlug.get(left);
            const b = bySlug.get(right);
            return a && b ? [{left: a, right: b, topic: catalog?.disagreeTopics?.[index] ?? null}] : [];
        })), [initial.disagree, catalog, bySlug]);
    const href = (animal: TalkAnimal) => `/talk/${animal.slug}${carried ? `?ask=${encodeURIComponent(carried)}` : ""}`;
    const topicText = (topic: string | null) => (topic && topic in words ? words[topic as keyof TalkWords] : null);
    const searching = query.trim().length > 0;
    const firstRowsLoading = popular.length === 0 && catalogState !== "failed";

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3 lg:hidden">
                <button
                    type="button"
                    onClick={openSidebar}
                    aria-label={words.openChats}
                    className="-ml-1.5 grid h-11 w-11 place-items-center rounded-full text-ink-200 hover:bg-white/8 hover:text-white"
                    data-testid="talk-menu"
                >
                    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h9" /></svg>
                </button>
                <p className="text-sm font-semibold text-white">{words.newChat}</p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-8 sm:pt-12" data-testid="talk-picker">
                    <h1 className="font-display text-3xl font-bold leading-9 text-white sm:text-4xl sm:leading-[2.75rem]">{words.pickerTitle}</h1>
                    <p className="mt-2 max-w-[34rem] text-[15px] leading-6 text-ink-300">{words.pickerHint}</p>
                    {carried ? (
                        <div className="ask-special mt-5 flex items-start gap-3 px-4 py-3" style={{borderRadius: 16}} data-testid="talk-carried">
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-300">{words.carried}</p>
                                <p className="mt-0.5 line-clamp-3 text-sm leading-6 text-white">{carried}</p>
                                <p className="mt-1 text-[12px] leading-4 text-ink-300">{words.carriedHint}</p>
                            </div>
                            <button type="button" onClick={() => setCarried(null)} className="-mr-1 shrink-0 rounded-full px-2 py-1.5 text-xs font-semibold text-ink-300 hover:text-white">{words.carriedClear}</button>
                        </div>
                    ) : null}
                    <label className="sr-only" htmlFor="talk-search">{words.searchLabel}</label>
                    <div className="mt-6 flex items-center gap-2 border border-white/12 bg-white/[0.05] px-4 focus-within:border-primary-300/45" style={{borderRadius: 999}}>
                        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-ink-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13.2 13.2 3.3 3.3" /></svg>
                        <input
                            ref={searchRef}
                            id="talk-search"
                            type="search"
                            value={query}
                            onPointerDown={wantCatalog}
                            onKeyDown={wantCatalog}
                            onChange={(event) => {
                                wantCatalog();
                                setQuery(event.target.value);
                            }}
                            placeholder={words.searchPlaceholder}
                            autoComplete="off"
                            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-ink-400"
                            data-testid="talk-search"
                        />
                    </div>
                    {searching ? (
                        <section className="pt-6" aria-live="polite" aria-busy={catalogState === "loading"}>
                            {catalogState === "failed" ? (
                                <LoadFailed words={words} onRetry={fetchCatalog} />
                            ) : catalog === null ? (
                                <AnimalGridSkeleton count={6} />
                            ) : results.length === 0 ? (
                                <p className="text-sm text-ink-300">{words.searchEmpty}</p>
                            ) : (
                                <AnimalGrid animals={results} href={href} />
                            )}
                        </section>
                    ) : (
                        <>
                            <section className="pt-8" aria-busy={firstRowsLoading}>
                                <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{words.popular}</h2>
                                <div className="pt-3">
                                    {popular.length > 0
                                        ? <AnimalGrid animals={popular} href={href} />
                                        : catalogState === "failed"
                                            ? <LoadFailed words={words} onRetry={fetchCatalog} />
                                            : <AnimalGridSkeleton count={6} />}
                                </div>
                            </section>
                            {pairs.length > 0 ? (
                                <section className="pt-9" data-testid="talk-disagree">
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{words.disagree}</h2>
                                    <p className="mt-1 text-[13px] text-ink-300">{words.disagreeHint}</p>
                                    <div className="mt-3 grid gap-2.5">
                                        {pairs.map((pair) => (
                                            <div key={`${pair.left.slug}-${pair.right.slug}`} className="border border-white/10 bg-white/[0.02] p-1.5" style={{borderRadius: 16}}>
                                                {topicText(pair.topic) ? (
                                                    <p className="px-2 pb-1.5 pt-1 text-[13px] font-semibold text-white">{topicText(pair.topic)}</p>
                                                ) : null}
                                                <div className="flex items-stretch gap-1.5">
                                                    <AnimalCard animal={pair.left} href={href(pair.left)} compact />
                                                    <span aria-hidden="true" className="grid w-5 shrink-0 place-items-center text-xs font-black text-ink-400">↔</span>
                                                    <AnimalCard animal={pair.right} href={href(pair.right)} compact />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ) : null}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function LoadFailed({words, onRetry}: {words: TalkWords; onRetry: () => void}) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" role="alert" data-testid="talk-load-failed">
            <p className="text-sm text-ink-200">{words.loadFailed}</p>
            <button type="button" onClick={onRetry} className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-4 text-xs font-bold text-white transition-colors hover:border-primary-300/45">
                {words.tryAgain}
            </button>
        </div>
    );
}

function AnimalGrid({animals, href}: {animals: TalkAnimal[]; href: (animal: TalkAnimal) => string}) {
    return (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {animals.map((animal) => <AnimalCard key={animal.slug} animal={animal} href={href(animal)} />)}
        </div>
    );
}

/** Cards the size of the real ones while the animals arrive: shimmer, never a word "Loading…". */
function AnimalGridSkeleton({count}: {count: number}) {
    return (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-hidden="true" data-testid="talk-skeleton">
            {Array.from({length: count}, (_, index) => (
                <div key={index} className="flex items-center gap-2.5 border border-white/[0.06] bg-white/[0.025] px-2.5 py-2.5 sm:gap-3 sm:px-3 sm:py-3" style={{borderRadius: 14}}>
                    <span className="h-10 w-10 shrink-0 rounded-full bg-white/[0.07] motion-safe:animate-pulse" />
                    <span className="min-w-0 flex-1">
                        <span className="block h-3.5 w-3/4 rounded-full bg-white/[0.07] motion-safe:animate-pulse" />
                        <span className="mt-2 block h-2.5 w-1/2 rounded-full bg-white/[0.05] motion-safe:animate-pulse" />
                    </span>
                </div>
            ))}
        </div>
    );
}

function AnimalCard({animal, href, compact = false}: {animal: TalkAnimal; href: string; compact?: boolean}) {
    const {locale} = useTalkShell();
    // Intent on a card starts its chat's context read, so the chat opens with it in flight (the link prefetches its page the same way).
    const intent = useMemo(() => askContextIntentHandlers(() => prefetchAskContext(locale, animal.slug, animal.name)), [locale, animal.slug, animal.name]);
    return (
        <Link
            href={href}
            {...intent}
            className={`flex min-w-0 flex-1 items-center gap-2.5 border border-white/10 bg-white/[0.035] transition-colors hover:border-primary-300/40 hover:bg-white/[0.06] sm:gap-3 ${compact ? "min-h-[52px] px-2.5 py-2" : "min-h-[60px] px-2.5 py-2.5 sm:px-3 sm:py-3"}`}
            style={{borderRadius: 14}}
            data-testid="talk-animal"
        >
            <AskAnimalFace url={animal.icon ?? (animal.iconFile ? getSpeciesArtworkUrl(animal.slug, animal.iconFile) : getSpeciesImageRoute(animal.slug))} size={compact ? 36 : 40} />
            <span className="min-w-0 flex-1">
                <span className="line-clamp-2 block text-[14px] font-semibold leading-5 text-white">{animal.name}</span>
                {animal.power ? <span className="line-clamp-2 block text-[12px] leading-4 text-ink-300">{animal.power}</span> : null}
            </span>
        </Link>
    );
}
