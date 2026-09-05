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
    assert.match(metadata, /description: challenge\.description/);
    assert.doesNotMatch(metadata, /t\("metaTitle"/);
    assert.match(page, /headline: challenge\.title/);
    assert.match(page, /summary=\{challenge\.quickVerdict\}/);
    assert.match(page, /paragraphs=\{challenge\.shortAnswer\}/);
    assert.match(page, /challenge\.faq\.map/);
    assert.equal(isCollapsedEnglishDetailPath("/comparisons/tiger-vs-lion"), true);
    assert.deepEqual(matchCollapsedIdDetailPath("/id/comparisons/tiger-vs-lion"), {
        family: "comparisons",
        englishPath: "/comparisons/tiger-vs-lion"
    });
});

test("power detail title and intro are localized, so /id/powers must stay", () => {
    const page = read("app/[locale]/(composited)/qualities/[slug]/page.tsx");
    const idLocale = read("data/locales/id.json");
    const nextConfig = readFileSync(join(root, "..", "next.config.js"), "utf8");

    assert.match(page, /t\("detailMetaTitle"/);
    assert.match(page, /t\("detailMetaDescription"/);
    assert.match(page, /t\("clusterIntro"\)/);
    assert.match(idLocale, /"detailMetaTitle": "Hewan dan Kekuatan \{principle\} \| AnimalDex"/);
    assert.match(idLocale, /"clusterIntro": "Hewan di sini menunjukkan kekuatan/);
    assert.match(page, /locale: "id"/);
    assert.doesNotMatch(nextConfig, /source: "\/id\/powers\/:slug"/);
    assert.equal(matchCollapsedIdDetailPath("/id/powers/resilience"), null);
    assert.equal(isCollapsedEnglishDetailPath("/powers/resilience"), false);
});

test("safety gate does not noindex ready power pages or robots-block crawlers", () => {
    const robots = readFileSync(join(root, "..", "src/app/robots.ts"), "utf8");
    assert.doesNotMatch(robots, /Googlebot|Bingbot|Amazonbot|Bytespider|AhrefsBot|GPTBot/);
    assert.doesNotMatch(read("app/[locale]/(composited)/qualities/[slug]/page.tsx"), /robots:\s*\{\s*index:\s*false/);
});
