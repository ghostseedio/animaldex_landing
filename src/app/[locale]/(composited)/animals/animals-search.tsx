"use client";

import {useDeferredValue, useEffect, useId, useMemo, useRef, useState, useTransition, type FormEvent, type KeyboardEvent} from "react";
import {useRouter} from "next/navigation";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import IdentityKindChip from "@/app/[locale]/(composited)/animals/identity-kind-chip";
import {formatAnimalDexNumber} from "@/lib/animaldex-number";

export type AnimalsSearchSuggestion = {
    name: string;
    slug: string;
    scientificName: string;
    category: string;
    animalDexNumber: number | null;
    battleTier: string | null;
    identityKind: string | null;
    identityKindLabel: string | null;
};

type AnimalsSearchProps = {
    action: string;
    initialQuery: string;
    suggestions: AnimalsSearchSuggestion[];
    searchTitle: string;
    searchPlaceholder: string;
    searchButton: string;
    searchingLabel: string;
    suggestionHint: string;
};

const MAX_SUGGESTIONS = 8;

function rankSuggestions(items: AnimalsSearchSuggestion[], query: string) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];

    const scored: Array<{item: AnimalsSearchSuggestion; score: number}> = [];

    for (const item of items) {
        const name = item.name.toLowerCase();
        const scientificName = item.scientificName.toLowerCase();
        const slug = item.slug.toLowerCase().replace(/-/g, " ");
        const category = item.category.toLowerCase();
        const numberLabel = item.animalDexNumber != null ? formatAnimalDexNumber(item.animalDexNumber).toLowerCase() : "";
        const bareNumber = item.animalDexNumber != null ? String(item.animalDexNumber) : "";

        let score = 0;
        if (name === normalized) score = 100;
        else if (name.startsWith(normalized)) score = 90;
        else if (name.includes(normalized)) score = 70;
        else if (numberLabel === normalized || bareNumber === normalized || numberLabel.includes(normalized)) score = 85;
        else if (scientificName.startsWith(normalized)) score = 60;
        else if (scientificName.includes(normalized)) score = 50;
        else if (slug.startsWith(normalized) || slug.includes(normalized)) score = 40;
        else if (category.includes(normalized)) score = 20;
        else continue;

        scored.push({item, score});
    }

    return scored
        .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name))
        .slice(0, MAX_SUGGESTIONS)
        .map((entry) => entry.item);
}

function SearchSpinner({className = "h-5 w-5"}: {className?: string}) {
    return (
        <span
            aria-hidden="true"
            className={`inline-block animate-spin rounded-full border-2 border-canvas-950/25 border-t-canvas-950 ${className}`}
        />
    );
}

export default function AnimalsSearch({
    action,
    initialQuery,
    suggestions,
    searchTitle,
    searchPlaceholder,
    searchButton,
    searchingLabel,
    suggestionHint
}: AnimalsSearchProps) {
    const router = useRouter();
    const listId = useId();
    const [isPending, startTransition] = useTransition();
    const [query, setQuery] = useState(initialQuery);
    // Keep the typed stem for ranking while Tab fills the input with a suggestion name.
    const [filterQuery, setFilterQuery] = useState(initialQuery);
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const activeIndexRef = useRef(-1);
    const deferredFilterQuery = useDeferredValue(filterQuery);

    useEffect(() => {
        setQuery(initialQuery);
        setFilterQuery(initialQuery);
        activeIndexRef.current = -1;
        setActiveIndex(-1);
    }, [initialQuery]);

    const matches = useMemo(
        () => rankSuggestions(suggestions, deferredFilterQuery),
        [deferredFilterQuery, suggestions]
    );

    const showList = open && matches.length > 0 && !isPending;
    const activeOptionId = showList && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined;

    function setActiveSuggestion(index: number) {
        activeIndexRef.current = index;
        setActiveIndex(index);
        const match = matches[index];
        if (match) setQuery(match.name);
    }

    function cycleSuggestion(direction: 1 | -1) {
        if (matches.length === 0 || isPending) return false;
        setOpen(true);
        const current = activeIndexRef.current;
        const nextIndex = current < 0
            ? direction === 1 ? 0 : matches.length - 1
            : (current + direction + matches.length) % matches.length;
        setActiveSuggestion(nextIndex);
        return true;
    }

    function clearActiveSuggestion(restoreTypedQuery = false) {
        activeIndexRef.current = -1;
        setActiveIndex(-1);
        if (restoreTypedQuery) setQuery(filterQuery);
    }

    function submitSearch(value = query) {
        if (isPending) return;
        const nextQuery = value.trim();
        const [pathname, hash = ""] = action.split("#");
        const params = new URLSearchParams();
        if (nextQuery) params.set("q", nextQuery);
        const serializedParams = params.toString();
        const queryString = serializedParams ? `?${serializedParams}` : "";
        const hashSuffix = hash ? `#${hash}` : "";
        setOpen(false);
        clearActiveSuggestion();
        startTransition(() => {
            router.push(`${pathname}${queryString}${hashSuffix}`);
        });
    }

    function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const selected = activeIndexRef.current >= 0 ? matches[activeIndexRef.current] : null;
        submitSearch(selected?.name ?? query);
    }

    function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (isPending) {
            if (event.key === "Enter" || event.key === "Tab") event.preventDefault();
            return;
        }

        if (event.key === "Tab" && matches.length > 0 && (open || filterQuery.trim().length > 0)) {
            if (cycleSuggestion(event.shiftKey ? -1 : 1)) {
                event.preventDefault();
            }
            return;
        }

        if (event.key === "ArrowDown" && matches.length > 0) {
            event.preventDefault();
            cycleSuggestion(1);
            return;
        }

        if (event.key === "ArrowUp" && matches.length > 0) {
            event.preventDefault();
            cycleSuggestion(-1);
            return;
        }

        if (event.key === "Escape") {
            setOpen(false);
            clearActiveSuggestion(true);
        }
    }

    return (
        <div className="flex flex-col gap-1.5" aria-busy={isPending}>
            <form action={action} method="get" onSubmit={onSubmit} className="relative flex flex-col gap-2 sm:flex-row sm:gap-3" role="search">
                <div className="relative min-w-0 flex-1">
                    <label className="sr-only" htmlFor="animals-search">{searchTitle}</label>
                    <input
                        id="animals-search"
                        name="q"
                        value={query}
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={showList}
                        aria-controls={listId}
                        aria-activedescendant={activeOptionId}
                        placeholder={searchPlaceholder}
                        autoFocus
                        disabled={isPending}
                        onFocus={() => setOpen(true)}
                        onBlur={() => {
                            // Delay so suggestion clicks register before the list unmounts.
                            window.setTimeout(() => setOpen(false), 120);
                        }}
                        onChange={(event) => {
                            const next = event.target.value;
                            setQuery(next);
                            setFilterQuery(next);
                            setOpen(true);
                            clearActiveSuggestion();
                        }}
                        onKeyDown={onKeyDown}
                        className="min-h-14 w-full rounded-2xl border border-line-300 bg-canvas-950/80 px-5 text-lg text-white placeholder:text-ink-400 outline-none transition-colors focus:border-primary-400 disabled:cursor-wait disabled:opacity-70 md:min-h-16 md:px-6 md:text-xl"
                    />

                    {showList ? (
                        <ul
                            id={listId}
                            role="listbox"
                            className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-[min(24rem,70vh)] overflow-y-auto overflow-x-hidden rounded-xl border border-line-300 bg-canvas-950 shadow-2xl"
                        >
                            {matches.map((match, index) => {
                                const active = index === activeIndex;
                                const numberLabel = match.animalDexNumber != null
                                    ? formatAnimalDexNumber(match.animalDexNumber)
                                    : null;

                                return (
                                    <li key={match.slug} role="option" id={`${listId}-option-${index}`} aria-selected={active}>
                                        <button
                                            type="button"
                                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                                active ? "bg-primary-500/20 text-white" : "text-ink-100 hover:bg-white/[0.06]"
                                            }`}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => submitSearch(match.name)}
                                        >
                                            <SpeciesArtworkImage
                                                slug={match.slug}
                                                alt=""
                                                fit="contain"
                                                sizes="48px"
                                                className="h-11 w-11 shrink-0 rounded-lg !bg-white/[0.04]"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center gap-2">
                                                    {numberLabel ? (
                                                        <span className="shrink-0 font-mono text-[0.68rem] font-black tracking-[0.08em] text-primary-200/90">
                                                            {numberLabel}
                                                        </span>
                                                    ) : null}
                                                    <span className="truncate font-semibold">{match.name}</span>
                                                </span>
                                                <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                                                    {match.identityKindLabel ? (
                                                        <IdentityKindChip
                                                            identityKind={match.identityKind}
                                                            label={match.identityKindLabel}
                                                            animalName={match.name}
                                                            compact
                                                        />
                                                    ) : null}
                                                    <span className="truncate text-xs text-ink-400">
                                                        {match.scientificName || match.category}
                                                    </span>
                                                </span>
                                            </span>
                                            {match.battleTier ? (
                                                <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[0.7rem] font-black uppercase tracking-[0.14em] text-ink-200">
                                                    {match.battleTier}
                                                </span>
                                            ) : null}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>

                <button
                    type="submit"
                    disabled={isPending}
                    aria-live="polite"
                    className={`inline-flex min-h-14 shrink-0 items-center justify-center gap-2.5 rounded-2xl px-7 text-base font-bold transition-all md:min-h-16 md:px-8 md:text-lg ${
                        isPending
                            ? "scale-[0.98] cursor-wait bg-primary-300 text-canvas-950 shadow-inner"
                            : "bg-primary-400 text-canvas-950 hover:bg-primary-300"
                    }`}
                >
                    {isPending ? (
                        <>
                            <SearchSpinner />
                            <span>{searchingLabel}</span>
                        </>
                    ) : (
                        searchButton
                    )}
                </button>
            </form>
            <p className="text-[0.7rem] text-ink-400">{suggestionHint}</p>
        </div>
    );
}
