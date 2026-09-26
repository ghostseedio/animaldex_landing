import {
  getSupabaseHeaders,
} from "@/lib/supabase-http";
import {
  GrowthDailyMarketing,
  defaultOsForNetwork,
  spendOsOptions,
  type SpendOs,
  OrganicEntry,
  SpendEntry,
  normalizeNorthStar,
  type NorthStarGoal,
} from "@/lib/growth-command-center";
import {
  classifyPurchaseStore,
  type PurchaseLedgerRow,
  type UserGrowthRow,
} from "@/lib/growth-attribution";
import {
  type MarketingRow,
  type SpendRow,
  type OrganicRow,
  type SocialPageRow,
  type SocialIdeaRow,
  type NorthStarRow,
  type SnapshotRow,
  config,
  fetchRows,
  writeRows,
  isMissingColumnError,
  isMissingTableError,
} from "./rows";

export async function loadMarketingRows(startDate: string, endDate: string) {
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

export async function loadSocialPages() {
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

export function withProjectionDefaults(row: SocialIdeaRow): SocialIdeaRow {
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

export async function loadLegacySocialIdeaHistory(limit: number) {
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

export async function loadSocialIdeaHistory(limit = 200) {
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

export async function loadSpendRows(startDate: string, endDate: string) {
  const filters = `date=gte.${startDate}&date=lte.${endDate}&order=date.asc`;
  try {
    return await fetchRows<SpendRow>(
      "growth_marketing_daily_spend",
      `select=date,platform,amount,currency_code,os,reported_installs&${filters}`,
    );
  } catch (error) {
    if (isMissingTableError(error, "growth_marketing_daily_spend")) return [];
    if (
      !isMissingColumnError(error, "os") &&
      !isMissingColumnError(error, "reported_installs")
    )
      throw error;
    return await fetchRows<SpendRow>(
      "growth_marketing_daily_spend",
      `select=date,platform,amount,currency_code&${filters}`,
    );
  }
}

export async function loadOrganicRows(startDate: string, endDate: string) {
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

export async function loadNorthStar(): Promise<NorthStarGoal | null> {
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

export async function loadSnapshotRows(startDate: string | null, endDate: string | null) {
  const filters = [
    endDate ? `period_start=lte.${endDate}` : "",
    startDate ? `period_end=gte.${startDate}` : "",
    "order=period_start.asc",
  ]
    .filter(Boolean)
    .join("&");
  const base = "source,period_start,period_end,metric,value,currency,metadata,captured_at,notes";
  let lastError: unknown = null;
  for (const extra of [",aggregation_role,os", ",aggregation_role", ""]) {
    try {
      return await fetchRows<SnapshotRow>(
        "growth_marketing_snapshots",
        `select=${base}${extra}&${filters}`,
      );
    } catch (error) {
      if (
        !isMissingColumnError(error, "os") &&
        !isMissingColumnError(error, "aggregation_role")
      )
        throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export async function writeMarketingRow(body: unknown) {
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

export async function writeSpendRows(date: string, entries: SpendEntry[]) {
  if (!entries.length) return [];
  // The day's rows are deleted first, so a plain insert works with both the old
  // (date, platform, currency) and the new (date, platform, os, currency) keys.
  const rows = entries.map((entry) => ({
    date,
    platform: entry.platform,
    amount: Math.max(0, Number(entry.amount)).toFixed(2),
    currency_code: entry.currencyCode,
    os: entry.os ?? defaultOsForNetwork(entry.platform),
    reported_installs: entry.reportedInstalls ?? null,
    updated_at: new Date().toISOString(),
  }));
  try {
    return await writeRows<SpendRow>("growth_marketing_daily_spend", rows);
  } catch (error) {
    if (isMissingTableError(error, "growth_marketing_daily_spend")) return [];
    if (
      !isMissingColumnError(error, "os") &&
      !isMissingColumnError(error, "reported_installs")
    )
      throw error;
    return await writeRows<SpendRow>(
      "growth_marketing_daily_spend",
      rows.map(({ os: _os, reported_installs: _installs, ...legacy }) => legacy),
    );
  }
}

export async function deleteSpendRows(date: string) {
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

export async function writeOrganicRows(date: string, entries: OrganicEntry[]) {
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

export async function deleteOrganicRows(date: string) {
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

export function toMarketing(row: MarketingRow): GrowthDailyMarketing {
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

export function toSpendEntry(row: SpendRow): SpendEntry {
  return {
    platform: row.platform,
    amount: Number(row.amount ?? 0),
    currencyCode: row.currency_code,
    os: spendOsOptions.includes(row.os as SpendOs)
      ? (row.os as SpendOs)
      : defaultOsForNetwork(row.platform),
    reportedInstalls:
      row.reported_installs == null ? null : Number(row.reported_installs),
  };
}

export function normalizeCurrency(value: unknown) {
  const currency = String(value ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

export function normalizeSpendBudget(target: number, currencyCode?: string | null) {
  if (currencyCode === "IDR" && target > 0 && target < 1000) return target * 1000;
  return target;
}

export async function loadUserGrowthRows(): Promise<UserGrowthRow[] | null> {
  try {
    return await fetchRows<UserGrowthRow>(
      "admin_user_growth_v1",
      "select=user_id,created_at,first_reported_platform,first_reported_at,reported_platforms,has_apns_token,has_app_store_purchase,has_play_purchase,auth_providers,self_reported_source,utm_source,utm_medium,utm_campaign,gclid,apple_ads_attributed&order=created_at.asc",
    );
  } catch (error) {
    if (isMissingTableError(error, "admin_user_growth_v1")) return null;
    throw error;
  }
}

/** Every purchase from the credit ledger, plus fulfilled web purchases the ledger doesn't cover. */
export async function loadPurchaseLedger(): Promise<PurchaseLedgerRow[]> {
  const ledger = await fetchRows<{
    user_id: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>(
    "credit_transactions",
    "select=user_id,created_at,metadata&reason=eq.purchase&order=created_at.asc",
  );
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const rows: PurchaseLedgerRow[] = ledger.map((row) => ({
    userId: String(row.user_id),
    createdAt: row.created_at,
    source: text(row.metadata?.source),
    productCode: text(row.metadata?.product_code),
    environment: text(row.metadata?.environment),
    testPurchase: row.metadata?.test_purchase === true,
  }));
  if (rows.some((row) => classifyPurchaseStore(row) === "web")) return rows;
  let web: Array<{
    user_id: string;
    created_at: string;
    provider: string;
    product_code: string;
    fulfilled_at: string | null;
  }> = [];
  try {
    web = await fetchRows(
      "web_purchases",
      "select=user_id,created_at,provider,product_code,fulfilled_at&purchase_state=eq.fulfilled",
    );
  } catch {
    web = [];
  }
  return [
    ...rows,
    ...web.map((row) => ({
      userId: String(row.user_id),
      createdAt: row.fulfilled_at ?? row.created_at,
      source: row.provider,
      productCode: row.product_code,
      environment: null,
      testPurchase: false,
    })),
  ];
}
