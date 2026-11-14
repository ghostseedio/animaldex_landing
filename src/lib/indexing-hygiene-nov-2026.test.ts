import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import robots from "@/app/robots";
import type {PublishedContentVideoListing} from "@/lib/content-video/store";
import {serializeVideoSitemapXml} from "@/lib/video-sitemap";

// Search Console, 13 Nov 2026: 647 of 1,000 sampled "crawled, not indexed"
// URLs were /api; "discovered, not indexed" was led by /animal-frequencies/page/N;
// 45 videos were "not on a watch page". These pin the fixes.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(import.meta.url);

function readRepo(...parts: string[]) {
    return readFileSync(join(repoRoot, ...parts), "utf8");
}

type Header = {key: string; value: string};
type HeaderRule = {source: string; headers: Header[]};

test("robots.txt keeps crawlers off every /api path, and off nothing new", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    const disallow = ([] as string[]).concat(rule?.disallow ?? []);
    assert.ok(disallow.includes("/api/"), disallow.join(", "));
    for (const kept of ["/admin", "/api/admin", "/app", "/api/app", "/compare/"]) {
        assert.ok(disallow.includes(kept), kept);
    }
    assert.deepEqual(rule?.allow, ["/", "/api/og/"]);
    assert.equal(rule?.userAgent, "*");
});

test("every /api response carries X-Robots-Tag: noindex, nofollow", async () => {
    const config = require(join(repoRoot, "next.config.js"));
    const rules: HeaderRule[] = await config.headers();
    const api = rules.filter((rule) => rule.source === "/api/:path*");
    assert.equal(api.length, 1, "one /api/:path* header rule");
    assert.deepEqual(api[0].headers, [{key: "X-Robots-Tag", value: "noindex, nofollow"}]);
    // The admin rules stay as they were (noindex + never shared-cached).
    const admin = rules.find((rule) => rule.source === "/api/admin/:path*");
    assert.ok(admin?.headers.some((header) => header.key === "X-Robots-Tag" && header.value === "noindex, nofollow"));
    assert.ok(admin?.headers.some((header) => header.key === "Cache-Control" && header.value === "private, no-store"));

    // Middleware never runs for public /api (its matcher excludes `api`), so the
    // header must come from next.config; the admin API guard keeps its own copy.
    const middleware = readRepo("src/middleware.ts");
    assert.match(middleware, /matcher: \["\/\(\(\?!api\|/);
    assert.match(middleware, /response\.headers\.set\("X-Robots-Tag", "noindex, nofollow"\)/);
});

test("/animal-frequencies pages 2..n are noindex, follow with the hub as canonical, and out of the sitemap", () => {
    const view = readRepo("src/app/[locale]/(composited)/animal-frequencies/animal-frequencies-view.tsx");
    const metadata = view.slice(
        view.indexOf("export function buildAnimalFrequenciesMetadata"),
        view.indexOf('"Animal frequencies on AnimalDex"')
    );
    assert.match(metadata, /const canonicalPath = page === 1 \? path : pagination\.pagePath\(1\);/);
    assert.match(metadata, /\.\.\.\(page > 1 \? \{robots: \{index: false, follow: true\}\} : \{\}\)/);
    assert.match(metadata, /canonical: getLocalePath\(locale, canonicalPath\)/);
    assert.match(metadata, /all\[item\] = getLocalePath\(item, canonicalPath\)/);
    assert.match(metadata, /"x-default": getLocalePath\(localeConfig\.defaultLocale, canonicalPath\)/);
    // Page 1 keeps its own canonical: pagePath(1) is the hub path itself.
    assert.doesNotMatch(metadata, /canonical: getLocalePath\(locale, path\)/);

    const sitemap = readRepo("src/lib/build-sitemap.ts");
    assert.doesNotMatch(sitemap, /hubPageEntries\(locale, animalFrequenciesPagination/);
    assert.match(sitemap, /\{url: getAbsoluteUrl\(locale, "\/animal-frequencies"\)\}/);
    // The other paged hubs are unchanged: self-canonical and listed.
    for (const pagination of ["tierListPagination", "animalTrialsPagination", "animalHybridsPagination"]) {
        assert.match(sitemap, new RegExp(`hubPageEntries\\(locale, ${pagination}`), pagination);
    }
});

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

test("the video sitemap lists watch pages only, never a source article, and skips a type with no watch page", () => {
    const xml = serializeVideoSitemapXml("https://animaldex.app", [
        video({}),
        video({type: "ranking", slug: "fastest-animals"}),
        video({type: "blog", slug: "why-cats-purr"}),
        video({type: "lesson", slug: "birth-month-january"}),
        video({type: "ark", slug: "dawn-chorus"}),
        video({type: "not-a-type" as PublishedContentVideoListing["type"], slug: "ghost"})
    ]);
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
    assert.equal(locs.length, 5, locs.join("\n"));
    for (const loc of locs) {
        assert.match(loc, /^https:\/\/animaldex\.app\/videos\/[a-z_]+\/[a-z0-9-]+$/, loc);
    }
    assert.doesNotMatch(xml, /animaldex\.app\/(comparisons|tier-list|blog|animal-powers|ark)\//);
    assert.doesNotMatch(xml, /ghost/);
});

test("the video sitemap route is served per request from the watch-page serializer", () => {
    const route = readRepo("src/app/video-sitemap.xml/route.ts");
    assert.match(route, /export const dynamic = "force-dynamic"/);
    assert.match(route, /serializeVideoSitemapXml\(getSiteUrl\(\), videos\)/);
    const watch = readRepo("src/app/[locale]/(composited)/videos/[type]/[slug]/page.tsx");
    assert.match(watch, /alternates: \{canonical: path\}/);
    assert.doesNotMatch(watch, /robots:\s*\{\s*index:\s*false/);
});
