"use client";

import {useEffect, useState} from "react";

/**
 * Live pipeline health, in place of a hardcoded "System online".
 *
 * A claim about the system that is written into the markup is worth nothing; it
 * said "All systems operational" through every failure in this repo's history.
 */

type Health = {
    status: "healthy" | "degraded" | "down";
    windowHours: number;
    analyses: {total: number; succeeded: number; failed: number; failureRate: number};
    errorsByKind: Array<{kind: string; total: number}>;
    stuckCaptures: number;
    unlinkedDomesticAnalyses?: number;
    minutesSinceSuccess: number | null;
};

const TONE = {
    healthy: {dot: "bg-primary-300", text: "text-primary-100", label: "Pipeline healthy"},
    degraded: {dot: "bg-amber-300", text: "text-amber-200", label: "Pipeline degraded"},
    down: {dot: "bg-red-400", text: "text-red-200", label: "Pipeline down"}
};

function ago(minutes: number | null) {
    if (minutes == null) return "never";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
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
        // Cheap enough to keep current while an operator watches it.
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

    if (compact) {
        return (
            <div className={`flex items-center gap-2 text-xs font-bold ${tone.text}`}>
                <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                {tone.label}
                <span className="text-ink-500">
                    · {health.analyses.failed} of {health.analyses.total} failed in {health.windowHours}h
                    {health.stuckCaptures > 0 ? ` · ${health.stuckCaptures} stuck` : ""}
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
                {health.analyses.succeeded} analyses completed and {health.analyses.failed} failed in the last{" "}
                {health.windowHours}h ({health.analyses.failureRate}% failure rate). Last success {ago(health.minutesSinceSuccess)}.
                {health.stuckCaptures > 0 && ` ${health.stuckCaptures} capture(s) stuck mid-flight.`}
                {(health.unlinkedDomesticAnalyses ?? 0) > 0 && ` ${health.unlinkedDomesticAnalyses} pet capture(s) reached their entry without linking to it, so duplicate merging will skip them.`}
            </p>
            {health.errorsByKind.length > 0 && (
                <ul className="mt-3 space-y-1">
                    {health.errorsByKind.slice(0, 5).map((row) => (
                        <li key={row.kind} className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate font-mono text-ink-300">{row.kind}</span>
                            <span className="font-bold text-white">{row.total}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
