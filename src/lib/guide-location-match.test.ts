import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {earnProductPageMeta} from "@/data/earn-economy";
import {locationPages} from "@/data/locations";
import {
    LOCATION_GUIDE_MATCH_RULES,
    locationSlugsForListing,
    matchGuideListingsToLocation
} from "@/lib/guide-location-match";
import type {PublicGuideListing} from "@/lib/guide-marketplace-core";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readRepo = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), "utf8");

// Shape of the one live listing (Oct 2026): structured locality fields are null,
// the area lives in the label and region_code, and the title names another town.
const westJakarta = {
    title: "Night herping around Bogor",
    country_code: "ID",
    region_code: "Jakarta",
    public_area_label: "West Jakarta, Jakarta",
    public_locality: null,
    public_admin_area: null,
    public_place_name: null
} as unknown as PublicGuideListing;

test("every match rule points at a real location page", () => {
    const slugs = new Set(locationPages.map((page) => page.slug));
    for (const slug of Object.keys(LOCATION_GUIDE_MATCH_RULES)) {
        assert.ok(slugs.has(slug), `rule for unknown location ${slug}`);
    }
});

test("the West Jakarta listing matches Jakarta and Indonesia only", () => {
    assert.deepEqual(locationSlugsForListing(westJakarta).sort(), ["indonesia", "jakarta"]);
    assert.equal(matchGuideListingsToLocation([westJakarta], "west-java").length, 0, "title text is never geography");
    assert.equal(matchGuideListingsToLocation([westJakarta], "bali").length, 0);
    assert.equal(matchGuideListingsToLocation([westJakarta], "singapore-zoo").length, 0);
});

test("area names need the right country and an exact name", () => {
    const elsewhere = {...westJakarta, country_code: "MY"} as PublicGuideListing;
    assert.equal(matchGuideListingsToLocation([elsewhere], "jakarta").length, 0);
    const nearMiss = {...westJakarta, region_code: null, public_area_label: "Jakarta Outskirts"} as PublicGuideListing;
    assert.equal(matchGuideListingsToLocation([nearMiss], "jakarta").length, 0);
    const structured = {...westJakarta, region_code: null, public_area_label: "Ubud", public_locality: "Ubud", public_admin_area: "Bali"} as PublicGuideListing;
    assert.deepEqual(locationSlugsForListing(structured).sort(), ["bali", "indonesia"]);
});

test("guide demand pages carry query-first titles without a doubled brand", () => {
    for (const meta of [earnProductPageMeta.wildlifeExperiences, earnProductPageMeta.becomeGuide]) {
        assert.doesNotMatch(meta.title, /AnimalDex/, "the layout template appends the brand");
        assert.ok(`${meta.title} | AnimalDex`.length <= 60, meta.title);
        assert.ok(meta.description.length <= 155, meta.description);
    }
    assert.match(earnProductPageMeta.wildlifeExperiences.title, /^Find a Wildlife Guide/);
});

test("location pages read Guide inventory at view time and stay static", () => {
    const page = readRepo("src/app/[locale]/(composited)/locations/[slug]/page.tsx");
    const island = readRepo("src/app/[locale]/(composited)/locations/_components/location-guide-listings.tsx");
    const route = readRepo("src/app/api/locations/guide-listings/route.ts");
    assert.match(page, /export const revalidate = false/);
    assert.doesNotMatch(page, /getPublicGuideListings/);
    assert.match(page, /LocationGuideListings/);
    assert.match(page, /findGuideFaqQuestion/);
    assert.match(island, /\/api\/locations\/guide-listings/);
    assert.match(route, /matchGuideListingsToLocation/);
});
