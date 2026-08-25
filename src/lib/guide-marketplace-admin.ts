import {categoryLabel, formatGuidePrice, type GuideCategory} from "./guide-marketplace-core";

export const GUIDE_ADMIN_QUEUE_LIMIT = 50;

export const SELLER_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export const LISTING_REVIEW_STATUSES = ["pending_review", "published", "rejected", "paused"] as const;
export const BOOKING_STATUSES = ["pending", "accepted", "declined", "cancelled", "completed"] as const;

export type SellerStatus = (typeof SELLER_STATUSES)[number];
export type ListingReviewStatus = (typeof LISTING_REVIEW_STATUSES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type GuideAdminAction = "approve_seller" | "reject_seller" | "suspend_seller" | "publish_listing" | "reject_listing";

export type GuideEligibility = {
    eligible: boolean;
    qualifyingWildCaptureCount: number;
    requiredWildCaptureCount: number;
    qualifyingWildSpeciesCount: number;
    requiredWildSpeciesCount: number;
    accountAgeEligible: boolean;
    ageAttested: boolean;
    marketplaceStanding: string;
    termsAccepted: boolean;
    sellerStatus: string;
    reasonCodes: string[];
};

export type GuideSellerApplication = {
    userId: string;
    displayName: string | null;
    username: string | null;
    sellerStatus: SellerStatus;
    marketplaceStanding: string;
    ageAttested: boolean;
    termsVersion: string | null;
    termsAcceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
    reviewedAt: string | null;
    eligibility: GuideEligibility;
    canApprove: boolean;
    approveBlockedReason: string | null;
};

export type GuideListingReview = {
    id: string;
    sellerUserId: string;
    sellerDisplayName: string | null;
    sellerUsername: string | null;
    title: string;
    slug: string;
    description: string;
    publicSummary: string;
    serviceCategory: string;
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
    submittedAt: string | null;
    updatedAt: string;
    resumeRequiresReview: boolean;
    sellerEligible: boolean;
    sellerStatus: string;
    canPublish: boolean;
    publishBlockedReason: string | null;
};

export type GuideBookingRow = {
    id: string;
    listingId: string;
    listingTitle: string | null;
    requesterUserId: string;
    requesterDisplayName: string | null;
    requesterUsername: string | null;
    sellerUserId: string;
    sellerDisplayName: string | null;
    sellerUsername: string | null;
    requestedDate: string;
    guestCount: number;
    message: string | null;
    status: string;
    createdAt: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
    return typeof value === "string" && UUID_RE.test(value);
}

function asString(value: unknown, fallback = "") {
    return typeof value === "string" ? value : fallback;
}

function asStringOrNull(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function asBoolean(value: unknown) {
    return value === true;
}

function asStringArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
}

export function isSellerStatus(value: unknown): value is SellerStatus {
    return typeof value === "string" && (SELLER_STATUSES as readonly string[]).includes(value);
}

export function isListingReviewStatus(value: unknown): value is ListingReviewStatus {
    return typeof value === "string" && (LISTING_REVIEW_STATUSES as readonly string[]).includes(value);
}

export function isBookingStatus(value: unknown): value is BookingStatus {
    return typeof value === "string" && (BOOKING_STATUSES as readonly string[]).includes(value);
}

export function isGuideAdminAction(value: unknown): value is GuideAdminAction {
    return value === "approve_seller"
        || value === "reject_seller"
        || value === "suspend_seller"
        || value === "publish_listing"
        || value === "reject_listing";
}

export const REASON_LABELS: Record<string, string> = {
    wild_capture_requirement: "Wild capture count",
    wild_species_requirement: "Wild species count",
    account_age_requirement: "Account age",
    beta_approval_required: "Guide seller approval",
    marketplace_standing_required: "Marketplace standing",
    age_attestation_required: "Age attestation",
    seller_terms_required: "Current Guide Seller Terms"
};

export function reasonLabel(code: string) {
    return REASON_LABELS[code] ?? code.replace(/_/g, " ");
}

export function mapEligibility(raw: Record<string, unknown> | null | undefined): GuideEligibility {
    const row = raw ?? {};
    return {
        eligible: asBoolean(row.eligible),
        qualifyingWildCaptureCount: asNumber(row.qualifyingWildCaptureCount),
        requiredWildCaptureCount: asNumber(row.requiredWildCaptureCount),
        qualifyingWildSpeciesCount: asNumber(row.qualifyingWildSpeciesCount),
        requiredWildSpeciesCount: asNumber(row.requiredWildSpeciesCount),
        accountAgeEligible: asBoolean(row.accountAgeEligible),
        ageAttested: asBoolean(row.ageAttested),
        marketplaceStanding: asString(row.marketplaceStanding, "good"),
        termsAccepted: asBoolean(row.termsAccepted),
        sellerStatus: asString(row.sellerStatus, "not_applied"),
        reasonCodes: asStringArray(row.reasonCodes)
    };
}

export function collectionQualified(eligibility: GuideEligibility) {
    return eligibility.qualifyingWildCaptureCount >= eligibility.requiredWildCaptureCount
        && eligibility.qualifyingWildSpeciesCount >= eligibility.requiredWildSpeciesCount;
}

/**
 * Approval is the operator judgement. Collection, account age, terms, and
 * attestation still have to be true — `eligible` is false until approval
 * itself, because the snapshot includes `beta_approval_required`.
 */
export function sellerApproveGate(eligibility: GuideEligibility): {ok: boolean; reason: string | null} {
    if (!collectionQualified(eligibility)) {
        return {
            ok: false,
            reason: `Collection is short of ${eligibility.requiredWildCaptureCount} wild captures and ${eligibility.requiredWildSpeciesCount} wild species.`
        };
    }
    if (!eligibility.accountAgeEligible) {
        return {ok: false, reason: "Account is younger than the Guide seller age requirement."};
    }
    if (!eligibility.ageAttested) {
        return {ok: false, reason: "Seller has not attested they are 18+."};
    }
    if (!eligibility.termsAccepted) {
        return {ok: false, reason: "Seller has not accepted the current Guide Seller Terms."};
    }
    if (eligibility.marketplaceStanding !== "good") {
        return {ok: false, reason: `Marketplace standing is ${eligibility.marketplaceStanding}. Restore standing before approving.`};
    }
    return {ok: true, reason: null};
}

export function listingPublishGate(status: string, sellerEligible: boolean): {ok: boolean; reason: string | null} {
    if (status !== "pending_review") {
        return {ok: false, reason: "Only listings in pending review can be published."};
    }
    if (!sellerEligible) {
        return {ok: false, reason: "Seller is not marketplace-eligible, so publishing is blocked."};
    }
    return {ok: true, reason: null};
}

export function mapSellerApplication(
    profile: Record<string, unknown>,
    seller: Record<string, unknown>,
    eligibility: GuideEligibility
): GuideSellerApplication {
    const gate = sellerApproveGate(eligibility);
    return {
        userId: asString(seller.user_id || profile.id),
        displayName: asStringOrNull(profile.display_name),
        username: asStringOrNull(profile.username),
        sellerStatus: isSellerStatus(seller.seller_status) ? seller.seller_status : "pending",
        marketplaceStanding: asString(seller.marketplace_standing, "good"),
        ageAttested: asBoolean(seller.age_attested_18_plus),
        termsVersion: asStringOrNull(seller.terms_version),
        termsAcceptedAt: asStringOrNull(seller.terms_accepted_at),
        createdAt: asString(seller.created_at),
        updatedAt: asString(seller.updated_at),
        reviewedAt: asStringOrNull(seller.reviewed_at),
        eligibility,
        canApprove: gate.ok && asString(seller.seller_status) === "pending",
        approveBlockedReason: asString(seller.seller_status) === "pending" ? gate.reason : "This application is not pending."
    };
}

export function mapListingReview(
    listing: Record<string, unknown>,
    seller: {displayName: string | null; username: string | null; eligibility: GuideEligibility}
): GuideListingReview {
    const status = asString(listing.status);
    const category = asString(listing.service_category) as GuideCategory;
    const amountMinor = asNumber(listing.amount_minor);
    const currencyCode = asString(listing.currency_code, "USD");
    const gate = listingPublishGate(status, seller.eligibility.eligible);
    return {
        id: asString(listing.id),
        sellerUserId: asString(listing.seller_user_id),
        sellerDisplayName: seller.displayName,
        sellerUsername: seller.username,
        title: asString(listing.title),
        slug: asString(listing.slug),
        description: asString(listing.description),
        publicSummary: asString(listing.public_summary),
        serviceCategory: category,
        serviceCategoryLabel: categoryLabel(category),
        publicAreaLabel: asString(listing.public_area_label),
        regionCode: asStringOrNull(listing.region_code),
        countryCode: asString(listing.country_code),
        durationMinutes: asNumber(listing.duration_minutes),
        maxGuests: asNumber(listing.max_guests),
        currencyCode,
        amountMinor,
        priceLabel: formatGuidePrice(amountMinor, currencyCode),
        status,
        submittedAt: asStringOrNull(listing.submitted_at),
        updatedAt: asString(listing.updated_at),
        resumeRequiresReview: asBoolean(listing.resume_requires_review),
        sellerEligible: seller.eligibility.eligible,
        sellerStatus: seller.eligibility.sellerStatus,
        canPublish: gate.ok,
        publishBlockedReason: gate.reason
    };
}

export function mapBookingRow(
    booking: Record<string, unknown>,
    listingTitle: string | null,
    requester: {displayName: string | null; username: string | null},
    seller: {displayName: string | null; username: string | null}
): GuideBookingRow {
    return {
        id: asString(booking.id),
        listingId: asString(booking.guide_listing_id),
        listingTitle,
        requesterUserId: asString(booking.requester_user_id),
        requesterDisplayName: requester.displayName,
        requesterUsername: requester.username,
        sellerUserId: asString(booking.seller_user_id),
        sellerDisplayName: seller.displayName,
        sellerUsername: seller.username,
        requestedDate: asString(booking.requested_date),
        guestCount: asNumber(booking.guest_count, 1),
        message: asStringOrNull(booking.message),
        status: asString(booking.status),
        createdAt: asString(booking.created_at)
    };
}

export function sellerReviewRpc(action: Extract<GuideAdminAction, "approve_seller" | "reject_seller" | "suspend_seller">, userId: string, reviewerId: string | null) {
    if (action === "approve_seller") {
        return {
            name: "set_guide_seller_review" as const,
            body: {
                p_user_id: userId,
                p_seller_status: "approved",
                p_marketplace_standing: "good",
                p_reviewer_id: reviewerId
            }
        };
    }
    if (action === "reject_seller") {
        return {
            name: "set_guide_seller_review" as const,
            body: {
                p_user_id: userId,
                p_seller_status: "rejected",
                p_marketplace_standing: "good",
                p_reviewer_id: reviewerId
            }
        };
    }
    return {
        name: "set_guide_seller_review" as const,
        body: {
            p_user_id: userId,
            p_seller_status: "suspended",
            p_marketplace_standing: "suspended",
            p_reviewer_id: reviewerId
        }
    };
}

export function listingReviewRpc(action: Extract<GuideAdminAction, "publish_listing" | "reject_listing">, listingId: string) {
    return {
        name: "review_guide_listing" as const,
        body: {
            p_listing_id: listingId,
            p_decision: action === "publish_listing" ? "published" : "rejected"
        }
    };
}

export function parseGuideAdminRpcError(message: string) {
    const text = message.toLowerCase();
    if (text.includes("guide_seller_not_eligible")) {
        return "Seller is not eligible, so this listing cannot be published.";
    }
    if (text.includes("guide_listing_not_reviewable")) {
        return "That listing is no longer in pending review.";
    }
    if (text.includes("invalid_review_decision")) {
        return "Listing review only accepts publish or reject.";
    }
    if (text.includes("invalid_seller_status") || text.includes("invalid_marketplace_standing")) {
        return "That seller review status is not allowed.";
    }
    if (text.includes("service_role_required")) {
        return "Guide review RPCs require the service role.";
    }
    if (text.includes("profile_not_found")) {
        return "No AnimalDex profile exists for that user.";
    }
    return message;
}

export function personLabel(displayName: string | null, username: string | null, userId: string) {
    if (displayName) return displayName;
    if (username) return `@${username.replace(/^@/, "")}`;
    return userId.slice(0, 8);
}
