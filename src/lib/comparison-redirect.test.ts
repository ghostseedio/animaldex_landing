import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
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

test("next.config permanently redirects every reversed published pair before the comparison Function", async () => {
    const config = readFileSync(join(repoRoot, "next.config.js"), "utf8");
    assert.match(config, /reversedComparisonRedirects\(\)/);

    const nextConfig = createRequire(import.meta.url)(join(repoRoot, "next.config.js"));
    const redirects: Array<{source: string; destination: string; permanent?: boolean}> = await nextConfig.redirects();
    const bySource = new Map(redirects.map((entry) => [entry.source, entry]));

    for (const source of ["/comparisons/lion-vs-tiger", "/id/comparisons/lion-vs-tiger", "/comparisons/cheetah-vs-leopard"]) {
        const entry = bySource.get(source);
        assert.ok(entry, `${source} is redirected`);
        assert.equal(entry.permanent, true);
    }
    assert.equal(bySource.get("/comparisons/lion-vs-tiger")?.destination, "/comparisons/tiger-vs-lion");
    assert.equal(bySource.get("/comparisons/cheetah-vs-leopard")?.destination, "/comparisons/leopard-vs-cheetah");
    // Pairs published in both orders are two real pages, never a redirect.
    assert.equal(bySource.has("/comparisons/jaguar-vs-green-anaconda"), false);
    assert.equal(bySource.has("/comparisons/green-anaconda-vs-jaguar"), false);
});
