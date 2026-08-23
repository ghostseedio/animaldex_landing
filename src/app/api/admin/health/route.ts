import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Whether the capture pipeline is actually working.
 *
 * Supabase's own function logs need a management token this app does not hold,
 * so health is read from what the pipeline leaves behind instead: analyses that
 * completed, analyses that recorded an error, and captures that never reached
 * either. That is the same evidence an operator would go looking for, and it
 * covers failures the function logs would miss — an upload that never arrived
 * leaves no invocation at all.
 */

type Row = Record<string, unknown>;

const WINDOW_HOURS = 24;
/** A capture still mid-flight after this long is not in flight. */
const STUCK_MINUTES = 10;
/** Share of failures in the window that counts as degraded rather than noise. */
const DEGRADED_FAILURE_RATE = 0.2;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase access is not configured");
    return {url, key};
}

async function rows(table: string, params: string) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${table} query failed (${response.status})`);
    return await response.json() as Row[];
}

async function count(table: string, params: string) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
        method: "HEAD",
        headers: getSupabaseHeaders(key, {Prefer: "count=exact", Range: "0-0"}),
        cache: "no-store"
    });
    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    return Number.isFinite(total) ? total : 0;
}

async function rpc(name: string, args: Record<string, unknown> = {}) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
        cache: "no-store",
        body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(`${name} failed (${response.status})`);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

/** Groups raw error text by the code in front of the colon. */
function errorKind(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return "unknown";
    const [head] = trimmed.split(":");
    return head.trim().slice(0, 60) || "unknown";
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();

        const [recent, latestSuccess, stuckCounts, unanalysed, unlinked] = await Promise.all([
            rows("analysis_results", `select=capture_id,error_message,completed_at,created_at&created_at=gte.${since}&limit=2000`),
            rows("analysis_results", "select=completed_at&completed_at=not.is.null&order=completed_at.desc&limit=1"),
            rpc("capture_pipeline_stuck_counts", {p_stuck_after: `${STUCK_MINUTES} minutes`}).catch(() => null),
            count("captures", `select=id&status=eq.failed&created_at=gte.${since}`),
            // An analysis with no species_profile_id still reaches its number
            // through the identity key, so nothing looks wrong — but duplicate
            // merging refuses to touch the capture, and two photos of one pet
            // sit side by side forever. /api/admin/catalog/relink repairs them.
            count("analysis_results", `select=capture_id&species_profile_id=is.null&identity_kind=eq.domestic_parent&created_at=gte.${since}`)
        ]);

        const stuckRow = Array.isArray(stuckCounts) ? stuckCounts[0] : stuckCounts;
        const stuckMidFlight = Number(stuckRow?.stuck_mid_flight ?? 0);
        const creditBlocked = Number(stuckRow?.credit_blocked ?? 0);
        const abandonedPending = Number(stuckRow?.abandoned_pending ?? 0);

        const failures = recent.filter((row) => String(row.error_message ?? "").trim().length > 0);
        const successes = recent.filter((row) => row.completed_at && !String(row.error_message ?? "").trim());
        const byKind: Record<string, number> = {};

        for (const row of failures) {
            const kind = errorKind(String(row.error_message));
            byKind[kind] = (byKind[kind] ?? 0) + 1;
        }

        const failureRate = recent.length ? failures.length / recent.length : 0;
        const lastSuccessAt = latestSuccess[0]?.completed_at ? String(latestSuccess[0].completed_at) : null;
        const minutesSinceSuccess = lastSuccessAt
            ? Math.round((Date.now() - new Date(lastSuccessAt).getTime()) / 60_000)
            : null;

        // Credit-blocked captures are waiting on the user, not mid-flight.
        // Abandoned pending rows are dead uploads, not an analysis outage.
        // Only true stuck_mid_flight should degrade the pipeline status.
        const status = (minutesSinceSuccess != null && minutesSinceSuccess > 240) || failureRate > 0.5
            ? "down"
            : failureRate > DEGRADED_FAILURE_RATE || stuckMidFlight > 0
                ? "degraded"
                : "healthy";

        return NextResponse.json({
            ok: true,
            status,
            windowHours: WINDOW_HOURS,
            analyses: {
                total: recent.length,
                succeeded: successes.length,
                failed: failures.length,
                failureRate: Math.round(failureRate * 1000) / 10
            },
            errorsByKind: Object.entries(byKind)
                .sort((left, right) => right[1] - left[1])
                .map(([kind, total]) => ({kind, total})),
            capturesFailed: unanalysed,
            stuckCaptures: stuckMidFlight,
            creditBlockedCaptures: creditBlocked,
            abandonedPendingCaptures: abandonedPending,
            unlinkedDomesticAnalyses: unlinked,
            lastSuccessAt,
            minutesSinceSuccess,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("[admin-health]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to read pipeline health"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
