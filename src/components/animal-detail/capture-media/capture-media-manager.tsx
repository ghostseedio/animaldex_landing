"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {MediaCarousel} from "@/app/[locale]/(authenticated)/app/discover-timeline-cards";
import type {DiscoverMediaAsset} from "@/data/discover-timeline";
import {
    DELETE_CONFIRM_MESSAGE,
    canBecomeCover,
    deleteConfirmAction,
    deleteConfirmTitle,
    isDeletableMedia,
    mediaKindBadge
} from "@/lib/capture-media-management";
import CaptureMediaGallery from "@/components/animal-detail/capture-media/capture-media-gallery";

/**
 * The owner's hero: the capture's media, and what they may do to it. Ported
 * from iOS `ScanResultCatalogHeroView`.
 *
 * Only ever mounted on a card its viewer owns. Every action goes to the server,
 * which decides again — this component chooses what to offer, never what is
 * allowed.
 */

const NEON = "#A7F432";

function Pill({children, tone = "state"}: {children: React.ReactNode; tone?: "analysis" | "extra" | "state"}) {
    const className = tone === "analysis"
        ? "bg-[#A7F432] text-black/80"
        : tone === "extra"
            ? "bg-white/80 text-black/80"
            : "bg-black/65 text-[#A7F432]";
    return (
        <span className={`rounded-full px-2.5 py-[7px] text-[10px] font-semibold leading-none ${className}`}>
            {children}
        </span>
    );
}

export default function CaptureMediaManager({
    captureId,
    animalName,
    assets,
    isUncertain = false,
    isMarkedAsPet,
    canMarkAsPet
}: {
    captureId: string;
    animalName: string;
    /** In detail order: the persisted cover is page zero. */
    assets: DiscoverMediaAsset[];
    isUncertain?: boolean;
    isMarkedAsPet: boolean;
    canMarkAsPet: boolean;
}) {
    const router = useRouter();
    const [media, setMedia] = useState(assets);
    const [activeAssetId, setActiveAssetId] = useState<string | null>(assets[0]?.id ?? null);
    const [isPet, setIsPet] = useState(isMarkedAsPet);
    const [showsMenu, setShowsMenu] = useState(false);
    const [galleryStartIndex, setGalleryStartIndex] = useState<number | null>(null);
    const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
    const [isWorking, setIsWorking] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [focusRequest, setFocusRequest] = useState<{assetId: string; nonce: number} | null>(null);
    const menuRef = useRef<HTMLDivElement | null>(null);

    // The server's list is the truth; a refresh after any change replaces the
    // optimistic one.
    useEffect(() => setMedia(assets), [assets]);
    useEffect(() => setIsPet(isMarkedAsPet), [isMarkedAsPet]);

    useEffect(() => {
        if (!showsMenu) return undefined;
        const onPointerDown = (event: PointerEvent) => {
            if (!menuRef.current?.contains(event.target as Node)) setShowsMenu(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setShowsMenu(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [showsMenu]);

    const activeIndex = Math.max(0, media.findIndex((asset) => asset.id === activeAssetId));
    const activeAsset = media[activeIndex] ?? null;
    const canSetActiveAsCover = Boolean(activeAsset && canBecomeCover(activeAsset, activeIndex));
    const canDeleteActive = Boolean(activeAsset && isDeletableMedia(activeAsset));
    const hasActions = canSetActiveAsCover || canMarkAsPet || canDeleteActive || media.length > 1;
    const isMovingMedia = activeAsset?.kind === "video" || activeAsset?.kind === "loop";

    const handleActiveAssetChange = useCallback((asset: DiscoverMediaAsset | null) => {
        setActiveAssetId(asset?.id ?? null);
    }, []);

    const makeCover = useCallback(async (mediaRowId: string) => {
        setIsWorking(true);
        setErrorMessage(null);
        try {
            const response = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}/media/cover`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({mediaRowId})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setErrorMessage(payload.error ?? "That change did not go through. Try again in a moment.");
                return false;
            }
            // Page zero is always the cover, so the chosen shot moves to the front.
            const chosen = media.find((asset) => asset.mediaRowId === mediaRowId);
            if (chosen) setFocusRequest({assetId: chosen.id, nonce: Date.now()});
            router.refresh();
            return true;
        } catch {
            setErrorMessage("That change did not go through. Try again in a moment.");
            return false;
        } finally {
            setIsWorking(false);
        }
    }, [captureId, media, router]);

    const deleteMedia = useCallback(async (mediaRowIds: string[]) => {
        if (!mediaRowIds.length) return;
        const before = media;
        setIsWorking(true);
        setErrorMessage(null);
        // Optimistic, as on iOS: the grid empties at once and anything the
        // server refused is put back with one message.
        setMedia(before.filter((asset) => !asset.mediaRowId || !mediaRowIds.includes(asset.mediaRowId)));
        try {
            const response = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}/media/delete`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({mediaRowIds})
            });
            const payload = await response.json().catch(() => ({}));
            const deleted: string[] = Array.isArray(payload.deleted) ? payload.deleted : [];
            if (!response.ok || deleted.length < mediaRowIds.length) {
                setMedia(before.filter((asset) =>
                    !asset.mediaRowId || !deleted.includes(asset.mediaRowId.toLowerCase())));
                setErrorMessage(
                    deleted.length
                        ? "Some media could not be removed."
                        : payload.error ?? "That media could not be removed. Try again in a moment."
                );
            }
            router.refresh();
        } catch {
            setMedia(before);
            setErrorMessage("That media could not be removed. Try again in a moment.");
        } finally {
            setIsWorking(false);
        }
    }, [captureId, media, router]);

    const togglePet = useCallback(async () => {
        const next = !isPet;
        setIsWorking(true);
        setErrorMessage(null);
        setIsPet(next);
        try {
            const response = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}/pet`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({isPet: next})
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                setIsPet(!next);
                setErrorMessage(payload.error ?? "That change did not go through. Try again in a moment.");
                return;
            }
            router.refresh();
        } catch {
            setIsPet(!next);
            setErrorMessage("That change did not go through. Try again in a moment.");
        } finally {
            setIsWorking(false);
        }
    }, [captureId, isPet, router]);

    const menuItems = useMemo(() => [
        media.length > 1 ? {
            key: "browse",
            label: `Browse All (${media.length})`,
            action: () => setGalleryStartIndex(activeIndex)
        } : null,
        canSetActiveAsCover && activeAsset?.mediaRowId ? {
            key: "cover",
            label: "Make Cover",
            action: () => void makeCover(activeAsset.mediaRowId as string)
        } : null,
        canMarkAsPet ? {
            key: "pet",
            label: isPet ? "Remove as Pet" : "Mark as Pet",
            action: () => void togglePet()
        } : null,
        canDeleteActive && activeAsset?.mediaRowId ? {
            key: "delete",
            label: "Delete Media",
            destructive: true,
            action: () => setPendingDelete([activeAsset.mediaRowId as string])
        } : null
    ].filter((item): item is NonNullable<typeof item> => item !== null),
    [activeAsset, activeIndex, canDeleteActive, canMarkAsPet, canSetActiveAsCover, isPet, makeCover, media.length, togglePet]);

    return (
        <div className="absolute inset-0">
            <MediaCarousel
                assets={media}
                animalName={animalName}
                isUncertain={isUncertain}
                layout="hero"
                onActiveAssetChange={handleActiveAssetChange}
                focusRequest={focusRequest}
                onBrowseAll={(index) => setGalleryStartIndex(index)}
            />

            {/* State only, so it never takes a tap from the media beneath it. */}
            {activeAsset ? (
                <div className={`pointer-events-none absolute left-3 z-20 flex flex-wrap items-center gap-1.5 ${isMovingMedia ? "top-12" : "top-3"}`}>
                    <Pill tone={mediaKindBadge(activeAsset) === "Analysis image" ? "analysis" : "extra"}>
                        {mediaKindBadge(activeAsset)}
                    </Pill>
                    {/* Carousel invariant: page zero is always the cover. */}
                    {activeIndex === 0 && activeAsset.mediaRowId && media.length > 1 ? <Pill>★ Cover</Pill> : null}
                    {isPet && canMarkAsPet ? <Pill>Pet</Pill> : null}
                </div>
            ) : null}

            {hasActions ? (
                <div ref={menuRef} className={`absolute right-3 z-30 ${isUncertain ? "top-14" : "top-3"}`}>
                    <button
                        type="button"
                        onClick={() => setShowsMenu((value) => !value)}
                        disabled={isWorking}
                        aria-label="Media options"
                        aria-haspopup="menu"
                        aria-expanded={showsMenu}
                        className="grid h-9 w-9 place-items-center rounded-full bg-black/65 text-lg font-bold leading-none ring-1 ring-white/10 disabled:opacity-60"
                        style={{color: NEON}}
                    >
                        {isWorking ? "…" : "⋯"}
                    </button>
                    {showsMenu ? (
                        <div
                            role="menu"
                            className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#141414] py-1 shadow-2xl"
                        >
                            {menuItems.map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                        setShowsMenu(false);
                                        item.action();
                                    }}
                                    className={`flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold ${
                                        "destructive" in item && item.destructive
                                            ? "border-t border-white/10 text-red-400"
                                            : "text-white"
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {errorMessage ? (
                <p role="alert" className="absolute inset-x-3 top-16 z-20 rounded-xl bg-black/80 px-3 py-2 text-center text-xs font-semibold text-orange-300 ring-1 ring-orange-300/20">
                    {errorMessage}
                </p>
            ) : null}

            {galleryStartIndex != null ? (
                <CaptureMediaGallery
                    assets={media}
                    animalName={animalName}
                    startIndex={galleryStartIndex}
                    isWorking={isWorking}
                    onClose={() => setGalleryStartIndex(null)}
                    onShowInCarousel={(asset) => {
                        setGalleryStartIndex(null);
                        setFocusRequest({assetId: asset.id, nonce: Date.now()});
                    }}
                    onMakeCover={(mediaRowId) => makeCover(mediaRowId)}
                    onRequestDelete={(mediaRowIds) => setPendingDelete(mediaRowIds)}
                />
            ) : null}

            {pendingDelete ? (
                <div
                    role="alertdialog"
                    aria-modal="true"
                    aria-label={deleteConfirmTitle(pendingDelete.length)}
                    className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center"
                >
                    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#141414] p-5">
                        <h3 className="text-base font-bold text-white">{deleteConfirmTitle(pendingDelete.length)}</h3>
                        <p className="mt-2 text-sm leading-6 text-white/60">{DELETE_CONFIRM_MESSAGE}</p>
                        <div className="mt-5 flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const ids = pendingDelete;
                                    setPendingDelete(null);
                                    void deleteMedia(ids);
                                }}
                                className="min-h-12 rounded-full bg-red-500/90 text-sm font-black text-white"
                            >
                                {deleteConfirmAction(pendingDelete.length)}
                            </button>
                            <button
                                type="button"
                                onClick={() => setPendingDelete(null)}
                                className="min-h-12 rounded-full border border-white/10 text-sm font-bold text-white/80"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
