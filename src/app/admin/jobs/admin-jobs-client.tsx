"use client";

import Link from "next/link";
import {useCallback, useEffect, useMemo, useState} from "react";
import {Refresh} from "solar-icon-set";
import type {JobRow} from "@/app/api/admin/jobs/route";
import type {JobStatus} from "@/lib/cron-schedule";
import {shortAgo} from "@/lib/cron-schedule";

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

function StatCard({label, value, tone}: {label: string; value: number; tone?: string}) {
    return (
        <div className="rounded-2xl border border-line-300 bg-surface-900 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">{label}</p>
            <p className={`mt-1 font-display text-3xl ${tone ?? "text-white"}`}>{value}</p>
        </div>
    );
}

function JobCard({job}: {job: JobRow}) {
    const [open, setOpen] = useState(false);
    const style = STATUS_STYLE[job.status];
    const deepLink = DEEP_LINKS[job.name];

    return (
        <li className="rounded-2xl border border-line-300 bg-surface-900">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className={`flex shrink-0 items-center gap-2 text-xs font-black ${style.text}`}>
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
                    {style.label}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-white">{job.name}</span>
                <span className="shrink-0 text-xs font-bold text-ink-400">{job.scheduleLabel}</span>
                <span className="shrink-0 text-xs text-ink-400">
                    {shortAgo(job.secondsSinceLastRun)} · {duration(job.lastDurationMs)}
                </span>
                {job.failuresInWindow > 0 ? (
                    <span className="shrink-0 rounded-full border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-black text-red-300">
                        {job.failuresInWindow} failed
                    </span>
                ) : null}
                {deepLink ? (
                    <Link href={deepLink.href} className="shrink-0 text-xs font-bold text-primary-200 hover:text-primary-100">
                        {deepLink.label}
                    </Link>
                ) : null}
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    aria-expanded={open}
                    className="shrink-0 rounded-lg border border-line-300 px-2 py-1 text-[10px] font-black text-ink-400 transition hover:border-primary-300 hover:text-white"
                >
                    {open ? "Hide" : "Detail"}
                </button>
            </div>

            {open ? (
                <div className="space-y-3 border-t border-line-300 px-4 py-3 text-xs leading-5 text-ink-300">
                    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                        <div>
                            <dt className="font-black uppercase tracking-[.14em] text-ink-500">Schedule</dt>
                            <dd className="font-mono text-ink-200">{job.schedule || "—"}</dd>
                        </div>
                        <div>
                            <dt className="font-black uppercase tracking-[.14em] text-ink-500">Last outcome</dt>
                            <dd className="text-ink-200">
                                {job.lastStatus ?? "never run"}
                                {job.lastStartTime ? ` · ${new Date(job.lastStartTime).toISOString().replace("T", " ").slice(0, 19)} UTC` : ""}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-black uppercase tracking-[.14em] text-ink-500">Last success</dt>
                            <dd className="text-ink-200">
                                {job.lastSuccessAt ? `${new Date(job.lastSuccessAt).toISOString().replace("T", " ").slice(0, 19)} UTC` : "Never"}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-black uppercase tracking-[.14em] text-ink-500">Runs in window</dt>
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
                            <p className="font-black uppercase tracking-[.14em] text-ink-500">Return message</p>
                            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line-300 bg-canvas-950 p-3 font-mono text-[11px] text-ink-300">
                                {job.lastMessage}
                            </pre>
                        </div>
                    ) : null}
                    <div>
                        <p className="font-black uppercase tracking-[.14em] text-ink-500">Command</p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line-300 bg-canvas-950 p-3 font-mono text-[11px] text-ink-400">
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
        <main className="px-4 py-6 sm:px-7 lg:px-10">
            <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line-300 pb-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary-200">Operations</p>
                    <h1 className="mt-1 font-display text-3xl text-white sm:text-4xl">Scheduled jobs</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">
                        Every pg_cron job, its schedule, and whether it is still running. Jobs are declared in the AnimalDex migrations, so this page reads
                        and never changes them.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-400">
                        <input type="checkbox" checked={showHealthy} onChange={(event) => setShowHealthy(event.target.checked)} className="accent-primary-400" />
                        Show healthy
                    </label>
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="inline-flex items-center gap-2 rounded-xl border border-line-300 px-3 py-2 text-xs font-bold text-white transition hover:border-primary-300"
                    >
                        <Refresh size={14} />
                        {loading ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </header>

            {error ? (
                <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                    <p className="font-bold">The scheduler could not be read.</p>
                    <p className="mt-1 leading-6 text-red-200/80">{error}</p>
                </div>
            ) : null}

            {summary ? (
                <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Scheduler summary">
                    <StatCard label="Jobs" value={summary.total} />
                    <StatCard label="Healthy" value={summary.healthy} tone="text-primary-100" />
                    <StatCard label="Failing" value={summary.failing} tone={summary.failing > 0 ? "text-red-300" : "text-white"} />
                    <StatCard label="Late" value={summary.late} tone={summary.late > 0 ? "text-amber-300" : "text-white"} />
                    <StatCard label="Paused" value={summary.paused} />
                    <StatCard label={`Failed runs / ${data?.windowHours ?? 24}h`} value={summary.failuresInWindow} tone={summary.failuresInWindow > 0 ? "text-red-300" : "text-white"} />
                </section>
            ) : null}

            {summary && needsAttention === 0 && summary.neverRun === 0 && !error ? (
                <p className="mt-5 rounded-2xl border border-primary-400/20 bg-primary-500/[.06] px-4 py-3 text-sm font-bold text-primary-100">
                    All {summary.total} jobs are running on schedule.
                </p>
            ) : null}

            <ul className="mt-5 space-y-2">
                {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                ))}
            </ul>

            {!loading && !error && jobs.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-dashed border-line-300 px-4 py-8 text-center text-sm text-ink-400">
                    {data?.jobs.length ? "Nothing needs attention." : "No scheduled jobs were returned."}
                </p>
            ) : null}

            {data?.generatedAt ? (
                <p className="mt-4 text-xs text-ink-500">Read {new Date(data.generatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC · refreshes every 30s</p>
            ) : null}
        </main>
    );
}
