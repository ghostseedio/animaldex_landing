import {
  type GrowthTargets,
  type CollectorAnalytics,
  type NorthStarGoal,
  type NorthStarTrajectory,
  type OrganicEntry,
  type SpendEntry,
  type UsersTargetSource,
} from "@/lib/growth-command-center";

export type GrowthChartMetric = "users" | "captures" | "socialViews" | "searchClicks";
export type GrowthWeek = {
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
export type GrowthPlan = {
  month: string;
  targets: GrowthTargets;
  adSpendCurrency?: string | null;
  adSpendOverride?: boolean;
  usersOverride?: boolean;
  generatedUsers?: number | null;
  usersTargetSource?: UsersTargetSource;
  weeklyTargets: GrowthWeek[];
  weeklyActionPlans: GrowthActionPlan[];
};
export type GrowthDaily = {
  date: string;
  day: number;
  users: number;
  captures: number;
  hasMarketingEntry?: boolean;
  spendEntries?: SpendEntry[];
  organicEntries?: OrganicEntry[];
  marketing: {
    date: string;
    socialViews: number;
    searchClicks: number;
    adSpend: number;
    paidUsers: number;
    shortVideos: number;
    seoPages: number;
    notes: string;
  };
};
export type GrowthFunnel = {
  activatedUsers: number;
  activationEligibleUsers?: number;
  activationRate: number | null;
  d1RetainedUsers: number;
  d1EligibleUsers?: number;
  d1RetentionRate: number | null;
  d7RetainedUsers: number;
  d7EligibleUsers?: number;
  d7RetentionRate: number | null;
  firstTimePurchasers: number;
  cohortFirstTimePurchasers: number;
  payerConversionRate: number | null;
  definitions: {
    activation: string;
    d1: string;
    d7: string;
    firstTimePurchasers: string;
    payerConversion: string;
    payingPro: string;
  };
  needsAttention: string[];
};
export type GrowthResult = {
  month: string;
  targets: GrowthTargets;
  actuals: GrowthTargets;
};
export type GrowthSnapshot = {
  source: string;
  periodStart: string;
  periodEnd: string;
  metric: string;
  value: number;
  currency: string | null;
  aggregationRole: "primary" | "supporting";
  metadata: unknown;
  capturedAt: string;
  notes: string;
};
export type GrowthData = {
  ok: boolean;
  month: string;
  timezone: string;
  today?: string;
  currentDay?: number;
  manualReportingThroughDay?: number;
  manualReportingThroughDate?: string | null;
  hasYesterdayMarketingEntry?: boolean;
  totalDays?: number;
  totalUsers?: number;
  northStar?: NorthStarGoal | null;
  trajectory?: NorthStarTrajectory | null;
  usersTargetSource?: UsersTargetSource;
  plannedPace?: number;
  requiredPace?: number;
  plan: GrowthPlan | null;
  previousPlan: GrowthPlan | null;
  payingProDefinition?: string;
  marketingSnapshotAggregationRule?: string;
  manualDailyEntryCount?: number;
  actuals?: GrowthTargets;
  adSpendByCurrency?: Record<string, number>;
  funnel?: GrowthFunnel;
  collectorAnalytics?: CollectorAnalytics;
  marketingSnapshots?: GrowthSnapshot[];
  primaryMarketingSnapshots?: GrowthSnapshot[];
  daily?: GrowthDaily[];
  socialPages?: Array<{
    id: string;
    platform: string;
    page_name: string;
    description: string;
    posts_per_day: number;
    active: boolean;
    notes: string;
  }>;
  socialIdeaHistory?: Array<{
    id: string;
    idea_date: string;
    page_name: string;
    platform: string;
    title: string;
    hook: string;
    length_seconds: number;
    tips: string;
    status: string;
    completed_at: string | null;
    projected_views_24h: number;
    projection_confidence: string;
    projection_reason: string;
    actual_views_24h: number | null;
    measured_at: string | null;
  }>;
  weeklyActuals?: Array<{
    label: string;
    startDay: number;
    endDay: number;
    actuals: GrowthTargets;
    adSpendByCurrency?: Record<string, number>;
  }>;
  monthResult?: GrowthResult | null;
  previousMonthResult?: GrowthResult | null;
  error?: string;
};

