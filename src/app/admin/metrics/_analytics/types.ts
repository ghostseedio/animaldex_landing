import type { ContentReport } from "@/lib/content-analytics";
import type { WebFunnelSummary } from "@/lib/web-funnel";
import type { ActivityKind, AnalyticsReport, Platform } from "@/lib/product-analytics";

export type SearchPageRow = { page: string; clicks: number; previousClicks: number; impressions: number; ctr: number; position: number };

/** GET /api/admin/analytics */
export type AnalyticsResponse = AnalyticsReport & {
  ok: true;
  today: string;
  generatedAt: string;
  coverage: Partial<Record<ActivityKind, string>>;
  versions: Array<{ platform: Platform; version: string; users: number; activeUsers30d: number }>;
  push: { nativeActive30d: number; optedIn: number; byPlatform: Record<"ios" | "android", { users: number; optedIn: number }> };
  annotations: Array<{ id: string; day: string; platform: Platform | null; label: string }>;
  search: { pages: SearchPageRow[]; totals: { clicks: number; impressions: number }; previousTotals: { clicks: number; impressions: number }; note: string | null };
  content: ContentReport;
  /** The home hero test's funnel (web_funnel_events), by variant. */
  funnel: WebFunnelSummary & { splitB: number; note: string | null };
  notes: string[];
};

export type SeriesRow = AnalyticsResponse["series"][number];
export type PeriodSummary = AnalyticsResponse["current"];

export type MetricsTab = "overview" | "acquisition" | "engagement" | "retention" | "content" | "revenue" | "releases" | "ark";
export const metricsTabs: Array<{ value: MetricsTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "acquisition", label: "Acquisition" },
  { value: "engagement", label: "Engagement" },
  { value: "retention", label: "Retention" },
  { value: "content", label: "Blog & social" },
  { value: "revenue", label: "Revenue" },
  { value: "releases", label: "Releases" },
  { value: "ark", label: "Ark" },
];
