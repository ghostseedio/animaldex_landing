import assert from "node:assert/strict";
import test from "node:test";
import {
    LIVE_CONTRADICTORY_LISTING_ID,
    isGuideListingIndexable,
    locationMismatchMessage,
    titlePlaceCandidates,
    titlePublicAreaLooksInconsistent,
    titleStructuredLocationLooksInconsistent
} from "./guide-listing-quality";
import type {PublicGuideListing} from "./guide-marketplace-core";

const listing: PublicGuideListing = {
    id: LIVE_CONTRADICTORY_LISTING_ID,
    slug: "night-herping-around-bogor",
    title: "Night herping around Bogor",
    description: "We move slowly along public trails and edges after dark, using lights to look and listen without handling animals.",
    public_summary: "A small-group evening walk looking for frogs and other night wildlife.",
    service_category: "herping",
    public_area_label: "West Jakarta, Jakarta",
    region_code: "Jakarta",
    country_code: "ID",
    duration_minutes: 180,
    max_guests: 6,
    currency_code: "IDR",
    amount_minor: 350000,
    pricing_unit: "per_person",
    seller_user_id: "seller",
    seller_display_name: "Guide",
    seller_username: "guide",
    seller_avatar_url: null,
    published_at: "2026-08-25T16:34:24.483253+00:00",
    updated_at: "2026-08-25T16:34:24.483253+00:00",
    qualifying_wild_capture_count: 45,
    qualifying_wild_species_count: 20
};

test("title Bogor + area Bogor has no mismatch warning", () => {
    assert.equal(titleStructuredLocationLooksInconsistent("Night herping around Bogor", "Bogor, West Java"), false);
    assert.equal(titleStructuredLocationLooksInconsistent("Night herping around Bogor", {
        publicAreaLabel: "Bogor, West Java",
        publicLocality: "Bogor",
        publicAdminArea: "West Java"
    }), false);
});

test("title Bogor + area West Jakarta raises a mismatch warning", () => {
    assert.equal(titlePublicAreaLooksInconsistent(listing.title, listing.public_area_label), true);
    assert.deepEqual(titlePlaceCandidates(listing.title), ["Bogor"]);
    assert.equal(
        locationMismatchMessage(listing.title, listing.public_area_label),
        "Your title mentions Bogor, but the selected experience area is West Jakarta, Jakarta. Confirm where this experience actually takes place before publishing."
    );
});

test("title without geography + selected area has no warning", () => {
    assert.equal(titleStructuredLocationLooksInconsistent("Night herping after dark", "Bogor, West Java"), false);
    assert.equal(titleStructuredLocationLooksInconsistent("Night frogs and snakes after dark", {
        publicAreaLabel: "Bogor, West Java",
        publicLocality: "Bogor"
    }), false);
});

test("published listings stay indexable when seller copy meets the quality floor", () => {
    assert.equal(isGuideListingIndexable(listing), true);
    assert.equal(isGuideListingIndexable({...listing, title: "Walks"}), false);
    assert.equal(isGuideListingIndexable({...listing, description: "Too short."}), false);
    assert.equal(isGuideListingIndexable({...listing, amount_minor: 0}), false);
});
