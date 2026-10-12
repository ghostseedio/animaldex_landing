"use client";

import {useEffect, useState, type ReactNode} from "react";
import {cn, Skeleton, Spinner} from "@/components/admin/ui";

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
        mergedShellFailures?: number;
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
    burstDuplicateHolds?: number;
    oldestBurstHoldHours?: number | null;
    analysedButNotReady?: number;
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
    healthy: {dot: "bg-primary-300", text: "text-primary-100", edge: "border-l-primary-400", label: "Analyzer healthy"},
    degraded: {dot: "bg-amber-300", text: "text-amber-200", edge: "border-l-amber-400", label: "Analyzer degraded"},
    down: {dot: "bg-red-400", text: "text-red-200", edge: "border-l-red-400", label: "Analyzer down"}
};

function ago(minutes: number | null) {
    if (minutes == null) return "never";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

/** One labelled cell of the full report. */
function Block({title, className, children}: {title: string; className?: string; children: ReactNode}) {
    return (
        <section className={cn("bg-surface-900 p-4", className)}>
            <h3 className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">{title}</h3>
            {children}
        </section>
    );
}

function KindList({rows}: {rows: KindRow[]}) {
    if (!rows.length) return null;
    return (
        <ul className="mt-2 space-y-1">
            {rows.slice(0, 5).map((row) => (
                <li key={row.kind} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-mono text-ink-300">{row.kind}</span>
                    <span className="font-bold tabular-nums text-white">{row.total}</span>
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
        const line = <div className="flex items-center gap-2 text-xs font-bold text-ink-500"><span className="h-2 w-2 rounded-full bg-ink-600" />Health unavailable</div>;
        return compact ? line : <div className="border border-line-300 bg-surface-900 p-4">{line}</div>;
    }

    if (!health) {
        if (compact) {
            return <div className="flex items-center gap-2 text-xs font-bold text-ink-500"><Spinner size={12} />Checking pipeline…</div>;
        }
        // Shaped like the report so the overview does not jump when it lands.
        return (
            <div role="status" aria-label="Checking pipeline" className="border border-line-300 bg-surface-900">
                <div className="space-y-2.5 border-b border-line-300 p-4">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-2.5 w-3/4" />
                </div>
                <div className="grid gap-px bg-line-300 sm:grid-cols-2">
                    {Array.from({length: 4}, (_, index) => (
                        <div key={index} className="space-y-2 bg-surface-900 p-4">
                            <Skeleton className="h-2.5 w-24" />
                            <Skeleton className="h-2.5 w-2/3" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const tone = TONE[health.status];
    const serverFailed = health.analyses.serverFailed ?? 0;
    const serverRate = health.analyses.serverFailureRate ?? 0;

    if (compact) {
        return (
            <div className={`flex items-center gap-2 text-xs font-bold ${tone.text}`}>
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                {tone.label}
                <span className="tabular-nums text-ink-500">
                    · {serverFailed} server / {health.analyses.failed} total failed in {health.windowHours}h
                    {health.stuckCaptures > 0 ? ` · ${health.stuckCaptures} server stuck` : ""}
                </span>
            </div>
        );
    }

    return (
        <div className="border border-line-300 bg-surface-900">
            <div className={`border-b border-l-[3px] border-b-line-300 p-4 ${tone.edge}`}>
                <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] ${tone.text}`}>
                    <span className={`h-2 w-2 rounded-full ${tone.dot}`} />{tone.label}
                </div>
                <p className="mt-2 text-xs leading-5 text-ink-400">
                    {health.analyses.succeeded} analyses completed in the last {health.windowHours}h.
                    Server failure rate {serverRate}%. Last success {ago(health.minutesSinceSuccess)}.
                    {health.stuckCaptures > 0 && ` ${health.stuckCaptures} genuine server job(s) stuck.`}
                </p>
            </div>

            <div className="grid gap-px bg-line-300 sm:grid-cols-2">
                <Block title="Server analysis">
                    <p className="mt-1 text-xs text-ink-400">
                        queued {health.serverQueued ?? 0} · running {health.serverRunning ?? 0} · stuck {health.stuckCaptures}
                    </p>
                    <KindList rows={health.serverErrorsByKind ?? []} />
                </Block>
                <Block title="Client / media">
                    <p className="mt-1 text-xs text-ink-400">
                        {(health.analyses.clientMediaFailed ?? 0) > 0 && `${health.analyses.clientMediaFailed} source-media failure(s). `}
                        {(health.sourceMediaMissing ?? 0) > 0 && `${health.sourceMediaMissing} missing object(s). `}
                        {(health.abandonedPendingCaptures ?? 0) > 0 && `${health.abandonedPendingCaptures} abandoned upload(s). `}
                        {(health.awaitingClientFrames ?? 0) > 0 && `${health.awaitingClientFrames} awaiting client frames. `}
                        {(health.abandonedClientVideo ?? 0) > 0 && `${health.abandonedClientVideo} stale client video(s).`}
                    </p>
                    <KindList rows={health.clientMediaErrorsByKind ?? []} />
                    {(health.analyses.mergedShellFailures ?? 0) > 0 ? (
                        <p className="mt-1 text-[11px] text-ink-500">
                            {health.analyses.mergedShellFailures} merged burst shell(s) not counted. Their photos live on the primary capture.
                        </p>
                    ) : null}
                </Block>
                <Block title="Waiting on an owner decision">
                    <p className="mt-1 text-xs text-ink-400">
                        {(health.burstDuplicateHolds ?? 0) === 0 && (health.analysedButNotReady ?? 0) === 0
                            ? "Nothing held."
                            : null}
                        {(health.burstDuplicateHolds ?? 0) > 0 && `${health.burstDuplicateHolds} held as a possible burst duplicate${health.oldestBurstHoldHours != null ? ` (oldest ${ago(health.oldestBurstHoldHours * 60)})` : ""}. The apps have no release or attach action yet. `}
                        {(health.analysedButNotReady ?? 0) > 0 && `${health.analysedButNotReady} analysed but still marked uploading.`}
                    </p>
                </Block>
                <Block title="Credits">
                    <p className="mt-1 text-xs text-ink-400">
                        {(health.creditBlockedCaptures ?? 0) === 0
                            ? "None waiting."
                            : `${health.creditBlockedCaptures} waiting on credits.`}
                    </p>
                </Block>
                <Block title="Catalog">
                    <p className="mt-1 text-xs text-ink-400">
                        {(health.unlinkedDomesticAnalyses ?? 0) === 0
                            ? "No unlinked pet captures."
                            : `${health.unlinkedDomesticAnalyses} pet capture(s) reached their entry without linking, so duplicate merging will skip them.`}
                    </p>
                </Block>
                <Block title="Instagram import" className="sm:col-span-2">
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
                </Block>
            </div>
        </div>
    );
}
