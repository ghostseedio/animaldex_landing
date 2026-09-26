import {
  getSupabaseHeaders,
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-http";
import {
  GrowthActionPlan,
  GrowthWeeklyTarget,
  OrganicEntry,
  SpendEntry,
  type GrowthTargets,
  type UsersTargetSource,
} from "@/lib/growth-command-center";

export type PlanRow = {
  month: string;
  targets: unknown;
  weekly_targets: unknown;
  weekly_action_plans: unknown;
  created_at: string;
  updated_at: string;
};
export type MarketingRow = {
  date: string;
  social_views: number | string | null;
  search_clicks: number | string | null;
  ad_spend: number | string | null;
  paid_users: number | string | null;
  short_videos?: number | string | null;
  seo_pages?: number | string | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
};
export type SpendRow = {
  date: string;
  platform: SpendEntry["platform"];
  amount: number | string;
  currency_code: string;
  os?: string | null;
  reported_installs?: number | string | null;
};
export type OrganicRow = {
  date: string;
  platform: OrganicEntry["platform"];
  posts: number | string;
  views: number | string;
};
export type SocialPageRow = {
  id: string;
  platform: string;
  page_name: string;
  description: string;
  active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};
export type SocialIdeaRow = {
  id: string;
  idea_date: string;
  page_name: string;
  platform: string;
  title: string;
  hook: string;
  length_seconds: number | string;
  tips: string;
  status: string;
  completed_at: string | null;
  projected_views_24h: number | string;
  projection_confidence: string;
  projection_reason: string;
  actual_views_24h: number | string | null;
  measured_at: string | null;
  created_at: string;
};
export type NorthStarRow = {
  id: string;
  target_users: number | string;
  target_date: string;
  growth_model: string;
  ramp_percent: number | string;
  updated_at?: string;
};
export type SnapshotRow = {
  source: string;
  period_start: string;
  period_end: string;
  metric: string;
  value: number | string;
  currency: string | null;
  aggregation_role?: "primary" | "supporting" | null;
  os?: string | null;
  metadata: unknown;
  captured_at: string;
  notes: string;
};
export type DatedRow = {
  id?: string;
  user_id?: string;
  created_at?: string;
  purchase_date?: string;
  product_id?: string;
  product_code?: string;
  environment?: string;
  status?: string;
};
export type LoadedPlan = {
  month: string;
  targets: GrowthTargets;
  storedUsers: number;
  adSpendCurrency: string | null;
  adSpendOverride: boolean;
  usersOverride: boolean;
  generatedUsers: number | null;
  usersTargetSource: UsersTargetSource;
  weeklyTargets: GrowthWeeklyTarget[];
  weeklyActionPlans: GrowthActionPlan[];
  createdAt?: string;
  updatedAt?: string;
};

export function config() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error("Supabase growth access is not configured");
  return { url, key };
}

export async function fetchRows<T>(table: string, query: string): Promise<T[]> {
  const { url, key } = config();
  const rows: T[] = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const response = await fetch(
      `${url}/rest/v1/${table}?${query}&limit=1000&offset=${offset}`,
      {
        headers: getSupabaseHeaders(key, { Accept: "application/json" }),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new Error(
        `${table} query failed (${response.status}): ${await response.text()}`,
      );
    const page = (await response.json()) as T[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export async function writeRows<T>(
  table: string,
  body: unknown,
  query = "",
): Promise<T[]> {
  const { url, key } = config();
  const suffix = query ? `?${query}` : "";
  const response = await fetch(`${url}/rest/v1/${table}${suffix}`, {
    method: "POST",
    headers: getSupabaseHeaders(key, {
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      `${table} write failed (${response.status}): ${await response.text()}`,
    );
  return (await response.json()) as T[];
}

export async function patchRows<T>(table: string, query: string, body: unknown) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: getSupabaseHeaders(key, {
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      `${table} update failed (${response.status}): ${await response.text()}`,
    );
  return (await response.json()) as T[];
}

export function isMissingColumnError(error: unknown, column: string) {
  return (
    error instanceof Error &&
    (error.message.includes("42703") || error.message.includes("PGRST204")) &&
    error.message.includes(column)
  );
}

export function isMissingTableError(error: unknown, table: string) {
  return (
    error instanceof Error &&
    (error.message.includes("42P01") || error.message.includes("PGRST205")) &&
    error.message.includes(table)
  );
}

export async function countRows(table: string, query = "") {
  const { url, key } = config();
  const suffix = query ? `?${query}` : "";
  const response = await fetch(`${url}/rest/v1/${table}${suffix}`, {
    method: "HEAD",
    headers: getSupabaseHeaders(key, { Prefer: "count=exact" }),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      `${table} count failed (${response.status}): ${await response.text()}`,
    );
  return Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
}
