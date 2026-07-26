"use client";

import {useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {AppEmpty, AppProgress, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {
    BINDER_SHELF_GROUPS,
    type BinderIndexSummary,
    type BinderProgress,
    type BinderShelfGroup
} from "@/data/collection-binder-types";

type DisplayMode = "shelf" | "covers";
type SortMode =
    | "curated"
    | "nearest"
    | "mostComplete"
    | "leastComplete"
    | "alphabetical";

function hexToCss(hex: string) {
    return `#${hex.replace(/^#/, "")}`;
}

function sortBinders(binders: BinderProgress[], sort: SortMode) {
    const next = [...binders];
    switch (sort) {
        case "nearest":
            return next.sort((a, b) => {
                const aRemaining = a.totalCount - a.collectedCount;
                const bRemaining = b.totalCount - b.collectedCount;
                if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
                if (aRemaining !== bRemaining) return aRemaining - bRemaining;
                return b.completionPercent - a.completionPercent;
            });
        case "mostComplete":
            return next.sort((a, b) => b.completionPercent - a.completionPercent || a.definition.title.localeCompare(b.definition.title));
        case "leastComplete":
            return next.sort((a, b) => a.completionPercent - b.completionPercent || a.definition.title.localeCompare(b.definition.title));
        case "alphabetical":
            return next.sort((a, b) => a.definition.title.localeCompare(b.definition.title));
        case "curated":
        default:
            return next.sort((a, b) => a.definition.sortOrder - b.definition.sortOrder);
    }
}

function BinderCoverCard({binder}: {binder: BinderProgress}) {
    const accent = hexToCss(binder.definition.accentHex);
    return (
        <Link
            href={binder.href}
            className="group overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#121212] transition hover:border-white/25"
        >
            <div className="relative aspect-[4/5] overflow-hidden bg-black">
                <img
                    src={binder.coverImageSrc}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
                    <p className="font-display text-xl font-bold text-white">{binder.definition.title}</p>
                    <p className="text-xs font-bold tabular-nums" style={{color: accent}}>
                        {binder.collectedCount} / {binder.totalCount} · {binder.completionPercent}%
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                        <div className="h-full rounded-full" style={{width: `${binder.completionPercent}%`, backgroundColor: accent}} />
                    </div>
                </div>
                {binder.isComplete ? (
                    <span className="absolute right-3 top-3 rounded-full bg-primary-400 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] text-black">
                        Complete
                    </span>
                ) : null}
            </div>
        </Link>
    );
}

function BinderSpineCard({binder}: {binder: BinderProgress}) {
    const primary = hexToCss(binder.definition.primaryHex);
    const accent = hexToCss(binder.definition.accentHex);
    const secondary = hexToCss(binder.definition.secondaryHex);

    return (
        <Link
            href={binder.href}
            className="group relative flex min-h-[11rem] overflow-hidden rounded-[1.2rem] border border-white/10 transition hover:border-white/25"
            style={{background: `linear-gradient(160deg, ${primary}, ${secondary})`}}
        >
            <div className="flex w-10 shrink-0 items-center justify-center border-r border-black/25 bg-black/20">
                <span
                    className="rotate-180 text-[0.62rem] font-black uppercase tracking-[0.18em] text-white/85"
                    style={{writingMode: "vertical-rl"}}
                >
                    {binder.definition.spineLabel}
                </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                <div>
                    <p className="font-display text-lg font-bold text-white">{binder.definition.shortTitle}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/65">{binder.definition.blurb}</p>
                </div>
                <div>
                    <p className="text-xs font-bold tabular-nums text-white/80">
                        {binder.collectedCount} / {binder.totalCount}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/30">
                        <div className="h-full rounded-full" style={{width: `${binder.completionPercent}%`, backgroundColor: accent}} />
                    </div>
                </div>
            </div>
        </Link>
    );
}

function ShelfGroup({
    title,
    binders,
    mode
}: {
    title: string;
    binders: BinderProgress[];
    mode: DisplayMode;
}) {
    if (!binders.length) return null;

    return (
        <section className="space-y-4">
            <h3 className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/40">{title}</h3>
            {mode === "covers" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {binders.map((binder) => <BinderCoverCard key={binder.definition.id} binder={binder} />)}
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {binders.map((binder) => <BinderSpineCard key={binder.definition.id} binder={binder} />)}
                </div>
            )}
        </section>
    );
}

export default function CollectionBindersPanel({
    binders,
    summary
}: {
    binders: BinderProgress[];
    summary: BinderIndexSummary;
}) {
    const [mode, setMode] = useState<DisplayMode>("shelf");
    const [sort, setSort] = useState<SortMode>("curated");
    const sorted = useMemo(() => sortBinders(binders, sort), [binders, sort]);

    if (!binders.length) {
        return (
            <AppEmpty
                icon="sets"
                title="Your binder shelf is waiting"
                detail="Capture animals to start filling curated collection binders. Memberships sync from the AnimalDex binder catalog."
            />
        );
    }

    const grouped = BINDER_SHELF_GROUPS.map((group) => ({
        ...group,
        binders: sorted.filter((binder) => binder.definition.shelfGroup === group.id as BinderShelfGroup)
    })).filter((group) => group.binders.length > 0);

    return (
        <div className="space-y-6">
            <AppSurface>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/35">Collection binders</p>
                        <p className="mt-2 font-display text-2xl font-bold text-white">
                            {summary.binderCount} binders · {summary.collectedSlots}/{summary.totalSlots} slots · {summary.completeCount} complete
                        </p>
                        <p className="mt-1 text-sm text-white/45">Themed completion books for wildlife, specialists, and places.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {([
                            ["shelf", "Shelf"],
                            ["covers", "Covers"]
                        ] as const).map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setMode(id)}
                                className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] transition ${
                                    mode === id ? "bg-primary-400 text-black" : "bg-white/5 text-white/55 hover:bg-white/10"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                        <select
                            value={sort}
                            onChange={(event) => setSort(event.target.value as SortMode)}
                            className="rounded-full border border-white/10 bg-black px-3 py-1.5 text-xs font-bold text-white/70"
                        >
                            <option value="curated">Curated</option>
                            <option value="nearest">Nearest to completion</option>
                            <option value="mostComplete">Most complete</option>
                            <option value="leastComplete">Least complete</option>
                            <option value="alphabetical">Alphabetical</option>
                        </select>
                    </div>
                </div>
                <div className="mt-5">
                    <AppProgress value={summary.totalSlots ? Math.round((summary.collectedSlots / summary.totalSlots) * 100) : 0} />
                </div>
            </AppSurface>

            {sort === "curated" ? (
                <div className="space-y-8">
                    {grouped.map((group) => (
                        <ShelfGroup key={group.id} title={group.title} binders={group.binders} mode={mode} />
                    ))}
                </div>
            ) : mode === "covers" ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {sorted.map((binder) => <BinderCoverCard key={binder.definition.id} binder={binder} />)}
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {sorted.map((binder) => <BinderSpineCard key={binder.definition.id} binder={binder} />)}
                </div>
            )}
        </div>
    );
}
