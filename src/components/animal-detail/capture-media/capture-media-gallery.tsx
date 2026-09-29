"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import type {DiscoverMediaAsset} from "@/data/discover-timeline";
import {
    canBecomeCover,
    galleryTitle,
    isDeletableMedia,
    mediaDaySections
} from "@/lib/capture-media-management";

/**
 * Every piece of media on one capture, as a grid. Ported from iOS
 * `CaptureMediaGalleryView`.
 *
 * A carousel is the wrong tool past a handful of items: there is no way to see
 * what is there, or to tidy several away at once. This is the overview, and the
 * only place media can be removed in bulk.
 */

const NEON = "#A7F432";

export default function CaptureMediaGallery({
    assets,
    animalName,
    startIndex,
    isWorking,
    onClose,
    onShowInCarousel,
    onMakeCover,
    onRequestDelete
}: {
    /** In carousel order, so an index here is a page there. */
    assets: DiscoverMediaAsset[];
    animalName: string;
    /** The page the carousel was on, scrolled into view when the grid opens. */
    startIndex: number;
    isWorking: boolean;
    onClose: () => void;
    onShowInCarousel: (asset: DiscoverMediaAsset) => void;
    onMakeCover: (mediaRowId: string) => Promise<boolean>;
    onRequestDelete: (mediaRowIds: string[]) => void;
}) {
    const [isSelecting, setIsSelecting] = useState(false);
    const [selection, setSelection] = useState<Set<string>>(() => new Set());
    const [menuAssetId, setMenuAssetId] = useState<string | null>(null);
    const startCellRef = useRef<HTMLDivElement | null>(null);

    const sections = useMemo(() => mediaDaySections(assets), [assets]);
    const deletable = useMemo(() => assets.filter(isDeletableMedia), [assets]);
    const selectedAssets = assets.filter((asset) => selection.has(asset.id));
    const selectedRowIds = selectedAssets
        .map((asset) => asset.mediaRowId)
        .filter((id): id is string => Boolean(id));
    // One cover, so the action only makes sense for exactly one eligible shot.
    const coverCandidate = selectedAssets.length === 1
        && canBecomeCover(selectedAssets[0], assets.indexOf(selectedAssets[0]))
        ? selectedAssets[0]
        : null;

    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        startCellRef.current?.scrollIntoView({block: "center"});
        return () => {
            document.body.style.overflow = previous;
        };
    }, []);

    // Media removed underneath the selection takes its tick with it.
    useEffect(() => {
        setSelection((current) => {
            const present = new Set(assets.map((asset) => asset.id));
            const next = new Set(Array.from(current).filter((id) => present.has(id)));
            return next.size === current.size ? current : next;
        });
        if (!assets.some(isDeletableMedia)) setIsSelecting(false);
    }, [assets]);

    const toggle = (asset: DiscoverMediaAsset) => {
        setSelection((current) => {
            const next = new Set(current);
            if (next.has(asset.id)) next.delete(asset.id);
            else next.add(asset.id);
            return next;
        });
    };

    const allSelected = deletable.length > 0 && deletable.every((asset) => selection.has(asset.id));

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={`${animalName} media`}
            className="fixed inset-0 z-[65] flex flex-col bg-black font-sans"
        >
            <header className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
                {isSelecting ? (
                    <button
                        type="button"
                        onClick={() => setSelection(allSelected ? new Set() : new Set(deletable.map((asset) => asset.id)))}
                        className="min-h-9 text-sm font-semibold"
                        style={{color: NEON}}
                    >
                        {allSelected ? "Deselect All" : "Select All"}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white"
                    >
                        ✕
                    </button>
                )}
                <h2 className="flex-1 text-center text-sm font-bold text-white">
                    {galleryTitle(assets.length, {isSelecting, selectedCount: selection.size})}
                </h2>
                {deletable.length ? (
                    <button
                        type="button"
                        onClick={() => {
                            setIsSelecting((value) => !value);
                            setSelection(new Set());
                            setMenuAssetId(null);
                        }}
                        className="min-h-9 text-sm font-semibold"
                        style={{color: NEON}}
                    >
                        {isSelecting ? "Done" : "Select"}
                    </button>
                ) : <span className="w-9" />}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto pb-6">
                {sections.map((section) => (
                    <section key={section.key}>
                        <h3 className="px-4 pb-2 pt-4 text-[10px] font-black uppercase tracking-[0.12em] text-white/40">
                            {section.title}
                        </h3>
                        <div className="grid grid-cols-3 gap-0.5 sm:grid-cols-4 lg:grid-cols-6">
                            {section.entries.map(({asset, index}) => {
                                const selectable = isDeletableMedia(asset);
                                const selected = selection.has(asset.id);
                                const eligibleCover = canBecomeCover(asset, index);
                                const isMoving = asset.kind !== "photo";
                                const thumb = isMoving ? asset.posterUrl : asset.url;
                                const hasMenu = !isSelecting && (eligibleCover || selectable);

                                return (
                                    <div
                                        key={asset.id}
                                        ref={index === startIndex ? startCellRef : undefined}
                                        className={`relative aspect-square bg-white/[0.04] ${isSelecting && !selectable ? "opacity-40" : ""}`}
                                    >
                                        <button
                                            type="button"
                                            disabled={isSelecting && !selectable}
                                            aria-pressed={isSelecting ? selected : undefined}
                                            aria-label={isSelecting
                                                ? `${selected ? "Deselect" : "Select"} item ${index + 1}`
                                                : `Show item ${index + 1} in carousel`}
                                            onClick={() => {
                                                if (isSelecting) toggle(asset);
                                                else onShowInCarousel(asset);
                                            }}
                                            className="absolute inset-0"
                                        >
                                            {thumb ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="grid h-full w-full place-items-center text-xs text-white/40">No preview</span>
                                            )}
                                        </button>

                                        <div className="pointer-events-none absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                                            {index === 0 && asset.mediaRowId ? (
                                                <span className="rounded-full bg-black/70 px-2 py-1 text-[9px] font-bold" style={{color: NEON}}>★ Cover</span>
                                            ) : null}
                                            {isMoving ? (
                                                <span className="rounded-full bg-black/70 px-2 py-1 text-[9px] font-bold text-white/85">▶ Video</span>
                                            ) : null}
                                        </div>

                                        {isSelecting && selectable ? (
                                            <span
                                                aria-hidden="true"
                                                className={`pointer-events-none absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full border-2 text-xs font-black ${selected ? "border-transparent text-black" : "border-white/80 bg-black/40 text-transparent"}`}
                                                style={selected ? {backgroundColor: NEON} : undefined}
                                            >
                                                ✓
                                            </span>
                                        ) : null}

                                        {isSelecting && !selectable ? (
                                            <span aria-hidden="true" className="pointer-events-none absolute bottom-1.5 right-1.5 text-xs">🔒</span>
                                        ) : null}

                                        {hasMenu ? (
                                            <div className="absolute bottom-1 right-1">
                                                <button
                                                    type="button"
                                                    aria-label={`Options for item ${index + 1}`}
                                                    aria-haspopup="menu"
                                                    aria-expanded={menuAssetId === asset.id}
                                                    onClick={() => setMenuAssetId((current) => (current === asset.id ? null : asset.id))}
                                                    className="grid h-8 w-8 place-items-center rounded-full bg-black/65 text-base font-bold leading-none text-white"
                                                >
                                                    ⋯
                                                </button>
                                                {menuAssetId === asset.id ? (
                                                    <div role="menu" className="absolute bottom-9 right-0 z-10 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#141414] py-1 shadow-2xl">
                                                        <button
                                                            type="button"
                                                            role="menuitem"
                                                            onClick={() => onShowInCarousel(asset)}
                                                            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold text-white"
                                                        >
                                                            Show in Carousel
                                                        </button>
                                                        {eligibleCover && asset.mediaRowId ? (
                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                disabled={isWorking}
                                                                onClick={() => {
                                                                    setMenuAssetId(null);
                                                                    void onMakeCover(asset.mediaRowId as string);
                                                                }}
                                                                className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold text-white disabled:opacity-50"
                                                            >
                                                                Make Cover
                                                            </button>
                                                        ) : null}
                                                        {selectable && asset.mediaRowId ? (
                                                            <button
                                                                type="button"
                                                                role="menuitem"
                                                                disabled={isWorking}
                                                                onClick={() => {
                                                                    setMenuAssetId(null);
                                                                    onRequestDelete([asset.mediaRowId as string]);
                                                                }}
                                                                className="flex min-h-11 w-full items-center border-t border-white/10 px-4 text-left text-sm font-semibold text-red-400 disabled:opacity-50"
                                                            >
                                                                Delete
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>

            {isSelecting ? (
                <div className="flex gap-2 border-t border-white/[0.08] bg-black/90 px-4 py-3">
                    <button
                        type="button"
                        disabled={!coverCandidate?.mediaRowId || isWorking}
                        onClick={() => {
                            if (!coverCandidate?.mediaRowId) return;
                            void onMakeCover(coverCandidate.mediaRowId).then((done) => {
                                if (done) {
                                    setSelection(new Set());
                                    setIsSelecting(false);
                                }
                            });
                        }}
                        className="min-h-12 flex-1 rounded-full border border-white/10 text-sm font-bold text-white disabled:text-white/30"
                    >
                        Make Cover
                    </button>
                    <button
                        type="button"
                        disabled={!selectedRowIds.length || isWorking}
                        onClick={() => onRequestDelete(selectedRowIds)}
                        className="min-h-12 flex-1 rounded-full bg-red-500/90 text-sm font-black text-white disabled:bg-white/10 disabled:text-white/30"
                    >
                        {selectedRowIds.length ? `Delete ${selectedRowIds.length}` : "Delete"}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
