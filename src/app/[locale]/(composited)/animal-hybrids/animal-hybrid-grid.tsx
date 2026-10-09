"use client";

import {useEffect, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";

/** One card in the lab: a curated hybrid creature or an app fusion. */
export type AnimalHybridCard = {
    kind: "hybrid" | "fusion";
    slug: string;
    href: string;
    title: string;
    /** Hybrid creature name, or the fusion's learned power. */
    label: string;
    summary: string;
    abilityLabel: string;
    abilityName: string;
    abilityDescription: string;
    parents: Array<{slug: string; name: string}>;
};

const PAGE_SIZE = 24;

function getPageNumbers(currentPage: number, totalPages: number) {
    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({length: end - start + 1}, (_, index) => start + index);
}

/**
 * The index stays statically rendered (no searchParams), so it ships page 1
 * and paginates on the client; `?page=N` is mirrored into the URL and read
 * back on load so a shared link lands on the same page.
 */
export default function AnimalHybridGrid({cards}: {cards: AnimalHybridCard[]}) {
    const [query, setQuery] = useState("");
    const needle = query.trim().toLowerCase();
    const matching = needle
        ? cards.filter((card) => `${card.title} ${card.label} ${card.parents.map((parent) => parent.name).join(" ")}`.toLowerCase().includes(needle))
        : cards;
    const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const [page, setPage] = useState(1);
    const gridRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const requested = Number(new URLSearchParams(window.location.search).get("page"));
        if (Number.isInteger(requested) && requested > 1) {
            setPage(Math.min(requested, Math.ceil(cards.length / PAGE_SIZE)));
        }
    }, [cards.length]);

    function syncPageParam(next: number) {
        const url = new URL(window.location.href);
        if (next > 1) {
            url.searchParams.set("page", String(next));
        } else {
            url.searchParams.delete("page");
        }
        window.history.replaceState(window.history.state, "", url);
    }

    function goToPage(next: number) {
        setPage(next);
        syncPageParam(next);

        const grid = gridRef.current;
        if (grid) {
            window.scrollTo({top: grid.getBoundingClientRect().top + window.scrollY - 96});
        }
    }

    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * PAGE_SIZE;
    const visible = matching.slice(start, start + PAGE_SIZE);
    const pagerButton = "rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-ink-200 hover:border-white/25 hover:text-white";

    return (
        <section ref={gridRef} className="flex flex-col gap-6" aria-label="Animal hybrids">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <input
                    type="search"
                    value={query}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                        syncPageParam(1);
                    }}
                    placeholder="Search hybrids and fusions, e.g. lion or shark"
                    aria-label="Search hybrids"
                    className="w-full md:max-w-md border border-line-300 bg-surface-800 px-4 py-3 text-white placeholder:text-ink-400 focus:outline-none focus:border-primary-500/60"
                />
                <p className="text-ink-300">
                    {matching.length > 0
                        ? `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, matching.length)} of ${matching.length} hybrids`
                        : "No hybrids match. Try the Fuse tool above for any pair."}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {visible.map((card) => (
                    <article
                        key={card.slug}
                        className="  border border-line-300 bg-surface-900/80 backdrop-blur p-5 md:p-6 flex flex-col gap-5"
                    >
                        <div className="grid grid-cols-2 gap-3">
                            {card.parents.map((parent) => (
                                <Link key={parent.slug} href={`/animals/${parent.slug}`} aria-label={parent.name}>
                                    <SpeciesArtworkImage
                                        slug={parent.slug}
                                        alt={`${parent.name} artwork`}
                                        className="aspect-[4/3]  border border-line-300"
                                        sizes="(min-width: 1024px) 20vw, 45vw"
                                    />
                                </Link>
                            ))}
                        </div>
                        <div className="flex flex-col gap-3">
                            <p className="text-primary-200 text-sm uppercase tracking-[0.2em]">
                                {card.kind === "fusion" ? <span className="mr-2 rounded-full border border-primary-500/40 px-2 py-0.5 text-xs">Fusion</span> : null}
                                {card.label}
                            </p>
                            <h2 className="font-display font-bold text-3xl text-white">{card.title}</h2>
                            <p className="text-ink-200 text-lg leading-8">{card.summary}</p>
                            <div className="  border border-primary-500/30 bg-primary-900/10 px-4 py-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-primary-200">{card.abilityLabel}</p>
                                <p className="font-display text-2xl font-bold text-white">{card.abilityName}</p>
                                <p className="text-ink-200 mt-2">{card.abilityDescription}</p>
                            </div>
                        </div>
                        <Link
                            href={card.href}
                            className="mt-auto text-primary-200 text-lg hover:text-primary-100 transition-colors"
                            underline
                        >
                            {card.kind === "fusion" ? "See the fusion" : "Read the hybrid profile"}
                        </Link>
                    </article>
                ))}
            </div>

            {totalPages > 1 ? (
                <nav aria-label="Hybrid pages" className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {currentPage > 1 ? <button type="button" onClick={() => goToPage(currentPage - 1)} className={pagerButton}>Previous</button> : null}
                    {getPageNumbers(currentPage, totalPages).map((number) => (
                        <button
                            key={number}
                            type="button"
                            onClick={() => goToPage(number)}
                            aria-current={number === currentPage ? "page" : undefined}
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${number === currentPage ? "bg-primary-400 text-black" : "border border-white/10 text-ink-200 hover:border-white/25 hover:text-white"}`}
                        >
                            {number}
                        </button>
                    ))}
                    {currentPage < totalPages ? <button type="button" onClick={() => goToPage(currentPage + 1)} className={pagerButton}>Next</button> : null}
                </nav>
            ) : null}
        </section>
    );
}
