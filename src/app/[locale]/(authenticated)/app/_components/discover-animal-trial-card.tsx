"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import type {DiscoverAnimalTrialItem, DiscoverCollectorRef} from "@/data/discover-timeline";
import {
    ANIMAL_TRIAL_COHORT_PAGE_SIZE,
    animalTrialAccessibilityLabel,
    animalTrialPeerSummary,
    animalTrialPeers,
    animalTrialPills,
    animalTrialStatusLabel,
    isWrittenAnimalTrialPost,
    pinnedAnimalTrialCohort
} from "@/lib/discover-animal-trial";

/**
 * An Animal Trial on the Discover timeline. Ported from iOS
 * `DiscoverAnimalTrialTimelineCardView`.
 *
 * The evidence still is the post. The person, the Trial and what it earned
 * are laid over it, and the card pages sideways through other people's posts
 * for the same index once they have loaded — the post that was on screen
 * stays first, so a page turn never moves it.
 */

const PEERS_VISIBLE_LIMIT = 3;

function PeerAvatarStack({peers}: {peers: DiscoverCollectorRef[]}) {
    const label = animalTrialPeerSummary(peers.map((peer) => peer.name));
    if (!label) return null;
    const visible = peers.slice(0, PEERS_VISIBLE_LIMIT);
    const overflow = peers.length - visible.length;

    return (
        <span className="flex items-center gap-1" title={label} aria-label={label}>
            <span className="flex items-center" aria-hidden="true">
                {visible.map((peer, index) => (
                    <span key={peer.userId || `${peer.name}-${index}`} className="-ml-1.5 first:ml-0" style={{zIndex: visible.length - index}}>
                        {peer.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={peer.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover ring-1 ring-black/80" />
                        ) : (
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[0.55rem] font-bold text-white ring-1 ring-black/80">
                                {peer.name.slice(0, 1)}
                            </span>
                        )}
                    </span>
                ))}
            </span>
            {overflow > 0 ? <span aria-hidden="true" className="font-mono text-[0.62rem] font-bold text-white/70">+{overflow}</span> : null}
        </span>
    );
}

function CollectorIdentity({collector}: {collector: DiscoverCollectorRef}) {
    const body = (
        <span className="flex items-center gap-2.5">
            {collector.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={collector.avatarUrl} alt="" className="h-[34px] w-[34px] rounded-full object-cover ring-[1.25px] ring-white/20" />
            ) : (
                <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-white/15 text-xs font-bold text-white ring-[1.25px] ring-white/20">
                    {collector.name.slice(0, 1)}
                </span>
            )}
            <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-white">{collector.name}</span>
                {collector.username ? <span className="block truncate text-[0.68rem] text-white/70">@{collector.username}</span> : null}
            </span>
        </span>
    );
    return collector.href
        ? <Link href={collector.href} className="min-w-0 max-w-[190px]">{body}</Link>
        : <span className="min-w-0 max-w-[190px]">{body}</span>;
}

export function AnimalTrialEvidence({item, className = ""}: {item: DiscoverAnimalTrialItem; className?: string}) {
    return item.evidenceSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.evidenceSrc} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />
    ) : (
        <div
            aria-hidden="true"
            className={`h-full w-full bg-[linear-gradient(135deg,#0a1f0f_0%,#161616_55%,#000_100%)] ${className}`}
        />
    );
}

export default function AnimalTrialCard({
    item,
    viewerUserId
}: {
    item: DiscoverAnimalTrialItem;
    viewerUserId: string | null;
}) {
    const [cohort, setCohort] = useState<DiscoverAnimalTrialItem[]>([item]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [hasLoadedCohort, setHasLoadedCohort] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Like the phone, the cohort is only read once the card has actually been
    // on screen for a moment; a fast scroll past it costs nothing.
    useEffect(() => {
        const root = rootRef.current;
        if (!root || hasLoadedCohort || typeof IntersectionObserver === "undefined") return;
        let timer: number | null = null;
        let cancelled = false;
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.some((entry) => entry.isIntersecting);
            if (visible && timer == null) {
                timer = window.setTimeout(async () => {
                    try {
                        const response = await fetch(
                            `/api/discover/animal-trial-cohort?species=${encodeURIComponent(item.speciesProfileId)}&limit=${ANIMAL_TRIAL_COHORT_PAGE_SIZE}`
                        );
                        const payload = await response.json().catch(() => ({})) as {items?: DiscoverAnimalTrialItem[]};
                        if (!cancelled && Array.isArray(payload.items)) {
                            setCohort(pinnedAnimalTrialCohort(item, payload.items));
                        }
                    } catch {
                        // The single post still reads fine on its own.
                    } finally {
                        if (!cancelled) setHasLoadedCohort(true);
                    }
                }, 900);
            } else if (!visible && timer != null) {
                window.clearTimeout(timer);
                timer = null;
            }
        }, {threshold: 0.5});
        observer.observe(root);
        return () => {
            cancelled = true;
            if (timer != null) window.clearTimeout(timer);
            observer.disconnect();
        };
    }, [item, hasLoadedCohort]);

    const current = cohort[Math.min(selectedIndex, cohort.length - 1)] ?? item;
    const peers = useMemo(() => animalTrialPeers(current, cohort), [current, cohort]);
    const pills = animalTrialPills(current);
    const isWritten = isWrittenAnimalTrialPost(current);
    const isOwn = viewerUserId != null && viewerUserId === current.collector.userId;

    return (
        <div
            ref={rootRef}
            className="relative aspect-[4/5] max-h-[34rem] w-full overflow-hidden bg-black"
            role="group"
            aria-label={animalTrialAccessibilityLabel(current)}
        >
            <AnimalTrialEvidence key={current.id} item={current} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0)_38%,rgba(0,0,0,0.72)_100%)]" />

            <div className="absolute inset-0 flex flex-col px-4 pb-4 pt-3">
                <div className="flex items-start justify-between gap-3">
                    <CollectorIdentity collector={current.collector} />
                    <div className="flex flex-col items-end gap-1.5">
                        {isOwn ? <span className="rounded-full bg-white/15 px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.12em] text-white">You</span> : null}
                        <PeerAvatarStack peers={peers} />
                    </div>
                </div>

                <div className="mt-auto space-y-1">
                    <p className={`text-[0.68rem] font-black uppercase tracking-[0.14em] ${current.isFailed ? "text-orange-400" : "text-primary-200"}`}>
                        {animalTrialStatusLabel(current)}
                    </p>
                    {isWritten ? (
                        <p className="line-clamp-[8] whitespace-pre-line text-sm leading-6 text-white">{current.title}</p>
                    ) : (
                        <h3 className="font-display text-[1.75rem] font-extrabold leading-[1.05] text-white">{current.title}</h3>
                    )}
                    <Link href={current.href} className="block text-sm font-semibold text-white/[0.82] hover:text-primary-100">
                        {current.speciesName}
                    </Link>
                    {current.principleName ? <p className="text-[0.68rem] text-white/70">{current.principleName}</p> : null}
                    {pills.length ? (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {pills.map((pill) => (
                                <span
                                    key={pill.text}
                                    className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black ${pill.tone === "fail" ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-400/40" : "bg-primary-400/15 text-primary-100 ring-1 ring-primary-400/25"}`}
                                >
                                    {pill.text}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>

            {cohort.length > 1 ? (
                <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-2">
                    <button
                        type="button"
                        aria-label="Previous Trial post"
                        disabled={selectedIndex === 0}
                        onClick={() => setSelectedIndex((index) => Math.max(0, index - 1))}
                        className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white disabled:opacity-0"
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        aria-label="Next Trial post"
                        disabled={selectedIndex >= cohort.length - 1}
                        onClick={() => setSelectedIndex((index) => Math.min(cohort.length - 1, index + 1))}
                        className="grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white disabled:opacity-0"
                    >
                        ›
                    </button>
                </div>
            ) : null}
            {cohort.length > 1 ? (
                <p className="pointer-events-none absolute right-3 top-14 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[0.62rem] font-bold text-white/80">
                    {selectedIndex + 1}/{cohort.length}
                </p>
            ) : null}
        </div>
    );
}
