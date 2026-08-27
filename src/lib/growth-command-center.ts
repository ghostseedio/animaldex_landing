export const growthTimezone = "Asia/Jakarta";

export type GrowthMetricKey =
  | "users"
  | "captures"
  | "socialViews"
  | "searchClicks"
  | "activePro"
  | "adSpend"
  | "paidUsers"
  | "activationRate"
  | "d7Retention"
  | "shortVideos"
  | "seoPages";
export type GrowthTargets = Record<GrowthMetricKey, number>;
export type GrowthMetricStatus =
  "on_target" | "close" | "behind" | "future" | "no_target";
export type ManualMetricStatus = GrowthMetricStatus | "pending" | "missing";

export type GrowthWeeklyTarget = {
  label: string;
  startDay: number;
  endDay: number;
  targets: GrowthTargets;
};

export type GrowthActionPlan = {
  label: string;
  startDay: number;
  endDay: number;
  items: string[];
};

export type GrowthDailyMarketing = {
  date: string;
  socialViews: number;
  searchClicks: number;
  adSpend: number;
  paidUsers: number;
  shortVideos: number;
  seoPages: number;
  notes: string;
};

export type SpendEntry = {
  platform:
    "google_ads" | "tiktok_ads" | "apple_search_ads" | "meta_ads" | "other";
  amount: number;
  currencyCode: string;
};

export const emptyGrowthTargets: GrowthTargets = {
  users: 0,
  captures: 0,
  socialViews: 0,
  searchClicks: 0,
  activePro: 0,
  adSpend: 0,
  paidUsers: 0,
  activationRate: 0,
  d7Retention: 0,
  shortVideos: 0,
  seoPages: 0,
};

// Initial operating assumption from the launch plan: 5,000 captures for
// 1,500 new users. This remains a planning target, never an actual.
export const capturesPerNewUser = 10 / 3;

export function generatedCaptureTarget(usersTarget: number) {
  return Math.max(0, Math.round(usersTarget * capturesPerNewUser));
}

// The launch plan's original £150 / 1,500-user budget is £0.10 per user.
// For IDR, use the recorded Google Ads acquisition benchmark (about IDR 1,595)
// rounded to IDR 1,600. Keeping this currency-aware prevents an IDR budget from
// being generated as the unitless value `150`.
export function generatedAdSpendTarget(
  usersTarget: number,
  currencyCode: string | null | undefined = "IDR",
) {
  const costPerUser =
    currencyCode === "IDR" ? 1600 : currencyCode === "USD" ? 0.13 : 0.1;
  return Math.max(0, Math.round(usersTarget * costPerUser));
}

export function generatedOperatingTargets(
  usersTarget: number,
  adSpendCurrency: string | null | undefined = "IDR",
) {
  return {
    captures: generatedCaptureTarget(usersTarget),
    socialViews: Math.max(0, Math.round(usersTarget * 200)),
    searchClicks: Math.max(0, Math.round(usersTarget * 0.6)),
    adSpend: generatedAdSpendTarget(usersTarget, adSpendCurrency),
    shortVideos: Math.max(0, Math.round(usersTarget * 0.06)),
    seoPages: Math.max(0, Math.round(usersTarget * 0.005)),
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function monthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: growthTimezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

export function todayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: growthTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function monthStart(month: string) {
  return `${month}-01`;
}

export type GrowthMonthState = "past" | "current" | "upcoming";

export function parseGrowthMonth(
  value: string | null | undefined,
  now = new Date(),
) {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return monthKey(now);
  return value;
}

export function growthMonthState(
  month: string,
  now = new Date(),
): GrowthMonthState {
  const current = monthKey(now);
  return month < current ? "past" : month > current ? "upcoming" : "current";
}

export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

export function jakartaMonthBounds(month: string) {
  const next = shiftMonth(month, 1);
  return {
    startIso: `${month}-01T00:00:00+07:00`,
    endExclusiveIso: `${next}-01T00:00:00+07:00`,
  };
}

export function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function dateKeyForDay(month: string, day: number) {
  return `${month}-${pad(day)}`;
}

export function dayFromDateKey(dateKey: string) {
  return Number(dateKey.slice(8, 10));
}

export function monthDateKeys(month: string) {
  return Array.from({ length: daysInMonth(month) }, (_, index) =>
    dateKeyForDay(month, index + 1),
  );
}

export function jakartaDayBounds(dateKey: string) {
  return {
    startIso: `${dateKey}T00:00:00+07:00`,
    endIso: `${dateKey}T23:59:59.999+07:00`,
  };
}

export function expectedByDay(target: number, day: number, totalDays: number) {
  if (target <= 0) return 0;
  return Math.round(
    (target * Math.min(Math.max(day, 0), totalDays)) / totalDays,
  );
}

export function previousDateKey(dateKey: string) {
  const previousNoonUtc = new Date(`${dateKey}T05:00:00+07:00`);
  previousNoonUtc.setUTCDate(previousNoonUtc.getUTCDate() - 1);
  return todayKey(previousNoonUtc);
}

export function manualReportingThroughDay(
  selectedMonth: string,
  today = todayKey(),
) {
  const todayMonth = today.slice(0, 7);
  if (selectedMonth < todayMonth) return daysInMonth(selectedMonth);
  if (selectedMonth > todayMonth) return 0;
  const previous = previousDateKey(today);
  return previous.slice(0, 7) === selectedMonth ? dayFromDateKey(previous) : 0;
}

export function manualStatusForDaily(options: {
  date: string;
  today: string;
  hasEntry: boolean;
  actual: number;
  expected: number;
  lowerIsBudget?: boolean;
}) {
  if (options.date > options.today) return "future" as const;
  if (options.date === options.today) return "pending" as const;
  if (!options.hasEntry) return "missing" as const;
  return statusForMetric(options.actual, options.expected, {
    lowerIsBudget: options.lowerIsBudget,
  });
}

export function expectedByCompletedReportingDays(
  target: number,
  completedDays: number,
  totalDays: number,
) {
  return expectedByDay(target, completedDays, totalDays);
}

export function dailyPaceTarget(target: number, totalDays: number) {
  if (target <= 0 || totalDays <= 0) return 0;
  return Math.ceil(target / totalDays);
}

export function expectedByWeekDay(
  target: number,
  elapsedDays: number,
  weekDays: number,
) {
  if (target <= 0 || weekDays <= 0) return 0;
  return Math.round(
    (target * Math.min(Math.max(elapsedDays, 0), weekDays)) / weekDays,
  );
}

export function cumulativeTargetByDay(target: number, totalDays: number) {
  return Array.from({ length: totalDays }, (_, index) =>
    expectedByDay(target, index + 1, totalDays),
  );
}

export function statusForMetric(
  actual: number,
  expected: number,
  options?: { future?: boolean; lowerIsBudget?: boolean },
) {
  if (options?.future) return "future" as const;
  if (expected <= 0) return "no_target" as const;
  if (options?.lowerIsBudget) {
    if (actual <= expected) return "on_target" as const;
    if (actual <= expected * 1.15) return "close" as const;
    return "behind" as const;
  }
  if (actual >= expected) return "on_target" as const;
  if (actual >= expected * 0.85) return "close" as const;
  return "behind" as const;
}

export function formatMoney(
  amount: number | null,
  currencyCode: string | null | undefined,
) {
  if (amount == null) return "-";
  if (!currencyCode)
    return `Unknown currency ${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount)}`;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: currencyCode === "IDR" ? 0 : 2,
  }).format(amount);
}

export function sumSpendByCurrency(entries: SpendEntry[]) {
  return entries.reduce<Record<string, number>>((totals, entry) => {
    totals[entry.currencyCode] =
      (totals[entry.currencyCode] ?? 0) + entry.amount;
    return totals;
  }, {});
}

export function comparableSpendTotal(
  entries: SpendEntry[],
  currencyCode: string | null | undefined,
) {
  if (!currencyCode) return null;
  const totals = sumSpendByCurrency(entries);
  const currencies = Object.keys(totals).filter(
    (currency) => totals[currency] > 0,
  );
  if (currencies.length === 0) return 0;
  return currencies.length === 1 && currencies[0] === currencyCode
    ? totals[currencyCode]
    : null;
}

export function budgetStatus(actual: number | null, budget: number) {
  if (actual == null || budget <= 0) return "no_target" as const;
  return statusForMetric(actual, budget, { lowerIsBudget: true });
}

export function aheadBehind(actual: number, expected: number) {
  return actual - expected;
}

export function requiredPerDay(
  actual: number,
  target: number,
  currentDay: number,
  totalDays: number,
) {
  const remaining = Math.max(0, target - actual);
  // `actual` is a live total that already includes the current calendar day.
  // Pace the remaining gap across the full days after today so the numerator,
  // denominator and UI "days remaining" label share one meaning.
  const daysRemaining = Math.max(0, totalDays - currentDay);
  return daysRemaining === 0 ? remaining : Math.ceil(remaining / daysRemaining);
}

export function weekDateRange(
  month: string,
  week: Pick<GrowthWeeklyTarget, "startDay" | "endDay">,
) {
  return {
    start: dateKeyForDay(month, week.startDay),
    end: dateKeyForDay(month, week.endDay),
  };
}

export function calendarWeeksForMonth(month: string) {
  const totalDays = daysInMonth(month);
  const weeks: Array<{ label: string; startDay: number; endDay: number }> = [];
  let startDay = 1;
  while (startDay <= totalDays) {
    const endDay = Math.min(totalDays, startDay === 1 ? 6 : startDay + 6);
    weeks.push({ label: `Week ${weeks.length + 1}`, startDay, endDay });
    startDay = endDay + 1;
  }
  return weeks;
}

export function splitMonthlyTargetsByCalendarWeeks(
  month: string,
  targets: GrowthTargets,
): GrowthWeeklyTarget[] {
  const totalDays = daysInMonth(month);
  return calendarWeeksForMonth(month).map((week) => {
    const weekDays = week.endDay - week.startDay + 1;
    const prorated = (target: number) =>
      target > 0 ? Math.round((target * weekDays) / totalDays) : 0;
    return {
      ...week,
      targets: {
        users: prorated(targets.users),
        captures: prorated(targets.captures),
        socialViews: prorated(targets.socialViews),
        searchClicks: prorated(targets.searchClicks),
        activePro: expectedByDay(targets.activePro, week.endDay, totalDays),
        adSpend: prorated(targets.adSpend),
        paidUsers: prorated(targets.paidUsers),
        activationRate: targets.activationRate,
        d7Retention: targets.d7Retention,
        shortVideos: prorated(targets.shortVideos),
        seoPages: prorated(targets.seoPages),
      },
    };
  });
}

export function rate(numerator: number, denominator: number) {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : null;
}

export function isCohortMature(
  createdAt: string,
  observationCutoffTime: number,
  windowHours: number,
) {
  return (
    new Date(createdAt).getTime() + windowHours * 60 * 60 * 1000 <=
    observationCutoffTime
  );
}

export function comparePercent(
  current: number | null,
  previous: number | null,
) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function needsAttention(
  items: Array<{
    label: string;
    actual: number;
    expected: number;
    lowerIsBudget?: boolean;
    priority: number;
  }>,
) {
  return items
    .flatMap((item) => {
      if (item.expected <= 0) return [];
      const status = statusForMetric(item.actual, item.expected, {
        lowerIsBudget: item.lowerIsBudget,
      });
      if (status === "on_target") return [];
      const delta = Math.abs(item.actual - item.expected);
      return [
        {
          priority: item.priority,
          message: item.lowerIsBudget
            ? `${item.label} is ${formatAttentionNumber(delta)} over pace.`
            : `${item.label} is ${formatAttentionNumber(delta)} behind pace.`,
        },
      ];
    })
    .sort((left, right) => right.priority - left.priority)
    .slice(0, 3)
    .map((item) => item.message);
}

function formatAttentionNumber(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: value >= 10000 ? "compact" : "standard",
  }).format(value);
}

export function normalizeTargets(
  input: Partial<Record<GrowthMetricKey, unknown>> | null | undefined,
): GrowthTargets {
  return (Object.keys(emptyGrowthTargets) as GrowthMetricKey[]).reduce(
    (targets, key) => {
      const value = Number(input?.[key]);
      targets[key] = Number.isFinite(value) && value >= 0 ? value : 0;
      return targets;
    },
    { ...emptyGrowthTargets },
  );
}

export function normalizeWeeklyTargets(input: unknown): GrowthWeeklyTarget[] {
  return Array.isArray(input)
    ? input.map((item, index) => {
        const row = item as Partial<GrowthWeeklyTarget>;
        return {
          label: String(row.label || `Week ${index + 1}`),
          startDay: Math.max(1, Number(row.startDay) || 1),
          endDay: Math.max(1, Number(row.endDay) || 1),
          targets: normalizeTargets(row.targets),
        };
      })
    : [];
}

export function normalizeActionPlans(input: unknown): GrowthActionPlan[] {
  return Array.isArray(input)
    ? input.map((item, index) => {
        const row = item as Partial<GrowthActionPlan>;
        return {
          label: String(row.label || `Week ${index + 1}`),
          startDay: Math.max(1, Number(row.startDay) || 1),
          endDay: Math.max(1, Number(row.endDay) || 1),
          items: Array.isArray(row.items)
            ? row.items.map(String).filter(Boolean)
            : [],
        };
      })
    : [];
}

export type GrowthModel = "linear" | "ramp";
export type UsersTargetSource = "generated" | "override" | "none";
export type OrganicPlatform =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "facebook"
  | "x"
  | "reddit"
  | "other";
export type OrganicEntry = {
  platform: OrganicPlatform;
  posts: number;
  views: number;
};
export type NorthStarGoal = {
  targetUsers: number;
  targetDate: string;
  growthModel: GrowthModel;
  rampPercent: number;
};
export type MonthAllocation = {
  month: string;
  remainingDays: number;
  allocatedRemaining: number;
  generatedTarget: number;
};
export type NorthStarTrajectory = {
  currentUsers: number;
  remainingUsers: number;
  remainingDays: number;
  requiredAverage: number;
  months: MonthAllocation[];
  explanation: string;
};

export type RecoverySnapshot = {
  source: string;
  periodStart: string;
  periodEnd: string;
  metric: string;
  value: number;
  currency: string | null;
};

export type RecoveryChannelEvidence = {
  source: string;
  registeredUsers: number;
  spend: number | null;
  currency: string | null;
  views: number | null;
  cpa: number | null;
  usersPerThousandViews: number | null;
  confidence: "medium" | "high";
};

export type RecoveryPlan = {
  remainingUsers: number;
  remainingDays: number;
  requiredPerDay: number;
  currentAveragePerDay: number;
  recentAveragePerDay: number;
  projectedMonthEnd: number;
  bestObservedProjectedMonthEnd: number;
  targetLikely: boolean;
  evidence: RecoveryChannelEvidence[];
  blockers: string[];
};

export type CollectorProfile = { id: string; createdAt: string };
export type CollectorCapture = {
  userId: string;
  createdAt: string;
  status: string;
};
export type CollectorDepthBucket = {
  label: "1" | "2–4" | "5–9" | "10–24" | "25+";
  users: number;
  percent: number;
};
export type CollectorAnalytics = {
  newUsers: number;
  activation: { users: number; eligible: number; rate: number | null };
  repeat: { users: number; activated: number; rate: number | null };
  retained7Day: { users: number; eligible: number; rate: number | null };
  d1: { users: number; eligible: number; rate: number | null };
  d7: { users: number; eligible: number; rate: number | null };
  summary: {
    captures: number;
    collectors: number;
    capturesPerCollector: number | null;
    medianCaptures: number | null;
  };
  depth: CollectorDepthBucket[];
  retention: Array<{
    cohort: string;
    size: number;
    days: Array<number | null>;
  }>;
  activity: Array<{ date: string; captures: number; collectors: number }>;
  definitions: {
    qualifyingCapture: string;
    activation: string;
    repeat: string;
    retained7Day: string;
    d1: string;
    d7: string;
  };
};

export const organicPlatforms: OrganicPlatform[] = [
  "tiktok",
  "instagram",
  "youtube",
  "facebook",
  "x",
  "reddit",
  "other",
];
export const organicPlatformLabels: Record<OrganicPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube Shorts",
  facebook: "Facebook",
  x: "X (Twitter)",
  reddit: "Reddit",
  other: "Other",
};

export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInclusive(startDate: string, endDate: string) {
  if (endDate < startDate) return 0;
  const start = new Date(`${startDate}T00:00:00+07:00`).getTime();
  const end = new Date(`${endDate}T00:00:00+07:00`).getTime();
  return Math.round((end - start) / 86400000) + 1;
}

export function monthKeysBetween(startMonth: string, endMonth: string) {
  const months: string[] = [];
  for (let month = startMonth; month <= endMonth; month = shiftMonth(month, 1))
    months.push(month);
  return months;
}

export function remainingDaysInMonth(
  month: string,
  today: string,
  targetDate: string,
) {
  const start = dateKeyForDay(month, 1);
  const end = dateKeyForDay(month, daysInMonth(month));
  const windowStart = today > start ? today : start;
  const windowEnd = targetDate < end ? targetDate : end;
  return daysInclusive(windowStart, windowEnd);
}

export function roundPreserveSum(values: number[], total: number) {
  if (!values.length) return [];
  const rounded = values.map((value) => Math.round(value));
  rounded[rounded.length - 1] =
    total - rounded.slice(0, -1).reduce((sum, value) => sum + value, 0);
  return rounded.map((value) => Math.max(0, value));
}

export function paceNumber(actual: number, days: number) {
  if (days <= 0) return 0;
  return Math.round((actual / days) * 10) / 10;
}

export function timeElapsedPercent(currentDay: number, totalDays: number) {
  if (totalDays <= 0) return 0;
  return Math.round(
    (Math.min(Math.max(currentDay, 0), totalDays) / totalDays) * 100,
  );
}

export function generateNorthStarTrajectory(options: {
  goal: NorthStarGoal;
  today: string;
  currentUsers: number;
  currentMonthActual?: number;
}) {
  const { goal, today, currentUsers } = options;
  const remainingUsers = Math.max(
    0,
    Math.round(goal.targetUsers - currentUsers),
  );
  const remainingDays = daysInclusive(today, goal.targetDate);
  const requiredAverage = paceNumber(remainingUsers, remainingDays);
  const months = monthKeysBetween(
    today.slice(0, 7),
    goal.targetDate.slice(0, 7),
  );
  const remainingDayCounts = months.map((month) =>
    remainingDaysInMonth(month, today, goal.targetDate),
  );
  const ramp =
    goal.growthModel === "ramp" ? Math.max(0, goal.rampPercent) / 100 : 0;
  const weights = remainingDayCounts.map(
    (days, index) => days * Math.pow(1 + ramp, index),
  );
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const raw =
    weightSum > 0
      ? weights.map((weight) => remainingUsers * (weight / weightSum))
      : months.map(() => 0);
  const allocations = roundPreserveSum(raw, remainingUsers);
  const currentMonth = today.slice(0, 7);
  const currentMonthActual = options.currentMonthActual ?? 0;
  const trajectoryMonths: MonthAllocation[] = months.map((month, index) => {
    const allocatedRemaining = allocations[index] ?? 0;
    return {
      month,
      remainingDays: remainingDayCounts[index] ?? 0,
      allocatedRemaining,
      generatedTarget:
        month === currentMonth
          ? currentMonthActual + allocatedRemaining
          : allocatedRemaining,
    };
  });
  const currentAllocation = trajectoryMonths.find(
    (row) => row.month === currentMonth,
  );
  const modelLabel =
    goal.growthModel === "ramp"
      ? `+${goal.rampPercent}% monthly ramp`
      : "linear remaining-days split";
  const explanation = [
    `Goal: ${goal.targetUsers.toLocaleString("en")} total users by ${goal.targetDate}.`,
    `Current users: ${currentUsers.toLocaleString("en")}.`,
    `Remaining: ${remainingUsers.toLocaleString("en")} in ${remainingDays} days.`,
    `Growth model: ${modelLabel}.`,
    currentAllocation
      ? `${currentMonth} remaining days: ${currentAllocation.remainingDays}. Remaining allocation: ${currentAllocation.allocatedRemaining.toLocaleString("en")}. Plus ${currentMonthActual.toLocaleString("en")} already acquired = ${currentAllocation.generatedTarget.toLocaleString("en")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    currentUsers,
    remainingUsers,
    remainingDays,
    requiredAverage,
    months: trajectoryMonths,
    explanation,
  } satisfies NorthStarTrajectory;
}

export function resolveUsersTarget(options: {
  storedUsers: number;
  usersOverride?: boolean | null;
  generatedTarget: number | null;
}): { users: number; source: UsersTargetSource } {
  const generated =
    options.generatedTarget && options.generatedTarget > 0
      ? options.generatedTarget
      : null;
  if (options.usersOverride === true && options.storedUsers > 0)
    return { users: options.storedUsers, source: "override" };
  if (options.usersOverride === false && generated)
    return { users: generated, source: "generated" };
  if (options.storedUsers > 0)
    return { users: options.storedUsers, source: "override" };
  if (generated) return { users: generated, source: "generated" };
  return { users: 0, source: "none" };
}

export function deriveOrganicTotals(entries: OrganicEntry[]) {
  return entries.reduce(
    (totals, entry) => ({
      posts: totals.posts + entry.posts,
      views: totals.views + entry.views,
    }),
    { posts: 0, views: 0 },
  );
}

// A video cross-posted to several destinations is one original piece of
// content. The largest platform count therefore represents original output
// without multiplying it by every platform it was published on.
export function deriveShortVideoCount(entries: OrganicEntry[]) {
  const shortFormPlatforms = new Set<OrganicPlatform>([
    "tiktok",
    "instagram",
    "youtube",
    "facebook",
    "x",
  ]);
  return entries.reduce(
    (highest, entry) =>
      shortFormPlatforms.has(entry.platform)
        ? Math.max(highest, entry.posts)
        : highest,
    0,
  );
}

export function normalizeOrganicEntries(input: unknown): OrganicEntry[] {
  const allowed = new Set(organicPlatforms);
  const byPlatform = new Map<OrganicPlatform, OrganicEntry>();
  if (Array.isArray(input)) {
    for (const item of input) {
      const row = item as Partial<OrganicEntry>;
      const platform = String(row.platform) as OrganicPlatform;
      if (!allowed.has(platform)) continue;
      const posts = Math.max(0, Math.round(Number(row.posts) || 0));
      const views = Math.max(0, Math.round(Number(row.views) || 0));
      if (posts <= 0 && views <= 0) continue;
      const existing = byPlatform.get(platform);
      byPlatform.set(platform, {
        platform,
        posts: (existing?.posts ?? 0) + posts,
        views: (existing?.views ?? 0) + views,
      });
    }
  }
  return organicPlatforms.flatMap((platform) => {
    const entry = byPlatform.get(platform);
    return entry ? [entry] : [];
  });
}

export function normalizeNorthStar(
  input: Partial<NorthStarGoal> | null | undefined,
): NorthStarGoal | null {
  const targetUsers = Math.round(Number(input?.targetUsers));
  const targetDate = String(input?.targetDate ?? "");
  if (
    !Number.isFinite(targetUsers) ||
    targetUsers <= 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)
  )
    return null;
  const growthModel: GrowthModel =
    input?.growthModel === "linear" ? "linear" : "ramp";
  const rampPercent = Number.isFinite(Number(input?.rampPercent))
    ? Math.max(0, Number(input?.rampPercent))
    : 20;
  return { targetUsers, targetDate, growthModel, rampPercent };
}

/**
 * Deterministic recovery forecast. It deliberately accepts only attributed
 * `registered_users`; platform-reported installs, clicks and views are never
 * treated as AnimalDex users.
 */
export function buildRecoveryPlan(options: {
  actualUsers: number;
  targetUsers: number;
  currentDay: number;
  totalDays: number;
  dailyUsers: number[];
  snapshots?: RecoverySnapshot[];
}): RecoveryPlan {
  const remainingUsers = Math.max(0, options.targetUsers - options.actualUsers);
  const remainingDays = Math.max(0, options.totalDays - options.currentDay);
  const required =
    remainingDays > 0
      ? Math.ceil(remainingUsers / remainingDays)
      : remainingUsers;
  const elapsed = options.dailyUsers.slice(0, Math.max(0, options.currentDay));
  const currentAveragePerDay = paceNumber(
    elapsed.reduce((sum, value) => sum + value, 0),
    elapsed.length,
  );
  const recent = elapsed.slice(-Math.min(7, elapsed.length));
  const recentAveragePerDay = paceNumber(
    recent.reduce((sum, value) => sum + value, 0),
    recent.length,
  );
  const bestWindow = elapsed.reduce((best, _value, index) => {
    const window = elapsed.slice(Math.max(0, index - 6), index + 1);
    return Math.max(
      best,
      paceNumber(
        window.reduce((sum, value) => sum + value, 0),
        window.length,
      ),
    );
  }, 0);
  const projectedMonthEnd = Math.round(
    options.actualUsers + recentAveragePerDay * remainingDays,
  );
  const bestObservedProjectedMonthEnd = Math.round(
    options.actualUsers + bestWindow * remainingDays,
  );

  const snapshots = options.snapshots ?? [];
  const groups = new Map<string, RecoverySnapshot[]>();
  for (const row of snapshots) {
    const key = `${row.source}|${row.periodStart}|${row.periodEnd}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const evidence: RecoveryChannelEvidence[] = [];
  for (const rows of Array.from(groups.values())) {
    const attributed = rows.find((row) => row.metric === "registered_users");
    if (!attributed || attributed.value < 10) continue;
    const spend = rows.find((row) => row.metric === "spend");
    const views = rows.find(
      (row) => row.metric === "video_views" || row.metric === "views",
    );
    evidence.push({
      source: attributed.source,
      registeredUsers: attributed.value,
      spend: spend?.value ?? null,
      currency: spend?.currency ?? null,
      views: views?.value ?? null,
      cpa: spend ? spend.value / attributed.value : null,
      usersPerThousandViews:
        views && views.value > 0
          ? (attributed.value * 1000) / views.value
          : null,
      confidence: attributed.value >= 50 ? "high" : "medium",
    });
  }
  const blockers: string[] = [];
  if (!evidence.some((row) => row.cpa != null))
    blockers.push(
      "Paid spend is not linked to registered AnimalDex users, so a user CPA or recovery budget cannot be estimated yet.",
    );
  if (!evidence.some((row) => row.usersPerThousandViews != null))
    blockers.push(
      "Social views are not linked to registered AnimalDex users, so an organic reach target cannot be estimated yet.",
    );
  return {
    remainingUsers,
    remainingDays,
    requiredPerDay: required,
    currentAveragePerDay,
    recentAveragePerDay,
    projectedMonthEnd,
    bestObservedProjectedMonthEnd,
    targetLikely:
      remainingUsers === 0 ||
      bestObservedProjectedMonthEnd >= options.targetUsers,
    evidence,
    blockers,
  };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function jakartaCalendarOffset(fromIso: string, toIso: string) {
  const from = new Date(
    `${todayKey(new Date(fromIso))}T00:00:00+07:00`,
  ).getTime();
  const to = new Date(`${todayKey(new Date(toIso))}T00:00:00+07:00`).getTime();
  return Math.round((to - from) / 86400000);
}

export function collectorDepthBucket(
  count: number,
): CollectorDepthBucket["label"] {
  if (count <= 1) return "1";
  if (count <= 4) return "2–4";
  if (count <= 9) return "5–9";
  if (count <= 24) return "10–24";
  return "25+";
}

/** All Product analytics share this single capture predicate. */
export function isQualifyingCollectorCapture(capture: CollectorCapture) {
  return (
    capture.status === "ready" &&
    Boolean(capture.userId) &&
    Number.isFinite(new Date(capture.createdAt).getTime())
  );
}

export function buildCollectorAnalytics(options: {
  profiles: CollectorProfile[];
  captures: CollectorCapture[];
  periodStart: string;
  periodEnd: string;
  observationCutoff: string;
}): CollectorAnalytics {
  const cutoff = new Date(options.observationCutoff).getTime();
  const periodStart = new Date(options.periodStart).getTime();
  const periodEnd = new Date(options.periodEnd).getTime();
  const qualifying = options.captures.filter(isQualifyingCollectorCapture);
  const byUser = new Map<string, CollectorCapture[]>();
  for (const capture of qualifying)
    byUser.set(capture.userId, [
      ...(byUser.get(capture.userId) ?? []),
      capture,
    ]);
  for (const rows of Array.from(byUser.values()))
    rows.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const activated: Array<{
    profile: CollectorProfile;
    first: CollectorCapture;
  }> = [];
  const activationEligible = options.profiles.filter((profile) =>
    isCohortMature(profile.createdAt, cutoff, 24),
  );
  for (const profile of activationEligible) {
    const signup = new Date(profile.createdAt).getTime();
    const first = (byUser.get(profile.id) ?? []).find((capture) => {
      const time = new Date(capture.createdAt).getTime();
      return time >= signup && time < signup + 86400000;
    });
    if (first) activated.push({ profile, first });
  }
  const repeatUsers = activated.filter(({ first }) =>
    (byUser.get(first.userId) ?? []).some(
      (capture) =>
        new Date(capture.createdAt).getTime() >
        new Date(first.createdAt).getTime(),
    ),
  ).length;
  const retainedEligible = activated.filter(({ first }) =>
    isCohortMature(first.createdAt, cutoff, 7 * 24),
  );
  const retainedUsers = retainedEligible.filter(
    ({ first }) =>
      new Set(
        (byUser.get(first.userId) ?? [])
          .filter((capture) => {
            const offset = jakartaCalendarOffset(
              first.createdAt,
              capture.createdAt,
            );
            return offset >= 0 && offset <= 6;
          })
          .map((capture) => todayKey(new Date(capture.createdAt))),
      ).size >= 2,
  ).length;
  const d1Eligible = activated.filter(({ first }) =>
    isCohortMature(first.createdAt, cutoff, 48),
  );
  const d1Users = d1Eligible.filter(({ first }) => {
    const firstTime = new Date(first.createdAt).getTime();
    return (byUser.get(first.userId) ?? []).some((capture) => {
      const time = new Date(capture.createdAt).getTime();
      return time >= firstTime + 86400000 && time < firstTime + 172800000;
    });
  }).length;
  const d7Eligible = activated.filter(({ first }) =>
    isCohortMature(first.createdAt, cutoff, 192),
  );
  const d7Users = d7Eligible.filter(({ first }) => {
    const firstTime = new Date(first.createdAt).getTime();
    return (byUser.get(first.userId) ?? []).some((capture) => {
      const time = new Date(capture.createdAt).getTime();
      return (
        time >= firstTime + 6 * 86400000 && time < firstTime + 8 * 86400000
      );
    });
  }).length;

  const periodCaptures = qualifying.filter((capture) => {
    const time = new Date(capture.createdAt).getTime();
    return time >= periodStart && time <= periodEnd;
  });
  const periodCounts = new Map<string, number>();
  const activityMap = new Map<
    string,
    { captures: number; users: Set<string> }
  >();
  for (const capture of periodCaptures) {
    periodCounts.set(
      capture.userId,
      (periodCounts.get(capture.userId) ?? 0) + 1,
    );
    const date = todayKey(new Date(capture.createdAt));
    const entry = activityMap.get(date) ?? {
      captures: 0,
      users: new Set<string>(),
    };
    entry.captures += 1;
    entry.users.add(capture.userId);
    activityMap.set(date, entry);
  }
  const counts = Array.from(periodCounts.values());
  const labels: CollectorDepthBucket["label"][] = [
    "1",
    "2–4",
    "5–9",
    "10–24",
    "25+",
  ];
  const depth = labels.map((label) => {
    const users = counts.filter(
      (count) => collectorDepthBucket(count) === label,
    ).length;
    return { label, users, percent: rate(users, counts.length) ?? 0 };
  });
  const cohortMap = new Map<string, Array<{ first: CollectorCapture }>>();
  for (const row of activated) {
    const date = todayKey(new Date(row.first.createdAt));
    cohortMap.set(date, [...(cohortMap.get(date) ?? []), row]);
  }
  const retention = Array.from(cohortMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cohort, rows]) => ({
      cohort,
      size: rows.length,
      days: Array.from({ length: 8 }, (_, day) => {
        const mature = rows.filter(
          ({ first }) =>
            jakartaCalendarOffset(first.createdAt, options.observationCutoff) >=
            day,
        );
        if (!mature.length) return null;
        const retained = mature.filter(({ first }) =>
          (byUser.get(first.userId) ?? []).some(
            (capture) =>
              jakartaCalendarOffset(first.createdAt, capture.createdAt) === day,
          ),
        ).length;
        return rate(retained, mature.length);
      }),
    }));
  return {
    newUsers: options.profiles.length,
    activation: {
      users: activated.length,
      eligible: activationEligible.length,
      rate: rate(activated.length, activationEligible.length),
    },
    repeat: {
      users: repeatUsers,
      activated: activated.length,
      rate: rate(repeatUsers, activated.length),
    },
    retained7Day: {
      users: retainedUsers,
      eligible: retainedEligible.length,
      rate: rate(retainedUsers, retainedEligible.length),
    },
    d1: {
      users: d1Users,
      eligible: d1Eligible.length,
      rate: rate(d1Users, d1Eligible.length),
    },
    d7: {
      users: d7Users,
      eligible: d7Eligible.length,
      rate: rate(d7Users, d7Eligible.length),
    },
    summary: {
      captures: periodCaptures.length,
      collectors: counts.length,
      capturesPerCollector: counts.length
        ? Math.round((periodCaptures.length / counts.length) * 10) / 10
        : null,
      medianCaptures: median(counts),
    },
    depth,
    retention,
    activity: Array.from(activityMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, value]) => ({
        date,
        captures: value.captures,
        collectors: value.users.size,
      })),
    definitions: {
      qualifyingCapture:
        "A capture with status=ready, a user_id and a valid created_at timestamp.",
      activation:
        "New profile with a qualifying capture within 24 hours of profile creation; only profiles with a complete 24-hour window are eligible.",
      repeat:
        "Activated collector with any additional qualifying capture after their first qualifying capture.",
      retained7Day:
        "Activated collector with qualifying captures on at least two distinct Asia/Jakarta calendar days from D0 through D6; only complete seven-day windows are eligible.",
      d1: "Activated collector with another qualifying capture 24–48 hours after first capture; only complete windows are eligible.",
      d7: "Activated collector with another qualifying capture 6–8 days after first capture; only complete windows are eligible.",
    },
  };
}
