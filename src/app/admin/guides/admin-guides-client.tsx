"use client";

import Link from "next/link";
import {useCallback, useEffect, useState, type ReactNode} from "react";
import {
    personLabel,
    reasonLabel,
    type GuideBookingRow,
    type GuideListingReview,
    type GuideSellerApplication
} from "@/lib/guide-marketplace-admin";

type Tab = "applications" | "listings" | "bookings";

type Payload = {
    ok: boolean;
    applications: GuideSellerApplication[];
    listings: GuideListingReview[];
    bookings: GuideBookingRow[];
    counts: {
        pendingApplications: number;
        pendingListings: number;
        pendingBookings: number;
    };
    error?: string;
};

const APPLICATION_FILTERS = [
    {id: "pending", label: "Pending"},
    {id: "approved", label: "Approved"},
    {id: "rejected", label: "Rejected"},
    {id: "suspended", label: "Suspended"},
    {id: "all", label: "All"}
] as const;

const LISTING_FILTERS = [
    {id: "pending_review", label: "Pending review"},
    {id: "published", label: "Published"},
    {id: "rejected", label: "Rejected"},
    {id: "paused", label: "Paused"},
    {id: "all", label: "All"}
] as const;

const BOOKING_FILTERS = [
    {id: "pending", label: "Pending"},
    {id: "accepted", label: "Accepted"},
    {id: "declined", label: "Declined"},
    {id: "cancelled", label: "Cancelled"},
    {id: "completed", label: "Completed"},
    {id: "all", label: "All"}
] as const;

function dateLabel(value: string | null) {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function statusClass(status: string) {
    if (status === "pending" || status === "pending_review") return "border-amber-400/30 bg-amber-400/15 text-amber-200";
    if (status === "approved" || status === "published" || status === "accepted" || status === "completed") {
        return "border-emerald-400/30 bg-emerald-400/15 text-emerald-200";
    }
    if (status === "rejected" || status === "declined" || status === "cancelled") {
        return "border-rose-400/30 bg-rose-400/15 text-rose-200";
    }
    if (status === "suspended" || status === "paused") return "border-orange-400/30 bg-orange-400/15 text-orange-200";
    return "border-line-300 bg-white/[.04] text-ink-300";
}

export default function AdminGuidesClient() {
    const [tab, setTab] = useState<Tab>("applications");
    const [applicationFilter, setApplicationFilter] = useState("pending");
    const [listingFilter, setListingFilter] = useState("pending_review");
    const [bookingFilter, setBookingFilter] = useState("pending");
    const [payload, setPayload] = useState<Payload | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const query = new URLSearchParams({
                applications: applicationFilter,
                listings: listingFilter,
                bookings: bookingFilter
            });
            const response = await fetch(`/api/admin/guides?${query}`, {cache: "no-store"});
            const json = await response.json() as Payload;
            if (!response.ok || json.ok === false) throw new Error(json.error || "Unable to load Wildlife Guides");
            setPayload(json);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load Wildlife Guides");
        } finally {
            setLoading(false);
        }
    }, [applicationFilter, listingFilter, bookingFilter]);

    useEffect(() => {
        void load();
    }, [load]);

    async function run(body: Record<string, unknown>, confirmText: string) {
        if (!window.confirm(confirmText)) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const response = await fetch("/api/admin/guides", {
                method: "POST",
                headers: {"content-type": "application/json"},
                cache: "no-store",
                body: JSON.stringify(body)
            });
            const json = await response.json() as {ok?: boolean; error?: string; action?: string};
            if (!response.ok || json.ok === false) throw new Error(json.error || "Review failed");
            setNotice(json.action ? `Saved: ${json.action.replace(/_/g, " ")}` : "Saved");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Review failed");
        } finally {
            setBusy(false);
        }
    }

    const applications = payload?.applications ?? [];
    const listings = payload?.listings ?? [];
    const bookings = payload?.bookings ?? [];
    const selectedApplication = applications.find((row) => row.userId === selectedUserId) ?? applications[0] ?? null;
    const selectedListing = listings.find((row) => row.id === selectedListingId) ?? listings[0] ?? null;
    const counts = payload?.counts;

    return (
        <main className="min-h-screen bg-canvas-950 px-4 py-8 text-ink-100 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-6xl">
                <Link href="/admin" className="text-sm text-ink-400 hover:text-white">← Admin</Link>
                <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-primary-200">Guide marketplace</p>
                <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Wildlife Guides</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-400">
                    Review seller applications and listings waiting to go public. Booking requests stay with the
                    Guide — this queue is visibility for support, not a substitute for the seller accepting in the app.
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                    {([
                        ["applications", "Applications", counts?.pendingApplications ?? 0],
                        ["listings", "Listings", counts?.pendingListings ?? 0],
                        ["bookings", "Bookings", counts?.pendingBookings ?? 0]
                    ] as const).map(([id, label, count]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setTab(id)}
                            className={`rounded-full border px-4 py-2 text-sm font-bold ${tab === id ? "border-primary-300 bg-primary-500/15 text-primary-100" : "border-line-300 text-ink-400"}`}
                        >
                            {label} · {count}
                        </button>
                    ))}
                </div>

                {error && <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{error}</p>}
                {notice && <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
                {loading && <p className="mt-6 text-sm text-ink-400">Loading queue…</p>}

                {!loading && tab === "applications" && (
                    <QueueLayout
                        filters={APPLICATION_FILTERS}
                        filter={applicationFilter}
                        onFilter={setApplicationFilter}
                        empty="No Guide seller applications in this filter."
                        items={applications.map((row) => (
                            <button
                                key={row.userId}
                                type="button"
                                onClick={() => setSelectedUserId(row.userId)}
                                className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedApplication?.userId === row.userId ? "border-primary-300 bg-primary-500/10" : "border-line-300 bg-surface-900"}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-white">{personLabel(row.displayName, row.username, row.userId)}</p>
                                        <p className="mt-1 text-xs text-ink-500">{row.eligibility.qualifyingWildCaptureCount}/{row.eligibility.requiredWildCaptureCount} wild captures · {row.eligibility.qualifyingWildSpeciesCount}/{row.eligibility.requiredWildSpeciesCount} species</p>
                                    </div>
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(row.sellerStatus)}`}>{row.sellerStatus}</span>
                                </div>
                            </button>
                        ))}
                    >
                        {selectedApplication ? (
                            <ApplicationDetail
                                row={selectedApplication}
                                busy={busy}
                                onApprove={() => run(
                                    {action: "approve_seller", userId: selectedApplication.userId},
                                    `Approve ${personLabel(selectedApplication.displayName, selectedApplication.username, selectedApplication.userId)} as a Wildlife Guide seller?`
                                )}
                                onReject={() => run(
                                    {action: "reject_seller", userId: selectedApplication.userId},
                                    `Reject this Guide seller application?`
                                )}
                                onSuspend={() => run(
                                    {action: "suspend_seller", userId: selectedApplication.userId},
                                    `Suspend this Guide seller? Published listings will stop taking bookings.`
                                )}
                            />
                        ) : null}
                    </QueueLayout>
                )}

                {!loading && tab === "listings" && (
                    <QueueLayout
                        filters={LISTING_FILTERS}
                        filter={listingFilter}
                        onFilter={setListingFilter}
                        empty="No Guide listings in this filter."
                        items={listings.map((row) => (
                            <button
                                key={row.id}
                                type="button"
                                onClick={() => setSelectedListingId(row.id)}
                                className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedListing?.id === row.id ? "border-primary-300 bg-primary-500/10" : "border-line-300 bg-surface-900"}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-white">{row.title}</p>
                                        <p className="mt-1 text-xs text-ink-500">{row.publicAreaLabel} · {row.serviceCategoryLabel}</p>
                                    </div>
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(row.status)}`}>{row.status.replace("_", " ")}</span>
                                </div>
                            </button>
                        ))}
                    >
                        {selectedListing ? (
                            <ListingDetail
                                row={selectedListing}
                                busy={busy}
                                onPublish={() => run(
                                    {action: "publish_listing", listingId: selectedListing.id},
                                    `Publish “${selectedListing.title}”? It will appear on public Wildlife Guides.`
                                )}
                                onReject={() => run(
                                    {action: "reject_listing", listingId: selectedListing.id},
                                    `Reject “${selectedListing.title}”? The seller can edit and resubmit.`
                                )}
                            />
                        ) : null}
                    </QueueLayout>
                )}

                {!loading && tab === "bookings" && (
                    <section className="mt-6">
                        <FilterRow filters={BOOKING_FILTERS} value={bookingFilter} onChange={setBookingFilter} />
                        {bookings.length === 0 ? (
                            <EmptyState text="No booking requests in this filter." />
                        ) : (
                            <div className="mt-4 grid gap-3">
                                {bookings.map((row) => (
                                    <article key={row.id} className="rounded-2xl border border-line-300 bg-surface-900 p-5">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="font-display text-xl text-white">{row.listingTitle || "Guide experience"}</p>
                                                <p className="mt-1 text-sm text-ink-400">
                                                    {personLabel(row.requesterDisplayName, row.requesterUsername, row.requesterUserId)}
                                                    {" → "}
                                                    {personLabel(row.sellerDisplayName, row.sellerUsername, row.sellerUserId)}
                                                </p>
                                            </div>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass(row.status)}`}>{row.status}</span>
                                        </div>
                                        <p className="mt-3 text-sm text-ink-300">{row.requestedDate} · {row.guestCount} guest{row.guestCount === 1 ? "" : "s"}</p>
                                        {row.message && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-200">{row.message}</p>}
                                        <p className="mt-3 text-xs text-ink-500">Requested {dateLabel(row.createdAt)}. Accept/decline happens in the seller’s app, not here.</p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
}

function FilterRow({
    filters,
    value,
    onChange
}: {
    filters: readonly {id: string; label: string}[];
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange(item.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${value === item.id ? "border-white/20 bg-white/[.08] text-white" : "border-line-300 text-ink-500"}`}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}

function QueueLayout({
    filters,
    filter,
    onFilter,
    empty,
    items,
    children
}: {
    filters: readonly {id: string; label: string}[];
    filter: string;
    onFilter: (value: string) => void;
    empty: string;
    items: ReactNode[];
    children: ReactNode;
}) {
    return (
        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <div>
                <FilterRow filters={filters} value={filter} onChange={onFilter} />
                <div className="mt-4 grid gap-2">
                    {items.length === 0 ? <EmptyState text={empty} /> : items}
                </div>
            </div>
            <div>{children}</div>
        </section>
    );
}

function EmptyState({text}: {text: string}) {
    return <p className="rounded-2xl border border-dashed border-line-300 px-4 py-8 text-sm text-ink-500">{text}</p>;
}

function ApplicationDetail({
    row,
    busy,
    onApprove,
    onReject,
    onSuspend
}: {
    row: GuideSellerApplication;
    busy: boolean;
    onApprove: () => void;
    onReject: () => void;
    onSuspend: () => void;
}) {
    const eligibility = row.eligibility;
    return (
        <article className="rounded-3xl border border-line-300 bg-surface-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-display text-3xl text-white">{personLabel(row.displayName, row.username, row.userId)}</h2>
                    {row.username && <p className="mt-1 text-sm text-ink-400">@{row.username.replace(/^@/, "")}</p>}
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(row.sellerStatus)}`}>{row.sellerStatus}</span>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <Stat label="Wild captures" value={`${eligibility.qualifyingWildCaptureCount} / ${eligibility.requiredWildCaptureCount}`} />
                <Stat label="Wild species" value={`${eligibility.qualifyingWildSpeciesCount} / ${eligibility.requiredWildSpeciesCount}`} />
                <Stat label="Account age" value={eligibility.accountAgeEligible ? "Met" : "Too new"} />
                <Stat label="18+ attested" value={row.ageAttested ? "Yes" : "No"} />
                <Stat label="Terms" value={eligibility.termsAccepted ? row.termsVersion || "Current terms accepted" : "Not accepted"} />
                <Stat label="Standing" value={row.marketplaceStanding} />
            </dl>
            {eligibility.reasonCodes.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                    {eligibility.reasonCodes.map((code) => (
                        <li key={code} className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-ink-400">{reasonLabel(code)}</li>
                    ))}
                </ul>
            )}
            {row.approveBlockedReason && row.sellerStatus === "pending" && (
                <p className="mt-4 text-sm text-amber-200">{row.approveBlockedReason}</p>
            )}
            <p className="mt-4 text-xs text-ink-500">Applied {dateLabel(row.createdAt)} · Updated {dateLabel(row.updatedAt)}</p>
            <div className="mt-6 flex flex-wrap gap-2">
                {row.sellerStatus === "pending" && (
                    <>
                        <button type="button" disabled={busy || !row.canApprove} onClick={onApprove} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-40">Approve</button>
                        <button type="button" disabled={busy} onClick={onReject} className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-100 disabled:opacity-40">Reject</button>
                    </>
                )}
                {row.sellerStatus === "approved" && (
                    <button type="button" disabled={busy} onClick={onSuspend} className="rounded-xl border border-orange-400/40 px-4 py-2 text-sm font-bold text-orange-100 disabled:opacity-40">Suspend</button>
                )}
                {(row.sellerStatus === "rejected" || row.sellerStatus === "suspended") && (
                    <button type="button" disabled={busy || !sellerApproveGateClient(row)} onClick={onApprove} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-40">Approve</button>
                )}
            </div>
        </article>
    );
}

function sellerApproveGateClient(row: GuideSellerApplication) {
    return row.eligibility.qualifyingWildCaptureCount >= row.eligibility.requiredWildCaptureCount
        && row.eligibility.qualifyingWildSpeciesCount >= row.eligibility.requiredWildSpeciesCount
        && row.eligibility.accountAgeEligible
        && row.eligibility.ageAttested
        && row.eligibility.termsAccepted
        && row.marketplaceStanding === "good";
}

function ListingDetail({
    row,
    busy,
    onPublish,
    onReject
}: {
    row: GuideListingReview;
    busy: boolean;
    onPublish: () => void;
    onReject: () => void;
}) {
    return (
        <article className="rounded-3xl border border-line-300 bg-surface-900 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-[.18em] text-ink-500">{row.serviceCategoryLabel}</p>
                    <h2 className="mt-1 font-display text-3xl text-white">{row.title}</h2>
                    <p className="mt-2 text-sm text-ink-400">{row.publicAreaLabel} · {row.countryCode}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${statusClass(row.status)}`}>{row.status.replace("_", " ")}</span>
            </div>
            <p className="mt-5 text-sm leading-6 text-ink-200">{row.publicSummary}</p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-300">{row.description}</p>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <Stat label="Host" value={personLabel(row.sellerDisplayName, row.sellerUsername, row.sellerUserId)} />
                <Stat label="Price" value={`${row.priceLabel} / person`} />
                <Stat label="Duration" value={`${row.durationMinutes} min`} />
                <Stat label="Max guests" value={String(row.maxGuests)} />
                <Stat label="Seller eligible" value={row.sellerEligible ? "Yes" : "No"} />
                <Stat label="Submitted" value={dateLabel(row.submittedAt)} />
            </dl>
            {row.publishBlockedReason && row.status === "pending_review" && (
                <p className="mt-4 text-sm text-amber-200">{row.publishBlockedReason}</p>
            )}
            {row.status === "pending_review" && (
                <div className="mt-6 flex flex-wrap gap-2">
                    <button type="button" disabled={busy || !row.canPublish} onClick={onPublish} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-black text-canvas-950 disabled:opacity-40">Publish</button>
                    <button type="button" disabled={busy} onClick={onReject} className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-100 disabled:opacity-40">Reject</button>
                </div>
            )}
        </article>
    );
}

function Stat({label, value}: {label: string; value: string}) {
    return (
        <div className="rounded-2xl border border-white/5 bg-canvas-950/60 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-ink-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-white">{value}</p>
        </div>
    );
}
