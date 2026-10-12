"use client";

import Link from "next/link";
import {useCallback, useEffect, useState} from "react";
import {AltArrowRight, CheckCircle} from "solar-icon-set";
import PipelineHealth from "@/app/admin/_components/pipeline-health";
import {AdminPage, buttonVariants, cn, PageHeader, RefreshButton, Section, Skeleton, Stat, StatGrid} from "@/components/admin/ui";

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

function delta(change: number | null | undefined): {text: string; tone: "good" | "bad"} | null {
    if (change == null || !Number.isFinite(change)) return null;
    const up = change >= 0;
    return {text: `${up ? "▲" : "▼"} ${Math.abs(Math.round(change))}% vs last period`, tone: up ? "good" : "bad"};
}

function KpiStat({label, value, change, href, loading}: {label: string; value: string; change?: number | null; href: string; loading: boolean}) {
    const d = delta(change);
    return <Stat label={label} value={value} delta={d?.text} deltaTone={d?.tone} href={href} loading={loading} />;
}

/** One line per thing a person has to decide about. Silent when all is well. */
function Attention({jobs, integrity, loading}: {jobs: Jobs | null; integrity: Integrity | null; loading: boolean}) {
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

    if (rows.length === 0 && loading) {
        return (
            <div className="flex items-center gap-3 border border-line-300 bg-surface-900 px-4 py-3.5" aria-hidden="true">
                <Skeleton className="h-2 w-2" />
                <Skeleton className="h-3 w-56" />
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <p className="flex items-center gap-2.5 border border-primary-400/20 bg-primary-500/[.06] px-4 py-3.5 text-sm font-bold text-primary-100">
                <CheckCircle size={16} className="shrink-0 text-primary-300" />
                Nothing needs a person right now.
            </p>
        );
    }

    return (
        <ul className="divide-y divide-line-300 border border-line-300 bg-surface-900">
            {rows.map((row) => (
                <li key={row.label}>
                    <Link
                        href={row.href}
                        className={cn(
                            "group flex items-center gap-3 border-l-[3px] px-4 py-3 transition hover:bg-white/[.03]",
                            row.tone === "bad" ? "border-l-red-400" : "border-l-amber-400",
                        )}
                    >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${row.tone === "bad" ? "bg-red-400" : "bg-amber-400"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-bold ${row.tone === "bad" ? "text-red-200" : "text-amber-200"}`}>{row.label}</span>
                            <span className="block text-xs text-ink-400">{row.detail}</span>
                        </span>
                        <AltArrowRight size={14} className="shrink-0 text-ink-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
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
        <AdminPage>
            <PageHeader
                eyebrow="Overview"
                title="Run AnimalDex"
                description="Everything needing a person, the numbers behind it, and what the capture pipeline is doing."
                actions={
                    <>
                        <RefreshButton loading={loading} onClick={() => void load()} />
                        <Link href="/admin/metrics" className={buttonVariants({variant: "primary", size: "sm"})}>
                            Open metrics
                        </Link>
                    </>
                }
            />

            <Section title="Needs attention" className="mt-6">
                <Attention jobs={jobs} integrity={integrity} loading={loading} />
            </Section>

            <Section title="Headline numbers">
                <StatGrid>
                    <KpiStat label="Accounts" value={num(totals?.users)} change={kpis?.users.change} href="/admin/users" loading={loading && !metrics} />
                    <KpiStat label="Captures" value={num(totals?.captures)} change={kpis?.captures.change} href="/admin/catalog" loading={loading && !metrics} />
                    <KpiStat label="Active Pro" value={num(totals?.activePro)} change={kpis?.subscriptions.change} href="/admin/metrics" loading={loading && !metrics} />
                    <KpiStat label="Purchases" value={num(totals?.productionPurchases)} change={kpis?.credits.change} href="/admin/metrics" loading={loading && !metrics} />
                </StatGrid>
            </Section>

            <div className="grid gap-x-4 xl:grid-cols-[2fr_1fr]">
                <Section title="Capture pipeline">
                    <PipelineHealth />
                </Section>
                <Section title="Scheduled jobs">
                    <Link href="/admin/jobs" className="group block border border-line-300 bg-surface-900 p-4 transition hover:border-primary-400/50">
                        {jobs?.summary ? (
                            <p className="font-display text-3xl tabular-nums text-white">
                                {jobs.summary.total - jobs.summary.failing - jobs.summary.late}
                                <span className="text-ink-500">/{jobs.summary.total}</span>
                            </p>
                        ) : loading ? (
                            <Skeleton className="mt-1 h-8 w-20" />
                        ) : (
                            <p className="font-display text-3xl text-white">—</p>
                        )}
                        <p className="mt-1 text-sm text-ink-300">running on schedule</p>
                        {jobs?.summary && (jobs.summary.paused > 0 || jobs.summary.neverRun > 0) ? (
                            <p className="mt-3 text-xs text-ink-500">
                                {jobs.summary.paused} paused · {jobs.summary.neverRun} never run
                            </p>
                        ) : null}
                        <p className="mt-4 flex items-center gap-1 text-xs font-bold text-primary-200">
                            Open scheduler
                            <AltArrowRight size={12} className="transition group-hover:translate-x-0.5" />
                        </p>
                    </Link>
                </Section>
            </div>
        </AdminPage>
    );
}
