import {
  emptyGrowthTargets,
  formatMoney,
  generatedOperatingTargets,
  splitMonthlyTargetsByCalendarWeeks,
  type GrowthMetricKey,
  type GrowthTargets,
  type SpendEntry,
  type SpendOs,
} from "@/lib/growth-command-center";
import {
  type GrowthActionPlan,
  type GrowthPlan,
} from "./types";

export const growthMeta: Record<
  GrowthMetricKey,
  {
    label: string;
    short: string;
    kind: "AUTO" | "MANUAL";
    budget?: boolean;
    money?: boolean;
    role?: string;
  }
> = {
  users: {
    label: "New users",
    short: "Users",
    kind: "AUTO",
    role: "North Star outcome",
  },
  captures: {
    label: "Captures",
    short: "Captures",
    kind: "AUTO",
    role: "Operating target",
  },
  socialViews: {
    label: "Social views",
    short: "Social",
    kind: "MANUAL",
    role: "Operating target",
  },
  searchClicks: {
    label: "Google clicks",
    short: "Google",
    kind: "MANUAL",
    role: "Operating target",
  },
  activePro: {
    label: "Active Pro",
    short: "Pro",
    kind: "AUTO",
    role: "Operating target",
  },
  adSpend: {
    label: "Ad spend",
    short: "Ads",
    kind: "MANUAL",
    budget: true,
    money: true,
    role: "Operating target",
  },
  paidUsers: {
    label: "Paid users",
    short: "Paid",
    kind: "MANUAL",
    role: "Operating target",
  },
  activationRate: {
    label: "Activation rate",
    short: "Act",
    kind: "AUTO",
    role: "Operating target",
  },
  d7Retention: {
    label: "D7 retention",
    short: "D7",
    kind: "AUTO",
    role: "Operating target",
  },
  shortVideos: {
    label: "Short videos",
    short: "Shorts",
    kind: "MANUAL",
    role: "Execution target",
  },
  seoPages: {
    label: "SEO pages",
    short: "SEO",
    kind: "MANUAL",
    role: "Execution target",
  },
};
export const defaultJobs = [
  "Publish 3 original short videos/day",
  "Cross-post winning videos",
  "Publish 2 SEO articles",
  "Test 3 content hooks",
  "Run measured ads",
  "Review acquisition sources Sunday",
];
export const targetFields: GrowthMetricKey[] = [
  "users",
  "captures",
  "socialViews",
  "searchClicks",
  "activePro",
  "adSpend",
  "shortVideos",
  "seoPages",
  "activationRate",
  "d7Retention",
];

export function format(value: number | null, money = false) {
  if (value == null) return "-";
  return new Intl.NumberFormat("en", {
    notation: value >= 10000 && !money ? "compact" : "standard",
    style: money ? "currency" : "decimal",
    currency: money ? "USD" : undefined,
    maximumFractionDigits: money ? 2 : 0,
  }).format(value);
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}
export function shortDate(month: string, day: number) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`));
}
export function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
export function formatSpendByCurrency(
  totals: Record<string, number> | undefined,
) {
  const entries = Object.entries(totals ?? {}).filter(
    ([, amount]) => amount > 0,
  );
  return entries.length
    ? entries
        .map(([currency, amount]) => formatMoney(amount, currency))
        .join(" · ")
    : "Not entered";
}
export const spendNetworkLabels: Record<SpendEntry["platform"], string> = {
  google_ads: "Google Ads",
  apple_search_ads: "Apple Search Ads",
  tiktok_ads: "TikTok Ads",
  meta_ads: "Meta Ads",
  other: "Other ads",
};
export const spendOsLabels: Record<SpendOs, string> = {
  android: "Android",
  ios: "iOS",
  mixed: "iOS + Android",
  web: "Web",
  unknown: "App not set",
};
export function formatSpendEntries(entries: SpendEntry[] | undefined) {
  if (!entries?.length) return "Not entered";
  return entries
    .map((entry) => {
      const os = entry.os && entry.os !== "unknown" ? ` (${spendOsLabels[entry.os]})` : "";
      const installs =
        entry.reportedInstalls != null ? ` · ${format(entry.reportedInstalls)} installs` : "";
      return `${spendNetworkLabels[entry.platform]}${os} ${formatMoney(entry.amount, entry.currencyCode)}${installs}`;
    })
    .join(" · ");
}
export function statusLabel(status: string) {
  return status === "on_target"
    ? "ON PACE"
    : status === "close"
      ? "SLIGHTLY BEHIND"
      : status === "future"
        ? "FUTURE"
        : status === "pending"
          ? "PENDING"
          : status === "missing"
            ? "MISSING DATA"
            : status === "no_target"
              ? "NO TARGET SET"
              : "BEHIND";
}
export function statusClass(status: string) {
  if (status === "on_target")
    return "border-primary-400/30 bg-primary-500/10 text-primary-100";
  if (status === "close")
    return "border-amber-300/30 bg-amber-400/10 text-amber-200";
  if (status === "future" || status === "no_target" || status === "pending")
    return "border-line-300 bg-white/[.03] text-ink-400";
  if (status === "missing")
    return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  return "border-red-400/30 bg-red-500/10 text-red-200";
}
export function progressFillClass(status: string) {
  if (status === "on_target") return "bg-primary-400";
  if (status === "close") return "bg-amber-300";
  if (status === "behind") return "bg-red-400";
  return "bg-white/20";
}
export function percentOf(actual: number, target: number) {
  return target > 0 ? Math.round((actual / target) * 100) : null;
}
export function rollingRequiredPerDay(
  target: number,
  actualThroughPreviousDay: number,
  currentDay: number,
  totalDays: number,
  lowerIsBetter = false,
) {
  if (target <= 0 || totalDays <= 0 || currentDay <= 0) return 0;
  const daysRemaining = Math.max(1, totalDays - currentDay + 1);
  const remaining = lowerIsBetter
    ? Math.max(0, target - actualThroughPreviousDay)
    : Math.max(0, target - actualThroughPreviousDay);
  return lowerIsBetter
    ? Math.ceil(remaining / daysRemaining)
    : Math.ceil(remaining / daysRemaining);
}
export function friendlyGrowthError(message: string) {
  return message.includes("growth_")
    ? "Growth tables are not in Supabase yet. Apply the latest growth migrations, then retry."
    : message;
}
export function defaultTargetsForMonth(
  month: string,
  source?: GrowthPlan | null,
): GrowthTargets {
  const baseUsers = source?.targets?.users ?? (month === "2026-09" ? 1500 : 0);
  const generated = generatedOperatingTargets(
    baseUsers,
    source?.adSpendCurrency ?? "IDR",
  );
  return (
    source?.targets ?? {
      ...emptyGrowthTargets,
      users: baseUsers,
      captures: month === "2026-09" ? generated.captures : 0,
      socialViews: month === "2026-09" ? generated.socialViews : 0,
      searchClicks: month === "2026-09" ? generated.searchClicks : 0,
      activePro: month === "2026-09" ? 10 : 0,
      adSpend: month === "2026-09" ? generated.adSpend : 0,
      shortVideos: month === "2026-09" ? generated.shortVideos : 0,
      seoPages: month === "2026-09" ? generated.seoPages : 0,
    }
  );
}
export function actionPlansFromText(
  month: string,
  text: string,
  existingPlans: GrowthActionPlan[] = [],
  activeDay = 1,
): GrowthActionPlan[] {
  const weeks = splitMonthlyTargetsByCalendarWeeks(month, emptyGrowthTargets);
  const items = text
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const activeWeek =
    weeks.find(
      (week) => activeDay >= week.startDay && activeDay <= week.endDay,
    ) ?? weeks[0];
  return weeks.map((week) => ({
    label: `${shortDate(month, week.startDay)}-${week.endDay} jobs`,
    startDay: week.startDay,
    endDay: week.endDay,
    items:
      week.startDay === activeWeek?.startDay
        ? items
        : (existingPlans.find(
            (plan) =>
              plan.startDay === week.startDay ||
              (plan.startDay <= week.endDay && plan.endDay >= week.startDay),
          )?.items ?? []),
  }));
}
export function targetValue(
  label: string,
  actual: number | string,
  target: number,
  missing = false,
) {
  if (missing)
    return `${typeof actual === "number" ? "—" : actual}${target > 0 ? ` / ${format(target)}` : ""}`;
  return target > 0 ? `${actual} / ${format(target)}` : String(actual);
}

export function progressPercent(actual: number, target: number, lowerIsBetter = false) {
  if (target <= 0) return 0;
  const ratio = lowerIsBetter ? target / Math.max(actual, 1) : actual / target;
  return Math.max(0, Math.min(1, ratio));
}


export function rollingDailyAverage(values: number[], windowSize = 7) {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - windowSize + 1), index + 1);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}

export function perMinuteRate(value: number) {
  return value / (24 * 60);
}

