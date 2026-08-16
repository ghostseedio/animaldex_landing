"use client";

import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";

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
    signIn: {
        total: number;
        providers: Record<string, number>;
        appleDeviceSignals: number;
        note: string;
    } | null;
    postActivity: {
        total: number;
        types: Record<PostType, {value: number; change: number}>;
        series: PostSeriesRow[];
    };
    series: SeriesRow[];
};
type SocialMetric = {platform: string; configured: boolean; followers: number | null; views: number | null; posts: number | null; followerChange?: number | null; viewChange?: number | null; error?: string};
type ChartMetric = "users" | "captures" | "subscriptions" | "credits";

const metricMeta: Record<ChartMetric, {label: string; color: string; description: string}> = {
    users: {label: "New users", color: "#59f176", description: "Profiles created"},
    captures: {label: "Captures", color: "#57b8ff", description: "Animals captured"},
    subscriptions: {label: "New Pro", color: "#f6bd55", description: "Production Pro purchases"},
    credits: {label: "Credits bought", color: "#b997ff", description: "Purchased credit units"}
};

const postTypeMeta: Record<PostType, {label: string; shortLabel: string; color: string; description: string}> = {
    captures: {label: "Animal captures", shortLabel: "Captures", color: "#59f176", description: "Discoverable animal posts"},
    alignments: {label: "Daily Alignments", shortLabel: "Alignments", color: "#57b8ff", description: "Shared accepted journal proofs"},
    fusions: {label: "Principle Fusions", shortLabel: "Fusions", color: "#b997ff", description: "Learned principle events"},
    challenges: {label: "Challenges", shortLabel: "Challenges", color: "#f6bd55", description: "Completed animal matchups"},
    trades: {label: "Accepted trades", shortLabel: "Trades", color: "#ff7f8f", description: "Completed capture trades"}
};

function format(value: number | null) {
    return value == null ? "—" : new Intl.NumberFormat("en", {notation: value >= 10000 ? "compact" : "standard"}).format(value);
}

function TrendChart({rows, metric, period}: {rows: SeriesRow[]; metric: ChartMetric; period: Period}) {
    const values = rows.map((row) => row[metric]);
    const max = Math.max(1, ...values);
    const width = 900;
    const height = 260;
    const gap = width / Math.max(rows.length, 1);
    const barWidth = Math.max(3, gap * 0.62);

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[520px] w-full" role="img" aria-label={`${metricMeta[metric].label} trend`}>
                {[0, 1, 2, 3, 4].map((line) => <line key={line} x1="0" x2={width} y1={20 + line * 52} y2={20 + line * 52} stroke="rgba(255,255,255,.07)" />)}
                {rows.map((row, index) => {
                    const barHeight = (row[metric] / max) * 210;
                    return (
                        <g key={row.date}>
                            <rect x={index * gap + (gap - barWidth) / 2} y={230 - barHeight} width={barWidth} height={barHeight} rx="4" fill={metricMeta[metric].color} opacity=".88">
                                <title>{`${new Date(row.date).toLocaleDateString()}: ${row[metric]}`}</title>
                            </rect>
                            {(rows.length <= 12 || index % Math.ceil(rows.length / 8) === 0) && (
                                <text x={index * gap + gap / 2} y="252" textAnchor="middle" fill="#84958b" fontSize="10">
                                    {new Intl.DateTimeFormat("en", period === "month" ? {month: "short"} : {month: "short", day: "numeric"}).format(new Date(row.date))}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function PostTypeChart({rows, period}: {rows: PostSeriesRow[]; period: Period}) {
    const keys = Object.keys(postTypeMeta) as PostType[];
    const totals = rows.map((row) => keys.reduce((sum, key) => sum + row[key], 0));
    const max = Math.max(1, ...totals);
    const width = 900;
    const height = 270;
    const gap = width / Math.max(rows.length, 1);
    const barWidth = Math.max(5, gap * 0.68);

    return (
        <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[560px] w-full" role="img" aria-label="Discover post types over time">
                {[0, 1, 2, 3, 4].map((line) => <line key={line} x1="0" x2={width} y1={20 + line * 52} y2={20 + line * 52} stroke="rgba(255,255,255,.07)" />)}
                {rows.map((row, index) => {
                    let accumulated = 0;
                    return <g key={row.date}>
                        {keys.map((key) => {
                            const barHeight = (row[key] / max) * 210;
                            const y = 230 - accumulated - barHeight;
                            accumulated += barHeight;
                            return <rect key={key} x={index * gap + (gap - barWidth) / 2} y={y} width={barWidth} height={barHeight} rx="2" fill={postTypeMeta[key].color}><title>{`${postTypeMeta[key].label}: ${row[key]}`}</title></rect>;
                        })}
                        {(rows.length <= 12 || index % Math.ceil(rows.length / 8) === 0) && <text x={index * gap + gap / 2} y="254" textAnchor="middle" fill="#84958b" fontSize="10">{new Intl.DateTimeFormat("en", period === "month" ? {month: "short"} : {month: "short", day: "numeric"}).format(new Date(row.date))}</text>}
                    </g>;
                })}
            </svg>
        </div>
    );
}

export default function AdminMetricsDashboard() {
    const [period, setPeriod] = useState<Period>("day");
    const [metric, setMetric] = useState<ChartMetric>("users");
    const [data, setData] = useState<Metrics | null>(null);
    const [social, setSocial] = useState<SocialMetric[]>([]);
    const [password, setPassword] = useState("");
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [socialLoading, setSocialLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    useEffect(() => { loadMetrics(); void syncSocial(); }, []);

    async function login(event: FormEvent) {
        event.preventDefault();
        const response = await fetch("/api/admin/support/login", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({password})});
        const body = await response.json();
        if (!response.ok || !body.ok) { setError(body.error || "Unable to sign in"); return; }
        setPassword("");
        await loadMetrics(period);
        await syncSocial();
    }

    const rangeLabel = useMemo(() => period === "day" ? "Last 30 days" : period === "week" ? "Last 12 weeks" : "Last 12 months", [period]);

    if (authorized === false) {
        return <main className="grid min-h-screen place-items-center bg-canvas-950 px-4"><form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">AnimalDex admin</p><h1 className="mt-2 font-display text-3xl text-white">Metrics</h1><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" className="mt-6 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-white outline-none focus:border-primary-300" /><button className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-black text-canvas-950">Sign in</button>{error && <p className="mt-3 text-sm text-red-300">{error}</p>}</form></main>;
    }

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(27,196,81,.1),transparent_28%)] p-4 text-ink-100 sm:p-7">
            <div className="mx-auto max-w-[96rem]">
                <header className="flex flex-col justify-between gap-4 border-b border-line-300 pb-6 sm:flex-row sm:items-end">
                    <div><Link href="/admin" className="text-sm text-ink-400 hover:text-white">← Admin</Link><h1 className="mt-3 font-display text-4xl text-white sm:text-5xl">Growth metrics</h1><p className="mt-2 text-sm text-ink-400">{rangeLabel} · production purchases separated from sandbox</p><Link href="/admin/users" className="mt-3 inline-flex text-sm font-bold text-primary-100 hover:text-primary-200">View users, buyers & LTV →</Link></div>
                    <div className="grid w-full grid-cols-3 rounded-xl border border-line-300 bg-surface-900 p-1 sm:flex sm:w-auto">{(["day", "week", "month"] as Period[]).map((item) => <button key={item} onClick={() => {setPeriod(item); void loadMetrics(item);}} className={`rounded-lg px-4 py-2 text-xs font-black capitalize ${period === item ? "bg-primary-500 text-canvas-950" : "text-ink-400"}`}>{item}</button>)}</div>
                </header>
                {error && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
                {loading && !data ? <div className="py-20 text-center text-ink-400">Loading growth data…</div> : data && (
                    <>
                        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {(Object.keys(metricMeta) as ChartMetric[]).map((key) => {
                                const item = data.kpis[key];
                                return <button key={key} onClick={() => setMetric(key)} className={`rounded-2xl border p-5 text-left transition ${metric === key ? "border-primary-300 bg-primary-500/[.08]" : "border-line-300 bg-surface-900 hover:border-line-200"}`}><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[.15em] text-ink-400">{metricMeta[key].label}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.change >= 0 ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>{item.change >= 0 ? "+" : ""}{item.change}%</span></div><p className="mt-3 font-display text-4xl text-white">{format(item.value)}</p><p className="mt-1 text-xs text-ink-500">{metricMeta[key].description}</p></button>;
                            })}
                        </section>
                        <section className="mt-5 rounded-2xl border border-line-300 bg-surface-900 p-4 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="font-display text-2xl text-white">{metricMeta[metric].label}</h2><p className="text-xs text-ink-500">{rangeLabel}</p></div><span className="h-3 w-3 rounded-full" style={{background: metricMeta[metric].color}} /></div><div className="mt-4"><TrendChart rows={data.series} metric={metric} period={period} /></div></section>
                        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data.totals).map(([key, value]) => <div key={key} className="rounded-2xl border border-line-300 bg-canvas-900 p-4"><p className="text-xs capitalize text-ink-500">{key.replace(/([A-Z])/g, " $1")}</p><p className="mt-2 font-display text-2xl text-white">{format(value)}</p></div>)}</section>
                        {data.signIn && (
                            <section className="mt-8 border-t border-line-300 pt-7">
                                <p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Accounts</p>
                                <h2 className="mt-2 font-display text-3xl text-white">How people sign in</h2>
                                <p className="mt-2 max-w-3xl text-sm text-ink-400">
                                    {format(data.signIn.total)} accounts. A provider is not a platform — Google sign-in is
                                    the default on both phones — so device evidence is counted separately.
                                </p>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    {Object.entries(data.signIn.providers)
                                        .sort((left, right) => right[1] - left[1])
                                        .map(([provider, count]) => {
                                            const share = data.signIn!.total ? Math.round(count / data.signIn!.total * 100) : 0;
                                            return (
                                                <div key={provider} className="rounded-2xl border border-line-300 bg-canvas-900 p-4">
                                                    <p className="text-xs capitalize text-ink-500">{provider}</p>
                                                    <p className="mt-2 font-display text-2xl text-white">{format(count)}</p>
                                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                                        <div className="h-full rounded-full bg-primary-400" style={{width: `${share}%`}} />
                                                    </div>
                                                    <p className="mt-1 text-[11px] text-ink-500">{share}% of accounts</p>
                                                </div>
                                            );
                                        })}
                                </div>
                                <div className="mt-3 rounded-2xl border border-line-300 bg-canvas-900 p-4">
                                    <p className="text-xs text-ink-500">Confirmed Apple devices</p>
                                    <p className="mt-2 font-display text-2xl text-white">{format(data.signIn.appleDeviceSignals)}</p>
                                    <p className="mt-2 text-[11px] leading-4 text-ink-500">{data.signIn.note}</p>
                                </div>
                            </section>
                        )}

                        <section className="mt-8 border-t border-line-300 pt-7">
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                                <div><p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Discover activity</p><h2 className="mt-2 font-display text-3xl text-white">Post types</h2><p className="mt-2 text-sm text-ink-400">What users are sharing across the community timeline · {format(data.postActivity.total)} total in this period</p></div>
                                <span className="w-fit rounded-full border border-line-300 bg-surface-900 px-3 py-1.5 text-xs font-bold text-ink-300">{rangeLabel}</span>
                            </div>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                {(Object.keys(postTypeMeta) as PostType[])
                                    .sort((left, right) => data.postActivity.types[right].value - data.postActivity.types[left].value)
                                    .map((key, index) => {
                                        const item = data.postActivity.types[key];
                                        const share = data.postActivity.total ? Math.round(item.value / data.postActivity.total * 100) : 0;
                                        return <div key={key} className="rounded-2xl border border-line-300 bg-surface-900 p-4">
                                            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{background: postTypeMeta[key].color}} /><p className="text-xs font-black text-white">{postTypeMeta[key].shortLabel}</p></div><span className="text-[10px] font-bold text-ink-500">#{index + 1}</span></div>
                                            <div className="mt-4 flex items-end justify-between gap-2"><p className="font-display text-3xl text-white">{format(item.value)}</p><span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.change >= 0 ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>{item.change >= 0 ? "+" : ""}{item.change}%</span></div>
                                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.06]"><div className="h-full rounded-full" style={{width: `${share}%`, background: postTypeMeta[key].color}} /></div>
                                            <p className="mt-2 text-[11px] text-ink-500">{share}% of activity · {postTypeMeta[key].description}</p>
                                        </div>;
                                    })}
                            </div>
                            <div className="mt-5 rounded-2xl border border-line-300 bg-surface-900 p-4 sm:p-6">
                                <div className="flex flex-wrap gap-x-4 gap-y-2">{(Object.keys(postTypeMeta) as PostType[]).map((key) => <span key={key} className="flex items-center gap-1.5 text-[11px] font-bold text-ink-300"><span className="h-2 w-2 rounded-sm" style={{background: postTypeMeta[key].color}} />{postTypeMeta[key].shortLabel}</span>)}</div>
                                <div className="mt-4"><PostTypeChart rows={data.postActivity.series} period={period} /></div>
                            </div>
                        </section>
                    </>
                )}
                <section className="mt-8 border-t border-line-300 pt-7">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-primary-200">Audience</p><h2 className="mt-2 font-display text-3xl text-white">Social channels</h2></div><button onClick={syncSocial} disabled={socialLoading} className="w-full rounded-xl border border-line-300 px-4 py-2 text-xs font-black text-white disabled:opacity-50 sm:w-auto">{socialLoading ? "Syncing…" : "Sync now"}</button></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{social.map((item) => <div key={item.platform} className="rounded-2xl border border-line-300 bg-surface-900 p-4"><div className="flex items-center justify-between"><h3 className="font-bold text-white">{item.platform}</h3><span className={`h-2.5 w-2.5 rounded-full ${item.configured && !item.error ? "bg-primary-300" : "bg-amber-300"}`} /></div>{item.configured ? <><div className="mt-4 flex items-end justify-between gap-2"><div><p className="font-display text-3xl text-white">{format(item.followers)}</p><p className="text-xs text-ink-500">followers</p></div>{item.followerChange != null && <span className={`rounded-full px-2 py-1 text-[10px] font-black ${item.followerChange >= 0 ? "bg-primary-500/15 text-primary-100" : "bg-red-500/15 text-red-200"}`}>{item.followerChange >= 0 ? "+" : ""}{format(item.followerChange)}</span>}</div><div className="mt-4 flex gap-4 text-xs text-ink-300"><span>{format(item.views)} views/likes{item.viewChange != null ? ` (${item.viewChange >= 0 ? "+" : ""}${format(item.viewChange)})` : ""}</span><span>{format(item.posts)} posts</span></div>{item.error && <p className="mt-3 text-xs text-red-300">{item.error}</p>}</> : <p className="mt-4 text-sm leading-6 text-ink-400">Add this platform’s API credentials to enable syncing.</p>}</div>)}</div>
                    <p className="mt-3 text-xs text-ink-500">Social platforms only expose metrics through approved APIs. Snapshot history begins when credentials are configured and Sync now is used.</p>
                </section>
            </div>
        </main>
    );
}
