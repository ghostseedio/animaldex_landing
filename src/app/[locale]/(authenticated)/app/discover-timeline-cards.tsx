"use client";

import { useState } from "react";
import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import type {
  DiscoverAlignmentItem,
  DiscoverCaptureItem,
  DiscoverChallengeItem,
  DiscoverCollectorRef,
  DiscoverFusionItem,
  DiscoverTimelineItem,
  DiscoverTradeItem,
} from "@/data/discover-timeline";
import { formatAppShortDate } from "@/lib/app-dates";

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
    <article className="overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#121212]/90 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] transition hover:border-white/14">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
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

  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#121212]/90 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.95)] transition hover:border-white/14">
      <div className="flex items-start justify-between gap-3 p-4">
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
        <p className="px-4 pb-4 text-sm leading-6 text-white/55">{item.activityLine}</p>
      ) : null}
      <Link href={item.href} className="group block">
        <div className="relative aspect-[16/10] overflow-hidden bg-white/5">
          <img
            src={item.imageSrc}
            alt={item.animalName}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
          {item.mediaCount > 1 ? (
            <div className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.68rem] font-black text-white/90 ring-1 ring-white/10">
              1 / {item.mediaCount}
            </div>
          ) : null}
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <h3 className="font-display text-2xl font-bold text-white">
          <Link href={item.href}>{item.animalName}</Link>
        </h3>
        {item.headlineSupportingName ? (
          <p className="text-sm text-white/55">{item.headlineSupportingName}</p>
        ) : null}
        {item.learnedPrinciple ? (
          <p className="flex items-center gap-2 text-sm text-white/55">
            <AppIcon name="spark" className="h-3.5 w-3.5 text-primary-200" />
            <span>{item.learnedPrinciple}</span>
          </p>
        ) : null}
        {item.bestForTags.length ? (
          <div className="flex flex-wrap gap-2">
            {item.bestForTags.map((tag) => <FeedPill key={tag}>{tag}</FeedPill>)}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {item.endorsementCount > 0 ? (
            <FeedPill tone="cyan">
              {item.endorsementCount} endorsement{item.endorsementCount === 1 ? "" : "s"}
            </FeedPill>
          ) : null}
          {item.isChallengeAvailable ? (
            <FeedPill tone="cyan">Enter {item.challengeStake} credit{item.challengeStake === 1 ? "" : "s"}</FeedPill>
          ) : null}
        </div>
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
            <img src={item.imageSrc} alt={item.animalName} className="aspect-[16/10] w-full rounded-[20px] object-cover"/>
            <div><h3 className="text-2xl font-black text-white">{item.animalName}</h3>{item.headlineSupportingName ? <p className="mt-1 text-sm text-white/55">{item.headlineSupportingName}</p> : null}{item.locationLabel ? <p className="mt-2 text-sm text-white/50">⌖ &nbsp;{item.locationLabel}</p> : null}</div>
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
