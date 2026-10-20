"use client";

import {useCallback, useEffect, useState} from "react";
import type {ApiStatus} from "@/lib/api-status";
import {API_PROVIDER_INFO, type ApiHealth} from "@/lib/api-status-core";
import {AdminPage, Alert, Badge, ListSkeleton, PageHeader, RefreshButton} from "@/components/admin/ui";

/**
 * The AI providers the site pays for, checked on demand: does the key work,
 * is the account out of credit, and what has it cost this month where the
 * provider says. None of them lets an API key read the prepaid balance, so
 * each card links to its billing page for that number.
 */

type Payload = {ok: boolean; error?: string; checkedAt: string; providers: ApiStatus[]};

const HEALTH: Record<ApiHealth, {label: string; tone: "good" | "warn" | "bad" | "neutral"}> = {
    ok: {label: "Working", tone: "good"},
    no_credit: {label: "Out of credit", tone: "bad"},
    auth: {label: "Key rejected", tone: "bad"},
    rate_limited: {label: "Rate limited", tone: "warn"},
    down: {label: "Not answering", tone: "warn"},
    not_configured: {label: "Not set up", tone: "neutral"}
};

function usd(value: number | null | undefined) {
    return value == null ? "—" : `$${value.toFixed(2)}`;
}

function ProviderCard({status}: {status: ApiStatus}) {
    const info = API_PROVIDER_INFO[status.provider];
    const health = HEALTH[status.health];
    const nearBudget = status.dailyBudgetUSD && status.todaySpendUSD != null && status.todaySpendUSD >= status.dailyBudgetUSD * 0.8;
    return (
        <li className="border border-line-300 bg-surface-900 p-4">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg text-white">{info.label}</h2>
                <Badge tone={health.tone}>{health.label}</Badge>
                {status.latencyMs != null ? <span className="text-xs tabular-nums text-ink-500">{status.latencyMs} ms</span> : null}
                <a href={info.billingUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs font-bold text-primary-200 hover:text-primary-100">Billing &amp; balance ↗</a>
            </div>
            <p className="mt-1 text-xs text-ink-500">{info.usedFor}</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                <div>
                    <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">This month</dt>
                    <dd className="mt-0.5 text-base font-bold tabular-nums text-white">{usd(status.monthSpendUSD)}</dd>
                </div>
                {status.dailyBudgetUSD ? (
                    <div>
                        <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Today / daily budget</dt>
                        <dd className={`mt-0.5 text-base font-bold tabular-nums ${nearBudget ? "text-amber-300" : "text-white"}`}>{usd(status.todaySpendUSD)} / {usd(status.dailyBudgetUSD)}</dd>
                    </div>
                ) : null}
                <div className="sm:col-span-1">
                    <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Spend source</dt>
                    <dd className="mt-0.5 text-ink-300">{status.spendSource ?? "—"}</dd>
                </div>
            </dl>
            {status.message ? <p className="mt-3 break-words border border-line-300 bg-canvas-950 p-2 font-mono text-[11px] text-ink-300">{status.message}</p> : null}
        </li>
    );
}

export default function AdminApiStatusClient() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/api-status", {cache: "no-store"});
            const payload = (await response.json()) as Payload;
            if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            setData(payload);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not check the APIs");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const failing = data?.providers.filter((provider) => provider.health === "no_credit" || provider.health === "auth") ?? [];

    return (
        <AdminPage>
            <PageHeader
                eyebrow="Operations"
                title="API status"
                description="Claude, OpenAI, Gemini and Higgsfield: whether each key works, whether the account has run out of credit, and month-to-date spend where the provider reports it. Each check sends one tiny request (a fraction of a cent)."
                meta={data?.checkedAt ? <>Checked {new Date(data.checkedAt).toLocaleString()}</> : null}
                actions={<RefreshButton loading={loading} onClick={() => void load()} label="Check now" />}
            />
            {error ? <Alert tone="bad" title="The check failed." className="mt-6">{error}</Alert> : null}
            {failing.length ? (
                <Alert tone="bad" className="mt-6">{failing.map((provider) => API_PROVIDER_INFO[provider.provider].label).join(", ")} need attention: top up or replace the key.</Alert>
            ) : null}
            <Alert tone="info" className="mt-6">
                No provider lets an API key read the remaining prepaid balance, so this page cannot warn before credit runs low. It shows &ldquo;Out of credit&rdquo; as soon as a request is refused for it; open Billing &amp; balance for the exact figure, and set auto-reload there to avoid running dry.
            </Alert>
            {!data && loading ? <ListSkeleton rows={4} className="mt-6" /> : null}
            {data ? (
                <ul className="mt-6 space-y-3">
                    {data.providers.map((status) => <ProviderCard key={status.provider} status={status} />)}
                </ul>
            ) : null}
        </AdminPage>
    );
}
