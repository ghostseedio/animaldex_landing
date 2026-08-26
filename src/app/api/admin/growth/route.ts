import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";
import {resolveAdminActor} from "@/lib/support-admin-auth";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {
    GrowthActionPlan,
    GrowthDailyMarketing,
    GrowthWeeklyTarget,
    dateKeyForDay,
    daysInMonth,
    growthTimezone,
    jakartaDayBounds,
    monthDateKeys,
    monthKey,
    monthStart,
    normalizeActionPlans,
    normalizeTargets,
    normalizeWeeklyTargets,
    splitMonthlyTargetsByCalendarWeeks,
    todayKey,
    type GrowthTargets
} from "@/lib/growth-command-center";

type PlanRow = {month: string; targets: unknown; weekly_targets: unknown; weekly_action_plans: unknown; created_at: string; updated_at: string};
type MarketingRow = {date: string; social_views: number | string | null; search_clicks: number | string | null; ad_spend: number | string | null; paid_users: number | string | null; notes: string | null; updated_at: string; updated_by: string | null};
type DatedRow = {created_at?: string; purchase_date?: string; product_id?: string; product_code?: string; environment?: string};
type LoadedPlan = {
    month: string;
    targets: GrowthTargets;
    weeklyTargets: GrowthWeeklyTarget[];
    weeklyActionPlans: GrowthActionPlan[];
    createdAt?: string;
    updatedAt?: string;
};

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase growth access is not configured");
    return {url, key};
}

async function fetchRows<T>(table: string, query: string): Promise<T[]> {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${table} query failed (${response.status}): ${await response.text()}`);
    return await response.json() as T[];
}

async function writeRows<T>(table: string, body: unknown, query = ""): Promise<T[]> {
    const {url, key} = config();
    const suffix = query ? `?${query}` : "";
    const response = await fetch(`${url}/rest/v1/${table}${suffix}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {
            "Content-Type": "application/json",
            Accept: "application/json",
            Prefer: "resolution=merge-duplicates,return=representation"
        }),
        body: JSON.stringify(body),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${table} write failed (${response.status}): ${await response.text()}`);
    return await response.json() as T[];
}

async function countRows(table: string, query = "") {
    const {url, key} = config();
    const suffix = query ? `?${query}` : "";
    const response = await fetch(`${url}/rest/v1/${table}${suffix}`, {
        method: "HEAD",
        headers: getSupabaseHeaders(key, {Prefer: "count=exact"}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${table} count failed (${response.status}): ${await response.text()}`);
    return Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
}

function toMarketing(row: MarketingRow): GrowthDailyMarketing {
    return {
        date: row.date,
        socialViews: Number(row.social_views ?? 0),
        searchClicks: Number(row.search_clicks ?? 0),
        adSpend: Number(row.ad_spend ?? 0),
        paidUsers: Number(row.paid_users ?? 0),
        notes: row.notes ?? ""
    };
}

function aggregateByDay(rows: DatedRow[], dateField: "created_at" | "purchase_date", month: string) {
    const counts = Object.fromEntries(monthDateKeys(month).map((date) => [date, 0])) as Record<string, number>;
    for (const row of rows) {
        const value = row[dateField];
        if (!value) continue;
        const key = todayKey(new Date(value));
        if (key in counts) counts[key] += 1;
    }
    return counts;
}

function sumThrough(counts: Record<string, number>, dateKeys: string[], throughDay: number) {
    return dateKeys.slice(0, throughDay).reduce((sum, date) => sum + (counts[date] ?? 0), 0);
}

function sumRange(counts: Record<string, number>, month: string, startDay: number, endDay: number) {
    let sum = 0;
    for (let day = startDay; day <= endDay; day += 1) sum += counts[dateKeyForDay(month, day)] ?? 0;
    return sum;
}

async function loadPlan(month: string): Promise<LoadedPlan | null> {
    const rows = await fetchRows<PlanRow>("growth_monthly_plans", `select=month,targets,weekly_targets,weekly_action_plans,created_at,updated_at&month=eq.${monthStart(month)}&limit=1`);
    const row = rows[0];
    if (!row) return null;
    return {
        month,
        targets: normalizeTargets(row.targets as Partial<GrowthTargets>),
        weeklyTargets: normalizeWeeklyTargets(row.weekly_targets),
        weeklyActionPlans: normalizeActionPlans(row.weekly_action_plans),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function loadMonthActuals(selectedMonth: string, throughDay?: number) {
    const totalDays = daysInMonth(selectedMonth);
    const dates = monthDateKeys(selectedMonth);
    const dayLimit = throughDay ?? totalDays;
    const {startIso} = jakartaDayBounds(dates[0]);
    const {endIso} = jakartaDayBounds(dates[dates.length - 1]);
    const [profiles, captures, activeProActual, marketingRows] = await Promise.all([
        fetchRows<DatedRow>("profiles", `select=created_at&created_at=gte.${encodeURIComponent(startIso)}&created_at=lte.${encodeURIComponent(endIso)}&order=created_at.asc`),
        fetchRows<DatedRow>("captures", `select=created_at&created_at=gte.${encodeURIComponent(startIso)}&created_at=lte.${encodeURIComponent(endIso)}&order=created_at.asc`),
        countRows("profiles", "select=id&is_pro=eq.true"),
        fetchRows<MarketingRow>("growth_marketing_daily", `select=date,social_views,search_clicks,ad_spend,paid_users,notes,updated_at,updated_by&date=gte.${dates[0]}&date=lte.${dates[dates.length - 1]}&order=date.asc`)
    ]);
    const userDaily = aggregateByDay(profiles, "created_at", selectedMonth);
    const captureDaily = aggregateByDay(captures, "created_at", selectedMonth);
    const manualByDate = Object.fromEntries(marketingRows.map((row) => [row.date, toMarketing(row)])) as Record<string, GrowthDailyMarketing>;
    const socialDaily = Object.fromEntries(dates.map((date) => [date, manualByDate[date]?.socialViews ?? 0]));
    const searchDaily = Object.fromEntries(dates.map((date) => [date, manualByDate[date]?.searchClicks ?? 0]));
    const adSpendDaily = Object.fromEntries(dates.map((date) => [date, manualByDate[date]?.adSpend ?? 0]));
    const actuals = {
        users: sumThrough(userDaily, dates, dayLimit),
        captures: sumThrough(captureDaily, dates, dayLimit),
        socialViews: sumThrough(socialDaily, dates, dayLimit),
        searchClicks: sumThrough(searchDaily, dates, dayLimit),
        activePro: activeProActual,
        adSpend: sumThrough(adSpendDaily, dates, dayLimit)
    };
    return {dates, userDaily, captureDaily, manualByDate, socialDaily, searchDaily, adSpendDaily, actuals};
}

export async function GET(request: NextRequest) {
    const actor = await resolveAdminActor(cookies());
    if (!actor.authorized) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});

    try {
        const requestedMonth = request.nextUrl.searchParams.get("month");
        const selectedMonth = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : monthKey(new Date());
        const plan = await loadPlan(selectedMonth);
        const previousPlans = await fetchRows<PlanRow>("growth_monthly_plans", `select=month,targets,weekly_targets,weekly_action_plans,created_at,updated_at&month=lt.${monthStart(selectedMonth)}&order=month.desc&limit=1`);
        const previousPlan = previousPlans[0] ? {
            month: previousPlans[0].month.slice(0, 7),
            targets: normalizeTargets(previousPlans[0].targets as Partial<GrowthTargets>),
            weeklyTargets: normalizeWeeklyTargets(previousPlans[0].weekly_targets),
            weeklyActionPlans: normalizeActionPlans(previousPlans[0].weekly_action_plans)
        } : null;

        const totalDays = daysInMonth(selectedMonth);
        const dates = monthDateKeys(selectedMonth);
        const nowKey = todayKey();
        const currentDay = selectedMonth === nowKey.slice(0, 7) ? Number(nowKey.slice(8, 10)) : selectedMonth < nowKey.slice(0, 7) ? totalDays : 0;
        const actualMonth = await loadMonthActuals(selectedMonth, currentDay || totalDays);
        const previousActuals = previousPlan ? await loadMonthActuals(previousPlan.month) : null;
        const weeklyTargets = plan ? plan.weeklyTargets.length ? plan.weeklyTargets : splitMonthlyTargetsByCalendarWeeks(selectedMonth, plan.targets) : [];

        return NextResponse.json({
            ok: true,
            month: selectedMonth,
            timezone: growthTimezone,
            today: nowKey,
            currentDay,
            totalDays,
            plan,
            previousPlan,
            payingProDefinition: "Current profiles where is_pro=true. This is not yet verified as active production-paying Pro subscribers.",
            actuals: actualMonth.actuals,
            monthResult: plan && currentDay >= totalDays ? {month: selectedMonth, targets: plan.targets, actuals: actualMonth.actuals} : null,
            previousMonthResult: previousPlan && previousActuals ? {month: previousPlan.month, targets: previousPlan.targets, actuals: previousActuals.actuals} : null,
            daily: dates.map((date, index) => ({
                date,
                day: index + 1,
                users: actualMonth.userDaily[date] ?? 0,
                captures: actualMonth.captureDaily[date] ?? 0,
                marketing: actualMonth.manualByDate[date] ?? {date, socialViews: 0, searchClicks: 0, adSpend: 0, paidUsers: 0, notes: ""}
            })),
            weeklyActuals: weeklyTargets.map((week) => ({
                label: week.label,
                startDay: week.startDay,
                endDay: week.endDay,
                actuals: {
                    users: sumRange(actualMonth.userDaily, selectedMonth, week.startDay, week.endDay),
                    captures: sumRange(actualMonth.captureDaily, selectedMonth, week.startDay, week.endDay),
                    socialViews: sumRange(actualMonth.socialDaily, selectedMonth, week.startDay, week.endDay),
                    searchClicks: sumRange(actualMonth.searchDaily, selectedMonth, week.startDay, week.endDay),
                    activePro: actualMonth.actuals.activePro,
                    adSpend: sumRange(actualMonth.adSpendDaily, selectedMonth, week.startDay, week.endDay)
                }
            }))
        });
    } catch (error) {
        console.error("[admin-growth]", error);
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to load growth plan"}, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    const actor = await resolveAdminActor(cookies());
    if (!actor.authorized) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});

    try {
        const body = await request.json() as {action?: string; month?: string; targets?: Partial<GrowthTargets>; weeklyTargets?: GrowthWeeklyTarget[]; weeklyActionPlans?: GrowthActionPlan[]; date?: string; marketing?: Partial<GrowthDailyMarketing>};
        if (body.action === "save-plan") {
            if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) throw new Error("Invalid month");
            const rows = await writeRows<PlanRow>("growth_monthly_plans", {
                month: monthStart(body.month),
                targets: normalizeTargets(body.targets),
                weekly_targets: normalizeWeeklyTargets(body.weeklyTargets),
                weekly_action_plans: normalizeActionPlans(body.weeklyActionPlans),
                updated_at: new Date().toISOString()
            }, "on_conflict=month");
            return NextResponse.json({ok: true, plan: rows[0]});
        }
        if (body.action === "save-marketing") {
            if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new Error("Invalid date");
            const marketing = body.marketing ?? {};
            const rows = await writeRows<MarketingRow>("growth_marketing_daily", {
                date: body.date,
                social_views: Math.max(0, Math.round(Number(marketing.socialViews ?? 0))),
                search_clicks: Math.max(0, Math.round(Number(marketing.searchClicks ?? 0))),
                ad_spend: Math.max(0, Number(marketing.adSpend ?? 0)).toFixed(2),
                paid_users: Math.max(0, Math.round(Number(marketing.paidUsers ?? 0))),
                notes: String(marketing.notes ?? "").slice(0, 2000),
                updated_at: new Date().toISOString(),
                updated_by: actor.email ?? actor.kind
            }, "on_conflict=date");
            return NextResponse.json({ok: true, marketing: rows[0]});
        }
        return NextResponse.json({ok: false, error: "Unknown action"}, {status: 400});
    } catch (error) {
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to save growth data"}, {status: 400});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
