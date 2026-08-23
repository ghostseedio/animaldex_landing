import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Every technical failure, deduplicated, filterable, traceable.
 *
 * /api/admin/health already answers "is the pipeline working" from the residue
 * the pipeline leaves behind. It cannot answer "what broke for whom", because
 * until operation_failure_events existed a failure landed in one of six places
 * — analysis_results.error_message, capture_analysis_queue.last_error,
 * capture_recovery_ledger.detail, capture_analysis_operations.failure_reason,
 * external_import_jobs.last_error, or an edge-function console.error this app
 * holds no management token to read — and no two shared a schema.
 *
 * This reads the one table. GET is the list plus the rollup; POST acknowledges
 * an incident, which is the only mutation offered here: acknowledging changes
 * nothing about a user's data, and retrying is deliberately left to the
 * purpose-built endpoints that already know how to do it safely
 * (maintenance/refresh, maintenance/broken-captures, revive_capture).
 */

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

type Row = Record<string, unknown>;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase access is not configured");
    return {url, key};
}

async function rows(path: string): Promise<Row[]> {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });
    if (!response.ok) {
        throw new Error(`${path.split("?")[0]} query failed (${response.status})`);
    }
    return await response.json() as Row[];
}

/** Which pipeline a stage belongs to, for the by-system breakdown. */
const SYSTEMS: Array<{label: string; match: (stage: string) => boolean}> = [
    {label: "Capture upload", match: (s) => s.includes("upload") || s.includes("storage")},
    {label: "Capture analysis", match: (s) => s === "capture_analysis" || s.includes("gemini") || s.includes("openai_analysis")},
    {label: "Video analysis", match: (s) => s.includes("video")},
    {label: "Admin reanalysis", match: (s) => s.includes("reanalysis")},
    {label: "Instagram OAuth", match: (s) => s.includes("oauth")},
    {label: "Instagram scan", match: (s) => s.includes("scan")},
    {label: "Thumbnail screening", match: (s) => s.includes("thumbnail")},
    {label: "Reel screening", match: (s) => s.includes("frame")},
    {label: "Materialization", match: (s) => s.includes("materiali") || s.includes("approve")},
    {label: "Database", match: (s) => s.includes("stats") || s.includes("reconcil")}
];

function systemFor(stage: string): string {
    const normalized = stage.toLowerCase();
    return SYSTEMS.find((system) => system.match(normalized))?.label ?? "Other";
}

/**
 * What an operator should do next, said plainly.
 *
 * The retryability column already encodes this; spelling it out here keeps the
 * client from re-deriving policy and drifting from the taxonomy.
 */
function disposition(row: Row): string {
    if (row.recovered_at) return "Recovered";
    if (row.acknowledged_at) return "Acknowledged";
    if (row.retryability === "user_action") return "Waiting on user";
    if (row.terminal) return "Terminal";
    if (row.retryability === "permanent") return "Terminal";
    if (row.retryability === "cancelled") return "Cancelled";
    return "Retry scheduled";
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const params = request.nextUrl.searchParams;
        const limit = Math.min(Math.max(Number(params.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);

        const filters: string[] = [];
        const since = params.get("since");
        if (since) filters.push(`last_seen_at=gte.${encodeURIComponent(since)}`);
        const category = params.get("category");
        if (category && category !== "all") filters.push(`failure_category=eq.${encodeURIComponent(category)}`);
        const stage = params.get("stage");
        if (stage && stage !== "all") filters.push(`stage=eq.${encodeURIComponent(stage)}`);
        const userId = params.get("user");
        if (userId) filters.push(`user_id=eq.${encodeURIComponent(userId)}`);
        const subjectId = params.get("subject");
        if (subjectId) filters.push(`subject_id=eq.${encodeURIComponent(subjectId)}`);
        const correlation = params.get("correlation");
        if (correlation) filters.push(`correlation_id=eq.${encodeURIComponent(correlation)}`);

        // "status" collapses the three columns an operator actually triages on
        // into one control, because recovered/acknowledged/open is how the work
        // is thought about, not as three independent booleans.
        const status = params.get("status") ?? "open";
        if (status === "open") {
            filters.push("recovered_at=is.null", "acknowledged_at=is.null");
        } else if (status === "recovered") {
            filters.push("recovered_at=not.is.null");
        } else if (status === "acknowledged") {
            filters.push("acknowledged_at=not.is.null");
        } else if (status === "needs_attention") {
            filters.push("recovered_at=is.null", "acknowledged_at=is.null", "retryability=neq.user_action");
        } else if (status === "waiting_on_user") {
            filters.push("recovered_at=is.null", "retryability=eq.user_action");
        }

        const query = [
            "select=*",
            ...filters,
            "order=last_seen_at.desc",
            `limit=${limit}`
        ].join("&");

        const [incidents, overview] = await Promise.all([
            rows(`operation_failure_events?${query}`),
            rows("reliability_overview_v1?select=*")
        ]);

        const bySystem = new Map<string, {system: string; open: number; occurrences: number; users: Set<string>}>();
        for (const row of incidents) {
            const label = systemFor(String(row.stage ?? ""));
            const bucket = bySystem.get(label) ?? {system: label, open: 0, occurrences: 0, users: new Set<string>()};
            bucket.open += 1;
            bucket.occurrences += Number(row.occurrences ?? 1);
            if (row.user_id) bucket.users.add(String(row.user_id));
            bySystem.set(label, bucket);
        }

        return NextResponse.json({
            ok: true,
            overview: overview[0] ?? null,
            // Array.from rather than spread: this project targets an ES level
            // below es2015 downlevel iteration.
            bySystem: Array.from(bySystem.values())
                .map((bucket) => ({
                    system: bucket.system,
                    incidents: bucket.open,
                    occurrences: bucket.occurrences,
                    users: bucket.users.size
                }))
                .sort((left, right) => right.occurrences - left.occurrences),
            incidents: incidents.map((row) => ({
                id: row.id,
                correlationId: row.correlation_id,
                subjectType: row.subject_type,
                subjectId: row.subject_id,
                userId: row.user_id,
                stage: row.stage,
                system: systemFor(String(row.stage ?? "")),
                failureCode: row.failure_code,
                failureCategory: row.failure_category,
                retryability: row.retryability,
                disposition: disposition(row),
                attemptCount: row.attempt_count,
                occurrences: row.occurrences,
                terminal: row.terminal,
                provider: row.provider,
                providerStatus: row.provider_status,
                // Technical text is operator-only by construction: this route is
                // behind the admin session and nothing here is ever rendered in
                // the app.
                technicalMessage: row.technical_message,
                metadata: row.metadata,
                firstSeenAt: row.first_seen_at,
                lastSeenAt: row.last_seen_at,
                recoveredAt: row.recovered_at,
                acknowledgedAt: row.acknowledged_at,
                acknowledgedNote: row.acknowledged_note
            })),
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("[admin-reliability]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to read reliability data"
        }, {status: 500});
    }
}

/**
 * Mark an incident investigated.
 *
 * Deliberately the only write. "Retry everything" is not offered: the safe
 * retry paths already exist and each one knows the invariant it must not break,
 * whereas a generic replay button over a table of mixed subjects is exactly how
 * duplicate captures get made.
 */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const body = await request.json().catch(() => ({})) as {id?: number; note?: string};
        if (!Number.isFinite(body.id)) {
            return NextResponse.json({ok: false, error: "An incident id is required"}, {status: 400});
        }

        const {url, key} = config();
        const response = await fetch(`${url}/rest/v1/operation_failure_events?id=eq.${body.id}`, {
            method: "PATCH",
            headers: getSupabaseHeaders(key, {
                "Content-Type": "application/json",
                Prefer: "return=representation"
            }),
            body: JSON.stringify({
                acknowledged_at: new Date().toISOString(),
                acknowledged_note: (body.note ?? "").trim().slice(0, 500) || null
            }),
            cache: "no-store"
        });
        if (!response.ok) {
            throw new Error(`acknowledge failed (${response.status})`);
        }
        const [updated] = await response.json() as Row[];
        return NextResponse.json({ok: true, incident: updated ?? null});
    } catch (error) {
        console.error("[admin-reliability-ack]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to acknowledge incident"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
