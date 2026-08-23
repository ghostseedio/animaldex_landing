import assert from "node:assert/strict";
import test from "node:test";
import {
    buildGuideSitemapPaths, currencyFractionDigits, formatGuidePrice, guidePath, guideSeo,
    guideStructuredData, isLocationPageIndexable, locationInventory, parseGuideRouteSegment,
    type PublicGuideListing
} from "./guide-marketplace-core";

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

test("structured data matches visible service without reviews", () => {
    const schema = guideStructuredData(listing, "https://animaldex.app" + guidePath(listing), "id-ID") as Record<string, unknown>;
    assert.equal(schema["@type"], "Service");
    assert.equal("aggregateRating" in schema, false);
    assert.deepEqual((schema.offers as Record<string, unknown>).priceCurrency, "IDR");
});

test("currency honors currency-specific minor units", () => {
    assert.equal(currencyFractionDigits("JPY", "ja-JP"), 0);
    assert.match(formatGuidePrice(35000000, "IDR", "id-ID"), /350\.000/);
});

test("public model and schema expose no precise or private fields", () => {
    const output = JSON.stringify({listing, schema: guideStructuredData(listing, "https://animaldex.app/example")}).toLowerCase();
    ["latitude", "longitude", "capture_id", "meeting_location", "eligibility_evidence"].forEach((field) => assert.equal(output.includes(field), false));
});

test("sitemap includes only supplied public inventory", () => {
    const paths = buildGuideSitemapPaths([listing]);
    assert.ok(paths.includes(guidePath(listing)));
    assert.equal(paths.some((path) => path.includes("paused-listing")), false);
});

test("location and category pages require real inventory", () => {
    assert.equal(isLocationPageIndexable(locationInventory([listing], "bogor-west-java")), false);
    const second = {...listing, id: "8f82c100-1234-4abc-8def-1234567890ab", slug: "bogor-herping-two"};
    assert.equal(isLocationPageIndexable(locationInventory([listing, second], "bogor-west-java", "herping")), true);
    assert.ok(buildGuideSitemapPaths([listing, second]).includes("/wildlife-guides/bogor-west-java/herping"));
});
