"use client";

import Image from "next/image";
import Link from "next/link";
import {Fragment, useCallback, useEffect, useMemo, useState} from "react";
import {identityKindShortLabel} from "@/lib/identity-kind";
import {formatIndexingCleanupMarkdown, formatRunMarkdown} from "@/lib/admin-indexing-cleanup-markdown";

/**
 * Hourly unindexed-captures cron: countdown, remaining pool, individuals,
 * and run history. Read-only — a specific re-run still happens on
 * /admin/maintenance.
 */

type RunResult = {
    capture_id: string;
    animal_name: string;
    action: string;
    error?: string | null;
    status?: number | null;
};

type AttemptRecord = {
    action: string;
    error: string | null;
    status: number | null;
    at: string | null;
};

type Run = {
    id: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    durationSeconds: number | null;
    candidates: number;
    queued: number;
    indexed: number;
    merged: number;
    skippedForever: number;
    notIndexed: number;
    running?: boolean;
    current?: RunResult | null;
    error: string | null;
    results: RunResult[];
};

type RetryState = "untouched" | "waiting" | "skipped";

type FixedCapture = {
    captureId: string;
    animalName: string;
    action: "indexed" | "merged";
    fixedAt: string | null;
    imageUrl: string;
    animalDexNumber: number | null;
};

type QueueCapture = {
    captureId: string;
    animalName: string;
    scientificName: string | null;
    identityKind: string | null;
    identityKey: string | null;
    completedAt: string | null;
    captureMode: string | null;
    imageUrl: string;
    attempts: number;
    lastAttemptedAt: string | null;
    skippedAt: string | null;
    retryState: RetryState;
    lastError?: string | null;
    attemptHistory?: AttemptRecord[];
};

type Bucket = {key: string; label: string; count: number};

type Payload = {
    ok: boolean;
    schedule: {
        cron: string;
        timezone: string;
        dailyBudget: number;
        nextRunAt: string;
        estimatedDaysRemaining: number;
    };
    queue: {
        eligibleCaptures: number;
        untouched: number;
        waiting: number;
        permanentlySkipped: number;
        unindexedCaptures: number;
        unindexedProfiles: number;
        hiddenUnindexedProfiles: number;
        poolCapped: boolean;
    };
    breakdown: {
        byRetryState: Bucket[];
        byKind: Bucket[];
        byName: Bucket[];
    };
    captures: QueueCapture[];
    fixed?: FixedCapture[];
    latest: Run | null;
    totals: {
        candidates: number;
        queued: number;
        indexed: number;
        merged: number;
        skippedForever: number;
    };
    totalRuns: number;
    runs: Run[];
    generatedAt: string;
};

const ACTION_TONE: Record<string, string> = {
    indexed: "bg-primary-500/15 text-primary-100",
    healed_indexed: "bg-primary-500/15 text-primary-100",
    merged: "bg-sky-400/15 text-sky-200",
    healed_merged: "bg-sky-400/15 text-sky-200",
    not_indexed: "bg-amber-400/15 text-amber-200",
    failed: "bg-red-500/15 text-red-200",
    still_running: "bg-amber-400/20 text-amber-100",
    deferred: "bg-ink-700/40 text-ink-300",
    skipped_forever: "bg-red-500/15 text-red-200",
    running: "bg-amber-400/20 text-amber-100",
    unknown: "bg-ink-700/40 text-ink-300"
};

const STATE_TONE: Record<RetryState, string> = {
    untouched: "bg-white/5 text-ink-300",
    waiting: "bg-amber-400/15 text-amber-200",
    skipped: "bg-red-500/15 text-red-200"
};

const STATE_LABEL: Record<RetryState, string> = {
    untouched: "Never tried",
    waiting: "Waiting",
    skipped: "Skipped"
};

const FILTERS: Array<{id: "eligible" | RetryState; label: string}> = [
    {id: "eligible", label: "Queue"},
    {id: "untouched", label: "Never tried"},
    {id: "waiting", label: "Waiting"},
    {id: "skipped", label: "Skipped"}
];

function ago(iso: string | null) {
    if (!iso) return "—";
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

function formatWhen(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }) + " UTC";
}

function durationLabel(seconds: number | null) {
    if (seconds == null) return "unfinished";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function actionLabel(action: string) {
    if (action === "not_indexed") return "still unindexed";
    return action.replace(/_/g, " ");
}

function formatReason(error: string | null | undefined, status?: number | null) {
    if (!error) return null;
    const labels: Record<string, string> = {
        invalid_credit_cost: "Invalid credit cost — analyze-capture rejected the request",
        enrichment_failed_existing_card_preserved: "Reanalyze failed — existing card kept",
        analysis_temporarily_busy: "Analysis temporarily busy — inflight throttle",
        "unknown: canceling statement due to statement timeout": "Postgres statement timeout during reanalyze",
        analyze_wait_timeout: "Timed out waiting for analyze-capture to finish",
        run_time_budget: "Deferred — run hit its time budget",
        missing_species_profile: "Fresh analysis has no species profile link",
        profile_has_no_number: "Profile linked but still has no AnimalDex number",
        "coarse_identity:group": "Coarse group ID — will not mint a number",
        "coarse_identity:domestic_parent": "Domestic parent ID — will not mint a number",
        "coarse_identity:family": "Family-level ID — will not mint a number",
        "coarse_identity:genus": "Genus-level ID — will not mint a number",
        "coarse_identity:recognition_bucket": "Recognition bucket — will not mint a number"
    };
    const label = labels[error] ??
        (error.startsWith("coarse_identity:")
            ? `Coarse identity (${error.slice("coarse_identity:".length)}) — will not mint a number`
            : error.startsWith("broad_identity:")
            ? `Broad identity (${error.slice("broad_identity:".length)}) — not an indexable slot`
            : error.toLowerCase().includes("statement timeout")
            ? "Postgres statement timeout during reanalyze"
            : error.includes(": ")
            ? error
            : error.replace(/_/g, " "));
    return status ? `${label} (${status})` : label;
}

function commonFailure(results: RunResult[]) {
    const counts = new Map<string, number>();
    for (const result of results) {
        if (result.action !== "failed" && result.action !== "not_indexed") continue;
        const key = result.error?.trim() || "unknown failure";
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0] ?? null;
}

function shortId(value: string) {
    return value.slice(0, 8);
}

function captureImageUrl(captureId: string) {
    return `/api/capture-images/${encodeURIComponent(captureId)}?proxy=1`;
}

function pad(value: number) {
    return String(value).padStart(2, "0");
}

function useCountdown(iso: string | null) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    if (!iso) return null;
    const remaining = Math.max(0, Date.parse(iso) - now);
    const totalSeconds = Math.floor(remaining / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
        remaining,
        due: remaining === 0,
        hours,
        minutes,
        seconds,
        label: remaining === 0 ? "Due now" : `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
    };
}

export default function AdminIndexingClient() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [expandedCapture, setExpandedCapture] = useState<string | null>(null);
    const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("eligible");
    const [query, setQuery] = useState("");
    const [nameFilter, setNameFilter] = useState<string | null>(null);
    const [preview, setPreview] = useState<{imageUrl: string; name: string} | null>(null);
    const [dispatching, setDispatching] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const response = await fetch("/api/admin/indexing-cleanup", {cache: "no-store"});
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Request failed");
            setData(payload);
            setError(null);
        } catch (caught) {
            if (!silent) setError(caught instanceof Error ? caught.message : "Unable to load indexing cleanup progress");
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const liveRun = data?.latest?.running ? data.latest : data?.runs.find((run) => run.running) ?? null;

    useEffect(() => {
        if (!liveRun) return;
        const timer = window.setInterval(() => { void load(true); }, 3000);
        return () => window.clearInterval(timer);
    }, [liveRun?.id, liveRun?.running, load]);

    const runNow = useCallback(async () => {
        const budget = data?.schedule.dailyBudget ?? 20;
        const confirmed = window.confirm(
            `Queue a manual run now? It uses the same job as the hourly cron and will re-analyse up to ${budget} captures (awaited). Progress will update on this page while it runs.`
        );
        if (!confirmed) return;
        setDispatching(true);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/indexing-cleanup", {method: "POST"});
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Dispatch failed");
            setNotice("Queued. Live progress should appear within a few seconds.");
            window.setTimeout(() => { void load(true); }, 2000);
            window.setTimeout(() => { void load(true); }, 6000);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to start a manual run");
        } finally {
            setDispatching(false);
        }
    }, [data?.schedule.dailyBudget, load]);

    const countdown = useCountdown(data?.schedule.nextRunAt ?? null);
    const queue = data?.queue;
    const schedule = data?.schedule;
    const latest = data?.latest;
    const latestFailure = latest ? commonFailure(latest.results) : null;
    const liveFailure = liveRun ? commonFailure(liveRun.results) : null;
    const fixed = data?.fixed ?? [];
    const focusRun = liveRun ?? latest ?? null;
    const breakdownMax = Math.max(1, ...(data?.breakdown.byName.map((row) => row.count) ?? [1]));
    const reportMarkdown = useMemo(() => {
        if (!data) return "";
        return formatIndexingCleanupMarkdown({
            generatedAt: data.generatedAt,
            schedule: data.schedule,
            queue: data.queue,
            latest: data.latest,
            live: liveRun,
            runs: data.runs,
            captures: data.captures,
            fixed: data.fixed,
            breakdown: data.breakdown
        });
    }, [data, liveRun]);

    const visibleCaptures = useMemo(() => {
        const rows = data?.captures ?? [];
        const needle = query.trim().toLowerCase();
        return rows.filter((row) => {
            if (filter === "eligible" && row.retryState === "skipped") return false;
            if (filter !== "eligible" && row.retryState !== filter) return false;
            if (nameFilter && row.animalName !== nameFilter) return false;
            if (!needle) return true;
            return [
                row.animalName,
                row.scientificName,
                row.identityKey,
                row.captureId,
                row.identityKind,
                row.lastError ?? ""
            ].some((value) => value?.toLowerCase().includes(needle));
        });
    }, [data?.captures, filter, nameFilter, query]);

    return (
        <div className="space-y-4">
            <header className="flex flex-col justify-between gap-3 border-b border-line-300 pb-3 lg:flex-row lg:items-center">
                <div className="min-w-0">
                    <Link href="/admin" className="text-xs text-ink-400 hover:text-white">← Admin</Link>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h1 className="font-display text-2xl text-white">Unindexed captures</h1>
                        <p className="text-xs text-ink-500">Hourly cron · 2 per pass · 3 tries each</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <CopyMarkdownButton text={reportMarkdown} label="Copy markdown" disabled={!data} />
                    <Link href="/admin/catalog" className="rounded-lg border border-primary-400/40 px-3 py-1.5 text-xs font-black text-primary-100">
                        Profiles
                    </Link>
                    <Link href="/admin/maintenance" className="rounded-lg border border-line-300 px-3 py-1.5 text-xs font-bold text-white hover:border-primary-300">
                        Re-run
                    </Link>
                    <button onClick={() => void runNow()} disabled={dispatching} className="rounded-lg border border-amber-400/40 px-3 py-1.5 text-xs font-black text-amber-100 disabled:opacity-50">
                        {dispatching ? "Queuing…" : "Run now"}
                    </button>
                    <button onClick={() => void load()} disabled={loading} className="rounded-lg bg-primary-400 px-3 py-1.5 text-xs font-black text-canvas-950 disabled:opacity-50">
                        {loading ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </header>

            {notice && (
                <p className="rounded-lg border border-primary-400/30 bg-primary-500/10 px-3 py-2 text-xs text-primary-100">{notice}</p>
            )}
            {error && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>
            )}

            {data && (
                <>
                    <section className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-primary-400/30 bg-primary-500/[.06] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[.14em] text-primary-200">Next job</p>
                            <p className="mt-1 font-display text-3xl tabular-nums text-white">
                                {countdown?.due ? "Due now" : countdown ? `${countdown.hours}h ${pad(countdown.minutes)}m ${pad(countdown.seconds)}s` : "—"}
                            </p>
                            <p className="mt-1 text-xs text-ink-400">
                                {formatWhen(schedule?.nextRunAt ?? null)} · up to {schedule?.dailyBudget}
                                {queue?.eligibleCaptures
                                    ? ` · ${queue.eligibleCaptures.toLocaleString()} queued ≈ ${schedule?.estimatedDaysRemaining}d`
                                    : " · queue empty"}
                            </p>
                        </div>
                        <div className={`rounded-2xl border px-4 py-3 ${liveRun ? "border-amber-400/40 bg-amber-500/[.08]" : "border-line-300 bg-surface-900"}`}>
                            <div className="flex items-center justify-between gap-2">
                                <p className={`text-[10px] font-black uppercase tracking-[.14em] ${liveRun ? "text-amber-200" : "text-ink-500"}`}>
                                    {liveRun ? "Live run" : "Latest run"}
                                </p>
                                {focusRun && (
                                    <CopyMarkdownButton
                                        text={formatRunMarkdown(focusRun, liveRun ? "Live run" : "Latest run")}
                                        label="Copy run"
                                    />
                                )}
                            </div>
                            {liveRun ? (
                                <>
                                    <p className="mt-1 font-display text-xl text-white">
                                        {Math.min(liveRun.results.filter((result) => result.action !== "running").length + (liveRun.current ? 1 : 0), liveRun.candidates)} / {liveRun.candidates}
                                        {liveRun.current ? ` · ${liveRun.current.animal_name || "capture"}` : ""}
                                    </p>
                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div
                                            className="h-full rounded-full bg-amber-300 transition-all"
                                            style={{width: `${liveRun.candidates ? Math.min(100, (liveRun.results.filter((result) => result.action !== "running").length / liveRun.candidates) * 100) : 0}%`}}
                                        />
                                    </div>
                                    <p className="mt-2 font-mono text-[11px] text-ink-400">
                                        {liveRun.indexed} indexed · {liveRun.merged} merged · {liveRun.notIndexed} failed
                                        {liveFailure ? ` · ${formatReason(liveFailure[0])}` : ""}
                                    </p>
                                </>
                            ) : latest ? (
                                <>
                                    <p className="mt-1 font-display text-xl text-white">{formatWhen(latest.startedAt)}</p>
                                    <p className="mt-1 font-mono text-[11px] text-ink-400">
                                        {ago(latest.startedAt)} · {durationLabel(latest.durationSeconds)} · {latest.indexed}/{latest.merged} indexed/merged · {latest.notIndexed} failed
                                    </p>
                                    {latestFailure && (
                                        <p className="mt-1 text-xs text-red-200">{latestFailure[1]} × {formatReason(latestFailure[0])}</p>
                                    )}
                                    {latest.error && <p className="mt-1 text-xs text-red-200">{latest.error}</p>}
                                </>
                            ) : (
                                <p className="mt-2 text-xs text-ink-400">No run has been logged yet.</p>
                            )}
                        </div>
                    </section>

                    <section className="grid grid-cols-3 gap-2 xl:grid-cols-6">
                        {[
                            ["Fixed", fixed.length, "text-primary-100"],
                            ["Queue", queue?.eligibleCaptures ?? 0, "text-white"],
                            ["Never tried", queue?.untouched ?? 0, "text-ink-100"],
                            ["Waiting", queue?.waiting ?? 0, "text-amber-200"],
                            ["Skipped", queue?.permanentlySkipped ?? 0, "text-red-200"],
                            ["Days left", schedule?.estimatedDaysRemaining ?? 0, "text-primary-100"]
                        ].map(([label, value, tone]) => (
                            <div key={String(label)} className="rounded-xl border border-line-300 bg-surface-900 px-3 py-2">
                                <p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">{label}</p>
                                <p className={`mt-0.5 font-display text-2xl tabular-nums ${tone}`}>{Number(value).toLocaleString()}</p>
                            </div>
                        ))}
                    </section>

                    <section className="grid gap-3 lg:grid-cols-3">
                        <BreakdownCard
                            title="Retry state"
                            rows={data.breakdown.byRetryState}
                            onSelect={(key) => {
                                if (key === "untouched" || key === "waiting" || key === "skipped") {
                                    setFilter(key);
                                    setNameFilter(null);
                                }
                            }}
                        />
                        <BreakdownCard
                            title="Identity"
                            rows={data.breakdown.byKind.map((row) => ({
                                ...row,
                                label: identityKindShortLabel(row.key) ?? row.key.replace(/_/g, " ")
                            }))}
                        />
                        <BreakdownCard
                            title="Labels"
                            rows={data.breakdown.byName}
                            onSelect={(key) => {
                                setNameFilter(key);
                                setFilter("eligible");
                            }}
                            selected={nameFilter}
                            onClear={nameFilter ? () => setNameFilter(null) : undefined}
                            max={breakdownMax}
                        />
                    </section>

                    {focusRun?.results.length ? (
                        <section className="rounded-xl border border-line-300 bg-surface-900 px-3 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
                                    {liveRun ? "This run" : "Latest attempts"}
                                    <span className="ml-2 font-mono font-bold normal-case tracking-normal text-ink-400">
                                        {focusRun.results.filter((result) => result.action !== "running").length}
                                        {(liveFailure ?? latestFailure) ? ` · ${formatReason((liveFailure ?? latestFailure)?.[0])}` : ""}
                                    </span>
                                </p>
                                <CopyMarkdownButton
                                    text={formatRunMarkdown(focusRun, liveRun ? "Live run" : "Latest run")}
                                    label="Copy failures"
                                />
                            </div>
                            <AttemptList
                                compact
                                results={focusRun.results}
                                onPreview={(imageUrl, name) => setPreview({imageUrl, name})}
                            />
                        </section>
                    ) : null}

                    {fixed.length > 0 && (
                        <section>
                            <p className="text-[10px] font-black uppercase tracking-[.14em] text-primary-200">Fixed · {fixed.length}</p>
                            <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {fixed.map((row) => (
                                    <li key={row.captureId} className="flex items-center gap-2 rounded-xl border border-primary-400/25 bg-primary-500/[.06] px-2 py-1.5">
                                        <CaptureThumb
                                            imageUrl={row.imageUrl}
                                            name={row.animalName}
                                            onOpen={() => setPreview({imageUrl: row.imageUrl, name: row.animalName})}
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-white">
                                                {row.animalName}
                                                {row.animalDexNumber != null ? ` #${row.animalDexNumber}` : ""}
                                            </p>
                                            <p className="font-mono text-[10px] text-ink-500">{row.action} · {ago(row.fixedAt)}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section className="space-y-2">
                        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">Still unindexed</h2>
                                <span className="font-mono text-[11px] text-ink-500">
                                    {visibleCaptures.length.toLocaleString()}
                                    {queue?.poolCapped ? " · cap 800" : ""}
                                </span>
                                {FILTERS.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => setFilter(option.id)}
                                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${filter === option.id ? "border-primary-300 bg-primary-500/15 text-primary-100" : "border-line-300 text-ink-400"}`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                                {nameFilter && (
                                    <button type="button" onClick={() => setNameFilter(null)} className="text-[10px] font-bold text-primary-100">
                                        Clear {nameFilter}
                                    </button>
                                )}
                            </div>
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search…"
                                className="h-8 w-full rounded-lg border border-line-300 bg-canvas-900 px-2.5 text-xs text-white outline-none focus:border-primary-300 sm:max-w-xs"
                            />
                        </div>
                        <div className="overflow-hidden rounded-xl border border-line-300">
                            <div className="max-h-[28rem] overflow-auto">
                                <table className="min-w-full text-left text-xs">
                                    <thead className="sticky top-0 bg-canvas-950 text-[10px] font-black uppercase tracking-[.12em] text-ink-500">
                                        <tr>
                                            <th className="px-2 py-2">Photo</th>
                                            <th className="px-2 py-2">Animal</th>
                                            <th className="px-2 py-2">Level</th>
                                            <th className="px-2 py-2">State</th>
                                            <th className="px-2 py-2">Reason</th>
                                            <th className="px-2 py-2">Tries</th>
                                            <th className="px-2 py-2">ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleCaptures.map((row) => {
                                            const open = expandedCapture === row.captureId;
                                            return (
                                                <Fragment key={row.captureId}>
                                                    <tr
                                                        className="cursor-pointer border-t border-line-300/70 hover:bg-white/[.03]"
                                                        onClick={() => setExpandedCapture(open ? null : row.captureId)}
                                                    >
                                                        <td className="px-2 py-1.5" onClick={(event) => event.stopPropagation()}>
                                                            <CaptureThumb
                                                                imageUrl={row.imageUrl}
                                                                name={row.animalName}
                                                                onOpen={() => setPreview({imageUrl: row.imageUrl, name: row.animalName})}
                                                            />
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <p className="font-bold text-white">{row.animalName}</p>
                                                            <p className="font-mono text-[10px] text-ink-500">{row.scientificName || row.identityKey || "—"}</p>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-ink-300">
                                                            {identityKindShortLabel(row.identityKind) ?? (row.identityKind ? row.identityKind.replace(/_/g, " ") : "—")}
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase ${STATE_TONE[row.retryState]}`}>
                                                                {STATE_LABEL[row.retryState]}
                                                            </span>
                                                        </td>
                                                        <td className="max-w-[16rem] px-2 py-1.5 text-[11px] leading-4 text-ink-300">
                                                            {formatReason(row.lastError ?? null) ?? (row.attempts === 0 ? "Not tried" : "—")}
                                                        </td>
                                                        <td className="px-2 py-1.5 font-mono text-[11px] text-ink-400">
                                                            {row.attempts}/3{row.lastAttemptedAt ? ` · ${ago(row.lastAttemptedAt)}` : ""}
                                                        </td>
                                                        <td className="px-2 py-1.5" onClick={(event) => event.stopPropagation()}>
                                                            <a href={`/p/${row.captureId}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-primary-100 hover:underline">
                                                                {shortId(row.captureId)}
                                                            </a>
                                                        </td>
                                                    </tr>
                                                    {open && (
                                                        <tr className="border-t border-line-300/40 bg-canvas-950/70">
                                                            <td colSpan={7} className="px-3 py-2">
                                                                {(row.attemptHistory ?? []).length === 0 ? (
                                                                    <p className="text-xs text-ink-400">No cleanup attempts logged yet.</p>
                                                                ) : (
                                                                    <ol className="space-y-1">
                                                                        {(row.attemptHistory ?? []).map((attempt, index) => (
                                                                            <li key={`${row.captureId}-${attempt.at}-${index}`} className="flex flex-wrap items-center gap-2 text-xs">
                                                                                <span className="font-mono text-[10px] text-ink-500">{index + 1}</span>
                                                                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase ${ACTION_TONE[attempt.action] ?? ACTION_TONE.unknown}`}>
                                                                                    {actionLabel(attempt.action)}
                                                                                </span>
                                                                                <span className="text-ink-300">{formatReason(attempt.error, attempt.status) ?? "No error recorded"}</span>
                                                                                <span className="text-ink-500">{formatWhen(attempt.at)}</span>
                                                                            </li>
                                                                        ))}
                                                                    </ol>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                        {visibleCaptures.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-3 py-8 text-center text-xs text-ink-400">
                                                    Nothing matches that filter.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
                            {loading ? "Loading runs…" : `${data.runs.length} runs`}
                            <span className="ml-2 font-mono font-bold normal-case tracking-normal">
                                {data.totals.indexed} indexed · {data.totals.merged} merged · {data.totals.skippedForever} skipped
                            </span>
                        </p>
                        {data.runs.length === 0 && !loading && (
                            <p className="rounded-xl border border-line-300 px-3 py-4 text-center text-xs text-ink-400">
                                The cron has not written a run yet.
                            </p>
                        )}
                        {data.runs.map((run) => {
                            const key = run.id ?? run.startedAt ?? "run";
                            const open = expanded === key;
                            return (
                                <article key={key} className="rounded-xl border border-line-300 bg-canvas-950/60">
                                    <div className="flex items-stretch">
                                        <button
                                            type="button"
                                            onClick={() => setExpanded(open ? null : key)}
                                            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left"
                                        >
                                            <span className="text-xs font-bold text-white">{formatWhen(run.startedAt)}</span>
                                            <span className="text-[10px] text-ink-500">{ago(run.startedAt)}</span>
                                            {run.running && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-100">Live</span>}
                                            {run.error && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-red-200">Error</span>}
                                            <span className="font-mono text-[10px] text-ink-400">
                                                {run.candidates} cand · {run.indexed} idx · {run.merged} mrg · {run.notIndexed} fail · {durationLabel(run.durationSeconds)}
                                            </span>
                                        </button>
                                        <div className="flex items-center pr-2" onClick={(event) => event.stopPropagation()}>
                                            <CopyMarkdownButton text={formatRunMarkdown(run)} label="Copy" />
                                        </div>
                                    </div>
                                    {open && (
                                        <div className="border-t border-line-300 px-3 py-2">
                                            {run.results.length === 0 ? (
                                                <p className="text-xs text-ink-400">This run logged no per-capture results.</p>
                                            ) : (
                                                <AttemptList
                                                    compact
                                                    results={run.results}
                                                    onPreview={(imageUrl, name) => setPreview({imageUrl, name})}
                                                />
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </section>

                    {preview && (
                        <button
                            type="button"
                            onClick={() => setPreview(null)}
                            className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
                            aria-label="Close capture preview"
                        >
                            <img
                                src={preview.imageUrl}
                                alt={preview.name}
                                className="max-h-[calc(100dvh-4rem)] max-w-full rounded-2xl object-contain"
                            />
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

function CopyMarkdownButton({
    text,
    label,
    disabled = false
}: {
    text: string;
    label: string;
    disabled?: boolean;
}) {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async () => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const field = document.createElement("textarea");
            field.value = text;
            field.setAttribute("readonly", "");
            field.style.position = "fixed";
            field.style.left = "-9999px";
            document.body.appendChild(field);
            field.select();
            document.execCommand("copy");
            field.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }, [text]);

    return (
        <button
            type="button"
            onClick={() => void copy()}
            disabled={disabled || !text}
            className="rounded-lg border border-line-300 px-3 py-1.5 text-xs font-bold text-white hover:border-primary-300 disabled:opacity-50"
        >
            {copied ? "Copied" : label}
        </button>
    );
}

function AttemptList({
    results,
    onPreview,
    compact = false
}: {
    results: RunResult[];
    onPreview: (imageUrl: string, name: string) => void;
    compact?: boolean;
}) {
    const rows = results.filter((result) => result.action !== "running");
    if (rows.length === 0) {
        return <p className={`${compact ? "mt-2" : "mt-4"} text-xs text-ink-400`}>No finished attempts in this run yet.</p>;
    }
    return (
        <ul className={`${compact ? "mt-2 max-h-64" : "mt-4 max-h-[28rem]"} space-y-1 overflow-auto`}>
            {rows.map((result) => {
                const reason = formatReason(result.error, result.status);
                return (
                    <li key={result.capture_id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                            <CaptureThumb
                                imageUrl={captureImageUrl(result.capture_id)}
                                name={result.animal_name || "Unnamed"}
                                onOpen={() => onPreview(captureImageUrl(result.capture_id), result.animal_name || "Unnamed")}
                            />
                            <span className="min-w-0">
                                <span className="font-bold text-white">{result.animal_name || "Unnamed"}</span>
                                <a href={`/p/${result.capture_id}`} target="_blank" rel="noreferrer" className="ml-1.5 font-mono text-[10px] text-primary-100 hover:underline">
                                    {shortId(result.capture_id)}
                                </a>
                                {reason && <span className="ml-1.5 text-red-200">{reason}</span>}
                            </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase ${ACTION_TONE[result.action] ?? ACTION_TONE.unknown}`}>
                            {actionLabel(result.action)}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

function CaptureThumb({
    imageUrl,
    name,
    onOpen
}: {
    imageUrl: string;
    name: string;
    onOpen: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onOpen}
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-line-300 bg-canvas-900"
            aria-label={`View ${name} capture`}
        >
            <Image src={imageUrl} alt={`${name} capture`} fill unoptimized sizes="32px" className="object-cover" />
        </button>
    );
}

function BreakdownCard({
    title,
    rows,
    onSelect,
    selected,
    onClear,
    max
}: {
    title: string;
    rows: Bucket[];
    onSelect?: (key: string) => void;
    selected?: string | null;
    onClear?: () => void;
    max?: number;
}) {
    const widthMax = max ?? Math.max(1, ...rows.map((row) => row.count));
    return (
        <section className="rounded-xl border border-line-300 bg-surface-900 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">{title}</p>
                {onClear && (
                    <button type="button" onClick={onClear} className="text-[10px] font-bold text-primary-100">
                        Clear {selected}
                    </button>
                )}
            </div>
            <ul className="mt-2 space-y-1">
                {rows.map((row) => {
                    const inner = (
                        <>
                            <span className="w-28 truncate text-xs text-white">{row.label}</span>
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                                <span className="block h-full rounded-full bg-primary-400/80" style={{width: `${row.count === 0 ? 0 : Math.max(6, (row.count / widthMax) * 100)}%`}} />
                            </span>
                            <span className="w-7 text-right font-mono text-[10px] text-ink-400">{row.count}</span>
                        </>
                    );
                    return (
                        <li key={row.key}>
                            {onSelect ? (
                                <button type="button" onClick={() => onSelect(row.key)} className={`flex w-full items-center gap-2 text-left ${selected === row.key ? "text-primary-100" : ""}`}>
                                    {inner}
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">{inner}</div>
                            )}
                        </li>
                    );
                })}
                {rows.length === 0 && <li className="text-xs text-ink-400">Nothing here.</li>}
            </ul>
        </section>
    );
}
