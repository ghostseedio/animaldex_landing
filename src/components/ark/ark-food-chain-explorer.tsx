"use client";

import {useEffect, useId, useMemo, useRef, useState} from "react";
import ArkFoodChainPanel, {type ArkFoodChainWords} from "@/components/ark/ark-food-chain-panel";
import type {ArkFoodChainEntry, ArkFoodChainSpecies} from "@/lib/ark-food-chain";

/**
 * Tap a species, see who eats it and what it eats (SEO lane S3).
 *
 * - `compact`: the featured species as chips, every entry already here (the
 *   home page and /ark embed it; nothing is fetched).
 * - `full`: every species aboard, searchable; a tap reads that species from
 *   `/api/ark/food-chain?species=` and keeps it in the address (`?species=`),
 *   which the server renders on a reload or a shared link.
 *
 * The first panel is rendered on the server, so the page reads without script.
 */

type Props = {
    variant: "full" | "compact";
    entries: ArkFoodChainEntry[];
    /** `full`: every species aboard, biggest first. */
    index?: ArkFoodChainSpecies[];
    /** The species shown first (its kind id). */
    initial: string | null;
    words: ArkFoodChainWords;
    locale: string;
    arkHref: string;
    /** The panel's heading level (under the section's own heading). */
    panelHeadingLevel: 2 | 3 | 4;
    /** `full`: open the species the address names (`?species=<slug>`) once the page has loaded. */
    readAddress?: boolean;
};

const LIST_FIRST = 48;

export default function ArkFoodChainExplorer({variant, entries, index, initial, words, locale, arkHref, panelHeadingLevel, readAddress}: Props) {
    const id = useId();
    const [loaded, setLoaded] = useState<Record<string, ArkFoodChainEntry>>(() => Object.fromEntries(entries.map((entry) => [entry.species.id, entry])));
    const [selected, setSelected] = useState<string | null>(initial ?? entries[0]?.species.id ?? null);
    const [state, setState] = useState<"idle" | "loading" | "error">("idle");
    const [query, setQuery] = useState("");
    const [showAll, setShowAll] = useState(false);
    const asked = useRef<string | null>(null);

    const list = useMemo(() => (variant === "full" ? index ?? [] : entries.map((entry) => entry.species)), [variant, index, entries]);
    const matches = useMemo(() => {
        const wanted = query.trim().toLowerCase();
        return wanted ? list.filter((species) => species.name.toLowerCase().includes(wanted)) : list;
    }, [list, query]);
    const shown = query.trim() || showAll || variant === "compact" ? matches : matches.slice(0, LIST_FIRST);

    async function choose(species: ArkFoodChainSpecies) {
        setSelected(species.id);
        if (variant === "full") {
            const url = new URL(window.location.href);
            url.searchParams.set("species", species.slug);
            window.history.replaceState(window.history.state, "", url.toString());
        }
        if (loaded[species.id]) {
            setState("idle");
            return;
        }
        asked.current = species.id;
        setState("loading");
        try {
            const response = await fetch(`/api/ark/food-chain?species=${encodeURIComponent(species.slug)}`);
            const body = (await response.json().catch(() => null)) as {entry?: ArkFoodChainEntry} | null;
            if (asked.current !== species.id) return;
            if (!response.ok || !body?.entry) throw new Error("not read");
            setLoaded((current) => ({...current, [species.id]: body.entry!}));
            setState("idle");
        } catch {
            if (asked.current === species.id) setState("error");
        }
    }

    // A shared link (`?species=`): the server rendered the first species; the one asked for is read here.
    useEffect(() => {
        if (!readAddress) return;
        const wanted = new URL(window.location.href).searchParams.get("species")?.trim().toLowerCase();
        const species = wanted ? list.find((item) => item.slug.toLowerCase() === wanted) : undefined;
        if (species && species.id !== selected) void choose(species);
        // Once, on load.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A panel the reader asked for gets the focus's attention on small screens.
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (state !== "idle" || !selected || variant !== "full") return;
        const panel = panelRef.current;
        if (panel && window.matchMedia("(max-width: 1023px)").matches && asked.current === selected) panel.scrollIntoView({block: "nearest", behavior: "smooth"});
    }, [selected, state, variant]);

    const entry = selected ? loaded[selected] : undefined;
    const selectedName = list.find((species) => species.id === selected)?.name ?? entry?.species.name ?? "";

    return (
        <div className={variant === "full" ? "grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12" : "flex flex-col gap-5"}>
            <div className="min-w-0">
                {variant === "full" ? (
                    <>
                        <label htmlFor={`${id}-search`} className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-300">{words.searchLabel}</label>
                        <input
                            id={`${id}-search`}
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={words.searchPlaceholder}
                            autoComplete="off"
                            className="mt-2 block min-h-11 w-full rounded-full border border-line-300 bg-surface-900 px-4 text-base text-white placeholder:text-ink-400 focus:border-primary-300 focus:outline-none"
                        />
                        <p className="mt-3 text-[13px] text-ink-400">{words.listHint}</p>
                    </>
                ) : null}
                <ul aria-label={variant === "full" ? words.listTitle : words.chooseLabel} className={variant === "full" ? "mt-3 flex flex-wrap gap-2" : "flex flex-wrap gap-2"}>
                    {shown.map((species) => {
                        const active = species.id === selected;
                        return (
                            <li key={species.id}>
                                <button
                                    type="button"
                                    aria-pressed={active}
                                    aria-controls={`${id}-panel`}
                                    onClick={() => void choose(species)}
                                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors ${active ? "border-primary-400 bg-primary-400 text-canvas-950" : "border-line-300 text-white hover:border-primary-300"}`}
                                >
                                    {species.name}
                                    <span className={active ? "text-canvas-950/70" : "font-semibold text-ink-400"}>{species.aboard.toLocaleString(locale)}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {variant === "full" && !query.trim() && !showAll && matches.length > LIST_FIRST ? (
                    <button type="button" onClick={() => setShowAll(true)} className="mt-3 min-h-11 text-sm font-bold text-primary-200 underline-offset-4 hover:underline">
                        {words.showAll.replace("{count}", matches.length.toLocaleString(locale))}
                    </button>
                ) : null}
                {variant === "full" && query.trim() && !matches.length ? <p className="mt-3 text-sm text-ink-300">{words.noMatch}</p> : null}
            </div>

            <div ref={panelRef} id={`${id}-panel`} aria-live="polite" className="min-w-0 border border-line-300 bg-surface-900/70 p-5 md:p-7">
                {entry ? (
                    <ArkFoodChainPanel entry={entry} words={words} locale={locale} arkHref={arkHref} headingLevel={panelHeadingLevel} headingId={`${id}-heading`} />
                ) : state === "error" ? (
                    <p className="text-[15px] text-ink-300">{words.error}</p>
                ) : selected ? (
                    <p className="text-[15px] text-ink-300">
                        <span className="font-bold text-white">{selectedName}</span> · {words.loading}
                    </p>
                ) : null}
            </div>
        </div>
    );
}
