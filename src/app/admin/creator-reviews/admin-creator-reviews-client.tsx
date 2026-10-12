"use client";

import {useCallback, useEffect, useState} from "react";
import {AdminPage, Alert, Badge, Button, Card, CardContent, CardHeader, EmptyState, fieldClass, ListSkeleton, PageHeader, Section, Segmented, Spinner} from "@/components/admin/ui";

type Creator = {
    connection_id: string;
    user_id: string;
    animaldex_display_name: string | null;
    provider: string;
    provider_username: string | null;
    provider_account_id: string;
    account_type: string | null;
    connected_at: string;
    last_scanned_at: string | null;
    creator_verification_state: string;
    creator_verification_method: string | null;
    creator_verified_at: string | null;
    creator_verification_signals: Record<string, unknown>;
    source_media_count: number;
    candidate_count: number;
    animal_candidate_count: number;
    approved_capture_count: number;
};

type Sample = {
    source_media_id: string;
    source_post_id: string;
    media_type: string;
    caption: string | null;
    permalink: string | null;
    source_timestamp: string | null;
    preview_reference: string | null;
    credit_flags: string[];
};

type HistoryRow = {
    event_id: string;
    actor_display_name: string | null;
    from_state: string | null;
    to_state: string;
    method: string | null;
    reason: string | null;
    created_at: string;
};

type Review = {creator: Creator; samples: Sample[]; history: HistoryRow[]; auto_verification_enabled: boolean};

const STATES = ["pending_review", "verified", "rejected", "suspended"] as const;

const STATE_STYLE: Record<string, "warn" | "good" | "bad"> = {
    pending_review: "warn",
    verified: "good",
    rejected: "bad",
    suspended: "warn"
};

const date = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
}) : "—";

async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/creator-reviews", {
        method: "POST",
        headers: {"content-type": "application/json"},
        cache: "no-store",
        body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (response.status === 401) throw new Error("Unauthorized");
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Request failed");
    return payload;
}

export default function AdminCreatorReviewsClient() {
    const [state, setState] = useState<string>("pending_review");
    const [creators, setCreators] = useState<Creator[]>([]);
    const [review, setReview] = useState<Review | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    // Display only: which row or decision button is working.
    const [pressed, setPressed] = useState<string | null>(null);

    const load = useCallback(async (nextState: string) => {
        setLoading(true);
        setError(null);
        try {
            const payload = await post({action: "list", state: nextState});
            setCreators(payload.creators ?? []);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load creators");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(state);
    }, [load, state]);

    async function openReview(connectionId: string) {
        setBusy(true);
        setError(null);
        setNotice(null);
        setReason("");
        try {
            // Thumbnails are refreshed server-side on this call, because Meta CDN
            // links expire and a reviewer judging blank boxes is worse than none.
            const payload = await post({action: "review", connectionId, sampleCount: 12});
            setReview(payload as Review);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to open creator");
        } finally {
            setBusy(false);
        }
    }

    async function transition(action: "verify" | "reject" | "suspend") {
        if (!review) return;
        if (action !== "verify" && !reason.trim()) {
            setError("A reason is required when rejecting or suspending");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const result = await post({
                action,
                connectionId: review.creator.connection_id,
                reason: reason.trim() || null
            });
            setNotice(
                `${review.creator.provider_username ?? "Creator"} → ${result.to_state}`
                + (typeof result.observations_reconciled === "number"
                    ? `, ${result.observations_reconciled} observation(s) reconciled`
                    : "")
            );
            setReview(null);
            await load(state);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Action failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <AdminPage>
            <PageHeader
                eyebrow="Creator economy"
                title="Creator import reviews"
                description={
                    <>
                        Instagram authentication proves someone controls the account. It does not prove they took the
                        photographs. Judge the sample below: original wildlife photography, or reposted compilation content.
                    </>
                }
            />

            <Segmented
                label="Verification state"
                className="mt-6"
                value={state}
                onChange={(value) => { setReview(null); setState(value); }}
                options={STATES.map((value) => ({value, label: value.replace("_", " ")}))}
            />

            {error && <Alert tone="bad" className="mt-4">{error}</Alert>}
            {notice && <Alert tone="good" className="mt-4">{notice}</Alert>}

            {!review && (
                <section className="mt-6 space-y-2">
                    {loading && <ListSkeleton rows={5} />}
                    {!loading && creators.length === 0 && (
                        <EmptyState title={`No creators in ${state.replace("_", " ")}.`} />
                    )}
                    {!loading && creators.map((creator) => (
                        <button
                            key={creator.connection_id}
                            onClick={() => { setPressed(creator.connection_id); void openReview(creator.connection_id); }}
                            disabled={busy}
                            aria-busy={busy && pressed === creator.connection_id || undefined}
                            className="block w-full border border-line-300 bg-surface-900 p-4 text-left transition hover:border-primary-400/50 hover:bg-white/[.02] disabled:opacity-50"
                        >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <div className="flex items-baseline gap-2">
                                    {busy && pressed === creator.connection_id ? <Spinner className="self-center text-primary-200" /> : null}
                                    <span className="font-display text-lg text-white">@{creator.provider_username ?? "unknown"}</span>
                                    <span className="text-sm text-ink-400">{creator.animaldex_display_name ?? creator.user_id}</span>
                                </div>
                                <Badge tone={STATE_STYLE[creator.creator_verification_state] ?? "neutral"}>
                                    {creator.creator_verification_state.replace("_", " ")}
                                </Badge>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-ink-400 sm:grid-cols-4">
                                <div><dt className="inline">Media </dt><dd className="inline tabular-nums text-ink-200">{creator.source_media_count}</dd></div>
                                <div><dt className="inline">Candidates </dt><dd className="inline tabular-nums text-ink-200">{creator.candidate_count}</dd></div>
                                <div><dt className="inline">Imported </dt><dd className="inline tabular-nums text-ink-200">{creator.approved_capture_count}</dd></div>
                                <div><dt className="inline">Connected </dt><dd className="inline text-ink-200">{date(creator.connected_at)}</dd></div>
                            </dl>
                        </button>
                    ))}
                </section>
            )}

            {review && (
                <section className="mt-6">
                    <Button size="sm" variant="ghost" onClick={() => setReview(null)}>← Back to queue</Button>

                    <Card className="mt-4">
                        <CardHeader
                            title={`@${review.creator.provider_username ?? "unknown"}`}
                            action={
                                <Badge tone={STATE_STYLE[review.creator.creator_verification_state] ?? "neutral"}>
                                    {review.creator.creator_verification_state.replace("_", " ")}
                                </Badge>
                            }
                        />
                        <CardContent>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3">
                                {[
                                    ["AnimalDex user", review.creator.animaldex_display_name ?? "—"],
                                    ["AnimalDex user ID", review.creator.user_id],
                                    ["Instagram account ID", review.creator.provider_account_id],
                                    ["Account type", review.creator.account_type ?? "—"],
                                    ["Connected", date(review.creator.connected_at)],
                                    ["Last scanned", date(review.creator.last_scanned_at)],
                                    ["Source media", String(review.creator.source_media_count)],
                                    ["Candidates", String(review.creator.candidate_count)],
                                    ["Already imported", String(review.creator.approved_capture_count)]
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">{label}</dt>
                                        <dd className="mt-0.5 break-all font-mono text-[11px] text-ink-200">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            {!review.auto_verification_enabled && (
                                <p className="mt-4 text-[11px] text-ink-500">
                                    Automatic verification is disabled. Every decision here is manual and recorded against your operator session.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Section title={`Random sample of ${review.samples.length} posts`}>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                            {review.samples.map((sample) => (
                                <figure key={sample.source_media_id} className="overflow-hidden border border-line-300 bg-surface-900">
                                    <div className="relative aspect-square bg-canvas-900">
                                        {sample.preview_reference
                                            // eslint-disable-next-line @next/next/no-img-element
                                            ? <img src={sample.preview_reference} alt="" className="h-full w-full object-cover" loading="lazy" />
                                            : <span className="flex h-full items-center justify-center text-xs text-ink-500">no preview</span>}
                                        {sample.media_type === "video" && (
                                            <span className="absolute bottom-2 right-2 bg-black/70 px-1.5 py-0.5 text-[10px] text-white">▶</span>
                                        )}
                                    </div>
                                    <figcaption className="space-y-1 p-3">
                                        <p className="line-clamp-3 text-[11px] leading-snug text-ink-300">{sample.caption ?? "No caption"}</p>
                                        {sample.credit_flags.length > 0 && (
                                            <p className="text-[10px] text-rose-300">⚑ {sample.credit_flags.join(", ")}</p>
                                        )}
                                        <div className="flex items-center justify-between text-[10px] text-ink-500">
                                            <span>{date(sample.source_timestamp)}</span>
                                            {sample.permalink && (
                                                <a href={sample.permalink} target="_blank" rel="noreferrer" className="text-primary-300 hover:underline">
                                                    Instagram ↗
                                                </a>
                                            )}
                                        </div>
                                    </figcaption>
                                </figure>
                            ))}
                        </div>
                        {review.samples.every((sample) => sample.credit_flags.length === 0) && (
                            <p className="mt-3 text-[11px] text-ink-500">
                                No credit or repost phrases found in this sample. That is weak evidence: an aggregator that
                                reposts without attribution also produces a clean result, so judge the images themselves.
                            </p>
                        )}
                    </Section>

                    <Card className="mt-8">
                        <CardHeader title="Decision" />
                        <CardContent>
                            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[.12em] text-ink-400" htmlFor="creator-reason">
                                Reason <span className="normal-case tracking-normal text-ink-500">(required to reject or suspend)</span>
                            </label>
                            <textarea
                                id="creator-reason"
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                rows={2}
                                placeholder="e.g. compilation account reposting other people's footage"
                                className={fieldClass}
                            />
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Button variant="primary" onClick={() => { setPressed("verify"); void transition("verify"); }} disabled={busy}
                                    loading={busy && pressed === "verify"}>
                                    Verify creator
                                </Button>
                                <Button variant="danger" onClick={() => { setPressed("reject"); void transition("reject"); }} disabled={busy}
                                    loading={busy && pressed === "reject"}>
                                    Reject as repost/aggregator
                                </Button>
                                {review.creator.creator_verification_state === "verified" && (
                                    <Button onClick={() => { setPressed("suspend"); void transition("suspend"); }} disabled={busy}
                                        loading={busy && pressed === "suspend"}
                                        className="border-amber-300/40 text-amber-200 hover:border-amber-300">
                                        Suspend verification
                                    </Button>
                                )}
                            </div>
                            <p className="mt-3 text-[11px] text-ink-500">
                                Verifying lets this creator&apos;s imported captures count toward profile stats. Suspending revokes that
                                for every capture already imported from this account.
                            </p>
                        </CardContent>
                    </Card>

                    <Section title="Verification history">
                        {review.history.length === 0
                            ? <p className="text-xs text-ink-500">No decisions recorded yet.</p>
                            : (
                                <ul className="divide-y divide-line-300/60 border border-line-300 bg-surface-900">
                                    {review.history.map((event) => (
                                        <li key={event.event_id} className="px-4 py-2.5 text-xs text-ink-300">
                                            <span className="text-ink-500">{new Date(event.created_at).toLocaleString()}</span>
                                            {" · "}
                                            <span className="text-ink-100">{event.from_state ?? "new"} → {event.to_state}</span>
                                            {event.method && <span className="text-ink-500"> · {event.method}</span>}
                                            {event.actor_display_name && <span className="text-ink-500"> · {event.actor_display_name}</span>}
                                            {event.reason && <p className="mt-1 text-ink-400">{event.reason}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                    </Section>
                </section>
            )}
        </AdminPage>
    );
}
