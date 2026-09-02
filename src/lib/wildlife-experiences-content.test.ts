import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {experienceDiscoveryBlogPosts} from "@/data/blog/earn";
import {earnPaths} from "@/data/earn-economy";
import {getBlogPost} from "@/data/blog";
import {GUIDE_CATEGORIES} from "@/lib/guide-marketplace-core";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

const page = readRepo("src/app/[locale]/(composited)/wildlife-experiences/page.tsx");
const directory = readRepo("src/app/[locale]/(composited)/wildlife-experiences/experiences-directory.tsx");
const card = readRepo("src/app/[locale]/(composited)/wildlife-experiences/experience-card.tsx");

test("wildlife-experiences is a distinct gateway from the marketplace", () => {
    assert.equal(earnPaths.wildlifeExperiences, "/wildlife-experiences");
    assert.equal(earnPaths.wildlifeGuidesMarketplace, "/wildlife-guides");
    assert.match(page, /getPublicGuideListings/);
    assert.match(page, /CollectionPage/);
    assert.match(page, /ItemList/);
    assert.match(page, /wildlife_experiences_view/);
    assert.match(page, /HowBookingWorks/);
    assert.match(page, /What is an AnimalDex Wildlife Guide/);
    assert.doesNotMatch(page, /instant booking/i);
    assert.doesNotMatch(page, /AggregateRating/);
    assert.doesNotMatch(page, /wildlife-experiences\/\[/);
    assert.doesNotMatch(card, /review count/i);
    assert.match(readRepo("src/lib/build-sitemap.ts"), /wildlife-experiences/);
});

test("filters reuse the real Guide category enum", () => {
    assert.match(directory, /GUIDE_CATEGORIES/);
    assert.match(directory, /isGuideCategory/);
    assert.match(directory, /guideLocationFilterKey/);
    assert.match(directory, /guideAreaServedName/);
    assert.doesNotMatch(directory, /near me/i);
    assert.ok(GUIDE_CATEGORIES.herping);
});

test("experience blogs are buyer-facing and point at the gateway", () => {
    assert.equal(experienceDiscoveryBlogPosts.length, 8);
    for (const post of experienceDiscoveryBlogPosts) {
        assert.ok(getBlogPost(post.slug));
        const linked = JSON.stringify(post.sections);
        assert.match(linked, /\/wildlife-experiences/);
        assert.doesNotMatch(JSON.stringify(post), /best locations in Bali/i);
    }
});

test("listing pages request in the app and do not invent checkout", () => {
    const listing = readRepo("src/app/[locale]/(composited)/guides/[listing]/page.tsx");
    const cta = readRepo("src/components/guides/guide-booking-request.tsx");
    assert.match(listing, /GuideBookingRequestCta/);
    assert.match(listing, /HowBookingWorks/);
    assert.match(listing, /isGuideListingIndexable/);
    assert.match(cta, /Request this experience/);
    assert.match(cta, /guide_booking_request_clicked/);
    assert.match(cta, /auth_started_for_guide_request/);
    assert.doesNotMatch(cta, /app_booking_request_started/);
    const analytics = readRepo("src/components/guides/guide-analytics.tsx");
    assert.match(analytics, /JSON.stringify\(dimensions\)/);
    assert.doesNotMatch(analytics, /app_booking_request_started/);
    assert.doesNotMatch(listing, /Book now/);
    assert.doesNotMatch(listing, /InStock/);
    assert.doesNotMatch(cta, /Book now/);
    assert.doesNotMatch(listing, /AggregateRating/);
});

test("internal links expose the new route", () => {
    const footer = readRepo("src/app/[locale]/(composited)/_components/footer.tsx");
    const marketplace = readRepo("src/app/[locale]/(composited)/wildlife-guides/page.tsx");
    const home = readRepo("src/app/[locale]/(composited)/(home)/page.tsx");
    assert.match(footer, /wildlife-experiences/);
    assert.match(marketplace, /wildlife-experiences/);
    assert.match(home, /wildlife-experiences/);
});
