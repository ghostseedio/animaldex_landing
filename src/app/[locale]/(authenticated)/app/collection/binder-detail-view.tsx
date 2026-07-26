"use client";

import {useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AppEmpty, AppProgress, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import type {BinderProgress, BinderSlot} from "@/data/collection-binder-types";

type OwnershipFilter = "all" | "collected" | "missing";

function hexToCss(hex: string) {
    return `#${hex.replace(/^#/, "")}`;
}

function SlotCard({slot, accent}: {slot: BinderSlot; accent: string}) {
    const content = (
        <>
            <div className="relative aspect-square overflow-hidden bg-black/50">
                {slot.isCollected ? (
                    <img src={slot.imageSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                    <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.08),transparent_55%)]">
                        <span className="text-2xl font-black text-white/15">?</span>
                    </div>
                )}
                {slot.animalDexNumber != null ? (
                    <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[0.58rem] font-black text-white/70">
                        #{String(slot.animalDexNumber).padStart(3, "0")}
                    </span>
                ) : null}
            </div>
            <div className="space-y-1 p-3">
                <p className={`truncate text-sm font-bold ${slot.isCollected ? "text-white" : "text-white/45"}`}>
                    {slot.isCollected ? slot.displayName : "Missing"}
                </p>
                <p className="truncate text-[0.68rem] text-white/35">
                    {slot.isCollected ? (slot.scientificName ?? "Collected") : "Not in your collection yet"}
                </p>
            </div>
        </>
    );

    if (slot.isCollected) {
        return (
            <Link
                href={slot.captureId ? `/app/capture/${slot.captureId}` : `/animals/${slot.slug}`}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#121212] transition hover:border-white/25"
                style={{boxShadow: `inset 0 0 0 1px ${accent}22`}}
            >
                {content}
            </Link>
        );
    }

    return (
        <Link
            href={`/animals/${slot.slug}`}
            className="overflow-hidden rounded-2xl border border-dashed border-white/10 bg-[#0f0f0f] transition hover:border-white/20"
        >
            {content}
        </Link>
    );
}

export default function BinderDetailView({binder}: {binder: BinderProgress}) {
    const [filter, setFilter] = useState<OwnershipFilter>("all");
    const [query, setQuery] = useState("");
    const accent = hexToCss(binder.definition.accentHex);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return binder.slots.filter((slot) => {
            if (filter === "collected" && !slot.isCollected) return false;
            if (filter === "missing" && slot.isCollected) return false;
            if (!needle) return true;
            return (
                slot.displayName.toLowerCase().includes(needle)
                || (slot.scientificName?.toLowerCase().includes(needle) ?? false)
                || slot.identityKey.toLowerCase().includes(needle)
            );
        });
    }, [binder.slots, filter, query]);

    return (
        <div className="space-y-6">
            <AppSurface>
                <div className="grid gap-5 lg:grid-cols-[12rem_1fr]">
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                        <img src={binder.coverImageSrc} alt="" className="aspect-[4/5] w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Collection binder</p>
                        <h1 className="mt-2 font-display text-3xl font-bold text-white md:text-4xl">{binder.definition.title}</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">{binder.definition.blurb}</p>
                        <div className="mt-5 flex flex-wrap items-end gap-4">
                            <div>
                                <p className="text-xs font-bold text-white/40">Progress</p>
                                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">
                                    {binder.collectedCount}<span className="text-white/35"> / {binder.totalCount}</span>
                                </p>
                            </div>
                            <div className="min-w-[12rem] flex-1">
                                <div className="mb-2 flex justify-between text-xs font-bold text-white/40">
                                    <span>Completion</span>
                                    <span style={{color: accent}}>{binder.completionPercent}%</span>
                                </div>
                                <AppProgress value={binder.completionPercent} />
                            </div>
                        </div>
                        {binder.isComplete ? (
                            <p className="mt-4 rounded-2xl border border-primary-400/30 bg-primary-400/10 px-4 py-3 text-sm font-bold text-primary-100">
                                Binder complete — every slot is filled.
                            </p>
                        ) : null}
                    </div>
                </div>
            </AppSurface>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                    {([
                        ["all", "All"],
                        ["collected", "Collected"],
                        ["missing", "Missing"]
                    ] as const).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setFilter(id)}
                            className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] transition ${
                                filter === id ? "bg-primary-400 text-black" : "bg-white/5 text-white/55 hover:bg-white/10"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search this binder"
                    className="w-full rounded-full border border-white/10 bg-black px-4 py-2 text-sm text-white placeholder:text-white/30 sm:max-w-xs"
                />
            </div>

            {filtered.length ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((slot) => (
                        <SlotCard key={`${slot.speciesProfileId}-${slot.position}`} slot={slot} accent={accent} />
                    ))}
                </div>
            ) : (
                <AppEmpty
                    icon="search"
                    title="No matching slots"
                    detail="Try another ownership filter or clear the search."
                />
            )}
        </div>
    );
}
