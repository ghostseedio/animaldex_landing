import {
  GrowthDailyMarketing,
  buildCollectorAnalytics,
  defaultOsForNetwork,
  jakartaMonthBounds,
  shiftMonth,
  type CollectorCapture,
  type CollectorProfile,
  OrganicEntry,
  SpendEntry,
  dateKeyForDay,
  daysInMonth,
  deriveOrganicTotals,
  generatedOperatingTargets,
  jakartaDayBounds,
  monthDateKeys,
  monthStart,
  normalizeActionPlans,
  normalizeTargets,
  normalizeWeeklyTargets,
  resolveUsersTarget,
  rate,
  splitMonthlyTargetsByCalendarWeeks,
  todayKey,
  type GrowthTargets,
  type UsersTargetSource,
} from "@/lib/growth-command-center";
import {
  buildHistoricalChannelRows,
  buildPaidOrganicSplit,
  buildPlatformDaily,
  classifyAcquisition,
  classifyPurchaseStore,
  countBy,
  growthPlatforms,
  inferUserPlatform,
  summarizePaidLog,
  summarizePurchasesByStore,
  type AcquisitionChannel,
  type GrowthPlatform,
  type PaidLogEntry,
} from "@/lib/growth-attribution";
import {
  type PlanRow,
  type DatedRow,
  type LoadedPlan,
  fetchRows,
  countRows,
} from "./rows";
import {
  loadMarketingRows,
  loadSpendRows,
  loadOrganicRows,
  loadSnapshotRows,
  toMarketing,
  toSpendEntry,
  normalizeCurrency,
  normalizeSpendBudget,
  loadUserGrowthRows,
  loadPurchaseLedger,
} from "./queries";

export function aggregateByDay(
  rows: DatedRow[],
  dateField: "created_at" | "purchase_date",
  month: string,
) {
  const counts = Object.fromEntries(
    monthDateKeys(month).map((date) => [date, 0]),
  ) as Record<string, number>;
  for (const row of rows) {
    const value = row[dateField];
    if (!value) continue;
    const key = todayKey(new Date(value));
    if (key in counts) counts[key] += 1;
  }
  return counts;
}

export function sumThrough(
  counts: Record<string, number>,
  dateKeys: string[],
  throughDay: number,
) {
  return dateKeys
    .slice(0, throughDay)
    .reduce((sum, date) => sum + (counts[date] ?? 0), 0);
}

export function sumRange(
  counts: Record<string, number>,
  month: string,
  startDay: number,
  endDay: number,
) {
  let sum = 0;
  for (let day = startDay; day <= endDay; day += 1)
    sum += counts[dateKeyForDay(month, day)] ?? 0;
  return sum;
}

export function sumRangeThrough(
  counts: Record<string, number>,
  month: string,
  startDay: number,
  endDay: number,
  throughDay: number,
) {
  if (throughDay < startDay) return 0;
  return sumRange(counts, month, startDay, Math.min(endDay, throughDay));
}

export function sumSpendRangeByCurrency(
  spendByDate: Record<string, SpendEntry[]>,
  month: string,
  startDay: number,
  endDay: number,
  throughDay: number,
) {
  const totals: Record<string, number> = {};
  if (throughDay < startDay) return totals;
  for (let day = startDay; day <= Math.min(endDay, throughDay); day += 1) {
    for (const entry of spendByDate[dateKeyForDay(month, day)] ?? []) {
      totals[entry.currencyCode] =
        (totals[entry.currencyCode] ?? 0) + entry.amount;
    }
  }
  return totals;
}

export function comparableMonthlySpend(
  totals: Record<string, number>,
  currencyCode: string | null | undefined,
) {
  if (!currencyCode) return null;
  const currencies = Object.keys(totals).filter(
    (currency) => totals[currency] > 0,
  );
  if (!currencies.length) return 0;
  return currencies.length === 1 && currencies[0] === currencyCode
    ? totals[currencyCode]
    : null;
}

export function planMeta(targets: Record<string, unknown> | null | undefined) {
  const generatedUsers = Number(targets?.generatedUsers);
  return {
    usersOverride: targets?.usersOverride === true,
    generatedUsers:
      Number.isFinite(generatedUsers) && generatedUsers > 0
        ? generatedUsers
        : null,
  };
}

export function toLoadedPlan(
  row: PlanRow,
  resolvedUsers?: { users: number; source: UsersTargetSource },
): LoadedPlan {
  const rawTargets = (row.targets as Record<string, unknown> | null) ?? {};
  const targets = normalizeTargets(rawTargets as Partial<GrowthTargets>);
  const meta = planMeta(rawTargets);
  const users =
    resolvedUsers ??
    resolveUsersTarget({
      storedUsers: targets.users,
      usersOverride:
        rawTargets.usersOverride === true
          ? true
          : rawTargets.usersOverride === false
            ? false
            : undefined,
      generatedTarget: meta.generatedUsers,
    });
  const adSpendCurrency = normalizeCurrency(rawTargets.adSpendCurrency) ?? "IDR";
  const targetsWithBudget = {
    ...targets,
    adSpend: normalizeSpendBudget(targets.adSpend, adSpendCurrency),
  };
  return {
    month: row.month.slice(0, 7),
    targets: { ...targetsWithBudget, users: users.users },
    storedUsers: Number(rawTargets.users) || 0,
    adSpendCurrency,
    adSpendOverride: rawTargets.adSpendOverride === true,
    usersOverride: users.source === "override",
    generatedUsers: meta.generatedUsers,
    usersTargetSource: users.source,
    weeklyTargets: normalizeWeeklyTargets(row.weekly_targets),
    weeklyActionPlans: normalizeActionPlans(row.weekly_action_plans),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadPlan(
  month: string,
  generatedTarget: number | null = null,
): Promise<LoadedPlan | null> {
  const rows = await fetchRows<PlanRow>(
    "growth_monthly_plans",
    `select=month,targets,weekly_targets,weekly_action_plans,created_at,updated_at&month=eq.${monthStart(month)}&limit=1`,
  );
  const row = rows[0];
  if (!row) {
    if (!generatedTarget) return null;
    const users = resolveUsersTarget({ storedUsers: 0, generatedTarget });
    const adSpendCurrency = "IDR";
    const generated = generatedOperatingTargets(users.users, adSpendCurrency);
    const targets = {
      ...normalizeTargets(null),
      users: users.users,
      ...generated,
    };
    return {
      month,
      targets,
      storedUsers: 0,
      adSpendCurrency,
      adSpendOverride: false,
      usersOverride: false,
      generatedUsers: generatedTarget,
      usersTargetSource: users.source,
      weeklyTargets: splitMonthlyTargetsByCalendarWeeks(month, targets),
      weeklyActionPlans: [],
    };
  }
  const rawTargets = (row.targets as Record<string, unknown> | null) ?? {};
  const meta = planMeta(rawTargets);
  const users = resolveUsersTarget({
    storedUsers: Number(rawTargets.users) || 0,
    usersOverride:
      rawTargets.usersOverride === true
        ? true
        : rawTargets.usersOverride === false
          ? false
          : undefined,
    generatedTarget: generatedTarget ?? meta.generatedUsers,
  });
  const loaded = toLoadedPlan(row, users);
  const generated = generatedOperatingTargets(
    loaded.targets.users,
    loaded.adSpendCurrency,
  );
  if (loaded.targets.captures <= 0 && loaded.targets.users > 0) {
    loaded.targets.captures = generated.captures;
  }
  if (loaded.targets.socialViews <= 0 && loaded.targets.users > 0) {
    loaded.targets.socialViews = generated.socialViews;
  }
  if (loaded.targets.searchClicks <= 0 && loaded.targets.users > 0) {
    loaded.targets.searchClicks = generated.searchClicks;
  }
  const hasExplicitSpendOverride = rawTargets.adSpendOverride === true;
  if (!hasExplicitSpendOverride && loaded.targets.users > 0) {
    loaded.targets.adSpend = generated.adSpend;
  }
  if (loaded.targets.shortVideos <= 0 && loaded.targets.users > 0) {
    loaded.targets.shortVideos = generated.shortVideos;
  }
  if (loaded.targets.seoPages <= 0 && loaded.targets.users > 0) {
    loaded.targets.seoPages = generated.seoPages;
  }
  loaded.weeklyTargets = splitMonthlyTargetsByCalendarWeeks(
    month,
    loaded.targets,
  );
  return loaded;
}

export async function loadMonthActuals(
  selectedMonth: string,
  throughDay?: number,
  manualThroughDay = throughDay ?? daysInMonth(selectedMonth),
  legacySpendCurrency = "IDR",
) {
  const totalDays = daysInMonth(selectedMonth);
  const dates = monthDateKeys(selectedMonth);
  const dayLimit = throughDay ?? totalDays;
  const { startIso } = jakartaDayBounds(dates[0]);
  const { endIso } = jakartaDayBounds(dates[dates.length - 1]);
  const cutoffDate =
    dates[Math.max(0, Math.min(dayLimit, totalDays) - 1)] ??
    dates[dates.length - 1];
  const { endIso: cutoffIso } = jakartaDayBounds(cutoffDate);
  const captureReadEndIso = new Date().toISOString();
  const [
    profiles,
    captures,
    activeProActual,
    marketingRows,
    spendRows,
    organicRows,
    purchases,
  ] = await Promise.all([
    fetchRows<DatedRow>(
      "profiles",
      `select=id,created_at&created_at=gte.${encodeURIComponent(startIso)}&created_at=lte.${encodeURIComponent(endIso)}&order=created_at.asc`,
    ),
    fetchRows<DatedRow>(
      "captures",
      `select=user_id,created_at,status&status=eq.ready&created_at=gte.${encodeURIComponent(startIso)}&created_at=lte.${encodeURIComponent(captureReadEndIso)}&order=created_at.asc`,
    ),
    countRows("profiles", "select=id&is_pro=eq.true"),
    loadMarketingRows(dates[0], dates[dates.length - 1]),
    loadSpendRows(dates[0], dates[dates.length - 1]),
    loadOrganicRows(dates[0], dates[dates.length - 1]),
    fetchRows<DatedRow>(
      "app_store_purchases",
      `select=user_id,created_at,environment,product_id,product_code&environment=eq.Production&created_at=lte.${encodeURIComponent(new Date().toISOString())}&order=created_at.asc`,
    ),
  ]);
  const userDaily = aggregateByDay(profiles, "created_at", selectedMonth);
  const readyCaptures = captures.filter(
    (row) => row.status === "ready" && row.user_id && row.created_at,
  );
  const captureDaily = aggregateByDay(
    readyCaptures,
    "created_at",
    selectedMonth,
  );
  const manualByDate = Object.fromEntries(
    marketingRows.map((row) => [row.date, toMarketing(row)]),
  ) as Record<string, GrowthDailyMarketing>;
  const spendByDate = spendRows.reduce<Record<string, SpendEntry[]>>(
    (byDate, row) => {
      byDate[row.date] = [...(byDate[row.date] ?? []), toSpendEntry(row)];
      return byDate;
    },
    {},
  );
  const organicByDate = organicRows.reduce<Record<string, OrganicEntry[]>>(
    (byDate, row) => {
      const posts = Math.max(0, Math.round(Number(row.posts) || 0));
      const views = Math.max(0, Math.round(Number(row.views) || 0));
      if (posts <= 0 && views <= 0) return byDate;
      byDate[row.date] = [
        ...(byDate[row.date] ?? []),
        { platform: row.platform, posts, views },
      ];
      return byDate;
    },
    {},
  );
  if (!spendRows.length && legacySpendCurrency) {
    for (const row of marketingRows) {
      const amount = Number(row.ad_spend ?? 0);
      if (amount > 0)
        spendByDate[row.date] = [
          { platform: "google_ads", amount, currencyCode: legacySpendCurrency },
        ];
    }
  }
  for (const [date, entries] of Object.entries(organicByDate)) {
    const derived = deriveOrganicTotals(entries);
    const existing = manualByDate[date] ?? {
      date,
      socialViews: 0,
      searchClicks: 0,
      adSpend: 0,
      paidUsers: 0,
      shortVideos: 0,
      seoPages: 0,
      notes: "",
    };
    manualByDate[date] = { ...existing, socialViews: derived.views };
  }
  const spendByCurrency = spendRows.length
    ? spendRows
        .filter((row) => dates.indexOf(row.date) < manualThroughDay)
        .reduce<Record<string, number>>((totals, row) => {
          totals[row.currency_code] =
            (totals[row.currency_code] ?? 0) + Number(row.amount ?? 0);
          return totals;
        }, {})
    : legacySpendCurrency
      ? marketingRows
          .filter((row) => dates.indexOf(row.date) < manualThroughDay)
          .reduce<Record<string, number>>((totals, row) => {
            const amount = Number(row.ad_spend ?? 0);
            if (amount > 0)
              totals[legacySpendCurrency] =
                (totals[legacySpendCurrency] ?? 0) + amount;
            return totals;
          }, {})
      : {};
  const socialDaily = Object.fromEntries(
    dates.map((date) => [date, manualByDate[date]?.socialViews ?? 0]),
  );
  const searchDaily = Object.fromEntries(
    dates.map((date) => [date, manualByDate[date]?.searchClicks ?? 0]),
  );
  const adSpendDaily = Object.fromEntries(
    dates.map((date) => [
      date,
      (spendByDate[date] ?? []).reduce((sum, entry) => sum + entry.amount, 0),
    ]),
  );
  const paidDaily = Object.fromEntries(
    dates.map((date) => [date, manualByDate[date]?.paidUsers ?? 0]),
  );
  const shortVideoDaily = Object.fromEntries(
    dates.map((date) => [date, manualByDate[date]?.shortVideos ?? 0]),
  );
  const seoDaily = Object.fromEntries(
    dates.map((date) => [date, manualByDate[date]?.seoPages ?? 0]),
  );
  const collectorAnalytics = buildCollectorAnalytics({
    profiles: profiles.flatMap((profile) =>
      profile.id && profile.created_at
        ? [{ id: String(profile.id), createdAt: profile.created_at }]
        : [],
    ),
    captures: captures.flatMap((capture) =>
      capture.user_id && capture.created_at
        ? [
            {
              userId: String(capture.user_id),
              createdAt: capture.created_at,
              status: String(capture.status ?? ""),
            },
          ]
        : [],
    ),
    periodStart: startIso,
    periodEnd:
      selectedMonth === todayKey().slice(0, 7)
        ? new Date().toISOString()
        : cutoffIso,
    observationCutoff: new Date().toISOString(),
  });
  const firstPurchaseByUser = new Map<string, number>();
  for (const purchase of purchases) {
    if (!purchase.user_id || !purchase.created_at) continue;
    const userId = String(purchase.user_id);
    const time = new Date(purchase.created_at).getTime();
    if (!firstPurchaseByUser.has(userId)) firstPurchaseByUser.set(userId, time);
  }
  const monthStartTime = new Date(startIso).getTime();
  const monthEndTime = new Date(endIso).getTime();
  const firstTimePurchasers = Array.from(firstPurchaseByUser.values()).filter(
    (time) => time >= monthStartTime && time < monthEndTime,
  ).length;
  const cohortUserIds = new Set(
    profiles.flatMap((profile) => (profile.id ? [String(profile.id)] : [])),
  );
  const cohortFirstTimePurchasers = Array.from(
    firstPurchaseByUser.entries(),
  ).filter(([userId]) => cohortUserIds.has(userId)).length;
  const actuals = {
    users: sumThrough(userDaily, dates, dayLimit),
    captures: sumThrough(captureDaily, dates, dayLimit),
    socialViews: sumThrough(socialDaily, dates, manualThroughDay),
    searchClicks: sumThrough(searchDaily, dates, manualThroughDay),
    activePro: activeProActual,
    adSpend: sumThrough(adSpendDaily, dates, manualThroughDay),
    paidUsers: sumThrough(paidDaily, dates, manualThroughDay),
    activationRate: collectorAnalytics.activation.rate ?? 0,
    d7Retention: collectorAnalytics.d7.rate ?? 0,
    shortVideos: sumThrough(shortVideoDaily, dates, manualThroughDay),
    seoPages: sumThrough(seoDaily, dates, manualThroughDay),
  };
  return {
    dates,
    userDaily,
    captureDaily,
    manualByDate,
    spendByDate,
    organicByDate,
    spendByCurrency,
    manualDailyEntryCount: marketingRows.length,
    socialDaily,
    searchDaily,
    adSpendDaily,
    paidDaily,
    shortVideoDaily,
    seoDaily,
    actuals,
    profileRows: profiles,
    captureRows: captures,
    collectorPeriod: {
      start: startIso,
      end:
        selectedMonth === todayKey().slice(0, 7)
          ? new Date().toISOString()
          : cutoffIso,
    },
    collectorAnalytics,
    funnel: {
      activatedUsers: collectorAnalytics.activation.users,
      activationEligibleUsers: collectorAnalytics.activation.eligible,
      activationRate: collectorAnalytics.activation.rate,
      d1RetainedUsers: collectorAnalytics.d1.users,
      d1EligibleUsers: collectorAnalytics.d1.eligible,
      d1RetentionRate: collectorAnalytics.d1.rate,
      d7RetainedUsers: collectorAnalytics.d7.users,
      d7EligibleUsers: collectorAnalytics.d7.eligible,
      d7RetentionRate: collectorAnalytics.d7.rate,
      firstTimePurchasers,
      cohortFirstTimePurchasers,
      payerConversionRate: rate(cohortFirstTimePurchasers, actuals.users),
    },
  };
}

export type MonthActuals = Awaited<ReturnType<typeof loadMonthActuals>>;

export async function buildGrowthInsights({
  selectedMonth,
  dates,
  actualMonth,
}: {
  selectedMonth: string;
  dates: string[];
  actualMonth: MonthActuals;
}) {
  const monthBounds = jakartaMonthBounds(selectedMonth);
  const previousBounds = jakartaMonthBounds(shiftMonth(selectedMonth, -1));
  const startMs = Date.parse(monthBounds.startIso);
  const endMs = Date.parse(monthBounds.endExclusiveIso);
  const [userRows, ledger, allSnapshots, previousMonthUsers] = await Promise.all([
    loadUserGrowthRows(),
    loadPurchaseLedger(),
    loadSnapshotRows(null, null),
    countRows(
      "profiles",
      `select=id&created_at=gte.${encodeURIComponent(previousBounds.startIso)}&created_at=lt.${encodeURIComponent(previousBounds.endExclusiveIso)}`,
    ).catch(() => null),
  ]);

  const paidEntries: PaidLogEntry[] = Object.entries(actualMonth.spendByDate).flatMap(
    ([date, entries]) =>
      entries.map((entry) => ({
        date,
        network: entry.platform,
        os: entry.os ?? defaultOsForNetwork(entry.platform),
        currencyCode: entry.currencyCode,
        amount: entry.amount,
        reportedInstalls: entry.reportedInstalls ?? null,
      })),
  );
  const paidLog = summarizePaidLog(paidEntries);
  const revenue = {
    month: summarizePurchasesByStore(ledger, startMs, endMs),
    allTime: summarizePurchasesByStore(ledger, 0, Number.MAX_SAFE_INTEGER),
    note: "Counts come from the purchase ledger. Revenue is estimated at list price ($2.99 / $7.99 / $9.99/month); store fees, tax, refunds and local prices are not recorded.",
  };
  const historicalChannels = buildHistoricalChannelRows(
    allSnapshots
      .filter((row) => (row.aggregation_role ?? "primary") === "primary")
      .map((row) => ({
        source: row.source,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        metric: row.metric,
        value: Number(row.value),
        currency: row.currency,
        os: row.os ?? null,
      })),
  );

  if (!userRows) {
    return {
      attribution: { available: false as const },
      paid: { log: paidLog, split: [] },
      historicalChannels,
      revenue,
      previousMonthUsers,
    };
  }

  const payerIds = new Set(
    ledger.filter((row) => classifyPurchaseStore(row) !== "test").map((row) => row.userId),
  );
  const inferred = userRows.map((row) => ({
    row,
    ...inferUserPlatform(row),
    channel: classifyAcquisition(row),
  }));
  const monthUsers = inferred.filter((item) => {
    const time = Date.parse(item.row.created_at);
    return time >= startMs && time < endMs;
  });
  const signupsByPlatform: Record<GrowthPlatform, number> = { ios: 0, android: 0, web: 0, unknown: 0 };
  for (const item of monthUsers) signupsByPlatform[item.platform] += 1;

  const collectorProfiles: CollectorProfile[] = actualMonth.profileRows.flatMap((profile) =>
    profile.id && profile.created_at ? [{ id: String(profile.id), createdAt: profile.created_at }] : [],
  );
  const profileById = new Map(collectorProfiles.map((profile) => [profile.id, profile]));
  const capturesByUser = new Map<string, CollectorCapture[]>();
  for (const capture of actualMonth.captureRows) {
    if (!capture.user_id || !capture.created_at) continue;
    const userId = String(capture.user_id);
    capturesByUser.set(userId, [
      ...(capturesByUser.get(userId) ?? []),
      { userId, createdAt: capture.created_at, status: String(capture.status ?? "") },
    ]);
  }
  const observationCutoff = new Date().toISOString();
  const analyticsFor = (ids: string[]) => {
    const profiles = ids.flatMap((id) => {
      const profile = profileById.get(id);
      return profile ? [profile] : [];
    });
    const analytics = buildCollectorAnalytics({
      profiles,
      captures: ids.flatMap((id) => capturesByUser.get(id) ?? []),
      periodStart: actualMonth.collectorPeriod.start,
      periodEnd: actualMonth.collectorPeriod.end,
      observationCutoff,
    });
    return {
      users: ids.length,
      activationRate: analytics.activation.rate,
      activationEligible: analytics.activation.eligible,
      d7Rate: analytics.d7.rate,
      d7Eligible: analytics.d7.eligible,
      capturesPerCollector: analytics.summary.capturesPerCollector,
      payers: ids.filter((id) => payerIds.has(id)).length,
    };
  };

  const byPlatform = Object.fromEntries(
    growthPlatforms.map((platform) => [
      platform,
      analyticsFor(monthUsers.filter((item) => item.platform === platform).map((item) => item.row.user_id)),
    ]),
  ) as Record<GrowthPlatform, ReturnType<typeof analyticsFor>>;

  const groups = new Map<string, { channel: AcquisitionChannel; platform: GrowthPlatform; ids: string[] }>();
  for (const item of monthUsers) {
    const key = `${item.channel.key}|${item.platform}`;
    const group = groups.get(key) ?? { channel: item.channel, platform: item.platform, ids: [] };
    group.ids.push(item.row.user_id);
    groups.set(key, group);
  }
  const channels = Array.from(groups.values())
    .map(({ channel, platform, ids }) => {
      const stats = analyticsFor(ids);
      const spendRows =
        channel.network && (platform === "ios" || platform === "android")
          ? paidLog.filter((row) => row.network === channel.network && row.os === platform)
          : [];
      const spendByCurrency: Record<string, number> = {};
      for (const row of spendRows) spendByCurrency[row.currencyCode] = (spendByCurrency[row.currencyCode] ?? 0) + row.spend;
      const costPerUser =
        stats.users > 0 && Object.keys(spendByCurrency).length
          ? Object.fromEntries(Object.entries(spendByCurrency).map(([currency, amount]) => [currency, amount / stats.users]))
          : null;
      return { ...channel, platform, ...stats, costPerUser };
    })
    .sort((left, right) => right.users - left.users);

  const answered = (items: typeof inferred) =>
    items.filter((item) => item.row.self_reported_source && item.row.self_reported_source !== "skipped").length;
  const storeAttributed = (items: typeof inferred) =>
    items.filter((item) => item.channel.evidence === "store").length;

  return {
    attribution: {
      available: true as const,
      month: {
        users: monthUsers.length,
        signupsByPlatform,
        evidenceCounts: countBy(monthUsers, (item) => item.evidence),
        reportedAtSignup: monthUsers.filter((item) => item.atSignup).length,
        selfReported: answered(monthUsers),
        storeAttributed: storeAttributed(monthUsers),
        platformDaily: buildPlatformDaily(
          monthUsers.map((item) => ({ createdAt: item.row.created_at, platform: item.platform })),
          dates,
        ),
        byPlatform,
        channels,
      },
      allTime: {
        users: inferred.length,
        byPlatform: countBy(inferred, (item) => item.platform),
        evidenceCounts: countBy(inferred, (item) => item.evidence),
        selfReported: answered(inferred),
        storeAttributed: storeAttributed(inferred),
      },
    },
    paid: { log: paidLog, split: buildPaidOrganicSplit(signupsByPlatform, paidLog) },
    historicalChannels,
    revenue,
    previousMonthUsers,
  };
}
