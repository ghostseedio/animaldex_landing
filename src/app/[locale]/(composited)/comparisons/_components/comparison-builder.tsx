"use client";

import {useCallback, useEffect, useId, useMemo, useRef, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import type {ComparableAnimal} from "@/data/comparison-animals";

export type ComparisonBuilderCopy = {
    animalALabel: string;
    animalBLabel: string;
    choosePlaceholder: string;
    searchPlaceholder: string;
    searchingLabel: string;
    noMatchesLabel: string;
    swapLabel: string;
    randomLabel: string;
    typeLabel: string;
    compareLabel: string;
    compareBusyLabel: string;
    sameAnimalError: string;
    searchAllLabel: string;
    popularLabel: string;
    resultsLabel: string;
    changeLabel: string;
    doneLabel: string;
    typeOptions: Array<{value: string; label: string}>;
};

type ComparisonBuilderProps = {
    /** Locale-prefixed `/comparisons` base, resolved on the server. */
    basePath: string;
    starterAnimals: ComparableAnimal[];
    defaultAnimalA: ComparableAnimal | null;
    defaultAnimalB: ComparableAnimal | null;
    animalCount: number;
    copy: ComparisonBuilderCopy;
};

const SEARCH_DEBOUNCE_MS = 180;

function buildComparisonSlug(animalA: string, animalB: string, comparisonType: string) {
    const base = `${animalA}-vs-${animalB}`;
    return comparisonType === "battle" ? base : `${base}-${comparisonType}`;
}

function SearchIcon({className = "h-4 w-4"}: {className?: string}) {
    return (
        <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
    );
}

function AnimalThumb({animal, className = "h-11 w-11"}: {animal: ComparableAnimal; className?: string}) {
    return (
        <span className={`relative shrink-0 overflow-hidden rounded-xl bg-white/[0.06] ${className}`}>
            {/* Storage artwork is already thumbnail-sized; skip the optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={animal.artworkUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        </span>
    );
}

function AnimalPicker({
    animal,
    label,
    starterAnimals,
    animalCount,
    copy,
    onSelect
}: {
    animal: ComparableAnimal | null;
    label: string;
    starterAnimals: ComparableAnimal[];
    animalCount: number;
    copy: ComparisonBuilderCopy;
    onSelect: (next: ComparableAnimal) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ComparableAnimal[]>(starterAnimals);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listboxId = useId();

    const searching = query.trim().length > 0;

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        // Focus lands on the input, so typing is the first thing that happens.
        const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
        return () => window.cancelAnimationFrame(frame);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const trimmed = query.trim();

        if (!trimmed) {
            setResults(starterAnimals);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `/api/comparisons/animals?q=${encodeURIComponent(trimmed)}&limit=12`,
                    {signal: controller.signal}
                );
                if (!response.ok) return;
                const payload = (await response.json()) as {animals?: ComparableAnimal[]};
                setResults(payload.animals ?? []);
                setActiveIndex(0);
            } catch {
                // Aborted or offline: keep the previous list.
            } finally {
                setLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [open, query, starterAnimals]);

    const select = useCallback((next: ComparableAnimal) => {
        onSelect(next);
        setOpen(false);
        setQuery("");
    }, [onSelect]);

    const hint = searching
        ? copy.resultsLabel.replace("{count}", String(results.length))
        : copy.searchAllLabel.replace("{count}", animalCount.toLocaleString());

    return (
        <div ref={containerRef} className="relative flex-1">
            <span className="mb-2 block text-[0.68rem] font-bold uppercase tracking-[0.18em] text-ink-400">{label}</span>

            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition sm:px-4 ${open ? "border-primary-400/70 bg-white/[0.06] ring-1 ring-primary-400/25" : "border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.05]"}`}
            >
                {animal ? (
                    <AnimalThumb animal={animal} />
                ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 text-ink-400">
                        <SearchIcon className="h-4 w-4" />
                    </span>
                )}

                <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-base font-bold text-white sm:text-lg">
                        {animal ? animal.name : copy.choosePlaceholder}
                    </span>
                    {/* The always-visible affordance: this control is a search box. */}
                    <span className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-ink-400">
                        <SearchIcon className="h-3 w-3" />
                        <span className="truncate">{copy.searchAllLabel.replace("{count}", animalCount.toLocaleString())}</span>
                    </span>
                </span>

                <span className="shrink-0 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-ink-500 transition group-hover:text-primary-200">
                    {animal ? copy.changeLabel : ""}
                </span>
            </button>

            {open ? (
                <>
                    {/* Mobile backdrop: the panel becomes a sheet on small screens. */}
                    <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] sm:hidden"
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />

                    <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border border-white/12 bg-[#0d1310] shadow-2xl shadow-black/60 sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-full sm:mt-2 sm:rounded-2xl">
                        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

                        <div className="p-3 pb-2">
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
                                    <SearchIcon />
                                </span>
                                <input
                                    ref={inputRef}
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Escape") {
                                            event.preventDefault();
                                            setOpen(false);
                                        } else if (event.key === "ArrowDown") {
                                            event.preventDefault();
                                            setActiveIndex((index) => Math.min(index + 1, results.length - 1));
                                        } else if (event.key === "ArrowUp") {
                                            event.preventDefault();
                                            setActiveIndex((index) => Math.max(index - 1, 0));
                                        } else if (event.key === "Enter") {
                                            event.preventDefault();
                                            const choice = results[activeIndex];
                                            if (choice) select(choice);
                                        }
                                    }}
                                    placeholder={copy.searchPlaceholder}
                                    aria-label={copy.searchPlaceholder}
                                    enterKeyHint="search"
                                    className="h-12 w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-3 text-base text-white outline-none transition placeholder:text-ink-400 focus:border-primary-400/60 sm:h-11 sm:text-sm"
                                />
                            </div>

                            <p className="mt-2 flex items-center justify-between px-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-500">
                                <span>{searching ? hint : copy.popularLabel}</span>
                                {!searching ? <span className="normal-case tracking-normal text-ink-500">{hint}</span> : null}
                            </p>
                        </div>

                        <ul
                            id={listboxId}
                            role="listbox"
                            className="max-h-[52vh] overflow-y-auto overscroll-contain px-2 pb-2 sm:max-h-80"
                        >
                            {loading && !results.length ? (
                                <li className="px-3 py-6 text-center text-sm text-ink-400">{copy.searchingLabel}</li>
                            ) : null}
                            {!loading && !results.length ? (
                                <li className="px-3 py-6 text-center text-sm text-ink-400">{copy.noMatchesLabel}</li>
                            ) : null}
                            {results.map((item, index) => (
                                <li key={item.slug} role="option" aria-selected={index === activeIndex}>
                                    <button
                                        type="button"
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onClick={() => select(item)}
                                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition ${index === activeIndex ? "bg-primary-400/12" : "hover:bg-white/[0.05]"}`}
                                    >
                                        <AnimalThumb animal={item} className="h-10 w-10" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-bold text-white">{item.name}</span>
                                            <span className="block truncate text-xs italic text-ink-500">{item.scientificName}</span>
                                        </span>
                                        {item.animalDexNumber ? (
                                            <span className="shrink-0 text-[0.65rem] font-black text-ink-600">
                                                #{item.animalDexNumber}
                                            </span>
                                        ) : null}
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <div className="border-t border-white/8 p-3 sm:hidden">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="h-11 w-full rounded-xl border border-white/12 text-sm font-bold text-ink-200"
                            >
                                {copy.doneLabel}
                            </button>
                        </div>
                    </div>
                </>
            ) : null}
        </div>
    );
}

export default function ComparisonBuilder({
    basePath,
    starterAnimals,
    defaultAnimalA,
    defaultAnimalB,
    animalCount,
    copy
}: ComparisonBuilderProps) {
    const router = useRouter();
    const [animalA, setAnimalA] = useState<ComparableAnimal | null>(defaultAnimalA);
    const [animalB, setAnimalB] = useState<ComparableAnimal | null>(defaultAnimalB);
    const [comparisonType, setComparisonType] = useState(copy.typeOptions[0]?.value ?? "battle");
    const [isPending, startTransition] = useTransition();

    const sameAnimal = Boolean(animalA && animalB && animalA.slug === animalB.slug);
    const canCompare = Boolean(animalA && animalB) && !sameAnimal;

    const targetHref = useMemo(() => {
        if (!animalA || !animalB || sameAnimal) return null;
        return `${basePath}/${buildComparisonSlug(animalA.slug, animalB.slug, comparisonType)}`;
    }, [animalA, animalB, basePath, comparisonType, sameAnimal]);

    const submit = useCallback(() => {
        if (!targetHref) return;
        startTransition(() => router.push(targetHref));
    }, [router, targetHref]);

    const randomise = useCallback(() => {
        if (starterAnimals.length < 2) return;
        const first = Math.floor(Math.random() * starterAnimals.length);
        let second = Math.floor(Math.random() * starterAnimals.length);
        if (second === first) second = (first + 1) % starterAnimals.length;
        setAnimalA(starterAnimals[first]);
        setAnimalB(starterAnimals[second]);
    }, [starterAnimals]);

    return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.75)] backdrop-blur-sm sm:p-5 md:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                <AnimalPicker
                    animal={animalA}
                    label={copy.animalALabel}
                    starterAnimals={starterAnimals}
                    animalCount={animalCount}
                    copy={copy}
                    onSelect={setAnimalA}
                />

                <div className="flex items-center justify-center gap-3 sm:flex-col sm:gap-2 sm:pb-2.5">
                    <span className="h-px flex-1 bg-white/10 sm:hidden" aria-hidden="true" />
                    <button
                        type="button"
                        onClick={() => {
                            setAnimalA(animalB);
                            setAnimalB(animalA);
                        }}
                        aria-label={copy.swapLabel}
                        title={copy.swapLabel}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-ink-300 transition hover:border-primary-400/50 hover:text-white"
                    >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                            <path d="M6 7h9m0 0-2.5-2.5M15 7l-2.5 2.5M14 13H5m0 0 2.5-2.5M5 13l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                    <span className="h-px flex-1 bg-white/10 sm:hidden" aria-hidden="true" />
                </div>

                <AnimalPicker
                    animal={animalB}
                    label={copy.animalBLabel}
                    starterAnimals={starterAnimals}
                    animalCount={animalCount}
                    copy={copy}
                    onSelect={setAnimalB}
                />
            </div>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 sm:gap-3">
                    <label className="block">
                        <span className="sr-only">{copy.typeLabel}</span>
                        <select
                            value={comparisonType}
                            onChange={(event) => setComparisonType(event.target.value)}
                            aria-label={copy.typeLabel}
                            className="h-12 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.035] px-3.5 text-sm font-semibold text-white outline-none transition focus:border-primary-400/60"
                        >
                            {copy.typeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <button
                        type="button"
                        onClick={randomise}
                        className="h-12 whitespace-nowrap rounded-xl border border-white/10 px-4 text-sm font-semibold text-ink-300 transition hover:border-white/25 hover:text-white"
                    >
                        {copy.randomLabel}
                    </button>
                </div>

                <button
                    type="button"
                    onClick={submit}
                    disabled={!canCompare || isPending}
                    className="h-12 w-full rounded-xl bg-primary-400 px-8 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                >
                    {isPending ? copy.compareBusyLabel : copy.compareLabel}
                </button>
            </div>

            {sameAnimal ? (
                <p className="mt-3 text-sm font-semibold text-amber-300">{copy.sameAnimalError}</p>
            ) : null}
        </div>
    );
}
