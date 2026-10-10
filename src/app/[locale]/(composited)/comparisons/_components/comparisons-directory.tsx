"use client";

import {type FormEvent, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState} from "react";
import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import BattleAvatar from "@/app/[locale]/(composited)/comparisons/_components/battle-avatar";

export type ComparisonSort = "popular" | "newest" | "az";
export type QuickCategory = "popular" | "battles" | "predators" | "reptiles" | "mammals" | "birds" | "marine" | "venomous" | "fastest" | "defence" | "strength";

/** One comparison card, reduced server-side to what the directory needs. */
export type DirectoryCard = {
    slug: string;
    title: string;
    comparisonType: string;
    typeLabel: string;
    winnerLabel: string;
    image: {src: string; alt: string; width: number; height: number};
    statLabels: string[];
    /** Lower-cased text the search box matches against. */
    search: string;
    /** Quick categories this card belongs to ("popular" is implied). */
    quick: QuickCategory[];
    popularity: number;
    date: string;
    speciesSlugs: string[];
    /** Newest player Arena battle on this pair, if any. */
    battle?: {
        players: Array<{name: string; avatarUrl: string | null; won: boolean}>;
        credits: number;
        count: number;
    };
};

type DirectoryState = {
    query: string;
    comparisonType: string;
    animal: string;
    sort: ComparisonSort;
    quick: QuickCategory;
    page: number;
};

type Option = {value: string; label: string};

type ComparisonsDirectoryProps = {
    cards: DirectoryCard[];
    featuredSlug: string | null;
    /** Server-rendered featured banner, shown only on the unfiltered first page. */
    featured: ReactNode;
    /** Server-rendered sidebar beside the results. */
    aside: ReactNode;
    quickCategories: Array<{key: QuickCategory; icon: string; label: string}>;
    typeOptions: Option[];
    animalOptions: Option[];
    pageSize: number;
    copy: {
        quickFiltersLabel: string;
        searchLabel: string;
        searchPlaceholder: string;
        comparisonTypeLabel: string;
        allTypes: string;
        animalLabel: string;
        allAnimals: string;
        sortLabel: string;
        sorts: Record<ComparisonSort, string>;
        applyFilters: string;
        clearFilters: string;
        libraryLabel: string;
        /** Contains "{count}". */
        resultsFound: string;
        noResultsTitle: string;
        noResultsDescription: string;
        paginationLabel: string;
        previousPage: string;
        nextPage: string;
        openComparison: string;
        /** Contains "{count}". */
        battleCreditsWon: string;
        /** Contains "{count}". */
        battleMore: string;
    };
};

const DEFAULT_STATE: DirectoryState = {query: "", comparisonType: "all", animal: "all", sort: "popular", quick: "popular", page: 1};
const SORTS: ComparisonSort[] = ["popular", "newest", "az"];

function stateFromSearch(search: string, quickKeys: QuickCategory[]): DirectoryState {
    const params = new URLSearchParams(search);
    const sort = params.get("sort") as ComparisonSort | null;
    const quick = params.get("quick") as QuickCategory | null;
    const page = Number.parseInt(params.get("page") ?? "1", 10);
    return {
        query: params.get("q") ?? "",
        comparisonType: params.get("type") || "all",
        animal: params.get("animal") || "all",
        sort: sort && SORTS.includes(sort) ? sort : "popular",
        quick: quick && quickKeys.includes(quick) ? quick : "popular",
        page: Number.isFinite(page) && page > 0 ? page : 1
    };
}

function searchFromState(state: DirectoryState) {
    const params = new URLSearchParams();
    if (state.query.trim()) params.set("q", state.query.trim());
    if (state.comparisonType !== "all") params.set("type", state.comparisonType);
    if (state.animal !== "all") params.set("animal", state.animal);
    if (state.sort !== "popular") params.set("sort", state.sort);
    if (state.quick !== "popular") params.set("quick", state.quick);
    if (state.page > 1) params.set("page", String(state.page));
    const query = params.toString();
    return query ? `?${query}` : "";
}

function getPageNumbers(currentPage: number, totalPages: number) {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({length: end - start + 1}, (_, index) => start + index);
}

/**
 * The /comparisons library. The hub is a static page (no searchParams, see
 * public-route-architecture.test.ts), so paging and filtering run here, in the
 * browser, over every published comparison. The URL query is kept in sync so
 * links like ?page=3 or ?quick=reptiles still land on the right view.
 */
export default function ComparisonsDirectory({
    cards,
    featuredSlug,
    featured,
    aside,
    quickCategories,
    typeOptions,
    animalOptions,
    pageSize,
    copy
}: ComparisonsDirectoryProps) {
    const quickKeys = useMemo(() => quickCategories.map((category) => category.key), [quickCategories]);
    const [state, setState] = useState<DirectoryState>(DEFAULT_STATE);
    const [queryDraft, setQueryDraft] = useState("");
    const libraryRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const sync = () => {
            const next = stateFromSearch(window.location.search, quickKeys);
            setState(next);
            setQueryDraft(next.query);
        };
        sync();
        window.addEventListener("popstate", sync);
        return () => window.removeEventListener("popstate", sync);
    }, [quickKeys]);

    const update = (patch: Partial<DirectoryState>, options: {scroll?: boolean} = {}) => {
        const next = {...state, ...patch};
        setState(next);
        window.history.pushState(null, "", `${window.location.pathname}${searchFromState(next)}`);
        if (options.scroll) {
            libraryRef.current?.scrollIntoView({behavior: "smooth", block: "start"});
        }
    };

    const directory = useMemo(() => {
        const query = state.query.trim().toLowerCase();
        const filtered = cards.filter((card) => {
            if (state.comparisonType !== "all" && card.comparisonType !== state.comparisonType) return false;
            if (state.animal !== "all" && !card.speciesSlugs.includes(state.animal)) return false;
            if (state.quick !== "popular" && !card.quick.includes(state.quick)) return false;
            return !query || card.search.includes(query);
        });
        filtered.sort((left, right) => {
            if (state.sort === "az") return left.title.localeCompare(right.title);
            if (state.sort === "newest") return right.date.localeCompare(left.date) || left.title.localeCompare(right.title);
            return right.popularity - left.popularity || left.title.localeCompare(right.title);
        });
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const currentPage = Math.min(Math.max(1, state.page), totalPages);
        const start = (currentPage - 1) * pageSize;
        return {entries: filtered.slice(start, start + pageSize), total: filtered.length, totalPages, currentPage};
    }, [cards, pageSize, state]);

    const showFeatured = Boolean(featuredSlug) && directory.currentPage === 1 && !state.query.trim()
        && state.comparisonType === "all" && state.animal === "all" && state.quick === "popular";
    const gridEntries = showFeatured ? directory.entries.filter((card) => card.slug !== featuredSlug) : directory.entries;

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        update({query: queryDraft, page: 1});
    };
    const clear = () => {
        setQueryDraft("");
        update({...DEFAULT_STATE});
    };
    const pageHref = (page: number) => searchFromState({...state, page}) || "?";
    const goToPage = (event: MouseEvent<HTMLAnchorElement>, page: number) => {
        event.preventDefault();
        update({page}, {scroll: true});
    };

    const pillClass = "rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-200 hover:border-white/25 hover:text-white";

    return (
        <>
            {showFeatured ? featured : null}

            <nav aria-label={copy.quickFiltersLabel} className="mt-9 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {quickCategories.map((category) => {
                    const active = state.quick === category.key;
                    return (
                        <button
                            key={category.key}
                            type="button"
                            onClick={() => update({quick: category.key, page: 1})}
                            aria-pressed={active}
                            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-primary-400/60 bg-primary-400/15 text-primary-100" : "border-white/10 bg-white/[0.035] text-ink-200 hover:border-white/25 hover:text-white"}`}
                        >
                            <span className="mr-2" aria-hidden="true">{category.icon}</span>{category.label}
                        </button>
                    );
                })}
            </nav>

            <div className="sticky top-3 z-30 mt-4  border border-white/10 bg-[#111713]/90 p-2 shadow-xl shadow-black/20 backdrop-blur-xl light:bg-surface-900/90 light:shadow-black/5 md:top-5">
                <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-[minmax(14rem,1.4fr)_repeat(3,minmax(9rem,0.65fr))_auto_auto]">
                    <label className="relative">
                        <span className="sr-only">{copy.searchLabel}</span>
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden="true">⌕</span>
                        <input name="q" value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder={copy.searchPlaceholder} className="h-11 w-full rounded-xl border border-transparent bg-black/20 light:bg-surface-800 pl-10 pr-4 text-sm text-white outline-none placeholder:text-ink-400 focus:border-primary-400/60" />
                    </label>
                    <label>
                        <span className="sr-only">{copy.comparisonTypeLabel}</span>
                        <select name="type" value={state.comparisonType} onChange={(event) => update({comparisonType: event.target.value, page: 1})} className="h-11 w-full rounded-xl border border-transparent bg-black/20 light:bg-surface-800 px-3 text-sm text-white outline-none focus:border-primary-400/60">
                            <option value="all">{copy.allTypes}</option>
                            {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="sr-only">{copy.animalLabel}</span>
                        <select name="animal" value={state.animal} onChange={(event) => update({animal: event.target.value, page: 1})} className="h-11 w-full rounded-xl border border-transparent bg-black/20 light:bg-surface-800 px-3 text-sm text-white outline-none focus:border-primary-400/60">
                            <option value="all">{copy.allAnimals}</option>
                            {animalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                    </label>
                    <label>
                        <span className="sr-only">{copy.sortLabel}</span>
                        <select name="sort" value={state.sort} onChange={(event) => update({sort: event.target.value as ComparisonSort, page: 1})} className="h-11 w-full rounded-xl border border-transparent bg-black/20 light:bg-surface-800 px-3 text-sm text-white outline-none focus:border-primary-400/60">
                            {SORTS.map((sort) => <option key={sort} value={sort}>{copy.sorts[sort]}</option>)}
                        </select>
                    </label>
                    <button type="submit" className="h-11 rounded-xl bg-primary-400 px-5 text-sm font-bold text-black transition hover:bg-primary-300">{copy.applyFilters}</button>
                    <button type="button" onClick={clear} className="flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-ink-300 transition hover:bg-white/5 hover:text-white">{copy.clearFilters}</button>
                </form>
            </div>

            <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_17rem]">
            <section ref={libraryRef} className="scroll-mt-24">
                <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-400">{copy.libraryLabel}</p>
                        <h2 className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">{copy.resultsFound.replace("{count}", directory.total.toLocaleString())}</h2>
                    </div>
                </div>

                {gridEntries.length ? (
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
                        {gridEntries.map((card, index) => {
                            const wide = index % 6 === 0;
                            return (
                                <article key={card.slug} className={`group overflow-hidden  border border-white/10 bg-white/[0.035] transition duration-300 hover:-translate-y-1 hover:border-primary-400/35 hover:shadow-[0_20px_50px_rgba(0,0,0,0.32)] ${wide ? "md:col-span-12 xl:col-span-8" : "md:col-span-6 xl:col-span-4"}`}>
                                    <Link href={`/comparisons/${card.slug}`} className="theme-dark relative block overflow-hidden">
                                        <Image src={card.image.src} alt={card.image.alt} width={card.image.width} height={card.image.height} sizes={wide ? "(min-width:1280px) 60vw, 100vw" : "(min-width:1280px) 30vw, (min-width:768px) 50vw, 100vw"} className={`w-full object-cover transition-transform duration-700 group-hover:scale-105 ${wide ? "h-72 md:h-96" : "h-64 md:h-72"}`} />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/5 to-black/30" />
                                        <span className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-white backdrop-blur">{card.typeLabel}</span>
                                        <span className="absolute right-4 top-4 rounded-full bg-primary-400/90 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-black">{card.winnerLabel}</span>
                                        {card.battle ? (
                                            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
                                                {/* The artwork carries its own VS; the players flank it. */}
                                                <div className={`flex items-center ${wide ? "gap-24" : "gap-16"}`}>
                                                    <BattleAvatar name={card.battle.players[0].name} avatarUrl={card.battle.players[0].avatarUrl} size={wide ? 64 : 52} winner={card.battle.players[0].won} />
                                                    <BattleAvatar name={card.battle.players[1].name} avatarUrl={card.battle.players[1].avatarUrl} size={wide ? 64 : 52} winner={card.battle.players[1].won} />
                                                </div>
                                                <span className="sr-only">{card.battle.players[0].name} vs {card.battle.players[1].name}</span>
                                                {card.battle.credits > 0 ? (
                                                    <span className="whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-primary-100 backdrop-blur">
                                                        {copy.battleCreditsWon.replace("{count}", String(card.battle.credits))}
                                                        {card.battle.count > 1 ? <span className="ml-1.5 text-ink-300">{copy.battleMore.replace("{count}", String(card.battle.count - 1))}</span> : null}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-5xl font-black italic tracking-[-0.08em] text-white/90 drop-shadow-xl" aria-hidden="true">VS</span>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                                            <h3 className={`font-display font-bold leading-tight text-white ${wide ? "text-3xl md:text-4xl" : "text-2xl"}`}>{card.title}</h3>
                                        </div>
                                    </Link>
                                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                                        <div className="flex min-w-0 gap-3 overflow-hidden text-xs font-semibold uppercase tracking-[0.12em] text-ink-300">
                                            {card.statLabels.map((label) => <span key={label} className="truncate">{label}</span>)}
                                        </div>
                                        <span className="shrink-0 text-sm font-bold text-primary-200 transition group-hover:translate-x-0.5">{copy.openComparison} →</span>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="  border border-white/10 bg-white/[0.035] px-6 py-14 text-center">
                        <h2 className="font-display text-3xl font-bold text-white">{copy.noResultsTitle}</h2>
                        <p className="mt-3 text-ink-200">{copy.noResultsDescription}</p>
                        <button type="button" onClick={clear} className="mt-6 inline-flex rounded-full bg-primary-400 px-5 py-3 text-sm font-bold text-black">{copy.clearFilters}</button>
                    </div>
                )}

                {directory.totalPages > 1 ? (
                    <nav aria-label={copy.paginationLabel} className="mt-9 flex flex-wrap items-center justify-center gap-2">
                        {directory.currentPage > 1 ? <a href={pageHref(directory.currentPage - 1)} onClick={(event) => goToPage(event, directory.currentPage - 1)} className={pillClass}>{copy.previousPage}</a> : null}
                        {getPageNumbers(directory.currentPage, directory.totalPages).map((page) => (
                            <a
                                key={page}
                                href={pageHref(page)}
                                onClick={(event) => goToPage(event, page)}
                                aria-current={page === directory.currentPage ? "page" : undefined}
                                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${page === directory.currentPage ? "bg-primary-400 text-black" : "border border-white/10 text-ink-200 hover:border-white/25 hover:text-white"}`}
                            >
                                {page}
                            </a>
                        ))}
                        {directory.currentPage < directory.totalPages ? <a href={pageHref(directory.currentPage + 1)} onClick={(event) => goToPage(event, directory.currentPage + 1)} className={pillClass}>{copy.nextPage}</a> : null}
                    </nav>
                ) : null}
            </section>
            {aside}
            </div>
        </>
    );
}
