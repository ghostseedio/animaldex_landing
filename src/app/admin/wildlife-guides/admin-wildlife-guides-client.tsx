"use client";

import {useCallback, useEffect, useState} from "react";
import {AdminPage, Alert, Badge, Button, EmptyState, fieldClass, ListSkeleton, PageHeader, RefreshButton, Section, Segmented} from "@/components/admin/ui";
import {formatGuidePrice, guidePath} from "@/lib/virtual-wildlife-guides";

type Person = {userId?: string; username?: string; displayName?: string; email?: string};

type ReviewItem = {
    purchaseId: string;
    kind: "refund_request" | "reversed_after_payout";
    status: string;
    channel: "credits" | "web_card" | string;
    amountMinor: number;
    currencyCode: string;
    creditsAmount?: number;
    sellerShareMinor?: number;
    paidAt?: string;
    refundRequestedAt?: string;
    note?: string;
    sellerReplied?: boolean;
    guide: {id: string; title: string; areaLabel?: string};
    buyer?: Person;
    seller?: Person;
    buyerRefundsLast90Days?: number;
};

type AdminGuide = {
    id: string;
    title: string;
    areaLabel?: string;
    status: string;
    pausedBy?: string;
    publiclyVisible?: boolean;
    speciesCount?: number;
    amountMinor: number;
    currencyCode: string;
    salesCount?: number;
    refundCount?: number;
    moderationNote?: string;
    moderatedBy?: string;
    moderatedAt?: string;
    seller?: Person;
};

type Tab = "queue" | "guides";

async function post<T>(body: Record<string, unknown>): Promise<T> {
    const response = await fetch("/api/admin/wildlife-guides", {
        method: "POST",
        headers: {"content-type": "application/json"},
        cache: "no-store",
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error("Unauthorized");
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Request failed");
    return payload as T;
}

const when = (value?: string) => value ? new Date(value).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"}) : "—";

function person(value?: Person) {
    if (!value) return "—";
    const handle = value.username ? `@${value.username}` : value.displayName || value.userId || "—";
    return value.email ? `${handle} · ${value.email}` : handle;
}

export default function AdminWildlifeGuidesClient() {
    const [tab, setTab] = useState<Tab>("queue");
    const [items, setItems] = useState<ReviewItem[]>([]);
    const [guides, setGuides] = useState<AdminGuide[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const loadQueue = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setItems((await post<{items: ReviewItem[]}>({action: "queue"})).items);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load the review queue");
        } finally {
            setLoading(false);
        }
    }, []);

    const search = useCallback(async (text: string) => {
        setLoading(true);
        setError(null);
        try {
            setGuides((await post<{guides: AdminGuide[]}>({action: "search", query: text})).guides);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to search guides");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (tab === "queue") void loadQueue();
        else void search(query);
        // The search box runs on submit, not on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, loadQueue, search]);

    async function resolve(item: ReviewItem, approve: boolean) {
        const note = notes[item.purchaseId]?.trim() ?? "";
        if (!approve && !note) {
            setError("A note is required to decline.");
            return;
        }
        setBusy(item.purchaseId);
        setError(null);
        setNotice(null);
        try {
            await post({action: "resolve", purchaseId: item.purchaseId, approve, note});
            setNotice(item.kind === "reversed_after_payout"
                ? `Marked recovered: ${item.guide.title}`
                : `${approve ? "Refunded" : "Declined"}: ${item.guide.title}`);
            await loadQueue();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Decision failed");
        } finally {
            setBusy(null);
        }
    }

    async function moderate(guide: AdminGuide, hidden: boolean) {
        const reason = notes[guide.id]?.trim() ?? "";
        if (hidden && !reason) {
            setError("A reason is required to hide a guide.");
            return;
        }
        setBusy(guide.id);
        setError(null);
        setNotice(null);
        try {
            const result = await post<{guide: AdminGuide | null}>({action: "moderate", listingId: guide.id, hidden, reason});
            if (result.guide) setGuides((current) => current.map((row) => (row.id === guide.id ? result.guide! : row)));
            setNotes((current) => ({...current, [guide.id]: ""}));
            setNotice(`${hidden ? "Hidden" : "Restored"}: ${guide.title}`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Moderation failed");
        } finally {
            setBusy(null);
        }
    }

    return (
        <AdminPage>
            <PageHeader
                eyebrow="Creator economy"
                title="Wildlife Guides"
                description="Refund requests that need a person (a buyer's second refund in 90 days), card payments reversed after the author was paid, and hiding or restoring guides. Every decision records who made it."
                actions={<RefreshButton loading={loading} onClick={() => (tab === "queue" ? void loadQueue() : void search(query))} />}
            />

            <Segmented
                label="View"
                className="mt-6"
                value={tab}
                onChange={(value) => { setNotice(null); setTab(value); }}
                options={[{value: "queue", label: "Review queue"}, {value: "guides", label: "Guides"}]}
            />

            {error ? <Alert tone="bad" className="mt-4">{error}</Alert> : null}
            {notice ? <Alert tone="good" className="mt-4">{notice}</Alert> : null}

            {tab === "queue" ? (
                <Section title={`Waiting for review · ${items.length}`}>
                    {loading ? <ListSkeleton rows={4} /> : null}
                    {!loading && items.length === 0 ? <EmptyState title="Nothing to review." /> : null}
                    <div className="space-y-2">
                        {!loading && items.map((item) => {
                            const reversed = item.kind === "reversed_after_payout";
                            const amount = formatGuidePrice(item.amountMinor, item.currencyCode);
                            return (
                                <article key={item.purchaseId} className="border border-line-300 bg-surface-900 p-4">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <a href={guidePath({id: item.guide.id, title: item.guide.title})} target="_blank" rel="noopener noreferrer" className="font-display text-lg text-white hover:underline">
                                            {item.guide.title}
                                        </a>
                                        <Badge tone={reversed ? "bad" : "warn"}>{reversed ? "Reversed after payout" : "Refund request"}</Badge>
                                    </div>
                                    {item.guide.areaLabel ? <p className="text-xs text-ink-400">{item.guide.areaLabel}</p> : null}
                                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-ink-400 sm:grid-cols-2">
                                        <div><dt className="inline">Buyer </dt><dd className="inline text-ink-200">{person(item.buyer)}</dd></div>
                                        <div><dt className="inline">Author </dt><dd className="inline text-ink-200">{person(item.seller)}</dd></div>
                                        <div>
                                            <dt className="inline">Amount </dt>
                                            <dd className="inline tabular-nums text-ink-200">
                                                {amount}{item.channel === "credits" && item.creditsAmount ? ` (${item.creditsAmount} Credits)` : ""} · {item.channel === "web_card" ? "card" : "Credits"}
                                            </dd>
                                        </div>
                                        <div><dt className="inline">Paid </dt><dd className="inline text-ink-200">{when(item.paidAt)}</dd></div>
                                        {item.refundRequestedAt ? <div><dt className="inline">Refund asked </dt><dd className="inline text-ink-200">{when(item.refundRequestedAt)}</dd></div> : null}
                                        <div><dt className="inline">Author replied </dt><dd className="inline text-ink-200">{item.sellerReplied ? "Yes" : "No"}</dd></div>
                                        <div><dt className="inline">Buyer refunds in 90 days </dt><dd className="inline tabular-nums text-ink-200">{item.buyerRefundsLast90Days ?? 0}</dd></div>
                                        {reversed ? (
                                            <div>
                                                <dt className="inline">Author share to recover </dt>
                                                <dd className="inline tabular-nums text-amber-200">{formatGuidePrice(item.sellerShareMinor ?? 0, item.currencyCode)}</dd>
                                            </div>
                                        ) : null}
                                    </dl>
                                    {item.note ? <p className="mt-3 border-l-2 border-line-300 pl-3 text-sm leading-6 text-ink-200">{item.note}</p> : null}
                                    {reversed ? (
                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            <p className="text-xs text-ink-400">Recover the share with an Earnings adjustment first, then close this.</p>
                                            <Button variant="primary" size="sm" loading={busy === item.purchaseId} disabled={busy !== null} onClick={() => void resolve(item, true)}>
                                                Mark recovered
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                                            <input
                                                className={fieldClass}
                                                placeholder="Note (required to decline; the buyer sees it)"
                                                value={notes[item.purchaseId] ?? ""}
                                                maxLength={500}
                                                onChange={(event) => setNotes((current) => ({...current, [item.purchaseId]: event.target.value}))}
                                            />
                                            <Button variant="primary" size="sm" loading={busy === item.purchaseId} disabled={busy !== null} onClick={() => void resolve(item, true)}>
                                                Approve refund
                                            </Button>
                                            <Button variant="danger" size="sm" disabled={busy !== null || !(notes[item.purchaseId]?.trim())} onClick={() => void resolve(item, false)}>
                                                Decline
                                            </Button>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </Section>
            ) : (
                <Section title="Guides">
                    <form
                        className="mb-4 flex gap-2"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void search(query);
                        }}
                    >
                        <input
                            className={fieldClass}
                            placeholder="Title, place, @username or guide id"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        <Button type="submit" variant="outline">Search</Button>
                    </form>
                    {loading ? <ListSkeleton rows={5} /> : null}
                    {!loading && guides.length === 0 ? <EmptyState title="No guides found." /> : null}
                    <div className="space-y-2">
                        {!loading && guides.map((guide) => {
                            const hiddenByUs = guide.pausedBy === "moderation";
                            return (
                                <article key={guide.id} className="border border-line-300 bg-surface-900 p-4">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <a href={guidePath(guide)} target="_blank" rel="noopener noreferrer" className="font-display text-lg text-white hover:underline">{guide.title}</a>
                                        <div className="flex flex-wrap gap-1.5">
                                            <Badge tone={guide.status === "published" ? "good" : "neutral"}>{guide.status}{guide.pausedBy ? ` · ${guide.pausedBy.replace("_", " ")}` : ""}</Badge>
                                            <Badge tone={guide.publiclyVisible ? "good" : "neutral"}>{guide.publiclyVisible ? "public" : "not public"}</Badge>
                                        </div>
                                    </div>
                                    <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-ink-400 sm:grid-cols-2">
                                        <div><dt className="inline">Place </dt><dd className="inline text-ink-200">{guide.areaLabel ?? "—"}</dd></div>
                                        <div><dt className="inline">Author </dt><dd className="inline text-ink-200">{person(guide.seller)}</dd></div>
                                        <div><dt className="inline">Price </dt><dd className="inline tabular-nums text-ink-200">{formatGuidePrice(guide.amountMinor, guide.currencyCode)}</dd></div>
                                        <div><dt className="inline">Sales / refunds </dt><dd className="inline tabular-nums text-ink-200">{guide.salesCount ?? 0} / {guide.refundCount ?? 0}</dd></div>
                                        {guide.moderatedBy ? (
                                            <div className="sm:col-span-2">
                                                <dt className="inline">Moderated </dt>
                                                <dd className="inline text-ink-200">{guide.moderatedBy} · {when(guide.moderatedAt)}{guide.moderationNote ? ` · ${guide.moderationNote}` : ""}</dd>
                                            </div>
                                        ) : null}
                                    </dl>
                                    {hiddenByUs ? (
                                        <div className="mt-3">
                                            <Button size="sm" loading={busy === guide.id} disabled={busy !== null} onClick={() => void moderate(guide, false)}>Restore</Button>
                                        </div>
                                    ) : (
                                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                                            <input
                                                className={fieldClass}
                                                placeholder="Reason (required; the author sees it)"
                                                value={notes[guide.id] ?? ""}
                                                maxLength={500}
                                                onChange={(event) => setNotes((current) => ({...current, [guide.id]: event.target.value}))}
                                            />
                                            <Button variant="danger" size="sm" loading={busy === guide.id} disabled={busy !== null || !(notes[guide.id]?.trim())} onClick={() => void moderate(guide, true)}>
                                                Hide
                                            </Button>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </Section>
            )}
        </AdminPage>
    );
}
