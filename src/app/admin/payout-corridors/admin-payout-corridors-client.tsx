"use client";

import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {FinanceOperatorSignInCard, useFinanceActor} from "@/app/admin/_components/finance-operator-auth";
import {AdminPage, Alert, Badge, Button, buttonVariants, Card, EmptyState, PageHeader, Table, TableSkeleton, TD, TH} from "@/components/admin/ui";

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
    requirements_verified_at?: string | null;
    quote_verified_at?: string | null;
    first_successful_payout_at?: string | null;
    verified_at?: string | null;
    blocker_reason: string | null;
};

const WAVE1_PRIORITY = [
    "ID", "SG", "AU", "NZ", "US", "CA", "FR", "DE", "NL", "ES", "IT", "IE",
    "MY", "PH", "TH", "JP", "KR", "IN", "GB",
];

function priorityRank(country: string) {
    const idx = WAVE1_PRIORITY.indexOf(country);
    return idx === -1 ? 500 + country.charCodeAt(0) : idx;
}

export function AdminPayoutCorridorsClient() {
    const {actor, loaded: actorLoaded, signedIn} = useFinanceActor();
    const canFinance = actor?.canActAsFinanceActor === true;
    const [rows, setRows] = useState<Corridor[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // Display only: which button is working, and whether the first load is back.
    const [pending, setPending] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

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
        load()
            .catch((e) => setError(e instanceof Error ? e.message : "Failed"))
            .finally(() => setLoaded(true));
    }, []);

    async function patch(id: string, body: Record<string, unknown>) {
        setBusy(true);
        setMessage(null);
        setError(null);
        try {
            const res = await fetch("/api/admin/payout-corridors", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({corridorId: id, ...body}),
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
                body: JSON.stringify({action: "probe_requirements", currencyCode}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Probe failed");
            const types = Array.isArray(json.requirements)
                ? json.requirements
                      .map((r: {type?: string; title?: string}) => r.type || r.title || "?")
                      .slice(0, 8)
                : [];
            setMessage(`Requirements for ${currencyCode}: ${types.join(", ") || "ok"}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Probe failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Creator economy"
                title="Payout corridors"
                description={
                    <>
                        Lifecycle: provider_supported → testing → <strong className="text-ink-200">beta</strong> → verified.
                        Promote to Beta when requirements + form + quote pass — a live smoke payout is{" "}
                        <em>not</em> required. First genuine Paid payout promotes Beta → Verified. Manual Wise only —
                        auto_payout stays off.
                    </>
                }
                actions={
                    <Link href="/admin/payouts" className={buttonVariants({size: "sm", variant: "ghost"})}>
                        ← Payouts
                    </Link>
                }
            />
            {actorLoaded && !canFinance && (
                <div className="mt-6">
                    <Alert tone="warn" title="Finance actions locked">
                        Corridor changes require a named finance operator. The shared admin password
                        cannot change payout corridors. Sign in below to enable changes.
                    </Alert>
                    <FinanceOperatorSignInCard onSignedIn={signedIn} />
                </div>
            )}
            {actorLoaded && canFinance && (
                <Alert tone="good" title={`Named finance operator: ${actor?.email}`} className="mt-6">
                    Corridor changes are enabled.
                </Alert>
            )}
            {error && <Alert tone="bad" className="mt-4">{error}</Alert>}
            {message && <Alert tone="good" className="mt-4">{message}</Alert>}

            <Card className="mt-6">
                {!loaded ? (
                    <TableSkeleton rows={8} columns={8} />
                ) : sorted.length === 0 ? (
                    <EmptyState className="m-4" title="No corridors returned." />
                ) : (
                    <Table minWidth={1000}>
                        <thead>
                            <tr>
                                <TH>Country</TH>
                                <TH>Currency</TH>
                                <TH>Type</TH>
                                <TH>Status</TH>
                                <TH>Setup</TH>
                                <TH>Reqs / Quote</TH>
                                <TH>First payout</TH>
                                <TH>Actions</TH>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((r) => (
                                <tr key={r.id} className="align-top">
                                    <TD className="text-white">
                                        {r.display_name}
                                        <span className="block text-xs text-ink-500">{r.country_code}</span>
                                    </TD>
                                    <TD>{r.currency_code}</TD>
                                    <TD className="text-ink-300">{r.recipient_type}</TD>
                                    <TD>
                                        <Badge
                                            tone={
                                                r.status === "beta"
                                                    ? "warn"
                                                    : r.status === "verified" || r.status === "enabled"
                                                      ? "good"
                                                      : r.status === "paused"
                                                        ? "bad"
                                                        : "neutral"
                                            }
                                        >
                                            {r.status}
                                        </Badge>
                                    </TD>
                                    <TD>
                                        {r.enabled_for_setup ? "on" : "off"} / {r.enabled_for_requests ? "on" : "off"}
                                    </TD>
                                    <TD className="tabular-nums text-ink-400">
                                        reqs {r.requirements_verified_at ? "✓" : "—"}
                                        <br />
                                        quote {r.quote_verified_at || r.tested_at ? "✓" : "—"}
                                    </TD>
                                    <TD className="tabular-nums text-ink-400">
                                        {r.first_successful_payout_at
                                            ? new Date(r.first_successful_payout_at).toISOString().slice(0, 10)
                                            : "—"}
                                        {r.verified_at ? (
                                            <span className="block text-primary-200/80">
                                                verified {new Date(r.verified_at).toISOString().slice(0, 10)}
                                            </span>
                                        ) : null}
                                    </TD>
                                    <TD>
                                        <p className="text-xs text-ink-500">{r.blocker_reason || "—"}</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                disabled={busy || !canFinance}
                                                loading={busy && pending === `probe:${r.id}`}
                                                onClick={() => {
                                                    setPending(`probe:${r.id}`);
                                                    void probe(r.currency_code);
                                                }}
                                            >
                                                Probe reqs
                                            </Button>
                                            <Button
                                                size="sm"
                                                disabled={busy || !canFinance}
                                                loading={busy && pending === `beta:${r.id}`}
                                                onClick={() => {
                                                    setPending(`beta:${r.id}`);
                                                    void patch(r.id, {
                                                        action: "promote_beta",
                                                    });
                                                }}
                                            >
                                                Promote to Beta
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                disabled={busy || !canFinance}
                                                loading={busy && pending === `pause:${r.id}`}
                                                onClick={() => {
                                                    setPending(`pause:${r.id}`);
                                                    void patch(r.id, {
                                                        enabledForSetup: false,
                                                        enabledForRequests: false,
                                                        status: "paused",
                                                    });
                                                }}
                                            >
                                                Pause
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={busy || r.status !== "paused" || !canFinance}
                                                loading={busy && pending === `resume:${r.id}`}
                                                onClick={() => {
                                                    setPending(`resume:${r.id}`);
                                                    void patch(r.id, {
                                                        action: "promote_beta",
                                                    });
                                                }}
                                            >
                                                Resume → Beta
                                            </Button>
                                        </div>
                                    </TD>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>
        </AdminPage>
    );
}
