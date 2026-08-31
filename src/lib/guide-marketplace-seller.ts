import {
    categoryLabel,
    currencyFractionDigits,
    formatGuidePrice,
    type GuideCategory,
    isGuideCategory
} from "./guide-marketplace-core";
import {collectionQualified, mapEligibility, type GuideEligibility} from "./guide-marketplace-admin";

export type OwnedGuideListing = {
    id: string;
    title: string;
    slug: string;
    description: string;
    publicSummary: string;
    serviceCategory: GuideCategory;
    serviceCategoryLabel: string;
    publicAreaLabel: string;
    regionCode: string | null;
    countryCode: string;
    durationMinutes: number;
    maxGuests: number;
    currencyCode: string;
    amountMinor: number;
    priceLabel: string;
    status: string;
    coverImageUrl: string | null;
    submittedAt: string | null;
    updatedAt: string;
    resumeRequiresReview: boolean;
};

export type GuideListingDraftInput = {
    listingId?: string | null;
    title: string;
    description: string;
    publicSummary: string;
    serviceCategory: GuideCategory;
    publicAreaLabel: string;
    regionCode: string;
    countryCode: string;
    durationMinutes: number;
    maxGuests: number;
    currencyCode: string;
    amountText: string;
};

export type SellerGuideBooking = {
    id: string;
    listingId: string;
    listingTitle: string | null;
    requesterDisplayName: string | null;
    requesterUsername: string | null;
    requestedDate: string;
    guestCount: number;
    message: string | null;
    status: string;
    createdAt: string;
};

export const GUIDE_LISTING_COVERS_BUCKET = "guide-listing-covers";
export const GUIDE_SELLER_TERMS_VERSION = "2026-08-guide-seller-v2";

function asString(value: unknown, fallback = "") {
    return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function asBoolean(value: unknown) {
    return value === true;
}

export function parseGuideAmountMinor(amountText: string, currencyCode: string) {
    const normalized = amountText.replace(/,/g, "").trim();
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) return null;
    const multiplier = 10 ** currencyFractionDigits(currencyCode.toUpperCase());
    return Math.round(value * multiplier);
}

export function formatGuideAmountInput(amountMinor: number, currencyCode: string) {
    const multiplier = 10 ** currencyFractionDigits(currencyCode.toUpperCase());
    const value = amountMinor / multiplier;
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function validateGuideListingDraft(draft: GuideListingDraftInput) {
    if (draft.title.trim().length < 5) return "Title needs at least 5 characters.";
    if (draft.publicSummary.trim().length < 20) return "One-line pitch needs at least 20 characters.";
    if (draft.description.trim().length < 40) return "Description needs at least 40 characters.";
    if (!draft.publicAreaLabel.trim()) return "Add the public experience area.";
    if (!draft.countryCode.trim()) return "Add a country code (e.g. US, ID, GB).";
    if (draft.durationMinutes < 30 || draft.durationMinutes > 1440) return "Duration must be between 30 minutes and 24 hours.";
    if (draft.maxGuests < 1 || draft.maxGuests > 50) return "Group size must be between 1 and 50 guests.";
    if (!parseGuideAmountMinor(draft.amountText, draft.currencyCode)) return "Enter a valid cash price per person.";
    return null;
}

export function mapOwnedGuideListing(row: Record<string, unknown>): OwnedGuideListing {
    const category = isGuideCategory(asString(row.service_category)) ? row.service_category as GuideCategory : "general_wildlife";
    const amountMinor = asNumber(row.amount_minor);
    const currencyCode = asString(row.currency_code, "USD").toUpperCase();

    return {
        id: asString(row.id),
        title: asString(row.title),
        slug: asString(row.slug),
        description: asString(row.description),
        publicSummary: asString(row.public_summary),
        serviceCategory: category,
        serviceCategoryLabel: categoryLabel(category),
        publicAreaLabel: asString(row.public_area_label),
        regionCode: typeof row.region_code === "string" && row.region_code.trim() ? row.region_code : null,
        countryCode: asString(row.country_code, "US").toUpperCase(),
        durationMinutes: asNumber(row.duration_minutes, 120),
        maxGuests: asNumber(row.max_guests, 6),
        currencyCode,
        amountMinor,
        priceLabel: formatGuidePrice(amountMinor, currencyCode),
        status: asString(row.status, "draft"),
        coverImageUrl: typeof row.cover_image_url === "string" && row.cover_image_url.trim() ? row.cover_image_url : null,
        submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : null,
        updatedAt: asString(row.updated_at),
        resumeRequiresReview: asBoolean(row.resume_requires_review)
    };
}

export function mapSellerGuideBooking(row: Record<string, unknown>, listingTitle: string | null): SellerGuideBooking {
    return {
        id: asString(row.id),
        listingId: asString(row.guide_listing_id),
        listingTitle,
        requesterDisplayName: typeof row.requester_display_name === "string" ? row.requester_display_name : null,
        requesterUsername: typeof row.requester_username === "string" ? row.requester_username : null,
        requestedDate: asString(row.requested_date),
        guestCount: asNumber(row.guest_count, 1),
        message: typeof row.message === "string" && row.message.trim() ? row.message : null,
        status: asString(row.status, "pending"),
        createdAt: asString(row.created_at)
    };
}

export function mapGuideEligibility(raw: unknown): GuideEligibility {
    return mapEligibility((raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>);
}

export function guideSellerPhase(eligibility: GuideEligibility) {
    if (eligibility.sellerStatus === "approved" && eligibility.termsAccepted) return "approved" as const;
    if (eligibility.sellerStatus === "pending") return "pending" as const;
    if (eligibility.sellerStatus === "rejected") return "rejected" as const;
    if (eligibility.sellerStatus === "suspended") return "suspended" as const;
    if (collectionQualified(eligibility) && eligibility.accountAgeEligible && eligibility.termsAccepted) return "ready_to_apply" as const;
    if (collectionQualified(eligibility) && eligibility.accountAgeEligible) return "ready_for_terms" as const;
    return "locked" as const;
}

export function progressRatio(current: number, required: number) {
    if (required <= 0) return 100;
    return Math.min(100, Math.round((current / required) * 100));
}
