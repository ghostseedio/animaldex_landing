"use client";

import Image from "next/image";
import Link from "next/link";
import {FormEvent, useEffect, useMemo, useState} from "react";
import {AdminPage, Alert, Badge, Button, buttonVariants, Card, cn, fieldClass, PageHeader, RefreshButton, Skeleton, Stat, StatGrid, StatGridSkeleton} from "@/components/admin/ui";

type UserRow = {
    id: string; email: string | null; displayName: string | null; username: string | null; avatarUrl: string | null; isPro: boolean;
    joinedAt: string; lastActiveAt: string; creditBalance: number; captures: number; alignments: number; fusions: number;
    challenges: number; trades: number; creditsPurchased: number; creditsSpent: number; purchaseCount: number;
    productionPurchaseCount: number; sandboxPurchaseCount: number; estimatedLtvUsd: number; products: Record<string, number>;
    firstPurchaseAt: string | null; lastPurchaseAt: string | null; sharedActivity: number; activityScore: number;
};
type Data = {
    users: UserRow[];
    summary: {totalUsers: number; productionBuyers: number; payingConversion: number; estimatedRevenueUsd: number; averageEstimatedLtvUsd: number};
    pricingNote: string;
};
type Filter = "all" | "buyers" | "pro" | "active";
type Sort = "ltv" | "activity" | "recent" | "credits";

function money(value: number) {
    return new Intl.NumberFormat("en-US", {style: "currency", currency: "USD"}).format(value);
}

function relative(value: string | null) {
    if (!value) return "Never";
    const days = Math.round((new Date(value).getTime() - Date.now()) / 86400000);
    if (Math.abs(days) < 1) return "Today";
    return new Intl.RelativeTimeFormat("en", {numeric: "auto"}).format(days, "day");
}

function Avatar({user}: {user: UserRow}) {
    const name = user.displayName || user.username || user.email || "User";
    return user.avatarUrl
        ? <span className="relative h-11 w-11 shrink-0 overflow-hidden">
            <Image src={user.avatarUrl} alt="" fill unoptimized sizes="44px" className="object-cover" />
        </span>
        : <span className="grid h-11 w-11 shrink-0 place-items-center bg-primary-500/15 font-black text-primary-100">{name.slice(0, 1).toUpperCase()}</span>;
}

export default function AdminUsersClient() {
    const [data, setData] = useState<Data | null>(null);
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [sort, setSort] = useState<Sort>("ltv");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [grantAmount, setGrantAmount] = useState<Record<string, string>>({});
    const [grantNote, setGrantNote] = useState<Record<string, string>>({});
    const [granting, setGranting] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    async function grantCredits(user: UserRow) {
        const amount = Number(grantAmount[user.id]);
        if (!Number.isFinite(amount) || amount <= 0) return;

        const name = user.displayName || user.username || user.email || user.id;
        if (!window.confirm(`Grant ${amount} credit(s) to ${name}? Their balance is ${user.creditBalance}.`)) return;

        setGranting(user.id);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/users/credits", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({userId: user.id, amount, note: grantNote[user.id] ?? ""})
            });
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Grant failed");
            setNotice(`Granted ${body.granted} credit(s) to ${name}. Balance is now ${body.balance ?? "—"}.`);
            setGrantAmount((current) => ({...current, [user.id]: ""}));
            setGrantNote((current) => ({...current, [user.id]: ""}));
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Grant failed");
        } finally {
            setGranting(null);
        }
    }

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/users", {cache: "no-store"});
            if (response.status === 401) { setAuthorized(false); return; }
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load users");
            setData(body);
            setAuthorized(true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load users");
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { void load(); }, []);

    async function login(event: FormEvent) {
        event.preventDefault();
        const response = await fetch("/api/admin/support/login", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({password})});
        const body = await response.json();
        if (!response.ok || !body.ok) { setError(body.error || "Unable to sign in"); return; }
        setPassword("");
        await load();
    }

    const users = useMemo(() => {
        if (!data) return [];
        const needle = query.trim().toLowerCase();
        return data.users.filter((user) => {
            if (filter === "buyers" && user.productionPurchaseCount === 0) return false;
            if (filter === "pro" && !user.isPro) return false;
            if (filter === "active" && Date.now() - new Date(user.lastActiveAt).getTime() > 30 * 86400000) return false;
            return !needle || [user.id, user.email, user.displayName, user.username].some((value) => String(value ?? "").toLowerCase().includes(needle));
        }).sort((a, b) => sort === "activity" ? b.activityScore - a.activityScore : sort === "recent" ? new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime() : sort === "credits" ? b.creditsPurchased - a.creditsPurchased : b.estimatedLtvUsd - a.estimatedLtvUsd);
    }, [data, query, filter, sort]);

    if (authorized === false) return <AdminPage width="narrow" className="grid min-h-[70vh] place-items-center"><form onSubmit={login} className="w-full max-w-sm border border-line-300 bg-surface-900 p-6"><p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">AnimalDex admin</p><h1 className="mt-2 font-display text-3xl text-white">Customer intelligence</h1><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin password" className={`mt-6 ${fieldClass}`} /><Button type="submit" variant="primary" size="lg" className="mt-3 w-full">Sign in</Button>{error && <Alert tone="bad" className="mt-3">{error}</Alert>}</form></AdminPage>;

    return <AdminPage width="wide">
        <PageHeader
            eyebrow="Growth"
            title="Users & LTV"
            description="Understand who purchases, how they use AnimalDex, and which customers stay active."
            actions={<><Link href="/admin/segments" className={buttonVariants({size: "sm"})}>Segments</Link><Link href="/admin/metrics" className={buttonVariants({size: "sm"})}>Aggregate metrics</Link><RefreshButton loading={loading} onClick={() => void load()} /></>}
        />
        {error && <Alert tone="bad" className="mt-6">{error}</Alert>}
        {notice && <Alert tone="good" className="mt-6">{notice}</Alert>}
        {data ? <><StatGrid className="mt-6 xl:grid-cols-5">{[
            ["Users", data.summary.totalUsers.toLocaleString()],
            ["Paying users", data.summary.productionBuyers.toLocaleString()],
            ["Conversion", `${data.summary.payingConversion}%`],
            ["Est. gross LTV", money(data.summary.estimatedRevenueUsd)],
            ["Avg. buyer LTV", money(data.summary.averageEstimatedLtvUsd)]
        ].map(([label, value]) => <Stat key={label} label={label} value={value} />)}</StatGrid>
        <p className="mt-3 text-[11px] leading-5 text-ink-500">{data.pricingNote}</p></> : loading ? <StatGridSkeleton count={5} className="mt-6 xl:grid-cols-5" /> : null}
        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, username, email, or user ID…" className={`min-w-0 ${fieldClass}`} />
            <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className={cn(fieldClass, "lg:w-auto")}><option value="all">All users</option><option value="buyers">Credit/Pro buyers</option><option value="pro">Current Pro</option><option value="active">Active in 30 days</option></select>
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className={cn(fieldClass, "lg:w-auto")}><option value="ltv">Highest LTV</option><option value="activity">Most active</option><option value="recent">Recently active</option><option value="credits">Most credits bought</option></select>
        </div>
        <div className="mt-4 text-[11px] font-black uppercase tracking-[.12em] tabular-nums text-ink-500">{loading && !data ? "Loading customers…" : `${users.length} users`}</div>
        <Card className="mt-3">
            {!data && loading && <div role="status" aria-label="Loading" className="divide-y divide-line-300">{Array.from({length: 8}, (_, row) => <div key={row} className="flex items-center gap-4 p-4" style={{opacity: 1 - row * 0.1}}><Skeleton className="h-11 w-11 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-2.5 w-56" /></div>{Array.from({length: 4}, (_, index) => <Skeleton key={index} className="hidden h-6 w-20 sm:block" />)}</div>)}</div>}
            {users.map((user) => <article key={user.id} className="border-b border-line-300 last:border-0">
                <button onClick={() => setExpanded(expanded === user.id ? null : user.id)} className="grid w-full gap-4 p-4 text-left transition hover:bg-white/[.02] sm:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(90px,.65fr))_auto] sm:items-center">
                    <div className="flex min-w-0 items-center gap-3"><Avatar user={user} /><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-bold text-white">{user.displayName || user.username || user.email || "Unnamed user"}</p>{user.isPro && <Badge tone="warn">PRO</Badge>}</div><p className="truncate text-xs text-ink-500">{user.email || `@${user.username || user.id}`}</p></div></div>
                    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Est. LTV</p><p className="mt-1 font-bold tabular-nums text-white">{money(user.estimatedLtvUsd)}</p></div>
                    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Balance</p><p className="mt-1 font-bold tabular-nums text-white">{user.creditBalance.toLocaleString()}</p></div>
                    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Captures</p><p className="mt-1 font-bold tabular-nums text-white">{user.captures.toLocaleString()}</p></div>
                    <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">Last active</p><p className="mt-1 text-sm font-bold text-white">{relative(user.lastActiveAt)}</p></div>
                    <span className="text-ink-400">{expanded === user.id ? "−" : "+"}</span>
                </button>
                {expanded === user.id && <div className="border-t border-line-300 bg-canvas-900/60 p-4 sm:p-5"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">{[
                    ["Balance", user.creditBalance], ["Bought", user.creditsPurchased], ["Credits spent", user.creditsSpent], ["Alignments", user.alignments], ["Fusions", user.fusions],
                    ["Challenges", user.challenges], ["Trades", user.trades], ["Prod. purchases", user.productionPurchaseCount], ["Sandbox", user.sandboxPurchaseCount]
                ].map(([label, value]) => <div key={label} className="border border-line-300 bg-surface-900 p-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">{label}</p><p className="mt-1 font-bold tabular-nums text-white">{Number(value).toLocaleString()}</p></div>)}</div>
                <div className="mt-4 flex flex-wrap gap-2">{Object.entries(user.products).map(([product, count]) => <span key={product} className="rounded-full border border-line-300 px-3 py-1.5 text-xs tabular-nums text-ink-300">{product.replace(/_/g, " ")} × {count}</span>)}{!Object.keys(user.products).length && <span className="text-xs text-ink-500">No StoreKit purchases</span>}</div>
                <div className="mt-4 border border-line-300 bg-surface-900 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Grant credits</p>
                    <p className="mt-1 text-xs text-ink-500">Goes through the same ledger as missions and referrals, so the balance and the history stay in step.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input type="number" min={1} max={500} value={grantAmount[user.id] ?? ""}
                               onChange={(event) => setGrantAmount((current) => ({...current, [user.id]: event.target.value}))}
                               placeholder="Credits" className={cn(fieldClass, "w-28")} />
                        <input value={grantNote[user.id] ?? ""}
                               onChange={(event) => setGrantNote((current) => ({...current, [user.id]: event.target.value}))}
                               placeholder="Reason, kept on the ledger entry" className={cn(fieldClass, "w-auto min-w-0 flex-1")} />
                        <Button variant="primary" onClick={() => void grantCredits(user)} loading={granting === user.id} disabled={!grantAmount[user.id]}>
                            {granting === user.id ? "Granting…" : "Grant"}
                        </Button>
                        {[5, 10, 25].map((amount) => (
                            <Button key={amount} size="sm" onClick={() => setGrantAmount((current) => ({...current, [user.id]: String(amount)}))}>+{amount}</Button>
                        ))}
                    </div>
                </div>
                <p className="mt-4 break-all font-mono text-[10px] text-ink-600">{user.id}</p></div>}
            </article>)}
            {!loading && !users.length && <div className="py-20 text-center text-sm text-ink-400">No users match these filters.</div>}
        </Card>
    </AdminPage>;
}
