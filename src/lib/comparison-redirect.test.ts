import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {publishedStaticComparisonRedirectSlug} from "@/lib/comparison-redirect";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("lion-vs-tiger redirects to the published tiger-vs-lion editorial slug with no I/O", () => {
    assert.equal(publishedStaticComparisonRedirectSlug("lion-vs-tiger"), "tiger-vs-lion");
    assert.equal(publishedStaticComparisonRedirectSlug("LION-VS-TIGER"), "tiger-vs-lion");
    assert.equal(publishedStaticComparisonRedirectSlug("tiger-vs-lion"), null);
});

test("unpublished and invalid comparison slugs do not use the static redirect table", () => {
    assert.equal(publishedStaticComparisonRedirectSlug("not-a-real-animal-vs-also-fake"), null);
    assert.equal(publishedStaticComparisonRedirectSlug("lion-vs-lion"), null);
    assert.equal(publishedStaticComparisonRedirectSlug("not-a-pair"), null);
});

test("next.config permanently redirects lion-vs-tiger before the comparison Function", () => {
    const config = readFileSync(join(repoRoot, "next.config.js"), "utf8");
    assert.match(config, /source: "\/comparisons\/lion-vs-tiger"/);
    assert.match(config, /destination: "\/comparisons\/tiger-vs-lion"/);
    assert.match(config, /source: "\/id\/comparisons\/lion-vs-tiger"/);
});
