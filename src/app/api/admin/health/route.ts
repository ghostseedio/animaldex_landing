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

const CLIENT_MEDIA_KINDS = new Set([
    "upload_incomplete",
    "no_primary_image",
    "source_media_unavailable",
    "media_missing",
    "local_source_missing",
    "storage_object_missing_after_upload",
    "storage_upload_failed",
    "instagram_media_unavailable"
]);

/** Groups raw error text by the code in front of the colon. */
function errorKind(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return "unknown";
    const [head] = trimmed.split(":");
    return head.trim().slice(0, 60) || "unknown";
}

function isClientMediaFailure(message: string) {
    const kind = errorKind(message).toLowerCase();
    if (CLIENT_MEDIA_KINDS.has(kind)) return true;
    return /upload_incomplete|no_primary_image|storage object missing|source_media_unavailable|media_missing/i.test(message);
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const since = new Date(Date.now() - WINDOW_HOURS * 3600_000).toISOString();

        const [recent, latestSuccess, stuckCounts, unanalysed, unlinked, importHealth] = await Promise.all([
            rows("analysis_results", `select=capture_id,error_message,completed_at,created_at&created_at=gte.${since}&limit=2000`),
            rows("analysis_results", "select=completed_at&completed_at=not.is.null&order=completed_at.desc&limit=1"),
            rpc("capture_pipeline_stuck_counts", {p_stuck_after: `${STUCK_MINUTES} minutes`}).catch(() => null),
            count("captures", `select=id&status=eq.failed&created_at=gte.${since}`),
            // An analysis with no species_profile_id still reaches its number
            // through the identity key, so nothing looks wrong — but duplicate
            // merging refuses to touch the capture, and two photos of one pet
            // sit side by side forever. /api/admin/catalog/relink repairs them.
            count("analysis_results", `select=capture_id&species_profile_id=is.null&identity_kind=eq.domestic_parent&created_at=gte.${since}`),
            rpc("import_pipeline_health").catch(() => null)
        ]);

        const stuckRow = Array.isArray(stuckCounts) ? stuckCounts[0] : stuckCounts;
        const stuckMidFlight = Number(stuckRow?.stuck_mid_flight ?? 0);
        const creditBlocked = Number(stuckRow?.credit_blocked ?? 0);
        const abandonedPending = Number(stuckRow?.abandoned_pending ?? 0);
        const awaitingClientFrames = Number(stuckRow?.awaiting_client_frames ?? 0);
        const abandonedClientVideo = Number(stuckRow?.abandoned_client_video ?? 0);
        const sourceMediaMissing = Number(stuckRow?.source_media_missing ?? 0);
        const serverQueued = Number(stuckRow?.server_queued ?? 0);
        const serverRunning = Number(stuckRow?.server_running ?? 0);

        const failures = recent.filter((row) => String(row.error_message ?? "").trim().length > 0);
        const successes = recent.filter((row) => row.completed_at && !String(row.error_message ?? "").trim());
        const clientMediaFailures = failures.filter((row) => isClientMediaFailure(String(row.error_message)));
        const serverFailures = failures.filter((row) => !isClientMediaFailure(String(row.error_message)));
        const byKind: Record<string, number> = {};
        const serverByKind: Record<string, number> = {};
        const clientByKind: Record<string, number> = {};

        for (const row of failures) {
            const kind = errorKind(String(row.error_message));
            byKind[kind] = (byKind[kind] ?? 0) + 1;
            const bucket = isClientMediaFailure(String(row.error_message)) ? clientByKind : serverByKind;
            bucket[kind] = (bucket[kind] ?? 0) + 1;
        }

        const serverDenom = successes.length + serverFailures.length;
        const serverFailureRate = serverDenom ? serverFailures.length / serverDenom : 0;
        const mixedFailureRate = recent.length ? failures.length / recent.length : 0;
        const lastSuccessAt = latestSuccess[0]?.completed_at ? String(latestSuccess[0].completed_at) : null;
        const minutesSinceSuccess = lastSuccessAt
            ? Math.round((Date.now() - new Date(lastSuccessAt).getTime()) / 60_000)
            : null;

        // Analyzer status is server-owned work only. Client uploads, credit waits,
        // catalog gaps, and videos awaiting device frames have their own counters.
        const serverBacklog = serverQueued + serverRunning + stuckMidFlight;
        const status = (minutesSinceSuccess != null && minutesSinceSuccess > 240 && serverBacklog > 0)
            || serverFailureRate > 0.5
            ? "down"
            : serverFailureRate > DEGRADED_FAILURE_RATE || stuckMidFlight > 0
                ? "degraded"
                : "healthy";

        const kindList = (bag: Record<string, number>) =>
            Object.entries(bag)
                .sort((left, right) => right[1] - left[1])
                .map(([kind, total]) => ({kind, total}));

        return NextResponse.json({
            ok: true,
            status,
            windowHours: WINDOW_HOURS,
            analyses: {
                total: recent.length,
                succeeded: successes.length,
                failed: failures.length,
                failureRate: Math.round(mixedFailureRate * 1000) / 10,
                serverFailed: serverFailures.length,
                clientMediaFailed: clientMediaFailures.length,
                serverFailureRate: Math.round(serverFailureRate * 1000) / 10
            },
            errorsByKind: kindList(byKind),
            serverErrorsByKind: kindList(serverByKind),
            clientMediaErrorsByKind: kindList(clientByKind),
            capturesFailed: unanalysed,
            stuckCaptures: stuckMidFlight,
            creditBlockedCaptures: creditBlocked,
            abandonedPendingCaptures: abandonedPending,
            awaitingClientFrames,
            abandonedClientVideo,
            sourceMediaMissing,
            serverQueued,
            serverRunning,
            unlinkedDomesticAnalyses: unlinked,
            lastSuccessAt,
            minutesSinceSuccess,
            import: importHealth && typeof importHealth === "object" ? importHealth : null,
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
