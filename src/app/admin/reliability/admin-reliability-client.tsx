"use client";

import {useCallback, useEffect, useMemo, useState} from "react";

/**
 * Failures, grouped and traceable.
 *
 * The list is written so a person reads the summary and only opens the
 * technical detail when they need it: a support conversation starts with "my
 * tiger capture failed", not with a stack trace, and the row answers that
 * question in the same words the member would use.
 */

type Incident = {
    id: number;
    correlationId: string;
    subjectType: string;
    subjectId: string | null;
    userId: string | null;
    stage: string;
    system: string;
    failureCode: string;
    failureCategory: string;
    retryability: string;
    disposition: string;
    attemptCount: number;
    occurrences: number;
    terminal: boolean;
    provider: string | null;
    providerStatus: number | null;
    technicalMessage: string | null;
    metadata: Record<string, unknown> | null;
    firstSeenAt: string;
    lastSeenAt: string;
    recoveredAt: string | null;
    acknowledgedAt: string | null;
    acknowledgedNote: string | null;
};

type Payload = {
    ok: boolean;
    overview: {
        failures_today: number;
        failures_24h: number;
        users_affected_24h: number;
        recovered_24h: number;
        awaiting_user: number;
        terminal_open: number;
        needs_attention: number;
    } | null;
    bySystem: Array<{system: string; incidents: number; occurrences: number; users: number}>;
    incidents: Incident[];
    generatedAt: string;
};

const STATUSES = [
    {value: "open", label: "Open"},
    {value: "needs_attention", label: "Needs attention"},
    {value: "waiting_on_user", label: "Waiting on user"},
    {value: "recovered", label: "Recovered"},
    {value: "acknowledged", label: "Acknowledged"},
    {value: "all", label: "All"}
];

const CATEGORIES = [
    "all", "network", "authentication", "permission", "credits_quota",
    "invalid_media", "no_animal", "authenticity_rejected", "media_unavailable",
    "storage", "ai_provider", "rate_limit", "server", "database", "timeout",
    "cancelled", "unknown"
];

const WINDOWS = [
    {value: "24", label: "Last 24h"},
    {value: "168", label: "Last 7 days"},
    {value: "720", label: "Last 30 days"},
    {value: "", label: "All time"}
];

/** Friendly title for a failure code — the same sentence the member is shown. */
const CODE_TITLES: Record<string, string> = {
    network_unavailable: "No internet connection",
    provider_rate_limited: "Provider rate limited",
    provider_unavailable: "Provider unavailable",
    provider_timeout: "Provider timed out",
    server_error: "Server error",
    database_unavailable: "Database unavailable",
    insufficient_credits: "Not enough credits",
    authentication_required: "Sign-in required",
    instagram_reauthorization_required: "Instagram reconnect required",
    location_unavailable: "Location unavailable",
    wifi_required: "Waiting for Wi-Fi",
    media_too_large: "Capture too large",
    media_unreadable: "Capture unreadable",
    media_missing: "Media never arrived",
    no_animal_detected: "No animal found",
    authenticity_rejected: "Not an original capture",
    source_media_unavailable: "Source post unavailable",
    video_frames_required: "Video needs device frames",
    storage_unavailable: "Storage unavailable",
    cancelled_by_user: "Cancelled",
    unknown: "Unclassified failure"
};

const DISPOSITION_TONE: Record<string, string> = {
    "Recovered": "bg-primary-500/15 text-primary-200",
    "Acknowledged": "bg-ink-700/40 text-ink-300",
    "Waiting on user": "bg-sky-400/15 text-sky-200",
    "Terminal": "bg-red-500/15 text-red-200",
    "Cancelled": "bg-ink-700/40 text-ink-400",
    "Retry scheduled": "bg-amber-400/15 text-amber-200"
};

function ago(iso: string) {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
}

function short(value: string | null) {
    return value ? value.slice(0, 8) : "—";
}

export default function AdminReliabilityClient() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("open");
    const [category, setCategory] = useState("all");
    const [windowHours, setWindowHours] = useState("168");
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<number | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({status, category, limit: "200"});
            if (windowHours) {
                params.set("since", new Date(Date.now() - Number(windowHours) * 3600_000).toISOString());
            }
            const trimmed = search.trim();
            if (trimmed) {
                // One box, three meanings: operators paste whichever id they
                // were given rather than picking a field first.
                if (trimmed.includes("-") && trimmed.length > 30) {
                    params.set("subject", trimmed);
                } else if (trimmed.length > 8) {
                    params.set("correlation", trimmed);
                }
            }
            const response = await fetch(`/api/admin/reliability?${params}`, {cache: "no-store"});
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Request failed");
            setData(payload);
            setError(null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load reliability data");
        } finally {
            setLoading(false);
        }
    }, [status, category, windowHours, search]);

    useEffect(() => { void load(); }, [load]);

    const acknowledge = useCallback(async (id: number) => {
        setBusyId(id);
        try {
            await fetch("/api/admin/reliability", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({id, note: "Investigated from the reliability panel"})
            });
            await load();
        } finally {
            setBusyId(null);
        }
    }, [load]);

    const overview = data?.overview;
    const stats = useMemo(() => ([
        {label: "Failures today", value: overview?.failures_today ?? 0},
        {label: "Last 24h", value: overview?.failures_24h ?? 0},
        {label: "Users affected", value: overview?.users_affected_24h ?? 0},
        {label: "Recovered automatically", value: overview?.recovered_24h ?? 0, tone: "text-primary-200"},
        {label: "Waiting on user", value: overview?.awaiting_user ?? 0, tone: "text-sky-200"},
        {label: "Needs attention", value: overview?.needs_attention ?? 0, tone: "text-amber-200"},
        {label: "Terminal", value: overview?.terminal_open ?? 0, tone: "text-red-200"}
    ]), [overview]);

    return (
        <div className="space-y-8">
            <header>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary-300">Reliability</p>
                <h1 className="mt-2 font-display text-4xl text-white">Failures &amp; recovery</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-400">
                    Every technical failure across capture and import, deduplicated so one broken
                    operation retrying five times is one incident. Open a row for the diagnostics.
                </p>
            </header>

            <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line-300 bg-line-300 sm:grid-cols-4 lg:grid-cols-7">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-canvas-950/80 px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">{stat.label}</p>
                        <p className={`mt-2 font-display text-3xl tabular-nums ${stat.tone ?? "text-white"}`}>{stat.value}</p>
                    </div>
                ))}
            </section>

            <section className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Status</span>
                    <select value={status} onChange={(event) => setStatus(event.target.value)}
                        className="rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-sm text-white">
                        {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Category</span>
                    <select value={category} onChange={(event) => setCategory(event.target.value)}
                        className="rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-sm text-white">
                        {CATEGORIES.map((option) => <option key={option} value={option}>{option.replace(/_/g, " ")}</option>)}
                    </select>
                </label>
                <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Window</span>
                    <select value={windowHours} onChange={(event) => setWindowHours(event.target.value)}
                        className="rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-sm text-white">
                        {WINDOWS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                    </select>
                </label>
                <label className="flex min-w-[16rem] flex-1 flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Capture, candidate or correlation id</span>
                    <input value={search} onChange={(event) => setSearch(event.target.value)}
                        placeholder="Paste any id"
                        className="rounded-xl border border-line-300 bg-canvas-950 px-3 py-2 text-sm text-white placeholder:text-ink-600" />
                </label>
                <button onClick={() => void load()}
                    className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950">
                    Refresh
                </button>
            </section>

            {error && (
                <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
            )}

            {data && data.bySystem.length > 0 && (
                <section className="rounded-2xl border border-line-300 bg-canvas-950/60 p-5">
                    <h2 className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">By system</h2>
                    <ul className="mt-4 space-y-2">
                        {data.bySystem.map((row) => (
                            <li key={row.system} className="flex items-center justify-between gap-4 text-sm">
                                <span className="text-ink-200">{row.system}</span>
                                <span className="flex items-center gap-4 tabular-nums text-ink-400">
                                    <span>{row.incidents} incident{row.incidents === 1 ? "" : "s"}</span>
                                    <span>{row.occurrences} occurrence{row.occurrences === 1 ? "" : "s"}</span>
                                    <span className="font-bold text-white">{row.users} user{row.users === 1 ? "" : "s"}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="space-y-3">
                <h2 className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">
                    {loading ? "Loading incidents…" : `${data?.incidents.length ?? 0} incidents`}
                </h2>

                {!loading && data?.incidents.length === 0 && (
                    <p className="rounded-2xl border border-line-300 bg-canvas-950/60 px-5 py-8 text-center text-sm text-ink-400">
                        Nothing matching those filters. That is the good outcome.
                    </p>
                )}

                {data?.incidents.map((incident) => (
                    <article key={incident.id} className="rounded-2xl border border-line-300 bg-canvas-950/60">
                        <button
                            onClick={() => setExpanded(expanded === incident.id ? null : incident.id)}
                            className="flex w-full flex-col gap-3 px-5 py-4 text-left">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[.08em] ${DISPOSITION_TONE[incident.disposition] ?? "bg-ink-700/40 text-ink-300"}`}>
                                    {incident.disposition}
                                </span>
                                <span className="text-sm font-bold text-white">
                                    {incident.system} · {CODE_TITLES[incident.failureCode] ?? incident.failureCode}
                                </span>
                                {incident.occurrences > 1 && (
                                    <span className="rounded-md bg-ink-700/40 px-2 py-1 text-[10px] font-bold tabular-nums text-ink-300">
                                        ×{incident.occurrences}
                                    </span>
                                )}
                            </div>
                            <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-ink-400">
                                <span>user {short(incident.userId)}</span>
                                <span>{incident.subjectType} {short(incident.subjectId)}</span>
                                <span>stage {incident.stage}</span>
                                <span>attempts {incident.attemptCount}</span>
                                <span>{ago(incident.lastSeenAt)}</span>
                                <span>trace {short(incident.correlationId)}</span>
                            </dl>
                        </button>

                        {expanded === incident.id && (
                            <div className="border-t border-line-300 px-5 py-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Diagnostics</h3>
                                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-black/40 p-4 font-mono text-[11px] leading-5 text-ink-300">
{JSON.stringify({
    correlation_id: incident.correlationId,
    failure_code: incident.failureCode,
    failure_category: incident.failureCategory,
    retryability: incident.retryability,
    stage: incident.stage,
    subject: `${incident.subjectType}:${incident.subjectId ?? "—"}`,
    user_id: incident.userId,
    provider: incident.provider,
    provider_status: incident.providerStatus,
    attempts: incident.attemptCount,
    occurrences: incident.occurrences,
    terminal: incident.terminal,
    first_seen_at: incident.firstSeenAt,
    last_seen_at: incident.lastSeenAt,
    recovered_at: incident.recoveredAt,
    technical_message: incident.technicalMessage,
    metadata: incident.metadata
}, null, 2)}
                                </pre>
                                {!incident.acknowledgedAt && !incident.recoveredAt && (
                                    <button
                                        onClick={() => void acknowledge(incident.id)}
                                        disabled={busyId === incident.id}
                                        className="mt-4 rounded-xl border border-line-300 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                        {busyId === incident.id ? "Marking…" : "Mark investigated"}
                                    </button>
                                )}
                                {incident.acknowledgedNote && (
                                    <p className="mt-3 text-xs text-ink-400">{incident.acknowledgedNote}</p>
                                )}
                            </div>
                        )}
                    </article>
                ))}
            </section>
        </div>
    );
}
