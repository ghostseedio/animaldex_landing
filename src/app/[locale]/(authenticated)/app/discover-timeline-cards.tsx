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
  locale,
  onInfo,
}: {
  item: DiscoverCaptureItem;
  locale: string;
  onInfo: () => void;
}) {
  return (
    <TimelineShell badge="Capture" date={item.date} locale={locale} onInfo={onInfo}>
      <Link href={item.href} className="group block">
        <div className="relative aspect-[16/10] overflow-hidden bg-white/5">
          <img
            src={item.imageSrc}
            alt={item.animalName}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
          <span className="absolute right-3 top-3 rounded-full bg-primary-400 px-2.5 py-1 text-xs font-black text-black">
            {item.score}
          </span>
        </div>
      </Link>
      <div className="space-y-2 p-4">
        <h3 className="font-display text-2xl font-bold text-white">
          <Link href={item.href}>{item.animalName}</Link>
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
          <CollectorLink collector={item.collector} />
          {item.contextLabel ? (
            <span className="rounded-full bg-white/[0.06] px-2 py-0.5">
              {item.contextLabel}
            </span>
          ) : null}
          {item.endorsementCount > 0 ? (
            <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-cyan-200">
              {item.endorsementCount} endorsed
            </span>
          ) : null}
        </div>
        {item.locationLabel ? (
          <p className="text-sm text-white/35">{item.locationLabel}</p>
        ) : null}
      </div>
    </TimelineShell>
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

function ChallengeCard({
  item,
  locale,
  onInfo,
}: {
  item: DiscoverChallengeItem;
  locale: string;
  onInfo: () => void;
}) {
  const winnerSide = !item.winnerCaptureId
    ? null
    : item.winnerCaptureId === item.attacker.captureId
      ? "attacker"
      : item.winnerCaptureId === item.defender.captureId
        ? "defender"
        : null;

  return (
    <TimelineShell badge="Scenario arena" date={item.date} locale={locale} onInfo={onInfo}>
      <div className="space-y-4 p-4">
        <p className="font-display text-xl font-bold text-white">
          {item.scenarioTitle ?? "Animal comparison"}
        </p>
        {item.scenarioDomain ? (
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-300">
            {item.scenarioDomain}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div
            className={`rounded-2xl border p-3 ${winnerSide === "attacker" ? "border-primary-400/40 bg-primary-400/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-white/5">
              <img
                src={item.attacker.imageSrc}
                alt={item.attacker.animalName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-2 font-bold text-white">
              {item.attacker.animalName}
            </p>
            {item.attacker.username ? (
              <p className="text-xs text-white/40">@{item.attacker.username}</p>
            ) : null}
          </div>
          <div
            className={`rounded-2xl border p-3 ${winnerSide === "defender" ? "border-primary-400/40 bg-primary-400/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-white/5">
              <img
                src={item.defender.imageSrc}
                alt={item.defender.animalName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-2 font-bold text-white">
              {item.defender.animalName}
            </p>
            {item.defender.username ? (
              <p className="text-xs text-white/40">@{item.defender.username}</p>
            ) : null}
          </div>
        </div>
        {item.chosenStat ? (
          <p className="text-sm text-white/45">Decided on {item.chosenStat}</p>
        ) : null}
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
            <div><h3 className="text-2xl font-black text-white">{item.animalName}</h3>{item.breedGuess || item.scientificName ? <p className="mt-1 text-sm text-white/55">{item.breedGuess ?? item.scientificName}</p> : null}{item.locationLabel ? <p className="mt-2 text-sm text-white/50">⌖ &nbsp;{item.locationLabel}</p> : null}</div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">{item.contextLabel ? <span className="rounded-full bg-white/5 px-2.5 py-1.5 text-white/60">{item.contextLabel}</span> : null}{item.conservationTier ? <span className="rounded-full bg-amber-400/10 px-2.5 py-1.5 text-amber-200">{item.conservationTier}</span> : null}<span className="rounded-full bg-[#38fa47]/10 px-2.5 py-1.5 text-[#38fa47]">Lvl {Math.min(100, Math.floor(Math.sqrt(Math.max(0, item.totalProgressionXP))) + 1)}</span><span className="rounded-full bg-violet-400/10 px-2.5 py-1.5 text-violet-200">Rarity {item.rarity}</span></div>
            {item.mediaCount > 1 ? <div className="rounded-[20px] border border-white/10 bg-[#1f1f1f] p-4"><p className="text-[11px] font-semibold text-white/40">Media</p><p className="mt-2 text-sm text-white/60">{item.mediaCount} media items attached to this capture</p></div> : null}
            <div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3"><DetailRow label="Post ID" value={item.captureId}/><DetailRow label="Scientific name" value={item.scientificName}/><DetailRow label="Score" value={item.score}/><DetailRow label="Endorsements" value={item.endorsementCount}/></div>
          </div>
        ) : item.kind === "alignment" ? (
          <div className="space-y-4"><img src={item.imageSrc} alt={item.rewardedAnimalName} className="aspect-square w-full rounded-[20px] object-cover"/><h3 className="text-xl font-bold text-white">Daily Companion</h3><p className="text-sm leading-6 text-white/65">{item.summary ?? item.moveTodayText ?? "Shared a Daily Alignment proof."}</p><div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3"><DetailRow label="Collector" value={item.collector.name}/><DetailRow label="Rewarded animal" value={item.rewardedAnimalName}/><DetailRow label="Stat boost" value={item.statBoostStat}/><DetailRow label="Post ID" value={item.proofId}/></div></div>
        ) : item.kind === "challenge" ? (
          <div className="space-y-4"><h3 className="text-xl font-bold text-white">{item.scenarioTitle ?? "Scenario Arena"}</h3>{item.scenarioDomain ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-300">{item.scenarioDomain}</p> : null}<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div className="text-center"><img src={item.attacker.imageSrc} alt={item.attacker.animalName} className="aspect-square w-full rounded-2xl object-cover"/><p className="mt-2 text-sm font-bold text-white">{item.attacker.animalName}</p></div><span className="text-xs font-black text-white/35">VS</span><div className="text-center"><img src={item.defender.imageSrc} alt={item.defender.animalName} className="aspect-square w-full rounded-2xl object-cover"/><p className="mt-2 text-sm font-bold text-white">{item.defender.animalName}</p></div></div><div className="space-y-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] p-3"><DetailRow label="Deciding stat" value={item.chosenStat}/><DetailRow label="Winner capture" value={item.winnerCaptureId}/><DetailRow label="Post ID" value={item.id.replace(/^challenge-/, "")}/></div></div>
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
