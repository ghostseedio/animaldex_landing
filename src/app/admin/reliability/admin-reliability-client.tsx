"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import {AdminPage, Alert, Badge, Button, Card, CardHeader, EmptyState, Field, fieldClass, ListSkeleton, PageHeader, RefreshButton, Section, Stat, StatGrid, StatGridSkeleton} from "@/components/admin/ui";

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

const DISPOSITION_TONE: Record<string, "good" | "neutral" | "ios" | "bad" | "warn"> = {
    "Recovered": "good",
    "Acknowledged": "neutral",
    "Waiting on user": "ios",
    "Terminal": "bad",
    "Cancelled": "neutral",
    "Retry scheduled": "warn"
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
        {label: "Recovered automatically", value: overview?.recovered_24h ?? 0, tone: "good" as const},
        {label: "Waiting on user", value: overview?.awaiting_user ?? 0, sky: true},
        {label: "Needs attention", value: overview?.needs_attention ?? 0, tone: "warn" as const},
        {label: "Terminal", value: overview?.terminal_open ?? 0, tone: "bad" as const}
    ]), [overview]);

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Operations"
                title="Failures & recovery"
                description="Every technical failure across capture and import, deduplicated so one broken operation retrying five times is one incident. Open a row for the diagnostics."
                actions={<RefreshButton loading={loading} onClick={() => void load()} />}
            />

            {data ? (
                <StatGrid className="mt-6 sm:grid-cols-4 lg:grid-cols-7">
                    {stats.map((stat) => (
                        <Stat
                            key={stat.label}
                            label={stat.label}
                            value={stat.sky ? <span className="text-sky-200">{stat.value}</span> : stat.value}
                            tone={stat.tone}
                        />
                    ))}
                </StatGrid>
            ) : loading ? (
                <StatGridSkeleton count={7} className="mt-6 sm:grid-cols-4 lg:grid-cols-7" />
            ) : null}

            <div className="mt-6 flex flex-wrap items-end gap-3">
                <Field label="Status">
                    <select value={status} onChange={(event) => setStatus(event.target.value)}
                        className={fieldClass}>
                        {STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </Field>
                <Field label="Category">
                    <select value={category} onChange={(event) => setCategory(event.target.value)}
                        className={fieldClass}>
                        {CATEGORIES.map((option) => <option key={option} value={option}>{option.replace(/_/g, " ")}</option>)}
                    </select>
                </Field>
                <Field label="Window">
                    <select value={windowHours} onChange={(event) => setWindowHours(event.target.value)}
                        className={fieldClass}>
                        {WINDOWS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                    </select>
                </Field>
                <Field label="Capture, candidate or correlation id" className="min-w-[16rem] flex-1">
                    <input value={search} onChange={(event) => setSearch(event.target.value)}
                        placeholder="Paste any id"
                        className={fieldClass} />
                </Field>
            </div>

            {error && (
                <Alert tone="bad" className="mt-6">{error}</Alert>
            )}

            {data && data.bySystem.length > 0 && (
                <Card className="mt-6">
                    <CardHeader title="By system" />
                    <ul className="divide-y divide-line-300/60">
                        {data.bySystem.map((row) => (
                            <li key={row.system} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                                <span className="text-ink-200">{row.system}</span>
                                <span className="flex items-center gap-4 tabular-nums text-ink-400">
                                    <span>{row.incidents} incident{row.incidents === 1 ? "" : "s"}</span>
                                    <span>{row.occurrences} occurrence{row.occurrences === 1 ? "" : "s"}</span>
                                    <span className="font-bold text-white">{row.users} user{row.users === 1 ? "" : "s"}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <Section title={loading && !data ? "Loading incidents…" : `${data?.incidents.length ?? 0} incidents`} className="space-y-2">
                {loading && !data && <ListSkeleton rows={6} />}

                {!loading && data?.incidents.length === 0 && (
                    <EmptyState title="Nothing matching those filters." description="That is the good outcome." />
                )}

                {data?.incidents.map((incident) => (
                    <article key={incident.id} className="border border-line-300 bg-surface-900">
                        <button
                            onClick={() => setExpanded(expanded === incident.id ? null : incident.id)}
                            className="flex w-full flex-col gap-3 px-4 py-4 text-left transition hover:bg-white/[.02]">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={DISPOSITION_TONE[incident.disposition] ?? "neutral"}>
                                    {incident.disposition}
                                </Badge>
                                <span className="text-sm font-bold text-white">
                                    {incident.system} · {CODE_TITLES[incident.failureCode] ?? incident.failureCode}
                                </span>
                                {incident.occurrences > 1 && (
                                    <Badge className="tabular-nums">
                                        ×{incident.occurrences}
                                    </Badge>
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
                            <div className="border-t border-line-300 px-4 py-4">
                                <h3 className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Diagnostics</h3>
                                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words border border-line-300 bg-canvas-950 p-4 font-mono text-[11px] leading-5 text-ink-300">
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
                                    <Button
                                        onClick={() => void acknowledge(incident.id)}
                                        loading={busyId === incident.id}
                                        className="mt-4">
                                        {busyId === incident.id ? "Marking…" : "Mark investigated"}
                                    </Button>
                                )}
                                {incident.acknowledgedNote && (
                                    <p className="mt-3 text-xs text-ink-400">{incident.acknowledgedNote}</p>
                                )}
                            </div>
                        )}
                    </article>
                ))}
            </Section>
        </AdminPage>
    );
}
