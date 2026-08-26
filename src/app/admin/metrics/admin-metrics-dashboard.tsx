"use client";

import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";
import {aheadBehind, cumulativeTargetByDay, daysInMonth, expectedByDay, requiredPerDay, statusForMetric, type GrowthMetricKey, type GrowthTargets} from "@/lib/growth-command-center";

type Period = "day" | "week" | "month";
type SeriesRow = {date: string; users: number; captures: number; subscriptions: number; credits: number};
type PostType = "captures" | "alignments" | "fusions" | "challenges" | "trades";
type PostSeriesRow = {date: string} & Record<PostType, number>;
type Metrics = {
    period: Period;
    generatedAt: string;
    totals: {users: number | null; captures: number | null; activePro: number | null; productionPurchases: number | null};
    kpis: Record<"users" | "captures" | "subscriptions" | "credits", {value: number; change: number}>;
    purchaseBreakdown: {production: number; sandbox: number};
    signIn: {total: number; providers: Record<string, number>; appleDeviceSignals: number; note: string} | null;
    postActivity: {total: number; types: Record<PostType, {value: number; change: number}>; series: PostSeriesRow[]};
    series: SeriesRow[];
};
type SocialMetric = {platform: string; configured: boolean; followers: number | null; views: number | null; posts: number | null; followerChange?: number | null; viewChange?: number | null; error?: string};
type ChartMetric = "users" | "captures" | "subscriptions" | "credits";
type GrowthChartMetric = "users" | "captures" | "socialViews" | "searchClicks";
type GrowthWeek = {label: string; startDay: number; endDay: number; targets: GrowthTargets};
type GrowthActionPlan = {label: string; startDay: number; endDay: number; items: string[]};
type GrowthPlan = {month: string; targets: GrowthTargets; weeklyTargets: GrowthWeek[]; weeklyActionPlans: GrowthActionPlan[]};
type GrowthDaily = {date: string; day: number; users: number; captures: number; marketing: {date: string; socialViews: number; searchClicks: number; adSpend: number; paidUsers: number; notes: string}};
type GrowthResult = {month: string; targets: GrowthTargets; actuals: GrowthTargets};
type GrowthData = {ok: boolean; month: string; timezone: string; today?: string; currentDay?: number; totalDays?: number; plan: GrowthPlan | null; previousPlan: GrowthPlan | null; actuals?: GrowthTargets; daily?: GrowthDaily[]; weeklyActuals?: Array<{label: string; startDay: number; endDay: number; actuals: GrowthTargets}>; monthResult?: GrowthResult | null; previousMonthResult?: GrowthResult | null; error?: string};
const periodLabels: Record<Period, {tab: string; range: string; detail: string}> = {
    day: {tab: "Daily", range: "Last 30 days", detail: "30 daily buckets, not the last 24 hours"},
    week: {tab: "Weekly", range: "Last 12 weeks", detail: "12 seven-day buckets"},
    month: {tab: "Monthly", range: "Last 12 months", detail: "12 roughly monthly buckets"}
};

const metricMeta: Record<ChartMetric, {label: string; color: string; description: string}> = {
    users: {label: "New users", color: "#59f176", description: "Profiles created"},
    captures: {label: "Captures", color: "#57b8ff", description: "Animals captured"},
    subscriptions: {label: "New Pro", color: "#f6bd55", description: "Production Pro purchases"},
    credits: {label: "Credits bought", color: "#b997ff", description: "Purchased credit units"}
};

const growthMeta: Record<GrowthMetricKey, {label: string; kind: "AUTO" | "MANUAL"; budget?: boolean; money?: boolean}> = {
    users: {label: "New users", kind: "AUTO"},
    captures: {label: "Captures", kind: "AUTO"},
    socialViews: {label: "Social views", kind: "MANUAL"},
    searchClicks: {label: "Google clicks", kind: "MANUAL"},
    activePro: {label: "Active Pro", kind: "AUTO"},
    adSpend: {label: "Ad spend", kind: "MANUAL", budget: true, money: true}
};

const postTypeMeta: Record<PostType, {label: string; shortLabel: string; color: string; description: string}> = {
    captures: {label: "Animal captures", shortLabel: "Captures", color: "#59f176", description: "Discoverable animal posts"},
    alignments: {label: "Daily Alignments", shortLabel: "Alignments", color: "#57b8ff", description: "Shared accepted journal proofs"},
    fusions: {label: "Principle Fusions", shortLabel: "Fusions", color: "#b997ff", description: "Learned principle events"},
    challenges: {label: "Challenges", shortLabel: "Challenges", color: "#f6bd55", description: "Completed animal matchups"},
    trades: {label: "Accepted trades", shortLabel: "Trades", color: "#ff7f8f", description: "Completed capture trades"}
};

function format(value: number | null, money = false) {
    if (value == null) return "-";
    return new Intl.NumberFormat("en", {notation: value >= 10000 && !money ? "compact" : "standard", style: money ? "currency" : "decimal", currency: money ? "USD" : undefined, maximumFractionDigits: money ? 2 : 0}).format(value);
}

function monthLabel(month: string) {
    return new Intl.DateTimeFormat("en", {month: "long", year: "numeric", timeZone: "UTC"}).format(new Date(`${month}-01T00:00:00Z`));
}

function shiftMonth(month: string, delta: number) {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function statusLabel(status: string) {
    return status === "on_target" ? "ON TARGET" : status === "close" ? "CLOSE" : status === "future" ? "FUTURE" : "BEHIND";
}

function statusClass(status: string) {
    if (status === "on_target") return "border-primary-400/30 bg-primary-500/10 text-primary-100";
    if (status === "close") return "border-amber-300/30 bg-amber-400/10 text-amber-200";
    if (status === "future") return "border-line-300 bg-white/[.03] text-ink-400";
    return "border-red-400/30 bg-red-500/10 text-red-200";
}

function progressFillClass(status: string) {
    if (status === "on_target") return "bg-primary-400";
    if (status === "close") return "bg-amber-300";
    if (status === "future") return "bg-white/20";
    return "bg-red-400";
}

function percentOf(actual: number, target: number) {
    return target > 0 ? Math.round((actual / target) * 100) : 0;
}

function PlanResult({result, previous}: {result: GrowthResult | null | undefined; previous: GrowthResult | null | undefined}) {
    if (!result) return null;
    return <div className="mt-6 rounded-xl border border-line-300 bg-canvas-900 p-4"><h3 className="font-display text-2xl text-white">{monthLabel(result.month)} result</h3><div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{(Object.keys(growthMeta) as GrowthMetricKey[]).map((key) => { const actual = result.actuals[key]; const target = result.targets[key]; const prior = previous?.actuals[key]; const change = prior && prior > 0 ? Math.round(((actual - prior) / prior) * 100) : null; return <div key={key} className="rounded-lg border border-line-300 bg-surface-900 p-3"><p className="text-xs font-black uppercase tracking-[.14em] text-ink-500">{growthMeta[key].label}</p><p className="mt-2 text-lg font-black text-white">{format(actual, growthMeta[key].money)} / {format(target, growthMeta[key].money)} - {percentOf(actual, target)}%</p>{change != null ? <p className="mt-1 text-xs text-ink-400">{monthLabel(previous!.month)} to {monthLabel(result.month)}: {change >= 0 ? "+" : ""}{change}%</p> : null}</div>;})}</div></div>;
}

function MiniChart({rows, metric, target}: {rows: GrowthDaily[]; metric: GrowthChartMetric; target: number}) {
    const totalDays = rows.length || 1;
    const targetLine = cumulativeTargetByDay(target, totalDays);
    let running = 0;
    const actualLine = rows.map((row) => {
        running += metric === "users" ? row.users : metric === "captures" ? row.captures : row.marketing[metric];
        return running;
    });
    const max = Math.max(1, target, ...actualLine);
    const points = (values: number[]) => values.map((value, index) => `${index * (900 / Math.max(1, totalDays - 1))},${220 - (value / max) * 190}`).join(" ");
    return <div className="overflow-x-auto"><svg viewBox="0 0 900 245" className="max-h-44 min-w-[620px] w-full" role="img" aria-label="Target versus actual"><line x1="0" x2="900" y1="220" y2="220" stroke="rgba(255,255,255,.12)" /><polyline points={points(targetLine)} fill="none" stroke="#84958b" strokeWidth="4" strokeDasharray="8 8" /><polyline points={points(actualLine)} fill="none" stroke="#59f176" strokeWidth="5" /><text x="10" y="20" fill="#84958b" fontSize="12">target</text><text x="70" y="20" fill="#59f176" fontSize="12">actual</text></svg></div>;
}

function TrendChart({rows, metric, period}: {rows: SeriesRow[]; metric: ChartMetric; period: Period}) {
    const max = Math.max(1, ...rows.map((row) => row[metric]));
    const gap = 900 / Math.max(rows.length, 1);
    return <div className="overflow-x-auto"><svg viewBox="0 0 900 260" className="min-w-[520px] w-full" role="img" aria-label={`${metricMeta[metric].label} trend`}>{[0, 1, 2, 3, 4].map((line) => <line key={line} x1="0" x2="900" y1={20 + line * 52} y2={20 + line * 52} stroke="rgba(255,255,255,.07)" />)}{rows.map((row, index) => { const barHeight = (row[metric] / max) * 210; return <g key={row.date}><rect x={index * gap + gap * .19} y={230 - barHeight} width={Math.max(3, gap * .62)} height={barHeight} rx="4" fill={metricMeta[metric].color} opacity=".88" /><text x={index * gap + gap / 2} y="252" textAnchor="middle" fill="#84958b" fontSize="10">{(rows.length <= 12 || index % Math.ceil(rows.length / 8) === 0) ? new Intl.DateTimeFormat("en", period === "month" ? {month: "short"} : {month: "short", day: "numeric"}).format(new Date(row.date)) : ""}</text></g>;})}</svg></div>;
}

function PostTypeChart({rows, period}: {rows: PostSeriesRow[]; period: Period}) {
    const keys = Object.keys(postTypeMeta) as PostType[];
    const max = Math.max(1, ...rows.map((row) => keys.reduce((sum, key) => sum + row[key], 0)));
    const gap = 900 / Math.max(rows.length, 1);
    return <div className="overflow-x-auto"><svg viewBox="0 0 900 270" className="min-w-[560px] w-full" role="img" aria-label="Discover post types over time">{rows.map((row, index) => { let accumulated = 0; return <g key={row.date}>{keys.map((key) => { const barHeight = (row[key] / max) * 210; const y = 230 - accumulated - barHeight; accumulated += barHeight; return <rect key={key} x={index * gap + gap * .16} y={y} width={Math.max(5, gap * .68)} height={barHeight} rx="2" fill={postTypeMeta[key].color} />;})}<text x={index * gap + gap / 2} y="254" textAnchor="middle" fill="#84958b" fontSize="10">{(rows.length <= 12 || index % Math.ceil(rows.length / 8) === 0) ? new Intl.DateTimeFormat("en", period === "month" ? {month: "short"} : {month: "short", day: "numeric"}).format(new Date(row.date)) : ""}</text></g>;})}</svg></div>;
}

function friendlyGrowthError(message: string) {
    if (message.includes("growth_monthly_plans") && (message.includes("PGRST205") || message.includes("schema cache") || message.includes("Could not find the table"))) {
        return "Growth tables are not in Supabase yet. Apply supabase/migrations/20260826090000_growth_command_center.sql, then retry.";
    }
    return message;
}

function GrowthCommandCenter({growth, month, setMonth, reload}: {growth: GrowthData | null; month: string; setMonth: (month: string) => void; reload: () => Promise<void>}) {
    const [chartMetric, setChartMetric] = useState<GrowthChartMetric>("users");
    const [editingDate, setEditingDate] = useState<GrowthDaily | null>(null);
    const [editingPlan, setEditingPlan] = useState(false);
    const [planError, setPlanError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const plan = growth?.plan;
    const totalDays = growth?.totalDays ?? daysInMonth(month);
    const currentDay = growth?.currentDay ?? 0;
    const usersExpected = plan ? expectedByDay(plan.targets.users, currentDay || totalDays, totalDays) : 0;
    const usersActual = growth?.actuals?.users ?? 0;
    const userDelta = aheadBehind(usersActual, usersExpected);
    const required = plan ? requiredPerDay(usersActual, plan.targets.users, currentDay, totalDays) : 0;
    const thisWeek = plan?.weeklyActionPlans.find((week) => currentDay >= week.startDay && currentDay <= week.endDay) ?? plan?.weeklyActionPlans[0];

    async function saveMarketing(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!editingDate) return;
        const form = new FormData(event.currentTarget);
        setSaving(true);
        await fetch("/api/admin/growth", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "save-marketing", date: editingDate.date, marketing: {socialViews: form.get("socialViews"), searchClicks: form.get("searchClicks"), adSpend: form.get("adSpend"), paidUsers: form.get("paidUsers"), notes: form.get("notes")}})});
        setSaving(false);
        setEditingDate(null);
        await reload();
    }

    async function createPlan(copy: boolean) {
        const source = copy ? growth?.previousPlan : null;
        const blankTargets = {users: 0, captures: 0, socialViews: 0, searchClicks: 0, activePro: 0, adSpend: 0};
        try {
            setPlanError(null);
            setSaving(true);
            const response = await fetch("/api/admin/growth", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "save-plan", month, targets: source?.targets ?? blankTargets, weeklyTargets: source?.weeklyTargets ?? [], weeklyActionPlans: source?.weeklyActionPlans ?? []})});
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to create plan");
            await reload();
            setEditingPlan(true);
        } catch (caught) {
            setPlanError(friendlyGrowthError(caught instanceof Error ? caught.message : "Unable to create plan"));
        } finally {
            setSaving(false);
        }
    }

    async function savePlan(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!plan) return;
        const form = new FormData(event.currentTarget);
        try {
            setPlanError(null);
            setSaving(true);
            const targets = JSON.parse(String(form.get("targets") ?? "{}"));
            const weeklyTargets = JSON.parse(String(form.get("weeklyTargets") ?? "[]"));
            const weeklyActionPlans = JSON.parse(String(form.get("weeklyActionPlans") ?? "[]"));
            const response = await fetch("/api/admin/growth", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "save-plan", month, targets, weeklyTargets, weeklyActionPlans})});
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to save plan");
            setEditingPlan(false);
            await reload();
        } catch (caught) {
            setPlanError(friendlyGrowthError(caught instanceof Error ? caught.message : "Invalid plan JSON"));
        } finally {
            setSaving(false);
        }
    }

    return <section className="mt-5 rounded-xl border border-line-300 bg-surface-900 p-3 sm:p-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
            <div><p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">Month plan</p><h2 className="mt-1 font-display text-2xl text-white">{monthLabel(month)} Growth Plan</h2><p className="mt-1 text-[11px] text-ink-500">Asia/Jakarta calendar</p></div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold"><button className="rounded-lg border border-line-300 px-2.5 py-1.5 text-ink-300" onClick={() => setMonth(shiftMonth(month, -1))}>← {monthLabel(shiftMonth(month, -1))}</button><span className="rounded-lg bg-primary-500 px-2.5 py-1.5 text-canvas-950">{monthLabel(month)}</span><button className="rounded-lg border border-line-300 px-2.5 py-1.5 text-ink-300" onClick={() => setMonth(shiftMonth(month, 1))}>{monthLabel(shiftMonth(month, 1))} →</button>{plan ? <button className="rounded-lg border border-line-300 px-2.5 py-1.5 text-white" onClick={() => setEditingPlan(true)}>Edit plan</button> : null}</div>
        </div>
        {!plan ? <div className="mt-4 rounded-lg border border-line-300 bg-canvas-900 p-4"><h3 className="font-display text-xl text-white">Create {monthLabel(month)} Growth Plan</h3>{planError ? <p className="mt-2 text-sm text-red-300">{planError}</p> : null}<div className="mt-3 flex flex-wrap gap-2"><button disabled={saving} onClick={() => createPlan(true)} className="rounded-lg bg-primary-500 px-3 py-2 text-xs font-black text-canvas-950 disabled:opacity-50">Copy previous targets</button><button disabled={saving} onClick={() => createPlan(false)} className="rounded-lg border border-line-300 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{saving ? "Creating..." : "Start blank"}</button></div></div> : <>
            <PlanResult result={growth?.monthResult} previous={growth?.previousMonthResult} />
            <div className={`mt-4 flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${statusClass(statusForMetric(usersActual, usersExpected))}`}><div><p className="text-[11px] font-black uppercase tracking-[.14em]">{userDelta >= 0 ? "On target" : "Behind target"}</p><p className="mt-1 text-sm text-ink-100">{format(usersActual)} users so far · expected {format(usersExpected)} · {format(Math.abs(userDelta))} {userDelta >= 0 ? "ahead" : "behind"}</p></div>{userDelta < 0 ? <p className="text-xs font-bold text-ink-200">{format(required)}/day needed</p> : null}</div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{(Object.keys(growthMeta) as GrowthMetricKey[]).map((key) => { const target = plan.targets[key]; const actual = growth?.actuals?.[key] ?? 0; const expected = key === "activePro" ? target : expectedByDay(target, currentDay || totalDays, totalDays); const status = statusForMetric(actual, expected, {lowerIsBudget: growthMeta[key].budget}); const percent = target ? Math.min(999, Math.round(actual / target * 100)) : 0; const delta = growthMeta[key].budget ? expected - actual : actual - expected; return <div key={key} className="rounded-lg border border-line-300 bg-canvas-900 p-3"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-400">{growthMeta[key].label}</p><span className="text-[10px] font-black text-ink-500">{growthMeta[key].kind}</span></div><div className="mt-2 flex items-end justify-between gap-2"><p className="font-display text-2xl text-white">{format(actual, growthMeta[key].money)}</p><p className="pb-1 text-xs text-ink-500">/ {format(target, growthMeta[key].money)}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.07]"><div className={`h-full rounded-full ${progressFillClass(status)}`} style={{width: `${Math.min(100, percent)}%`}} /></div><div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-400"><span>{percent}% · exp {format(expected, growthMeta[key].money)}</span><span>{growthMeta[key].budget ? (delta >= 0 ? `${format(delta, true)} left` : `${format(Math.abs(delta), true)} over`) : (delta >= 0 ? `+${format(delta)}` : `${format(delta)}`)}</span></div><span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${statusClass(status)}`}>{statusLabel(status)}</span></div>;})}</div>
            <div className="mt-4 rounded-lg border border-line-300 bg-canvas-900 p-3"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><h3 className="font-display text-xl text-white">{growthMeta[chartMetric].label} - Target vs Actual</h3><p className="text-[11px] text-ink-500">Cumulative trajectory</p></div><div className="grid grid-cols-2 gap-1 rounded-lg border border-line-300 bg-surface-900 p-1 sm:flex">{(["users", "captures", "socialViews", "searchClicks"] as GrowthChartMetric[]).map((key) => <button key={key} onClick={() => setChartMetric(key)} className={`rounded-md px-2 py-1.5 text-[11px] font-black ${chartMetric === key ? "bg-primary-500 text-canvas-950" : "text-ink-400"}`}>{growthMeta[key].label}</button>)}</div></div><MiniChart rows={growth?.daily ?? []} metric={chartMetric} target={plan.targets[chartMetric]} /></div>
            <div className="mt-4"><h3 className="font-display text-xl text-white">Weekly progress</h3><div className="mt-2 grid gap-2 xl:grid-cols-5">{plan.weeklyTargets.map((week) => { const weekActuals = growth?.weeklyActuals?.find((row) => row.label === week.label)?.actuals; const actual = weekActuals?.users ?? 0; const future = currentDay > 0 && week.startDay > currentDay; const status = statusForMetric(actual, week.targets.users, {future}); const current = currentDay >= week.startDay && currentDay <= week.endDay; return <div key={week.label} className={`rounded-lg border p-3 ${current ? "border-primary-300 bg-primary-500/[.08]" : "border-line-300 bg-canvas-900"}`}><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-400">{week.label}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${statusClass(status)}`}>{statusLabel(status)}</span></div><p className="mt-2 text-xs text-white">Users {format(actual)} / {format(week.targets.users)} · {percentOf(actual, week.targets.users)}%</p><p className="mt-1 text-[11px] text-ink-400">Cap {format(weekActuals?.captures ?? 0)} / {format(week.targets.captures)} · Views {format(weekActuals?.socialViews ?? 0)} / {format(week.targets.socialViews)}</p></div>;})}</div></div>
            <details className="mt-4 rounded-lg border border-line-300 bg-canvas-900 p-3" open><summary className="cursor-pointer font-display text-xl text-white">This week plan</summary><div className="mt-2"><p className="text-xs font-black text-primary-100">{thisWeek?.label}</p><ul className="mt-2 grid gap-1.5 text-xs text-ink-300 sm:grid-cols-2">{thisWeek?.items.map((item) => <li key={item} className="rounded-md border border-line-300 bg-surface-900 px-2.5 py-1.5">{item}</li>)}</ul></div></details>
            <div className="mt-4"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h3 className="font-display text-xl text-white">Daily pace</h3><p className="text-[11px] text-ink-500">External entries are daily values, not cumulative totals.</p></div><button onClick={() => setEditingDate((growth?.daily ?? []).find((row) => row.date === growth?.today) ?? growth?.daily?.[0] ?? null)} className="rounded-lg bg-primary-500 px-3 py-2 text-xs font-black text-canvas-950">Update marketing numbers</button></div><div className="mt-2 max-h-[30rem] overflow-auto rounded-lg border border-line-300"><table className="min-w-[820px] w-full text-left text-xs"><thead className="sticky top-0 bg-canvas-900 text-[10px] uppercase tracking-[.12em] text-ink-500"><tr>{["Date", "Users", "Captures", "Social", "Clicks", "Spend", "Status", ""].map((head) => <th key={head} className="px-2.5 py-2">{head}</th>)}</tr></thead><tbody>{(growth?.daily ?? []).map((row) => { const future = growth?.today ? row.date > growth.today : false; const status = statusForMetric(row.users, expectedByDay(plan.targets.users, 1, totalDays), {future}); const today = row.date === growth?.today; return <tr key={row.date} className={today ? "bg-primary-500/[.08]" : "odd:bg-white/[.02]"}><td className="px-2.5 py-1.5 font-bold text-white">{new Intl.DateTimeFormat("en", {month: "short", day: "numeric", timeZone: "UTC"}).format(new Date(`${row.date}T00:00:00Z`))}</td><td className="px-2.5 py-1.5">{format(row.users)} <span className="text-[9px] text-primary-100">AUTO</span></td><td className="px-2.5 py-1.5">{format(row.captures)} <span className="text-[9px] text-primary-100">AUTO</span></td><td className="px-2.5 py-1.5">{format(row.marketing.socialViews)}</td><td className="px-2.5 py-1.5">{format(row.marketing.searchClicks)}</td><td className="px-2.5 py-1.5">{format(row.marketing.adSpend, true)}</td><td className="px-2.5 py-1.5"><span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${statusClass(status)}`}>{today ? "TODAY" : statusLabel(status)}</span></td><td className="px-2.5 py-1.5"><button onClick={() => setEditingDate(row)} className="text-[11px] font-black text-primary-100">Edit</button></td></tr>;})}</tbody></table></div></div>
        </>}
        {editingPlan && plan ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form onSubmit={savePlan} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line-300 bg-surface-900 p-5"><h3 className="font-display text-2xl text-white">Edit {monthLabel(month)} plan</h3><p className="mt-1 text-xs text-ink-500">Plan data is stored as structured JSON so API integrations can replace manual fields later.</p><label className="mt-4 block text-sm font-bold text-ink-300">Monthly targets<textarea name="targets" rows={7} defaultValue={JSON.stringify(plan.targets, null, 2)} className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 font-mono text-xs text-white outline-none focus:border-primary-300" /></label><label className="mt-4 block text-sm font-bold text-ink-300">Weekly targets<textarea name="weeklyTargets" rows={9} defaultValue={JSON.stringify(plan.weeklyTargets, null, 2)} className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 font-mono text-xs text-white outline-none focus:border-primary-300" /></label><label className="mt-4 block text-sm font-bold text-ink-300">Weekly action plans<textarea name="weeklyActionPlans" rows={9} defaultValue={JSON.stringify(plan.weeklyActionPlans, null, 2)} className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 font-mono text-xs text-white outline-none focus:border-primary-300" /></label>{planError ? <p className="mt-3 text-sm text-red-300">{planError}</p> : null}<div className="mt-5 flex gap-2"><button disabled={saving} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950">{saving ? "Saving..." : "Save plan"}</button><button type="button" onClick={() => setEditingPlan(false)} className="rounded-xl border border-line-300 px-4 py-2 text-sm font-black text-white">Cancel</button></div></form></div> : null}
        {editingDate ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form onSubmit={saveMarketing} className="w-full max-w-md rounded-2xl border border-line-300 bg-surface-900 p-5"><h3 className="font-display text-2xl text-white">{new Intl.DateTimeFormat("en", {dateStyle: "long", timeZone: "UTC"}).format(new Date(`${editingDate.date}T00:00:00Z`))}</h3>{[["Social views", "socialViews"], ["Google Search clicks", "searchClicks"], ["Ad spend", "adSpend"], ["Paid users/installs", "paidUsers"]].map(([label, name]) => <label key={name} className="mt-4 block text-sm font-bold text-ink-300">{label}<input name={name} type="number" step={name === "adSpend" ? "0.01" : "1"} defaultValue={(editingDate.marketing as unknown as Record<string, number>)[name]} className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-white outline-none focus:border-primary-300" /></label>)}<label className="mt-4 block text-sm font-bold text-ink-300">Notes<textarea name="notes" defaultValue={editingDate.marketing.notes} className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-white outline-none focus:border-primary-300" /></label><div className="mt-5 flex gap-2"><button disabled={saving} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950">{saving ? "Saving..." : "Save"}</button><button type="button" onClick={() => setEditingDate(null)} className="rounded-xl border border-line-300 px-4 py-2 text-sm font-black text-white">Cancel</button></div></form></div> : null}
    </section>;
}

export default function AdminMetricsDashboard() {
    const [period, setPeriod] = useState<Period>("day");
    const [metric, setMetric] = useState<ChartMetric>("users");
    const [data, setData] = useState<Metrics | null>(null);
    const [growthMonth, setGrowthMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [growth, setGrowth] = useState<GrowthData | null>(null);
    const [social, setSocial] = useState<SocialMetric[]>([]);
    const [password, setPassword] = useState("");
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [socialLoading, setSocialLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function loadGrowth(month = growthMonth) {
        const response = await fetch(`/api/admin/growth?month=${month}`, {cache: "no-store"});
        if (response.status === 401) { setAuthorized(false); return; }
        const body = await response.json();
        if (response.ok && body.ok) setGrowth(body);
    }

    async function loadMetrics(nextPeriod: Period = period) {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/metrics?period=${nextPeriod}`, {cache: "no-store"});
            if (response.status === 401) { setAuthorized(false); return; }
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load metrics");
            setData(body);
            setAuthorized(true);
            await loadGrowth(growthMonth);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load metrics");
        } finally {
            setLoading(false);
        }
    }

    async function syncSocial() {
        setSocialLoading(true);
        try {
            const response = await fetch("/api/admin/social-metrics", {cache: "no-store"});
            const body = await response.json();
            if (response.ok && body.ok) setSocial(body.metrics);
        } finally {
            setSocialLoading(false);
        }
    }

    useEffect(() => { void loadMetrics(); void syncSocial(); }, []);
    useEffect(() => { if (authorized) void loadGrowth(growthMonth); }, [growthMonth, authorized]);

    async function login(event: FormEvent) {
        event.preventDefault();
        const response = await fetch("/api/admin/support/login", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({password})});
        const body = await response.json();
        if (!response.ok || !body.ok) { setError(body.error || "Unable to sign in"); return; }
        setPassword("");
        await loadMetrics(period);
        await syncSocial();
    }

    const rangeLabel = useMemo(() => periodLabels[period].range, [period]);

    if (authorized === false) return <main className="grid min-h-screen place-items-center bg-canvas-950 px-4"><form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">AnimalDex admin</p><h1 className="mt-2 font-display text-3xl text-white">Metrics</h1><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" className="mt-6 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-white outline-none focus:border-primary-300" /><button className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-black text-canvas-950">Sign in</button>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}</form></main>;

    return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(27,196,81,.1),transparent_28%)] p-4 text-ink-100 sm:p-7"><div className="mx-auto max-w-[96rem]"><header className="flex flex-col justify-between gap-4 border-b border-line-300 pb-5 sm:flex-row sm:items-end"><div><Link href="/admin" className="text-sm text-ink-400 hover:text-white">← Admin</Link><h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Growth metrics</h1><p className="mt-1 text-sm text-ink-400">{rangeLabel} · {periodLabels[period].detail}</p><Link href="/admin/users" className="mt-2 inline-flex text-sm font-bold text-primary-100 hover:text-primary-200">View users, buyers & LTV →</Link></div><div className="grid w-full grid-cols-3 rounded-lg border border-line-300 bg-surface-900 p-1 sm:flex sm:w-auto">{(["day", "week", "month"] as Period[]).map((item) => <button key={item} onClick={() => {setPeriod(item); void loadMetrics(item);}} className={`rounded-md px-3 py-2 text-xs font-black ${period === item ? "bg-primary-500 text-canvas-950" : "text-ink-400"}`}>{periodLabels[item].tab}</button>)}</div></header>{error && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}{loading && !data ? <div className="py-20 text-center text-ink-400">Loading growth data...</div> : data && <><GrowthCommandCenter growth={growth} month={growthMonth} setMonth={setGrowthMonth} reload={() => loadGrowth(growthMonth)} /><section className="mt-7 border-t border-line-300 pt-6"><p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Product growth</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(Object.keys(metricMeta) as ChartMetric[]).map((key) => { const item = data.kpis[key]; return <button key={key} onClick={() => setMetric(key)} className={`rounded-xl border p-4 text-left transition ${metric === key ? "border-primary-300 bg-primary-500/[.08]" : "border-line-300 bg-surface-900 hover:border-line-200"}`}><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.15em] text-ink-400">{metricMeta[key].label}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.change >= 0 ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>{item.change >= 0 ? "+" : ""}{item.change}%</span></div><p className="mt-2 font-display text-3xl text-white">{format(item.value)}</p><p className="mt-1 text-xs text-ink-500">{metricMeta[key].description}</p></button>;})}</div><section className="mt-4 rounded-xl border border-line-300 bg-surface-900 p-4"><div className="flex items-center justify-between"><div><h2 className="font-display text-xl text-white">{metricMeta[metric].label}</h2><p className="text-xs text-ink-500">{rangeLabel}</p></div><span className="h-3 w-3 rounded-full" style={{background: metricMeta[metric].color}} /></div><div className="mt-3"><TrendChart rows={data.series} metric={metric} period={period} /></div></section></section><section className="mt-7 border-t border-line-300 pt-6"><p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Users / monetisation</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data.totals).map(([key, value]) => <div key={key} className="rounded-xl border border-line-300 bg-canvas-900 p-4"><p className="text-xs capitalize text-ink-500">{key.replace(/([A-Z])/g, " $1")}</p><p className="mt-1 font-display text-2xl text-white">{format(value)}</p></div>)}</div></section>{data.signIn && <section className="mt-7 border-t border-line-300 pt-6"><p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Accounts</p><h2 className="mt-2 font-display text-2xl text-white">How people sign in</h2><p className="mt-1 max-w-3xl text-sm text-ink-400">{format(data.signIn.total)} accounts. A provider is not a platform, so device evidence is counted separately.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data.signIn.providers).sort((left, right) => right[1] - left[1]).map(([provider, count]) => <div key={provider} className="rounded-xl border border-line-300 bg-canvas-900 p-4"><p className="text-xs capitalize text-ink-500">{provider}</p><p className="mt-1 font-display text-2xl text-white">{format(count)}</p></div>)}</div><div className="mt-3 rounded-xl border border-line-300 bg-canvas-900 p-4"><p className="text-xs text-ink-500">Confirmed Apple devices</p><p className="mt-1 font-display text-2xl text-white">{format(data.signIn.appleDeviceSignals)}</p><p className="mt-2 text-[11px] leading-4 text-ink-500">{data.signIn.note}</p></div></section>}<section className="mt-7 border-t border-line-300 pt-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Discover activity</p><h2 className="mt-2 font-display text-2xl text-white">Post types</h2><p className="mt-1 text-sm text-ink-400">What users are sharing · {format(data.postActivity.total)} total in this period</p></div><span className="w-fit rounded-full border border-line-300 bg-surface-900 px-3 py-1.5 text-xs font-bold text-ink-300">{rangeLabel}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{(Object.keys(postTypeMeta) as PostType[]).sort((left, right) => data.postActivity.types[right].value - data.postActivity.types[left].value).map((key, index) => { const item = data.postActivity.types[key]; const share = data.postActivity.total ? Math.round(item.value / data.postActivity.total * 100) : 0; return <div key={key} className="rounded-xl border border-line-300 bg-surface-900 p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{background: postTypeMeta[key].color}} /><p className="text-xs font-black text-white">{postTypeMeta[key].shortLabel}</p></div><span className="text-[10px] font-bold text-ink-500">#{index + 1}</span></div><div className="mt-3 flex items-end justify-between gap-2"><p className="font-display text-2xl text-white">{format(item.value)}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.change >= 0 ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>{item.change >= 0 ? "+" : ""}{item.change}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full" style={{width: `${share}%`, background: postTypeMeta[key].color}} /></div><p className="mt-2 text-[11px] text-ink-500">{share}% · {postTypeMeta[key].description}</p></div>;})}</div><div className="mt-4 rounded-xl border border-line-300 bg-surface-900 p-4"><div className="flex flex-wrap gap-x-4 gap-y-2">{(Object.keys(postTypeMeta) as PostType[]).map((key) => <span key={key} className="flex items-center gap-1.5 text-[11px] font-bold text-ink-300"><span className="h-2 w-2 rounded-sm" style={{background: postTypeMeta[key].color}} />{postTypeMeta[key].shortLabel}</span>)}</div><div className="mt-3"><PostTypeChart rows={data.postActivity.series} period={period} /></div></div></section></> }<section className="mt-7 border-t border-line-300 pt-6"><div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Audience</p><h2 className="mt-2 font-display text-2xl text-white">Social channels</h2></div><button onClick={syncSocial} disabled={socialLoading} className="w-full rounded-lg border border-line-300 px-4 py-2 text-xs font-black text-white disabled:opacity-50 sm:w-auto">{socialLoading ? "Syncing..." : "Sync now"}</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{social.map((item) => <div key={item.platform} className="rounded-xl border border-line-300 bg-surface-900 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">{item.platform}</h3><span className={`h-2.5 w-2.5 rounded-full ${item.configured && !item.error ? "bg-primary-300" : "bg-amber-300"}`} /></div>{item.configured ? <><div className="mt-3 flex items-end justify-between gap-2"><div><p className="font-display text-2xl text-white">{format(item.followers)}</p><p className="text-xs text-ink-500">followers</p></div>{item.followerChange != null && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.followerChange >= 0 ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>{item.followerChange >= 0 ? "+" : ""}{format(item.followerChange)}</span>}</div><div className="mt-3 flex gap-4 text-xs text-ink-300"><span>{format(item.views)} views/likes{item.viewChange != null ? ` (${item.viewChange >= 0 ? "+" : ""}${format(item.viewChange)})` : ""}</span><span>{format(item.posts)} posts</span></div>{item.error && <p className="mt-3 text-xs text-red-300">{item.error}</p>}</> : <p className="mt-3 text-sm leading-6 text-ink-400">Add this platform API credentials to enable syncing.</p>}</div>)}</div><p className="mt-3 text-xs text-ink-500">Social platforms only expose metrics through approved APIs. Snapshot history begins when credentials are configured and Sync now is used.</p></section></div></main>;
}
