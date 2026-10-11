"use client";

import {type ReactNode, useEffect, useState} from "react";
import type {AnimalHybridCard} from "@/data/animal-hybrid-cards";
import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";

export type {AnimalHybridCard};

/**
 * The lab grid. The server renders one page of cards (src/data/hub-pagination.ts:
 * /animal-hybrids, then /animal-hybrids/page/<n>) with real page links, so the
 * page stays small and every card is crawlable. Typing two or more letters
 * searches every hybrid and fusion through /api/animal-hybrids/search.
 */
export default function AnimalHybridGrid({
    cards,
    total,
    rangeStart,
    pagination,
    id
}: {
    /** This page's cards. */
    cards: AnimalHybridCard[];
    /** Every card in the lab. */
    total: number;
    /** 1-based position of this page's first card. */
    rangeStart: number;
    /** The page links, shown when not searching. */
    pagination: ReactNode;
    id: string;
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<{query: string; total: number; cards: AnimalHybridCard[]} | null>(null);
    const needle = query.trim();
    const searching = needle.length >= 2;

    useEffect(() => {
        if (!searching) {
            setResults(null);
            return undefined;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            fetch(`/api/animal-hybrids/search?q=${encodeURIComponent(needle)}`, {signal: controller.signal})
                .then((response) => response.json())
                .then((data: {total?: number; cards?: AnimalHybridCard[]}) => setResults({query: needle, total: data.total ?? 0, cards: data.cards ?? []}))
                .catch(() => undefined);
        }, 200);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [needle, searching]);

    const visible = searching ? (results?.cards ?? []) : cards;
    const status = searching
        ? results === null
            ? "Searching…"
            : results.total === 0
                ? "No hybrids match. Try the Fuse tool above for any pair."
                : results.total > results.cards.length
                    ? `Showing the first ${results.cards.length} of ${results.total} matches`
                    : `${results.total} ${results.total === 1 ? "match" : "matches"}`
        : `Showing ${rangeStart}–${rangeStart + cards.length - 1} of ${total} hybrids and fusions`;

    return (
        <section id={id} className="flex scroll-mt-24 flex-col gap-6" aria-label="Animal hybrids">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search hybrids and fusions, e.g. lion or shark"
                    aria-label="Search hybrids"
                    className="w-full md:max-w-md border border-line-300 bg-surface-800 px-4 py-3 text-white placeholder:text-ink-400 focus:outline-none focus:border-primary-500/60"
                />
                <p className="text-ink-300" aria-live="polite">{status}</p>
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

            {searching ? null : pagination}
        </section>
    );
}
