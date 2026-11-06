"use client";

/**
 * New chat: the animal picker (docs/rich-chat/SPEC.md, section 4.3). The
 * first animals offered (the featured ones, then the ones people talk to
 * most) and "They'll disagree", pairs whose Powers pull apart on one
 * question, both drawn by the server into the page (WEB-18, WEB-24); a search
 * over the whole catalog by common name, whose index loads only once someone
 * searches. Each card is a tile: the animal's icon art at 56, its name and
 * its Power, two to a row on a phone and four on a desktop, no paragraphs
 * (polish pass, DESIGN.md section 3); a tap starts its chat. Opened from
 * "Ask another animal", the question rides along into the new chat's
 * composer, ready to send, never sent for them (DECISIONS section 6).
 *
 * With the remote switch `talk_front_door` on, the Talk front door is above
 * it all (AnimalDex docs/talk-front-door/SPEC.md, sections 4.1 and 4.6): a
 * full-width band, "What's on your mind?". Signed in, it chooses among their
 * animals (and wild ones while they have fewer than 5); a guest's goes to
 * the first featured animal, Change offers the featured ones, and nothing
 * asks a model for them. The picker stays under it for browsing. Off, the
 * page is exactly as before.
 */

import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
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
import {useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";
import {useAppFeatureFlag} from "@/components/use-app-feature-flag";
import TalkFrontDoorBand from "@/components/talk-front-door/talk-front-door-band";
import {useFrontDoorOwnAnimals} from "@/components/talk-front-door/use-front-door-animals";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {featuredFrontDoorAnimal, type TalkFrontDoorWords} from "@/lib/talk-front-door";

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

/** Two tiles to a row on a phone, three on a tablet, four on a desktop. */
const GRID = "grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4";

/** A section's label: 36 tall, 11 px capitals, tertiary. */
function SectionLabel({children}: {children: ReactNode}) {
    return <h2 className="flex h-9 items-center text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">{children}</h2>;
}

/**
 * The Talk front door above the picker. Signed in (the session, or its
 * cookie before the session has been read), their animals; a guest, the
 * featured ones only.
 */
function TalkFrontDoor({words, featured}: {words: TalkFrontDoorWords; featured: TalkAnimal[]}) {
    const {locale, labels} = useTalkShell();
    const {session} = useHeaderAuth();
    const [cookieSignedIn, setCookieSignedIn] = useState(false);
    useEffect(() => setCookieSignedIn(requestHasSupabaseAuthCookie(document.cookie)), []);
    const signedIn = Boolean(session.user) || cookieSignedIn;
    const {animals} = useFrontDoorOwnAnimals(signedIn, labels.companions);
    const meetOneNow = useMemo(() => featured.map(featuredFrontDoorAnimal), [featured]);
    return (
        <div className="shrink-0 border-b border-white/10 px-4 py-3" data-testid="talk-front-door-band">
            <TalkFrontDoorBand
                words={words}
                surface="talk"
                locale={locale}
                signedIn={signedIn}
                own={signedIn ? animals : []}
                meetOneNow={meetOneNow}
                className="mx-auto w-full max-w-[728px]"
            />
        </div>
    );
}

export default function TalkPicker({words, initial, frontDoor = null}: {
    words: TalkWords;
    /** The first rows, from the server; empty when the catalog could not be read then. */
    initial: {popular: TalkAnimal[]; disagree: TalkDisagreePair[]};
    /** The Talk front door: its switch as the page was drawn, and its words. */
    frontDoor?: {enabled: boolean; words: TalkFrontDoorWords} | null;
}) {
    const {openSidebar, locale} = useTalkShell();
    const frontDoorOn = useAppFeatureFlag("talk_front_door", frontDoor?.enabled ?? false) && frontDoor !== null;
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
    // The search takes the keyboard on a desktop; under the front door it waits, since the box is the way in.
    const searchFocusesFirst = useRef(!frontDoor?.enabled);
    useEffect(() => {
        const coarse = window.matchMedia?.("(pointer: coarse)").matches;
        if (!coarse && searchFocusesFirst.current) searchRef.current?.focus();
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
            <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2 lg:hidden">
                <button
                    type="button"
                    onClick={openSidebar}
                    aria-label={words.openChats}
                    className="-ml-1.5 grid h-11 w-11 place-items-center rounded-full text-ink-200 transition-colors hover:bg-white/8 hover:text-white active:bg-white/12"
                    data-testid="talk-menu"
                >
                    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true"><path d="M3.5 6h13M3.5 10h13M3.5 14h9" /></svg>
                </button>
                <p className="text-[15px] font-semibold leading-5 text-white">{words.newChat}</p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {frontDoorOn && frontDoor ? <TalkFrontDoor words={frontDoor.words} featured={popular} /> : null}
                <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-6 sm:pt-10" data-testid="talk-picker">
                    {/* The question alone: the faces and their Powers under it say the rest (visual first, no noise). */}
                    <h1 className="font-display text-[24px] font-bold leading-8 text-white sm:text-[28px] sm:leading-9">{words.pickerTitle}</h1>
                    {carried ? (
                        <div className="ask-special mt-4 flex items-start gap-3 rounded-card px-4 py-3" data-testid="talk-carried">
                            <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-black uppercase leading-4 tracking-[0.12em] text-primary-300">{words.carried}</p>
                                <p className="mt-0.5 line-clamp-3 text-[15px] leading-6 text-white">{carried}</p>
                            </div>
                            <button type="button" onClick={() => setCarried(null)} className="-mr-1 inline-flex min-h-8 shrink-0 items-center rounded-pill px-2 text-[13px] font-semibold text-ink-300 transition-colors hover:text-white active:opacity-70">{words.carriedClear}</button>
                        </div>
                    ) : null}
                    <label className="sr-only" htmlFor="talk-search">{words.searchLabel}</label>
                    <div className="mt-4 flex h-12 items-center gap-2 rounded-pill border border-white/12 bg-white/[0.05] px-4 transition-colors focus-within:border-primary-300/45">
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
                            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-ink-400"
                            data-testid="talk-search"
                        />
                    </div>
                    {searching ? (
                        <section className="pt-4" aria-live="polite" aria-busy={catalogState === "loading"}>
                            {catalogState === "failed" ? (
                                <LoadFailed words={words} onRetry={fetchCatalog} />
                            ) : catalog === null ? (
                                <AnimalGridSkeleton count={8} />
                            ) : results.length === 0 ? (
                                <p className="text-[13px] leading-[18px] text-ink-300">{words.searchEmpty}</p>
                            ) : (
                                <AnimalGrid animals={results} href={href} />
                            )}
                        </section>
                    ) : (
                        <>
                            <section className="pt-4" aria-busy={firstRowsLoading}>
                                <SectionLabel>{words.popular}</SectionLabel>
                                {popular.length > 0
                                    ? <AnimalGrid animals={popular} href={href} />
                                    : catalogState === "failed"
                                        ? <LoadFailed words={words} onRetry={fetchCatalog} />
                                        : <AnimalGridSkeleton count={8} />}
                            </section>
                            {pairs.length > 0 ? (
                                <section className="pt-6" data-testid="talk-disagree">
                                    <SectionLabel>{words.disagree}</SectionLabel>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {pairs.map((pair) => (
                                            // One bordered card; the two tiles inside lose their borders (no double borders).
                                            <div key={`${pair.left.slug}-${pair.right.slug}`} className="rounded-card border border-white/10 bg-white/[0.02] p-1.5">
                                                {topicText(pair.topic) ? (
                                                    <p className="px-2 pb-1.5 pt-1 text-[13px] font-semibold leading-[18px] text-white">{topicText(pair.topic)}</p>
                                                ) : null}
                                                <div className="flex items-stretch gap-1.5">
                                                    <AnimalCard animal={pair.left} href={href(pair.left)} inset />
                                                    <span aria-hidden="true" className="grid w-4 shrink-0 place-items-center text-[13px] font-black text-ink-400">↔</span>
                                                    <AnimalCard animal={pair.right} href={href(pair.right)} inset />
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
            <p className="text-[13px] leading-[18px] text-ink-200">{words.loadFailed}</p>
            <button type="button" onClick={onRetry} className="inline-flex min-h-9 items-center rounded-pill border border-white/15 px-4 text-[13px] font-bold text-white transition-colors hover:border-primary-300/45 active:bg-white/10">
                {words.tryAgain}
            </button>
        </div>
    );
}

function AnimalGrid({animals, href}: {animals: TalkAnimal[]; href: (animal: TalkAnimal) => string}) {
    return (
        // The tiles fade in once, when the grid first mounts (DESIGN.md section 4).
        <div className={`${GRID} rows-in`}>
            {animals.map((animal) => <AnimalCard key={animal.slug} animal={animal} href={href(animal)} />)}
        </div>
    );
}

/** Tiles the size of the real ones while the animals arrive: shimmer, never a word "Loading…". */
function AnimalGridSkeleton({count}: {count: number}) {
    return (
        <div className={GRID} aria-hidden="true" data-testid="talk-skeleton">
            {Array.from({length: count}, (_, index) => (
                <div key={index} className="flex min-h-[9.5rem] flex-col items-center rounded-card border border-white/[0.06] bg-white/[0.025] px-3 pb-3.5 pt-4">
                    <span className="h-14 w-14 shrink-0 rounded-full bg-white/[0.07] motion-safe:animate-pulse" />
                    <span className="mt-3 block h-3.5 w-3/4 rounded-full bg-white/[0.07] motion-safe:animate-pulse" />
                    <span className="mt-2 block h-3 w-1/2 rounded-full bg-white/[0.05] motion-safe:animate-pulse" />
                </div>
            ))}
        </div>
    );
}

/**
 * One tile: the art at 56, the name, its Power. `inset` inside a bordered
 * pair card: the wash without a border of its own.
 */
function AnimalCard({animal, href, inset = false}: {animal: TalkAnimal; href: string; inset?: boolean}) {
    const {locale} = useTalkShell();
    // Intent on a card starts its chat's context read, so the chat opens with it in flight (the link prefetches its page the same way).
    const intent = useMemo(() => askContextIntentHandlers(() => prefetchAskContext(locale, animal.slug, animal.name)), [locale, animal.slug, animal.name]);
    return (
        <Link
            href={href}
            {...intent}
            className={`flex min-h-[9.5rem] min-w-0 flex-1 flex-col items-center rounded-card px-3 pb-3.5 pt-4 text-center transition-colors active:bg-white/[0.09] ${
                inset ? "bg-white/[0.03] hover:bg-white/[0.06]" : "border border-white/10 bg-white/[0.035] hover:border-primary-300/40 hover:bg-white/[0.06]"
            }`}
            data-testid="talk-animal"
        >
            <AskAnimalFace url={animal.icon ?? (animal.iconFile ? getSpeciesArtworkUrl(animal.slug, animal.iconFile) : getSpeciesImageRoute(animal.slug))} size={56} />
            <span className="mt-2.5 line-clamp-2 w-full text-[15px] font-semibold leading-5 text-white">{animal.name}</span>
            {animal.power ? <span className="mt-0.5 line-clamp-2 w-full text-[13px] leading-[18px] text-ink-300">{animal.power}</span> : null}
        </Link>
    );
}
