"use client";

import {useCallback, useEffect, useState} from "react";
import {AdminPage, Alert, Badge, Button, EmptyState, Field, fieldClass, ListSkeleton, PageHeader, RefreshButton, Segmented} from "@/components/admin/ui";
import {
    ageInDays,
    DECISION_NOTE_MAX,
    DISPUTE_CLAIM_LABELS,
    findingsList,
    VIOLATION_KIND_LABELS,
    type DisputeDecision,
    type DisputeStatusFilter,
    type StrikeDisputeView,
} from "@/lib/strike-disputes-admin";

/**
 * The human queue for strike disputes. Each card shows what the screener saw,
 * the flagged photo, and everything the person sent; the operator overturns
 * (strike removed, photo and account given back) or upholds with a note the
 * person reads. Nothing is decided automatically.
 */

type Payload = {
    ok: boolean;
    error?: string;
    status: DisputeStatusFilter;
    counts: Record<string, number>;
    disputes: StrikeDisputeView[];
    generatedAt: string;
};

const day = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "—");

function statusTone(status: string) {
    if (status === "overturned") return "good" as const;
    if (status === "upheld") return "bad" as const;
    return "warn" as const;
}

function DisputeCard({dispute, onDecided}: {dispute: StrikeDisputeView; onDecided: (next: StrikeDisputeView) => void}) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState<DisputeDecision | null>(null);
    const [error, setError] = useState<string | null>(null);
    const open = dispute.status === "submitted";
    const findings = findingsList(dispute.violation?.findings);

    async function decide(decision: DisputeDecision) {
        if (decision === "uphold" && note.trim() === "") {
            setError("Write the reason first: the person is told why the strike stays.");
            return;
        }
        const verb = decision === "overturn" ? "Remove this strike and give back what it took?" : "Keep this strike and send the note?";
        if (!window.confirm(verb)) return;
        setBusy(decision);
        setError(null);
        try {
            const response = await fetch("/api/admin/disputes", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({disputeId: dispute.id, decision, note}),
            });
            const body = (await response.json().catch(() => ({}))) as {ok?: boolean; error?: string; dispute?: StrikeDisputeView};
            if (!response.ok || !body.ok || !body.dispute) throw new Error(body.error || `Request failed (${response.status})`);
            onDecided(body.dispute);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "The decision failed");
        } finally {
            setBusy(null);
        }
    }

    return (
        <li className="border border-line-300 bg-surface-900 p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Badge tone={statusTone(dispute.status)}>{dispute.status}</Badge>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">
                    {dispute.user.username || dispute.user.displayName || dispute.user.id}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ink-400">
                    {dispute.user.standing} · {dispute.user.activeStrikes} active strike{dispute.user.activeStrikes === 1 ? "" : "s"} · sent {day(dispute.createdAt)}
                    {open ? ` · waiting ${ageInDays(dispute.createdAt)}d` : ""}
                </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div>
                    {dispute.captureImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dispute.captureImageUrl} alt="The flagged photo" className="aspect-square w-full border border-line-300 object-cover" />
                    ) : (
                        <div className="flex aspect-square w-full items-center justify-center border border-line-300 text-xs text-ink-500">No photo</div>
                    )}
                    <p className="mt-2 text-[11px] leading-4 text-ink-400">
                        {dispute.capture ? (
                            <>
                                Taken {day(dispute.capture.capturedAt)}
                                {dispute.capture.locationLabel ? ` · ${dispute.capture.locationLabel}` : ""}
                                {dispute.capture.acquisitionKind ? ` · ${dispute.capture.acquisitionKind}` : ""}
                            </>
                        ) : (
                            "No capture on this strike (an operator strike)."
                        )}
                    </p>
                </div>

                <div className="min-w-0 space-y-3 text-sm">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-400">Strike</p>
                        <p className="text-white">{dispute.strike.reason}</p>
                        <p className="text-xs text-ink-400">
                            {day(dispute.strike.createdAt)} · {dispute.strike.actor ?? "operator"}
                            {dispute.violation
                                ? ` · ${VIOLATION_KIND_LABELS[dispute.violation.kind] ?? dispute.violation.kind}${dispute.violation.confidence != null ? ` (${Math.round(dispute.violation.confidence * 100)}%)` : ""}`
                                : ""}
                        </p>
                        {findings.length ? (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                                {findings.map((finding) => (
                                    <Badge key={finding} tone="neutral" className="normal-case tracking-normal">
                                        {finding}
                                    </Badge>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-400">
                            Their claim: {DISPUTE_CLAIM_LABELS[dispute.claim] ?? dispute.claim}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-white">{dispute.statement}</p>
                        {dispute.sourceUrl ? (
                            <a href={dispute.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block break-all text-xs text-primary-300 underline">
                                {dispute.sourceUrl}
                            </a>
                        ) : null}
                    </div>

                    {dispute.evidence.length ? (
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-400">Proof ({dispute.evidence.length})</p>
                            <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {dispute.evidence.map((item) => {
                                    const url = dispute.evidenceUrls[item.id];
                                    return (
                                        <a key={item.id} href={url ?? undefined} target="_blank" rel="noopener noreferrer" className="block" title={item.kind.replace("_", " ")}>
                                            {url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={url} alt={item.kind.replace("_", " ")} className="aspect-square w-full border border-line-300 object-cover" />
                                            ) : (
                                                <span className="flex aspect-square w-full items-center justify-center border border-line-300 text-[10px] text-ink-500">unavailable</span>
                                            )}
                                            <span className="mt-0.5 block text-[10px] text-ink-500">{item.kind === "location_proof" ? "being there" : "same moment"}</span>
                                        </a>
                                    );
                                })}
                            </div>
                            <p className="mt-1 text-[10px] text-ink-500">Open a photo to see it full size. The app keeps each photo&apos;s date, camera and place in the file.</p>
                        </div>
                    ) : null}

                    {open ? (
                        <div className="space-y-2 border-t border-line-300 pt-3">
                            <Field label="Note to the person" hint="Required to uphold. Sent with either decision.">
                                <textarea
                                    className={fieldClass}
                                    rows={2}
                                    maxLength={DECISION_NOTE_MAX}
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder="e.g. The original file has the zoo's location and the right date."
                                />
                            </Field>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="primary" loading={busy === "overturn"} disabled={busy !== null} onClick={() => void decide("overturn")}>
                                    Overturn: remove strike
                                </Button>
                                <Button variant="danger" loading={busy === "uphold"} disabled={busy !== null} onClick={() => void decide("uphold")}>
                                    Uphold: keep strike
                                </Button>
                            </div>
                            {error ? <p className="text-xs text-red-300">{error}</p> : null}
                        </div>
                    ) : (
                        <p className="border-t border-line-300 pt-3 text-xs text-ink-400">
                            Decided {day(dispute.decidedAt)} by {dispute.decidedBy ?? "admin"}
                            {dispute.decisionNote ? `: “${dispute.decisionNote}”` : "."}
                        </p>
                    )}
                </div>
            </div>
        </li>
    );
}

export default function AdminDisputesClient() {
    const [status, setStatus] = useState<DisputeStatusFilter>("submitted");
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async (filter: DisputeStatusFilter) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/disputes?status=${filter}`, {cache: "no-store"});
            const payload = (await response.json()) as Payload;
            if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            setData(payload);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load disputes");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(status);
    }, [load, status]);

    const counts = data?.counts ?? {};
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

    function replace(next: StrikeDisputeView) {
        setData((current) =>
            current ? {...current, disputes: current.disputes.map((item) => (item.id === next.id ? next : item))} : current,
        );
    }

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Operations"
                title="Strike disputes"
                description="People who think a strike was a mistake send their reason and proof from the app. Overturning removes the strike, puts the photo back in Discover if it was public, and lifts a suspension it caused. Upholding keeps it; your note is sent to them."
                actions={<RefreshButton loading={loading} onClick={() => void load(status)} />}
            />

            <Segmented
                className="mt-6"
                label="Show"
                value={status}
                onChange={setStatus}
                options={[
                    {value: "submitted", label: "Waiting", count: counts.submitted ?? 0},
                    {value: "overturned", label: "Overturned", count: counts.overturned ?? 0},
                    {value: "upheld", label: "Upheld", count: counts.upheld ?? 0},
                    {value: "all", label: "All", count: total},
                ]}
            />

            {error ? (
                <Alert tone="bad" title="Disputes could not be loaded." className="mt-6">
                    {error}
                </Alert>
            ) : null}

            {!data && loading && !error ? <ListSkeleton rows={3} className="mt-6" /> : null}

            {data && data.disputes.length === 0 && !error ? (
                <EmptyState className="mt-6" title={status === "submitted" ? "No disputes waiting" : "Nothing here"} description="New disputes appear here as people send them." />
            ) : null}

            <ul className="mt-6 space-y-3">
                {(data?.disputes ?? []).map((dispute) => (
                    <DisputeCard key={dispute.id} dispute={dispute} onDecided={replace} />
                ))}
            </ul>
        </AdminPage>
    );
}
