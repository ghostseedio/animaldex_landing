import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {isSitemapSection, partitionSitemap, serializeSitemapIndexXml, SITEMAP_SECTIONS, sitemapSectionOf} from "@/lib/sitemap-sections";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("every URL lands in one section by its path", () => {
    const cases: Array<[string, string]> = [
        ["https://animaldex.app/", "pages"],
        ["https://animaldex.app/talk", "pages"],
        ["https://animaldex.app/ark", "ark"],
        ["https://animaldex.app/ark/food-chain", "ark"],
        ["https://animaldex.app/about", "ark"],
        ["https://animaldex.app/id/ark", "id"],
        ["https://animaldex.app/id", "id"],
        ["https://animaldex.app/animals/red-fox", "species"],
        ["https://animaldex.app/animals", "pages"],
        ["https://animaldex.app/animal-powers/wolf", "powers"],
        ["https://animaldex.app/qualities/stealth", "powers"],
        ["https://animaldex.app/comparisons/tiger-vs-lion", "comparisons"],
        ["https://animaldex.app/animal-hybrids/x", "hybrids"],
        ["https://animaldex.app/pokemon-animals/pikachu", "hybrids"],
        ["https://animaldex.app/p/capture-1", "captures"],
        ["https://animaldex.app/blog/owl-symbolism", "blog"],
        ["https://animaldex.app/locations/texas", "locations"],
        ["https://animaldex.app/idaho-wildlife", "pages"]
    ];
    for (const [url, section] of cases) assert.equal(sitemapSectionOf(url), section, url);
    const parts = partitionSitemap(cases.map(([url]) => ({url})));
    assert.equal(Object.values(parts).reduce((sum, list) => sum + list.length, 0), cases.length);
    assert.equal(isSitemapSection("species"), true);
    assert.equal(isSitemapSection("../etc"), false);
});

test("the index lists each non-empty section once, with its newest lastmod", () => {
    const parts = partitionSitemap([
        {url: "https://animaldex.app/animals/a", lastModified: "2026-10-01"},
        {url: "https://animaldex.app/animals/b", lastModified: "2026-11-02"},
        {url: "https://animaldex.app/ark"}
    ]);
    const xml = serializeSitemapIndexXml("https://animaldex.app", parts);
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?><sitemapindex xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
    assert.match(xml, /<sitemap><loc>https:\/\/animaldex.app\/sitemaps\/species.xml<\/loc><lastmod>2026-11-02T00:00:00.000Z<\/lastmod><\/sitemap>/);
    assert.match(xml, /<sitemap><loc>https:\/\/animaldex.app\/sitemaps\/ark.xml<\/loc><\/sitemap>/);
    assert.doesNotMatch(xml, /sitemaps\/blog.xml/);
    assert.equal((xml.match(/<sitemap>/g) ?? []).length, 2);
    assert.ok(SITEMAP_SECTIONS.includes("captures"));
});

test("the sitemap lists the Ark's pages in both languages, with lastmod", () => {
    const source = readFileSync(join(repoRoot, "src/lib/build-sitemap.ts"), "utf8");
    const split = source.indexOf("const staticEntries");
    const id = source.slice(source.indexOf("if (locale !== localeConfig.defaultLocale)"), split);
    const en = source.slice(split);
    for (const part of [id, en]) {
        assert.match(part, /getAbsoluteUrl\(locale, "\/ark"\), lastModified: arkLastModified\(\)/);
        assert.match(part, /ARK_HOW_IT_WORKS_PATH/);
        assert.match(part, /ARK_FOOD_CHAIN_PATH/);
        assert.match(part, /ABOUT_PATH/);
    }
    // No private profile is ever listed: /u/ pages are noindex.
    assert.doesNotMatch(source, /\/u\//);
    const route = readFileSync(join(repoRoot, "src/app/sitemap.xml/route.ts"), "utf8");
    assert.match(route, /serializeSitemapIndexXml/);
});
