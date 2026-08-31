"use client";

import {useEffect, useState} from "react";

/**
 * Live pipeline health, split by ownership.
 *
 * Analyzer status answers "is server-side analysis functioning?". Client
 * uploads, credit waits, and catalog gaps are listed separately and never
 * flip that status on their own.
 */

type KindRow = {kind: string; total: number};

type Health = {
    status: "healthy" | "degraded" | "down";
    windowHours: number;
    analyses: {
        total: number;
        succeeded: number;
        failed: number;
        failureRate: number;
        serverFailed?: number;
        clientMediaFailed?: number;
        serverFailureRate?: number;
    };
    errorsByKind: KindRow[];
    serverErrorsByKind?: KindRow[];
    clientMediaErrorsByKind?: KindRow[];
    stuckCaptures: number;
    creditBlockedCaptures?: number;
    abandonedPendingCaptures?: number;
    awaitingClientFrames?: number;
    abandonedClientVideo?: number;
    sourceMediaMissing?: number;
    serverQueued?: number;
    serverRunning?: number;
    unlinkedDomesticAnalyses?: number;
    minutesSinceSuccess: number | null;
    import?: {
        active_operations?: number;
        paused_operations?: number;
        candidates_awaiting_screen?: number;
        candidates_awaiting_frames?: number;
        materializations_preparing?: number;
        oldest_active_job_seconds?: number | null;
        quoted_waiting_accept?: number;
        credits_reserved?: number;
        credits_settled_open_jobs?: number;
        slots?: Record<string, {live?: number; per_user_cap?: number; global_cap?: number}>;
    } | null;
};

const TONE = {
    healthy: {dot: "bg-primary-300", text: "text-primary-100", label: "Analyzer healthy"},
    degraded: {dot: "bg-amber-300", text: "text-amber-200", label: "Analyzer degraded"},
    down: {dot: "bg-red-400", text: "text-red-200", label: "Analyzer down"}
};

function ago(minutes: number | null) {
    if (minutes == null) return "never";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function KindList({rows}: {rows: KindRow[]}) {
    if (!rows.length) return null;
    return (
        <ul className="mt-2 space-y-1">
            {rows.slice(0, 5).map((row) => (
                <li key={row.kind} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-mono text-ink-300">{row.kind}</span>
                    <span className="font-bold text-white">{row.total}</span>
                </li>
            ))}
        </ul>
    );
}

export default function PipelineHealth({compact = false}: {compact?: boolean}) {
    const [health, setHealth] = useState<Health | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch("/api/admin/health", {cache: "no-store"});
                const payload = await response.json();
                if (cancelled) return;
                if (!response.ok || !payload.ok) { setFailed(true); return; }
                setHealth(payload);
                setFailed(false);
            } catch {
                if (!cancelled) setFailed(true);
            }
        };

        void load();
        const timer = setInterval(load, 60_000);
        return () => { cancelled = true; clearInterval(timer); };
    }, []);

    if (failed) {
        return <div className="flex items-center gap-2 text-xs font-bold text-ink-500"><span className="h-2 w-2 rounded-full bg-ink-600" />Health unavailable</div>;
    }

    if (!health) {
        return <div className="flex items-center gap-2 text-xs font-bold text-ink-500"><span className="h-2 w-2 animate-pulse rounded-full bg-ink-600" />Checking pipeline…</div>;
    }

    const tone = TONE[health.status];
    const serverFailed = health.analyses.serverFailed ?? 0;
    const serverRate = health.analyses.serverFailureRate ?? 0;

    if (compact) {
        return (
            <div className={`flex items-center gap-2 text-xs font-bold ${tone.text}`}>
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                {tone.label}
                <span className="text-ink-500">
                    · {serverFailed} server / {health.analyses.failed} total failed in {health.windowHours}h
                    {health.stuckCaptures > 0 ? ` · ${health.stuckCaptures} server stuck` : ""}
                </span>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-line-300 bg-surface-900/80 p-4">
            <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] ${tone.text}`}>
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />{tone.label}
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-400">
                {health.analyses.succeeded} analyses completed in the last {health.windowHours}h.
                Server failure rate {serverRate}%. Last success {ago(health.minutesSinceSuccess)}.
                {health.stuckCaptures > 0 && ` ${health.stuckCaptures} genuine server job(s) stuck.`}
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <section>
                    <h3 className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">Server analysis</h3>
                    <p className="mt-1 text-xs text-ink-400">
                        queued {health.serverQueued ?? 0} · running {health.serverRunning ?? 0} · stuck {health.stuckCaptures}
                    </p>
                    <KindList rows={health.serverErrorsByKind ?? []} />
                </section>
                <section>
                    <h3 className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">Client / media</h3>
                    <p className="mt-1 text-xs text-ink-400">
                        {(health.analyses.clientMediaFailed ?? 0) > 0 && `${health.analyses.clientMediaFailed} source-media failure(s). `}
                        {(health.sourceMediaMissing ?? 0) > 0 && `${health.sourceMediaMissing} missing object(s). `}
                        {(health.abandonedPendingCaptures ?? 0) > 0 && `${health.abandonedPendingCaptures} abandoned upload(s). `}
                        {(health.awaitingClientFrames ?? 0) > 0 && `${health.awaitingClientFrames} awaiting client frames. `}
                        {(health.abandonedClientVideo ?? 0) > 0 && `${health.abandonedClientVideo} stale client video(s).`}
                    </p>
                    <KindList rows={health.clientMediaErrorsByKind ?? []} />
                </section>
                <section>
                    <h3 className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">Credits</h3>
                    <p className="mt-1 text-xs text-ink-400">
                        {(health.creditBlockedCaptures ?? 0) === 0
                            ? "None waiting."
                            : `${health.creditBlockedCaptures} waiting on credits.`}
                    </p>
                </section>
                <section>
                    <h3 className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">Catalog</h3>
                    <p className="mt-1 text-xs text-ink-400">
                        {(health.unlinkedDomesticAnalyses ?? 0) === 0
                            ? "No unlinked pet captures."
                            : `${health.unlinkedDomesticAnalyses} pet capture(s) reached their entry without linking, so duplicate merging will skip them.`}
                    </p>
                </section>
                <section className="sm:col-span-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[.14em] text-ink-500">Instagram import</h3>
                    <p className="mt-1 text-xs text-ink-400">
                        Separate from analyzer health. A large archive does not degrade capture analysis.
                    </p>
                    {health.import ? (
                        <p className="mt-1 text-xs text-ink-400">
                            {health.import.active_operations ?? 0} active · {health.import.paused_operations ?? 0} paused
                            · {health.import.quoted_waiting_accept ?? 0} waiting on quote
                            · {health.import.credits_reserved ?? 0} Credits reserved
                            · {health.import.credits_settled_open_jobs ?? 0} Credits settled (24h)
                            · {health.import.candidates_awaiting_screen ?? 0} awaiting screen
                            · {health.import.candidates_awaiting_frames ?? 0} awaiting frames
                            · {health.import.materializations_preparing ?? 0} materializing
                            {health.import.slots
                                ? ` · slots ${Object.entries(health.import.slots)
                                    .map(([stage, row]) => `${stage} ${row.live ?? 0}/${row.global_cap ?? "?"}`)
                                    .join(", ")}`
                                : ""}
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-ink-500">Import health unavailable until the backpressure migration is applied.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
