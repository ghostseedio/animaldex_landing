"use client";

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
  return (
    <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">
            Today · {dateLabel(row.date)}
          </h3>
          <p className="mt-1 text-xs font-black uppercase tracking-[.14em] text-primary-200">
            Am I doing enough today?
          </p>
        </div>
        <button
          onClick={() => onEdit(row)}
          className="rounded-lg bg-primary-400 px-3 py-2 text-xs font-black text-canvas-950"
        >
          Update today
        </button>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-ink-200">
        <p>
          New users {row.users} / {format(requiredUsers)} needed
        </p>
        <p>
          Captures {row.captures} / {format(requiredCaptures)}
        </p>
        <p>
          Social views{" "}
          {row.hasMarketingEntry ? format(row.marketing.socialViews) : "—"}
          {targets.socialViews > 0
            ? ` / ${format(dailyPaceTarget(targets.socialViews, totalDays))}`
            : ""}
        </p>
        <p>
          Google clicks{" "}
          {row.hasMarketingEntry ? format(row.marketing.searchClicks) : "—"}
          {targets.searchClicks > 0
            ? ` / ${format(dailyPaceTarget(targets.searchClicks, totalDays))}`
            : ""}
        </p>
        <p>
          Shorts{" "}
          {row.hasMarketingEntry ? format(row.marketing.shortVideos) : "—"}
          {targets.shortVideos > 0
            ? ` / ${format(dailyPaceTarget(targets.shortVideos, totalDays))}`
            : ""}
        </p>
        <p>
          SEO {row.hasMarketingEntry ? format(row.marketing.seoPages) : "—"}{" "}
          this week
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
        Users and captures are AUTO. Missing marketing is shown as — , never as
        a fake zero miss.
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
  const spendText = !row.hasMarketingEntry
    ? "Not entered"
    : !adSpendCurrency
      ? `${formatSpendEntries(row.spendEntries)} · budget currency not set`
      : comparableSpend == null
        ? `${formatSpendEntries(row.spendEntries)} · mixed currency, no budget comparison`
        : `${formatMoney(comparableSpend, adSpendCurrency)} / ${formatMoney(dailySpend, adSpendCurrency)}`;
  const organic = deriveOrganicTotals(row.organicEntries ?? []);
  return (
    <div className="rounded-xl border border-line-300 bg-surface-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-white">
            Yesterday · {dateLabel(row.date)}
          </h3>
          <p className="mt-1 text-xs font-black uppercase tracking-[.14em] text-primary-200">
            Finalized daily results
          </p>
        </div>
        <button
          onClick={() => onEdit(row)}
          className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white"
        >
          Edit {shortDate(row.date.slice(0, 7), row.day)}
        </button>
      </div>
      {!row.hasMarketingEntry ? (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="font-black">
            Yesterday’s marketing data hasn’t been entered yet.
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            Users and captures are automatic. External marketing is missing, not
            zero.
          </p>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 text-sm text-ink-200">
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
            Google {format(row.marketing.searchClicks)}
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
          <p>Spend {spendText}</p>
        </div>
      )}
    </div>
  );
}

