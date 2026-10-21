"use client";

import { Button } from "@/components/admin/ui";
import {
  comparableSpendTotal,
  dailyPaceTarget,
  deriveOrganicTotals,
  formatMoney,
  type GrowthTargets,
} from "@/lib/growth-command-center";
import {
  type GrowthDaily,
} from "./types";
import {
  format,
  shortDate,
  dateLabel,
  formatSpendEntries,
  knownMarketing,
  targetValue,
} from "./format";

export function TodayCard({
  row,
  targets,
  requiredUsers,
  requiredCaptures,
  totalDays,
  onEdit,
}: {
  row: GrowthDaily | null;
  targets: GrowthTargets;
  requiredUsers: number;
  requiredCaptures: number;
  totalDays: number;
  onEdit: (row: GrowthDaily) => void;
}) {
  if (!row) return null;
  const remainingUsers = Math.max(0, requiredUsers - row.users);
  const known = knownMarketing(row);
  return (
    <div className="border border-line-300 bg-surface-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-white">
            Today · {dateLabel(row.date)}
          </h3>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[.12em] text-primary-200">
            Am I doing enough today?
          </p>
        </div>
        <Button size="sm" variant="primary" onClick={() => onEdit(row)}>
          Update today
        </Button>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-ink-200 tabular-nums">
        <p>
          New users {row.users} / {format(requiredUsers)} needed
        </p>
        <p>
          Captures {row.captures} / {format(requiredCaptures)}
        </p>
        <p>
          Social views{" "}
          {known.socialViews ? format(row.marketing.socialViews) : "—"}
          {targets.socialViews > 0
            ? ` / ${format(dailyPaceTarget(targets.socialViews, totalDays))}`
            : ""}
        </p>
        <p>
          Google clicks{" "}
          {known.searchClicks ? format(row.marketing.searchClicks) : "—"}
          {targets.searchClicks > 0
            ? ` / ${format(dailyPaceTarget(targets.searchClicks, totalDays))}`
            : ""}
        </p>
        <p>
          Shorts{" "}
          {known.shortVideos ? format(row.marketing.shortVideos) : "—"}
          {targets.shortVideos > 0
            ? ` / ${format(dailyPaceTarget(targets.shortVideos, totalDays))}`
            : ""}
        </p>
        <p>
          SEO {known.seoPages ? format(row.marketing.seoPages) : "—"} today
          {targets.seoPages > 0
            ? ` / ~${format(Math.max(1, Math.round(targets.seoPages / 4)))}`
            : ""}
        </p>
      </div>
      <p className="mt-3 text-sm font-black text-white">
        {remainingUsers > 0
          ? `${format(remainingUsers)} more users needed today to maintain trajectory`
          : "Today’s user pace is covered."}
      </p>
      <p className="mt-2 text-xs text-ink-500">
        Everything here fills in automatically. A number that isn&rsquo;t in yet
        shows as —, never as a fake zero.
      </p>
    </div>
  );
}

export function YesterdayCard({
  row,
  targets,
  totalDays,
  adSpendCurrency,
  requiredUsers,
  requiredCaptures,
  onEdit,
}: {
  row: GrowthDaily | null;
  targets: GrowthTargets;
  totalDays: number;
  adSpendCurrency?: string | null;
  requiredUsers: number;
  requiredCaptures: number;
  onEdit: (row: GrowthDaily) => void;
}) {
  if (!row) return null;
  const comparableSpend = comparableSpendTotal(
    row.spendEntries ?? [],
    adSpendCurrency,
  );
  const dailySpend = targets.adSpend / Math.max(1, totalDays);
  const known = knownMarketing(row);
  const missing = !known.socialViews || !known.searchClicks;
  const spendText = !known.adSpend
    ? "Not entered"
    : !row.spendEntries?.length
      ? `${formatMoney(0, adSpendCurrency)} / ${formatMoney(dailySpend, adSpendCurrency)}`
      : !adSpendCurrency
      ? `${formatSpendEntries(row.spendEntries)} · budget currency not set`
      : comparableSpend == null
        ? `${formatSpendEntries(row.spendEntries)} · mixed currency, no budget comparison`
        : `${formatMoney(comparableSpend, adSpendCurrency)} / ${formatMoney(dailySpend, adSpendCurrency)}`;
  const organic = deriveOrganicTotals(row.organicEntries ?? []);
  return (
    <div className="border border-line-300 bg-surface-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-white">
            Yesterday · {dateLabel(row.date)}
          </h3>
          <p className="mt-1 text-[11px] font-black uppercase tracking-[.12em] text-primary-200">
            Finalized daily results
          </p>
        </div>
        <Button size="sm" onClick={() => onEdit(row)}>
          Edit {shortDate(row.date.slice(0, 7), row.day)}
        </Button>
      </div>
      {missing && !row.hasMarketingEntry ? (
        <div className="mt-3 border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="font-black">
            Some of yesterday&rsquo;s numbers aren&rsquo;t in yet.
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            {!known.socialViews && !known.searchClicks
              ? "Social views and Google clicks are"
              : !known.socialViews
                ? "Social views are"
                : "Google clicks are"}{" "}
            missing, not zero. Search Console trails by a day or two.
          </p>
          {organic.posts > 0 || organic.views > 0 ? (
            <p className="mt-1 text-xs text-amber-100/80">
              Auto-recorded social: {format(organic.views)} views ·{" "}
              {format(organic.posts)} posts.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 text-sm text-ink-200 tabular-nums">
          <p>Users {targetValue("", row.users, requiredUsers)}</p>
          <p>Captures {targetValue("", row.captures, requiredCaptures)}</p>
          <p>
            Social{" "}
            {organic.views > 0
              ? `${format(organic.views)} views · ${format(organic.posts)} posts`
              : format(row.marketing.socialViews)}
            {targets.socialViews > 0
              ? ` / ${format(dailyPaceTarget(targets.socialViews, totalDays))}`
              : ""}
          </p>
          <p>
            Google {known.searchClicks ? format(row.marketing.searchClicks) : "—"}
            {targets.searchClicks > 0
              ? ` / ${format(dailyPaceTarget(targets.searchClicks, totalDays))}`
              : ""}
          </p>
          <p>
            Shorts {format(row.marketing.shortVideos)}
            {targets.shortVideos > 0
              ? ` / ${format(dailyPaceTarget(targets.shortVideos, totalDays))}`
              : ""}
          </p>
          <p>SEO pages {format(row.marketing.seoPages)}</p>
          <p>Spend {spendText}</p>
        </div>
      )}
    </div>
  );
}

