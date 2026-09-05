import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {serializeSitemapXml, uniqueSitemapEntries} from "@/lib/sitemap-xml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("uniqueSitemapEntries keeps the first lastmod for a duplicated loc", () => {
    const unique = uniqueSitemapEntries([
        {url: "https://animaldex.app/wildlife-experiences", lastModified: new Date("2026-08-01")},
        {url: "https://animaldex.app/wildlife-experiences"},
        {url: "https://animaldex.app/id/wildlife-experiences"}
    ]);

    assert.equal(unique.length, 2);
    assert.equal(unique[0]?.url, "https://animaldex.app/wildlife-experiences");
    assert.ok(unique[0]?.lastModified);
    assert.equal(unique[1]?.url, "https://animaldex.app/id/wildlife-experiences");
});

test("serializeSitemapXml escapes loc values", () => {
    const xml = serializeSitemapXml([
        {url: "https://animaldex.app/animals?q=bird&tier=S"}
    ]);

    assert.match(xml, /<loc>https:\/\/animaldex\.app\/animals\?q=bird&amp;tier=S<\/loc>/);
    assert.doesNotMatch(xml, /q=bird&tier/);
});

test("sitemap indexes the Indonesian homepage and localized powers, not English /id copies", () => {
    const source = readFileSync(join(repoRoot, "src/lib/build-sitemap.ts"), "utf8");
    const idBranch = source.slice(
        source.indexOf("if (locale !== localeConfig.defaultLocale)"),
        source.indexOf("const staticEntries")
    );

    assert.match(idBranch, /getAbsoluteUrl\(locale\)/);
    assert.match(idBranch, /getAbsoluteUrl\(locale, "\/powers"\)/);
    assert.match(idBranch, /getLocalPrincipleSlugs/);
    assert.doesNotMatch(idBranch, /\/comparisons\//);
    assert.doesNotMatch(idBranch, /\/animals\//);
    assert.doesNotMatch(idBranch, /\/animal-lessons\//);
    assert.match(source, /published-seo-comparison-pages/);
    assert.doesNotMatch(source, /listMergedChallengeSitemapEntries/);
});
