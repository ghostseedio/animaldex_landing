import assert from "node:assert/strict";
import test from "node:test";

import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import {resolveClosedSeoNamespacePath} from "@/lib/closed-seo-namespaces";
import {
    buildAnimalFusionSlug,
    getFusableSpecies,
    parseAnimalFusionSlug,
    publishedAnimalFusions,
    searchFusableSpecies
} from "@/data/animal-fusions";

const publishedAnimals = new Set<string>(publishedSeoSlugs.animals);

test("fusion slugs round-trip and reject malformed pairs", () => {
    const slug = buildAnimalFusionSlug("domestic-cat", "eurasian-tree-sparrow");
    assert.equal(slug, "domestic-cat-learns-from-eurasian-tree-sparrow");
    assert.deepEqual(parseAnimalFusionSlug(slug), {receiverSlug: "domestic-cat", donorSlug: "eurasian-tree-sparrow"});
    assert.equal(parseAnimalFusionSlug("domestic-cat"), null);
    assert.equal(parseAnimalFusionSlug("lion-learns-from-lion"), null);
    assert.equal(parseAnimalFusionSlug("a-learns-from-b-learns-from-c"), null);
});

test("every published fusion joins two fusable, published animals", () => {
    for (const fusion of publishedAnimalFusions) {
        assert.equal(fusion.slug, buildAnimalFusionSlug(fusion.receiverSlug, fusion.donorSlug));
        for (const slug of [fusion.receiverSlug, fusion.donorSlug]) {
            assert.ok(getFusableSpecies(slug), `${fusion.slug}: ${slug} is not fusable`);
            assert.ok(publishedAnimals.has(slug), `${fusion.slug}: /animals/${slug} is not published`);
        }
        assert.ok(fusion.name.split(/\s+/).length <= 3, `${fusion.slug}: name over 3 words`);
    }
});

test("fusable species search ranks name prefixes first", () => {
    const results = searchFusableSpecies("red fox");
    assert.equal(results[0]?.slug, "red-fox");
    assert.deepEqual(searchFusableSpecies("   "), []);
});

test("published fusions share the hybrid namespace; unpublished pairs stay closed", () => {
    assert.ok(publishedAnimalFusions.length > 0);
    for (const fusion of publishedAnimalFusions) {
        assert.equal(resolveClosedSeoNamespacePath(`/animal-hybrids/${fusion.slug}`)?.action, "allow", fusion.slug);
    }
    assert.equal(resolveClosedSeoNamespacePath("/animal-hybrids/zebra-rhino-hybrid")?.action, "allow");
    // Fused after the snapshot, or never fused: the Fuse tool shows these, not a page.
    assert.equal(resolveClosedSeoNamespacePath("/animal-hybrids/lion-learns-from-red-fox")?.action, "block");
});
