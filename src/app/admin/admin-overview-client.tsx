"use client";

import Link from "next/link";
import {useCallback, useEffect, useState} from "react";
import {AltArrowRight, Refresh} from "solar-icon-set";
import PipelineHealth from "@/app/admin/_components/pipeline-health";

/**
 * What is happening right now, not a second copy of the menu.
 *
 * This page used to be fifteen large cards, one per admin tool. Once the
 * sidebar reached every page that was navigation rendered twice, and the thing
 * an operator actually opens /admin for -- is anything broken, and are the
 * numbers moving -- was not on it at all.
 *
 * Three bands, in the order you care about them: what needs a person, the
 * headline numbers, and the capture pipeline's own report.
 */

type Metrics = {
    ok: boolean;
    totals?: {users: number; captures: number; activePro: number; productionPurchases: number};
    kpis?: Record<"users" | "captures" | "subscriptions" | "credits", {value: number; change: number | null}>;
};

type Jobs = {ok: boolean; summary?: {total: number; failing: number; late: number; neverRun: number; paused: number}};
type Integrity = {ok: boolean; summary?: {accounts: number; strong: number; backdating: number}};

function num(value: number | undefined): string {
    return value == null ? "—" : new Intl.NumberFormat("en-GB").format(value);
}

function Delta({change}: {change: number | null | undefined}) {
    if (change == null || !Number.isFinite(change)) return null;
    const up = change >= 0;
    return (
        <span className={`text-xs font-bold ${up ? "text-primary-200" : "text-red-300"}`}>
            {up ? "▲" : "▼"} {Math.abs(Math.round(change))}%
        </span>
    );
}

function Stat({label, value, change, href}: {label: string; value: string; change?: number | null; href?: string}) {
    const body = (
        <>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">{label}</p>
            <p className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl text-white sm:text-4xl">{value}</span>
                <Delta change={change} />
            </p>
        </>
    );
    const className = "rounded-2xl border border-line-300 bg-surface-900 px-4 py-4 transition hover:border-primary-400/50";
    return href ? (
        <Link href={href} className={`${className} block`}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}

/** One line per thing a person has to decide about. Silent when all is well. */
function Attention({jobs, integrity}: {jobs: Jobs | null; integrity: Integrity | null}) {
    const rows: {label: string; detail: string; href: string; tone: "bad" | "warn"}[] = [];

    if (jobs?.summary?.failing) {
        rows.push({
            label: `${jobs.summary.failing} scheduled job${jobs.summary.failing === 1 ? "" : "s"} failing`,
            detail: "Last run returned an error",
            href: "/admin/jobs",
            tone: "bad"
        });
    }
    if (jobs?.summary?.late) {
        rows.push({
            label: `${jobs.summary.late} job${jobs.summary.late === 1 ? "" : "s"} overdue`,
            detail: "Past the gap its schedule implies",
            href: "/admin/jobs",
            tone: "warn"
        });
    }
    if (integrity?.summary?.strong) {
        rows.push({
            label: `${integrity.summary.strong} account${integrity.summary.strong === 1 ? "" : "s"} on two or more provenance signals`,
            detail: "Fabricated capture origin is likely",
            href: "/admin/integrity",
            tone: "bad"
        });
    } else if (integrity?.summary?.accounts) {
        rows.push({
            label: `${integrity.summary.accounts} account${integrity.summary.accounts === 1 ? "" : "s"} on a single provenance signal`,
            detail: "Usually noise — worth a glance",
            href: "/admin/integrity",
            tone: "warn"
        });
    }

    if (rows.length === 0) {
        return (
            <p className="rounded-2xl border border-primary-400/20 bg-primary-500/[.06] px-4 py-3 text-sm font-bold text-primary-100">
                Nothing needs a person right now.
            </p>
        );
    }

    return (
        <ul className="space-y-2">
            {rows.map((row) => (
                <li key={row.label}>
                    <Link
                        href={row.href}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                            row.tone === "bad"
                                ? "border-red-400/30 bg-red-500/10 hover:border-red-400/60"
                                : "border-amber-400/30 bg-amber-500/10 hover:border-amber-400/60"
                        }`}
                    >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${row.tone === "bad" ? "bg-red-400" : "bg-amber-400"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-bold ${row.tone === "bad" ? "text-red-200" : "text-amber-200"}`}>{row.label}</span>
                            <span className="block text-xs text-ink-400">{row.detail}</span>
                        </span>
                        <AltArrowRight size={14} className="shrink-0 text-ink-500" />
                    </Link>
                </li>
            ))}
        </ul>
    );
}

export default function AdminOverviewClient() {
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [jobs, setJobs] = useState<Jobs | null>(null);
    const [integrity, setIntegrity] = useState<Integrity | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        // Settled, not all: one console being unreachable must not blank the
        // whole overview — a half-populated page is still useful.
        const [m, j, i] = await Promise.allSettled([
            fetch("/api/admin/metrics", {cache: "no-store"}).then((r) => r.json()),
            fetch("/api/admin/jobs", {cache: "no-store"}).then((r) => r.json()),
            fetch("/api/admin/integrity", {cache: "no-store"}).then((r) => r.json())
        ]);
        if (m.status === "fulfilled") setMetrics(m.value);
        if (j.status === "fulfilled") setJobs(j.value);
        if (i.status === "fulfilled") setIntegrity(i.value);
        setLoading(false);
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const totals = metrics?.totals;
    const kpis = metrics?.kpis;

    return (
        <main className="bg-[radial-gradient(circle_at_20%_0%,rgba(33,192,94,.12),transparent_28%)] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary-200">Overview</p>
                    <h1 className="mt-1 font-display text-4xl leading-[1.02] text-white sm:text-5xl">Run AnimalDex.</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-300">Everything needing a person, the numbers behind it, and what the capture pipeline is doing.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void load()}
                        className="inline-flex items-center gap-2 rounded-xl border border-line-300 px-3 py-2 text-xs font-bold text-white transition hover:border-primary-300"
                    >
                        <Refresh size={14} />
                        {loading ? "Refreshing…" : "Refresh"}
                    </button>
                    <Link href="/admin/metrics" className="rounded-xl bg-primary-400 px-4 py-2.5 text-sm font-black text-canvas-950">Open metrics</Link>
                </div>
            </header>

            <section className="mt-8" aria-label="Needs attention">
                <h2 className="mb-3 text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Needs attention</h2>
                <Attention jobs={jobs} integrity={integrity} />
            </section>

            <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Headline numbers">
                <Stat label="Accounts" value={num(totals?.users)} change={kpis?.users.change} href="/admin/users" />
                <Stat label="Captures" value={num(totals?.captures)} change={kpis?.captures.change} href="/admin/catalog" />
                <Stat label="Active Pro" value={num(totals?.activePro)} change={kpis?.subscriptions.change} href="/admin/metrics" />
                <Stat label="Purchases" value={num(totals?.productionPurchases)} change={kpis?.credits.change} href="/admin/metrics" />
            </section>

            <section className="mt-8 grid gap-4 xl:grid-cols-[2fr_1fr]" aria-label="Capture pipeline">
                <div>
                    <h2 className="mb-3 text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Capture pipeline</h2>
                    <PipelineHealth />
                </div>
                <div>
                    <h2 className="mb-3 text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Scheduled jobs</h2>
                    <Link
                        href="/admin/jobs"
                        className="block rounded-2xl border border-line-300 bg-surface-900 p-4 transition hover:border-primary-400/50"
                    >
                        <p className="font-display text-3xl text-white">
                            {jobs?.summary ? `${jobs.summary.total - jobs.summary.failing - jobs.summary.late}/${jobs.summary.total}` : "—"}
                        </p>
                        <p className="mt-1 text-sm text-ink-300">running on schedule</p>
                        {jobs?.summary && (jobs.summary.paused > 0 || jobs.summary.neverRun > 0) ? (
                            <p className="mt-3 text-xs text-ink-500">
                                {jobs.summary.paused} paused · {jobs.summary.neverRun} never run
                            </p>
                        ) : null}
                    </Link>
                </div>
            </section>
        </main>
    );
}
