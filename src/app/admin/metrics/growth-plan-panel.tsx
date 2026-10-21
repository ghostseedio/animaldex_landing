"use client";

import { FormEvent, useState } from "react";
import { Alert, Badge, Button, Card, CardContent, CardHeader, EmptyState, Segmented, cn, fieldClass } from "@/components/admin/ui";
import {
  comparableSpendTotal,
  buildRecoveryPlan,
  dailyPaceTarget,
  daysInMonth,
  deriveShortVideoCount,
  emptyGrowthTargets,
  expectedByDay,
  expectedByWeekDay,
  formatMoney,
  manualStatusForDaily,
  organicPlatformLabels,
  organicPlatforms,
  paceNumber,
  requiredPerDay,
  statusForMetric,
  timeElapsedPercent,
  defaultOsForNetwork,
  spendNetworks,
  spendOsOptions,
  type SpendEntry,
} from "@/lib/growth-command-center";
import {
  type GrowthChartMetric,
  type GrowthDaily,
  type GrowthData,
} from "./_growth/types";
import {
  growthMeta,
  defaultJobs,
  format,
  monthLabel,
  shortDate,
  spendNetworkLabels,
  spendOsLabels,
  formatSpendEntries,
  statusLabel,
  statusClass,
  progressFillClass,
  percentOf,
  rollingRequiredPerDay,
  knownMarketing,
} from "./_growth/format";
import {
  MetricProgress,
  MarketingCell,
  GrowthVelocityChart,
  MiniChart,
} from "./_growth/charts";
import {
  PlanForm,
} from "./_growth/plan-form";
import {
  NorthStarCard,
  NorthStarForm,
} from "./_growth/north-star";
import {
  SocialPagesPanel,
} from "./_growth/social-pages";
import {
  TodayCard,
  YesterdayCard,
} from "./_growth/day-cards";

// Re-exported for the metrics dashboard, which renders this panel.
export { format, monthLabel, formatSpendByCurrency } from "./_growth/format";
export type {
  GrowthData,
  GrowthDaily,
  GrowthPlan,
  GrowthSnapshot,
} from "./_growth/types";

export function GrowthCommandCenter({
  growth,
  month,
  reload,
}: {
  growth: GrowthData | null;
  month: string;
  reload: () => Promise<void>;
}) {
  const [chartMetric, setChartMetric] = useState<GrowthChartMetric>("users");
  const [editingDate, setEditingDate] = useState<GrowthDaily | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editingNorthStar, setEditingNorthStar] = useState(false);
  const [marketingError, setMarketingError] = useState("");
  const [marketingSaving, setMarketingSaving] = useState(false);
  const plan = growth?.plan;
  const actuals = growth?.actuals ?? emptyGrowthTargets;
  const totalDays = growth?.totalDays ?? daysInMonth(month);
  const currentDay = growth?.currentDay ?? 0;
  const todayMonth =
    growth?.today?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const planState: "past" | "current" | "upcoming" =
    month < todayMonth ? "past" : month > todayMonth ? "upcoming" : "current";
  const isUpcoming = planState === "upcoming";
  const isCurrent = planState === "current";
  const todayRow = isCurrent
    ? ((growth?.daily ?? []).find((row) => row.date === growth?.today) ?? null)
    : null;
  const manualThroughDay =
    growth?.manualReportingThroughDay ??
    (isCurrent
      ? Math.max(0, currentDay - 1)
      : planState === "past"
        ? totalDays
        : 0);
  const reportingRow =
    manualThroughDay > 0
      ? ((growth?.daily ?? []).find((row) => row.day === manualThroughDay) ??
        null)
      : null;
  const userTarget = plan?.targets.users ?? 0;
  const userStatus = isUpcoming
    ? "future"
    : statusForMetric(
        actuals.users,
        expectedByDay(userTarget, currentDay || totalDays, totalDays),
      );
  const planned = growth?.plannedPace ?? dailyPaceTarget(userTarget, totalDays);
  const required = 
    growth?.requiredPace ??
    requiredPerDay(actuals.users, userTarget, currentDay || 1, totalDays);
  const currentPace = paceNumber(actuals.users, currentDay || 1);
  const elapsed = timeElapsedPercent(currentDay, totalDays);
  const socialIdeaCount = (() => {
    if (!plan) return 0;
    const ideaDay = currentDay || totalDays;
    let shortsSoFar = 0;
    for (const row of growth?.daily ?? []) {
      if (row.day >= ideaDay) break;
      shortsSoFar += row.marketing.shortVideos;
    }
    return rollingRequiredPerDay(
      plan.targets.shortVideos,
      shortsSoFar,
      ideaDay,
      totalDays,
    );
  })();
  const dailyRows = (() => {
    if (!plan) return [];
    let usersSoFar = 0;
    let capturesSoFar = 0;
    let socialSoFar = 0;
    let clicksSoFar = 0;
    let spendSoFar = 0;
    let shortsSoFar = 0;
    let seoSoFar = 0;
    return (growth?.daily ?? []).map((row) => {
      const future =
        isUpcoming || (growth?.today ? row.date > growth.today : false);
      const today = isCurrent && row.date === growth?.today;
      const known = knownMarketing(row);
      const status = statusForMetric(row.users, required, {
        future,
      });
      const dayIndex = row.day;
      const socialTarget = rollingRequiredPerDay(
        plan.targets.socialViews,
        socialSoFar,
        dayIndex,
        totalDays,
      );
      const clicksTarget = rollingRequiredPerDay(
        plan.targets.searchClicks,
        clicksSoFar,
        dayIndex,
        totalDays,
      );
      const shortsTarget = rollingRequiredPerDay(
        plan.targets.shortVideos,
        shortsSoFar,
        dayIndex,
        totalDays,
      );
      const seoTarget = rollingRequiredPerDay(
        plan.targets.seoPages,
        seoSoFar,
        dayIndex,
        totalDays,
      );
      const spendActual = comparableSpendTotal(
        row.spendEntries ?? [],
        plan.adSpendCurrency,
      );
      const spendTarget = rollingRequiredPerDay(
        plan.targets.adSpend,
        spendSoFar,
        dayIndex,
        totalDays,
      );
      usersSoFar += row.users;
      capturesSoFar += row.captures;
      socialSoFar += row.marketing.socialViews;
      clicksSoFar += row.marketing.searchClicks;
      spendSoFar += spendActual ?? 0;
      shortsSoFar += row.marketing.shortVideos;
      seoSoFar += row.marketing.seoPages;
      const manualStatus = manualStatusForDaily({
        date: row.date,
        today: growth?.today ?? row.date,
        hasEntry: known.socialViews,
        actual: row.marketing.socialViews,
        expected: socialTarget,
      });
      return (
        <tr
          key={row.date}
          className={today ? "bg-primary-500/[.08]" : "odd:bg-white/[.02]"}
        >
          <td className="px-2.5 py-1.5 font-bold text-white">
            {shortDate(month, row.day)}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : (
              <MetricProgress
                actual={row.users}
                target={today ? required : rollingRequiredPerDay(
                  plan.targets.users,
                  usersSoFar - row.users,
                  dayIndex,
                  totalDays,
                )}
              />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            {future ? "—" : (
              <MetricProgress
                actual={row.captures}
                target={rollingRequiredPerDay(
                  plan.targets.captures,
                  capturesSoFar - row.captures,
                  dayIndex,
                  totalDays,
                )}
              />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            <MarketingCell future={future} today={today} known={known.socialViews} actual={row.marketing.socialViews} target={socialTarget} />
          </td>
          <td className="px-2.5 py-1.5">
            <MarketingCell future={future} today={today} known={known.searchClicks} actual={row.marketing.searchClicks} target={clicksTarget} />
          </td>
          <td className="px-2.5 py-1.5">
            {!future && known.adSpend && spendActual == null && row.spendEntries?.length ? (
              formatSpendEntries(row.spendEntries)
            ) : (
              <MarketingCell future={future} today={today} known={known.adSpend} actual={spendActual ?? 0} target={spendTarget} money currencyCode={plan.adSpendCurrency} />
            )}
          </td>
          <td className="px-2.5 py-1.5">
            <MarketingCell future={future} today={today} known={known.shortVideos} actual={row.marketing.shortVideos} target={shortsTarget} />
          </td>
          <td className="px-2.5 py-1.5">
            <MarketingCell future={future} today={today} known={known.seoPages} actual={row.marketing.seoPages} target={seoTarget} />
          </td>
          <td className="px-2.5 py-1.5">
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${statusClass(today ? "pending" : manualStatus === "pending" || manualStatus === "missing" ? manualStatus : status)}`}
            >
              {today
                ? "AUTO TODAY"
                : statusLabel(
                    manualStatus === "pending" || manualStatus === "missing"
                      ? manualStatus
                      : status,
                  )}
            </span>
          </td>
          <td className="px-2.5 py-1.5">
            {!future ? (
              <button
                onClick={() => {
                  setMarketingError("");
                  setEditingDate(row);
                }}
                className="text-[11px] font-black text-primary-100 hover:text-primary-200"
              >
                Edit
              </button>
            ) : null}
          </td>
        </tr>
      );
    });
  })();
  const complete = percentOf(actuals.users, userTarget);
  const recovery = buildRecoveryPlan({
    actualUsers: actuals.users,
    targetUsers: userTarget,
    currentDay: currentDay || 1,
    totalDays,
    dailyUsers: (growth?.daily ?? []).map((row) => row.users),
    snapshots: (growth?.primaryMarketingSnapshots ?? []).map((row) => ({
      source: row.source,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      metric: row.metric,
      value: row.value,
      currency: row.currency,
    })),
  });
  const currentWeek = isUpcoming
    ? plan?.weeklyTargets?.[0]
    : ((plan?.weeklyTargets ?? []).find(
        (week) => currentDay >= week.startDay && currentDay <= week.endDay,
      ) ?? plan?.weeklyTargets?.[0]);
  const currentWeekReport =
    !isUpcoming && currentWeek
      ? growth?.weeklyActuals?.find((row) => row.label === currentWeek.label)
      : null;
  const currentJobs =
    (plan?.weeklyActionPlans ?? []).find(
      (week) =>
        currentWeek &&
        (week.startDay === currentWeek.startDay ||
          (week.startDay <= currentWeek.endDay &&
            week.endDay >= currentWeek.startDay)),
    );
  const currentJobItems = currentJobs?.items?.length
    ? currentJobs.items
    : plan?.weeklyActionPlans?.length
      ? []
      : defaultJobs;
  const blankSpendNetworks: SpendEntry["platform"][] = [
    "google_ads",
    "apple_search_ads",
    "tiktok_ads",
    "meta_ads",
  ];
  const spendFormRows: SpendEntry[] = editingDate
    ? [
        ...(editingDate.spendEntries ?? []),
        ...blankSpendNetworks
          .filter(
            (network) =>
              !(editingDate.spendEntries ?? []).some(
                (entry) => entry.platform === network,
              ),
          )
          .map((network) => ({
            platform: network,
            currencyCode: network === "google_ads" ? "IDR" : "GBP",
            amount: 0,
            os: defaultOsForNetwork(network),
            reportedInstalls: null,
          })),
      ]
    : [];
  // The form edits only hand-entered numbers (older payloads have no split,
  // so fall back to the merged list). Auto numbers are shown beside them.
  const manualOrganic =
    editingDate?.manualOrganicEntries ?? editingDate?.organicEntries ?? [];
  const organicFormRows = organicPlatforms.map((platform) => ({
    ...(manualOrganic.find((entry) => entry.platform === platform) ?? {
      platform,
      posts: 0,
      views: 0,
    }),
    auto: editingDate?.autoOrganicEntries?.find(
      (entry) => entry.platform === platform,
    ),
  }));

  async function saveMarketing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDate || marketingSaving) return;
    const form = new FormData(event.currentTarget);
    const spendEntries = form
      .getAll("spendAmount")
      .flatMap((rawAmount, index) => {
        const amount = Number(rawAmount || 0);
        const rawInstalls = String(form.getAll("spendInstalls")[index] ?? "").trim();
        const reportedInstalls = rawInstalls === "" ? null : Number(rawInstalls);
        if (!Number.isFinite(amount) || amount < 0) return [];
        if (
          reportedInstalls != null &&
          (!Number.isFinite(reportedInstalls) || reportedInstalls < 0)
        )
          return [];
        if (amount <= 0 && reportedInstalls == null) return [];
        return [
          {
            platform: String(form.getAll("spendPlatform")[index] || "google_ads"),
            os: String(form.getAll("spendOs")[index] || "unknown"),
            currencyCode: String(form.getAll("spendCurrency")[index] || "IDR"),
            amount,
            reportedInstalls,
          },
        ];
      });
    const organicEntries = organicPlatforms.flatMap((platform, index) => {
      const posts = Number(form.getAll("organicPosts")[index] || 0);
      const views = Number(form.getAll("organicViews")[index] || 0);
      if (
        (!Number.isFinite(posts) || posts <= 0) &&
        (!Number.isFinite(views) || views <= 0)
      )
        return [];
      return [
        { platform, posts: Math.max(0, posts), views: Math.max(0, views) },
      ];
    });
    const derivedShortVideos = deriveShortVideoCount(organicEntries);
    setMarketingError("");
    setMarketingSaving(true);
    try {
      const response = await fetch("/api/admin/growth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-marketing",
          date: editingDate.date,
          marketing: {
            socialViews: form.get("socialViews"),
            searchClicks: form.get("searchClicks"),
            paidUsers: editingDate.marketing.paidUsers,
            shortVideos: organicEntries.length
              ? derivedShortVideos
              : editingDate.marketing.shortVideos,
            seoPages: form.get("seoPages"),
            spendEntries,
            organicEntries,
            notes: form.get("notes"),
          },
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) {
        setMarketingError(body.error || "Unable to save marketing data");
        return;
      }
      await reload();
      setEditingDate(null);
    } finally {
      setMarketingSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-ink-400">
            Growth control
          </p>
          <h2 className="mt-1 font-display text-2xl text-white">
            {monthLabel(month)}
          </h2>
        </div>
        <p className="flex items-center gap-2 text-xs text-ink-500">
          Asia/Jakarta calendar
          <Badge
            tone={
              planState === "current"
                ? "good"
                : planState === "upcoming"
                  ? "warn"
                  : "neutral"
            }
          >
            {planState}
          </Badge>
        </p>
      </div>

      {editingNorthStar ? (
        <NorthStarForm
          source={growth?.northStar}
          onCancel={() => setEditingNorthStar(false)}
          onSaved={reload}
        />
      ) : (
        <NorthStarCard
          goal={growth?.northStar}
          trajectory={growth?.trajectory}
          totalUsers={growth?.totalUsers ?? 0}
          onEdit={() => setEditingNorthStar(true)}
        />
      )}

      {plan && userTarget > 0 ? (
        <div className={`border p-5 ${statusClass(userStatus)}`}>
          <p className="text-[11px] font-black uppercase tracking-[.16em]">
            {monthLabel(month).toUpperCase()} GROWTH
          </p>
          <h3 className="mt-2 font-display text-4xl leading-tight text-white tabular-nums sm:text-5xl">
            {isUpcoming
              ? format(userTarget)
              : `${format(actuals.users)} / ${format(userTarget)}`}{" "}
            new users
          </h3>
          {!isUpcoming ? (
            <div className="mt-4 h-2 overflow-hidden bg-white/[.08]">
              <div
                className={`h-full ${progressFillClass(userStatus)}`}
                style={{ width: `${Math.min(100, complete ?? 0)}%` }}
              />
            </div>
          ) : null}
          {isUpcoming ? (
            <div className="mt-4 grid gap-2 text-sm tabular-nums sm:grid-cols-2">
              <p>Target {format(userTarget)}</p>
              <p>Planned pace {planned}/day</p>
              <p>Actual users —</p>
              <p>Retention —</p>
            </div>
          ) : planState === "past" ? (
            <div className="mt-4 grid gap-2 text-sm tabular-nums sm:grid-cols-2">
              <p>
                Final result {format(actuals.users)} / {format(userTarget)}
              </p>
              <p>
                {actuals.users >= userTarget
                  ? `Finished ${format(actuals.users - userTarget)} ahead of target`
                  : `Finished ${format(userTarget - actuals.users)} behind target`}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 text-sm tabular-nums sm:grid-cols-2 lg:grid-cols-4">
              <p>
                {format(Math.max(0, userTarget - actuals.users))} users
                remaining
              </p>
              <p>
                {format(Math.max(0, totalDays - currentDay))} days remaining
              </p>
              <p>Current pace {currentPace}/day</p>
              <p>Required from today {required}/day</p>
            </div>
          )}
          <p className="mt-3 text-[11px] font-black uppercase tracking-[.12em]">
            {isUpcoming ? "UPCOMING" : statusLabel(userStatus)}
          </p>
          <p className="mt-2 text-xs text-ink-200 tabular-nums">
            {complete ?? 0}% complete · {elapsed}% time elapsed · original
            planned pace {planned}/day
          </p>
          <p className="mt-2 text-xs text-ink-400">
            {plan.usersTargetSource === "generated"
              ? "Generated from long-term growth plan"
              : plan.usersTargetSource === "override"
                ? "Manual monthly override"
                : "No user target"}{" "}
            ·{" "}
            <button
              className="font-black text-primary-100 underline-offset-2 hover:underline"
              onClick={() => setEditingPlan(true)}
            >
              Adjust
            </button>
          </p>
        </div>
      ) : (
        <div className="border border-line-300 bg-surface-900 p-5">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">
            Current month
          </p>
          <h3 className="mt-2 font-display text-4xl text-white tabular-nums">
            {format(actuals.users)} new users
          </h3>
          <p className="mt-2 text-sm text-ink-400">
            Automatic AnimalDex actuals. Set a North Star so this month gets a
            generated user target instead of asking you to invent one.
          </p>
        </div>
      )}

      {isCurrent && plan && userTarget > 0 && userStatus !== "on_target" ? (
        <section className="border border-red-400/30 bg-red-500/[.06] p-5">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-red-200">
            Get back on track
          </p>
          <h3 className="mt-2 font-display text-2xl text-white tabular-nums sm:text-3xl">
            You need {format(recovery.remainingUsers)} users in{" "}
            {format(recovery.remainingDays)} days ·{" "}
            {format(recovery.requiredPerDay)}/day
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="border border-line-300 bg-canvas-900 p-3">
              <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
                Recent pace
              </p>
              <p className="mt-1 font-display text-2xl text-white tabular-nums">
                {recovery.recentAveragePerDay}/day
              </p>
              <p className="text-xs text-ink-500">last 7 available days</p>
            </div>
            <div className="border border-line-300 bg-canvas-900 p-3">
              <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
                Expected finish
              </p>
              <p className="mt-1 font-display text-2xl text-white tabular-nums">
                {format(recovery.projectedMonthEnd)} / {format(userTarget)}
              </p>
              <p className="text-xs text-ink-500">if recent pace repeats</p>
            </div>
            <div className="border border-line-300 bg-canvas-900 p-3">
              <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
                Best observed finish
              </p>
              <p className="mt-1 font-display text-2xl text-white tabular-nums">
                {format(recovery.bestObservedProjectedMonthEnd)} /{" "}
                {format(userTarget)}
              </p>
              <p
                className={`text-xs ${recovery.targetLikely ? "text-primary-100" : "text-red-200"}`}
              >
                {recovery.targetLikely
                  ? "Target remains feasible at observed performance"
                  : "Target unlikely at recorded performance"}
              </p>
            </div>
          </div>
          {recovery.evidence.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {recovery.evidence.map((item) => (
                <div
                  key={`${item.source}-${item.currency}`}
                  className="border border-primary-400/20 bg-primary-500/[.06] p-3"
                >
                  <p className="font-black capitalize text-white">
                    {item.source.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-xs text-ink-300">
                    {format(item.registeredUsers)} attributed users ·{" "}
                    {item.confidence} confidence
                  </p>
                  {item.cpa != null ? (
                    <p className="mt-2 text-sm font-bold text-primary-100">
                      Remaining-user budget ≈{" "}
                      {formatMoney(
                        item.cpa * recovery.remainingUsers,
                        item.currency,
                      )}
                    </p>
                  ) : null}
                  {item.usersPerThousandViews != null ? (
                    <p className="mt-2 text-sm font-bold text-primary-100">
                      Required reach ≈{" "}
                      {format(
                        Math.ceil(
                          (recovery.requiredPerDay /
                            item.usersPerThousandViews) *
                            1000,
                        ),
                      )}{" "}
                      views/day
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {recovery.blockers.length ? (
            <p className="mt-4 text-xs text-ink-400">
              Budget and reach estimates need attributed users. Paid vs
              organic by platform is on the Channels tab.
            </p>
          ) : null}
        </section>
      ) : null}

      {isCurrent && plan ? (
        <div className="grid gap-3 xl:grid-cols-2">
          <TodayCard
            row={todayRow}
            targets={plan.targets}
            requiredUsers={required}
            requiredCaptures={requiredPerDay(
              actuals.captures,
              plan.targets.captures,
              currentDay || 1,
              totalDays,
            )}
            totalDays={totalDays}
            onEdit={(row) => {
              setMarketingError("");
              setEditingDate(row);
            }}
          />
          <YesterdayCard
            row={reportingRow}
            targets={plan.targets}
            totalDays={totalDays}
            adSpendCurrency={plan.adSpendCurrency}
            requiredUsers={planned}
            requiredCaptures={dailyPaceTarget(plan.targets.captures, totalDays)}
            onEdit={(row) => {
              setMarketingError("");
              setEditingDate(row);
            }}
          />
        </div>
      ) : null}

      {!isUpcoming ? (
        <GrowthVelocityChart
          rows={(growth?.daily ?? []).filter(
            (row) => !growth?.today || row.date <= growth.today,
          )}
        />
      ) : null}

      {plan ? (
        <>
          <div className="grid gap-3 xl:grid-cols-[.9fr_1fr_.8fr]">
            <div className="border border-line-300 bg-surface-900 p-4">
              <h3 className="font-display text-lg text-white">This week</h3>
              {currentWeek ? (
                <>
                  <p className="mt-1 text-sm text-ink-400">
                    {shortDate(month, currentWeek.startDay)}–
                    {shortDate(month, currentWeek.endDay)}
                  </p>
                  <p className="mt-3 font-display text-2xl text-white tabular-nums">
                    {format(currentWeekReport?.actuals.users ?? 0)} /{" "}
                    {format(currentWeek.targets.users)} users
                  </p>
                  <p className="mt-1 text-xs text-ink-400 tabular-nums">
                    Need{" "}
                    {format(
                      requiredPerDay(
                        currentWeekReport?.actuals.users ?? 0,
                        currentWeek.targets.users,
                        Math.max(
                          1,
                          Math.min(currentDay, currentWeek.endDay) -
                            currentWeek.startDay +
                            1,
                        ),
                        currentWeek.endDay - currentWeek.startDay + 1,
                      ),
                    )}
                    /day · expected{" "}
                    {format(
                      expectedByWeekDay(
                        currentWeek.targets.users,
                        Math.max(
                          0,
                          Math.min(currentDay, currentWeek.endDay) -
                            currentWeek.startDay +
                            1,
                        ),
                        currentWeek.endDay - currentWeek.startDay + 1,
                      ),
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-400">
                  No weekly target yet.
                </p>
              )}
            </div>
            <div className="border border-line-300 bg-surface-900 p-4">
              <h3 className="font-display text-lg text-white">
                Organic execution
              </h3>
              <p className="mt-3 text-sm text-ink-200 tabular-nums">
                Shorts{" "}
                {isUpcoming
                  ? "—"
                  : format(currentWeekReport?.actuals.shortVideos ?? 0)}
                {currentWeek && currentWeek.targets.shortVideos > 0
                  ? ` / ${format(currentWeek.targets.shortVideos)}`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-ink-200 tabular-nums">
                SEO pages{" "}
                {isUpcoming
                  ? "—"
                  : format(currentWeekReport?.actuals.seoPages ?? 0)}
                {currentWeek && currentWeek.targets.seoPages > 0
                  ? ` / ${format(currentWeek.targets.seoPages)}`
                  : ""}
              </p>
              <p className="mt-1 text-sm text-ink-200 tabular-nums">
                Social{" "}
                {isUpcoming
                  ? "—"
                  : format(currentWeekReport?.actuals.socialViews ?? 0)}
                {currentWeek && currentWeek.targets.socialViews > 0
                  ? ` / ${format(currentWeek.targets.socialViews)}`
                  : ""}{" "}
                reported through{" "}
                {manualThroughDay > 0
                  ? shortDate(
                      month,
                      Math.min(
                        manualThroughDay,
                        currentWeek?.endDay ?? manualThroughDay,
                      ),
                    )
                  : "none"}
              </p>
            </div>
            <div className="border border-line-300 bg-surface-900 p-4">
              <h3 className="font-display text-lg text-white">
                Needs attention
              </h3>
              {growth?.funnel?.needsAttention?.length ? (
                <ul className="mt-3 space-y-2 text-sm text-ink-200">
                  {growth.funnel.needsAttention.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-ink-400">
                  No major issues in this {planState} month.
                </p>
              )}
            </div>
          </div>
          <Card>
            <CardHeader
              title="This week’s jobs"
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingPlan(true)}
                >
                  Edit
                </Button>
              }
            />
            <CardContent>
              {currentJobItems.length ? (
                <ul className="grid gap-2 text-sm text-ink-200 md:grid-cols-2">
                  {currentJobItems.map((item) => (
                    <li key={item}>☐ {item}</li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  className="py-8"
                  title="No jobs were planned for this week."
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader
              title={growthMeta[chartMetric].label}
              description="Actual vs target trajectory"
              action={
                <Segmented
                  label="Chart metric"
                  value={chartMetric}
                  onChange={setChartMetric}
                  options={(
                    [
                      "users",
                      "captures",
                      "socialViews",
                      "searchClicks",
                    ] as GrowthChartMetric[]
                  ).map((key) => ({ value: key, label: growthMeta[key].short }))}
                />
              }
            />
            <CardContent>
              <MiniChart
                rows={isUpcoming ? [] : (growth?.daily ?? [])}
                metric={chartMetric}
                target={plan.targets[chartMetric]}
              />
            </CardContent>
          </Card>
          <details className="group border border-line-300 bg-surface-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-display text-lg text-white hover:bg-white/[.02]">
              Daily details
              <span
                className="text-xs text-ink-500 transition group-open:rotate-180"
                aria-hidden="true"
              >
                ▾
              </span>
            </summary>
            <div className="max-h-[30rem] overflow-auto border-t border-line-300">
              <table className="min-w-[980px] w-full text-left text-xs tabular-nums">
                <thead className="sticky top-0 bg-canvas-900 text-[10px] font-black uppercase tracking-[.12em] text-ink-500">
                  <tr>
                    {[
                      "Date",
                      "Users",
                      "Captures",
                      "Social",
                      "Clicks",
                      "Spend",
                      "Shorts",
                      "SEO",
                      "Status",
                      "",
                    ].map((head) => (
                      <th key={head} className="border-b border-line-300 px-2.5 py-2">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>{dailyRows}</tbody>
              </table>
            </div>
          </details>
          <SocialPagesPanel
            pages={growth?.socialPages ?? []}
            history={growth?.socialIdeaHistory ?? []}
            ideaCount={socialIdeaCount}
            onSaved={reload}
          />
          <div className="flex flex-wrap gap-2">
            {todayRow ? (
              <Button
                variant="primary"
                onClick={() => {
                  setMarketingError("");
                  setEditingDate(todayRow);
                }}
              >
                Update today
              </Button>
            ) : null}
            <Button onClick={() => setEditingPlan(true)}>
              Edit month targets
            </Button>
          </div>
        </>
      ) : null}

      {editingPlan && plan ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto">
            <PlanForm
              month={month}
              source={plan}
              activeDay={(currentWeek?.startDay ?? currentDay) || 1}
              generatedUsers={
                plan.generatedUsers ??
                growth?.trajectory?.months.find((row) => row.month === month)
                  ?.generatedTarget
              }
              onSaved={reload}
              onCancel={() => setEditingPlan(false)}
            />
          </div>
        </div>
      ) : null}
      {editingDate ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4">
          <form
            onSubmit={saveMarketing}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-x-hidden overflow-y-auto overscroll-contain border border-line-300 bg-surface-900 p-5 shadow-2xl"
          >
            <h3 className="font-display text-2xl text-white">
              {editingDate.date === growth?.today
                ? "Update today"
                : `Update ${shortDate(month, editingDate.day)}`}
            </h3>
            <p className="mt-1 text-xs text-ink-500">
              Canonical manual source. AnimalDex users/captures stay automatic.
              Empty fields mean not entered, not zero.
            </p>
            <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-primary-200">
              Publishing &amp; social reach
            </p>
            <label className="mt-3 block text-sm font-bold text-ink-300">
              Total social views
              <span className="mt-1 block text-[11px] font-normal text-ink-500">
                Use this for a combined or unattributed total. If you enter
                platform views below, their sum becomes the total instead.
              </span>
              <input
                name="socialViews"
                type="number"
                min="0"
                step="1"
                defaultValue={
                  manualOrganic.length
                    ? ""
                    : (editingDate.manualSocialViews ??
                        editingDate.marketing.socialViews) || ""
                }
                placeholder="combined views"
                className={cn(fieldClass, "mt-1 font-normal")}
              />
            </label>
            <p className="mt-4 text-xs text-ink-400">
              Enter posts and views once per platform. Cross-posted videos are
              counted once toward the Shorts target using the highest platform
              post count.
            </p>
            <p className="mt-2 text-xs text-ink-400">
              <span className="font-bold text-primary-200">Auto</span> numbers
              are recorded for you: posts shared from Story videos, and views
              from the connected accounts. Enter only posts made elsewhere; they
              are added to the auto count. A views number you enter replaces
              the auto one for that platform.
            </p>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-1 text-[10px] font-black uppercase tracking-[.12em] text-ink-500">
                <span>Platform</span>
                <span>Other posts</span>
                <span>Views</span>
              </div>
              {organicFormRows.map((entry) => (
                <div
                  key={entry.platform}
                  className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] gap-2"
                >
                  <p className="self-center text-xs font-bold text-white">
                    {organicPlatformLabels[entry.platform]}
                    {entry.auto ? (
                      <span className="mt-0.5 block text-[10px] font-normal text-primary-200">
                        Auto {format(entry.auto.posts)} posts ·{" "}
                        {format(entry.auto.views)} views
                      </span>
                    ) : null}
                  </p>
                  <input
                    name="organicPosts"
                    type="number"
                    min="0"
                    placeholder="posts"
                    defaultValue={entry.posts || ""}
                    className={cn(fieldClass, "min-w-0 px-2")}
                  />
                  <input
                    name="organicViews"
                    type="number"
                    min="0"
                    placeholder="views"
                    defaultValue={entry.views || ""}
                    className={cn(fieldClass, "min-w-0 px-2")}
                  />
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-primary-200">
              Search
            </p>
            <label className="mt-3 block text-sm font-bold text-ink-300">
              Google Search clicks
              <input
                name="searchClicks"
                type="number"
                step="1"
                defaultValue={(editingDate.manualSearchClicks ?? editingDate.marketing.searchClicks) || ""}
                placeholder={editingDate.autoSearchClicks ? `Auto ${format(editingDate.autoSearchClicks)} from Search Console` : undefined}
                className={cn(fieldClass, "mt-1 font-normal")}
              />
            </label>
            <label className="mt-3 block text-sm font-bold text-ink-300">
              SEO pages published
              <input
                name="seoPages"
                type="number"
                step="1"
                defaultValue={(editingDate.manualSeoPages ?? editingDate.marketing.seoPages) || ""}
                placeholder={editingDate.autoSeoPages ? `Auto ${format(editingDate.autoSeoPages)} blog posts` : undefined}
                className={cn(fieldClass, "mt-1 font-normal")}
              />
            </label>
            <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-primary-200">
              Paid
            </p>
            <div className="mt-3">
              <p className="text-sm font-bold text-ink-300">
                Ad spend &amp; reported installs
              </p>
              <p className="mt-1 text-[11px] text-ink-500">
                One row per ad network and app. Installs are what the ad
                platform reports for the day. Leave a field empty if you don&apos;t
                have it.
              </p>
              <div className="mt-2 hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_4.5rem_minmax(0,1fr)_minmax(0,.8fr)] gap-2 px-1 text-[10px] font-black uppercase tracking-[.12em] text-ink-500 sm:grid">
                <span>Network</span>
                <span>App</span>
                <span>Cur.</span>
                <span>Spend</span>
                <span>Installs</span>
              </div>
              <div className="mt-1 space-y-2">
                {spendFormRows.map((entry, index) => (
                  <div
                    key={`${entry.platform}-${index}`}
                    className="grid grid-cols-2 gap-2 border border-line-300/60 p-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_4.5rem_minmax(0,1fr)_minmax(0,.8fr)] sm:border-0 sm:p-0"
                  >
                    <select
                      name="spendPlatform"
                      aria-label="Ad network"
                      defaultValue={entry.platform}
                      className={cn(fieldClass, "min-w-0 px-2")}
                    >
                      {spendNetworks.map((network) => (
                        <option key={network} value={network}>
                          {spendNetworkLabels[network]}
                        </option>
                      ))}
                    </select>
                    <select
                      name="spendOs"
                      aria-label="App the spend was for"
                      defaultValue={entry.os ?? defaultOsForNetwork(entry.platform)}
                      className={cn(fieldClass, "min-w-0 px-2")}
                    >
                      {spendOsOptions.map((os) => (
                        <option key={os} value={os}>
                          {spendOsLabels[os]}
                        </option>
                      ))}
                    </select>
                    <select
                      name="spendCurrency"
                      aria-label="Currency"
                      defaultValue={entry.currencyCode}
                      className={cn(fieldClass, "min-w-0 px-2")}
                    >
                      <option value="IDR">IDR</option>
                      <option value="GBP">GBP</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      name="spendAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      aria-label="Spend"
                      defaultValue={entry.amount > 0 ? entry.amount : ""}
                      placeholder="spend"
                      className={cn(fieldClass, "min-w-0 px-2")}
                    />
                    <input
                      name="spendInstalls"
                      type="number"
                      min="0"
                      step="1"
                      aria-label="Reported installs"
                      defaultValue={entry.reportedInstalls ?? ""}
                      placeholder="installs"
                      className={cn(fieldClass, "col-span-2 min-w-0 px-2 sm:col-span-1")}
                    />
                  </div>
                ))}
              </div>
            </div>
            {marketingError ? (
              <Alert tone="bad" className="mt-3">
                {marketingError}
              </Alert>
            ) : null}
            <label className="mt-4 block text-sm font-bold text-ink-300">
              Notes
              <textarea
                name="notes"
                defaultValue={editingDate.marketing.notes}
                className={cn(fieldClass, "mt-1 font-normal")}
              />
            </label>
            <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex gap-2 border-t border-line-300 bg-surface-900 px-5 py-4">
              <Button
                type="submit"
                variant="primary"
                loading={marketingSaving}
              >
                {marketingSaving
                  ? "Saving..."
                  : `Save ${shortDate(month, editingDate.day)}`}
              </Button>
              <Button type="button" onClick={() => setEditingDate(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
