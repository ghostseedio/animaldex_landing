import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

type Period = "day" | "week" | "month";
type MetricRow = {created_at?: string; delta?: number; reason?: string; product_id?: string; product_code?: string; environment?: string};
type PostType = "captures" | "alignments" | "fusions" | "challenges" | "trades";
type PostMetricRow = {date?: string};

const periodConfig: Record<Period, {days: number; bucketDays: number}> = {
    day: {days: 30, bucketDays: 1},
    week: {days: 84, bucketDays: 7},
    month: {days: 365, bucketDays: 30}
};

function supabaseConfig() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase metrics access is not configured");
    return {url, key};
}

async function fetchRows<T>(table: string, query: string): Promise<T[]> {
    const {url, key} = supabaseConfig();
    const rows: T[] = [];
    let offset = 0;

    while (offset < 100000) {
        const response = await fetch(`${url}/rest/v1/${table}?${query}&limit=1000&offset=${offset}`, {
            headers: getSupabaseHeaders(key, {Accept: "application/json"}),
            cache: "no-store"
        });
        if (!response.ok) throw new Error(`${table} query failed (${response.status}): ${await response.text()}`);
        const page = await response.json() as T[];
        rows.push(...page);
        if (page.length < 1000) break;
        offset += 1000;
    }
    return rows;
}

async function countRows(table: string, query = "") {
    const {url, key} = supabaseConfig();
    const suffix = query ? `?${query}` : "";
    const response = await fetch(`${url}/rest/v1/${table}${suffix}`, {
        method: "HEAD",
        headers: getSupabaseHeaders(key, {Prefer: "count=exact"}),
        cache: "no-store"
    });
    if (!response.ok) return null;
    const range = response.headers.get("content-range");
    return Number(range?.split("/")[1] ?? 0);
}

function bucketKey(date: Date, start: Date, bucketDays: number) {
    return Math.floor((date.getTime() - start.getTime()) / (bucketDays * 86400000));
}

function percentChange(current: number, previous: number) {
    if (previous === 0) return current === 0 ? 0 : 100;
    return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function fetchPostRows(table: string, dateColumn: string, since: string): Promise<PostMetricRow[]> {
    const query = `select=${dateColumn}&${dateColumn}=gte.${encodeURIComponent(since)}&order=${dateColumn}.asc`;
    const result = await fetchRows<Record<string, string>>(table, query);
    return result.map((row) => ({date: row[dateColumn]}));
}

/**
 * How people sign in, and what that does and does not say about their device.
 *
 * There is no platform column anywhere: no Play Store table, and push tokens are
 * APNs only. So the honest split is by auth provider, read from the auth admin
 * API, with the Apple-only signals reported separately as evidence of an Apple
 * device rather than dressed up as an Android/iOS split.
 */
async function fetchSignInBreakdown() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return null;

    const providers: Record<string, number> = {};
    let total = 0;

    for (let page = 1; page <= 30; page += 1) {
        const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=200`, {
            headers: getSupabaseHeaders(key, {Accept: "application/json"}),
            cache: "no-store"
        });

        if (!response.ok) break;

        const body = await response.json() as {users?: Array<{app_metadata?: {provider?: string; providers?: string[]}}>};
        const users = body.users ?? [];
        if (!users.length) break;

        for (const user of users) {
            total += 1;
            const list = user.app_metadata?.providers?.length
                ? user.app_metadata.providers
                : [user.app_metadata?.provider ?? "unknown"];
            for (const provider of list) {
                providers[provider] = (providers[provider] ?? 0) + 1;
            }
        }

        if (users.length < 200) break;
    }

    return {total, providers};
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const requested = request.nextUrl.searchParams.get("period");
        const period: Period = requested === "week" || requested === "month" ? requested : "day";
        const {days, bucketDays} = periodConfig[period];
        const end = new Date();
        const start = new Date(end.getTime() - days * 86400000);
        const previousStart = new Date(start.getTime() - days * 86400000);
        const dateFilter = `created_at=gte.${encodeURIComponent(previousStart.toISOString())}&order=created_at.asc`;

        const [profiles, captures, purchases, creditTransactions, postRows, totals] = await Promise.all([
            fetchRows<MetricRow>("profiles", `select=created_at&${dateFilter}`),
            fetchRows<MetricRow>("captures", `select=created_at&${dateFilter}`),
            fetchRows<MetricRow>("app_store_purchases", `select=created_at,product_id,product_code,environment&${dateFilter}`),
            fetchRows<MetricRow>("credit_transactions", `select=created_at,delta,reason&reason=eq.purchase&${dateFilter}`),
            Promise.all([
                fetchPostRows("discover_feed_v1", "feed_activity_at", previousStart.toISOString()),
                fetchPostRows("discover_alignment_timeline_v1", "completed_at", previousStart.toISOString()),
                fetchPostRows("discover_principle_fusion_timeline_v1", "created_at", previousStart.toISOString()),
                fetchPostRows("discover_challenge_history_v1", "created_at", previousStart.toISOString()),
                fetchPostRows("discover_trade_history_v1", "completed_at", previousStart.toISOString())
            ]),
            Promise.all([
                countRows("profiles", "select=id"),
                countRows("captures", "select=id"),
                countRows("profiles", "select=id&is_pro=eq.true"),
                countRows("app_store_purchases", "select=transaction_id&environment=eq.Production")
            ])
        ]);

        const [signIn, pushTokens, appleBuyers] = await Promise.all([
            fetchSignInBreakdown(),
            fetchRows<MetricRow>("user_push_tokens", "select=user_id"),
            fetchRows<MetricRow>("app_store_purchases", "select=user_id")
        ]);
        // An APNs token or an App Store purchase can only come from an Apple
        // device. Nothing equivalent exists on the other side, so the remainder
        // is "no signal" rather than "Android".
        const appleDeviceUsers = new Set([
            ...pushTokens.map((row) => String((row as unknown as {user_id?: string}).user_id ?? "")),
            ...appleBuyers.map((row) => String((row as unknown as {user_id?: string}).user_id ?? ""))
        ].filter(Boolean));

        const isCurrent = (row: MetricRow) => new Date(row.created_at ?? 0) >= start;
        const isPrevious = (row: MetricRow) => new Date(row.created_at ?? 0) >= previousStart && new Date(row.created_at ?? 0) < start;
        const isSubscription = (row: MetricRow) => `${row.product_code} ${row.product_id}`.toLowerCase().includes("pro");
        const isProduction = (row: MetricRow) => (row.environment ?? "").toLowerCase() === "production";
        const currentUsers = profiles.filter(isCurrent).length;
        const previousUsers = profiles.filter(isPrevious).length;
        const currentCaptures = captures.filter(isCurrent).length;
        const previousCaptures = captures.filter(isPrevious).length;
        const currentSubscriptions = purchases.filter((row) => isCurrent(row) && isSubscription(row) && isProduction(row)).length;
        const previousSubscriptions = purchases.filter((row) => isPrevious(row) && isSubscription(row) && isProduction(row)).length;
        const currentCredits = creditTransactions.filter(isCurrent).reduce((sum, row) => sum + Math.max(0, row.delta ?? 0), 0);
        const previousCredits = creditTransactions.filter(isPrevious).reduce((sum, row) => sum + Math.max(0, row.delta ?? 0), 0);
        const bucketCount = Math.ceil(days / bucketDays);
        const series = Array.from({length: bucketCount}, (_, index) => {
            const bucketStart = new Date(start.getTime() + index * bucketDays * 86400000);
            return {
                date: bucketStart.toISOString(),
                users: 0,
                captures: 0,
                subscriptions: 0,
                credits: 0
            };
        });

        profiles.filter(isCurrent).forEach((row) => { const i = bucketKey(new Date(row.created_at!), start, bucketDays); if (series[i]) series[i].users += 1; });
        captures.filter(isCurrent).forEach((row) => { const i = bucketKey(new Date(row.created_at!), start, bucketDays); if (series[i]) series[i].captures += 1; });
        purchases.filter((row) => isCurrent(row) && isSubscription(row) && isProduction(row)).forEach((row) => { const i = bucketKey(new Date(row.created_at!), start, bucketDays); if (series[i]) series[i].subscriptions += 1; });
        creditTransactions.filter(isCurrent).forEach((row) => { const i = bucketKey(new Date(row.created_at!), start, bucketDays); if (series[i]) series[i].credits += Math.max(0, row.delta ?? 0); });

        const postTypeKeys: PostType[] = ["captures", "alignments", "fusions", "challenges", "trades"];
        const postTypeSeries = Array.from({length: bucketCount}, (_, index) => ({
            date: new Date(start.getTime() + index * bucketDays * 86400000).toISOString(),
            captures: 0,
            alignments: 0,
            fusions: 0,
            challenges: 0,
            trades: 0
        }));
        const postTypes = Object.fromEntries(postTypeKeys.map((key, index) => {
            const rows = postRows[index];
            const current = rows.filter((row) => new Date(row.date ?? 0) >= start);
            const previous = rows.filter((row) => new Date(row.date ?? 0) >= previousStart && new Date(row.date ?? 0) < start);
            current.forEach((row) => {
                const i = bucketKey(new Date(row.date!), start, bucketDays);
                if (postTypeSeries[i]) postTypeSeries[i][key] += 1;
            });
            return [key, {value: current.length, change: percentChange(current.length, previous.length)}];
        })) as Record<PostType, {value: number; change: number}>;
        const totalPostActivity = Object.values(postTypes).reduce((sum, item) => sum + item.value, 0);

        return NextResponse.json({
            ok: true,
            period,
            generatedAt: end.toISOString(),
            totals: {users: totals[0], captures: totals[1], activePro: totals[2], productionPurchases: totals[3]},
            kpis: {
                users: {value: currentUsers, change: percentChange(currentUsers, previousUsers)},
                captures: {value: currentCaptures, change: percentChange(currentCaptures, previousCaptures)},
                subscriptions: {value: currentSubscriptions, change: percentChange(currentSubscriptions, previousSubscriptions)},
                credits: {value: currentCredits, change: percentChange(currentCredits, previousCredits)}
            },
            signIn: signIn ? {
                total: signIn.total,
                providers: signIn.providers,
                appleDeviceSignals: appleDeviceUsers.size,
                note: "Providers come from auth. Apple device signals count members holding an APNs push token or an App Store purchase — the only device-specific records stored. There is no Android equivalent, so everyone else is simply unknown, not Android."
            } : null,
            purchaseBreakdown: {
                production: purchases.filter((row) => isCurrent(row) && isProduction(row)).length,
                sandbox: purchases.filter((row) => isCurrent(row) && !isProduction(row)).length
            },
            postActivity: {
                total: totalPostActivity,
                types: postTypes,
                series: postTypeSeries
            },
            series
        });
    } catch (error) {
        console.error("[admin-metrics]", error);
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to load metrics"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
