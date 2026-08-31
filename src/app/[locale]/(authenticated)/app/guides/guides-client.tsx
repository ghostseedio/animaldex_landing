"use client";

import {useCallback, useEffect, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import {
    AppEmpty,
    AppMetric,
    AppPage,
    AppPageHeader,
    AppPrimaryLink,
    AppProgress,
    AppSectionTitle,
    AppSurface
} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {GUIDE_CATEGORIES, guidePath} from "@/lib/guide-marketplace-core";
import {
    guideSellerPhase,
    progressRatio,
    type OwnedGuideListing,
    type SellerGuideBooking
} from "@/lib/guide-marketplace-seller";
import type {GuideEligibility} from "@/lib/guide-marketplace-admin";
import {reasonLabel} from "@/lib/guide-marketplace-admin";

type HubTab = "setup" | "listings" | "requests";

type GuidesPayload = {
    ok?: boolean;
    eligibility: GuideEligibility;
    listings: OwnedGuideListing[];
    bookings: SellerGuideBooking[];
    error?: string;
};

async function guidesRequest<T = GuidesPayload>(init?: Omit<RequestInit, "body"> & {body?: Record<string, unknown>}) {
    const response = await fetch("/api/app/guides", {
        ...init,
        headers: {"Content-Type": "application/json", ...(init?.headers ?? {})},
        body: init?.body ? JSON.stringify(init.body) : undefined,
        cache: "no-store"
    });
    const payload = await response.json().catch(() => ({error: "Wildlife Guides request failed."}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Wildlife Guides request failed.");
    return payload as T;
}

function statusLabel(status: string) {
    return status.replace(/_/g, " ");
}

export default function GuidesClient({initialTab = "setup"}: {initialTab?: HubTab}) {
    const [tab, setTab] = useState<HubTab>(initialTab);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [eligibility, setEligibility] = useState<GuideEligibility | null>(null);
    const [listings, setListings] = useState<OwnedGuideListing[]>([]);
    const [bookings, setBookings] = useState<SellerGuideBooking[]>([]);
    const [ageAttested, setAgeAttested] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);

    const phase = eligibility ? guideSellerPhase(eligibility) : "locked";
    const canManageListings = phase === "approved";
    const published = useMemo(() => listings.filter((listing) => listing.status === "published"), [listings]);
    const drafts = useMemo(() => listings.filter((listing) => listing.status !== "published"), [listings]);
    const pendingBookings = useMemo(() => bookings.filter((booking) => booking.status === "pending"), [bookings]);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const payload = await guidesRequest();
            setEligibility(payload.eligibility);
            setListings(payload.listings);
            setBookings(payload.bookings);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Could not load Wildlife Guides.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function apply() {
        if (!ageAttested || !termsAccepted) {
            setError("Confirm your age and accept the Guide Seller Terms.");
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const payload = await guidesRequest<{ok: boolean; eligibility: GuideEligibility}>({
                method: "POST",
                body: {action: "apply", ageAttested: true}
            });
            setEligibility(payload.eligibility);
            setTab("setup");
        } catch (applyError) {
            setError(applyError instanceof Error ? applyError.message : "Application could not be submitted.");
        } finally {
            setBusy(false);
        }
    }

    async function listingAction(action: "pause-listing" | "resume-listing", listingId: string) {
        setBusy(true);
        setError(null);
        try {
            await guidesRequest({method: "POST", body: {action, listingId}});
            await load();
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : "Listing update failed.");
        } finally {
            setBusy(false);
        }
    }

    async function resolveBooking(requestId: string, resolveAction: "accepted" | "declined" | "completed") {
        setBusy(true);
        setError(null);
        try {
            await guidesRequest({method: "POST", body: {action: "resolve-booking", requestId, resolveAction}});
            await load();
        } catch (actionError) {
            setError(actionError instanceof Error ? actionError.message : "Booking update failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppPage narrow>
            <AppPageHeader
                eyebrow="Wildlife Guides"
                title="Guide setup"
                description="Apply to become a Wildlife Guide, publish local experiences, and manage booking requests — the same flow as AnimalDex on iOS."
                action={canManageListings ? <AppPrimaryLink href="/app/guides/listings/new">Create guide</AppPrimaryLink> : null}
            />

            <div className="flex flex-wrap gap-2">
                {([
                    ["setup", "Setup"],
                    ["listings", "Listings"],
                    ["requests", `Requests${pendingBookings.length ? ` (${pendingBookings.length})` : ""}`]
                ] as const).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${
                            tab === id ? "bg-primary-400 text-black" : "border border-white/10 bg-white/[0.04] text-white/55 hover:text-white"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

            {loading ? (
                <AppSurface><p className="text-sm text-white/45">Loading Wildlife Guides…</p></AppSurface>
            ) : null}

            {!loading && tab === "setup" && eligibility ? (
                <div className="space-y-6">
                    <AppSurface className="space-y-5">
                        <AppSectionTitle icon="mission" title="Seller eligibility" detail="These numbers unlock the application. Approval is still reviewed by a person." />
                        <div className="grid gap-4 sm:grid-cols-3">
                            <AppMetric label="Wild captures" value={`${eligibility.qualifyingWildCaptureCount}/${eligibility.requiredWildCaptureCount}`} />
                            <AppMetric label="Wild species" value={`${eligibility.qualifyingWildSpeciesCount}/${eligibility.requiredWildSpeciesCount}`} accent="violet" />
                            <AppMetric label="Account age" value={eligibility.accountAgeEligible ? "Ready" : "Too new"} accent="gold" />
                        </div>
                        <div className="space-y-3">
                            <div>
                                <div className="mb-1 flex justify-between text-xs text-white/45"><span>Wild captures</span><span>{progressRatio(eligibility.qualifyingWildCaptureCount, eligibility.requiredWildCaptureCount)}%</span></div>
                                <AppProgress value={progressRatio(eligibility.qualifyingWildCaptureCount, eligibility.requiredWildCaptureCount)} />
                            </div>
                            <div>
                                <div className="mb-1 flex justify-between text-xs text-white/45"><span>Wild species</span><span>{progressRatio(eligibility.qualifyingWildSpeciesCount, eligibility.requiredWildSpeciesCount)}%</span></div>
                                <AppProgress value={progressRatio(eligibility.qualifyingWildSpeciesCount, eligibility.requiredWildSpeciesCount)} accent="violet" />
                            </div>
                        </div>
                        {eligibility.reasonCodes.length ? (
                            <ul className="space-y-1 text-sm text-white/45">
                                {eligibility.reasonCodes.map((code) => (
                                    <li key={code}>• {reasonLabel(code)}</li>
                                ))}
                            </ul>
                        ) : null}
                    </AppSurface>

                    {phase === "locked" ? (
                        <AppSurface>
                            <p className="text-sm leading-7 text-white/55">Keep collecting wild species honestly in AnimalDex. When you hit the capture, species, and account-age requirements, you can apply here on web or in the app.</p>
                        </AppSurface>
                    ) : null}

                    {(phase === "ready_for_terms" || phase === "ready_to_apply") && eligibility.sellerStatus !== "pending" ? (
                        <AppSurface className="space-y-4">
                            <h2 className="font-display text-xl font-bold text-white">Apply to become a Wildlife Guide</h2>
                            <p className="text-sm leading-7 text-white/55">You meet the collection requirements. Confirm your age, accept the current Guide Seller Terms, and submit your application for human review.</p>
                            <label className="flex items-start gap-3 text-sm text-white/70">
                                <input type="checkbox" checked={ageAttested} onChange={(event) => setAgeAttested(event.target.checked)} className="mt-1" />
                                <span>I am 18 years or older.</span>
                            </label>
                            <label className="flex items-start gap-3 text-sm text-white/70">
                                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1" />
                                <span>
                                    I accept the current Guide Seller Terms and understand I am responsible for local permits, licences, and insurance.
                                    {" "}
                                    <Link href="/legal/terms" className="text-primary-200 hover:text-white">Read terms</Link>
                                </span>
                            </label>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => void apply()}
                                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary-400 px-6 font-display text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-primary-200 disabled:opacity-60"
                            >
                                {busy ? "Submitting…" : "Submit application"}
                            </button>
                        </AppSurface>
                    ) : null}

                    {phase === "pending" ? (
                        <AppSurface>
                            <h2 className="font-display text-xl font-bold text-white">Application under review</h2>
                            <p className="mt-2 text-sm leading-7 text-white/55">A person is reviewing your Guide seller application. You will get a notification when it is approved.</p>
                        </AppSurface>
                    ) : null}

                    {phase === "approved" ? (
                        <AppSurface className="space-y-4">
                            <h2 className="font-display text-xl font-bold text-white">You are approved</h2>
                            <p className="text-sm leading-7 text-white/55">Create a listing with a cover photo, public area, duration, group size, and cash price. Published guides appear on Wildlife Experiences and your profile Shop tab after review.</p>
                            <div className="flex flex-wrap gap-3">
                                <AppPrimaryLink href="/app/guides/listings/new">Create your first guide</AppPrimaryLink>
                                <Link href="/wildlife-guides" className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-5 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition hover:text-white">
                                    Browse marketplace
                                </Link>
                            </div>
                            <p className="text-xs text-white/35">Categories: {Object.values(GUIDE_CATEGORIES).join(" · ")}</p>
                        </AppSurface>
                    ) : null}

                    {(phase === "rejected" || phase === "suspended") ? (
                        <AppSurface>
                            <h2 className="font-display text-xl font-bold text-white">Guide seller access unavailable</h2>
                            <p className="mt-2 text-sm leading-7 text-white/55">Your Guide seller status is {eligibility.sellerStatus}. Contact AnimalDex Support if you think this is a mistake.</p>
                            <Link href="/support" className="mt-4 inline-flex text-sm font-bold text-primary-200 hover:text-white">Talk to support →</Link>
                        </AppSurface>
                    ) : null}
                </div>
            ) : null}

            {!loading && tab === "listings" ? (
                canManageListings ? (
                    <div className="space-y-6">
                        {published.length ? (
                            <section className="space-y-3">
                                <h2 className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Published</h2>
                                {published.map((listing) => (
                                    <ListingRow key={listing.id} listing={listing} busy={busy} onPause={() => void listingAction("pause-listing", listing.id)} />
                                ))}
                            </section>
                        ) : null}
                        {drafts.length ? (
                            <section className="space-y-3">
                                <h2 className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Drafts & review</h2>
                                {drafts.map((listing) => (
                                    <ListingRow key={listing.id} listing={listing} busy={busy} onResume={listing.status === "paused" ? () => void listingAction("resume-listing", listing.id) : undefined} />
                                ))}
                            </section>
                        ) : null}
                        {!listings.length ? (
                            <AppEmpty icon="mission" title="No guide listings yet" detail="Create your first Wildlife Guide listing with a cover photo, meeting area, and cash price per person." action={<AppPrimaryLink href="/app/guides/listings/new">Create guide</AppPrimaryLink>} />
                        ) : null}
                    </div>
                ) : (
                    <AppSurface><p className="text-sm text-white/55">Complete Guide seller approval before you can publish listings.</p></AppSurface>
                )
            ) : null}

            {!loading && tab === "requests" ? (
                bookings.length ? (
                    <div className="space-y-3">
                        {bookings.map((booking) => (
                            <AppSurface key={booking.id} className="space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.14em] text-primary-200">{statusLabel(booking.status)}</p>
                                        <h3 className="mt-1 font-display text-lg font-bold text-white">{booking.listingTitle ?? "Guide listing"}</h3>
                                        <p className="mt-1 text-sm text-white/45">
                                            {booking.requestedDate} · {booking.guestCount} guest{booking.guestCount === 1 ? "" : "s"}
                                            {booking.requesterDisplayName ? ` · ${booking.requesterDisplayName}` : ""}
                                        </p>
                                        {booking.message ? <p className="mt-2 text-sm leading-6 text-white/55">{booking.message}</p> : null}
                                    </div>
                                </div>
                                {booking.status === "pending" ? (
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" disabled={busy} onClick={() => void resolveBooking(booking.id, "accepted")} className="rounded-full bg-primary-400 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black">Accept</button>
                                        <button type="button" disabled={busy} onClick={() => void resolveBooking(booking.id, "declined")} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/70">Decline</button>
                                    </div>
                                ) : null}
                                {booking.status === "accepted" ? (
                                    <button type="button" disabled={busy} onClick={() => void resolveBooking(booking.id, "completed")} className="rounded-full bg-primary-400 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black">Mark complete</button>
                                ) : null}
                            </AppSurface>
                        ))}
                    </div>
                ) : (
                    <AppEmpty icon="bell" title="No booking requests yet" detail="When a collector requests your experience, it will show up here for accept, decline, or completion." />
                )
            ) : null}
        </AppPage>
    );
}

function ListingRow({
    listing,
    busy,
    onPause,
    onResume
}: {
    listing: OwnedGuideListing;
    busy: boolean;
    onPause?: () => void;
    onResume?: () => void;
}) {
    const publicHref = listing.status === "published" ? guidePath(listing) : null;

    return (
        <AppSurface className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
                {listing.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.coverImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
                ) : (
                    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-xs font-bold text-white/35">Cover</div>
                )}
                <div className="min-w-0">
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-white/35">{statusLabel(listing.status)}</p>
                    <h3 className="truncate font-display text-lg font-bold text-white">{listing.title}</h3>
                    <p className="mt-1 text-sm text-white/45">{listing.publicAreaLabel} · {listing.priceLabel} / person</p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Link href={`/app/guides/listings/${listing.id}`} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition hover:text-white">Edit</Link>
                {publicHref ? <Link href={publicHref} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition hover:text-white">View public</Link> : null}
                {onPause ? <button type="button" disabled={busy} onClick={onPause} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/70">Pause</button> : null}
                {onResume ? <button type="button" disabled={busy} onClick={onResume} className="rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/70">Resume</button> : null}
            </div>
        </AppSurface>
    );
}
