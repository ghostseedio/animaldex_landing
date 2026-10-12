"use client";

import {useCallback, useEffect, useState} from "react";
import type {IntegrityRow} from "@/app/api/admin/integrity/route";
import {AdminPage, Alert, Badge, ListSkeleton, PageHeader, RefreshButton, Stat, StatGrid, StatGridSkeleton} from "@/components/admin/ui";

/**
 * Accounts whose captures claim an origin the server could not have observed.
 *
 * Every column here is a heuristic and the page says so: the strongest single
 * signal, a capture dated before its own account existed, is close to proof;
 * a coarse coordinate on its own is just someone who typed a place name. The
 * ranking is by how many fire together, because that combination is what made
 * the first account unmistakable.
 */

type Payload = {
    ok: boolean;
    error?: string;
    generatedAt: string;
    lookbackDays: number;
    summary: {accounts: number; strong: number; backdating: number; repeatMedia: number; capturesImplicated: number};
    accounts: IntegrityRow[];
};

function Signal({on, label, detail}: {on: boolean; label: string; detail: string}) {
    if (!on) return null;
    return (
        <Badge title={detail} tone="warn" className="normal-case tracking-normal">
            {label}
        </Badge>
    );
}

function since(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
    return `${Math.round(seconds / 86400)}d`;
}

export default function AdminIntegrityClient() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/integrity", {cache: "no-store"});
            const payload = (await response.json()) as Payload;
            if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            setData(payload);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load the report");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const summary = data?.summary;

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Operations"
                title="Capture integrity"
                description="Accounts whose captures claim a time, place or image the server could not have observed. These are signals, not proof — read the detail before acting on an account."
                meta={
                    data?.generatedAt ? (
                        <>
                            Checked {new Date(data.generatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC · last {data.lookbackDays} days
                        </>
                    ) : null
                }
                actions={<RefreshButton loading={loading} onClick={() => void load()} label="Re-check" />}
            />

            {error ? (
                <Alert tone="bad" title="The report could not be run." className="mt-6">
                    {error}
                </Alert>
            ) : null}

            {summary ? (
                <StatGrid className="mt-6" aria-label="Summary">
                    <Stat label="Flagged accounts" value={summary.accounts} />
                    <Stat label="Two or more signals" value={summary.strong} tone={summary.strong > 0 ? "bad" : undefined} />
                    <Stat label="Backdating" value={summary.backdating} tone={summary.backdating > 0 ? "bad" : undefined} />
                    <Stat label="Captures involved" value={summary.capturesImplicated} />
                </StatGrid>
            ) : loading && !error ? (
                <StatGridSkeleton className="mt-6" />
            ) : null}

            {summary && summary.accounts === 0 && !error ? (
                <Alert tone="good" className="mt-6">
                    No account trips any provenance signal in the last {data?.lookbackDays} days.
                </Alert>
            ) : null}

            {!data && loading && !error ? <ListSkeleton rows={6} className="mt-6" /> : null}

            <ul className="mt-6 space-y-2">
                {(data?.accounts ?? []).map((row) => (
                    <li key={row.user_id} className="border border-line-300 bg-surface-900 p-4">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <Badge tone={row.signals >= 2 ? "bad" : "warn"} className="shrink-0 tabular-nums">
                                {row.signals} signal{row.signals === 1 ? "" : "s"}
                            </Badge>
                            <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">
                                {row.username || row.display_name || row.user_id}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-ink-400">
                                {row.captures_total} capture{row.captures_total === 1 ? "" : "s"} · joined {new Date(row.joined_at).toISOString().slice(0, 10)}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Signal
                                on={row.backdated_captures > 0}
                                label={`${row.backdated_captures} backdated`}
                                detail="Captures recorded as happening before the account was created."
                            />
                            <Signal
                                on={row.repeat_media_max >= 3}
                                label={`same image ×${row.repeat_media_max}`}
                                detail="Images sharing an exact byte size and pixel dimensions — the same file uploaded repeatedly."
                            />
                            <Signal
                                on={row.coarse_coordinate_captures > 0}
                                label={`${row.coarse_coordinate_captures} coarse GPS`}
                                detail="Coordinates unchanged by rounding to four decimals — a looked-up place, not a device fix."
                            />
                            <Signal
                                on={row.captures_in_first_two_minutes >= 5}
                                label={`${row.captures_in_first_two_minutes} in first 2 min`}
                                detail="Captures arriving within two minutes of signup."
                            />
                            <span className="text-[10px] text-ink-500">
                                first capture {since(row.first_capture_after_signup_seconds)} after signup · {row.distinct_coordinates} distinct coordinate
                                {row.distinct_coordinates === 1 ? "" : "s"}
                            </span>
                        </div>
                        <p className="mt-2 break-all font-mono text-[10px] text-ink-600">{row.user_id}</p>
                    </li>
                ))}
            </ul>
        </AdminPage>
    );
}
