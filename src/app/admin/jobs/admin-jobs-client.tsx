"use client";

import Link from "next/link";
import {useCallback, useEffect, useMemo, useState} from "react";
import type {JobRow} from "@/app/api/admin/jobs/route";
import type {JobStatus} from "@/lib/cron-schedule";
import {shortAgo} from "@/lib/cron-schedule";
import {AdminPage, Alert, Badge, Button, EmptyState, ListSkeleton, PageHeader, RefreshButton, Stat, StatGrid, StatGridSkeleton} from "@/components/admin/ui";

/**
 * The scheduler, in one table.
 *
 * Sixteen jobs keep AnimalDex running and none of them had a home: a job that
 * stopped being scheduled left no trace in /admin/reliability, because that
 * page reports work that started. The ordering is deliberate — failing, then
 * late, then never-run, then healthy — so the top of the table is the only part
 * anyone has to read on a normal day.
 */

type Summary = {
    total: number;
    healthy: number;
    failing: number;
    late: number;
    paused: number;
    neverRun: number;
    failuresInWindow: number;
};

type Payload = {
    ok: boolean;
    error?: string;
    generatedAt: string;
    windowHours: number;
    summary: Summary;
    jobs: JobRow[];
};

const STATUS_STYLE: Record<JobStatus, {label: string; dot: string; text: string}> = {
    healthy: {label: "Healthy", dot: "bg-primary-500", text: "text-primary-100"},
    failing: {label: "Failing", dot: "bg-red-400", text: "text-red-300"},
    late: {label: "Late", dot: "bg-amber-400", text: "text-amber-300"},
    "never-run": {label: "Never run", dot: "bg-sky-400", text: "text-sky-300"},
    paused: {label: "Paused", dot: "bg-ink-500", text: "text-ink-400"},
    unknown: {label: "Unknown", dot: "bg-ink-500", text: "text-ink-400"}
};

/** The page's own view of a job it knows a dedicated screen for. */
const DEEP_LINKS: Record<string, {href: string; label: string}> = {
    index_unindexed_captures_hourly: {href: "/admin/indexing", label: "Open indexing"},
    index_unindexed_captures_daily: {href: "/admin/indexing", label: "Open indexing"},
    reliability_incident_evaluation: {href: "/admin/reliability", label: "Open reliability"},
    capture_pipeline_heal: {href: "/admin/maintenance", label: "Open maintenance"},
    capture_analysis_dispatch: {href: "/admin/maintenance", label: "Open maintenance"}
};

function duration(ms: number | null): string {
    if (ms == null) return "—";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms / 60_000)}m`;
}

function StatCard({label, value, tone}: {label: string; value: number; tone?: "good" | "warn" | "bad"}) {
    return <Stat label={label} value={value} tone={tone} />;
}

function JobCard({job}: {job: JobRow}) {
    const [open, setOpen] = useState(false);
    const style = STATUS_STYLE[job.status];
    const deepLink = DEEP_LINKS[job.name];

    return (
        <li className="border border-line-300 bg-surface-900">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className={`flex shrink-0 items-center gap-2 text-xs font-black ${style.text}`}>
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
                    {style.label}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-white">{job.name}</span>
                <span className="shrink-0 text-xs font-bold text-ink-400">{job.scheduleLabel}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-400">
                    {shortAgo(job.secondsSinceLastRun)} · {duration(job.lastDurationMs)}
                </span>
                {job.failuresInWindow > 0 ? (
                    <Badge tone="bad" className="shrink-0 tabular-nums">
                        {job.failuresInWindow} failed
                    </Badge>
                ) : null}
                {deepLink ? (
                    <Link href={deepLink.href} className="shrink-0 text-xs font-bold text-primary-200 hover:text-primary-100">
                        {deepLink.label}
                    </Link>
                ) : null}
                <Button size="sm" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="shrink-0">
                    {open ? "Hide" : "Detail"}
                </Button>
            </div>

            {open ? (
                <div className="space-y-3 border-t border-line-300 px-4 py-3 text-xs leading-5 text-ink-300">
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        <div>
                            <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Schedule</dt>
                            <dd className="font-mono text-ink-200">{job.schedule || "—"}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Last outcome</dt>
                            <dd className="text-ink-200">
                                {job.lastStatus ?? "never run"}
                                {job.lastStartTime ? ` · ${new Date(job.lastStartTime).toISOString().replace("T", " ").slice(0, 19)} UTC` : ""}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Last success</dt>
                            <dd className="text-ink-200">
                                {job.lastSuccessAt ? `${new Date(job.lastSuccessAt).toISOString().replace("T", " ").slice(0, 19)} UTC` : "Never"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Runs in window</dt>
                            <dd className="text-ink-200">
                                {job.runsInWindow} run{job.runsInWindow === 1 ? "" : "s"}, {job.failuresInWindow} failed
                            </dd>
                        </div>
                    </dl>
                    {job.lateBySeconds != null ? (
                        <p className="text-amber-300">Overdue by about {shortAgo(job.lateBySeconds).replace(" ago", "")} beyond its usual gap.</p>
                    ) : null}
                    {job.expectedIntervalSeconds == null ? (
                        <p className="text-ink-500">This schedule is not one lateness is judged from, so only the last run is reported.</p>
                    ) : null}
                    {job.lastMessage ? (
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Return message</p>
                            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words border border-line-300 bg-canvas-950 p-3 font-mono text-[11px] text-ink-300">
                                {job.lastMessage}
                            </pre>
                        </div>
                    ) : null}
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Command</p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words border border-line-300 bg-canvas-950 p-3 font-mono text-[11px] text-ink-400">
                            {job.command || "—"}
                        </pre>
                    </div>
                </div>
            ) : null}
        </li>
    );
}

export default function AdminJobsClient() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showHealthy, setShowHealthy] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/jobs", {cache: "no-store"});
            const payload = (await response.json()) as Payload;
            if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            setData(payload);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load the scheduler");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        // Fast jobs tick every few seconds, so a stale table is misleading in a
        // way a stale report is not.
        const timer = setInterval(() => void load(), 30_000);
        return () => clearInterval(timer);
    }, [load]);

    const jobs = useMemo(() => {
        if (!data?.jobs) return [];
        return showHealthy ? data.jobs : data.jobs.filter((job) => job.status !== "healthy");
    }, [data, showHealthy]);

    const summary = data?.summary;
    const needsAttention = (summary?.failing ?? 0) + (summary?.late ?? 0);

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Operations"
                title="Scheduled jobs"
                description="Every pg_cron job, its schedule, and whether it is still running. Jobs are declared in the AnimalDex migrations, so this page reads and never changes them."
                meta={data?.generatedAt ? <>Read {new Date(data.generatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC · refreshes every 30s</> : null}
                actions={
                    <>
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-400">
                            <input type="checkbox" checked={showHealthy} onChange={(event) => setShowHealthy(event.target.checked)} className="accent-primary-400" />
                            Show healthy
                        </label>
                        <RefreshButton loading={loading} onClick={() => void load()} />
                    </>
                }
            />

            {error ? (
                <Alert tone="bad" title="The scheduler could not be read." className="mt-6">
                    {error}
                </Alert>
            ) : null}

            {summary ? (
                <StatGrid className="mt-6 sm:grid-cols-3 lg:grid-cols-6" aria-label="Scheduler summary">
                    <StatCard label="Jobs" value={summary.total} />
                    <StatCard label="Healthy" value={summary.healthy} tone="good" />
                    <StatCard label="Failing" value={summary.failing} tone={summary.failing > 0 ? "bad" : undefined} />
                    <StatCard label="Late" value={summary.late} tone={summary.late > 0 ? "warn" : undefined} />
                    <StatCard label="Paused" value={summary.paused} />
                    <StatCard label={`Failed runs / ${data?.windowHours ?? 24}h`} value={summary.failuresInWindow} tone={summary.failuresInWindow > 0 ? "bad" : undefined} />
                </StatGrid>
            ) : loading && !error ? (
                <StatGridSkeleton count={6} className="mt-6 sm:grid-cols-3 lg:grid-cols-6" />
            ) : null}

            {summary && needsAttention === 0 && summary.neverRun === 0 && !error ? (
                <Alert tone="good" className="mt-6">
                    All {summary.total} jobs are running on schedule.
                </Alert>
            ) : null}

            {!data && loading && !error ? <ListSkeleton rows={8} className="mt-6" /> : null}

            {jobs.length > 0 ? (
                <ul className="mt-6 space-y-2">
                    {jobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                    ))}
                </ul>
            ) : null}

            {!loading && !error && jobs.length === 0 ? (
                <EmptyState className="mt-6" title={data?.jobs.length ? "Nothing needs attention." : "No scheduled jobs were returned."} />
            ) : null}
        </AdminPage>
    );
}
