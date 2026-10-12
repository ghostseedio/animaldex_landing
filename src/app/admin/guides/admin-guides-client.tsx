"use client";

import {useCallback, useEffect, useState, type ReactNode} from "react";
import {
    adminLocationStatusLabel,
    personLabel,
    reasonLabel,
    type GuideBookingRow,
    type GuideListingReview,
    type GuideSellerApplication
} from "@/lib/guide-marketplace-admin";
import {AdminPage, Alert, Badge, Button, Card, cn, EmptyState as UiEmptyState, ListSkeleton, PageHeader, RefreshButton, Segmented, Skeleton, Spinner} from "@/components/admin/ui";

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

function StatusBadge({status, className}: {status: string; className?: string}) {
    if (status === "pending" || status === "pending_review") return <Badge tone="warn" className={className}>{status.replace("_", " ")}</Badge>;
    if (status === "approved" || status === "published" || status === "accepted" || status === "completed") {
        return <Badge tone="android" className={className}>{status.replace("_", " ")}</Badge>;
    }
    if (status === "rejected" || status === "declined" || status === "cancelled") {
        return <Badge tone="bad" className={className}>{status.replace("_", " ")}</Badge>;
    }
    if (status === "suspended" || status === "paused") {
        return <Badge className={cn("border-orange-400/30 bg-orange-400/10 text-orange-200", className)}>{status.replace("_", " ")}</Badge>;
    }
    return <Badge className={className}>{status.replace("_", " ")}</Badge>;
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
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Content"
                title="Wildlife Guides"
                description={<>
                    Review seller applications and listings waiting to go public. Booking requests stay with the
                    Guide — this queue is visibility for support, not a substitute for the seller accepting in the app.
                </>}
                actions={<RefreshButton loading={loading} onClick={() => void load()} />}
            />

            <Segmented
                className="mt-6"
                label="Queue"
                value={tab}
                onChange={setTab}
                options={[
                    {value: "applications", label: "Applications", count: counts ? counts.pendingApplications : null},
                    {value: "listings", label: "Listings", count: counts ? counts.pendingListings : null},
                    {value: "bookings", label: "Bookings", count: counts ? counts.pendingBookings : null}
                ]}
            />

            {error || notice ? (
                <div className="mt-4 flex flex-col gap-3">
                    {error && <Alert tone="bad">{error}</Alert>}
                    {notice && <Alert tone="good">{notice}</Alert>}
                </div>
            ) : null}

            {loading && !payload && (
                tab === "bookings" ? (
                    <ListSkeleton rows={4} className="mt-6" />
                ) : (
                    <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                        <ListSkeleton rows={5} />
                        <Card className="p-6" aria-hidden="true">
                            <Skeleton className="h-7 w-1/2" />
                            <Skeleton className="mt-2 h-3 w-24" />
                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {Array.from({length: 6}, (_, index) => <Skeleton key={index} className="h-14" />)}
                            </div>
                        </Card>
                    </section>
                )
            )}

            {payload && tab === "applications" && (
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
                            className={`w-full border px-4 py-3 text-left transition ${selectedApplication?.userId === row.userId ? "border-primary-300 bg-primary-500/10" : "border-line-300 bg-surface-900 hover:border-primary-400/50"}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-bold text-white">{personLabel(row.displayName, row.username, row.userId)}</p>
                                    <p className="mt-1 text-xs tabular-nums text-ink-500">{row.eligibility.qualifyingWildCaptureCount}/{row.eligibility.requiredWildCaptureCount} wild captures · {row.eligibility.qualifyingWildSpeciesCount}/{row.eligibility.requiredWildSpeciesCount} species</p>
                                </div>
                                <StatusBadge status={row.sellerStatus} className="shrink-0" />
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

            {payload && tab === "listings" && (
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
                            className={`w-full border px-4 py-3 text-left transition ${selectedListing?.id === row.id ? "border-primary-300 bg-primary-500/10" : "border-line-300 bg-surface-900 hover:border-primary-400/50"}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-white">{row.title}</p>
                                    <p className="mt-1 text-xs text-ink-500">{row.publicAreaLabel} · {row.serviceCategoryLabel}</p>
                                </div>
                                <StatusBadge status={row.status} className="shrink-0" />
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
                            onRequestCorrection={() => run(
                                {action: "reject_listing", listingId: selectedListing.id},
                                `Request correction for “${selectedListing.title}”? This rejects the pending listing so the seller can edit the title or public area and resubmit. Do not rewrite seller content here.`
                            )}
                        />
                    ) : null}
                </QueueLayout>
            )}

            {payload && tab === "bookings" && (
                <section className="mt-6">
                    <FilterRow filters={BOOKING_FILTERS} value={bookingFilter} onChange={setBookingFilter} />
                    {bookings.length === 0 ? (
                        <EmptyState text="No booking requests in this filter." />
                    ) : (
                        <div className="mt-4 grid gap-3">
                            {bookings.map((row) => (
                                <Card key={row.id} className="p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-display text-lg text-white">{row.listingTitle || "Guide experience"}</p>
                                            <p className="mt-1 text-sm text-ink-400">
                                                {personLabel(row.requesterDisplayName, row.requesterUsername, row.requesterUserId)}
                                                {" → "}
                                                {personLabel(row.sellerDisplayName, row.sellerUsername, row.sellerUserId)}
                                            </p>
                                        </div>
                                        <StatusBadge status={row.status} />
                                    </div>
                                    <p className="mt-3 text-sm tabular-nums text-ink-300">{row.requestedDate} · {row.guestCount} guest{row.guestCount === 1 ? "" : "s"}</p>
                                    {row.message && <p className="mt-3 whitespace-pre-wrap border-l-2 border-line-300 pl-3 text-sm leading-6 text-ink-200">{row.message}</p>}
                                    <p className="mt-3 text-xs text-ink-500">Requested {dateLabel(row.createdAt)}. Accept/decline happens in the seller’s app, not here.</p>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </AdminPage>
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
        <div role="group" aria-label="Filter" className="inline-flex max-w-full flex-wrap border border-line-300 bg-canvas-900 p-0.5">
            {filters.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange(item.id)}
                    aria-pressed={value === item.id}
                    className={`min-h-7 px-2.5 text-xs font-black transition ${value === item.id ? "bg-white/[.1] text-white" : "text-ink-500 hover:text-white"}`}
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
        <section className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div>
                <FilterRow filters={filters} value={filter} onChange={onFilter} />
                <div className="mt-3 grid gap-2">
                    {items.length === 0 ? <EmptyState text={empty} /> : items}
                </div>
            </div>
            <div>{children}</div>
        </section>
    );
}

function EmptyState({text}: {text: string}) {
    return <UiEmptyState className="mt-4 py-8" title={text} />;
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
        <article className="border border-line-300 bg-surface-900 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-display text-2xl text-white">{personLabel(row.displayName, row.username, row.userId)}</h2>
                    {row.username && <p className="mt-1 text-sm text-ink-400">@{row.username.replace(/^@/, "")}</p>}
                </div>
                <StatusBadge status={row.sellerStatus} />
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
                        <li key={code}><Badge className="normal-case tracking-normal font-bold">{reasonLabel(code)}</Badge></li>
                    ))}
                </ul>
            )}
            {row.approveBlockedReason && row.sellerStatus === "pending" && (
                <Alert tone="warn" className="mt-4">{row.approveBlockedReason}</Alert>
            )}
            <p className="mt-4 text-xs text-ink-500">Applied {dateLabel(row.createdAt)} · Updated {dateLabel(row.updatedAt)}</p>
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line-300 pt-4">
                {row.sellerStatus === "pending" && (
                    <>
                        <Button variant="primary" disabled={busy || !row.canApprove} onClick={onApprove}>Approve</Button>
                        <Button variant="danger" disabled={busy} onClick={onReject}>Reject</Button>
                        <BusyNote busy={busy} />
                        <p className="basis-full text-xs text-ink-500">Approving notifies them in the app and by push.</p>
                    </>
                )}
                {row.sellerStatus === "approved" && (
                    <>
                        <Button disabled={busy} onClick={onSuspend} className="border-orange-400/40 text-orange-100 hover:border-orange-300">Suspend</Button>
                        <BusyNote busy={busy} />
                    </>
                )}
                {(row.sellerStatus === "rejected" || row.sellerStatus === "suspended") && (
                    <>
                        <Button variant="primary" disabled={busy || !sellerApproveGateClient(row)} onClick={onApprove}>Approve</Button>
                        <BusyNote busy={busy} />
                        <p className="basis-full text-xs text-ink-500">Approving notifies them in the app and by push.</p>
                    </>
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
    onRequestCorrection
}: {
    row: GuideListingReview;
    busy: boolean;
    onPublish: () => void;
    onRequestCorrection: () => void;
}) {
    return (
        <article className="border border-line-300 bg-surface-900 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">{row.serviceCategoryLabel}</p>
                    <h2 className="mt-1 font-display text-2xl text-white">{row.title}</h2>
                </div>
                <StatusBadge status={row.status} />
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <Stat label="Title" value={row.title} />
                <Stat label="Public experience area" value={row.publicAreaLabel} />
                <Stat label="Normalized location" value={normalizedLocation(row)} />
                <Stat label="Location status" value={adminLocationStatusLabel(row.locationMismatch)} />
            </dl>
            {row.locationMismatch ? (
                <div className="mt-4 space-y-3 border border-amber-300/30 bg-amber-400/[.08] px-4 py-3 text-sm leading-6 text-amber-100">
                    <p>{row.locationMismatchMessage}</p>
                    <p>Do not rewrite the title or public area here. There is no automatic fix.</p>
                    {row.status === "published" ? (
                        <p>
                            This listing stays published until the Guide pauses it or you wait for a corrected resubmission.
                            Pause remains a seller action. After they resubmit, publish only if the mismatch is gone.
                        </p>
                    ) : null}
                </div>
            ) : null}
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
                <Alert tone="warn" className="mt-4">{row.publishBlockedReason}</Alert>
            )}
            {row.status === "pending_review" && (
                <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line-300 pt-4">
                    <Button variant="primary" disabled={busy || !row.canPublish} onClick={onPublish}>Publish</Button>
                    <Button variant="danger" disabled={busy} onClick={onRequestCorrection}>Request correction</Button>
                    <BusyNote busy={busy} />
                </div>
            )}
            {row.status === "published" && row.locationMismatch ? (
                <div className="mt-6 flex flex-wrap gap-2 border-t border-line-300 pt-4">
                    <p className="border border-line-300 px-4 py-2 text-sm font-bold text-ink-200">Keep published</p>
                    <p className="border border-line-300 px-4 py-2 text-sm text-ink-400">Pause: seller only</p>
                </div>
            ) : null}
        </article>
    );
}

function normalizedLocation(row: GuideListingReview) {
    const parts = [row.publicLocality || row.publicPlaceName, row.publicAdminArea, countryName(row.countryCode)]
        .filter((part): part is string => Boolean(part && part.trim()));
    return parts.length > 0 ? parts.join(" · ") : `${row.publicAreaLabel} · ${row.countryCode}`;
}

function countryName(code: string) {
    try {
        return new Intl.DisplayNames(["en"], {type: "region"}).of(code.toUpperCase()) || code;
    } catch {
        return code;
    }
}

function Stat({label, value}: {label: string; value: string}) {
    return (
        <div className="border border-line-300/60 bg-canvas-900 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[.12em] text-ink-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-white">{value}</p>
        </div>
    );
}

/** The review buttons share one pending flag, so the spinner sits beside them. */
function BusyNote({busy}: {busy: boolean}) {
    if (!busy) return null;
    return <span role="status" className="inline-flex items-center gap-2 text-xs font-bold text-ink-400"><Spinner size={12} />Saving…</span>;
}
