"use client";

/**
 * New chat: the animal picker (docs/rich-chat/SPEC.md, section 4.3). A
 * search over the whole catalog by common name; the popular animals; and
 * "They'll disagree", pairs the catalog itself says pull opposite ways. Each
 * card is the animal's icon art, its name and its Power; a tap starts its
 * chat. Opened from "Ask another animal", the question rides along and is
 * the new chat's first message.
 */

import {useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {talkSearch, type TalkAnimal, type TalkWords} from "@/lib/ask-animaldex/talk";
import {useTalkShell} from "@/app/[locale]/talk/talk-shell";

type Catalog = {animals: TalkAnimal[]; popular: string[]; disagree: Array<[string, string]>};

let catalogCache: Promise<Catalog> | null = null;

function loadCatalog(): Promise<Catalog> {
    catalogCache ??= fetch("/api/talk/animals", {headers: {Accept: "application/json"}})
        .then((response) => (response.ok ? response.json() as Promise<Catalog> : Promise.reject(new Error(String(response.status)))))
        .catch((error) => {
            catalogCache = null;
            throw error;
        });
    return catalogCache;
}

export default function TalkPicker({words}: {words: TalkWords}) {
    const {openSidebar} = useTalkShell();
    const [catalog, setCatalog] = useState<Catalog | null>(null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState("");
    // "Ask another animal": the question the last chat was about, from the address.
    const [carried, setCarried] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        const ask = new URLSearchParams(window.location.search).get("ask")?.trim();
        setCarried(ask ? ask.slice(0, 900) : null);
        let cancelled = false;
        void loadCatalog().then((value) => {
            if (!cancelled) setCatalog(value);
        }).catch(() => {
            if (!cancelled) setFailed(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        const coarse = window.matchMedia?.("(pointer: coarse)").matches;
        if (!coarse) searchRef.current?.focus();
    }, []);

    const bySlug = useMemo(() => new Map((catalog?.animals ?? []).map((animal) => [animal.slug, animal])), [catalog]);
    const results = useMemo(() => talkSearch(catalog?.animals ?? [], query), [catalog, query]);
    const popular = useMemo(() => (catalog?.popular ?? []).map((slug) => bySlug.get(slug)).filter((animal): animal is TalkAnimal => Boolean(animal)), [catalog, bySlug]);
    const pairs = useMemo(() => (catalog?.disagree ?? [])
        .map(([left, right]) => [bySlug.get(left), bySlug.get(right)] as const)
        .filter((pair): pair is readonly [TalkAnimal, TalkAnimal] => Boolean(pair[0] && pair[1])), [catalog, bySlug]);
    const href = (animal: TalkAnimal) => `/talk/${animal.slug}${carried ? `?ask=${encodeURIComponent(carried)}` : ""}`;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-3 lg:hidden">
                <button
                    type="button"
                    onClick={openSidebar}
                    aria-label={words.openChats}
                    className="-ml-1.5 grid h-9 w-9 place-items-center rounded-full text-ink-200 hover:bg-white/8 hover:text-white"
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
                        <div className="mt-5 flex items-start gap-3 border-y border-primary-400/20 bg-primary-400/[0.06] px-4 py-3" style={{boxShadow: "inset 3px 0 0 var(--ask-special-edge)"}} data-testid="talk-carried">
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary-300">{words.carried}</p>
                                <p className="mt-0.5 line-clamp-3 text-sm leading-6 text-white">{carried}</p>
                            </div>
                            <button type="button" onClick={() => setCarried(null)} className="shrink-0 text-xs font-semibold text-ink-300 hover:text-white">{words.carriedClear}</button>
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
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={words.searchPlaceholder}
                            autoComplete="off"
                            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-ink-400"
                            data-testid="talk-search"
                        />
                    </div>
                    {query.trim() ? (
                        <section className="pt-6" aria-live="polite">
                            {catalog === null ? <p className="text-sm text-ink-400">{failed ? words.searchEmpty : words.loading}</p> : results.length === 0 ? (
                                <p className="text-sm text-ink-300">{words.searchEmpty}</p>
                            ) : (
                                <AnimalGrid animals={results} href={href} />
                            )}
                        </section>
                    ) : (
                        <>
                            <section className="pt-8">
                                <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{words.popular}</h2>
                                {catalog === null ? <p className="pt-3 text-sm text-ink-400">{failed ? "" : words.loading}</p> : <div className="pt-3"><AnimalGrid animals={popular} href={href} /></div>}
                            </section>
                            {pairs.length > 0 ? (
                                <section className="pt-9" data-testid="talk-disagree">
                                    <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{words.disagree}</h2>
                                    <p className="mt-1 text-[13px] text-ink-300">{words.disagreeHint}</p>
                                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                                        {pairs.map(([left, right]) => (
                                            <div key={`${left.slug}-${right.slug}`} className="flex items-stretch gap-1.5 border border-white/10 bg-white/[0.02] p-1.5" style={{borderRadius: 16}}>
                                                <AnimalCard animal={left} href={href(left)} compact />
                                                <span aria-hidden="true" className="grid w-5 shrink-0 place-items-center text-xs font-black text-primary-300/80">↔</span>
                                                <AnimalCard animal={right} href={href(right)} compact />
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

function AnimalGrid({animals, href}: {animals: TalkAnimal[]; href: (animal: TalkAnimal) => string}) {
    return (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {animals.map((animal) => <AnimalCard key={animal.slug} animal={animal} href={href(animal)} />)}
        </div>
    );
}

function AnimalCard({animal, href, compact = false}: {animal: TalkAnimal; href: string; compact?: boolean}) {
    return (
        <Link
            href={href}
            className={`flex min-w-0 flex-1 items-center gap-3 border border-white/10 bg-white/[0.035] transition-colors hover:border-primary-300/40 hover:bg-white/[0.06] ${compact ? "px-2.5 py-2" : "px-3 py-3"}`}
            style={{borderRadius: 14}}
            data-testid="talk-animal"
        >
            <AskAnimalFace url={getSpeciesImageRoute(animal.slug)} size={compact ? 36 : 44} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold leading-5 text-white">{animal.name}</span>
                {animal.power ? <span className="block truncate text-[12px] leading-4 text-primary-300/90">{animal.power}</span> : null}
            </span>
        </Link>
    );
}
