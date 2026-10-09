"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import CaptureGradeBadge from "@/app/[locale]/(authenticated)/app/_components/capture-grade-badge";
import DiscoverCaptureActions from "@/app/[locale]/(authenticated)/app/_components/discover-capture-actions";
import ShareDiscoverPostButton from "@/app/[locale]/p/[postId]/share-discover-post-button";
import AnimalTrialCard, { AnimalTrialEvidence } from "@/app/[locale]/(authenticated)/app/_components/discover-animal-trial-card";
import { animalTrialFrequencyLabel } from "@/lib/discover-animal-trial";
import {
  OVERALL_DRAW_LINE,
  VOTE_RULE_LINE,
  VOTING_TIMEOUT_FALLBACK_LINE,
  roundWinnerText as battleRoundWinnerText,
  voteProgressText,
} from "@/lib/matchup-battle-rules";
import type {
  DiscoverAlignmentItem,
  DiscoverAnimalTrialItem,
  DiscoverCaptureItem,
  DiscoverChallengeItem,
  DiscoverChallengeParticipant,
  DiscoverCollectorRef,
  DiscoverFusionItem,
  DiscoverMediaAsset,
  DiscoverTimelineItem,
  DiscoverTradeItem,
} from "@/data/discover-timeline";
import {
  discoverPostPath,
  discoverPostShareDescription,
  discoverPostShareTitle,
} from "@/lib/discover-post";
import { getAbsoluteUrl } from "@/lib/site";
import { formatAppShortDate } from "@/lib/app-dates";
import IdentityKindChip from "@/app/[locale]/(composited)/animals/identity-kind-chip";

const FEED_VIDEO_SOUND_EVENT = "animaldex-feed-video-sound";
let feedVideoSoundEnabled = false;

/**
 * iOS keeps the feed's mute state on the playback coordinator and surfaces the
 * toggle in the post's top-right chrome, not on the media itself. The chrome and
 * the carousel therefore have to share one source of truth.
 */
function setFeedVideoSoundEnabled(enabled: boolean) {
  feedVideoSoundEnabled = enabled;
  window.dispatchEvent(new CustomEvent(FEED_VIDEO_SOUND_EVENT, {detail: {enabled}}));
}

function useFeedVideoSoundEnabled() {
  const [enabled, setEnabled] = useState(feedVideoSoundEnabled);

  useEffect(() => {
    const onChange = (event: Event) => {
      setEnabled(Boolean((event as CustomEvent<{enabled?: boolean}>).detail?.enabled));
    };
    window.addEventListener(FEED_VIDEO_SOUND_EVENT, onChange);
    return () => window.removeEventListener(FEED_VIDEO_SOUND_EVENT, onChange);
  }, []);

  return enabled;
}

type NetworkConnection = {
  saveData?: boolean;
  effectiveType?: string;
};

function readLowDataMode() {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    connection?: NetworkConnection;
    mozConnection?: NetworkConnection;
    webkitConnection?: NetworkConnection;
  };
  const connection = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
  if (!connection) return false;
  if (connection.saveData) return true;
  const effectiveType = connection.effectiveType;
  return effectiveType === "2g" || effectiveType === "slow-2g";
}

type KnownEndorsementState = Pick<DiscoverCaptureItem, "viewerEndorsementStat" | "endorsementCount">;

function mergeKnownEndorsementState(
  items: DiscoverCaptureItem[],
  knownByCaptureId: Map<string, KnownEndorsementState>
) {
  if (!knownByCaptureId.size) return items;
  return items.map((entry) => {
    const known = knownByCaptureId.get(entry.captureId);
    if (!known) return entry;
    return {
      ...entry,
      viewerEndorsementStat: known.viewerEndorsementStat,
      endorsementCount: known.endorsementCount
    };
  });
}

function CollectorLink({ collector }: { collector: DiscoverCollectorRef }) {
  if (collector.href) {
    return (
      <Link
        href={collector.href}
        className="font-bold text-white/75 hover:text-primary-100"
      >
        {collector.name}
      </Link>
    );
  }

  return <span className="font-bold text-white/75">{collector.name}</span>;
}

function ActivityBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-primary-400/10 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.16em] text-primary-200">
      {label}
    </span>
  );
}

function FeedPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "cyan" | "violet" | "amber";
}) {
  const tones = {
    neutral: "bg-white/[0.06] text-white/60",
    green: "bg-primary-400/10 text-primary-200",
    cyan: "bg-cyan-400/10 text-cyan-200",
    violet: "bg-violet-400/10 text-violet-200",
    amber: "bg-amber-400/10 text-amber-200",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function UncertainBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/85 px-2.5 py-1 text-[0.68rem] font-black text-white ring-1 ring-red-300/40">
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-white/20 text-[0.55rem]">!</span>
      Uncertain
    </span>
  );
}

const PEER_CAPTURERS_VISIBLE_LIMIT = 3;

/** Other collectors with a public capture in the same ranking cohort. */
function DiscoverPeerCapturersAvatarStack({
  collectors,
}: {
  collectors: DiscoverCollectorRef[];
}) {
  if (collectors.length === 0) return null;

  const visible = collectors.slice(0, PEER_CAPTURERS_VISIBLE_LIMIT);
  const overflowCount = Math.max(0, collectors.length - visible.length);
  const label =
    overflowCount === 0 && collectors.length === 1
      ? `Also captured by ${collectors[0].name}`
      : `Also captured by ${collectors.length} other collectors`;

  return (
    <span className="flex shrink-0 items-center gap-1" title={label} aria-label={label}>
      <span className="flex items-center" aria-hidden="true">
        {visible.map((collector, index) => (
          <span
            key={collector.userId ?? `${collector.name}-${index}`}
            className="-ml-1.5 first:ml-0"
            style={{ zIndex: visible.length - index }}
          >
            {collector.avatarUrl ? (
              <img
                src={collector.avatarUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover ring-1 ring-[#121212]"
              />
            ) : (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-white/15 text-[0.5rem] font-bold text-white/60 ring-1 ring-[#121212]">
                {collector.name.slice(0, 1)}
              </span>
            )}
          </span>
        ))}
      </span>
      {overflowCount > 0 ? (
        <span aria-hidden="true" className="font-mono text-[0.62rem] font-bold text-white/45">
          +{overflowCount}
        </span>
      ) : null}
    </span>
  );
}

function nonZeroBoosts(boosts: Record<string, number>) {
  return Object.entries(boosts).filter(([, value]) => Number(value) > 0);
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V17M12 7.25h.01" strokeLinecap="round" />
    </svg>
  );
}

export function MediaCarousel({
  assets,
  animalName,
  isUncertain = false,
  layout = "standard",
  onActiveAssetChange,
  focusRequest = null,
  onBrowseAll,
}: {
  assets: DiscoverMediaAsset[];
  animalName: string;
  isUncertain?: boolean;
  /** `feed` and `hero` fill their parent; `standard` is a 16:10 card strip. */
  layout?: "standard" | "feed" | "hero";
  onActiveAssetChange?: (asset: DiscoverMediaAsset | null) => void;
  /**
   * Opens the carousel on one asset. The nonce makes a repeat request for the
   * same asset count as a new one.
   */
  focusRequest?: {assetId: string; nonce: number} | null;
  /**
   * When set, the page indicator is a button that opens the media browser, as
   * on iOS: dots up to eight items, a counter with a grid above that.
   */
  onBrowseAll?: (index: number) => void;
}) {
  const media = useMemo(() => assets.length ? assets : [], [assets]);
  const videoSourceById = useMemo(() => new Map(media.map((asset) => [asset.id, asset.url])), [media]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [isMediaActive, setIsMediaActive] = useState(layout !== "feed");
  const [loadedVideoIds, setLoadedVideoIds] = useState<Set<string>>(() => new Set());
  const [explicitPlayIds, setExplicitPlayIds] = useState<Set<string>>(() => new Set());
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [isLowDataMode, setIsLowDataMode] = useState(false);
  const [isFeedSoundEnabled, setIsFeedSoundEnabled] = useState(feedVideoSoundEnabled);
  const shouldLoadMedia = layout !== "feed" || isMediaActive;

  useEffect(() => {
    onActiveAssetChange?.(media[activeSlideIndex] ?? media[0] ?? null);
  }, [activeSlideIndex, media, onActiveAssetChange]);

  useEffect(() => {
    if (!focusRequest) return;
    const scroller = scrollerRef.current;
    const index = media.findIndex((asset) => asset.id === focusRequest.assetId);
    if (!scroller || index < 0) return;
    scroller.scrollTo({left: index * scroller.clientWidth, behavior: "auto"});
    setActiveSlideIndex(index);
  // Keyed on the request, not on `media`: a refreshed asset list must not
  // drag the carousel back to a page somebody has since swiped away from.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.assetId, focusRequest?.nonce]);

  useEffect(() => {
    setIsLowDataMode(readLowDataMode());
    const nav = navigator as Navigator & {
      connection?: NetworkConnection & {addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void};
    };
    const connection = nav.connection;
    if (!connection?.addEventListener) return undefined;
    const onConnectionChange = () => setIsLowDataMode(readLowDataMode());
    connection.addEventListener("change", onConnectionChange);
    return () => connection.removeEventListener?.("change", onConnectionChange);
  }, []);

  useEffect(() => {
    if (layout !== "feed") {
      setIsMediaActive(true);
      return undefined;
    }

    const node = rootRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const focused = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.55);
      setIsMediaActive(focused);
    }, {
      rootMargin: "0px",
      threshold: [0, 0.35, 0.55, 0.75, 1]
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [layout]);

  useEffect(() => {
    const onFeedVideoSound = (event: Event) => {
      const enabled = Boolean((event as CustomEvent<{enabled?: boolean}>).detail?.enabled);
      setIsFeedSoundEnabled(enabled);
      if (!enabled) {
        Object.values(videoRefs.current).forEach((video) => {
          if (video) video.muted = true;
        });
      }
    };

    window.addEventListener(FEED_VIDEO_SOUND_EVENT, onFeedVideoSound);
    return () => window.removeEventListener(FEED_VIDEO_SOUND_EVENT, onFeedVideoSound);
  }, []);

  useEffect(() => {
    const videos = Object.entries(videoRefs.current)
      .filter((entry): entry is [string, HTMLVideoElement] => Boolean(entry[1]));
    if (!videos.length) return undefined;

    if (!shouldLoadMedia) {
      videos.forEach(([, video]) => {
        video.pause();
        video.muted = true;
      });
      return undefined;
    }

    const markLoaded = (mediaId: string) => {
      setLoadedVideoIds((current) => {
        if (current.has(mediaId)) return current;
        const next = new Set(current);
        next.add(mediaId);
        return next;
      });
    };

    const playVideo = (mediaId: string, video: HTMLVideoElement) => {
      markLoaded(mediaId);
      const source = videoSourceById.get(mediaId);
      if (source && !video.currentSrc) {
        video.src = source;
        video.load();
      }
      window.dispatchEvent(new CustomEvent("animaldex-feed-video-active", {detail: {mediaId}}));
      video.muted = !isFeedSoundEnabled;
      window.setTimeout(() => {
        void video.play().catch(() => undefined);
      }, 0);
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;
        const mediaId = video.dataset.mediaId;
        if (!mediaId) continue;

        if (entry.intersectionRatio >= 0.45) {
          markLoaded(mediaId);
        }
        if (entry.intersectionRatio >= 0.72) {
          if (isLowDataMode && !explicitPlayIds.has(mediaId)) {
            video.pause();
            continue;
          }
          playVideo(mediaId, video);
        } else if (entry.intersectionRatio <= 0.02) {
          video.pause();
        }
      }
    }, {
      rootMargin: "0px",
      threshold: [0, 0.02, 0.45, 0.72, 1]
    });

    const onActiveVideo = (event: Event) => {
      const mediaId = (event as CustomEvent<{mediaId?: string}>).detail?.mediaId;
      for (const [id, video] of videos) {
        if (id !== mediaId) {
          video.pause();
          video.muted = true;
        } else {
          video.muted = !isFeedSoundEnabled;
        }
      }
    };

    window.addEventListener("animaldex-feed-video-active", onActiveVideo);
    videos.forEach(([, video]) => observer.observe(video));

    return () => {
      observer.disconnect();
      window.removeEventListener("animaldex-feed-video-active", onActiveVideo);
    };
  }, [explicitPlayIds, isFeedSoundEnabled, isLowDataMode, media, shouldLoadMedia, videoSourceById, activeSlideIndex]);

  if (!media.length) return null;

  const markLoadedId = (mediaId: string) => {
    setLoadedVideoIds((current) => {
      if (current.has(mediaId)) return current;
      const next = new Set(current);
      next.add(mediaId);
      return next;
    });
  };

  const playExplicitly = (asset: DiscoverMediaAsset) => {
    setExplicitPlayIds((current) => {
      if (current.has(asset.id)) return current;
      const next = new Set(current);
      next.add(asset.id);
      return next;
    });
    markLoadedId(asset.id);

    const video = videoRefs.current[asset.id];
    if (video) {
      if (!video.currentSrc) {
        video.src = asset.url;
        video.load();
      }
      window.dispatchEvent(new CustomEvent("animaldex-feed-video-active", {detail: {mediaId: asset.id}}));
      video.muted = !isFeedSoundEnabled;
      void video.play().catch(() => undefined);
    }
  };

  const toggleVideoSound = (asset: DiscoverMediaAsset) => {
    const video = videoRefs.current[asset.id];
    const nextSoundEnabled = !isFeedSoundEnabled;
    setIsFeedSoundEnabled(nextSoundEnabled);
    setFeedVideoSoundEnabled(nextSoundEnabled);
    markLoadedId(asset.id);

    if (isLowDataMode) {
      playExplicitly(asset);
    }

    if (video) {
      if (!video.currentSrc) {
        video.src = asset.url;
        video.load();
      }
      window.dispatchEvent(new CustomEvent("animaldex-feed-video-active", {detail: {mediaId: asset.id}}));
      video.muted = !nextSoundEnabled;
      if (nextSoundEnabled) {
        void video.play().catch(() => undefined);
      }
    }
  };

  const handleScrollerScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller || media.length <= 1) return;
    const index = Math.round(scroller.scrollLeft / Math.max(1, scroller.clientWidth));
    setActiveSlideIndex(Math.min(media.length - 1, Math.max(0, index)));
  };

  // The feed hides every affordance (chrome lives in the post overlay); the
  // detail hero keeps the sound toggle, page dots and counter like iOS's
  // ScanResultCatalogHeroView.
  const isFeedLayout = layout === "feed";
  const fillsParent = layout !== "standard";
  const frameClass = fillsParent
    ? "relative h-full w-full bg-black"
    : "relative bg-white/5";
  const scrollerClass = fillsParent
    ? "flex h-full min-h-0 w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const itemClass = fillsParent
    ? "relative h-full min-h-0 w-full shrink-0 snap-center overflow-hidden"
    : "relative aspect-[16/10] w-full shrink-0 snap-center overflow-hidden";
  const mediaFitClass = fillsParent
    ? "object-cover object-center"
    : "object-cover object-[50%_28%]";

  return (
    <div ref={rootRef} className={frameClass}>
      <div ref={scrollerRef} onScroll={handleScrollerScroll} className={scrollerClass}>
        {media.map((asset, index) => {
          const isVideo = asset.kind === "video" || asset.kind === "loop";
          const shouldMountVideo = isVideo && Math.abs(index - activeSlideIndex) <= 1;
          const showTapToPlay = isVideo && isLowDataMode && !explicitPlayIds.has(asset.id);
          const showPoster = shouldLoadMedia || loadedVideoIds.has(asset.id) || showTapToPlay;

          return (
            <div key={asset.id} className={itemClass}>
              {isVideo ? (
                shouldMountVideo ? (
                  <video
                    src={loadedVideoIds.has(asset.id) || explicitPlayIds.has(asset.id) ? asset.url : undefined}
                    poster={showPoster ? asset.posterUrl ?? undefined : undefined}
                    muted={!isFeedSoundEnabled}
                    loop
                    playsInline
                    preload={loadedVideoIds.has(asset.id) || explicitPlayIds.has(asset.id) ? "metadata" : "none"}
                    data-media-id={asset.id}
                    ref={(node) => {
                      videoRefs.current[asset.id] = node;
                    }}
                    className={`h-full w-full bg-black ${mediaFitClass}`}
                  />
                ) : (
                  <div className="relative h-full w-full bg-black">
                    {asset.posterUrl && showPoster ? (
                      <img
                        src={asset.posterUrl}
                        alt=""
                        className={`h-full w-full bg-black ${mediaFitClass}`}
                      />
                    ) : (
                      <div className="h-full w-full bg-[#090909]" />
                    )}
                  </div>
                )
              ) : shouldLoadMedia ? (
                <img
                  src={asset.url}
                  alt={animalName}
                  loading="lazy"
                  decoding="async"
                  className={`h-full w-full bg-black ${mediaFitClass}`}
                />
              ) : (
                <div className="h-full w-full bg-[#090909]" />
              )}
              {/* In the feed the media owns the whole slot and every affordance
                  lives in the post chrome, exactly as iOS lays it out. */}
              {isVideo && !isFeedLayout ? (
                <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/85 ring-1 ring-white/10">
                  Video
                </span>
              ) : null}
              {showTapToPlay ? (
                <button
                  type="button"
                  aria-label="Play video"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    playExplicitly(asset);
                  }}
                  className={`z-10 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-white/90 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/75 ${
                    isFeedLayout
                      ? "absolute bottom-3 right-3"
                      : "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  }`}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current">
                    <path d="M8 5.14v13.72L19 12Z" />
                  </svg>
                  Play
                </button>
              ) : null}
              {isVideo && !isFeedLayout ? (
                <button
                  type="button"
                  aria-label={isFeedSoundEnabled ? "Turn feed sound off" : "Turn feed sound on"}
                  title={isFeedSoundEnabled ? "Turn feed sound off" : "Turn feed sound on"}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleVideoSound(asset);
                  }}
                  className="absolute bottom-3 left-3 grid h-10 w-10 place-items-center rounded-full bg-black/65 text-white shadow-lg ring-1 ring-white/15 transition hover:bg-black/80 hover:text-primary-100"
                >
                  <AppIcon name={isFeedSoundEnabled ? "volume" : "volumeOff"} className="h-5 w-5" />
                </button>
              ) : null}
              {isUncertain && !isFeedLayout ? (
                <span className="absolute right-3 top-3">
                  <UncertainBadge />
                </span>
              ) : null}
              {media.length > 1 && !isFeedLayout && !onBrowseAll ? (
                <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[0.68rem] font-black text-white/90 ring-1 ring-white/10">
                  {index + 1} / {media.length}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {media.length > 1 && !isFeedLayout && onBrowseAll ? (
        <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => onBrowseAll(activeSlideIndex)}
            aria-label={`Browse all ${media.length} items`}
            className="flex min-h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 ring-1 ring-white/10"
          >
            {media.length <= 8 ? media.map((asset, index) => (
              <span
                key={`${asset.id}-dot`}
                className={`h-1.5 rounded-full ${index === activeSlideIndex ? "w-4 bg-white/80" : "w-1.5 bg-white/35"}`}
              />
            )) : (
              <>
                <span className="text-[0.68rem] font-black text-white/90">{activeSlideIndex + 1} / {media.length}</span>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3 fill-white/80">
                  <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" />
                  <rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />
                </svg>
              </>
            )}
          </button>
        </div>
      ) : media.length > 1 && !isFeedLayout ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {media.map((asset, index) => (
            <span
              key={`${asset.id}-dot`}
              className={`h-1.5 rounded-full ${index === activeSlideIndex ? "w-4 bg-white/80" : "w-1.5 bg-white/35"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function sharePropsForItem(item: DiscoverTimelineItem, locale: string) {
  const url = getAbsoluteUrl(locale, discoverPostPath(item.id));

  if (item.kind === "capture") {
    return {
      url,
      title: discoverPostShareTitle({
        kind: item.kind,
        animalName: item.animalName,
        collectorName: item.collector.name,
        contextLabel: item.contextLabel,
      }),
      text: discoverPostShareDescription({
        kind: item.kind,
        animalName: item.animalName,
        collectorName: item.collector.name,
        collectorUsername: item.collector.username,
        contextLabel: item.contextLabel,
        locationLabel: item.locationLabel,
        hasVideoMedia: item.hasVideoMedia,
        scientificName: item.scientificName,
      }),
    };
  }

  if (item.kind === "alignment") {
    return {
      url,
      title: discoverPostShareTitle({
        kind: item.kind,
        animalName: item.rewardedAnimalName,
        collectorName: item.collector.name,
      }),
      text: discoverPostShareDescription({
        kind: item.kind,
        animalName: item.rewardedAnimalName,
        collectorName: item.collector.name,
        collectorUsername: item.collector.username,
      }),
    };
  }

  if (item.kind === "fusion") {
    return {
      url,
      title: discoverPostShareTitle({ kind: item.kind, collectorName: item.collector.name }),
      text: discoverPostShareDescription({
        kind: item.kind,
        animalName: item.receiverAnimalName,
        collectorName: item.collector.name,
        collectorUsername: item.collector.username,
      }),
    };
  }

  if (item.kind === "challenge") {
    return {
      url,
      title: discoverPostShareTitle({
        kind: item.kind,
        collectorName: item.attacker.displayName,
      }),
      text: item.activitySummary,
    };
  }

  if (item.kind === "animal-trial") {
    return {
      url,
      title: discoverPostShareTitle({
        kind: item.kind,
        animalName: item.speciesName,
        collectorName: item.collector.name,
      }),
      text: discoverPostShareDescription({
        kind: item.kind,
        animalName: item.speciesName,
        collectorName: item.collector.name,
        collectorUsername: item.collector.username,
      }),
    };
  }

  return {
    url,
    title: discoverPostShareTitle({
      kind: item.kind,
      animalName: item.offerer.animalName,
      collectorName: item.offerer.name,
    }),
    text: discoverPostShareDescription({
      kind: item.kind,
      animalName: item.offerer.animalName,
      collectorName: item.offerer.name,
      collectorUsername: item.offerer.username,
    }),
  };
}

function TimelineShell({
  badge,
  date,
  locale,
  onInfo,
  share,
  children,
}: {
  badge: string;
  date: string;
  locale: string;
  onInfo: () => void;
  share: { url: string; title: string; text?: string };
  children: React.ReactNode;
}) {
  const formatted = formatAppShortDate(date, locale);
  return (
    <article className="flex h-full min-h-0 snap-start snap-always scroll-mt-4 flex-col justify-center overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#121212]/90 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] transition  hover:border-white/14">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <ActivityBadge label={badge} />
        <div className="flex items-center gap-2.5">
          {formatted ? (
            <span className="text-xs font-bold text-white/35">{formatted}</span>
          ) : null}
          <ShareDiscoverPostButton url={share.url} title={share.title} text={share.text} compact />
          <button
            type="button"
            onClick={onInfo}
            aria-label="Post information"
            className="rounded-full p-1 text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <InfoIcon />
          </button>
        </div>
      </div>
      {children}
    </article>
  );
}

function CaptureChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "cyan" | "amber" | "violet";
}) {
  const tones = {
    neutral: "bg-white/[0.07] text-white/70 ring-white/10",
    green: "bg-primary-400/15 text-primary-100 ring-primary-400/20",
    cyan: "bg-cyan-400/15 text-cyan-100 ring-cyan-400/20",
    amber: "bg-amber-400/15 text-amber-100 ring-amber-400/20",
    violet: "bg-violet-400/15 text-violet-100 ring-violet-400/20",
  };
  return (
    <span className={`inline-flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-[0.68rem] font-black ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** iOS `capturePostChipRow`: one HStack of Level · Tier · Grade — never wraps. */
function CapturePostChipRow({item}: {item: DiscoverCaptureItem}) {
  const levelLabel = item.level >= 100 ? "Lvl 100 MAX" : `Lvl ${item.level}`;
  return (
    <div className="flex flex-nowrap items-center gap-2">
      <CaptureChip tone="green">{levelLabel}</CaptureChip>
      <CaptureChip tone="cyan">Tier {item.battleTier}</CaptureChip>
      <CaptureGradeBadge grade={item.captureGrade} breakdown={item.gradeBreakdown} compact />
    </div>
  );
}


/* ------------------------------------------------------------------ *
 * Feed overlay chrome — iOS `DiscoverCaptureTimelineCardView.overlayChrome`
 * ------------------------------------------------------------------ */

/**
 * iOS `overlayActionButton`: 44pt hit area, 20pt bold glyph, no chrome behind
 * it; 36pt / 17pt when the post slot is shorter than 620pt (`usesCompactOverlay`).
 */
export const FEED_RAIL_BUTTON_CLASS = "pointer-events-auto grid h-11 w-11 place-items-center [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.6))] [@media(max-height:760px)]:h-9 [@media(max-height:760px)]:w-9 [&_svg]:h-5 [&_svg]:w-5 [@media(max-height:760px)]:[&_svg]:h-[1.1rem] [@media(max-height:760px)]:[&_svg]:w-[1.1rem]";

function FeedRailButton({
  label,
  href,
  onClick,
  disabled = false,
  tone = "white",
  children,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "white" | "cyan" | "dim";
  children: React.ReactNode;
}) {
  const toneClass = tone === "cyan"
    ? "text-cyan-300"
    : tone === "dim"
      ? "text-white/[0.34]"
      : "text-white";
  const className = `${FEED_RAIL_BUTTON_CLASS} ${toneClass}`;

  if (href && !disabled) {
    return (
      <Link href={href} aria-label={label} title={label} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

function OfferIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 7H3m0 0 3-3M3 7l3 3" />
      <path d="M16 17h5m0 0-3-3m3 3-3 3" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2.2 4.4 5v6.4c0 4.6 3.2 8.9 7.6 10.4 4.4-1.5 7.6-5.8 7.6-10.4V5z" fillOpacity="0.92" />
      <path d="M12.9 6.6 8.4 13.1h2.9l-.8 4.9 4.6-6.8h-3z" fill="#000" fillOpacity="0.7" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2v12" />
      <path d="m7.6 7.6 4.4-4.4 4.4 4.4" />
      <path d="M5 13.6v5.6a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6v-5.6" />
    </svg>
  );
}

function SoundToggle() {
  const enabled = useFeedVideoSoundEnabled();

  return (
    <button
      type="button"
      onClick={() => setFeedVideoSoundEnabled(!enabled)}
      aria-label={enabled ? "Mute video" : "Unmute video"}
      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-black/[0.46] px-2.5 py-[7px] text-white/90 ring-1 ring-white/[0.08]"
    >
      <AppIcon name={enabled ? "volume" : "volumeOff"} className="h-3 w-3" />
      <span className="text-[11px] font-semibold">{enabled ? "Sound on" : "Tap for sound"}</span>
    </button>
  );
}

/** iOS `topOverlay`. */
function FeedTopOverlay({
  collector,
  activityLabel,
  peerCollectors,
  showsSoundToggle,
}: {
  collector: DiscoverCollectorRef;
  activityLabel: string;
  peerCollectors: DiscoverCollectorRef[];
  showsSoundToggle: boolean;
}) {
  const avatar = collector.avatarUrl ? (
    <img
      src={collector.avatarUrl}
      alt=""
      className="h-10 w-10 shrink-0 rounded-full object-cover ring-[1.5px] ring-white/80"
    />
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold text-white ring-[1.5px] ring-white/80">
      {collector.name.slice(0, 1)}
    </span>
  );

  return (
    <div className="flex items-start gap-3">
      <div className="pointer-events-auto flex max-w-[190px] min-w-0 items-center gap-2.5 [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.55))]">
        {collector.href ? <Link href={collector.href} className="shrink-0">{avatar}</Link> : avatar}
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white">
            {collector.href ? <Link href={collector.href}>{collector.name}</Link> : collector.name}
          </p>
          {collector.username ? (
            <p className="truncate text-[11px] font-semibold text-white/[0.78]">@{collector.username}</p>
          ) : null}
        </div>
      </div>

      <div className="ml-auto flex max-w-[124px] flex-col items-end gap-1.5">
        <span className="rounded-full bg-black/[0.42] px-[9px] py-1.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-primary-200">
          {activityLabel}
        </span>
        <DiscoverPeerCapturersAvatarStack collectors={peerCollectors} />
        {showsSoundToggle ? <SoundToggle /> : null}
      </div>
    </div>
  );
}

/** iOS `bottomOverlay`. */
function FeedBottomOverlay({item}: {item: DiscoverCaptureItem}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 [filter:drop-shadow(0_1px_4px_rgba(0,0,0,0.65))]">
      {item.isUncertain ? <span className="pointer-events-auto self-start"><UncertainBadge /></span> : null}
      {/* iOS `onOpenCapture`: the title block opens the capture detail, not the species page. */}
      <Link href={`/app/capture/${encodeURIComponent(item.captureId)}`} className="pointer-events-auto flex flex-col gap-1.5">
        <h3 className="line-clamp-2 text-[17px] font-semibold leading-tight text-white">{item.animalName}</h3>
        <CapturePostChipRow item={item} />
      </Link>
      {item.learnedPrinciple ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-white/90">
          <AppIcon name="spark" className="h-3.5 w-3.5" />
          <span className="line-clamp-1">{item.learnedPrinciple}</span>
        </p>
      ) : null}
      {item.bestForTags.length ? (
        <p className="line-clamp-1 text-[11px] font-semibold text-white/[0.78]">
          {item.bestForTags.slice(0, 3).map((tag) => `#${tag.replace(/\s+/g, "")}`).join("  ")}
        </p>
      ) : null}
    </div>
  );
}

function CaptureCard({
  item,
  locale,
  viewerUserId,
}: {
  item: DiscoverCaptureItem;
  locale: string;
  viewerUserId: string | null;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const [activeItem, setActiveItem] = useState(item);
  const [rankedItems, setRankedItems] = useState<DiscoverCaptureItem[]>([item]);
  const [rankedHint, setRankedHint] = useState(false);
  const [hasMoreRanked, setHasMoreRanked] = useState(false);
  const [nextRankedOffset, setNextRankedOffset] = useState<number | null>(null);
  const [isLoadingRanked, setIsLoadingRanked] = useState(false);
  const didLoadRankedRef = useRef(false);
  const activeItemRef = useRef(item);
  const knownEndorsementsRef = useRef(new Map<string, KnownEndorsementState>());

  function rememberEndorsement(entry: Pick<DiscoverCaptureItem, "captureId" | "viewerEndorsementStat" | "endorsementCount">) {
    knownEndorsementsRef.current.set(entry.captureId, {
      viewerEndorsementStat: entry.viewerEndorsementStat,
      endorsementCount: entry.endorsementCount
    });
  }

  function applyItemPatch(source: DiscoverCaptureItem, patch: Partial<DiscoverCaptureItem>) {
    const nextViewerStat = "viewerEndorsementStat" in patch
      ? (patch.viewerEndorsementStat ?? null)
      : source.viewerEndorsementStat;
    const nextCount = "endorsementCount" in patch
      ? (patch.endorsementCount ?? source.endorsementCount)
      : source.endorsementCount;

    if ("viewerEndorsementStat" in patch || "endorsementCount" in patch) {
      rememberEndorsement({
        captureId: source.captureId,
        viewerEndorsementStat: nextViewerStat,
        endorsementCount: nextCount
      });
    }

    setRankedItems((current) => {
      const patched = current.map((entry) => (
        entry.captureId === source.captureId ? {...entry, ...patch} : entry
      ));
      // Prefer known timeline/seed endorsement state when ranking siblings omit it.
      return mergeKnownEndorsementState(patched, knownEndorsementsRef.current);
    });
    setActiveItem((current) => (
      current.captureId === source.captureId ? {...current, ...patch} : current
    ));
  }

  useEffect(() => {
    activeItemRef.current = activeItem;
    rememberEndorsement(activeItem);
  }, [activeItem]);

  useEffect(() => {
    knownEndorsementsRef.current.clear();
    rememberEndorsement(item);
    setActiveItem(item);
    setRankedItems([item]);
    setRankedHint(false);
    setHasMoreRanked(false);
    setNextRankedOffset(null);
    didLoadRankedRef.current = false;
  }, [item.id, item.captureId]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.45);
      if (!visible || didLoadRankedRef.current) return;
      didLoadRankedRef.current = true;

      const params = new URLSearchParams({
        captureId: item.captureId,
        limit: "10",
        offset: "0"
      });
      if (item.speciesProfileId) params.set("speciesProfileId", item.speciesProfileId);
      if (item.normalizedIdentityKey) params.set("normalizedIdentityKey", item.normalizedIdentityKey);

      setIsLoadingRanked(true);
      fetch(`/api/app/discover/ranking-siblings?${params.toString()}`, {headers: {Accept: "application/json"}})
        .then(async (response) => {
          if (!response.ok) return;
          const payload = await response.json() as {
            items?: DiscoverCaptureItem[];
            hasMore?: boolean;
            nextOffset?: number | null;
          };
          const siblings = payload.items ?? [];
          if (siblings.length <= 1) return;
          const seed = activeItemRef.current;
          rememberEndorsement(seed);
          const seedFirst = [
            seed,
            ...siblings.filter((sibling) => sibling.captureId !== seed.captureId)
          ];
          setRankedItems(mergeKnownEndorsementState(seedFirst, knownEndorsementsRef.current));
          setRankedHint(true);
          setHasMoreRanked(Boolean(payload.hasMore));
          setNextRankedOffset(payload.nextOffset ?? null);
        })
        .finally(() => setIsLoadingRanked(false));
    }, {threshold: [0, 0.45, 0.75]});

    observer.observe(node);
    return () => observer.disconnect();
  }, [item]);

  async function loadMoreRanked() {
    if (!hasMoreRanked || nextRankedOffset == null || isLoadingRanked) return;
    setIsLoadingRanked(true);
    try {
      const params = new URLSearchParams({
        captureId: item.captureId,
        limit: "10",
        offset: String(nextRankedOffset)
      });
      if (item.speciesProfileId) params.set("speciesProfileId", item.speciesProfileId);
      if (item.normalizedIdentityKey) params.set("normalizedIdentityKey", item.normalizedIdentityKey);
      const response = await fetch(`/api/app/discover/ranking-siblings?${params.toString()}`, {
        headers: {Accept: "application/json"}
      });
      if (!response.ok) {
        setHasMoreRanked(false);
        return;
      }
      const payload = await response.json() as {
        items?: DiscoverCaptureItem[];
        hasMore?: boolean;
        nextOffset?: number | null;
      };
      const nextItems = payload.items ?? [];
      setRankedItems((current) => {
        const seen = new Set(current.map((entry) => entry.captureId));
        const merged = [...current];
        for (const entry of nextItems) {
          if (seen.has(entry.captureId)) continue;
          seen.add(entry.captureId);
          merged.push(entry);
        }
        return mergeKnownEndorsementState(merged, knownEndorsementsRef.current);
      });
      setHasMoreRanked(Boolean(payload.hasMore));
      setNextRankedOffset(payload.nextOffset ?? null);
    } finally {
      setIsLoadingRanked(false);
    }
  }

  function handlePagerScroll() {
    const pager = pagerRef.current;
    if (!pager || rankedItems.length <= 1) return;
    const index = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
    const next = rankedItems[Math.min(rankedItems.length - 1, Math.max(0, index))];
    if (next && next.captureId !== activeItem.captureId) {
      setActiveItem(next);
    }
    if (rankedItems.length - index <= 2) {
      void loadMoreRanked();
    }
  }

  const shareForActive = {
    url: getAbsoluteUrl(locale, discoverPostPath(activeItem.id)),
    title: discoverPostShareTitle({
      kind: "capture",
      animalName: activeItem.animalName,
      collectorName: activeItem.collector.name,
      contextLabel: activeItem.contextLabel
    }),
    text: discoverPostShareDescription({
      kind: "capture",
      animalName: activeItem.animalName,
      collectorName: activeItem.collector.name,
      collectorUsername: activeItem.collector.username,
      contextLabel: activeItem.contextLabel,
      locationLabel: activeItem.locationLabel,
      hasVideoMedia: activeItem.hasVideoMedia,
      scientificName: activeItem.scientificName
    })
  };

  const showsRankedPager = rankedItems.length > 1;
  const [showsInfo, setShowsInfo] = useState(false);
  const [activeAsset, setActiveAsset] = useState<DiscoverMediaAsset | null>(null);
  const peerCollectors = useMemo(() => {
    const seen = new Set<string>();
    const peers: DiscoverCollectorRef[] = [];

    for (const ranked of rankedItems) {
      const peer = ranked.collector;
      const key = peer.userId ?? peer.username ?? peer.name;
      if (!key || key === (activeItem.collector.userId ?? activeItem.collector.username ?? activeItem.collector.name)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      peers.push(peer);
    }

    return peers;
  }, [rankedItems, activeItem.collector]);

  const isOwnPost = Boolean(viewerUserId && activeItem.collector.userId && viewerUserId === activeItem.collector.userId);
  const canOffer = Boolean(viewerUserId) && !isOwnPost && !activeItem.isUncertain;
  const canChallenge = Boolean(viewerUserId) && !isOwnPost && activeItem.isChallengeAvailable;
  const activityLabel = activeItem.activityBadge.toLowerCase() === "capture" && activeItem.animalDexNumber
    ? `#${String(activeItem.animalDexNumber).padStart(3, "0")}`
    : activeItem.activityBadge;
  const activeAssetIsVideo = activeAsset?.kind === "video" || activeAsset?.kind === "loop";

  return (
    <>
    <article
      ref={rootRef}
      className="relative h-full min-h-0 w-full snap-start snap-always overflow-hidden bg-black"
    >
      {/* Media owns the whole snap slot; every control is layered over it. */}
      {showsRankedPager ? (
        <div
          ref={pagerRef}
          onScroll={handlePagerScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {rankedItems.map((ranked) => (
            <div key={ranked.captureId} className="h-full w-full shrink-0 snap-center">
              <MediaCarousel
                assets={ranked.mediaAssets}
                animalName={ranked.animalName}
                isUncertain={ranked.isUncertain}
                layout="feed"
                onActiveAssetChange={ranked.captureId === activeItem.captureId ? setActiveAsset : undefined}
              />
            </div>
          ))}
        </div>
      ) : (
        <MediaCarousel
          assets={activeItem.mediaAssets}
          animalName={activeItem.animalName}
          isUncertain={activeItem.isUncertain}
          layout="feed"
          onActiveAssetChange={setActiveAsset}
        />
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.54),rgba(0,0,0,0)_30%,rgba(0,0,0,0)_62%,rgba(0,0,0,0.88))]"
      />

      {rankedHint ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/80 ring-1 ring-white/15 backdrop-blur-sm">
          <span aria-hidden="true">↔</span>
          Ranked
        </span>
      ) : null}

      {/* iOS `overlayChrome`: 16/14pt insets, 10/8pt when compact; the chrome
          never sits under the tab bar because the snap slot already ends above it. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col px-4 pb-3.5 pt-3.5 [@media(max-height:760px)]:px-2.5 [@media(max-height:760px)]:pb-2 [@media(max-height:760px)]:pt-2">
        <FeedTopOverlay
          collector={activeItem.collector}
          activityLabel={activityLabel}
          peerCollectors={peerCollectors}
          showsSoundToggle={Boolean(activeAssetIsVideo)}
        />

        <div className="min-h-5 flex-1 [@media(max-height:760px)]:min-h-2" />

        <div className="flex items-end gap-3.5 [@media(max-height:760px)]:gap-2">
          <FeedBottomOverlay item={activeItem} />
          {/* iOS `actionRail` order: Gift, Offer, Compare, Share, Info. */}
          <div className="flex w-[46px] shrink-0 flex-col items-center gap-1 [@media(max-height:760px)]:w-10 [@media(max-height:760px)]:gap-0.5">
            {viewerUserId ? (
              <DiscoverCaptureActions
                variant="rail"
                captureId={activeItem.captureId}
                isOwnPost={isOwnPost}
                canChallenge={canChallenge}
                canOffer={canOffer}
                viewerEndorsementStat={activeItem.viewerEndorsementStat}
                onEndorsementChange={(stat, delta) => {
                  applyItemPatch(activeItem, {
                    viewerEndorsementStat: stat,
                    endorsementCount: Math.max(0, activeItem.endorsementCount + delta)
                  });
                }}
              />
            ) : null}
            {canOffer ? (
              <FeedRailButton label="Offer" href={`/app/trades?theirCapture=${encodeURIComponent(activeItem.captureId)}`}>
                <OfferIcon />
              </FeedRailButton>
            ) : null}
            <FeedRailButton
              label="Compare"
              href={`/app/matchups?target=${encodeURIComponent(activeItem.captureId)}`}
              tone={canChallenge ? "cyan" : "dim"}
              disabled={!canChallenge}
            >
              <CompareIcon />
            </FeedRailButton>
            <span className={`${FEED_RAIL_BUTTON_CLASS} text-white [&>button]:grid [&>button]:h-full [&>button]:w-full [&>button]:place-items-center [&>button]:p-0 [&>button]:text-white`}>
              <ShareDiscoverPostButton
                url={shareForActive.url}
                title={shareForActive.title}
                text={shareForActive.text}
                compact
              />
            </span>
            <FeedRailButton label="Post information" onClick={() => setShowsInfo(true)}>
              <InfoIcon />
            </FeedRailButton>
          </div>
        </div>
      </div>
    </article>
    {showsInfo ? <PostInformation item={activeItem} locale={locale} onClose={() => setShowsInfo(false)} /> : null}
    </>
  );
}

function AlignmentCard({
  item,
  locale,
  onInfo,
  share,
}: {
  item: DiscoverAlignmentItem;
  locale: string;
  onInfo: () => void;
  share: { url: string; title: string; text?: string };
}) {
  return (
    <TimelineShell badge="Daily alignment" date={item.date} locale={locale} onInfo={onInfo} share={share}>
      <div className="grid gap-4 p-4 md:grid-cols-[7.5rem_1fr]">
        <Link
          href={`/app/capture/${encodeURIComponent(item.rewardedCaptureId)}`}
          className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5"
        >
          <img
            src={item.imageSrc}
            alt={item.rewardedAnimalName}
            loading="lazy"
            className="aspect-square h-full w-full object-cover"
          />
        </Link>
        <div className="min-w-0 space-y-2">
          <p className="text-sm leading-6 text-white/70">
            {item.summary ??
              item.moveTodayText ??
              "Shared a Daily Alignment proof."}
          </p>
          <p className="text-sm text-white/45">
            <CollectorLink collector={item.collector} /> aligned with{" "}
            <Link
              href={`/app/capture/${encodeURIComponent(item.rewardedCaptureId)}`}
              className="font-bold text-white/75 hover:text-primary-100"
            >
              {item.rewardedAnimalName}
            </Link>
            {item.statBoostStat ? <> · +1 {item.statBoostStat}</> : null}
          </p>
        </div>
      </div>
    </TimelineShell>
  );
}

function FusionCard({
  item,
  locale,
  onInfo,
  share,
}: {
  item: DiscoverFusionItem;
  locale: string;
  onInfo: () => void;
  share: { url: string; title: string; text?: string };
}) {
  return (
    <TimelineShell badge="Principle fusion" date={item.date} locale={locale} onInfo={onInfo} share={share}>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <img
              src={item.receiverImageSrc}
              alt={item.receiverAnimalName}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <AppIcon name="chevron" />
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {item.donorImageSrc ? (
              <img
                src={item.donorImageSrc}
                alt={item.donorAnimalName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-white/35">
                Donor
              </div>
            )}
          </div>
        </div>
        <p className="text-sm leading-6 text-white/70">
          <CollectorLink collector={item.collector} /> fused{" "}
          <span className="font-bold text-white">{item.donorAnimalName}</span>{" "}
          into{" "}
          <span className="font-bold text-white">
            {item.receiverAnimalName}
          </span>
          {item.learnedPrinciple ? (
            <> · learned {item.learnedPrinciple}</>
          ) : null}
        </p>
        {item.learnedExpression ? (
          <p className="text-sm italic text-white/40">
            {item.learnedExpression}
          </p>
        ) : null}
      </div>
    </TimelineShell>
  );
}

/* ------------------------------------------------------------------ *
 * Scenario arena — iOS `DiscoverChallengeHistoryCardView`
 *
 * The post owns the whole snap slot: attacker photo on the top half,
 * defender photo on the bottom half, each identity row pinned to the seam
 * between them, and every panel (chrome, battle status, backstory) layered
 * over the media. It is not a text card with thumbnails.
 * ------------------------------------------------------------------ */

/** iOS `participantHero`. */
function ChallengeParticipantHero({
  participant,
  highlighted,
  pinsIdentityToTop,
}: {
  participant: DiscoverChallengeParticipant;
  highlighted: boolean;
  pinsIdentityToTop: boolean;
}) {
  const badge = participant.avatarUrl ? (
    <img
      src={participant.avatarUrl}
      alt=""
      className="h-[42px] w-[42px] shrink-0 rounded-full object-cover ring-[1.5px] ring-white"
    />
  ) : (
    <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-white/15 text-sm font-bold text-white ring-[1.5px] ring-white">
      {participant.displayName.slice(0, 1)}
    </span>
  );

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
      <img
        src={participant.imageSrc}
        alt={participant.animalName}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_50%,rgba(0,0,0,0.74))]"
      />
      <div
        className={`absolute inset-x-0 flex items-end gap-2 p-3.5 [filter:drop-shadow(0_1px_4px_rgba(0,0,0,0.65))] ${
          pinsIdentityToTop ? "top-0" : "bottom-0"
        }`}
      >
        {participant.href ? (
          <Link href={participant.href} aria-label={participant.displayName} className="shrink-0">
            {badge}
          </Link>
        ) : (
          badge
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-white/[0.78]">
            {participant.username ? `@${participant.username}` : participant.displayName}
          </p>
          <Link
            href={`/app/capture/${encodeURIComponent(participant.captureId)}`}
            className="block truncate text-[17px] font-semibold leading-tight text-white"
          >
            {participant.animalName}
          </Link>
        </div>
        <span
          className={`shrink-0 text-[11px] font-black tracking-[0.06em] ${
            highlighted ? "text-primary-200" : "text-white/70"
          }`}
        >
          {highlighted ? "WINNER" : "VS"}
        </span>
      </div>
    </div>
  );
}

/** iOS `votingCountdown`: minute ticks, neon until the last hour, then orange. */
function ChallengeVotingCountdown({createdAt, deadline}: {createdAt: string; deadline: string}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const deadlineMs = new Date(deadline).getTime();
  const startMs = new Date(createdAt).getTime();
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(startMs)) return null;

  const total = Math.max(1, (deadlineMs - startMs) / 1000);
  const remaining = Math.max(0, (deadlineMs - now) / 1000);
  const urgent = remaining <= 3600;
  const tint = urgent ? "text-orange-400" : "text-primary-200";
  const bar = urgent ? "bg-orange-400" : "bg-primary-200";

  return (
    <div className="space-y-1.5">
      <div className={`flex items-center gap-1.5 ${tint}`}>
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9.5V13l2.2 1.6M9.4 2.6h5.2" />
        </svg>
        <span className="text-[11px] font-black tabular-nums">{formatVotingTimeRemaining(remaining)}</span>
        <span className="ml-auto text-[9px] font-extrabold text-white/[0.62]">{VOTE_RULE_LINE}</span>
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${bar}`} style={{width: `${Math.min(100, (remaining / total) * 100)}%`}} />
      </div>
    </div>
  );
}

/** iOS `votingTimeRemaining`. */
function formatVotingTimeRemaining(seconds: number) {
  const minutes = Math.max(0, Math.ceil(seconds / 60));
  if (minutes <= 0) return "Closing now";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${remainder}m left`;
  return `${minutes}m left`;
}

/** iOS `battleRoundPage`, paged the way the SwiftUI TabView pages. */
function ChallengeRoundPager({
  item,
  attackerCaptureId,
}: {
  item: DiscoverChallengeItem;
  attackerCaptureId: string;
}) {
  const [page, setPage] = useState(0);

  function roundWinnerText(round: 2 | 3) {
    return battleRoundWinnerText({
      round,
      round2Draw: item.round2Draw,
      winnerCaptureId: round === 2 ? item.round2WinnerCaptureId : item.round3WinnerCaptureId,
      attackerCaptureId,
      attackerName: item.attacker.animalName,
      defenderName: item.defender.animalName,
    });
  }

  return (
    <div>
      <div
        onScroll={(event) => {
          const node = event.currentTarget;
          setPage(node.clientWidth > 0 ? Math.round(node.scrollLeft / node.clientWidth) : 0);
        }}
        className="flex h-[92px] snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-full shrink-0 snap-center space-y-1.5 pr-2">
          <p className="text-[10px] font-black text-primary-200">ROUND 2 OF 3 · COMMUNITY</p>
          <p className="text-[11px] font-medium text-white/[0.86]">{roundWinnerText(2)}</p>
        </div>
        <div className="w-full shrink-0 snap-center space-y-1.5 pr-2">
          <p className="text-[10px] font-black text-primary-200">ROUND 3 OF 3 · SPECIES</p>
          <p className="text-[11px] font-medium text-white/[0.86]">{roundWinnerText(3)}</p>
          {item.speciesComparisonSlug ? (
            <Link
              href={`/comparisons/${item.speciesComparisonSlug}`}
              className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-primary-200"
            >
              <AppIcon name="spark" className="h-3 w-3" />
              View species comparison
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex justify-center gap-1.5 pt-1">
        {[0, 1].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${index === page ? "bg-white" : "bg-white/30"}`}
          />
        ))}
      </div>
    </div>
  );
}

/** iOS `backstoryPanel`: 10-word preview over a scrim, expanding in place. */
function ChallengeBackstoryPanel({text}: {text: string}) {
  const [expanded, setExpanded] = useState(false);
  const words = text.split(/\s+/).filter(Boolean);
  const preview = words.length > 10 ? `${words.slice(0, 10).join(" ")}…` : words.join(" ");

  return (
    <div className="pointer-events-auto -mx-3.5 bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_0%,rgba(0,0,0,0.42)_28%,rgba(0,0,0,0.78)_62%,rgba(0,0,0,0.92)_100%)] px-3.5 pb-4 pt-10">
      {expanded ? (
        <div className="space-y-1.5">
          <div className="max-h-[220px] overflow-y-auto whitespace-pre-line text-xs leading-5 text-white/90">
            {text}
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="ml-auto block text-xs font-bold text-white"
          >
            Less
          </button>
        </div>
      ) : (
        <div className="flex items-baseline gap-1.5">
          <p className="min-w-0 flex-1 truncate text-xs text-white/90">{preview}</p>
          <button type="button" onClick={() => setExpanded(true)} className="shrink-0 text-xs font-bold text-white">
            More
          </button>
        </div>
      )}
    </div>
  );
}

/** iOS `backstoryText`: scenario context, winner explanation, strategic insight. */
function challengeBackstoryText(item: DiscoverChallengeItem) {
  const explanation = item.winnerExplanation?.trim() || null;
  const fullExplanation = explanation && explanation.toLowerCase() !== item.outcomeLine.toLowerCase()
    ? explanation
    : null;
  const description = item.scenarioDescription?.trim() || null;
  const context = description
    && description.toLowerCase() !== fullExplanation?.toLowerCase()
    && description.toLowerCase() !== item.scenarioTitle?.toLowerCase()
    ? description
    : null;
  const insight = item.strategicInsight?.trim() || null;

  const sections = [context, fullExplanation, insight].filter((value): value is string => Boolean(value));
  return sections.length ? sections.join("\n\n") : null;
}

function ChallengeCard({
  item,
  onInfo,
  share,
  viewerUserId,
}: {
  item: DiscoverChallengeItem;
  onInfo: () => void;
  share: { url: string; title: string; text?: string };
  viewerUserId: string | null;
}) {
  const [votedCaptureId, setVotedCaptureId] = useState<string | null>(null);
  const [votesCount, setVotesCount] = useState(item.votesCount);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [votePending, setVotePending] = useState(false);

  const attackerWon = item.winnerCaptureId === item.attacker.captureId;
  const isV2 = item.challengeFormat === "best_of_3_v2";
  const isVoting = isV2 && item.battleStatus === "round_2_voting";
  const isComplete = !isV2 || item.battleStatus === "completed";
  const isParticipant = viewerUserId != null
    && (viewerUserId === item.attacker.userId || viewerUserId === item.defender.userId);
  const backstory = challengeBackstoryText(item);

  async function castVote(captureId: string) {
    if (votePending) return;
    setVotePending(true);
    setVoteError(null);
    try {
      const response = await fetch("/api/app/discover/challenge-vote", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({challengeId: item.id.replace(/^challenge-/, ""), captureId})
      });
      const payload = await response.json().catch(() => ({})) as {error?: string};
      if (!response.ok) {
        setVoteError(payload.error ?? "Vote could not be recorded.");
        return;
      }
      setVotedCaptureId(captureId);
      setVotesCount((count) => count + 1);
    } catch {
      setVoteError("Vote could not be recorded.");
    } finally {
      setVotePending(false);
    }
  }

  function voteButton(participant: DiscoverChallengeParticipant) {
    return (
      <button
        type="button"
        disabled={votePending}
        onClick={() => castVote(participant.captureId)}
        className="min-w-0 flex-1 truncate rounded-full bg-primary-200 py-2.5 text-[11px] font-extrabold text-black/90 disabled:opacity-60"
      >
        Vote {participant.animalName}
      </button>
    );
  }

  const statusPanel = isVoting ? (
    <div className="pointer-events-auto space-y-2 rounded-[14px] bg-black/[0.72] p-3">
      <p className="text-[11px] font-black text-primary-200">Round 2: Who would win?</p>
      <p className="text-xs font-medium tabular-nums text-white">{voteProgressText(votesCount)}</p>
      {item.votingDeadlineAt ? (
        <ChallengeVotingCountdown createdAt={item.date} deadline={item.votingDeadlineAt} />
      ) : null}
      {viewerUserId == null ? (
        <Link
          href={`/account?next=${encodeURIComponent(discoverPostPath(item.id))}`}
          className="block text-[11px] font-extrabold text-primary-200"
        >
          Sign in to vote
        </Link>
      ) : isParticipant ? (
        <p className="text-[11px] font-medium text-white/[0.78]">Your battle is live. The community is voting.</p>
      ) : votedCaptureId ? (
        <p className="flex items-center gap-1.5 py-2 text-[11px] font-extrabold text-primary-200">
          <AppIcon name="check" className="h-3.5 w-3.5" />
          Vote recorded ·{" "}
          {votedCaptureId === item.attacker.captureId ? item.attacker.animalName : item.defender.animalName}
        </p>
      ) : (
        <div className="flex gap-2">
          {voteButton(item.attacker)}
          {voteButton(item.defender)}
        </div>
      )}
      {voteError ? <p className="text-[11px] font-medium text-red-400">{voteError}</p> : null}
    </div>
  ) : isV2 && isComplete ? (
    <div className="pointer-events-auto space-y-1.5 rounded-[14px] bg-black/[0.72] p-3">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-black text-primary-200">BATTLE COMPLETE</p>
        <p className="text-sm font-black text-white">
          {item.roundsWonAttacker}–{item.roundsWonDefender}
        </p>
      </div>
      {item.overallDraw ? (
        <p className="text-[11px] font-medium text-white/[0.78]">{OVERALL_DRAW_LINE}</p>
      ) : null}
      {item.settlementReason === "voting_timeout_round1_fallback" ? (
        <p className="text-[11px] font-medium text-white/[0.78]">{VOTING_TIMEOUT_FALLBACK_LINE}</p>
      ) : (
        <ChallengeRoundPager item={item} attackerCaptureId={item.attacker.captureId} />
      )}
    </div>
  ) : null;

  return (
    <article className="relative h-full min-h-0 w-full snap-start snap-always overflow-hidden bg-black">
      <div className="absolute inset-0 flex flex-col">
        <ChallengeParticipantHero
          participant={item.attacker}
          highlighted={attackerWon}
          pinsIdentityToTop={false}
        />
        <ChallengeParticipantHero
          participant={item.defender}
          highlighted={!attackerWon}
          pinsIdentityToTop
        />
      </div>

      {/* iOS overlay stack: chrome, battle status, spacer, backstory. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 px-3.5 pt-2.5">
        <div className="pointer-events-auto flex items-center justify-end gap-1 [filter:drop-shadow(0_1px_3px_rgba(0,0,0,0.6))]">
          <span className="grid h-9 w-9 place-items-center text-white/[0.78] [&_svg]:h-[1.1rem] [&_svg]:w-[1.1rem] [&>button]:grid [&>button]:h-full [&>button]:w-full [&>button]:place-items-center [&>button]:p-0">
            <ShareDiscoverPostButton url={share.url} title={share.title} text={share.text} compact />
          </span>
          <button
            type="button"
            onClick={onInfo}
            aria-label="Post information"
            className="grid h-9 w-9 place-items-center text-white/[0.78]"
          >
            <InfoIcon />
          </button>
        </div>

        {statusPanel}

        <div className="min-h-0 flex-1" />

        {backstory ? <ChallengeBackstoryPanel text={backstory} /> : null}
      </div>
    </article>
  );
}

function TradeCard({
  item,
  locale,
  onInfo,
  share,
}: {
  item: DiscoverTradeItem;
  locale: string;
  onInfo: () => void;
  share: { url: string; title: string; text?: string };
}) {
  return (
    <TimelineShell badge="Trade" date={item.date} locale={locale} onInfo={onInfo} share={share}>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-white/5">
            <img
              src={item.offerer.imageSrc}
              alt={item.offerer.animalName}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="mt-2 font-bold text-white">{item.offerer.animalName}</p>
          {item.offerer.href ? (
            <Link
              href={item.offerer.href}
              className="text-xs text-white/45 hover:text-primary-100"
            >
              {item.offerer.name}
            </Link>
          ) : (
            <p className="text-xs text-white/45">{item.offerer.name}</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="aspect-[4/3] overflow-hidden rounded-xl bg-white/5">
            <img
              src={item.receiver.imageSrc}
              alt={item.receiver.animalName}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="mt-2 font-bold text-white">
            {item.receiver.animalName}
          </p>
          {item.receiver.href ? (
            <Link
              href={item.receiver.href}
              className="text-xs text-white/45 hover:text-primary-100"
            >
              {item.receiver.name}
            </Link>
          ) : (
            <p className="text-xs text-white/45">{item.receiver.name}</p>
          )}
        </div>
      </div>
    </TimelineShell>
  );
}

function DetailRow({label, value}: {label: string; value: string | number | null}) {
  if (value === null || value === "") return null;
  return <div><p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">{label}</p><p className="mt-1 break-words text-sm leading-6 text-white/65">{value}</p></div>;
}

function DetailPills({label, values}: {label: string; values: string[]}) {
  if (!values.length) return null;
  return (
    <div>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => <FeedPill key={value}>{value}</FeedPill>)}
      </div>
    </div>
  );
}

function BoostRows({label, boosts}: {label: string; boosts: Record<string, number>}) {
  const entries = nonZeroBoosts(boosts);
  if (!entries.length) return null;
  return (
    <div>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {entries.map(([stat, value]) => (
          <div key={stat} className="rounded-xl bg-white/[0.04] px-3 py-2">
            <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-white/30">{stat}</p>
            <p className="mt-0.5 text-sm font-black text-primary-200">+{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostInformation({item, locale, onClose}: {item: DiscoverTimelineItem; locale: string; onClose: () => void}) {
  const date = formatAppShortDate(item.date, locale);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 md:items-center md:p-4" role="dialog" aria-modal="true" aria-label="Post information">
      <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-[22px] border border-white/10 bg-black p-5 shadow-2xl md:rounded-[22px]">
        <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-white">Post information</h2><button type="button" onClick={onClose} className="text-sm font-semibold text-primary-400">Close</button></div>

        {item.kind === "capture" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-primary-400/10 px-2.5 py-1 text-[11px] font-black text-primary-400">{item.animalDexNumber ? `#${String(item.animalDexNumber).padStart(3, "0")}` : "CAPTURE"}</span><span className="text-xs font-semibold text-white/35">{date}</span></div>
            <div className="flex items-center gap-3">{item.collector.avatarUrl ? <img src={item.collector.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover"/> : <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs font-bold text-white/50">{item.collector.name.slice(0,1)}</span>}<div><p className="text-sm font-semibold text-white">{item.collector.name}</p>{item.collector.username ? <p className="text-xs text-white/40">@{item.collector.username}</p> : null}</div></div>
            <div className="overflow-hidden rounded-[20px]"><MediaCarousel assets={item.mediaAssets} animalName={item.animalName} isUncertain={item.isUncertain} /></div>
            <div><div className="flex items-start justify-between gap-3"><h3 className="text-2xl font-black text-white">{item.animalName}</h3><CaptureGradeBadge grade={item.captureGrade} breakdown={item.gradeBreakdown} /></div>{item.isUncertain ? <div className="mt-2"><UncertainBadge /></div> : null}{item.headlineSupportingName ? <p className="mt-1 text-sm text-white/55">{item.headlineSupportingName}</p> : null}{item.locationLabel ? <p className="mt-2 text-sm text-white/50">⌖ &nbsp;{item.locationLabel}</p> : null}</div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              {item.contextLabel ? <FeedPill>{item.contextLabel}</FeedPill> : null}
              {item.identityKindLabel ? (
                <IdentityKindChip
                  identityKind={item.identityKind}
                  label={item.identityKindLabel}
                  animalName={item.animalName}
                  explanation={item.identityExplanation}
                  retakeGuidance={item.identityEvidenceGuidance}
                  compact
                />
              ) : null}
              {item.conservationTier ? <FeedPill tone="amber">{item.conservationTier}</FeedPill> : null}
              <FeedPill tone="green">Lvl {item.level}</FeedPill>
              <FeedPill tone="cyan">Tier {item.battleTier}</FeedPill>
              <FeedPill tone="violet">Rarity {item.rarity}</FeedPill>
              {item.animalDexNumber ? <FeedPill>#{String(item.animalDexNumber).padStart(3, "0")}</FeedPill> : null}
            </div>
            {item.mediaCount > 1 ? <div className="rounded-[20px] border border-white/10 bg-[#1f1f1f] p-4"><p className="text-[11px] font-semibold text-white/40">Media</p><p className="mt-2 text-sm text-white/60">{item.mediaCount} media items attached to this capture{item.hasVideoMedia ? ", including video/loop media." : "."}</p></div> : null}
            <div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3">
              <DetailRow label="Principle" value={item.learnedPrinciple}/>
              <DetailRow label="Core lesson" value={item.coreLesson}/>
              <DetailPills label="Best for" values={item.bestForTags}/>
              <DetailRow label="Post ID" value={item.captureId}/>
              {item.mediaCount > 1 ? <DetailRow label="Media count" value={item.mediaCount}/> : null}
            </div>
          </div>
        ) : item.kind === "alignment" ? (
          <div className="space-y-4"><img src={item.imageSrc} alt={item.rewardedAnimalName} className="aspect-square w-full rounded-[20px] object-cover"/><h3 className="text-xl font-bold text-white">Daily Companion</h3><p className="text-sm leading-6 text-white/65">{item.summary ?? item.moveTodayText ?? "Shared a Daily Alignment proof."}</p><div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3"><DetailRow label="Collector" value={item.collector.name}/><DetailRow label="Rewarded animal" value={item.rewardedAnimalName}/><DetailRow label="Stat boost" value={item.statBoostStat}/><DetailRow label="Post ID" value={item.proofId}/></div></div>
        ) : item.kind === "challenge" ? (
          <div className="space-y-4"><h3 className="text-xl font-bold text-white">{item.outcomeLine}</h3>{item.winningsLine ? <p className="text-sm text-amber-200">{item.winningsLine}</p> : null}<p className="text-sm leading-6 text-white/65">{item.activitySummary}</p><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="text-center"><img src={item.attacker.imageSrc} alt={item.attacker.animalName} className="aspect-square w-full rounded-2xl object-cover"/><p className="mt-2 text-sm font-bold text-white">{item.attacker.animalName}</p></div><span className="text-xs font-black text-white/35">VS</span><div className="text-center"><img src={item.defender.imageSrc} alt={item.defender.animalName} className="aspect-square w-full rounded-2xl object-cover"/><p className="mt-2 text-sm font-bold text-white">{item.defender.animalName}</p></div></div><div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3"><DetailRow label="Scenario" value={item.scenarioTitle}/><DetailRow label="Deciding edge" value={item.decidingEdgeLabel ?? item.chosenStat}/><DetailRow label="Winner" value={item.overallDraw ? "Draw" : item.winnerCaptureId === item.attacker.captureId ? item.attacker.displayName : item.defender.displayName}/><DetailRow label="Credits wagered" value={`${item.stakeAmount} ${item.stakeAmount === 1 ? "credit" : "credits"}`}/>{item.overallDraw ? <DetailRow label="Credits returned to each player" value={`${item.stakeAmount} ${item.stakeAmount === 1 ? "credit" : "credits"}`}/> : <DetailRow label={item.battleStatus === "completed" || item.challengeFormat !== "best_of_3_v2" ? "Credits paid to winner" : "Potential winner payout"} value={`${item.payoutAmount} ${item.payoutAmount === 1 ? "credit" : "credits"}`}/>}<DetailRow label="Post ID" value={item.id.replace(/^challenge-/, "")}/></div></div>
        ) : item.kind === "fusion" ? (
          <div className="space-y-4"><h3 className="text-xl font-bold text-white">Principle Fusion</h3><p className="text-sm leading-6 text-white/65">{item.receiverAnimalName} learned from {item.donorAnimalName}.</p><DetailRow label="Learned sub-principle" value={item.learnedPrinciple}/><DetailRow label="Expression" value={item.learnedExpression}/><DetailRow label="Post ID" value={item.fusionId}/></div>
        ) : item.kind === "animal-trial" ? (
          <div className="space-y-4">
            <div className="aspect-[4/5] max-h-80 w-full overflow-hidden rounded-[20px]"><AnimalTrialEvidence item={item} /></div>
            <h3 className="text-xl font-bold text-white">{item.isFailed ? "Animal Trial · Evidence not accepted" : "Animal Trial"}</h3>
            <p className="whitespace-pre-line text-sm leading-6 text-white/65">{item.title}</p>
            <div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3">
              <DetailRow label="Collector" value={item.collector.name}/>
              <DetailRow label="Animal" value={item.speciesName}/>
              <DetailRow label="Power" value={item.principleName || null}/>
              <DetailRow label="Route" value={animalTrialFrequencyLabel(item.frequency)}/>
              <DetailRow label="Evidence" value={item.proofType}/>
              {item.isFailed ? null : <DetailRow label="Reward" value={`+${item.rewardXP} XP${item.rewardCredits > 0 ? ` · +${item.rewardCredits} Credits` : ""}`}/>}
              <DetailRow label="Post ID" value={item.postId}/>
            </div>
          </div>
        ) : (
          <div className="space-y-4"><h3 className="text-xl font-bold text-white">Trade</h3><DetailRow label="Offered" value={`${item.offerer.animalName} · ${item.offerer.name}`}/><DetailRow label="Received" value={`${item.receiver.animalName} · ${item.receiver.name}`}/><DetailRow label="Post ID" value={item.id.replace(/^trade-/, "")}/></div>
        )}
      </div>
    </div>
  );
}

export function DiscoverTimelineCard({
  item,
  locale,
  viewerUserId = null,
}: {
  item: DiscoverTimelineItem;
  locale: string;
  viewerUserId?: string | null;
}) {
  const [showsInfo, setShowsInfo] = useState(false);
  const onInfo = () => setShowsInfo(true);
  const share = sharePropsForItem(item, locale);
  let card: React.ReactNode;

  switch (item.kind) {
    case "capture":
      card = <CaptureCard item={item} locale={locale} viewerUserId={viewerUserId} />;
      break;
    case "alignment":
      card = <AlignmentCard item={item} locale={locale} onInfo={onInfo} share={share} />;
      break;
    case "fusion":
      card = <FusionCard item={item} locale={locale} onInfo={onInfo} share={share} />;
      break;
    case "challenge":
      card = <ChallengeCard item={item} onInfo={onInfo} share={share} viewerUserId={viewerUserId} />;
      break;
    case "trade":
      card = <TradeCard item={item} locale={locale} onInfo={onInfo} share={share} />;
      break;
    case "animal-trial":
      card = (
        <TimelineShell badge="Animal Trial" date={item.date} locale={locale} onInfo={onInfo} share={share}>
          <AnimalTrialCard item={item} viewerUserId={viewerUserId} />
        </TimelineShell>
      );
      break;
  }

  return <>{card}{showsInfo && item.kind !== "capture" ? <PostInformation item={item} locale={locale} onClose={() => setShowsInfo(false)} /> : null}</>;
}
