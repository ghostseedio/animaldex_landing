"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import type {
  DiscoverAlignmentItem,
  DiscoverCaptureItem,
  DiscoverChallengeItem,
  DiscoverCollectorRef,
  DiscoverFusionItem,
  DiscoverMediaAsset,
  DiscoverTimelineItem,
  DiscoverTradeItem,
} from "@/data/discover-timeline";
import { formatAppShortDate } from "@/lib/app-dates";

const FEED_VIDEO_SOUND_EVENT = "animaldex-feed-video-sound";
let feedVideoSoundEnabled = false;

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

function GradeBadge({grade}: {grade: number}) {
  return (
    <span className="shrink-0 rounded-full bg-primary-400 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-black ring-1 ring-white/20">
      Grade {grade}
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

function CollectorHeader({ collector }: { collector: DiscoverCollectorRef }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {collector.avatarUrl ? (
        <img
          src={collector.avatarUrl}
          alt=""
          className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
        />
      ) : (
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xs font-bold text-white/50">
          {collector.name.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white/80">
          <CollectorLink collector={collector} />
        </p>
        {collector.username ? (
          <p className="truncate text-xs text-white/35">@{collector.username}</p>
        ) : null}
      </div>
    </div>
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

function MediaCarousel({
  assets,
  animalName,
  isUncertain = false,
  layout = "standard",
}: {
  assets: DiscoverMediaAsset[];
  animalName: string;
  isUncertain?: boolean;
  layout?: "standard" | "feed";
}) {
  const media = useMemo(() => assets.length ? assets : [], [assets]);
  const videoSourceById = useMemo(() => new Map(media.map((asset) => [asset.id, asset.url])), [media]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [isMediaActive, setIsMediaActive] = useState(layout !== "feed");
  const [loadedVideoIds, setLoadedVideoIds] = useState<Set<string>>(() => new Set());
  const [isFeedSoundEnabled, setIsFeedSoundEnabled] = useState(feedVideoSoundEnabled);
  const shouldLoadMedia = layout !== "feed" || isMediaActive;

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
  }, [isFeedSoundEnabled, media, shouldLoadMedia, videoSourceById]);

  if (!media.length) return null;

  const toggleVideoSound = (asset: DiscoverMediaAsset) => {
    const video = videoRefs.current[asset.id];
    const nextSoundEnabled = !isFeedSoundEnabled;
    feedVideoSoundEnabled = nextSoundEnabled;
    setIsFeedSoundEnabled(nextSoundEnabled);
    window.dispatchEvent(new CustomEvent(FEED_VIDEO_SOUND_EVENT, {detail: {enabled: nextSoundEnabled}}));

    setLoadedVideoIds((current) => {
      if (current.has(asset.id)) return current;
      const next = new Set(current);
      next.add(asset.id);
      return next;
    });

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

  const frameClass = layout === "feed"
    ? "relative h-[52svh] min-h-[20rem] max-h-[36rem] shrink-0 bg-black sm:h-[54svh] md:h-[56svh]"
    : "relative bg-white/5";
  const scrollerClass = layout === "feed"
    ? "flex h-full min-h-0 w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const itemClass = layout === "feed"
    ? "relative h-full min-h-0 w-full shrink-0 snap-center overflow-hidden"
    : "relative aspect-[16/10] w-full shrink-0 snap-center overflow-hidden";
  const mediaFitClass = "object-cover object-[50%_28%]";

  return (
    <div ref={rootRef} className={frameClass}>
      <div className={scrollerClass}>
        {media.map((asset, index) => (
          <div key={asset.id} className={itemClass}>
            {asset.kind === "video" || asset.kind === "loop" ? (
              <video
                src={loadedVideoIds.has(asset.id) ? asset.url : undefined}
                poster={shouldLoadMedia || loadedVideoIds.has(asset.id) ? asset.posterUrl ?? undefined : undefined}
                muted={!isFeedSoundEnabled}
                loop
                playsInline
                preload={loadedVideoIds.has(asset.id) ? "metadata" : "none"}
                data-media-id={asset.id}
                ref={(node) => {
                  videoRefs.current[asset.id] = node;
                }}
                className={`h-full w-full bg-black ${mediaFitClass}`}
              />
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
            {(asset.kind === "video" || asset.kind === "loop") ? (
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/85 ring-1 ring-white/10">
                Video
              </span>
            ) : null}
            {(asset.kind === "video" || asset.kind === "loop") ? (
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
            {isUncertain ? (
              <span className="absolute right-3 top-3">
                <UncertainBadge />
              </span>
            ) : null}
            {media.length > 1 ? (
              <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[0.68rem] font-black text-white/90 ring-1 ring-white/10">
                {index + 1} / {media.length}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {media.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {media.map((asset, index) => (
            <span
              key={`${asset.id}-dot`}
              className={`h-1.5 rounded-full ${index === 0 ? "w-4 bg-white/80" : "w-1.5 bg-white/35"}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TimelineShell({
  badge,
  date,
  locale,
  onInfo,
  children,
}: {
  badge: string;
  date: string;
  locale: string;
  onInfo: () => void;
  children: React.ReactNode;
}) {
  const formatted = formatAppShortDate(date, locale);
  return (
    <article className="flex h-full min-h-0 snap-start snap-always scroll-mt-4 flex-col justify-center overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#121212]/90 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] transition [contain-intrinsic-size:760px] [content-visibility:auto] hover:border-white/14">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
        <ActivityBadge label={badge} />
        <div className="flex items-center gap-2.5">
          {formatted ? (
            <span className="text-xs font-bold text-white/35">{formatted}</span>
          ) : null}
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

function CaptureCard({
  item,
  onInfo,
}: {
  item: DiscoverCaptureItem;
  locale: string;
  onInfo: () => void;
}) {
  const badgeLabel = item.activityBadge.toLowerCase() === "capture" && item.animalDexNumber
    ? `#${String(item.animalDexNumber).padStart(3, "0")}`
    : item.activityBadge;
  const hasActionPills = item.endorsementCount > 0 || item.isChallengeAvailable;

  return (
    <article className={`flex h-full min-h-0 snap-start snap-always scroll-mt-4 flex-col overflow-hidden rounded-[1.35rem] border bg-[#121212]/90 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] transition [contain-intrinsic-size:760px] [content-visibility:auto] ${item.isUncertain ? "border-red-500/45 hover:border-red-400/60" : "border-white/[0.08] hover:border-white/14"}`}>
      <div className="flex shrink-0 items-start justify-between gap-3 p-3 sm:p-4">
        <CollectorHeader collector={item.collector} />
        <div className="flex shrink-0 items-center gap-2">
          <ActivityBadge label={badgeLabel} />
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
      {item.activityLine ? (
        <p className="line-clamp-2 shrink-0 px-3 pb-3 text-sm leading-6 text-white/55 sm:px-4 sm:pb-4">{item.activityLine}</p>
      ) : null}
      <MediaCarousel assets={item.mediaAssets} animalName={item.animalName} isUncertain={item.isUncertain} layout="feed" />
      <div className="flex min-h-0 flex-1 flex-col justify-center space-y-1.5 overflow-hidden px-3 py-3.5 sm:px-4 sm:py-4">
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="line-clamp-1 font-display text-xl font-bold leading-tight text-white sm:text-2xl">
            <Link href={item.href}>{item.animalName}</Link>
          </h3>
          <GradeBadge grade={item.captureGrade} />
        </div>
        {item.isUncertain ? <UncertainBadge /> : null}
        {item.lifeStageChip ? (
          <span className="inline-flex rounded-full bg-white/[0.06] px-2.5 py-1 text-[0.68rem] font-bold text-white/65">
            {item.lifeStageChip}
          </span>
        ) : null}
        {item.headlineSupportingName ? (
          <p className="line-clamp-1 text-sm leading-5 text-white/55">{item.headlineSupportingName}</p>
        ) : null}
        {item.sameSpeciesHelper ? (
          <p className="line-clamp-1 text-xs leading-4 text-white/40">{item.sameSpeciesHelper}</p>
        ) : null}
        {item.learnedPrinciple ? (
          <p className="flex items-center gap-2 text-sm leading-5 text-white/55">
            <AppIcon name="spark" className="h-3.5 w-3.5 text-primary-200" />
            <span className="line-clamp-1">{item.learnedPrinciple}</span>
          </p>
        ) : null}
        {item.bestForTags.length ? (
          <div className="flex max-h-7 flex-wrap gap-1.5 overflow-hidden">
            {item.bestForTags.map((tag) => <FeedPill key={tag}>{tag}</FeedPill>)}
          </div>
        ) : null}
        {hasActionPills ? (
          <div className="flex max-h-7 flex-wrap items-center gap-1.5 overflow-hidden">
            {item.endorsementCount > 0 ? (
              <FeedPill tone="cyan">
                {item.endorsementCount} endorsement{item.endorsementCount === 1 ? "" : "s"}
              </FeedPill>
            ) : null}
            {item.isChallengeAvailable ? (
              <FeedPill tone="cyan">Enter {item.challengeStake} credit{item.challengeStake === 1 ? "" : "s"}</FeedPill>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function AlignmentCard({
  item,
  locale,
  onInfo,
}: {
  item: DiscoverAlignmentItem;
  locale: string;
  onInfo: () => void;
}) {
  return (
    <TimelineShell badge="Daily alignment" date={item.date} locale={locale} onInfo={onInfo}>
      <div className="grid gap-4 p-4 md:grid-cols-[7.5rem_1fr]">
        <Link
          href={item.href}
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
              href={item.href}
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
}: {
  item: DiscoverFusionItem;
  locale: string;
  onInfo: () => void;
}) {
  return (
    <TimelineShell badge="Principle fusion" date={item.date} locale={locale} onInfo={onInfo}>
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

function ChallengeParticipantBlock({
  participant,
  highlighted,
}: {
  participant: DiscoverChallengeItem["attacker"];
  highlighted: boolean;
}) {
  const profile = participant.href ? (
    <Link href={participant.href} className="font-bold text-white/75 hover:text-primary-100">
      {participant.displayName}
    </Link>
  ) : (
    <span className="font-bold text-white/75">{participant.displayName}</span>
  );

  return (
    <div
      className={`rounded-2xl border p-3 ${
        highlighted
          ? "border-primary-400/40 bg-primary-400/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <div className="mb-3 flex min-w-0 items-center gap-2.5">
        {participant.avatarUrl ? (
          <img
            src={participant.avatarUrl}
            alt=""
            className={`h-8 w-8 rounded-full object-cover ring-2 ${
              highlighted ? "ring-primary-400/50" : "ring-white/10"
            }`}
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[0.65rem] font-bold text-white/50">
            {participant.displayName.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm">{profile}</p>
          {participant.username ? (
            <p className="truncate text-xs text-white/35">@{participant.username}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white/5">
          <img
            src={participant.imageSrc}
            alt={participant.animalName}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white">{participant.animalName}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {participant.battleTier ? (
              <FeedPill tone="cyan">Tier {participant.battleTier}</FeedPill>
            ) : null}
            {participant.battlePower != null ? (
              <FeedPill>Power {participant.battlePower}</FeedPill>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChallengeCard({
  item,
  locale,
  onInfo,
}: {
  item: DiscoverChallengeItem;
  locale: string;
  onInfo: () => void;
}) {
  const attackerWon = item.winnerCaptureId === item.attacker.captureId;

  return (
    <TimelineShell badge="Scenario arena" date={item.date} locale={locale} onInfo={onInfo}>
      <div className="space-y-4 p-4">
        <p className="font-display text-xl font-bold text-white">{item.outcomeLine}</p>
        {item.winningsLine ? (
          <p className="text-sm font-semibold text-amber-200">{item.winningsLine}</p>
        ) : null}
        <p className="text-sm leading-6 text-white/55">{item.activitySummary}</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
          <ChallengeParticipantBlock
            participant={item.attacker}
            highlighted={attackerWon}
          />
          <div className="flex items-center justify-center">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white/45">
              VS
            </span>
          </div>
          <ChallengeParticipantBlock
            participant={item.defender}
            highlighted={!attackerWon}
          />
        </div>
      </div>
    </TimelineShell>
  );
}

function TradeCard({
  item,
  locale,
  onInfo,
}: {
  item: DiscoverTradeItem;
  locale: string;
  onInfo: () => void;
}) {
  return (
    <TimelineShell badge="Trade" date={item.date} locale={locale} onInfo={onInfo}>
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
        <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-bold text-white">Post information</h2><button type="button" onClick={onClose} className="text-sm font-semibold text-[#38fa47]">Close</button></div>

        {item.kind === "capture" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#38fa47]/10 px-2.5 py-1 text-[11px] font-black text-[#38fa47]">{item.animalDexNumber ? `#${String(item.animalDexNumber).padStart(3, "0")}` : "CAPTURE"}</span><span className="text-xs font-semibold text-white/35">{date}</span></div>
            <div className="flex items-center gap-3">{item.collector.avatarUrl ? <img src={item.collector.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover"/> : <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs font-bold text-white/50">{item.collector.name.slice(0,1)}</span>}<div><p className="text-sm font-semibold text-white">{item.collector.name}</p>{item.collector.username ? <p className="text-xs text-white/40">@{item.collector.username}</p> : null}</div></div>
            <div className="overflow-hidden rounded-[20px]"><MediaCarousel assets={item.mediaAssets} animalName={item.animalName} isUncertain={item.isUncertain} /></div>
            <div><div className="flex items-start justify-between gap-3"><h3 className="text-2xl font-black text-white">{item.animalName}</h3><GradeBadge grade={item.captureGrade} /></div>{item.isUncertain ? <div className="mt-2"><UncertainBadge /></div> : null}{item.headlineSupportingName ? <p className="mt-1 text-sm text-white/55">{item.headlineSupportingName}</p> : null}{item.locationLabel ? <p className="mt-2 text-sm text-white/50">⌖ &nbsp;{item.locationLabel}</p> : null}</div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">{item.contextLabel ? <FeedPill>{item.contextLabel}</FeedPill> : null}{item.conservationTier ? <FeedPill tone="amber">{item.conservationTier}</FeedPill> : null}<FeedPill tone="green">Lvl {item.level}</FeedPill><FeedPill tone="violet">Rarity {item.rarity}</FeedPill>{item.animalDexNumber ? <FeedPill>#{String(item.animalDexNumber).padStart(3, "0")}</FeedPill> : null}</div>
            {item.mediaCount > 1 ? <div className="rounded-[20px] border border-white/10 bg-[#1f1f1f] p-4"><p className="text-[11px] font-semibold text-white/40">Media</p><p className="mt-2 text-sm text-white/60">{item.mediaCount} media items attached to this capture{item.hasVideoMedia ? ", including video/loop media." : "."}</p></div> : null}
            <div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3">
              <DetailRow label="Post ID" value={item.captureId}/>
              {item.mediaCount > 1 ? <DetailRow label="Media count" value={item.mediaCount}/> : null}
            </div>
          </div>
        ) : item.kind === "alignment" ? (
          <div className="space-y-4"><img src={item.imageSrc} alt={item.rewardedAnimalName} className="aspect-square w-full rounded-[20px] object-cover"/><h3 className="text-xl font-bold text-white">Daily Companion</h3><p className="text-sm leading-6 text-white/65">{item.summary ?? item.moveTodayText ?? "Shared a Daily Alignment proof."}</p><div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3"><DetailRow label="Collector" value={item.collector.name}/><DetailRow label="Rewarded animal" value={item.rewardedAnimalName}/><DetailRow label="Stat boost" value={item.statBoostStat}/><DetailRow label="Post ID" value={item.proofId}/></div></div>
        ) : item.kind === "challenge" ? (
          <div className="space-y-4"><h3 className="text-xl font-bold text-white">{item.outcomeLine}</h3>{item.winningsLine ? <p className="text-sm text-amber-200">{item.winningsLine}</p> : null}<p className="text-sm leading-6 text-white/65">{item.activitySummary}</p><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="text-center"><img src={item.attacker.imageSrc} alt={item.attacker.animalName} className="aspect-square w-full rounded-2xl object-cover"/><p className="mt-2 text-sm font-bold text-white">{item.attacker.animalName}</p></div><span className="text-xs font-black text-white/35">VS</span><div className="text-center"><img src={item.defender.imageSrc} alt={item.defender.animalName} className="aspect-square w-full rounded-2xl object-cover"/><p className="mt-2 text-sm font-bold text-white">{item.defender.animalName}</p></div></div><div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3"><DetailRow label="Scenario" value={item.scenarioTitle}/><DetailRow label="Deciding edge" value={item.decidingEdgeLabel ?? item.chosenStat}/><DetailRow label="Winner" value={item.winnerCaptureId === item.attacker.captureId ? item.attacker.displayName : item.defender.displayName}/><DetailRow label="Post ID" value={item.id.replace(/^challenge-/, "")}/></div></div>
        ) : item.kind === "fusion" ? (
          <div className="space-y-4"><h3 className="text-xl font-bold text-white">Principle Fusion</h3><p className="text-sm leading-6 text-white/65">{item.receiverAnimalName} learned from {item.donorAnimalName}.</p><DetailRow label="Learned sub-principle" value={item.learnedPrinciple}/><DetailRow label="Expression" value={item.learnedExpression}/><DetailRow label="Post ID" value={item.fusionId}/></div>
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
}: {
  item: DiscoverTimelineItem;
  locale: string;
}) {
  const [showsInfo, setShowsInfo] = useState(false);
  const onInfo = () => setShowsInfo(true);
  let card: React.ReactNode;

  switch (item.kind) {
    case "capture":
      card = <CaptureCard item={item} locale={locale} onInfo={onInfo} />;
      break;
    case "alignment":
      card = <AlignmentCard item={item} locale={locale} onInfo={onInfo} />;
      break;
    case "fusion":
      card = <FusionCard item={item} locale={locale} onInfo={onInfo} />;
      break;
    case "challenge":
      card = <ChallengeCard item={item} locale={locale} onInfo={onInfo} />;
      break;
    case "trade":
      card = <TradeCard item={item} locale={locale} onInfo={onInfo} />;
      break;
  }

  return <>{card}{showsInfo ? <PostInformation item={item} locale={locale} onClose={() => setShowsInfo(false)} /> : null}</>;
}
