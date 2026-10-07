"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {SpeciesSystemDynamicsCatalogItem} from "@/data/species-system-dynamics";
import SystemDynamicsPanel from "@/components/animal-detail/system-dynamics/system-dynamics-panel";
import SystemWaveform from "@/components/animal-detail/system-dynamics/system-waveform";
import {FrequencyStateChip} from "@/components/animal-detail/system-dynamics/frequency-chip";
import {
    type SpeciesSystemDynamics,
    type SystemFrequency,
    displayHeadline,
    mechanismLabel,
    resolveVisualSignature,
    summaryFrequencyModes
} from "@/lib/system-dynamics";

/**
 * The Collection's "Systems Dynamics" browse mode, ported from iOS
 * `AnimalDexCatalogView` (`contentMode == .systemDynamics`).
 *
 * Every species with a ready System Dynamics row, one waveform per row,
 * filtered by the frequency it includes and by the search text. Pages are read
 * until enough matches are on screen, up to a cap per load, so a narrow filter
 * does not stall on a run of non-matching rows.
 */

export type SystemDynamicsFrequencyFilter = "all" | "low" | "mid" | "high";

export const FREQUENCY_FILTER_OPTIONS: Array<{id: SystemDynamicsFrequencyFilter; label: string}> = [
    {id: "all", label: "All"},
    {id: "low", label: "Low"},
    {id: "mid", label: "Mid"},
    {id: "high", label: "High"}
];

const PAGE_SIZE = 60;
const TARGET_BATCH = 24;
const MAX_PAGES_PER_LOAD = 8;

function filterFrequency(filter: SystemDynamicsFrequencyFilter): SystemFrequency | null {
    switch (filter) {
        case "low": return "LOW";
        case "mid": return "MID";
        case "high": return "HIGH";
        default: return null;
    }
}

/** Does this animal's system include the frequency, as baseline, trigger or mode? */
export function dynamicsIncludeFrequency(dynamics: SpeciesSystemDynamics, frequency: SystemFrequency) {
    const profile = dynamics.frequencyProfile;
    if (profile.baselineFrequency === frequency || profile.triggeredFrequency === frequency) return true;
    return profile.modes.some((mode) => mode.frequency === frequency);
}

function normalized(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesSystemDynamicsQuery(item: SpeciesSystemDynamicsCatalogItem, query: string) {
    const key = normalized(query);
    if (!key) return true;
    return [
        item.animalName,
        displayHeadline(item.dynamics),
        mechanismLabel(item.dynamics),
        item.dynamics.canonicalPrincipleName ?? "",
        item.dynamics.signatureExplanation ?? ""
    ].some((field) => normalized(field).includes(key));
}

export default function CollectionSystemDynamics({
    query,
    frequencyFilter,
    onCountChange
}: {
    query: string;
    frequencyFilter: SystemDynamicsFrequencyFilter;
    onCountChange?: (count: number) => void;
}) {
    const [items, setItems] = useState<SpeciesSystemDynamicsCatalogItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exhausted, setExhausted] = useState(false);
    const [selected, setSelected] = useState<SpeciesSystemDynamicsCatalogItem | null>(null);
    const [visibleCount, setVisibleCount] = useState(TARGET_BATCH);
    const offsetRef = useRef(0);
    const loadingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    const frequency = filterFrequency(frequencyFilter);
    const filtered = useMemo(
        () => items.filter((item) => (!frequency || dynamicsIncludeFrequency(item.dynamics, frequency)) && matchesSystemDynamicsQuery(item, query)),
        [frequency, items, query]
    );

    useEffect(() => {
        onCountChange?.(filtered.length);
    }, [filtered.length, onCountChange]);

    const loadUntil = useCallback(async (target: number) => {
        if (loadingRef.current || exhausted) return;
        loadingRef.current = true;
        setIsLoading(true);
        setError(null);
        try {
            let pages = 0;
            let loaded = items;
            const matches = (list: SpeciesSystemDynamicsCatalogItem[]) =>
                list.filter((item) => (!frequency || dynamicsIncludeFrequency(item.dynamics, frequency)) && matchesSystemDynamicsQuery(item, query)).length;
            while (matches(loaded) < target && pages < MAX_PAGES_PER_LOAD) {
                const response = await fetch(`/api/app/system-dynamics/catalog?limit=${PAGE_SIZE}&offset=${offsetRef.current}`);
                if (!response.ok) throw new Error("System Dynamics are unavailable right now.");
                const page = await response.json() as {items?: SpeciesSystemDynamicsCatalogItem[]; fetchedCount?: number};
                const pageItems = Array.isArray(page.items) ? page.items : [];
                const fetched = Number(page.fetchedCount ?? pageItems.length);
                pages += 1;
                offsetRef.current += Math.max(fetched, 1);
                loaded = [...loaded, ...pageItems];
                if (fetched < PAGE_SIZE) {
                    setExhausted(true);
                    break;
                }
            }
            setItems(loaded);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "System Dynamics are unavailable right now.");
        } finally {
            loadingRef.current = false;
            setIsLoading(false);
        }
    }, [exhausted, frequency, items, query]);

    useEffect(() => {
        void loadUntil(TARGET_BATCH);
        // Only the first load; later loads come from the sentinel.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A new filter or query starts the window over, and reads more if the
    // loaded pages hold too few matches.
    useEffect(() => {
        setVisibleCount(TARGET_BATCH);
        if (filtered.length < TARGET_BATCH && !exhausted) void loadUntil(TARGET_BATCH);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frequencyFilter, query]);

    useEffect(() => {
        const node = sentinelRef.current;
        if (!node) return undefined;
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            if (filtered.length > visibleCount) {
                setVisibleCount((current) => current + TARGET_BATCH);
            } else if (!exhausted) {
                void loadUntil(filtered.length + TARGET_BATCH);
            }
        }, {rootMargin: "700px 0px"});
        observer.observe(node);
        return () => observer.disconnect();
    }, [exhausted, filtered.length, loadUntil, visibleCount]);

    const displayed = filtered.slice(0, visibleCount);

    if (isLoading && items.length === 0) {
        return <p className="py-8 text-center text-sm text-white/45">Loading System Dynamics…</p>;
    }
    if (error && items.length === 0) {
        return (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="text-sm text-white/60">{error}</p>
                <button type="button" onClick={() => void loadUntil(TARGET_BATCH)} className="mt-4 rounded-full bg-primary-400 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black">
                    Try again
                </button>
            </div>
        );
    }
    if (displayed.length === 0 && (exhausted || !isLoading)) {
        return (
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-6 text-center">
                <p className="font-display text-lg font-bold text-white">No systems match this view.</p>
                <p className="mt-2 text-sm text-white/45">Try another frequency or a broader search.</p>
            </div>
        );
    }

    return (
        <>
            <div className="overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#121212]">
                {displayed.map((item) => {
                    const signature = resolveVisualSignature(item.dynamics);
                    return (
                        <button
                            key={item.dynamics.speciesProfileId}
                            type="button"
                            onClick={() => setSelected(item)}
                            aria-label={`${item.animalName}. ${displayHeadline(item.dynamics)}`}
                            className="flex w-full flex-col gap-2.5 border-b border-white/[0.08] px-4 py-3.5 text-left last:border-b-0 hover:bg-white/[0.03]"
                        >
                            <span className="flex items-baseline gap-2">
                                <span className="min-w-0 flex-1 truncate font-display text-lg font-bold text-white">{item.animalName}</span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                    {summaryFrequencyModes(item.dynamics).slice(0, 3).map((mode, index) => (
                                        <FrequencyStateChip key={`${mode.frequency}-${index}`} frequency={mode.frequency} />
                                    ))}
                                </span>
                            </span>
                            <span className="block h-12 w-full">
                                <SystemWaveform signature={signature} fallbackWaveform={item.dynamics.waveform} style="compact" />
                            </span>
                        </button>
                    );
                })}
            </div>
            <div ref={sentinelRef} className="flex justify-center py-3">
                {isLoading ? <span className="text-xs text-white/40">Loading…</span> : null}
            </div>

            {selected ? (
                <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 md:items-center md:p-4" role="dialog" aria-modal="true" aria-label={`${selected.animalName} System Dynamics`}>
                    <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-[22px] border border-white/10 bg-black p-4 shadow-2xl md:rounded-[22px]">
                        <div className="mb-3 flex items-center justify-between gap-4">
                            <h2 className="text-lg font-bold text-white">{selected.animalName}</h2>
                            <button type="button" onClick={() => setSelected(null)} className="text-sm font-semibold text-primary-200">Done</button>
                        </div>
                        <SystemDynamicsPanel dynamics={selected.dynamics} animalName={selected.animalName} />
                    </div>
                </div>
            ) : null}
        </>
    );
}
