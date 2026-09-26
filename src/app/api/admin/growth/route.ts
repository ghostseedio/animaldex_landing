import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  cookies,
} from "next/headers";
import {
  resolveAdminActor,
} from "@/lib/support-admin-auth";
import {
  getSupabaseHeaders,
} from "@/lib/supabase-http";
import {
  GrowthActionPlan,
  GrowthDailyMarketing,
  GrowthWeeklyTarget,
  defaultOsForNetwork,
  spendNetworks,
  spendOsOptions,
  type SpendNetwork,
  type SpendOs,
  OrganicEntry,
  SpendEntry,
  dailyPaceTarget,
  dateKeyForDay,
  daysInMonth,
  deriveOrganicTotals,
  deriveShortVideoCount,
  generatedCaptureTarget,
  generateNorthStarTrajectory,
  growthTimezone,
  monthDateKeys,
  monthKey,
  monthStart,
  manualReportingThroughDay,
  needsAttention,
  normalizeActionPlans,
  normalizeNorthStar,
  normalizeOrganicEntries,
  normalizeTargets,
  normalizeWeeklyTargets,
  requiredPerDay,
  splitMonthlyTargetsByCalendarWeeks,
  todayKey,
  type GrowthTargets,
  type NorthStarGoal,
} from "@/lib/growth-command-center";
import {
  type PlanRow,
  type SocialPageRow,
  type SocialIdeaRow,
  type NorthStarRow,
  config,
  fetchRows,
  writeRows,
  patchRows,
  isMissingColumnError,
  isMissingTableError,
  countRows,
} from "./_lib/rows";
import {
  loadSocialPages,
  loadSocialIdeaHistory,
  loadNorthStar,
  loadSnapshotRows,
  writeMarketingRow,
  writeSpendRows,
  deleteSpendRows,
  writeOrganicRows,
  deleteOrganicRows,
  normalizeCurrency,
  normalizeSpendBudget,
} from "./_lib/queries";
import {
  generateSocialIdeas,
  type SocialIdeaProjectionBackfillInput,
  backfillSocialIdeaProjections,
} from "./_lib/social-ideas";
import {
  sumRange,
  sumRangeThrough,
  sumSpendRangeByCurrency,
  comparableMonthlySpend,
  toLoadedPlan,
  loadPlan,
  loadMonthActuals,
  buildGrowthInsights,
} from "./_lib/plan";

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(cookies());
  if (!actor.authorized)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  try {
    const requestedMonth = request.nextUrl.searchParams.get("month");
    const selectedMonth =
      requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth)
        ? requestedMonth
        : monthKey(new Date());
    const [storedPlan, northStar, totalUsers, socialPages, socialIdeaHistory] = await Promise.all([
      loadPlan(selectedMonth),
      loadNorthStar(),
      countRows("profiles", "select=id"),
      loadSocialPages(),
      loadSocialIdeaHistory(),
    ]);
    const previousPlans = await fetchRows<PlanRow>(
      "growth_monthly_plans",
      `select=month,targets,weekly_targets,weekly_action_plans,created_at,updated_at&month=lt.${monthStart(selectedMonth)}&order=month.desc&limit=1`,
    );
    const previousPlan = previousPlans[0]
      ? toLoadedPlan(previousPlans[0])
      : null;

    const totalDays = daysInMonth(selectedMonth);
    const dates = monthDateKeys(selectedMonth);
    const nowKey = todayKey();
    const currentDay =
      selectedMonth === nowKey.slice(0, 7)
        ? Number(nowKey.slice(8, 10))
        : selectedMonth < nowKey.slice(0, 7)
          ? totalDays
          : 0;
    const manualThroughDay = manualReportingThroughDay(selectedMonth, nowKey);
    const actualMonth = await loadMonthActuals(
      selectedMonth,
      currentDay || totalDays,
      manualThroughDay,
      storedPlan?.adSpendCurrency ?? "IDR",
    );
    const previousActuals = previousPlan
      ? await loadMonthActuals(
          previousPlan.month,
          undefined,
          undefined,
          previousPlan.adSpendCurrency ?? "IDR",
        )
      : null;
    const trajectory = northStar
      ? generateNorthStarTrajectory({
          goal: northStar,
          today: nowKey,
          currentUsers: totalUsers,
          currentMonthActual:
            nowKey.slice(0, 7) === selectedMonth
              ? actualMonth.actuals.users
              : 0,
        })
      : null;
    const liveGenerated =
      trajectory?.months.find((row) => row.month === selectedMonth)
        ?.generatedTarget ?? null;
    const generatedTarget = storedPlan?.generatedUsers ?? liveGenerated;
    const plan =
      generatedTarget || storedPlan
        ? await loadPlan(selectedMonth, generatedTarget)
        : null;
    const snapshots = await loadSnapshotRows(dates[0], dates[dates.length - 1]);
    const primarySnapshots = snapshots.filter(
      (row) => (row.aggregation_role ?? "primary") === "primary",
    );
    const growthInsights = await buildGrowthInsights({
      selectedMonth,
      dates,
      actualMonth,
    });
    const weeklyTargets = plan
      ? plan.weeklyTargets.length
        ? plan.weeklyTargets
        : splitMonthlyTargetsByCalendarWeeks(selectedMonth, plan.targets)
      : [];
    const comparableAdSpend = plan
      ? comparableMonthlySpend(
          actualMonth.spendByCurrency,
          plan.adSpendCurrency,
        )
      : null;
    const attentionItems = plan
      ? [
          {
            label: "New users",
            actual: actualMonth.actuals.users,
            expected: plan.targets.users
              ? Math.round(
                  (plan.targets.users * (currentDay || totalDays)) / totalDays,
                )
              : 0,
            priority: 100,
          },
          {
            label: "D7 retention",
            actual: actualMonth.actuals.d7Retention,
            expected: plan.targets.d7Retention,
            priority: 90,
          },
          {
            label: "Google clicks",
            actual: actualMonth.actuals.searchClicks,
            expected: plan.targets.searchClicks
              ? Math.round(
                  (plan.targets.searchClicks * manualThroughDay) / totalDays,
                )
              : 0,
            priority: 80,
          },
          ...(comparableAdSpend == null
            ? []
            : [
                {
                  label: "Ad spend",
                  actual: comparableAdSpend,
                  expected: plan.targets.adSpend
                    ? Math.round(
                        (plan.targets.adSpend * manualThroughDay) / totalDays,
                      )
                    : 0,
                  lowerIsBudget: true,
                  priority: 70,
                },
              ]),
        ]
      : [];
    const attention = plan ? needsAttention(attentionItems) : [];
    const yesterdayDate =
      manualThroughDay > 0
        ? dateKeyForDay(selectedMonth, manualThroughDay)
        : null;
    const hasYesterdayMarketingEntry = Boolean(
      yesterdayDate && actualMonth.manualByDate[yesterdayDate],
    );
    if (plan && yesterdayDate && !hasYesterdayMarketingEntry)
      attention.unshift(
        `Yesterday's marketing numbers haven't been entered yet.`,
      );

    return NextResponse.json({
      ok: true,
      month: selectedMonth,
      timezone: growthTimezone,
      today: nowKey,
      currentDay,
      manualReportingThroughDay: manualThroughDay,
      manualReportingThroughDate: yesterdayDate,
      hasYesterdayMarketingEntry,
      totalDays,
      totalUsers,
      northStar,
      trajectory,
      plan,
      previousPlan,
      usersTargetSource: plan?.usersTargetSource ?? "none",
      plannedPace: plan ? dailyPaceTarget(plan.targets.users, totalDays) : 0,
      requiredPace: plan
        ? requiredPerDay(
            actualMonth.actuals.users,
            plan.targets.users,
            currentDay || 1,
            totalDays,
          )
        : 0,
      payingProDefinition:
        "Current profiles where is_pro=true. This is not yet verified as active production-paying Pro subscribers.",
      actuals: actualMonth.actuals,
      adSpendByCurrency: actualMonth.spendByCurrency,
      manualDailyEntryCount: actualMonth.manualDailyEntryCount,
      marketingSnapshotAggregationRule:
        "Only aggregation_role=primary historical snapshots are eligible for any snapshot rollup. aggregation_role=supporting records are evidence-only and excluded from totals. Snapshot spend is not summed across currencies.",
      marketingSnapshots: snapshots.map((row) => ({
        source: row.source,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        metric: row.metric,
        value: Number(row.value),
        currency: row.currency,
        aggregationRole: row.aggregation_role ?? "primary",
        metadata: row.metadata,
        capturedAt: row.captured_at,
        notes: row.notes,
      })),
      primaryMarketingSnapshots: primarySnapshots.map((row) => ({
        source: row.source,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        metric: row.metric,
        value: Number(row.value),
        currency: row.currency,
        aggregationRole: "primary",
        metadata: row.metadata,
        capturedAt: row.captured_at,
        notes: row.notes,
      })),
      ...growthInsights,
      collectorAnalytics: actualMonth.collectorAnalytics,
      socialPages,
      socialIdeaHistory,
      funnel: {
        ...actualMonth.funnel,
        definitions: {
          activation: actualMonth.collectorAnalytics.definitions.activation,
          d1: actualMonth.collectorAnalytics.definitions.d1,
          d7: actualMonth.collectorAnalytics.definitions.d7,
          firstTimePurchasers:
            "Transaction-period metric: unique users whose first recorded Production App Store purchase occurred in the selected month.",
          payerConversion:
            "Cohort metric: selected-month profiles whose first recorded Production App Store purchase occurred by the observation cutoff.",
          payingPro:
            "Not yet reliable. Current Active Pro is profiles.is_pro=true and can include grants or stale state.",
        },
        needsAttention: attention,
      },
      monthResult:
        plan && currentDay >= totalDays
          ? {
              month: selectedMonth,
              targets: plan.targets,
              actuals: actualMonth.actuals,
            }
          : null,
      previousMonthResult:
        previousPlan && previousActuals
          ? {
              month: previousPlan.month,
              targets: previousPlan.targets,
              actuals: previousActuals.actuals,
            }
          : null,
      daily: dates.map((date, index) => ({
        date,
        day: index + 1,
        users: actualMonth.userDaily[date] ?? 0,
        captures: actualMonth.captureDaily[date] ?? 0,
        hasMarketingEntry: Boolean(actualMonth.manualByDate[date]),
        spendEntries: actualMonth.spendByDate[date] ?? [],
        organicEntries: actualMonth.organicByDate[date] ?? [],
        marketing: actualMonth.manualByDate[date] ?? {
          date,
          socialViews: 0,
          searchClicks: 0,
          adSpend: 0,
          paidUsers: 0,
          shortVideos: 0,
          seoPages: 0,
          notes: "",
        },
      })),
      weeklyActuals: weeklyTargets.map((week) => ({
        label: week.label,
        startDay: week.startDay,
        endDay: week.endDay,
        adSpendByCurrency: sumSpendRangeByCurrency(
          actualMonth.spendByDate,
          selectedMonth,
          week.startDay,
          week.endDay,
          manualThroughDay,
        ),
        actuals: {
          users: sumRange(
            actualMonth.userDaily,
            selectedMonth,
            week.startDay,
            week.endDay,
          ),
          captures: sumRange(
            actualMonth.captureDaily,
            selectedMonth,
            week.startDay,
            week.endDay,
          ),
          socialViews: sumRangeThrough(
            actualMonth.socialDaily,
            selectedMonth,
            week.startDay,
            week.endDay,
            manualThroughDay,
          ),
          searchClicks: sumRangeThrough(
            actualMonth.searchDaily,
            selectedMonth,
            week.startDay,
            week.endDay,
            manualThroughDay,
          ),
          activePro: actualMonth.actuals.activePro,
          adSpend: sumRangeThrough(
            actualMonth.adSpendDaily,
            selectedMonth,
            week.startDay,
            week.endDay,
            manualThroughDay,
          ),
          paidUsers: sumRangeThrough(
            actualMonth.paidDaily,
            selectedMonth,
            week.startDay,
            week.endDay,
            manualThroughDay,
          ),
          activationRate: actualMonth.actuals.activationRate,
          d7Retention: actualMonth.actuals.d7Retention,
          shortVideos: sumRangeThrough(
            actualMonth.shortVideoDaily,
            selectedMonth,
            week.startDay,
            week.endDay,
            manualThroughDay,
          ),
          seoPages: sumRangeThrough(
            actualMonth.seoDaily,
            selectedMonth,
            week.startDay,
            week.endDay,
            manualThroughDay,
          ),
        },
      })),
    });
  } catch (error) {
    console.error("[admin-growth]", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unable to load growth plan",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(cookies());
  if (!actor.authorized)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );

  try {
    const body = (await request.json()) as {
      action?: string;
      month?: string;
      targets?: Partial<GrowthTargets> & {
        adSpendCurrency?: string;
        adSpendOverride?: boolean;
        usersOverride?: boolean;
        generatedUsers?: number;
      };
      weeklyTargets?: GrowthWeeklyTarget[];
      weeklyActionPlans?: GrowthActionPlan[];
      date?: string;
      marketing?: Partial<GrowthDailyMarketing> & {
        spendEntries?: SpendEntry[];
        organicEntries?: OrganicEntry[];
      };
      northStar?: Partial<NorthStarGoal>;
      pageName?: string;
      title?: string;
      ideaId?: string;
      actualViews24h?: number;
      pages?: Array<{
        platform?: string;
        pageName?: string;
        description?: string;
        postsPerDay?: number;
        active?: boolean;
        notes?: string;
      }>;
      customIdea?: {
        pageName?: string;
        platform?: string;
        title?: string;
        hook?: string;
        lengthSeconds?: number;
        tips?: string;
        projectedViews24h?: number;
        actualViews24h?: number | null;
        ideaDate?: string;
        status?: string;
      };
      totalIdeas?: number;
    };
    if (body.action === "save-north-star") {
      const goal = normalizeNorthStar(body.northStar);
      if (!goal) throw new Error("Set a total-user goal and a target date");
      await writeRows<NorthStarRow>(
        "growth_north_star",
        {
          id: "default",
          target_users: goal.targetUsers,
          target_date: goal.targetDate,
          growth_model: goal.growthModel,
          ramp_percent: goal.rampPercent,
          updated_at: new Date().toISOString(),
          updated_by: actor.email ?? actor.kind,
        },
        "on_conflict=id",
      );
      const nowKey = todayKey();
      const currentMonth = nowKey.slice(0, 7);
      const currentActuals = await loadMonthActuals(
        currentMonth,
        Number(nowKey.slice(8, 10)),
        manualReportingThroughDay(currentMonth, nowKey),
      );
      const totalUsers = await countRows("profiles", "select=id");
      const trajectory = generateNorthStarTrajectory({
        goal,
        today: nowKey,
        currentUsers: totalUsers,
        currentMonthActual: currentActuals.actuals.users,
      });
      for (const allocation of trajectory.months) {
        const existing = await loadPlan(
          allocation.month,
          allocation.generatedTarget,
        );
        const rawUsersOverride =
          existing?.usersOverride && existing.storedUsers > 0;
        const resolvedUsers = rawUsersOverride
          ? existing.storedUsers
          : allocation.generatedTarget;
        const resolvedCaptures =
          (existing?.targets.captures ?? 0) > 0
            ? existing!.targets.captures
            : generatedCaptureTarget(resolvedUsers);
        await writeRows<PlanRow>(
          "growth_monthly_plans",
          {
            month: monthStart(allocation.month),
            targets: {
              ...normalizeTargets(existing?.targets),
              users: rawUsersOverride
                ? existing.storedUsers
                : allocation.generatedTarget,
              captures: resolvedCaptures,
              generatedUsers: allocation.generatedTarget,
              usersOverride: rawUsersOverride,
              adSpendOverride: existing?.adSpendOverride ?? false,
              adSpendCurrency: existing?.adSpendCurrency ?? "IDR",
            },
            weekly_targets: splitMonthlyTargetsByCalendarWeeks(
              allocation.month,
              {
                ...normalizeTargets(existing?.targets),
                users: rawUsersOverride
                  ? existing.storedUsers
                  : allocation.generatedTarget,
                captures: resolvedCaptures,
              },
            ),
            weekly_action_plans: existing?.weeklyActionPlans ?? [],
            updated_at: new Date().toISOString(),
          },
          "on_conflict=month",
        );
      }
      return NextResponse.json({ ok: true, northStar: goal, trajectory });
    }
    if (body.action === "save-plan") {
      if (!body.month || !/^\d{4}-\d{2}$/.test(body.month))
        throw new Error("Invalid month");
      const existing = await loadPlan(body.month);
      const usersOverride = body.targets?.usersOverride === true;
      const rows = await writeRows<PlanRow>(
        "growth_monthly_plans",
        {
          month: monthStart(body.month),
          targets: {
            ...normalizeTargets(body.targets),
            adSpend: normalizeSpendBudget(
              Math.max(0, Number(body.targets?.adSpend) || 0),
              normalizeCurrency(body.targets?.adSpendCurrency),
            ),
            users: usersOverride
              ? Math.max(0, Number(body.targets?.users) || 0)
              : (existing?.generatedUsers ??
                Math.max(0, Number(body.targets?.users) || 0)),
            generatedUsers: existing?.generatedUsers ?? null,
            usersOverride,
            adSpendOverride: body.targets?.adSpendOverride === true,
            adSpendCurrency: normalizeCurrency(body.targets?.adSpendCurrency),
          },
          weekly_targets: normalizeWeeklyTargets(body.weeklyTargets),
          weekly_action_plans: normalizeActionPlans(body.weeklyActionPlans),
          updated_at: new Date().toISOString(),
        },
        "on_conflict=month",
      );
      return NextResponse.json({ ok: true, plan: rows[0] });
    }
    if (body.action === "save-marketing") {
      if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date))
        throw new Error("Invalid date");
      const marketing = body.marketing ?? {};
      const spendEntries: SpendEntry[] = Array.isArray(marketing.spendEntries)
        ? marketing.spendEntries.flatMap((entry) => {
            const currencyCode = normalizeCurrency(entry.currencyCode);
            const platform = String(entry.platform) as SpendNetwork;
            const amount = Number(entry.amount ?? 0);
            const rawInstalls = entry.reportedInstalls;
            const reportedInstalls =
              rawInstalls == null || String(rawInstalls).trim() === ""
                ? null
                : Math.round(Number(rawInstalls));
            if (
              !currencyCode ||
              !spendNetworks.includes(platform) ||
              !Number.isFinite(amount) ||
              amount < 0
            )
              return [];
            if (
              reportedInstalls != null &&
              (!Number.isFinite(reportedInstalls) || reportedInstalls < 0)
            )
              return [];
            if (amount <= 0 && reportedInstalls == null) return [];
            const os = spendOsOptions.includes(entry.os as SpendOs)
              ? (entry.os as SpendOs)
              : defaultOsForNetwork(platform);
            return [{ platform, currencyCode, amount, os, reportedInstalls }];
          })
        : [];
      const organicEntries = normalizeOrganicEntries(marketing.organicEntries);
      const derivedSocial = deriveOrganicTotals(organicEntries);
      const derivedShortVideos = deriveShortVideoCount(organicEntries);
      const spendCurrencies = Array.from(
        new Set(spendEntries.map((entry) => entry.currencyCode)),
      );
      const legacyAdSpend =
        spendCurrencies.length === 1
          ? spendEntries.reduce((sum, entry) => sum + entry.amount, 0)
          : 0;
      const rows = await writeMarketingRow({
        date: body.date,
        social_views: organicEntries.length
          ? derivedSocial.views
          : Math.max(0, Math.round(Number(marketing.socialViews ?? 0))),
        search_clicks: Math.max(
          0,
          Math.round(Number(marketing.searchClicks ?? 0)),
        ),
        ad_spend: legacyAdSpend.toFixed(2),
        paid_users: Math.max(0, Math.round(Number(marketing.paidUsers ?? 0))),
        short_videos: organicEntries.length
          ? derivedShortVideos
          : Math.max(0, Math.round(Number(marketing.shortVideos ?? 0))),
        seo_pages: Math.max(0, Math.round(Number(marketing.seoPages ?? 0))),
        notes: String(marketing.notes ?? "").slice(0, 2000),
        updated_at: new Date().toISOString(),
        updated_by: actor.email ?? actor.kind,
      });
      await deleteSpendRows(body.date);
      await writeSpendRows(body.date, spendEntries);
      await deleteOrganicRows(body.date);
      await writeOrganicRows(body.date, organicEntries);
      return NextResponse.json({
        ok: true,
        marketing: rows[0],
        organicEntries,
      });
    }
    if (body.action === "save-social-pages") {
      const pages = Array.isArray(body.pages) ? body.pages : [];
      const rows = pages.flatMap((page) => {
        const platform = String(page.platform ?? "").trim();
        const pageName = String(page.pageName ?? "").trim();
        if (!platform || !pageName) return [];
        return [
          {
            platform,
            page_name: pageName,
            description: String(page.description ?? "").trim(),
            active: page.active !== false,
            notes: String(page.notes ?? "").trim(),
            updated_at: new Date().toISOString(),
          },
        ];
      });
      if (!rows.length) throw new Error("At least one social page is required");
      try {
        const saved = await writeRows<SocialPageRow>(
          "growth_social_pages",
          rows,
          "on_conflict=platform,page_name",
        );
        return NextResponse.json({ ok: true, pages: saved });
      } catch (error) {
        if (isMissingTableError(error, "growth_social_pages")) {
          throw new Error(
            "growth_social_pages is missing. Apply the growth social idea planner migration, then retry.",
          );
        }
        throw error;
      }
    }
    if (body.action === "generate-social-ideas") {
      const pages = await loadSocialPages();
      const activePages = pages.filter((page) => page.active);
      if (!activePages.length) throw new Error("No active social pages saved yet");
      const ideaDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : todayKey();
      const totalIdeas = Math.max(
        1,
        Math.round(
          Number(
            body.totalIdeas ??
              0,
          ) || 0,
        ),
      );
      const historyRows = await loadSocialIdeaHistory(400);
      const history = historyRows.map((row) => ({
        pageName: row.page_name,
        platform: row.platform,
        title: row.title,
        hook: row.hook,
        lengthSeconds: Number(row.length_seconds ?? 0),
        tips: row.tips,
        status: row.status,
        projectedViews24h: Number(row.projected_views_24h ?? 0),
        actualViews24h:
          row.actual_views_24h == null
            ? null
            : Number(row.actual_views_24h),
      }));
      const generated = await generateSocialIdeas({
        pages: activePages.map((page) => ({
          id: page.id,
          platform: page.platform,
          pageName: page.page_name,
          description: page.description,
          notes: page.notes,
        })),
        history,
        dayLabel: ideaDate,
        totalIdeas,
      });
      const calibratedIdeas = generated.ideas.map((idea) => {
        const measurementCount = history.filter(
          (row) =>
            row.pageName === idea.pageName && row.actualViews24h != null,
        ).length;
        return {
          ...idea,
          projectionConfidence:
            measurementCount >= 20
              ? ("high" as const)
              : measurementCount >= 5
                ? ("medium" as const)
                : ("low" as const),
        };
      });
      const rows = calibratedIdeas.flatMap((idea) => {
        return [
          {
            idea_date: ideaDate,
            page_name: idea.pageName,
            platform: idea.platform,
            title: idea.title,
            hook: idea.hook,
            length_seconds: Math.max(
              0,
              Math.round(Number(idea.lengthSeconds ?? 0)),
            ),
            tips: `${idea.postType}: ${idea.tips}`,
            status: "suggested",
            completed_at: null,
            projected_views_24h: Math.max(
              0,
              Math.round(Number(idea.projectedViews24h ?? 0)),
            ),
            projection_confidence: idea.projectionConfidence,
            projection_reason: idea.projectionReason,
            actual_views_24h: null,
            measured_at: null,
          },
        ];
      });
      let savedIdeas: SocialIdeaRow[] = [];
      try {
        savedIdeas = rows.length
          ? await writeRows<SocialIdeaRow>("growth_social_idea_history", rows)
          : [];
      } catch (error) {
        if (isMissingTableError(error, "growth_social_idea_history")) {
          throw new Error(
            "growth_social_idea_history is missing. Apply the growth social idea planner migration, then retry.",
          );
        }
        if (
          [
            "projected_views_24h",
            "projection_confidence",
            "projection_reason",
            "actual_views_24h",
            "measured_at",
          ].some((column) => isMissingColumnError(error, column))
        ) {
          throw new Error(
            "Idea view-feedback columns are missing. Apply migration 20260827210000_growth_social_idea_view_feedback.sql, then retry.",
          );
        }
        if (
          isMissingColumnError(error, "status") ||
          isMissingColumnError(error, "completed_at")
        ) {
          const legacyRows = rows.map(
            ({ status: _status, completed_at: _completedAt, ...row }) => row,
          );
          savedIdeas = legacyRows.length
            ? await writeRows<SocialIdeaRow>(
                "growth_social_idea_history",
                legacyRows,
              ).then((saved) =>
                saved.map((row) => ({
                  ...row,
                  status: "suggested",
                  completed_at: null,
                })),
              )
            : [];
        } else {
          throw error;
        }
      }
      return NextResponse.json({
        ok: true,
        generated: calibratedIdeas,
        ideas: savedIdeas,
      });
    }
    if (body.action === "backfill-social-idea-projections") {
      const pages = await loadSocialPages();
      const activePages = pages.filter((page) => page.active);
      if (!activePages.length) throw new Error("No active social pages saved yet");
      const historyRows = await loadSocialIdeaHistory(1000);
      const suggestions = historyRows.filter(
        (row) =>
          row.status !== "completed" &&
          Number(row.projected_views_24h ?? 0) <= 0,
      );
      if (!suggestions.length) {
        return NextResponse.json({ ok: true, updated: 0, ideas: [] });
      }
      const projectionInput: SocialIdeaProjectionBackfillInput = {
        pages: activePages.map((page) => ({
          id: page.id,
          platform: page.platform,
          pageName: page.page_name,
          description: page.description,
          notes: page.notes,
        })),
        history: historyRows.map((row) => ({
          pageName: row.page_name,
          platform: row.platform,
          title: row.title,
          hook: row.hook,
          lengthSeconds: Number(row.length_seconds ?? 0),
          tips: row.tips,
          status: row.status,
          projectedViews24h: Number(row.projected_views_24h ?? 0),
          actualViews24h:
            row.actual_views_24h == null ? null : Number(row.actual_views_24h),
        })),
        ideas: suggestions.map((row) => ({
          id: row.id,
          pageName: row.page_name,
          platform: row.platform,
          title: row.title,
          hook: row.hook,
          lengthSeconds: Number(row.length_seconds ?? 0),
          tips: row.tips,
        })),
        dayLabel: todayKey(),
      };
      const estimated = await backfillSocialIdeaProjections(projectionInput);
      const measurementCounts = new Map<string, number>();
      for (const row of historyRows) {
        if (row.actual_views_24h == null) continue;
        const key = `${row.page_name}::${row.platform}`;
        measurementCounts.set(key, (measurementCounts.get(key) ?? 0) + 1);
      }
      const estimatedById = new Map(
        estimated.ideas.map((idea) => [idea.id, idea]),
      );
      const rows = suggestions.map((row) => {
        const projection = estimatedById.get(row.id);
        const countKey = `${row.page_name}::${row.platform}`;
        const measurementCount = measurementCounts.get(countKey) ?? 0;
        return {
          ...row,
          projected_views_24h: Math.max(
            1,
            Math.round(Number(projection?.projectedViews24h ?? row.projected_views_24h ?? 0)),
          ),
          projection_confidence:
            measurementCount >= 20
              ? ("high" as const)
              : measurementCount >= 5
                ? ("medium" as const)
                : ("low" as const),
          projection_reason:
            projection?.projectionReason ?? row.projection_reason ?? "",
        };
      });
      const saved = await writeRows<SocialIdeaRow>(
        "growth_social_idea_history",
        rows,
        "on_conflict=id",
      );
      return NextResponse.json({ ok: true, updated: saved.length, ideas: saved });
    }
    if (body.action === "mark-social-idea-complete") {
      const title = String(body.title ?? "").trim();
      const ideaDate = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : null;
      const pageName = String(body.pageName ?? "").trim();
      if (!title || !pageName) throw new Error("Page name and title are required");
      const { url, key } = config();
      const params = new URLSearchParams({
        select: "id,idea_date,page_name,platform,title,hook,length_seconds,tips,status,completed_at,created_at",
        page_name: `eq.${pageName}`,
        title: `eq.${title}`,
        limit: "1",
      });
      if (ideaDate) params.set("idea_date", `eq.${ideaDate}`);
      const existing = await fetch(`${url}/rest/v1/growth_social_idea_history?${params}`, {
        headers: getSupabaseHeaders(key, { Accept: "application/json" }),
        cache: "no-store",
      });
      if (!existing.ok) {
        const text = await existing.text();
        if (
          text.includes("PGRST204") &&
          (text.includes("status") || text.includes("completed_at"))
        ) {
          throw new Error(
            "Idea completion columns are missing. Apply migration 20260827200000_growth_social_idea_completion_columns.sql, then retry.",
          );
        }
        throw new Error(`growth_social_idea_history lookup failed (${existing.status}): ${text}`);
      }
      const rows = (await existing.json()) as SocialIdeaRow[];
      if (!rows.length) throw new Error("Idea not found");
      const updated = await writeRows<SocialIdeaRow>(
        "growth_social_idea_history",
        {
          ...rows[0],
          status: "completed",
          completed_at: new Date().toISOString(),
        },
        "on_conflict=id",
      );
      return NextResponse.json({ ok: true, idea: updated[0] });
    }
    if (body.action === "save-custom-social-idea") {
      const custom = body.customIdea ?? {};
      const pageName = String(custom.pageName ?? "").trim();
      const platform = String(custom.platform ?? "").trim();
      const title = String(custom.title ?? "").trim();
      const hook = String(custom.hook ?? "").trim();
      const ideaDate =
        custom.ideaDate && /^\d{4}-\d{2}-\d{2}$/.test(custom.ideaDate)
          ? custom.ideaDate
          : todayKey();
      const lengthSeconds = Math.max(
        0,
        Math.round(Number(custom.lengthSeconds ?? 0)),
      );
      const projectedViews24h = Math.max(
        0,
        Math.round(Number(custom.projectedViews24h ?? 0)),
      );
      const actualViews24h =
        custom.actualViews24h == null ||
        String(custom.actualViews24h).trim() === ""
          ? null
          : Math.max(0, Math.round(Number(custom.actualViews24h)));
      const status =
        custom.status === "completed" || actualViews24h != null
          ? "completed"
          : "suggested";
      if (!pageName || !platform || !title) {
        throw new Error("Page name, platform, and title are required");
      }
      const created = await writeRows<SocialIdeaRow>(
        "growth_social_idea_history",
        {
          idea_date: ideaDate,
          page_name: pageName,
          platform,
          title,
          hook,
          length_seconds: lengthSeconds,
          tips: String(custom.tips ?? "").trim(),
          status,
          completed_at: status === "completed" ? new Date().toISOString() : null,
          projected_views_24h: projectedViews24h,
          projection_confidence:
            projectedViews24h > 0
              ? "low"
              : "low",
          projection_reason: "Manually entered post",
          actual_views_24h: actualViews24h,
          measured_at: actualViews24h != null ? new Date().toISOString() : null,
        },
      );
      return NextResponse.json({ ok: true, idea: created[0] });
    }
    if (body.action === "record-social-idea-views") {
      const ideaId = String(body.ideaId ?? "").trim();
      const actualViews = Number(body.actualViews24h);
      if (!/^[0-9a-f-]{36}$/i.test(ideaId)) throw new Error("Invalid idea id");
      if (
        body.actualViews24h == null ||
        !Number.isFinite(actualViews) ||
        actualViews < 0
      ) {
        throw new Error("Enter the post's non-negative 24-hour view count");
      }
      const updated = await patchRows<SocialIdeaRow>(
        "growth_social_idea_history",
        `id=eq.${encodeURIComponent(ideaId)}&status=eq.completed`,
        {
          actual_views_24h: Math.round(actualViews),
          measured_at: new Date().toISOString(),
        },
      );
      if (!updated.length) throw new Error("Idea not found");
      return NextResponse.json({ ok: true, idea: updated[0] });
    }
    return NextResponse.json(
      { ok: false, error: "Unknown action" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unable to save growth data",
      },
      { status: 400 },
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
