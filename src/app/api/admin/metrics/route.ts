import { NextRequest, NextResponse } from "next/server";
import { isSupportAdminRequestAuthorized } from "@/lib/support-admin-auth";
import {
  getSupabaseHeaders,
  getSupabaseServiceKey,
  getSupabaseUrl,
} from "@/lib/supabase-http";
import {
  daysInMonth,
  jakartaMonthBounds,
  parseGrowthMonth,
  shiftMonth,
} from "@/lib/growth-command-center";

type Period = "hour" | "day" | "week" | "month";
type MetricRow = {
  created_at?: string;
  delta?: number;
  reason?: string;
  product_id?: string;
  product_code?: string;
  environment?: string;
};

const DAY_MS = 86400000;

function supabaseConfig() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key)
    throw new Error("Supabase metrics access is not configured");
  return { url, key };
}

async function fetchRows<T>(table: string, query: string): Promise<T[]> {
  const { url, key } = supabaseConfig();
  const rows: T[] = [];
  let offset = 0;

  while (offset < 100000) {
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
    offset += 1000;
  }
  return rows;
}

async function countRows(table: string, query = "") {
  const { url, key } = supabaseConfig();
  const suffix = query ? `?${query}` : "";
  const response = await fetch(`${url}/rest/v1/${table}${suffix}`, {
    method: "HEAD",
    headers: getSupabaseHeaders(key, { Prefer: "count=exact" }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const range = response.headers.get("content-range");
  return Number(range?.split("/")[1] ?? 0);
}

function bucketKey(date: Date, start: Date, bucketMs: number) {
  return Math.floor((date.getTime() - start.getTime()) / bucketMs);
}

function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(request: NextRequest) {
  if (!(await isSupportAdminRequestAuthorized(request))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const requested = request.nextUrl.searchParams.get("period");
    const period: Period =
      requested === "hour" || requested === "week" || requested === "month"
        ? requested
        : "day";
    const selectedMonth = parseGrowthMonth(
      request.nextUrl.searchParams.get("month"),
    );
    const bounds = jakartaMonthBounds(selectedMonth);
    const previousBounds = jakartaMonthBounds(shiftMonth(selectedMonth, -1));
    const start = new Date(bounds.startIso);
    const end = new Date(bounds.endExclusiveIso);
    const previousStart = new Date(previousBounds.startIso);
    const bucketMs = DAY_MS;
    const bucketCount = daysInMonth(selectedMonth);
    const dateFilter = `created_at=gte.${encodeURIComponent(previousStart.toISOString())}&created_at=lt.${encodeURIComponent(end.toISOString())}&order=created_at.asc`;

    const [
      profiles,
      captures,
      purchases,
      creditTransactions,
      totals,
    ] = await Promise.all([
      fetchRows<MetricRow>("profiles", `select=created_at&${dateFilter}`),
      fetchRows<MetricRow>("captures", `select=created_at&${dateFilter}`),
      fetchRows<MetricRow>(
        "app_store_purchases",
        `select=created_at,product_id,product_code,environment&${dateFilter}`,
      ),
      fetchRows<MetricRow>(
        "credit_transactions",
        `select=created_at,delta,reason&reason=eq.purchase&${dateFilter}`,
      ),
      Promise.all([
        countRows("profiles", "select=id"),
        countRows("captures", "select=id"),
        countRows("profiles", "select=id&is_pro=eq.true"),
        countRows(
          "app_store_purchases",
          "select=transaction_id&environment=eq.Production",
        ),
      ]),
    ]);

    const isCurrent = (row: MetricRow) =>
      new Date(row.created_at ?? 0) >= start &&
      new Date(row.created_at ?? 0) < end;
    const isPrevious = (row: MetricRow) =>
      new Date(row.created_at ?? 0) >= previousStart &&
      new Date(row.created_at ?? 0) < start;
    const isSubscription = (row: MetricRow) =>
      `${row.product_code} ${row.product_id}`.toLowerCase().includes("pro");
    const isProduction = (row: MetricRow) =>
      (row.environment ?? "").toLowerCase() === "production";
    const currentUsers = profiles.filter(isCurrent).length;
    const previousUsers = profiles.filter(isPrevious).length;
    const currentCaptures = captures.filter(isCurrent).length;
    const previousCaptures = captures.filter(isPrevious).length;
    const currentSubscriptions = purchases.filter(
      (row) => isCurrent(row) && isSubscription(row) && isProduction(row),
    ).length;
    const previousSubscriptions = purchases.filter(
      (row) => isPrevious(row) && isSubscription(row) && isProduction(row),
    ).length;
    const currentCredits = creditTransactions
      .filter(isCurrent)
      .reduce((sum, row) => sum + Math.max(0, row.delta ?? 0), 0);
    const previousCredits = creditTransactions
      .filter(isPrevious)
      .reduce((sum, row) => sum + Math.max(0, row.delta ?? 0), 0);
    const series = Array.from({ length: bucketCount }, (_, index) => {
      const bucketStart = new Date(start.getTime() + index * bucketMs);
      return {
        date: bucketStart.toISOString(),
        users: 0,
        captures: 0,
        subscriptions: 0,
        credits: 0,
      };
    });

    profiles.filter(isCurrent).forEach((row) => {
      const i = bucketKey(new Date(row.created_at!), start, bucketMs);
      if (series[i]) series[i].users += 1;
    });
    captures.filter(isCurrent).forEach((row) => {
      const i = bucketKey(new Date(row.created_at!), start, bucketMs);
      if (series[i]) series[i].captures += 1;
    });
    purchases
      .filter(
        (row) => isCurrent(row) && isSubscription(row) && isProduction(row),
      )
      .forEach((row) => {
        const i = bucketKey(new Date(row.created_at!), start, bucketMs);
        if (series[i]) series[i].subscriptions += 1;
      });
    creditTransactions.filter(isCurrent).forEach((row) => {
      const i = bucketKey(new Date(row.created_at!), start, bucketMs);
      if (series[i]) series[i].credits += Math.max(0, row.delta ?? 0);
    });

    return NextResponse.json({
      ok: true,
      period,
      month: selectedMonth,
      periodStart: bounds.startIso,
      periodEndExclusive: bounds.endExclusiveIso,
      generatedAt: new Date().toISOString(),
      totals: {
        users: totals[0],
        captures: totals[1],
        activePro: totals[2],
        productionPurchases: totals[3],
      },
      kpis: {
        users: {
          value: currentUsers,
          change: percentChange(currentUsers, previousUsers),
        },
        captures: {
          value: currentCaptures,
          change: percentChange(currentCaptures, previousCaptures),
        },
        subscriptions: {
          value: currentSubscriptions,
          change: percentChange(currentSubscriptions, previousSubscriptions),
        },
        credits: {
          value: currentCredits,
          change: percentChange(currentCredits, previousCredits),
        },
      },
      purchaseBreakdown: {
        production: purchases.filter(
          (row) => isCurrent(row) && isProduction(row),
        ).length,
        sandbox: purchases.filter((row) => isCurrent(row) && !isProduction(row))
          .length,
      },
      series,
    });
  } catch (error) {
    console.error("[admin-metrics]", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unable to load metrics",
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
