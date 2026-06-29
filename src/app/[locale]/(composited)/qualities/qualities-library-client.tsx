"use client";

import {useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";

export type PrincipleCategory = "focus" | "social" | "survival" | "movement" | "protection" | "learning" | "emotion" | "creativity";

export type PrincipleLibraryItem = {
    principle: string;
    principleSlug: string;
    description: string;
    sampleMotto: string;
    linkedAnimalCount: number;
    categories: PrincipleCategory[];
    previewAnimals: Array<{
        slug: string;
        name: string;
        imageFile: string | null;
    }>;
    subPrinciples: string[];
    searchText: string;
};

type Labels = {
    searchLabel: string;
    searchPlaceholder: string;
    categoryLabel: string;
    all: string;
    categories: Record<PrincipleCategory, string>;
    sortLabel: string;
    sorts: {
        featured: string;
        alphabetic: string;
        mostAnimals: string;
    };
    featuredTitle: string;
    featuredDescription: string;
    allTitle: string;
    allDescription: string;
    resultsCount: string;
    linkedAnimals: string;
    subPrinciples: string;
    explorePrinciple: string;
    noResultsTitle: string;
    noResultsDescription: string;
    clearFilters: string;
    previousPage: string;
    nextPage: string;
    pageStatus: string;
};

type PrinciplesLibraryClientProps = {
    items: PrincipleLibraryItem[];
    labels: Labels;
};

type SortMode = "featured" | "alphabetic" | "most-animals";

const categories: PrincipleCategory[] = [
    "focus",
    "social",
    "survival",
    "movement",
    "protection",
    "learning",
    "emotion",
    "creativity"
];
const PAGE_SIZE = 18;

function formatTemplate(template: string, values: Record<string, string | number>) {
    return template.replace(/\{(\w+)\}/g, (match, key) => values[key] === undefined ? match : String(values[key]));
}

function PrincipleCard({item, labels, featured = false, index = 0}: {
    item: PrincipleLibraryItem;
    labels: Labels;
    featured?: boolean;
    index?: number;
}) {
    const category = item.categories[0];
    const surface = index % 3 === 0
        ? "bg-amber-200/[0.06]"
        : index % 3 === 1
            ? "bg-primary-400/[0.055]"
            : "bg-white/[0.05]";

    if (featured) {
        const imageAnimal = item.previewAnimals[0];
        return (
            <article className="group overflow-hidden rounded-[1.75rem] bg-[linear-gradient(145deg,rgba(180,139,72,0.12),rgba(34,58,41,0.2))] transition-transform duration-200 hover:-translate-y-1">
                {imageAnimal ? (
                    <Link href={`/qualities/${item.principleSlug}`} className="block">
                        <SpeciesArtworkImage
                            slug={imageAnimal.slug}
                            alt={`${imageAnimal.name}, an animal linked to the ${item.principle} behavioral principle`}
                            imageFile={imageAnimal.imageFile}
                            className="aspect-[16/8]"
                            sizes="(min-width: 1024px) 30vw, 100vw"
                        />
                    </Link>
                ) : null}
                <div className="flex min-h-[19rem] flex-col p-6">
                    <div className="flex items-center justify-between gap-4">
                        <span className="rounded-full bg-amber-200/10 px-3 py-1 text-xs font-semibold text-amber-100">
                            {labels.categories[category]}
                        </span>
                        <span className="text-sm text-ink-300">
                            {formatTemplate(labels.linkedAnimals, {count: item.linkedAnimalCount})}
                        </span>
                    </div>
                    <h3 className="mt-5 font-display text-3xl font-bold text-white">{item.principle}</h3>
                    <p className="mt-3 text-base leading-7 text-ink-100">{item.description}</p>
                    <p className="mt-4 border-l-2 border-amber-300/35 pl-3 text-sm font-medium leading-6 text-amber-100/90">{item.sampleMotto}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        {item.previewAnimals.slice(0, 3).map((animal) => (
                            <span key={animal.slug} className="rounded-full bg-black/20 px-3 py-1 text-sm text-ink-200">{animal.name}</span>
                        ))}
                    </div>
                    <p className="mt-4 line-clamp-2 text-sm text-ink-300">
                        {formatTemplate(labels.subPrinciples, {principles: item.subPrinciples.slice(0, 3).join(" · ")})}
                    </p>
                    <Link href={`/qualities/${item.principleSlug}`} className="mt-auto pt-6 font-semibold text-primary-200 transition-colors hover:text-primary-100">
                        {labels.explorePrinciple.replace("{principle}", item.principle)} →
                    </Link>
                </div>
            </article>
        );
    }

    return (
        <article className={`flex min-h-[22rem] flex-col rounded-[1.75rem] p-6 transition-all duration-200 hover:-translate-y-1 hover:bg-white/[0.075] ${surface}`}>
            <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-ink-300">{labels.categories[category]}</span>
                <span className="text-sm text-ink-300">{formatTemplate(labels.linkedAnimals, {count: item.linkedAnimalCount})}</span>
            </div>
            <h3 className="mt-5 font-display text-3xl font-bold text-white">{item.principle}</h3>
            <p className="mt-3 text-base leading-7 text-ink-200">{item.description}</p>
            <p className="mt-4 text-sm font-semibold leading-6 text-amber-100/90">{item.sampleMotto}</p>
            <div className="mt-5 flex flex-wrap gap-2">
                {item.previewAnimals.slice(0, 4).map((animal) => (
                    <span key={animal.slug} className="rounded-full bg-black/20 px-3 py-1 text-sm text-ink-200">{animal.name}</span>
                ))}
            </div>
            <p className="mt-4 line-clamp-2 text-sm text-ink-300">
                {formatTemplate(labels.subPrinciples, {principles: item.subPrinciples.slice(0, 3).join(" · ")})}
            </p>
            <Link href={`/qualities/${item.principleSlug}`} className="mt-auto pt-6 font-semibold text-primary-200 transition-colors hover:text-primary-100">
                {labels.explorePrinciple.replace("{principle}", item.principle)} →
            </Link>
        </article>
    );
}

export default function QualitiesLibraryClient({items, labels}: PrinciplesLibraryClientProps) {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState<PrincipleCategory | "all">("all");
    const [sortMode, setSortMode] = useState<SortMode>("featured");
    const [currentPage, setCurrentPage] = useState(1);
    const featuredOrder = useMemo(() => items.slice(0, 3).map((item) => item.principleSlug), [items]);

    const featuredItems = useMemo(() => featuredOrder
        .map((slug) => items.find((item) => item.principleSlug === slug))
        .filter((item): item is PrincipleLibraryItem => Boolean(item)), [featuredOrder, items]);

    const filteredItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const matching = items.filter((item) => {
            const matchesCategory = activeCategory === "all" || item.categories.includes(activeCategory);
            const matchesQuery = !normalizedQuery || item.searchText.includes(normalizedQuery);
            return matchesCategory && matchesQuery;
        });

        return [...matching].sort((left, right) => {
            if (sortMode === "alphabetic") {
                return left.principle.localeCompare(right.principle);
            }
            if (sortMode === "most-animals") {
                return right.linkedAnimalCount - left.linkedAnimalCount || left.principle.localeCompare(right.principle);
            }
            const leftRank = featuredOrder.indexOf(left.principleSlug);
            const rightRank = featuredOrder.indexOf(right.principleSlug);
            const normalizedLeftRank = leftRank < 0 ? featuredOrder.length : leftRank;
            const normalizedRightRank = rightRank < 0 ? featuredOrder.length : rightRank;
            return normalizedLeftRank - normalizedRightRank || right.linkedAnimalCount - left.linkedAnimalCount;
        });
    }, [activeCategory, featuredOrder, items, query, sortMode]);

    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const safePage = Math.min(currentPage, pageCount);
    const visibleItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const hasActiveFilters = query.trim().length > 0 || activeCategory !== "all";

    function clearFilters() {
        setQuery("");
        setActiveCategory("all");
        setSortMode("featured");
        setCurrentPage(1);
    }

    return (
        <div className="flex flex-col gap-16 md:gap-20">
            <section aria-labelledby="principle-search-title" className="rounded-[1.75rem] bg-surface-900/55 p-5 md:p-7">
                <h2 id="principle-search-title" className="sr-only">{labels.searchLabel}</h2>
                <label htmlFor="principle-search" className="text-sm font-semibold text-ink-100">{labels.searchLabel}</label>
                <input
                    id="principle-search"
                    type="search"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setCurrentPage(1);
                    }}
                    placeholder={labels.searchPlaceholder}
                    className="mt-3 h-14 w-full rounded-2xl border border-white/10 bg-canvas-950/65 px-5 text-base text-white outline-none placeholder:text-ink-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
                />

                <div className="mt-5 flex items-end justify-between gap-5">
                    <div className="min-w-0 flex-1">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{labels.categoryLabel}</p>
                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                            <button
                                type="button"
                                aria-pressed={activeCategory === "all"}
                                onClick={() => {
                                    setActiveCategory("all");
                                    setCurrentPage(1);
                                }}
                                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 ${activeCategory === "all" ? "bg-primary-400 text-canvas-950" : "bg-white/[0.06] text-ink-200 hover:text-white"}`}
                            >
                                {labels.all}
                            </button>
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    aria-pressed={activeCategory === category}
                                    onClick={() => {
                                        setActiveCategory(category);
                                        setCurrentPage(1);
                                    }}
                                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300 ${activeCategory === category ? "bg-primary-400 text-canvas-950" : "bg-white/[0.06] text-ink-200 hover:text-white"}`}
                                >
                                    {labels.categories[category]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <label className="hidden shrink-0 sm:block">
                        <span className="mb-3 block text-xs font-semibold uppercase tracking-[0.16em] text-ink-300">{labels.sortLabel}</span>
                        <select
                            value={sortMode}
                            onChange={(event) => {
                                setSortMode(event.target.value as SortMode);
                                setCurrentPage(1);
                            }}
                            className="h-10 rounded-xl border border-white/10 bg-canvas-950/70 px-3 text-sm text-white outline-none focus:border-primary-400"
                        >
                            <option value="featured">{labels.sorts.featured}</option>
                            <option value="alphabetic">{labels.sorts.alphabetic}</option>
                            <option value="most-animals">{labels.sorts.mostAnimals}</option>
                        </select>
                    </label>
                </div>
            </section>

            {!hasActiveFilters && featuredItems.length > 0 ? (
                <section>
                    <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.featuredTitle}</h2>
                    <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{labels.featuredDescription}</p>
                    <div className="mt-7 grid gap-5 lg:grid-cols-3">
                        {featuredItems.map((item, index) => <PrincipleCard key={item.principleSlug} item={item} labels={labels} featured index={index} />)}
                    </div>
                </section>
            ) : null}

            <section aria-live="polite">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{labels.allTitle}</h2>
                        <p className="mt-3 max-w-3xl text-lg leading-8 text-ink-200">{labels.allDescription}</p>
                    </div>
                    <p className="text-sm font-semibold text-ink-300">{formatTemplate(labels.resultsCount, {count: filteredItems.length})}</p>
                </div>

                {filteredItems.length > 0 ? (
                    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {visibleItems.map((item, index) => <PrincipleCard key={item.principleSlug} item={item} labels={labels} index={index} />)}
                    </div>
                ) : (
                    <div className="mt-7 rounded-[1.75rem] bg-white/[0.05] px-6 py-12 text-center">
                        <h3 className="font-display text-2xl font-bold text-white">{labels.noResultsTitle}</h3>
                        <p className="mx-auto mt-3 max-w-xl text-ink-200">{labels.noResultsDescription}</p>
                        <button type="button" onClick={clearFilters} className="mt-6 rounded-2xl bg-primary-400 px-5 py-3 font-bold text-canvas-950 hover:bg-primary-300">
                            {labels.clearFilters}
                        </button>
                    </div>
                )}
                {filteredItems.length > PAGE_SIZE ? (
                    <nav className="mt-8 flex items-center justify-center gap-4" aria-label={labels.pageStatus}>
                        <button
                            type="button"
                            disabled={safePage === 1}
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-ink-100 hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            ← {labels.previousPage}
                        </button>
                        <span className="text-sm text-ink-300">{formatTemplate(labels.pageStatus, {page: safePage, pages: pageCount})}</span>
                        <button
                            type="button"
                            disabled={safePage === pageCount}
                            onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
                            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-ink-100 hover:border-primary-400 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                            {labels.nextPage} →
                        </button>
                    </nav>
                ) : null}
            </section>
        </div>
    );
}
