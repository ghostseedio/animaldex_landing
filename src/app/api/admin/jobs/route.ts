import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {describeSchedule, expectedIntervalSeconds, jobStatus, type JobStatus} from "@/lib/cron-schedule";

/**
 * Scheduler health for every pg_cron job, for /admin/jobs.
 *
 * /api/admin/health answers "is the capture pipeline producing results" and
 * /api/admin/reliability answers "what failed, for whom". Neither notices a job
 * that stopped being scheduled, because a job that never runs writes nothing to
 * either. This reads cron.job and cron.job_run_details through
 * admin_cron_job_health_v1 — the one function allowed to see that schema — and
 * turns each row into a status a person can scan.
 *
 * Read-only by design. Pausing, resuming or re-scheduling a job is a change to
 * the AnimalDex migrations, not a button here: the jobs are declared in source
 * and an out-of-band edit would silently diverge from them.
 */

const FAILURE_WINDOW_HOURS = 24;

/** The shape admin_cron_job_health_v1 returns, before any interpretation. */
type HealthRow = {
    jobid: number;
    jobname: string | null;
    schedule: string | null;
    command: string | null;
    active: boolean;
    last_run_id: number | null;
    last_status: string | null;
    last_start_time: string | null;
    last_end_time: string | null;
    last_return_message: string | null;
    last_success_at: string | null;
    runs_in_window: number | null;
    failures_in_window: number | null;
};

export type JobRow = {
    id: number;
    name: string;
    schedule: string;
    scheduleLabel: string;
    command: string;
    active: boolean;
    status: JobStatus;
    lastStatus: string | null;
    lastStartTime: string | null;
    lastDurationMs: number | null;
    lastMessage: string | null;
    lastSuccessAt: string | null;
    secondsSinceLastRun: number | null;
    lateBySeconds: number | null;
    expectedIntervalSeconds: number | null;
    runsInWindow: number;
    failuresInWindow: number;
};

/** Worst first, so the rows that need a person are never below the fold. */
const STATUS_ORDER: JobStatus[] = ["failing", "late", "never-run", "unknown", "paused", "healthy"];

function toRow(row: HealthRow, now: Date): JobRow {
    const {status, secondsSinceLastRun, lateBySeconds} = jobStatus(
        {
            active: row.active,
            schedule: row.schedule,
            lastStatus: row.last_status,
            lastStartTime: row.last_start_time,
            failuresInWindow: Number(row.failures_in_window ?? 0)
        },
        now
    );

    const start = row.last_start_time ? new Date(row.last_start_time).getTime() : null;
    const end = row.last_end_time ? new Date(row.last_end_time).getTime() : null;
    const lastDurationMs = start != null && end != null && end >= start ? end - start : null;

    return {
        id: row.jobid,
        name: row.jobname ?? `job ${row.jobid}`,
        schedule: row.schedule ?? "",
        scheduleLabel: describeSchedule(row.schedule),
        command: row.command ?? "",
        active: row.active,
        status,
        lastStatus: row.last_status,
        lastStartTime: row.last_start_time,
        lastDurationMs,
        lastMessage: row.last_return_message,
        lastSuccessAt: row.last_success_at,
        secondsSinceLastRun,
        lateBySeconds,
        expectedIntervalSeconds: expectedIntervalSeconds(row.schedule),
        runsInWindow: Number(row.runs_in_window ?? 0),
        failuresInWindow: Number(row.failures_in_window ?? 0)
    };
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) {
        return NextResponse.json({ok: false, error: "Supabase access is not configured"}, {status: 500});
    }

    let response: Response;
    try {
        response = await fetch(`${url}/rest/v1/rpc/admin_cron_job_health_v1`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Accept: "application/json"}),
            body: JSON.stringify({failure_window_hours: FAILURE_WINDOW_HOURS}),
            cache: "no-store"
        });
    } catch (error) {
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Request failed"}, {status: 502});
    }

    if (!response.ok) {
        const detail = await response.text();
        // Said plainly, because the migration shipping after the page is the
        // likeliest reason this endpoint ever fails.
        const missing = response.status === 404 || detail.includes("admin_cron_job_health_v1");
        return NextResponse.json(
            {
                ok: false,
                error: missing
                    ? "admin_cron_job_health_v1 is not installed. Apply supabase/migrations/20260926090000_admin_cron_job_health.sql."
                    : `Scheduler query failed (${response.status}): ${detail.slice(0, 300)}`
            },
            {status: missing ? 503 : 502}
        );
    }

    const now = new Date();
    const rows = ((await response.json()) as HealthRow[]).map((row) => toRow(row, now));
    rows.sort((a, b) => {
        const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        return byStatus !== 0 ? byStatus : a.name.localeCompare(b.name);
    });

    return NextResponse.json({
        ok: true,
        generatedAt: now.toISOString(),
        windowHours: FAILURE_WINDOW_HOURS,
        summary: {
            total: rows.length,
            healthy: rows.filter((row) => row.status === "healthy").length,
            failing: rows.filter((row) => row.status === "failing").length,
            late: rows.filter((row) => row.status === "late").length,
            paused: rows.filter((row) => row.status === "paused").length,
            neverRun: rows.filter((row) => row.status === "never-run").length,
            failuresInWindow: rows.reduce((total, row) => total + row.failuresInWindow, 0)
        },
        jobs: rows
    });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
