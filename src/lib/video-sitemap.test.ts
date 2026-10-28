import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import type {PublishedContentVideoListing} from "@/lib/content-video/store";
import {serializeVideoSitemapXml, videoPageUrl, videoWatchUrl} from "@/lib/video-sitemap";

const site = "https://animaldex.app";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const video = (overrides: Partial<PublishedContentVideoListing>): PublishedContentVideoListing => ({
    type: "comparison",
    slug: "tiger-vs-lion",
    videoUrl: "https://example.supabase.co/storage/v1/object/public/content-videos/a.mp4",
    posterUrl: "https://example.supabase.co/storage/v1/object/public/content-videos/a.jpg",
    durationSeconds: 41.6,
    title: "Tiger vs Lion",
    hookText: "Who wins & why",
    timeline: [],
    publishedAt: "2026-10-10T07:04:24Z",
    sourceTitle: "Tiger vs Lion: Who Would Win?",
    ...overrides
});

test("video pages use canonical paths, rankings under /tier-list", () => {
    assert.match(videoPageUrl(site, "comparison", "tiger-vs-lion"), /\/comparisons\/tiger-vs-lion$/);
    assert.match(videoPageUrl(site, "ranking", "fastest-animals"), /\/tier-list\/fastest-animals$/);
    assert.match(videoPageUrl(site, "location", "bali"), /\/locations\/bali$/);
    assert.equal(videoWatchUrl(site, "ranking", "fastest-animals"), "https://animaldex.app/videos/ranking/fastest-animals");
});

test("video sitemap lists one escaped video per page and skips videos without a thumbnail", () => {
    const xml = serializeVideoSitemapXml(site, [
        video({}),
        video({videoUrl: "https://example.supabase.co/older.mp4"}),
        video({type: "location", slug: "bali", posterUrl: null})
    ]);
    assert.match(xml, /xmlns:video="http:\/\/www\.google\.com\/schemas\/sitemap-video\/1\.1"/);
    assert.equal(xml.match(/<url>/g)?.length, 1);
    assert.match(xml, /<video:title>Tiger vs Lion<\/video:title>/);
    assert.match(xml, /Who wins &amp; why/);
    assert.match(xml, /<video:duration>42<\/video:duration>/);
    assert.match(xml, /<loc>https:\/\/animaldex\.app\/videos\/comparison\/tiger-vs-lion<\/loc>/);
    assert.doesNotMatch(xml, /older\.mp4|bali/);
});

test("robots.txt advertises the video sitemap", () => {
    const robots = readFileSync(join(repoRoot, "src/app/robots.ts"), "utf8");
    assert.match(robots, /\/video-sitemap\.xml/);
});

test("the browser fallback for a page video still renders its VideoObject", () => {
    const island = readFileSync(join(repoRoot, "src/app/[locale]/(composited)/_components/page-video/page-video-island.tsx"), "utf8");
    assert.match(island, /application\/ld\+json/);
    assert.match(island, /pageVideoSchema/);
});
