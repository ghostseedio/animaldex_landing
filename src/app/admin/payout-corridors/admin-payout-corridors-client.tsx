"use client";

import Link from "next/link";
import {useEffect, useMemo, useState} from "react";

type Corridor = {
    id: string;
    country_code: string;
    currency_code: string;
    recipient_type: string;
    display_name: string;
    status: string;
    enabled_for_setup: boolean;
    enabled_for_requests: boolean;
    minimum_payout_amount_minor: number;
    enhanced_review_amount_minor: number | null;
    tested_at: string | null;
    blocker_reason: string | null;
};

const WAVE1_PRIORITY = [
    "ID",
    "SG",
    "AU",
    "NZ",
    "US",
    "CA",
    "FR",
    "DE",
    "NL",
    "ES",
    "IT",
    "IE",
    "MY",
    "PH",
    "TH",
    "JP",
    "KR",
    "IN",
    "GB"
];

function priorityRank(country: string) {
    const idx = WAVE1_PRIORITY.indexOf(country);
    return idx === -1 ? 500 + country.charCodeAt(0) : idx;
}

export function AdminPayoutCorridorsClient() {
    const [rows, setRows] = useState<Corridor[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const sorted = useMemo(
        () =>
            [...rows].sort((a, b) => {
                const pr = priorityRank(a.country_code) - priorityRank(b.country_code);
                if (pr !== 0) return pr;
                return a.currency_code.localeCompare(b.currency_code);
            }),
        [rows]
    );

    async function load() {
        setError(null);
        const res = await fetch("/api/admin/payout-corridors", {cache: "no-store"});
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        setRows(Array.isArray(json.corridors) ? json.corridors : []);
    }

    useEffect(() => {
        load().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    }, []);

    async function patch(id: string, body: Record<string, unknown>) {
        setBusy(true);
        setMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/admin/payout-corridors", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({corridorId: id, ...body})
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Update failed");
            setMessage(`Updated ${id.slice(0, 8)}…`);
            await load();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Update failed");
        } finally {
            setBusy(false);
        }
    }

    async function probe(currencyCode: string) {
        setBusy(true);
        setMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/admin/payout-corridors", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "probe_requirements", currencyCode})
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Probe failed");
            const types = Array.isArray(json.requirements)
                ? json.requirements
                      .map((r: {type?: string; title?: string}) => r.type || r.title || "?")
                      .slice(0, 8)
                : [];
            setMessage(
                `Wise requirements for ${currencyCode}: ${types.join(", ") || "ok"} — ${json.checklistHint || ""}`
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : "Probe failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen bg-canvas-950 px-6 py-8 text-ink-100">
            <Link href="/admin/payouts" className="text-sm text-ink-400 hover:text-white">
                ← Payouts
            </Link>
            <h1 className="mt-5 font-display text-3xl text-white">Payout corridors</h1>
            <p className="mt-2 max-w-3xl text-sm text-ink-400">
                Wave 1 international corridors (sorted by activation priority). Probe Wise requirements before enabling.
                Enabling without <code>tested_at</code> is rejected. Manual Wise payment only — no auto-payout. Clients
                pick up newly enabled corridors without an app release.
            </p>
            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
            {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}

            <div className="mt-8 overflow-x-auto rounded-2xl border border-line-300">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-wide text-ink-400">
                        <tr>
                            <th className="px-3 py-2">Country</th>
                            <th className="px-3 py-2">Currency</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Setup</th>
                            <th className="px-3 py-2">Requests</th>
                            <th className="px-3 py-2">Blocker / actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((r) => (
                            <tr key={r.id} className="border-t border-white/10 align-top">
                                <td className="px-3 py-2 text-white">
                                    {r.display_name}
                                    <span className="block text-xs text-ink-500">{r.country_code}</span>
                                </td>
                                <td className="px-3 py-2">{r.currency_code}</td>
                                <td className="px-3 py-2 text-ink-300">{r.recipient_type}</td>
                                <td className="px-3 py-2">{r.status}</td>
                                <td className="px-3 py-2">{r.enabled_for_setup ? "on" : "off"}</td>
                                <td className="px-3 py-2">{r.enabled_for_requests ? "on" : "off"}</td>
                                <td className="px-3 py-2">
                                    <p className="text-xs text-ink-500">{r.blocker_reason || "—"}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            disabled={busy}
                                            className="rounded border border-sky-500/40 px-2 py-1 text-xs text-sky-100"
                                            onClick={() => void probe(r.currency_code)}
                                        >
                                            Probe Wise reqs
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            className="rounded border border-white/20 px-2 py-1 text-xs"
                                            onClick={() =>
                                                patch(r.id, {
                                                    testedAt: new Date().toISOString(),
                                                    status: "beta",
                                                    blockerReason: null,
                                                    enabledForSetup: true,
                                                    enabledForRequests: true
                                                })
                                            }
                                        >
                                            Mark tested + enable
                                        </button>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            className="rounded border border-white/20 px-2 py-1 text-xs"
                                            onClick={() =>
                                                patch(r.id, {
                                                    enabledForSetup: false,
                                                    enabledForRequests: false,
                                                    status: "paused"
                                                })
                                            }
                                        >
                                            Pause
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
