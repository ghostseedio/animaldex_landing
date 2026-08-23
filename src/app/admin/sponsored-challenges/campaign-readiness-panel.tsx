"use client";

import type {ReadinessResult} from "@/lib/sponsored-challenge-readiness";

export function CampaignReadinessPanel({result}: {result: ReadinessResult}) {
    return (
        <section className="space-y-3 rounded-2xl border border-line-300 bg-canvas-950/40 p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Campaign readiness</p>
                    <h3 className="mt-1 font-display text-2xl text-white">{result.passed} / {result.total} checks passed</h3>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${
                    result.ready
                        ? "border-primary-300 text-primary-100"
                        : "border-rose-400/40 text-rose-100"
                }`}>
                    {result.ready ? "Ready" : "Not ready"}
                </span>
            </div>
            <ul className="space-y-2">
                {result.checks.map((check) => (
                    <li key={check.id} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                            <p className="text-ink-100">{check.label}</p>
                            {check.detail ? <p className="mt-0.5 text-xs text-ink-400">{check.detail}</p> : null}
                        </div>
                        <SeverityBadge severity={check.severity} />
                    </li>
                ))}
            </ul>
            <p className="text-[11px] text-ink-500">These checks do not replace backend validation. Save, submit, and approve can still reject.</p>
        </section>
    );
}

function SeverityBadge({severity}: {severity: "ready" | "warning" | "blocking"}) {
    const className = severity === "ready"
        ? "border-primary-300/50 text-primary-100"
        : severity === "warning"
            ? "border-amber-400/40 text-amber-100"
            : "border-rose-400/40 text-rose-100";
    const label = severity === "ready" ? "Ready" : severity === "warning" ? "Warning" : "Blocking";
    return (
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[.12em] ${className}`}>
            {label}
        </span>
    );
}
