import assert from "node:assert/strict";
import test from "node:test";
import {
    buildGuideSitemapPaths, currencyFractionDigits, formatGuidePrice, guideAreaServedName,
    guideLocationFilterKey, guideLocationSlug, guideNormalizedLocality, guidePath, guideSeo,
    guideStructuredData, hasStructuredPublicLocality, isExperiencesLocationRouteEligible,
    isLocationPageIndexable, locationInventory, parseGuideRouteSegment,
    type PublicGuideListing
} from "./guide-marketplace-core";
import {LIVE_CONTRADICTORY_LISTING_ID} from "./guide-listing-quality";
import {auditPublishedGuideLocations} from "./guide-location-audit";

const listing: PublicGuideListing = {
    id: "7f82c100-1234-4abc-8def-1234567890ab", slug: "jakarta-night-herping", title: "Jakarta Night Herping",
    description: "Search carefully for reptiles and amphibians after dark.", public_summary: "A small-group night wildlife search.",
    service_category: "herping", public_area_label: "Bogor, West Java", region_code: "ID-JB", country_code: "ID",
    duration_minutes: 240, max_guests: 6, currency_code: "IDR", amount_minor: 35000000, pricing_unit: "per_person",
    seller_user_id: "seller", seller_display_name: "Lenny", seller_username: "lenny", seller_avatar_url: null,
    published_at: "2026-08-22T00:00:00Z", updated_at: "2026-08-22T01:00:00Z",
    qualifying_wild_capture_count: 428, qualifying_wild_species_count: 183
};

test("parses stable UUID and descriptive slug", () => {
    assert.deepEqual(parseGuideRouteSegment(`${listing.slug}-${listing.id}`), {slug: listing.slug, listingId: listing.id});
    assert.equal(parseGuideRouteSegment("jakarta-night-herping-7f82c1"), null);
});

test("canonical route follows current slug without changing UUID", () => {
    assert.equal(guidePath(listing), `/guides/${listing.slug}-${listing.id}`);
    assert.notEqual(guidePath({...listing, slug: "new-title"}), guidePath(listing));
    assert.equal(parseGuideRouteSegment(guidePath(listing).split("/").pop()!)?.listingId, listing.id);
});

test("SEO metadata is normalized and human readable", () => {
    const seo = guideSeo({...listing, title: "<b>Jakarta Night Herping</b>\n"});
    assert.equal(seo.title.includes("<"), false);
    assert.match(seo.description, /4 hours/);
    assert.ok(seo.description.length <= 160);
});

test("website areaServed and SEO use structured public area only", () => {
    const contradictory = {
        ...listing,
        id: LIVE_CONTRADICTORY_LISTING_ID,
        title: "Night herping around Bogor",
        public_area_label: "West Jakarta, Jakarta",
        region_code: "Jakarta"
    };
    const seo = guideSeo(contradictory);
    const schema = guideStructuredData(contradictory, "https://animaldex.app/guides/example") as Record<string, unknown>;
    const areaServed = schema.areaServed as Record<string, unknown>;
    assert.equal(guideAreaServedName(contradictory), "West Jakarta, Jakarta");
    assert.equal(areaServed.name, "West Jakarta, Jakarta");
    assert.match(seo.title, /Night herping around Bogor/);
    assert.match(seo.description, /West Jakarta/);
    assert.doesNotMatch(seo.description, /Bogor in West Jakarta/);
    assert.doesNotMatch(seo.title, /in West Jakarta/);
    const structured = {
        ...contradictory,
        public_locality: "West Jakarta",
        public_admin_area: "Jakarta",
        public_place_name: "West Jakarta"
    };
    assert.equal(guideAreaServedName(structured), "West Jakarta, Jakarta");
    assert.equal(guideNormalizedLocality(structured), "West Jakarta");
    assert.equal(hasStructuredPublicLocality(listing), false);
    assert.equal(hasStructuredPublicLocality(structured), true);
});

test("future location route eligibility uses structured locality never title", () => {
    const titledBogor = {
        ...listing,
        title: "Night herping around Bogor",
        public_area_label: "West Jakarta, Jakarta"
    };
    assert.equal(isExperiencesLocationRouteEligible([titledBogor]), false);
    assert.equal(buildGuideSitemapPaths([titledBogor]).includes("/wildlife-experiences/bogor"), false);
    assert.equal(buildGuideSitemapPaths([titledBogor]).includes("/wildlife-experiences/west-jakarta"), false);
    const oneStructured = {
        ...listing,
        public_locality: "Bogor",
        public_place_name: "Bogor",
        public_admin_area: "West Java",
        public_area_label: "Bogor, West Java"
    };
    assert.equal(isExperiencesLocationRouteEligible([oneStructured]), false);
    const inventory = [1, 2, 3].map((index) => ({
        ...oneStructured,
        id: `7f82c100-1234-4abc-8def-1234567890a${index}`,
        slug: `bogor-walk-${index}`
    }));
    assert.equal(isExperiencesLocationRouteEligible(inventory), true);
    assert.equal(guideLocationSlug(oneStructured), "bogor");
    assert.notEqual(guideLocationSlug(titledBogor), "bogor");
});

test("location filter keys can group provider label variants of the same locality", () => {
    const bogor = {
        ...listing,
        public_area_label: "Bogor, West Java",
        public_locality: "Bogor",
        public_admin_area: "West Java"
    };
    const kotaBogor = {
        ...listing,
        id: "8f82c100-1234-4abc-8def-1234567890ab",
        public_area_label: "Kota Bogor, Jawa Barat",
        public_locality: "Bogor",
        public_admin_area: "West Java"
    };
    assert.equal(guideLocationFilterKey(bogor), guideLocationFilterKey(kotaBogor));
});

test("old listings with only public_area_label still render and stay auditable", () => {
    assert.equal(guideAreaServedName(listing), "Bogor, West Java");
    const audit = auditPublishedGuideLocations([{
        ...listing,
        id: LIVE_CONTRADICTORY_LISTING_ID,
        title: "Night herping around Bogor",
        public_area_label: "West Jakarta, Jakarta"
    }]);
    assert.equal(audit[0].id, LIVE_CONTRADICTORY_LISTING_ID);
    assert.equal(audit[0].possibleMismatch, true);
    assert.equal(audit[0].indexable, true);
    assert.equal(audit[0].publicArea, "West Jakarta, Jakarta");
});

test("structured data matches visible service without reviews", () => {
    const schema = guideStructuredData(listing, "https://animaldex.app" + guidePath(listing), "id-ID") as Record<string, unknown>;
    const offers = schema.offers as Record<string, unknown>;
    assert.equal(schema["@type"], "Service");
    assert.equal("aggregateRating" in schema, false);
    assert.equal("review" in schema, false);
    assert.deepEqual(offers.priceCurrency, "IDR");
    assert.equal("url" in offers, false);
    assert.equal("availability" in offers, false);
    assert.equal(JSON.stringify(schema).includes("Event"), false);
    assert.equal(JSON.stringify(schema).includes("InStock"), false);
});

test("currency honors currency-specific minor units", () => {
    assert.equal(currencyFractionDigits("JPY", "ja-JP"), 0);
    assert.match(formatGuidePrice(35000000, "IDR", "id-ID"), /350\.000/);
});

test("public model and schema expose no precise or private fields", () => {
    const output = JSON.stringify({listing, schema: guideStructuredData(listing, "https://animaldex.app/example")}).toLowerCase();
    ["latitude", "longitude", "capture_id", "meeting_location", "eligibility_evidence", "public_latitude", "public_longitude"].forEach((field) => assert.equal(output.includes(field), false));
});

test("sitemap includes only supplied public inventory", () => {
    const paths = buildGuideSitemapPaths([listing]);
    assert.ok(paths.includes(guidePath(listing)));
    assert.equal(paths.some((path) => path.includes("paused-listing")), false);
    const thin = {...listing, title: "Walks", description: "Too short."};
    assert.equal(buildGuideSitemapPaths([thin]).includes(guidePath(thin)), false);
});

test("location and category pages require real inventory", () => {
    assert.equal(isLocationPageIndexable(locationInventory([listing], "bogor-west-java")), false);
    const second = {...listing, id: "8f82c100-1234-4abc-8def-1234567890ab", slug: "bogor-herping-two"};
    assert.equal(isLocationPageIndexable(locationInventory([listing, second], "bogor-west-java", "herping")), true);
    assert.ok(buildGuideSitemapPaths([listing, second]).includes("/wildlife-guides/bogor-west-java/herping"));
});
