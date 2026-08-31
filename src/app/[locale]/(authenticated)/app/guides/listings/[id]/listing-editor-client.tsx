"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {AppPage, AppPageHeader, AppSurface} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import {GUIDE_CATEGORIES, type GuideCategory} from "@/lib/guide-marketplace-core";
import {
    formatGuideAmountInput,
    type GuideListingDraftInput,
    type OwnedGuideListing,
    validateGuideListingDraft
} from "@/lib/guide-marketplace-seller";
import {
    locationMismatchMessage,
    titleStructuredLocationLooksInconsistent
} from "@/lib/guide-listing-quality";

const fieldClass =
    "mt-2 w-full rounded-2xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-200/40";

async function guidesPost(body: Record<string, unknown>) {
    const response = await fetch("/api/app/guides", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({error: "Request failed."}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Request failed.");
    return payload;
}

async function uploadCover(listingId: string, file: File) {
    const formData = new FormData();
    formData.set("listingId", listingId);
    formData.set("file", file);
    const response = await fetch("/api/app/guides/cover", {method: "POST", body: formData});
    const payload = await response.json().catch(() => ({error: "Cover upload failed."}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || "Cover upload failed.");
    return payload.listing as OwnedGuideListing;
}

function emptyDraft(): GuideListingDraftInput {
    return {
        title: "",
        description: "",
        publicSummary: "",
        serviceCategory: "general_wildlife",
        publicAreaLabel: "",
        regionCode: "",
        countryCode: "US",
        durationMinutes: 120,
        maxGuests: 6,
        currencyCode: "USD",
        amountText: "40"
    };
}

function draftFromListing(listing: OwnedGuideListing): GuideListingDraftInput {
    return {
        listingId: listing.id,
        title: listing.title,
        description: listing.description,
        publicSummary: listing.publicSummary,
        serviceCategory: listing.serviceCategory,
        publicAreaLabel: listing.publicAreaLabel,
        regionCode: listing.regionCode ?? "",
        countryCode: listing.countryCode,
        durationMinutes: listing.durationMinutes,
        maxGuests: listing.maxGuests,
        currencyCode: listing.currencyCode,
        amountText: formatGuideAmountInput(listing.amountMinor, listing.currencyCode)
    };
}

export default function ListingEditorClient({listing}: {listing: OwnedGuideListing | null}) {
    const router = useRouter();
    const [draft, setDraft] = useState<GuideListingDraftInput>(listing ? draftFromListing(listing) : emptyDraft());
    const [coverUrl, setCoverUrl] = useState<string | null>(listing?.coverImageUrl ?? null);
    const [listingId, setListingId] = useState<string | null>(listing?.id ?? null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const titleRef = useRef<HTMLInputElement>(null);
    const areaRef = useRef<HTMLInputElement>(null);
    const locationMismatch = titleStructuredLocationLooksInconsistent(draft.title, {
        publicAreaLabel: draft.publicAreaLabel
    });

    useEffect(() => {
        if (listing) {
            setDraft(draftFromListing(listing));
            setCoverUrl(listing.coverImageUrl);
            setListingId(listing.id);
        }
    }, [listing]);

    function updateDraft(patch: Partial<GuideListingDraftInput>) {
        setDraft((current) => ({...current, ...patch}));
    }

    async function saveDraft() {
        const validationError = validateGuideListingDraft(draft);
        if (validationError) {
            setError(validationError);
            return;
        }
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const payload = await guidesPost({action: "save-draft", ...draft, listingId});
            const saved = payload.listing as OwnedGuideListing;
            setListingId(saved.id);
            setCoverUrl(saved.coverImageUrl);
            setNotice("Draft saved.");
            if (!listing) router.replace(`/app/guides/listings/${saved.id}`);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Draft could not be saved.");
        } finally {
            setBusy(false);
        }
    }

    async function submitListing() {
        if (locationMismatch) {
            setError(locationMismatchMessage(draft.title, draft.publicAreaLabel));
            return;
        }
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            let id = listingId;
            if (!id) {
                const payload = await guidesPost({action: "save-draft", ...draft, listingId: null});
                id = (payload.listing as OwnedGuideListing).id;
                setListingId(id);
            }
            if (!coverUrl) throw new Error("Add a cover photo before submitting for review.");
            await guidesPost({action: "submit-listing", listingId: id});
            setNotice("Submitted for review. AnimalDex will publish it after approval.");
            router.push("/app/guides");
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Listing could not be submitted.");
        } finally {
            setBusy(false);
        }
    }

    async function onCoverChange(file: File | null) {
        if (!file) return;
        setBusy(true);
        setError(null);
        try {
            let id = listingId;
            if (!id) {
                const validationError = validateGuideListingDraft(draft);
                if (validationError) throw new Error(`Save the draft first: ${validationError}`);
                const payload = await guidesPost({action: "save-draft", ...draft, listingId: null});
                id = (payload.listing as OwnedGuideListing).id;
                setListingId(id);
                router.replace(`/app/guides/listings/${id}`);
            }
            const saved = await uploadCover(id, file);
            setCoverUrl(saved.coverImageUrl);
            setNotice("Cover photo uploaded.");
        } catch (coverError) {
            setError(coverError instanceof Error ? coverError.message : "Cover upload failed.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <AppPage narrow>
            <AppPageHeader
                eyebrow="Wildlife Guides"
                title={listing ? "Edit guide listing" : "Create guide listing"}
                description="Real-money local experiences. Collectors pay you in cash on the day. AnimalDex does not process that payment."
                action={<Link href="/app/guides" className="text-sm font-bold text-primary-200 hover:text-white">← Back to guides</Link>}
            />

            {error ? <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
            {notice ? <p className="rounded-2xl border border-primary-200/20 bg-primary-400/10 px-4 py-3 text-sm text-primary-100">{notice}</p> : null}

            <AppSurface className="space-y-5">
                <div>
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Cover photo</label>
                    <div className="mt-2 flex flex-wrap items-center gap-4">
                        {coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverUrl} alt="" className="h-24 w-24 rounded-2xl object-cover ring-1 ring-white/10" />
                        ) : (
                            <div className="grid h-24 w-24 place-items-center rounded-2xl border border-dashed border-white/10 text-xs text-white/35">Required</div>
                        )}
                        <input type="file" accept="image/*" disabled={busy} onChange={(event) => void onCoverChange(event.target.files?.[0] ?? null)} />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Title</label>
                    <input ref={titleRef} className={fieldClass} value={draft.title} onChange={(event) => updateDraft({title: event.target.value})} placeholder="Dawn birding around the wetlands" />
                </div>

                <div>
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Category</label>
                    <select className={fieldClass} value={draft.serviceCategory} onChange={(event) => updateDraft({serviceCategory: event.target.value as GuideCategory})}>
                        {Object.entries(GUIDE_CATEGORIES).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">One-line pitch</label>
                    <input className={fieldClass} value={draft.publicSummary} onChange={(event) => updateDraft({publicSummary: event.target.value})} placeholder="Slow morning walk for wetland birds and seasonal migrants." />
                </div>

                <div>
                    <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Description</label>
                    <textarea className={`${fieldClass} min-h-[8rem]`} value={draft.description} onChange={(event) => updateDraft({description: event.target.value})} placeholder="What happens, what to bring, ethical wildlife rules, and what is not guaranteed." />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Public experience area</label>
                        <input ref={areaRef} className={fieldClass} value={draft.publicAreaLabel} onChange={(event) => updateDraft({publicAreaLabel: event.target.value})} placeholder="Bogor, West Java" />
                    </div>
                    <div>
                        <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Country code</label>
                        <input className={fieldClass} value={draft.countryCode} onChange={(event) => updateDraft({countryCode: event.target.value.toUpperCase()})} placeholder="US" />
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                        <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Duration (minutes)</label>
                        <input type="number" min={30} max={1440} className={fieldClass} value={draft.durationMinutes} onChange={(event) => updateDraft({durationMinutes: Number(event.target.value)})} />
                    </div>
                    <div>
                        <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Max guests</label>
                        <input type="number" min={1} max={50} className={fieldClass} value={draft.maxGuests} onChange={(event) => updateDraft({maxGuests: Number(event.target.value)})} />
                    </div>
                    <div>
                        <label className="text-xs font-black uppercase tracking-[0.14em] text-white/35">Price / person</label>
                        <div className="mt-2 flex gap-2">
                            <input className={`${fieldClass} mt-0 w-20`} value={draft.currencyCode} onChange={(event) => updateDraft({currencyCode: event.target.value.toUpperCase()})} />
                            <input className={`${fieldClass} mt-0 flex-1`} value={draft.amountText} onChange={(event) => updateDraft({amountText: event.target.value})} placeholder="40" />
                        </div>
                    </div>
                </div>

                {locationMismatch ? (
                    <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                        <p>{locationMismatchMessage(draft.title, draft.publicAreaLabel)}</p>
                        <p className="mt-2 text-amber-100/80">
                            If the title names the real place, search and select that public area. If the selected area is correct, edit the title so it no longer names a different place. Submitting stays blocked until they agree.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" onClick={() => areaRef.current?.focus()} className="rounded-full bg-amber-300 px-4 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-canvas-950">Change area</button>
                            <button type="button" onClick={() => titleRef.current?.focus()} className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white">Edit title</button>
                        </div>
                    </div>
                ) : null}

                <div className="flex flex-wrap gap-3 pt-2">
                    <button type="button" disabled={busy} onClick={() => void saveDraft()} className="rounded-full border border-white/10 px-5 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition hover:text-white disabled:opacity-60">
                        {busy ? "Saving…" : "Save draft"}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submitListing()}
                        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary-400 px-6 font-display text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-primary-200 disabled:opacity-60"
                    >
                        Submit for review
                    </button>
                </div>
            </AppSurface>
        </AppPage>
    );
}
