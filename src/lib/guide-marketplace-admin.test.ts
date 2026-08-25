import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    collectionQualified,
    isGuideAdminAction,
    listingPublishGate,
    listingReviewRpc,
    mapEligibility,
    mapListingReview,
    mapSellerApplication,
    parseGuideAdminRpcError,
    sellerApproveGate,
    sellerReviewRpc
} from "./guide-marketplace-admin";

const here = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(join(here, "../app/api/admin/guides/route.ts"), "utf8");
const libSource = readFileSync(join(here, "guide-marketplace-admin.ts"), "utf8");

const eligibleCollection = mapEligibility({
    eligible: false,
    qualifyingWildCaptureCount: 45,
    requiredWildCaptureCount: 45,
    qualifyingWildSpeciesCount: 20,
    requiredWildSpeciesCount: 20,
    accountAgeEligible: true,
    ageAttested: true,
    marketplaceStanding: "good",
    termsAccepted: true,
    sellerStatus: "pending",
    reasonCodes: ["beta_approval_required"]
});

test("pending applicants can be approved when collection, age, terms, and attestation hold", () => {
    assert.equal(collectionQualified(eligibleCollection), true);
    assert.equal(eligibleCollection.eligible, false);
    const gate = sellerApproveGate(eligibleCollection);
    assert.equal(gate.ok, true);
    const mapped = mapSellerApplication(
        {id: "11111111-1111-4111-8111-111111111111", display_name: "Guide Seller", username: "guide_seller"},
        {
            user_id: "11111111-1111-4111-8111-111111111111",
            seller_status: "pending",
            marketplace_standing: "good",
            age_attested_18_plus: true,
            terms_version: "2026-08-guide-seller-v1",
            terms_accepted_at: "2026-08-22T08:00:00Z",
            created_at: "2026-08-22T08:00:00Z",
            updated_at: "2026-08-22T08:00:00Z",
            reviewed_at: null
        },
        eligibleCollection
    );
    assert.equal(mapped.canApprove, true);
    assert.equal(mapped.approveBlockedReason, null);
});

test("short wild-capture collections cannot be approved", () => {
    const short = mapEligibility({
        ...eligibleCollection,
        qualifyingWildCaptureCount: 44,
        reasonCodes: ["wild_capture_requirement", "beta_approval_required"]
    });
    const gate = sellerApproveGate(short);
    assert.equal(gate.ok, false);
    assert.match(gate.reason ?? "", /45 wild captures/);
});

test("seller review RPCs stamp standing with the decision", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    assert.deepEqual(sellerReviewRpc("approve_seller", userId, null).body, {
        p_user_id: userId,
        p_seller_status: "approved",
        p_marketplace_standing: "good",
        p_reviewer_id: null
    });
    assert.equal(sellerReviewRpc("suspend_seller", userId, userId).body.p_marketplace_standing, "suspended");
    assert.equal(listingReviewRpc("publish_listing", userId).body.p_decision, "published");
    assert.equal(listingReviewRpc("reject_listing", userId).body.p_decision, "rejected");
});

test("listing publish is blocked until the seller is marketplace-eligible", () => {
    assert.equal(listingPublishGate("pending_review", false).ok, false);
    assert.equal(listingPublishGate("pending_review", true).ok, true);
    assert.equal(listingPublishGate("published", true).ok, false);
    const listing = mapListingReview(
        {
            id: "22222222-2222-4222-8222-222222222222",
            seller_user_id: "11111111-1111-4111-8111-111111111111",
            title: "Jakarta Night Herping",
            slug: "jakarta-night-herping",
            description: "A careful evening walk looking for amphibians around a broad public area.",
            public_summary: "Observe amphibians responsibly.",
            service_category: "herping",
            public_area_label: "Bogor, West Java",
            region_code: "JB",
            country_code: "ID",
            duration_minutes: 240,
            max_guests: 6,
            currency_code: "IDR",
            amount_minor: 350000,
            status: "pending_review",
            submitted_at: "2026-08-22T08:00:00Z",
            updated_at: "2026-08-22T08:00:00Z",
            resume_requires_review: false
        },
        {
            displayName: "Guide Seller",
            username: "guide_seller",
            eligibility: mapEligibility({...eligibleCollection, eligible: true, sellerStatus: "approved", reasonCodes: []})
        }
    );
    assert.equal(listing.canPublish, true);
    assert.equal(listing.serviceCategoryLabel, "Herping");
    assert.match(listing.priceLabel, /Rp|IDR|350/);
});

test("guide admin RPC errors stay operator-readable", () => {
    assert.equal(
        parseGuideAdminRpcError("ERROR: guide_seller_not_eligible"),
        "Seller is not eligible, so this listing cannot be published."
    );
    assert.equal(isGuideAdminAction("approve_seller"), true);
    assert.equal(isGuideAdminAction("resolve_booking"), false);
});

test("admin route uses service-role review RPCs and does not resolve bookings", () => {
    assert.match(routeSource, /isSupportAdminRequestAuthorized|resolveAdminActor/);
    assert.match(routeSource, /getSupabaseServiceKey/);
    assert.match(routeSource, /sellerReviewRpc/);
    assert.match(routeSource, /listingReviewRpc/);
    assert.match(libSource, /set_guide_seller_review/);
    assert.match(libSource, /review_guide_listing/);
    assert.doesNotMatch(routeSource, /resolve_guide_booking_request/);
    assert.doesNotMatch(libSource, /resolve_guide_booking_request/);
    assert.doesNotMatch(routeSource, /credit_balances/);
    assert.doesNotMatch(routeSource, /location_lat|capture_id/);
});
