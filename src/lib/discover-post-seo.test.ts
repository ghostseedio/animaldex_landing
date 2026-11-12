import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import type {DiscoverTimelineItem} from "@/data/discover-timeline";
import {discoverPostJsonLd, discoverPostSeoFields} from "@/lib/discover-post-seo";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Owner decision 247 (2026-11-12): what search and link previews see of a shared post names the animal, never the
// person (no name, no @handle) and never the place.
const PERSON = ["jakeduggan", "@jakeduggan", "Jake Duggan", "Jake"];
const PLACE = ["Nam Hoa Lu", "Ninh Binh", "Vietnam"];
const collector = {name: "Jake Duggan", username: "jakeduggan", id: "u1", avatarUrl: null};
const base = {id: "capture-1", date: "2026-11-10T08:00:00Z", locationLabel: "Nam Hoa Lu · Ninh Binh · Vietnam", activitySummary: "@jakeduggan's Domestic Duck at Nam Hoa Lu"};

const items = [
    {...base, kind: "capture", animalName: "Domestic Duck", scientificName: "Anas platyrhynchos domesticus", collector, contextLabel: "Domestic", hasVideoMedia: true, imageSrc: "/a.jpg", mediaAssets: [{kind: "video", url: "/v.mp4", mimeType: "video/mp4"}]},
    {...base, kind: "capture", animalName: "Grey Heron", scientificName: null, collector, contextLabel: null, hasVideoMedia: false, imageSrc: "/a.jpg", mediaAssets: []},
    {...base, kind: "alignment", rewardedAnimalName: "Lion", collector, imageSrc: "/a.jpg"},
    {...base, kind: "fusion", receiverAnimalName: "Owl", donorAnimalName: "Cheetah", collector, receiverImageSrc: "/a.jpg"},
    {...base, kind: "animal-trial", speciesName: "Octopus", principleName: "Flexible Intelligence", collector, evidenceSrc: null},
    {...base, kind: "challenge", attacker: {animalName: "Lion", displayName: "Jake Duggan", username: "jakeduggan", imageSrc: "/a.jpg"}, defender: {animalName: "Tiger", displayName: "Jake", username: "jakeduggan"}},
    {...base, kind: "trade", offerer: {animalName: "Fox", name: "Jake Duggan", username: "jakeduggan", imageSrc: "/a.jpg"}, receiver: {animalName: "Wolf", name: "Jake", username: "jakeduggan"}}
] as unknown as DiscoverTimelineItem[];

test("no indexable post's title, description, keywords, cards or structured data name the person or the place", () => {
    for (const item of items) {
        const seo = discoverPostSeoFields(item);
        const ld = discoverPostJsonLd(seo, {pageUrl: "https://animaldex.app/p/capture-1", imageUrl: "https://animaldex.app/a.jpg", videoUrl: seo.video ? "https://animaldex.app/v.mp4" : null, siteUrl: "https://animaldex.app/"});
        const text = JSON.stringify({title: seo.title, description: seo.description, keywords: seo.keywords, ld});
        for (const word of [...PERSON, ...PLACE]) assert.ok(!text.includes(word), `${item.kind}: "${word}" in ${text}`);
        assert.ok(seo.title.length > 0 && seo.description.length > 0);
        assert.doesNotMatch(text, /"Person"|"author"/);
    }
    const duck = discoverPostSeoFields(items[0]);
    assert.equal(duck.title, "Domestic Duck (domestic), November 10, 2026");
    assert.equal(duck.description, "Domestic Duck (Anas platyrhynchos domesticus) in a domestic setting, captured and shared on AnimalDex on November 10, 2026. Watch the short video capture.");
});

test("the post page builds its metadata and structured data from the privacy-safe fields only", () => {
    const page = readFileSync(join(repoRoot, "src/app/[locale]/p/[postId]/page.tsx"), "utf8");
    assert.match(page, /discoverPostSeoFields/);
    assert.match(page, /discoverPostJsonLd/);
    for (const banned of ["collector.username", "collector.name", "locationLabel", "discoverPostShareDescription", "discoverPostShareTitle", "\"Person\""]) {
        assert.ok(!page.includes(banned), `${banned} in the post page`);
    }
});
