"use client";

import {useMemo, useState} from "react";
import TierListCard, {TierListCardData} from "@/app/[locale]/(composited)/rankings/_components/tier-list-card";

type TierListFiltersProps = {
    items: TierListCardData[];
    allLabel: string;
    searchLabel: string;
    searchPlaceholder: string;
    resultSingularLabel: string;
    resultPluralLabel: string;
    actionLabel: string;
};

export default function TierListFilters({
    items,
    allLabel,
    searchLabel,
    searchPlaceholder,
    resultSingularLabel,
    resultPluralLabel,
    actionLabel
}: TierListFiltersProps) {
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");
    const categories = useMemo(() => {
        const byCategory = new Map<string, string>();

        for (const item of items) {
            byCategory.set(item.category, item.categoryLabel);
        }

        return Array.from(byCategory.entries()).map(([value, label]) => ({value, label}));
    }, [items]);
    const normalizedQuery = query.trim().toLowerCase();
    const filteredItems = items.filter((item) => {
        const matchesCategory = category === "all" || item.category === category;
        const matchesQuery = normalizedQuery.length === 0 || [
            item.title,
            item.description,
            item.categoryLabel,
            item.methodologyLabel
        ].join(" ").toLowerCase().includes(normalizedQuery);

        return matchesCategory && matchesQuery;
    });
    const resultLabel = filteredItems.length === 1 ? resultSingularLabel : resultPluralLabel;

    return (
        <section className="flex w-[calc(100vw-2rem)] min-w-0 max-w-full flex-col gap-5 md:w-auto" aria-labelledby="tier-list-browse-heading">
            <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-line-300 bg-surface-900/75 p-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <label htmlFor="tier-list-search" className="text-sm font-semibold text-white">
                        {searchLabel}
                    </label>
                    <input
                        id="tier-list-search"
                        type="search"
                        value={query}
                        placeholder={searchPlaceholder}
                        onChange={(event) => setQuery(event.target.value)}
                        className="min-h-[44px] w-full rounded-md border border-line-300 bg-canvas-900 px-4 text-base text-white placeholder:text-ink-400 outline-none transition-colors focus:border-primary-400"
                    />
                </div>
                <div className="-mx-4 flex max-w-[calc(100vw-2rem)] gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:max-w-[58%] lg:px-0" aria-label="Tier-list categories">
                    <button
                        type="button"
                        onClick={() => setCategory("all")}
                        className={`min-h-[40px] shrink-0 rounded-md border px-4 text-sm font-semibold transition-colors ${category === "all" ? "border-primary-400 bg-primary-500/15 text-primary-100" : "border-line-300 bg-canvas-900/60 text-ink-200 hover:border-line-300 hover:text-white"}`}
                    >
                        {allLabel}
                    </button>
                    {categories.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setCategory(item.value)}
                            className={`min-h-[40px] shrink-0 rounded-md border px-4 text-sm font-semibold transition-colors ${category === item.value ? "border-primary-400 bg-primary-500/15 text-primary-100" : "border-line-300 bg-canvas-900/60 text-ink-200 hover:border-line-300 hover:text-white"}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <p className="text-sm text-ink-300 lg:ml-auto" aria-live="polite">
                    {filteredItems.length} {resultLabel}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item, index) => (
                    <TierListCard
                        key={item.slug}
                        item={item}
                        href={`/tier-list/${item.slug}`}
                        actionLabel={actionLabel}
                        priority={index < 2}
                    />
                ))}
            </div>
        </section>
    );
}
