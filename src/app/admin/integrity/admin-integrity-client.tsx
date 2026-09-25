"use client";

import {useCallback, useEffect, useState} from "react";
import {Refresh} from "solar-icon-set";
import type {IntegrityRow} from "@/app/api/admin/integrity/route";

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
        <span
            title={detail}
            className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-300"
        >
            {label}
        </span>
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
        <main className="px-4 py-6 sm:px-7 lg:px-10">
            <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line-300 pb-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-primary-200">Operations</p>
                    <h1 className="mt-1 font-display text-3xl text-white sm:text-4xl">Capture integrity</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-300">
                        Accounts whose captures claim a time, place or image the server could not have observed. These are signals, not proof — read the
                        detail before acting on an account.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    className="inline-flex items-center gap-2 rounded-xl border border-line-300 px-3 py-2 text-xs font-bold text-white transition hover:border-primary-300"
                >
                    <Refresh size={14} />
                    {loading ? "Checking…" : "Re-check"}
                </button>
            </header>

            {error ? (
                <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                    <p className="font-bold">The report could not be run.</p>
                    <p className="mt-1 leading-6 text-red-200/80">{error}</p>
                </div>
            ) : null}

            {summary ? (
                <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Summary">
                    <div className="rounded-2xl border border-line-300 bg-surface-900 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Flagged accounts</p>
                        <p className="mt-1 font-display text-3xl text-white">{summary.accounts}</p>
                    </div>
                    <div className="rounded-2xl border border-line-300 bg-surface-900 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Two or more signals</p>
                        <p className={`mt-1 font-display text-3xl ${summary.strong > 0 ? "text-red-300" : "text-white"}`}>{summary.strong}</p>
                    </div>
                    <div className="rounded-2xl border border-line-300 bg-surface-900 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Backdating</p>
                        <p className={`mt-1 font-display text-3xl ${summary.backdating > 0 ? "text-red-300" : "text-white"}`}>{summary.backdating}</p>
                    </div>
                    <div className="rounded-2xl border border-line-300 bg-surface-900 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Captures involved</p>
                        <p className="mt-1 font-display text-3xl text-white">{summary.capturesImplicated}</p>
                    </div>
                </section>
            ) : null}

            {summary && summary.accounts === 0 && !error ? (
                <p className="mt-5 rounded-2xl border border-primary-400/20 bg-primary-500/[.06] px-4 py-3 text-sm font-bold text-primary-100">
                    No account trips any provenance signal in the last {data?.lookbackDays} days.
                </p>
            ) : null}

            <ul className="mt-5 space-y-2">
                {(data?.accounts ?? []).map((row) => (
                    <li key={row.user_id} className="rounded-2xl border border-line-300 bg-surface-900 px-4 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${row.signals >= 2 ? "bg-red-500/15 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>
                                {row.signals} signal{row.signals === 1 ? "" : "s"}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">
                                {row.username || row.display_name || row.user_id}
                            </span>
                            <span className="shrink-0 text-xs text-ink-400">
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

            {data?.generatedAt ? (
                <p className="mt-4 text-xs text-ink-500">
                    Checked {new Date(data.generatedAt).toISOString().replace("T", " ").slice(0, 19)} UTC · last {data.lookbackDays} days
                </p>
            ) : null}
        </main>
    );
}
