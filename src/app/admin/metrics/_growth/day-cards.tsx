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
  // Social numbers can be known without a hand entry: the auto log.
  const hasSocial = row.hasMarketingEntry || Boolean(row.autoOrganicEntries?.length);
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
          {hasSocial ? format(row.marketing.socialViews) : "—"}
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
          {hasSocial ? format(row.marketing.shortVideos) : "—"}
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
        Users, captures and Story videos posts are AUTO. Missing marketing is
        shown as — , never as a fake zero miss.
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
      {!row.hasMarketingEntry ? (
        <div className="mt-3 border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <p className="font-black">
            Yesterday’s marketing data hasn’t been entered yet.
          </p>
          <p className="mt-1 text-xs text-amber-100/80">
            Users and captures are automatic. External marketing is missing, not
            zero.
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

