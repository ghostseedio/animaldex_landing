"use client";

import {type ReactNode, type TouchEvent, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {AskSubjectBridge} from "@/components/ask-animaldex/ask-animaldex-provider";
import Image from "next/image";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import CaptureGradeBadge from "@/app/[locale]/(authenticated)/app/_components/capture-grade-badge";
import CaptureGiftsPanel from "@/app/[locale]/(authenticated)/app/_components/capture-gifts-panel";
import {MediaCarousel} from "@/app/[locale]/(authenticated)/app/discover-timeline-cards";
import AnimalDetailTabBar, {type AnimalDetailTab} from "@/components/animal-detail/animal-detail-tab-bar";
import AnimalStoryCard, {type AnimalStoryPrinciple} from "@/components/animal-detail/animal-story-card";
import AnimalStatsPanel from "@/components/animal-detail/animal-stats-panel";
import SystemDynamicsSection from "@/components/animal-detail/system-dynamics/system-dynamics-section";
import AnimalTrialsSection from "@/components/animal-detail/animal-trials/animal-trials-section";
import CaptureMetadataBand from "@/components/animal-detail/capture-metadata-band";
import type {AppCaptureDetail} from "@/data/authenticated-app";
import type {DiscoverCaptureItem, DiscoverCollectorRef, DiscoverMediaAsset} from "@/data/discover-timeline";

export type CaptureDetailViewer = {
    userId: string | null;
    isOwner: boolean;
};

type CaptureDetailClientProps = {
    capture: AppCaptureDetail;
    viewer: CaptureDetailViewer;
    /** Community photographer when the card is not the viewer's (iOS `AnimalDetailRoute.spotter`). */
    spotter: DiscoverCollectorRef | null;
    mediaAssets: DiscoverMediaAsset[];
    /** Ranking cohort used for left/right paging across sibling captures. */
    cohort: {speciesProfileId: string | null; normalizedIdentityKey: string | null};
    isChallengeAvailable: boolean;
    speciesSlug?: string | null;
    speciesName: string;
    descriptor?: string | null;
    story?: string | null;
    principle?: AnimalStoryPrinciple | null;
    rankings?: ReactNode;
    nativeRange?: ReactNode;
    play?: ReactNode;
};

type CohortPage = {
    ids: string[];
    hasMore: boolean;
    nextOffset: number | null;
};

const COHORT_PAGE_SIZE = 10;

function detailText(details: Record<string, any> | null, ...keys: string[]) {
    for (const key of keys) {
        const value = details?.[key];

        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return null;
}

function detailList(details: Record<string, any> | null, ...keys: string[]) {
    for (const key of keys) {
        const value = details?.[key];

        if (Array.isArray(value)) {
            return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
        }
    }

    return [];
}

/** iOS photographer row: "Spotted by" avatar · name · handle → profile. */
function SpottedByRow({spotter}: {spotter: DiscoverCollectorRef}) {
    const avatar = spotter.avatarUrl ? (
        <img src={spotter.avatarUrl} alt="" className="h-[34px] w-[34px] shrink-0 rounded-full object-cover ring-1 ring-white/[0.12]" />
    ) : (
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white/70 ring-1 ring-white/[0.12]">
            {spotter.name.slice(0, 1)}
        </span>
    );
    const body = (
        <>
            {avatar}
            <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold text-white/40">Spotted by</span>
                <span className="block truncate text-sm font-bold text-white">{spotter.name}</span>
                {spotter.username ? <span className="block truncate text-[11px] font-semibold text-white/55">@{spotter.username}</span> : null}
            </span>
            <AppIcon name="chevron" className="h-4 w-4 shrink-0 text-white/35" />
        </>
    );
    const className = "-mx-5 flex items-center gap-2.5 border-t border-white/[0.06] px-5 py-3.5";

    return spotter.href
        ? <Link href={spotter.href} className={`${className} transition hover:bg-white/[0.03]`}>{body}</Link>
        : <div className={className}>{body}</div>;
}

export default function CaptureDetailClient({
    capture,
    viewer,
    spotter,
    mediaAssets,
    cohort,
    isChallengeAvailable,
    speciesSlug,
    speciesName,
    descriptor,
    story,
    principle,
    rankings,
    nativeRange,
    play
}: CaptureDetailClientProps) {
    const router = useRouter();
    const [tab, setTab] = useState<AnimalDetailTab>("learn");
    const [cohortPage, setCohortPage] = useState<CohortPage>({ids: [capture.id], hasMore: false, nextOffset: null});
    const [isLoadingCohort, setIsLoadingCohort] = useState(false);
    const heroTouchStartRef = useRef<{x: number; y: number} | null>(null);
    const fallbackStory = detailText(capture.premiumDetails, "species_subtitle_story", "speciesSubtitleStory", "summary", "overview");
    const fallbackPrincipleName = detailText(capture.premiumDetails, "principle_name", "principleName", "animal_power", "animalPower");
    const resolvedPrinciple = useMemo<AnimalStoryPrinciple | null>(() => principle ?? (fallbackPrincipleName ? {
        name: fallbackPrincipleName,
        motto: detailText(capture.premiumDetails, "short_motto", "shortMotto", "motto"),
        expression: detailText(capture.premiumDetails, "principle_expression", "principleExpression"),
        coreLesson: detailText(capture.premiumDetails, "core_lesson", "coreLesson", "lesson"),
        biologicalBasis: detailText(capture.premiumDetails, "biological_basis", "biologicalBasis"),
        applicationExample: detailText(capture.premiumDetails, "application_example", "applicationExample"),
        bestUseCases: detailList(capture.premiumDetails, "best_use_cases", "bestUseCases")
    } : null), [capture.premiumDetails, fallbackPrincipleName, principle]);
    const resolvedSpeciesSlug = speciesSlug ?? capture.speciesSlug?.replace(/_/g, "-") ?? "animal";
    const isSignedIn = Boolean(viewer.userId);
    const canInteract = isSignedIn && !viewer.isOwner;
    const canOffer = canInteract && !capture.hasUncertaintyFallback;
    const canCompare = canInteract && isChallengeAvailable;

    // iOS RankedAnimalDetailPagerView pages across the ranking cohort. The
    // sibling window is fetched after the first paint so the open stays cheap.
    const fetchCohort = useCallback(async (offset: number) => {
        const params = new URLSearchParams({
            captureId: capture.id,
            limit: String(COHORT_PAGE_SIZE),
            offset: String(offset)
        });
        if (cohort.speciesProfileId) params.set("speciesProfileId", cohort.speciesProfileId);
        if (cohort.normalizedIdentityKey) params.set("normalizedIdentityKey", cohort.normalizedIdentityKey);
        const response = await fetch(`/api/app/discover/ranking-siblings?${params.toString()}`, {headers: {Accept: "application/json"}});
        if (!response.ok) return null;
        return await response.json() as {items?: DiscoverCaptureItem[]; hasMore?: boolean; nextOffset?: number | null};
    }, [capture.id, cohort.normalizedIdentityKey, cohort.speciesProfileId]);

    useEffect(() => {
        if (viewer.isOwner || (!cohort.speciesProfileId && !cohort.normalizedIdentityKey)) return undefined;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            void fetchCohort(0).then((payload) => {
                if (cancelled || !payload) return;
                const siblingIds = (payload.items ?? []).map((item) => item.captureId).filter((id) => id !== capture.id);
                if (!siblingIds.length) return;
                // Keep the visible card in slot zero, as iOS does, so the pager
                // never snaps away from what the user is already reading.
                setCohortPage({
                    ids: [capture.id, ...siblingIds],
                    hasMore: Boolean(payload.hasMore),
                    nextOffset: payload.nextOffset ?? null
                });
            });
        }, 280);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [capture.id, cohort.normalizedIdentityKey, cohort.speciesProfileId, fetchCohort, viewer.isOwner]);

    const currentIndex = Math.max(0, cohortPage.ids.indexOf(capture.id));
    const showsPager = cohortPage.ids.length > 1;

    const openSibling = useCallback((id: string) => {
        // Replace, not push: the pager is one sheet on iOS, so Back should
        // return to wherever the detail was opened from.
        router.replace(`/app/capture/${encodeURIComponent(id)}`);
    }, [router]);

    const selectPrevious = useCallback(() => {
        if (currentIndex <= 0) return;
        openSibling(cohortPage.ids[currentIndex - 1]);
    }, [cohortPage.ids, currentIndex, openSibling]);

    const selectNext = useCallback(async () => {
        if (currentIndex < cohortPage.ids.length - 1) {
            openSibling(cohortPage.ids[currentIndex + 1]);
            return;
        }
        if (!cohortPage.hasMore || cohortPage.nextOffset == null || isLoadingCohort) return;
        setIsLoadingCohort(true);
        try {
            const payload = await fetchCohort(cohortPage.nextOffset);
            const appended = (payload?.items ?? []).map((item) => item.captureId).filter((id) => !cohortPage.ids.includes(id));
            setCohortPage((current) => ({
                ids: [...current.ids, ...appended],
                hasMore: Boolean(payload?.hasMore),
                nextOffset: payload?.nextOffset ?? null
            }));
            if (appended[0]) openSibling(appended[0]);
        } finally {
            setIsLoadingCohort(false);
        }
    }, [cohortPage, currentIndex, fetchCohort, isLoadingCohort, openSibling]);

    const close = useCallback(() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }
        router.push("/app");
    }, [router]);

    const handleHeroTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
        const touch = event.touches[0];
        heroTouchStartRef.current = touch ? {x: touch.clientX, y: touch.clientY} : null;
    }, []);

    const handleHeroTouchEnd = useCallback((event: TouchEvent<HTMLElement>) => {
        const start = heroTouchStartRef.current;
        heroTouchStartRef.current = null;
        const touch = event.changedTouches[0];
        if (!start || !touch) return;
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        // Pull the hero down at the top of the page to close (iOS hero band);
        // horizontal swipes page the cohort only on single-media heroes so a
        // media carousel keeps owning that axis.
        if (dy > 110 && dy > Math.abs(dx) * 1.25 && window.scrollY <= 4) {
            close();
            return;
        }
        if (mediaAssets.length > 1 || !showsPager) return;
        if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
        if (dx < 0) void selectNext();
        else selectPrevious();
    }, [close, mediaAssets.length, selectNext, selectPrevious, showsPager]);

    const nextDisabled = currentIndex >= cohortPage.ids.length - 1 && !cohortPage.hasMore;
    const showsHeroCarousel = mediaAssets.length > 1 || mediaAssets.some((asset) => asset.kind !== "photo");

    return (
        <div className="mx-auto w-full max-w-[88rem] pb-12">
            {/* iOS toolbar: Done/close on the leading edge; the pager chrome sits at the bottom. */}
            <div className="mb-4 flex items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08]"
                >
                    <AppIcon name="close" />
                </button>
                {viewer.isOwner ? (
                    <Link href="/app/collection" className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold text-primary-200">
                        <AppIcon name="collection" /> Collection
                    </Link>
                ) : null}
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] xl:gap-8">
                {/* The reader's own photo is on screen here, which is the one
                    surface where the assistant may point into a picture. */}
                <AskSubjectBridge
                    scope="species"
                    slug={resolvedSpeciesSlug}
                    name={speciesName}
                    captureId={capture.id}
                    photoUrl={capture.imageSrc}
                    title={capture.animalName}
                    summary={descriptor ?? null}
                />

                <section
                    onTouchStart={handleHeroTouchStart}
                    onTouchEnd={handleHeroTouchEnd}
                    className="relative aspect-[4/5] max-h-[48rem] overflow-hidden rounded-[2rem] border border-white/10 bg-black lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:aspect-auto"
                >
                    {showsHeroCarousel ? (
                        <div className="absolute inset-0">
                            <MediaCarousel assets={mediaAssets} animalName={capture.animalName} isUncertain={capture.hasUncertaintyFallback} layout="hero" />
                        </div>
                    ) : (
                        <Image
                            src={capture.imageSrc}
                            alt={capture.animalName}
                            fill
                            priority
                            sizes="(min-width: 1024px) 42vw, 100vw"
                            className="object-cover"
                        />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/15" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-7">
                        <div className="mb-3 flex flex-wrap items-center gap-2 [&>*]:pointer-events-auto">
                            {capture.captureGrade != null ? (
                                <CaptureGradeBadge grade={capture.captureGrade} breakdown={capture.gradeBreakdown} />
                            ) : null}
                            {capture.settingTag ? (
                                <span className="rounded-full bg-[#A7F432] px-3 py-1.5 text-xs font-black text-black">
                                    {capture.settingTag}
                                </span>
                            ) : null}
                        </div>
                        <h1 className="font-display text-4xl font-bold text-white sm:text-5xl xl:text-6xl">{capture.animalName}</h1>
                        {capture.scientificName ? (
                            <p className="mt-1 text-sm italic text-white/55 sm:text-base">{capture.scientificName}</p>
                        ) : null}
                        {descriptor ? (
                            <p className="mt-2 max-w-2xl text-[15px] font-medium leading-6 text-white/[0.62]">{descriptor}</p>
                        ) : null}
                    </div>
                </section>

                <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-black font-sans">
                    <div className="px-5 pt-5">
                        <AnimalDetailTabBar value={tab} onChange={setTab} />
                    </div>

                    <div
                        role="tabpanel"
                        aria-label="Learn"
                        hidden={tab !== "learn"}
                        className={tab === "learn" ? "mt-5 px-5 pb-5" : "hidden"}
                    >
                        <div className="-mx-5">
                            <AnimalStoryCard
                                contentKey={`${capture.id}:${resolvedSpeciesSlug}`}
                                story={story ?? fallbackStory}
                                principle={resolvedPrinciple}
                                settingTag={capture.settingTag}
                            />
                        </div>
                        {rankings ? <div className="mt-5">{rankings}</div> : null}
                        {spotter ? <div className="mt-5"><SpottedByRow spotter={spotter} /></div> : null}
                        <div className="mt-5">
                            <CaptureMetadataBand
                                captureId={capture.id}
                                capturedAt={capture.createdAt}
                                locationLabel={capture.locationLabel}
                                locationHref={capture.locationLat != null && capture.locationLng != null
                                    ? `https://www.google.com/maps/search/?api=1&query=${capture.locationLat},${capture.locationLng}`
                                    : null}
                            />
                            {nativeRange ? <div className="-mx-5">{nativeRange}</div> : null}
                        </div>
                        <div className="mt-5">
                            <SystemDynamicsSection
                                speciesProfileId={cohort.speciesProfileId}
                                animalName={speciesName}
                            />
                        </div>
                    </div>

                    <div
                        role="tabpanel"
                        aria-label="Stats"
                        hidden={tab !== "stats"}
                        className={tab === "stats" ? "mt-5 px-5 pb-5" : "hidden"}
                    >
                        {capture.isEligibleCapture && !capture.hasUncertaintyFallback ? (
                            <AnimalStatsPanel
                                speciesName={speciesName}
                                speciesSlug={resolvedSpeciesSlug}
                                baseStats={capture.baseGameStats}
                                effectiveStats={capture.effectiveGameStats}
                                totalProgressionXP={capture.totalProgressionXP}
                                recentProgressionSource={capture.recentProgressionSource}
                                captureGrade={capture.captureGrade}
                                settingTag={capture.settingTag}
                                conservationTier={capture.conservationTier}
                            />
                        ) : null}
                        {capture.isDiscoverable ? <CaptureGiftsPanel captureId={capture.id} canSend={canInteract} /> : null}
                    </div>

                    <div
                        role="tabpanel"
                        aria-label="Play"
                        hidden={tab !== "play"}
                        className={tab === "play" ? "mt-5 px-5 pb-5" : "hidden"}
                    >
                        <div className="-mx-5 mb-5">
                            <AnimalTrialsSection speciesProfileId={cohort.speciesProfileId} />
                        </div>
                        {play}
                        {!viewer.isOwner ? (
                            // iOS Play tab for another collector's card: Offer + Compare
                            // buttons and the challenge-availability line.
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <p className="text-sm font-black text-white">Challenge this animal</p>
                                <p className="mt-1 text-xs leading-5 text-white/55">
                                    {capture.isZooComparisonBanned
                                        ? "Zoo captures can't be compared."
                                        : isChallengeAvailable
                                            ? `${capture.challengeHealth} of 3 hearts left · stake ${capture.challengeStake} credits`
                                            : "This animal isn't accepting comparisons right now."}
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {isSignedIn ? (
                                        <>
                                            <Link
                                                href={canCompare ? `/app/matchups?target=${encodeURIComponent(capture.id)}` : "/app/matchups"}
                                                aria-disabled={!canCompare}
                                                className={`inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black ${canCompare ? "bg-primary-400 text-black" : "pointer-events-none bg-white/10 text-white/35"}`}
                                            >
                                                <AppIcon name="arena" /> Compare
                                            </Link>
                                            {canOffer ? (
                                                <Link href={`/app/trades?theirCapture=${encodeURIComponent(capture.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white">
                                                    <AppIcon name="trade" /> Offer
                                                </Link>
                                            ) : null}
                                        </>
                                    ) : (
                                        <Link href="/account" className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-primary-400 px-4 text-sm font-black text-black">
                                            <AppIcon name="profile" /> Sign in to compare
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </section>
            </div>

            {showsPager ? (
                // iOS `rankedPagerChrome`: ‹ n / N › pinned above the tab bar.
                <div className="pointer-events-none fixed inset-x-0 bottom-[5.25rem] z-30 flex justify-center lg:bottom-6">
                    <div className="pointer-events-auto flex items-center gap-3.5 rounded-full bg-black/60 p-1.5 backdrop-blur-md">
                        <button
                            type="button"
                            onClick={selectPrevious}
                            disabled={currentIndex <= 0}
                            aria-label="Previous capture"
                            className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white disabled:opacity-35"
                        >
                            <AppIcon name="back" className="h-4 w-4" />
                        </button>
                        <span className="rounded-full border border-white/[0.12] bg-black/45 px-3 py-1.5 font-mono text-[11px] font-semibold text-white/[0.92]">
                            {currentIndex + 1} / {cohortPage.ids.length}{cohortPage.hasMore ? "+" : ""}
                        </span>
                        <button
                            type="button"
                            onClick={() => void selectNext()}
                            disabled={nextDisabled || isLoadingCohort}
                            aria-label="Next capture"
                            className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white disabled:opacity-35"
                        >
                            <AppIcon name="chevron" className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
