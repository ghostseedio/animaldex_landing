import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveAdminActor } from "@/lib/support-admin-auth";
import {
  getSupabaseHeaders,
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-http";
import {
  GrowthActionPlan,
  GrowthDailyMarketing,
  GrowthWeeklyTarget,
  buildCollectorAnalytics,
  OrganicEntry,
  SpendEntry,
  dailyPaceTarget,
  dateKeyForDay,
  daysInMonth,
  deriveOrganicTotals,
  deriveShortVideoCount,
  generatedCaptureTarget,
  generatedOperatingTargets,
  generateNorthStarTrajectory,
  growthTimezone,
  jakartaDayBounds,
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
  resolveUsersTarget,
  rate,
  splitMonthlyTargetsByCalendarWeeks,
  todayKey,
  type GrowthTargets,
  type NorthStarGoal,
  type UsersTargetSource,
} from "@/lib/growth-command-center";

type PlanRow = {
  month: string;
  targets: unknown;
  weekly_targets: unknown;
  weekly_action_plans: unknown;
  created_at: string;
  updated_at: string;
};
type MarketingRow = {
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
type SpendRow = {
  date: string;
  platform: SpendEntry["platform"];
  amount: number | string;
  currency_code: string;
};
type OrganicRow = {
  date: string;
  platform: OrganicEntry["platform"];
  posts: number | string;
  views: number | string;
};
type SocialPageRow = {
  id: string;
  platform: string;
  page_name: string;
  description: string;
  active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
};
type SocialIdeaRow = {
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
type NorthStarRow = {
  id: string;
  target_users: number | string;
  target_date: string;
  growth_model: string;
  ramp_percent: number | string;
  updated_at?: string;
};
type SnapshotRow = {
  source: string;
  period_start: string;
  period_end: string;
  metric: string;
  value: number | string;
  currency: string | null;
  aggregation_role?: "primary" | "supporting" | null;
  metadata: unknown;
  captured_at: string;
  notes: string;
};
type DatedRow = {
  id?: string;
  user_id?: string;
  created_at?: string;
  purchase_date?: string;
  product_id?: string;
  product_code?: string;
  environment?: string;
  status?: string;
};
type LoadedPlan = {
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

function config() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error("Supabase growth access is not configured");
  return { url, key };
}

async function fetchRows<T>(table: string, query: string): Promise<T[]> {
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

async function writeRows<T>(
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

async function patchRows<T>(table: string, query: string, body: unknown) {
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

function isMissingColumnError(error: unknown, column: string) {
  return (
    error instanceof Error &&
    (error.message.includes("42703") || error.message.includes("PGRST204")) &&
    error.message.includes(column)
  );
}

function isMissingTableError(error: unknown, table: string) {
  return (
    error instanceof Error &&
    (error.message.includes("42P01") || error.message.includes("PGRST205")) &&
    error.message.includes(table)
  );
}

async function loadMarketingRows(startDate: string, endDate: string) {
  const filters = `date=gte.${startDate}&date=lte.${endDate}&order=date.asc`;
  try {
    return await fetchRows<MarketingRow>(
      "growth_marketing_daily",
      `select=date,social_views,search_clicks,ad_spend,paid_users,short_videos,seo_pages,notes,updated_at,updated_by&${filters}`,
    );
  } catch (error) {
    if (
      !isMissingColumnError(error, "short_videos") &&
      !isMissingColumnError(error, "seo_pages")
    )
      throw error;
    return await fetchRows<MarketingRow>(
      "growth_marketing_daily",
      `select=date,social_views,search_clicks,ad_spend,paid_users,notes,updated_at,updated_by&${filters}`,
    );
  }
}

async function loadSocialPages() {
  try {
    return await fetchRows<SocialPageRow>(
      "growth_social_pages",
      "select=id,platform,page_name,description,active,notes,created_at,updated_at&order=platform.asc,page_name.asc",
    );
  } catch (error) {
    if (isMissingTableError(error, "growth_social_pages")) return [];
    throw error;
  }
}

function withProjectionDefaults(row: SocialIdeaRow): SocialIdeaRow {
  return {
    ...row,
    projected_views_24h: Number(row.projected_views_24h ?? 0),
    projection_confidence: row.projection_confidence ?? "low",
    projection_reason: row.projection_reason ?? "",
    actual_views_24h:
      row.actual_views_24h == null ? null : Number(row.actual_views_24h),
    measured_at: row.measured_at ?? null,
  };
}

async function loadLegacySocialIdeaHistory(limit: number) {
  try {
    return await fetchRows<SocialIdeaRow>(
      "growth_social_idea_history",
      `select=id,idea_date,page_name,platform,title,hook,length_seconds,tips,status,completed_at,created_at&order=idea_date.desc,created_at.desc&limit=${limit}`,
    ).then((rows) => rows.map(withProjectionDefaults));
  } catch (error) {
    if (isMissingColumnError(error, "status")) {
      return await fetchRows<SocialIdeaRow>(
        "growth_social_idea_history",
        `select=id,idea_date,page_name,platform,title,hook,length_seconds,tips,created_at&order=idea_date.desc,created_at.desc&limit=${limit}`,
      ).then((rows) =>
        rows.map((row) => ({
          ...row,
          status: "suggested",
          completed_at: null,
        })).map(withProjectionDefaults),
      );
    }
    if (isMissingColumnError(error, "completed_at")) {
      try {
        return await fetchRows<SocialIdeaRow>(
          "growth_social_idea_history",
          `select=id,idea_date,page_name,platform,title,hook,length_seconds,tips,status,created_at&order=idea_date.desc,created_at.desc&limit=${limit}`,
        ).then((rows) =>
          rows
            .map((row) => ({ ...row, completed_at: null }))
            .map(withProjectionDefaults),
        );
      } catch (fallbackError) {
        if (!isMissingColumnError(fallbackError, "status"))
          throw fallbackError;
        return await fetchRows<SocialIdeaRow>(
          "growth_social_idea_history",
          `select=id,idea_date,page_name,platform,title,hook,length_seconds,tips,created_at&order=idea_date.desc,created_at.desc&limit=${limit}`,
        ).then((rows) =>
          rows.map((row) => ({
            ...row,
            status: "suggested",
            completed_at: null,
          })).map(withProjectionDefaults),
        );
      }
    }
    throw error;
  }
}

async function loadSocialIdeaHistory(limit = 200) {
  try {
    return await fetchRows<SocialIdeaRow>(
      "growth_social_idea_history",
      `select=id,idea_date,page_name,platform,title,hook,length_seconds,tips,status,completed_at,projected_views_24h,projection_confidence,projection_reason,actual_views_24h,measured_at,created_at&order=idea_date.desc,created_at.desc&limit=${limit}`,
    ).then((rows) => rows.map(withProjectionDefaults));
  } catch (error) {
    if (isMissingTableError(error, "growth_social_idea_history")) return [];
    if (
      [
        "status",
        "completed_at",
        "projected_views_24h",
        "projection_confidence",
        "projection_reason",
        "actual_views_24h",
        "measured_at",
      ].some((column) => isMissingColumnError(error, column))
    ) {
      return loadLegacySocialIdeaHistory(limit);
    }
    throw error;
  }
}

async function loadSpendRows(startDate: string, endDate: string) {
  try {
    return await fetchRows<SpendRow>(
      "growth_marketing_daily_spend",
      `select=date,platform,amount,currency_code&date=gte.${startDate}&date=lte.${endDate}&order=date.asc`,
    );
  } catch (error) {
    if (isMissingTableError(error, "growth_marketing_daily_spend")) return [];
    throw error;
  }
}

async function loadOrganicRows(startDate: string, endDate: string) {
  try {
    return await fetchRows<OrganicRow>(
      "growth_marketing_daily_organic",
      `select=date,platform,posts,views&date=gte.${startDate}&date=lte.${endDate}&order=date.asc`,
    );
  } catch (error) {
    if (isMissingTableError(error, "growth_marketing_daily_organic")) return [];
    throw error;
  }
}

async function loadNorthStar(): Promise<NorthStarGoal | null> {
  try {
    const rows = await fetchRows<NorthStarRow>(
      "growth_north_star",
      "select=id,target_users,target_date,growth_model,ramp_percent,updated_at&id=eq.default&limit=1",
    );
    const row = rows[0];
    if (!row) return null;
    return normalizeNorthStar({
      targetUsers: Number(row.target_users),
      targetDate: String(row.target_date).slice(0, 10),
      growthModel: row.growth_model === "linear" ? "linear" : "ramp",
      rampPercent: Number(row.ramp_percent),
    });
  } catch (error) {
    if (isMissingTableError(error, "growth_north_star")) return null;
    throw error;
  }
}

async function loadSnapshotRows(startDate: string, endDate: string) {
  const filters = `period_start=lte.${endDate}&period_end=gte.${startDate}&order=period_start.asc`;
  try {
    return await fetchRows<SnapshotRow>(
      "growth_marketing_snapshots",
      `select=source,period_start,period_end,metric,value,currency,aggregation_role,metadata,captured_at,notes&${filters}`,
    );
  } catch (error) {
    if (!isMissingColumnError(error, "aggregation_role")) throw error;
    return await fetchRows<SnapshotRow>(
      "growth_marketing_snapshots",
      `select=source,period_start,period_end,metric,value,currency,metadata,captured_at,notes&${filters}`,
    );
  }
}

async function writeMarketingRow(body: unknown) {
  try {
    return await writeRows<MarketingRow>(
      "growth_marketing_daily",
      body,
      "on_conflict=date",
    );
  } catch (error) {
    if (
      !isMissingColumnError(error, "short_videos") &&
      !isMissingColumnError(error, "seo_pages")
    )
      throw error;
    const {
      short_videos: _shortVideos,
      seo_pages: _seoPages,
      ...legacyBody
    } = body as Record<string, unknown>;
    return await writeRows<MarketingRow>(
      "growth_marketing_daily",
      legacyBody,
      "on_conflict=date",
    );
  }
}

async function writeSpendRows(date: string, entries: SpendEntry[]) {
  if (!entries.length) return [];
  try {
    return await writeRows<SpendRow>(
      "growth_marketing_daily_spend",
      entries.map((entry) => ({
        date,
        platform: entry.platform,
        amount: Math.max(0, Number(entry.amount)).toFixed(2),
        currency_code: entry.currencyCode,
        updated_at: new Date().toISOString(),
      })),
      "on_conflict=date,platform,currency_code",
    );
  } catch (error) {
    if (isMissingTableError(error, "growth_marketing_daily_spend")) return [];
    throw error;
  }
}

async function deleteSpendRows(date: string) {
  const { url, key } = config();
  const response = await fetch(
    `${url}/rest/v1/growth_marketing_daily_spend?date=eq.${date}`,
    {
      method: "DELETE",
      headers: getSupabaseHeaders(key, { Accept: "application/json" }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const text = await response.text();
    if (
      response.status === 404 ||
      text.includes("PGRST205") ||
      text.includes("42P01")
    )
      return;
    throw new Error(
      `growth_marketing_daily_spend delete failed (${response.status}): ${text}`,
    );
  }
}

async function writeOrganicRows(date: string, entries: OrganicEntry[]) {
  if (!entries.length) return [];
  try {
    return await writeRows<OrganicRow>(
      "growth_marketing_daily_organic",
      entries.map((entry) => ({
        date,
        platform: entry.platform,
        posts: Math.max(0, Math.round(entry.posts)),
        views: Math.max(0, Math.round(entry.views)),
        updated_at: new Date().toISOString(),
      })),
      "on_conflict=date,platform",
    );
  } catch (error) {
    if (isMissingTableError(error, "growth_marketing_daily_organic")) return [];
    throw error;
  }
}

async function deleteOrganicRows(date: string) {
  const { url, key } = config();
  const response = await fetch(
    `${url}/rest/v1/growth_marketing_daily_organic?date=eq.${date}`,
    {
      method: "DELETE",
      headers: getSupabaseHeaders(key, { Accept: "application/json" }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const text = await response.text();
    if (
      response.status === 404 ||
      text.includes("PGRST205") ||
      text.includes("42P01")
    )
      return;
    throw new Error(
      `growth_marketing_daily_organic delete failed (${response.status}): ${text}`,
    );
  }
}

async function countRows(table: string, query = "") {
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

function toMarketing(row: MarketingRow): GrowthDailyMarketing {
  return {
    date: row.date,
    socialViews: Number(row.social_views ?? 0),
    searchClicks: Number(row.search_clicks ?? 0),
    adSpend: Number(row.ad_spend ?? 0),
    paidUsers: Number(row.paid_users ?? 0),
    shortVideos: Number(row.short_videos ?? 0),
    seoPages: Number(row.seo_pages ?? 0),
    notes: row.notes ?? "",
  };
}

function toSpendEntry(row: SpendRow): SpendEntry {
  return {
    platform: row.platform,
    amount: Number(row.amount ?? 0),
    currencyCode: row.currency_code,
  };
}

function normalizeCurrency(value: unknown) {
  const currency = String(value ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function normalizeSpendBudget(target: number, currencyCode?: string | null) {
  if (currencyCode === "IDR" && target > 0 && target < 1000) return target * 1000;
  return target;
}

type SocialIdeaGenerationInput = {
  pages: Array<{
    id: string;
    platform: string;
    pageName: string;
    description: string;
    notes: string;
  }>;
  history: Array<{
    pageName: string;
    platform: string;
    title: string;
    hook: string;
    lengthSeconds: number;
    tips: string;
    status: string;
    projectedViews24h: number;
    actualViews24h: number | null;
  }>;
  dayLabel: string;
  totalIdeas: number;
};

async function generateSocialIdeas(input: SocialIdeaGenerationInput) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for this environment");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.7,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "growth_social_ideas",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ideas: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    pageName: { type: "string" },
                    platform: { type: "string" },
                    title: { type: "string" },
                    hook: { type: "string" },
                    lengthSeconds: { type: "integer" },
                    postType: { type: "string" },
                    tips: { type: "string" },
                    projectedViews24h: { type: "integer" },
                    projectionConfidence: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                    projectionReason: { type: "string" },
                  },
                  required: [
                    "pageName",
                    "platform",
                    "title",
                    "hook",
                    "lengthSeconds",
                    "postType",
                    "tips",
                    "projectedViews24h",
                    "projectionConfidence",
                    "projectionReason",
                  ],
                },
              },
            },
            required: ["ideas"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: [
            "You generate social post ideas for an admin dashboard.",
            "Voice: practical, specific, and brief.",
            "Use the supplied pages and descriptions as the source of truth.",
            "Never repeat a history title whose status is completed; unfinished suggestions may be revisited.",
            "Use history rows with actualViews24h to identify page-specific winning topics, hooks, formats, and lengths.",
            "Prefer new titles that apply patterns from higher-performing measured posts, while varying the subject and avoiding close copies.",
            "Estimate projectedViews24h for each idea using comparable measured rows from the same page and platform when available.",
            "Use low projection confidence when fewer than 5 measured rows are available for that page, medium for 5-19, and high only with at least 20 relevant measured rows.",
            "Do not imply that a projection is guaranteed or fabricate historical performance.",
            "Keep projectionReason brief and name the measured pattern or cold-start assumption used.",
            "Vary post type, length, and angle across the set.",
            "Return ideas for only the requested totalIdeas count.",
            "Each idea must fit the page description and platform.",
            "Suggest a length in seconds and one or two concise tips.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  const payload = await response.json() as {choices?: Array<{message?: {content?: string}}>};
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The model returned nothing to read");
  return JSON.parse(content) as {
    ideas: Array<{
      pageName: string;
      platform: string;
      title: string;
      hook: string;
      lengthSeconds: number;
      postType: string;
      tips: string;
      projectedViews24h: number;
      projectionConfidence: "low" | "medium" | "high";
      projectionReason: string;
    }>;
  };
}

type SocialIdeaProjectionBackfillInput = {
  pages: Array<{
    id: string;
    platform: string;
    pageName: string;
    description: string;
    notes: string;
  }>;
  history: Array<{
    pageName: string;
    platform: string;
    title: string;
    hook: string;
    lengthSeconds: number;
    tips: string;
    status: string;
    projectedViews24h: number;
    actualViews24h: number | null;
  }>;
  ideas: Array<{
    id: string;
    pageName: string;
    platform: string;
    title: string;
    hook: string;
    lengthSeconds: number;
    tips: string;
  }>;
  dayLabel: string;
};

async function backfillSocialIdeaProjections(
  input: SocialIdeaProjectionBackfillInput,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for this environment");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.4,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "growth_social_projection_backfill",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              ideas: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    projectedViews24h: { type: "integer" },
                    projectionConfidence: {
                      type: "string",
                      enum: ["low", "medium", "high"],
                    },
                    projectionReason: { type: "string" },
                  },
                  required: [
                    "id",
                    "projectedViews24h",
                    "projectionConfidence",
                    "projectionReason",
                  ],
                },
              },
            },
            required: ["ideas"],
          },
        },
      },
      messages: [
        {
          role: "system",
          content: [
            "You estimate 24-hour view projections for existing social post ideas.",
            "Voice: practical, specific, and brief.",
            "Use the supplied pages and descriptions as the source of truth.",
            "Use history rows with actualViews24h to identify page-specific winning topics, hooks, formats, and lengths.",
            "Never change the supplied idea ids, titles, hooks, or page names.",
            "Return one projection for every supplied idea id exactly once.",
            "Estimate projectedViews24h using measured history from the same page and platform when available.",
            "Use low projection confidence when fewer than 5 measured rows are available for that page, medium for 5-19, and high only with at least 20 relevant measured rows.",
            "Keep projectionReason brief and mention the pattern or assumption used.",
            "Do not output zeros for unresolved ideas unless the idea is truly expected to have no 24-hour traction.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `OpenAI request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The model returned nothing to read");
  return JSON.parse(content) as {
    ideas: Array<{
      id: string;
      projectedViews24h: number;
      projectionConfidence: "low" | "medium" | "high";
      projectionReason: string;
    }>;
  };
}

function aggregateByDay(
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

function sumThrough(
  counts: Record<string, number>,
  dateKeys: string[],
  throughDay: number,
) {
  return dateKeys
    .slice(0, throughDay)
    .reduce((sum, date) => sum + (counts[date] ?? 0), 0);
}

function sumRange(
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

function sumRangeThrough(
  counts: Record<string, number>,
  month: string,
  startDay: number,
  endDay: number,
  throughDay: number,
) {
  if (throughDay < startDay) return 0;
  return sumRange(counts, month, startDay, Math.min(endDay, throughDay));
}

function sumSpendRangeByCurrency(
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

function comparableMonthlySpend(
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

function planMeta(targets: Record<string, unknown> | null | undefined) {
  const generatedUsers = Number(targets?.generatedUsers);
  return {
    usersOverride: targets?.usersOverride === true,
    generatedUsers:
      Number.isFinite(generatedUsers) && generatedUsers > 0
        ? generatedUsers
        : null,
  };
}

function toLoadedPlan(
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

async function loadPlan(
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

async function loadMonthActuals(
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
      const spendEntries = Array.isArray(marketing.spendEntries)
        ? marketing.spendEntries.flatMap((entry) => {
            const currencyCode = normalizeCurrency(entry.currencyCode);
            const platform = String(entry.platform);
            const amount = Number(entry.amount);
            if (
              !currencyCode ||
              ![
                "google_ads",
                "tiktok_ads",
                "apple_search_ads",
                "meta_ads",
                "other",
              ].includes(platform) ||
              !Number.isFinite(amount) ||
              amount < 0
            )
              return [];
            return [
              {
                platform: platform as SpendEntry["platform"],
                currencyCode,
                amount,
              },
            ];
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
