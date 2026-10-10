import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {
    isCollapsedEnglishDetailPath,
    matchCollapsedIdDetailPath
} from "@/lib/english-detail-routes";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

test("comparison detail articles are English DB bodies, so /id twins may consolidate", () => {
    const page = read("app/[locale]/(composited)/comparisons/[slug]/page.tsx");
    const metadata = page.slice(
        page.indexOf("export async function generateMetadata"),
        page.indexOf("export default async function ComparisonDetailPage")
    );

    // Indexable title/description come from the comparison row, not locale JSON.
    assert.match(metadata, /title: challenge\.title/);
    // Description leads with the data-driven verdict (row summary as fallback).
    assert.match(
        metadata,
        /description: buildVerdictMetaDescription\(challenge\.quickVerdict, challenge\.description\)/
    );
    assert.doesNotMatch(metadata, /description: t\(/);
    assert.doesNotMatch(metadata, /t\("metaTitle"/);
    // The article body is the shared component the page renders.
    const article = read("app/[locale]/(composited)/comparisons/_components/comparison-article.tsx");
    assert.match(page, /renderComparisonArticle/);
    assert.match(article, /headline: challenge\.title/);
    assert.match(article, /summary=\{challenge\.quickVerdict\}/);
    assert.match(article, /paragraphs=\{challenge\.shortAnswer\}/);
    assert.match(article, /challenge\.faq\.map/);
    assert.equal(isCollapsedEnglishDetailPath("/comparisons/tiger-vs-lion"), true);
    assert.deepEqual(matchCollapsedIdDetailPath("/id/comparisons/tiger-vs-lion"), {
        family: "comparisons",
        englishPath: "/comparisons/tiger-vs-lion"
    });
});

test("tier-list bodies are English ranking data, so /id twins consolidate on English", () => {
    const page = read("app/[locale]/(composited)/rankings/[slug]/page.tsx");
    const wrapper = read("app/[locale]/(composited)/tier-list/[slug]/page.tsx");

    // Title/description come from rankings.ts, not locale JSON.
    assert.match(page, /title: getRankingSeoTitle\(ranking\)/);
    assert.match(page, /description: ranking\.description/);
    assert.doesNotMatch(wrapper, /locale: "id"/);
    assert.equal(isCollapsedEnglishDetailPath("/tier-list/strongest-animals"), true);
    assert.deepEqual(matchCollapsedIdDetailPath("/id/tier-list/strongest-animals"), {
        family: "tier-list",
        englishPath: "/tier-list/strongest-animals"
    });
});

test("quality detail title and intro are localized, so /id/qualities must stay", () => {
    const page = read("app/[locale]/(composited)/qualities/[slug]/page.tsx");
    const idLocale = read("data/locales/id.json");
    const nextConfig = readFileSync(join(root, "..", "next.config.js"), "utf8");

    assert.match(page, /t\("detailMetaTitle"/);
    assert.match(page, /t\("detailMetaDescription"/);
    assert.match(page, /t\("clusterIntro"\)/);
    assert.match(idLocale, /"detailMetaTitle": "Hewan dan Kualitas \{principle\} \| AnimalDex"/);
    assert.match(idLocale, /"clusterIntro": "Hewan di sini menunjukkan kualitas/);
    assert.match(page, /locale: "id"/);
    assert.doesNotMatch(nextConfig, /source: "\/id\/qualities\/:slug"/);
    assert.equal(matchCollapsedIdDetailPath("/id/qualities/resilience"), null);
    assert.equal(isCollapsedEnglishDetailPath("/qualities/resilience"), false);
});

test("safety gate does not noindex ready power pages or robots-block crawlers", () => {
    const robots = readFileSync(join(root, "..", "src/app/robots.ts"), "utf8");
    assert.doesNotMatch(robots, /Googlebot|Bingbot|Amazonbot|Bytespider|AhrefsBot|GPTBot/);
    assert.doesNotMatch(read("app/[locale]/(composited)/qualities/[slug]/page.tsx"), /robots:\s*\{\s*index:\s*false/);
});
