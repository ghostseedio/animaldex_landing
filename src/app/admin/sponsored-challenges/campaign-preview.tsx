"use client";

/* Preview URLs can come from Supabase storage or the local asset picker. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { formatEarningsMinor } from "@/lib/earnings";
import {
  PREVIEW_PROGRESS_NOTICE,
  PREVIEW_TABS,
  cardAuthorship,
  cardObjectiveLine,
  formatPreviewDateRange,
  previewProgress,
  qualificationBullets,
  rewardLabel,
  type PreviewCampaign,
  type PreviewTab,
} from "@/lib/sponsored-challenge-preview";

export function CampaignPreview({ campaign }: { campaign: PreviewCampaign }) {
  const [tab, setTab] = useState<PreviewTab>("card");
  const authorship = cardAuthorship(campaign);
  const progressJoined = previewProgress(campaign.targetCount, "joined");
  const progressDone = previewProgress(campaign.targetCount, "completed");
  const bullets = qualificationBullets(campaign);
  const windowLabel = formatPreviewDateRange(
    campaign.startsAt,
    campaign.endsAt,
  );
  const reward = rewardLabel(
    campaign.rewardTitle,
    campaign.cashAmountMinor,
    campaign.cashCurrencyCode,
  );
  const title = campaign.title.trim() || "Untitled Challenge";

  return (
    <aside className="rounded-3xl border border-line-300 bg-canvas-950/70 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary-200">
            Live consumer preview
          </p>
          <p className="mt-1 text-xs text-ink-500">
            Updates from the current form. Nothing is saved or granted.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PREVIEW_TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${
              tab === item
                ? "border-primary-300 bg-primary-500/15 text-primary-100"
                : "border-line-300 text-ink-400"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[1.75rem] border border-line-300 bg-surface-900 p-4">
        {tab === "card" ? (
          <CardPreview
            title={title}
            authorship={authorship}
            objective={cardObjectiveLine(campaign)}
            windowLabel={windowLabel}
            venueName={campaign.venueName}
            reward={reward}
            campaign={campaign}
          />
        ) : null}
        {tab === "detail" ? (
          <DetailPreview
            title={title}
            authorship={authorship}
            summary={campaign.publicSummary}
            description={campaign.description}
            windowLabel={windowLabel}
            target={campaign.targetCount}
            bullets={bullets}
            venueName={campaign.venueName}
            reward={reward}
            campaign={campaign}
          />
        ) : null}
        {tab === "joined" ? (
          <JoinedPreview
            title={title}
            current={progressJoined.current}
            target={progressJoined.target}
          />
        ) : null}
        {tab === "completed" ? (
          <CompletedPreview
            current={progressDone.current}
            target={progressDone.target}
            achievement={campaign.rewardTitle?.trim() || title}
            cashReward={
              campaign.cashAmountMinor && campaign.cashCurrencyCode
                ? formatEarningsMinor(
                    campaign.cashAmountMinor,
                    campaign.cashCurrencyCode,
                  )
                : null
            }
          />
        ) : null}
      </div>
      {tab === "joined" || tab === "completed" ? (
        <p className="mt-3 text-[11px] text-amber-100">
          {PREVIEW_PROGRESS_NOTICE}
        </p>
      ) : null}
    </aside>
  );
}

function CardPreview({
  title,
  authorship,
  objective,
  windowLabel,
  venueName,
  reward,
  campaign,
}: {
  title: string;
  authorship: ReturnType<typeof cardAuthorship>;
  objective: string;
  windowLabel: string;
  venueName: string | null;
  reward: string;
  campaign: PreviewCampaign;
}) {
  return (
    <article className="space-y-3">
      {campaign.thumbnailUrl ? (
        <img
          src={campaign.thumbnailUrl}
          alt={campaign.thumbnailAltText ?? ""}
          className="aspect-video w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-2xl border border-dashed border-line-300 bg-surface-900 text-center">
          <div>
            <p className="text-sm font-bold text-ink-300">Challenge artwork</p>
            <p className="mt-1 text-xs text-ink-500">No artwork uploaded yet</p>
          </div>
        </div>
      )}
      <h3 className="font-display text-2xl text-white">{title}</h3>
      {authorship.showSponsored ? (
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-primary-200">
            Sponsored
          </p>
          {authorship.presentedBy ? (
            <p className="text-sm text-ink-300">
              Presented by {authorship.presentedBy}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-ink-300">{authorship.authorLabel}</p>
      )}
      <p className="text-sm text-ink-100">{objective}</p>
      <div className="space-y-1.5">
        <p className="text-sm font-black text-ink-100">0 / {campaign.targetCount}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-0 rounded-full bg-primary-500" />
        </div>
      </div>
      {windowLabel ? (
        <p className="text-sm text-ink-300">{windowLabel}</p>
      ) : null}
      {venueName ? <p className="text-xs text-ink-500">{venueName}</p> : null}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
          Reward
        </p>
        <p className="mt-1 text-sm text-ink-100">{reward}</p>
        {campaign.cashRemainingRecipients != null ? (
          <p className="mt-1 text-xs text-ink-400">
            {campaign.cashRemainingRecipients} rewards remaining
          </p>
        ) : null}
      </div>
      <p className="rounded-xl bg-primary-500 px-3 py-2 text-center text-sm font-black text-canvas-950">
        View Challenge
      </p>
    </article>
  );
}

function DetailPreview({
  title,
  authorship,
  summary,
  description,
  windowLabel,
  target,
  bullets,
  venueName,
  reward,
  campaign,
}: {
  title: string;
  authorship: ReturnType<typeof cardAuthorship>;
  summary: string;
  description: string;
  windowLabel: string;
  target: number;
  bullets: string[];
  venueName: string | null;
  reward: string;
  campaign: PreviewCampaign;
}) {
  return (
    <article className="space-y-3">
      {campaign.thumbnailUrl ? (
        <img
          src={campaign.thumbnailUrl}
          alt={campaign.thumbnailAltText ?? ""}
          className="aspect-video w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded-2xl border border-dashed border-line-300 bg-surface-900 text-center">
          <div>
            <p className="text-sm font-bold text-ink-300">Challenge artwork</p>
            <p className="mt-1 text-xs text-ink-500">No artwork uploaded yet</p>
          </div>
        </div>
      )}
      <h3 className="font-display text-2xl text-white">{title}</h3>
      <p className="text-sm text-ink-300">
        {authorship.showSponsored
          ? `Sponsored${authorship.presentedBy ? ` · Presented by ${authorship.presentedBy}` : ""}`
          : authorship.authorLabel}
      </p>
      {summary ? <p className="text-sm text-ink-100">{summary}</p> : null}
      {description ? (
        <p className="text-sm leading-6 text-ink-300">{description}</p>
      ) : null}
      {windowLabel ? (
        <p className="text-xs text-ink-500">{windowLabel}</p>
      ) : null}
      <p className="font-display text-xl text-white">0 / {target}</p>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
          How captures qualify
        </p>
        <ul className="mt-2 space-y-1 text-sm text-ink-200">
          {bullets.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>
      {venueName ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
            Venue
          </p>
          <p className="mt-1 text-sm text-ink-100">{venueName}</p>
        </div>
      ) : null}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
          Reward
        </p>
        <p className="mt-1 text-sm text-ink-100">{reward}</p>
      </div>
      <p className="text-sm font-bold text-primary-100">Official Rules</p>
      <p className="rounded-xl bg-primary-500 px-3 py-2 text-center text-sm font-black text-canvas-950">
        Join Challenge
      </p>
    </article>
  );
}

function JoinedPreview({
  title,
  current,
  target,
}: {
  title: string;
  current: number;
  target: number;
}) {
  return (
    <article className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-200">
        Simulated preview
      </p>
      <h3 className="font-display text-2xl text-white">{title}</h3>
      <p className="font-display text-3xl text-white">
        {current} / {target}
      </p>
      <p className="text-sm text-ink-300">
        {current} existing qualifying captures counted
      </p>
      <p className="rounded-xl border border-line-300 px-3 py-2 text-center text-sm font-bold text-white">
        Continue collecting
      </p>
    </article>
  );
}

function CompletedPreview({
  current,
  target,
  achievement,
  cashReward,
}: {
  current: number;
  target: number;
  achievement: string;
  cashReward: string | null;
}) {
  return (
    <article className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-200">
        Simulated preview
      </p>
      <p className="text-[10px] font-black uppercase tracking-[.14em] text-primary-200">
        Challenge Complete
      </p>
      <p className="font-display text-3xl text-white">
        {current} / {target}
      </p>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
          Achievement unlocked
        </p>
        <p className="mt-1 text-sm text-ink-100">{achievement}</p>
      </div>
      {cashReward ? (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
            Earnings added
          </p>
          <p className="mt-1 text-sm text-ink-100">
            You earned {cashReward}. Added to your AnimalDex Earnings.
          </p>
        </div>
      ) : null}
    </article>
  );
}
