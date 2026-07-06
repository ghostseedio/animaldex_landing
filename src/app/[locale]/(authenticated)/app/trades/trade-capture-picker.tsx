"use client";

import {useEffect, useMemo, useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import type {AppCapture, AppDiscoverItem} from "@/data/authenticated-app";
import {formatAppShortDateWithYear} from "@/lib/app-dates";

export type TradeCaptureOption = {
    id: string;
    animalName: string;
    imageSrc: string;
    subtitle: string;
    detail?: string | null;
};

const PAGE_SIZE = 24;

function normalizedSearchText(value: string) {
    return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function captureSubtitle(capture: AppCapture, locale: string) {
    const parts = [
        capture.contextLabel,
        capture.principle,
        capture.capturedAt ? formatAppShortDateWithYear(capture.capturedAt, locale) : null
    ].filter(Boolean);

    return parts[0] ?? "Your capture";
}

function discoverSubtitle(item: AppDiscoverItem) {
    if (item.collectorUsername) {
        return `@${item.collectorUsername}`;
    }

    return item.collectorName;
}

function discoverDetail(item: AppDiscoverItem) {
    return [item.contextLabel, item.locationLabel].filter(Boolean).join(" · ") || null;
}

export function tradeCaptureOptionFromCapture(capture: AppCapture, locale: string): TradeCaptureOption {
    return {
        id: capture.captureId,
        animalName: capture.displayName || capture.animalName,
        imageSrc: capture.imageSrc,
        subtitle: captureSubtitle(capture, locale),
        detail: capture.contextLabel && capture.principle ? capture.principle : null
    };
}

export function tradeCaptureOptionFromDiscover(item: AppDiscoverItem): TradeCaptureOption {
    return {
        id: item.captureId,
        animalName: item.animalName,
        imageSrc: item.imageSrc,
        subtitle: discoverSubtitle(item),
        detail: discoverDetail(item)
    };
}

function filterOptions(options: TradeCaptureOption[], query: string) {
    const normalized = normalizedSearchText(query);

    if (!normalized) {
        return options;
    }

    return options.filter((option) => {
        const haystack = normalizedSearchText([
            option.animalName,
            option.subtitle,
            option.detail ?? ""
        ].join(" "));

        return haystack.includes(normalized);
    });
}

function CapturePickerSheet({
    title,
    description,
    options,
    selectedId,
    emptyLabel,
    onClose,
    onSelect
}: {
    title: string;
    description?: string;
    options: TradeCaptureOption[];
    selectedId: string;
    emptyLabel: string;
    onClose: () => void;
    onSelect: (id: string) => void;
}) {
    const [query, setQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const filtered = useMemo(() => filterOptions(options, query), [options, query]);
    const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
    const hasMore = visibleCount < filtered.length;

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [query]);

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
            <button type="button" aria-label="Close picker" className="absolute inset-0" onClick={onClose} />
            <div className="relative z-10 flex max-h-[min(88vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.5rem] border border-white/10 bg-[#121212] shadow-2xl sm:rounded-[1.5rem]">
                <div className="border-b border-white/10 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary-200">{title}</p>
                            {description ? <p className="mt-1 text-sm text-white/45">{description}</p> : null}
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close" className="rounded-xl border border-white/10 p-2 text-white/55">
                            <AppIcon name="close" />
                        </button>
                    </div>
                    <label className="mt-4 flex items-center gap-3 rounded-[1.15rem] border border-white/10 bg-black/50 px-4 py-3 focus-within:border-primary-400/40">
                        <AppIcon name="search" className="h-5 w-5 shrink-0 text-white/35" />
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search by animal or collector"
                            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                            autoFocus
                        />
                        {query ? (
                            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                                <AppIcon name="close" className="h-4 w-4 text-white/35" />
                            </button>
                        ) : null}
                    </label>
                    <p className="mt-2 text-xs text-white/35">
                        {filtered.length === options.length
                            ? `${options.length} available`
                            : `${filtered.length} of ${options.length} match`}
                    </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {visible.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/45">
                            {emptyLabel}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {visible.map((option) => {
                                const active = option.id === selectedId;

                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => onSelect(option.id)}
                                        className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-primary-400 bg-primary-400/10" : "border-white/[0.08] bg-white/[0.03] hover:border-white/18"}`}
                                    >
                                        <img src={option.imageSrc} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-white">{option.animalName}</p>
                                            <p className="mt-0.5 truncate text-xs text-white/45">{option.subtitle}</p>
                                            {option.detail ? <p className="mt-1 truncate text-[0.68rem] text-white/30">{option.detail}</p> : null}
                                        </div>
                                        {active ? <AppIcon name="check" className="h-4 w-4 shrink-0 text-primary-400" /> : null}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {hasMore ? (
                        <button
                            type="button"
                            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                            className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-primary-200 transition hover:border-white/20"
                        >
                            Load more ({filtered.length - visible.length} remaining)
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export default function TradeCapturePicker({
    label,
    placeholder,
    sheetTitle,
    sheetDescription,
    emptyLabel,
    options,
    value,
    onChange
}: {
    label: string;
    placeholder: string;
    sheetTitle: string;
    sheetDescription?: string;
    emptyLabel: string;
    options: TradeCaptureOption[];
    value: string;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const selected = options.find((option) => option.id === value) ?? null;

    return (
        <>
            <div className="block">
                <span className="mb-2 block text-xs font-bold text-white/35">{label}</span>
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-xl border border-white/10 bg-black px-3 py-3 text-left transition hover:border-primary-400/30"
                >
                    {selected ? (
                        <>
                            <img src={selected.imageSrc} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-white">{selected.animalName}</p>
                                <p className="mt-0.5 truncate text-xs text-white/45">{selected.subtitle}</p>
                            </div>
                            <span className="shrink-0 text-xs font-black text-primary-200">Change</span>
                        </>
                    ) : (
                        <>
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-white/30 ring-1 ring-white/10">
                                <AppIcon name="collection" className="h-6 w-6" />
                            </span>
                            <span className="text-sm text-white/45">{placeholder}</span>
                            <span className="ml-auto shrink-0 text-xs font-black text-primary-200">Browse</span>
                        </>
                    )}
                </button>
            </div>

            {open ? (
                <CapturePickerSheet
                    title={sheetTitle}
                    description={sheetDescription}
                    options={options}
                    selectedId={value}
                    emptyLabel={emptyLabel}
                    onClose={() => setOpen(false)}
                    onSelect={(id) => {
                        onChange(id);
                        setOpen(false);
                    }}
                />
            ) : null}
        </>
    );
}

export function useTradeCaptureOptions(captures: AppCapture[], discover: AppDiscoverItem[], locale: string) {
    return useMemo(() => ({
        mine: captures.map((capture) => tradeCaptureOptionFromCapture(capture, locale)),
        public: discover.map(tradeCaptureOptionFromDiscover)
    }), [captures, discover, locale]);
}
