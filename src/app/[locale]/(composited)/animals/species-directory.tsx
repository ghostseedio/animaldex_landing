"use client";

import {FormEvent, useEffect, useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import SpeciesImage from "@/app/[locale]/(composited)/animals/species-image";
import {getSpeciesImageAltText} from "@/data/species-images";
import type {SpeciesEntry} from "@/data/species";

type SpeciesDirectoryCopy = {
    scientificName: string;
    updated: string;
    readSpecies: string;
    searchPlaceholder: string;
    alphabetLabel: string;
    filterAll: string;
    resultsSummary: string;
    noResultsTitle: string;
    noResultsDescription: string;
    clearFilters: string;
    previousPage: string;
    nextPage: string;
    pageLabel: string;
};

type SpeciesDirectoryProps = {
    locale: string;
    speciesEntries: SpeciesEntry[];
    totalSpecies: number;
    currentPage: number;
    totalPages: number;
    currentQuery: string;
    currentLetter: string;
    copy: SpeciesDirectoryCopy;
};

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function formatDate(locale: string, date: string) {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long"}).format(new Date(date));
}

function formatResultsSummary(template: string, count: number, total: number) {
    return template.replace("{count}", String(count)).replace("{total}", String(total));
}

function formatPageLabel(template: string, page: number, totalPages: number) {
    return template.replace("{page}", String(page)).replace("{totalPages}", String(totalPages));
}

export default function SpeciesDirectory({
    locale,
    speciesEntries,
    totalSpecies,
    currentPage,
    totalPages,
    currentQuery,
    currentLetter,
    copy
}: SpeciesDirectoryProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery] = useState(currentQuery);

    useEffect(() => {
        setQuery(currentQuery);
    }, [currentQuery]);

    function pushFilters({nextQuery = currentQuery, nextLetter = currentLetter, nextPage = 1}: {
        nextQuery?: string;
        nextLetter?: string;
        nextPage?: number;
    }) {
        const params = new URLSearchParams();

        if (nextQuery.trim()) {
            params.set("q", nextQuery.trim());
        }

        if (nextLetter !== "all") {
            params.set("letter", nextLetter);
        }

        if (nextPage > 1) {
            params.set("page", String(nextPage));
        }

        const queryString = params.toString();
        router.push(queryString ? `${pathname}?${queryString}` : pathname);
    }

    function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        pushFilters({nextQuery: query, nextPage: 1});
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-5 md:p-6 flex flex-col gap-5">
                <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3">
                    <label htmlFor="species-search" className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">
                        {copy.searchPlaceholder}
                    </label>
                    <input
                        id="species-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={copy.searchPlaceholder}
                        className="w-full rounded-2xl border border-line-300 bg-surface-950 px-4 py-3 text-base text-white placeholder:text-ink-400 outline-none transition-colors focus:border-primary-400"
                    />
                </form>

                <div className="flex flex-col gap-3">
                    <p className="text-sm uppercase tracking-[0.16em] font-medium text-primary-200">{copy.alphabetLabel}</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => pushFilters({nextLetter: "all", nextPage: 1})}
                            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                currentLetter === "all"
                                    ? "border-primary-400 bg-primary-500/20 text-white"
                                    : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                            }`}
                        >
                            {copy.filterAll}
                        </button>
                        {alphabet.map((letter) => (
                            <button
                                key={letter}
                                type="button"
                                onClick={() => pushFilters({nextLetter: letter, nextPage: 1})}
                                className={`h-9 min-w-9 rounded-full border px-3 text-sm transition-colors ${
                                    currentLetter === letter
                                        ? "border-primary-400 bg-primary-500/20 text-white"
                                        : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                                }`}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm md:text-base text-ink-300">
                        {formatResultsSummary(copy.resultsSummary, speciesEntries.length, totalSpecies)}
                    </p>
                    {(currentQuery || currentLetter !== "all") ? (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                pushFilters({nextQuery: "", nextLetter: "all", nextPage: 1});
                            }}
                            className="text-sm text-primary-200 hover:text-primary-100 transition-colors"
                        >
                            {copy.clearFilters}
                        </button>
                    ) : null}
                </div>
            </div>

            {speciesEntries.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {speciesEntries.map((entry) => (
                        <article
                            key={entry.slug}
                            className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-6 md:p-8 flex flex-col gap-4"
                        >
                            <SpeciesImage
                                slug={entry.slug}
                                alt={getSpeciesImageAltText(entry, "thumbnail")}
                                className="aspect-[4/3] rounded-3xl border border-line-300"
                                sizes="(min-width: 1024px) 40vw, 100vw"
                            />
                            <h2 className="font-display font-bold text-3xl text-white">{entry.heroTitle}</h2>
                            <p className="text-ink-200 text-lg">{entry.analysis.summary}</p>
                            <div className="text-ink-300 text-sm md:text-base">
                                <span className="text-white">{copy.scientificName}: </span>
                                {entry.analysis.scientificName}
                            </div>
                            <div className="text-ink-300 text-sm md:text-base">
                                <span className="text-white">{copy.updated}: </span>
                                {formatDate(locale, entry.updatedAt)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {entry.searchIntents.map((intent) => (
                                    <span key={intent} className="rounded-full border border-primary-500/30 px-3 py-1 text-primary-200 text-xs">
                                        {intent}
                                    </span>
                                ))}
                            </div>
                            <Link
                                href={`/animals/${entry.slug}`}
                                className="mt-auto text-primary-200 text-lg hover:text-primary-100 transition-colors"
                                underline
                            >
                                {copy.readSpecies}
                            </Link>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur p-8 md:p-10 text-center flex flex-col gap-3">
                    <h2 className="font-display font-bold text-3xl text-white">{copy.noResultsTitle}</h2>
                    <p className="text-ink-200 text-lg">{copy.noResultsDescription}</p>
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => {
                                setQuery("");
                                pushFilters({nextQuery: "", nextLetter: "all", nextPage: 1});
                            }}
                            className="text-primary-200 text-lg hover:text-primary-100 transition-colors"
                        >
                            {copy.clearFilters}
                        </button>
                    </div>
                </div>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-between gap-4 flex-wrap rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-5 py-4 md:px-6">
                    <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => pushFilters({nextPage: currentPage - 1})}
                        className="rounded-full border border-line-300 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-primary-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {copy.previousPage}
                    </button>
                    <p className="text-sm text-ink-300">
                        {formatPageLabel(copy.pageLabel, currentPage, totalPages)}
                    </p>
                    <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => pushFilters({nextPage: currentPage + 1})}
                        className="rounded-full border border-line-300 px-4 py-2 text-sm text-ink-200 transition-colors hover:border-primary-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {copy.nextPage}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
