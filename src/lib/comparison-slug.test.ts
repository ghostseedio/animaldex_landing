import assert from "node:assert/strict";
import test from "node:test";
import {
    buildComparisonSlug,
    canonicalUnpublishedComparisonSlug,
    parseComparisonSlug,
    reversedComparisonSlug
} from "@/lib/comparison-slug";

test("buildComparisonSlug keeps typed suffixes off the battle form", () => {
    assert.equal(buildComparisonSlug("lion", "tiger"), "lion-vs-tiger");
    assert.equal(buildComparisonSlug("lion", "tiger", "speed"), "lion-vs-tiger-speed");
});

test("reversedComparisonSlug swaps pair order and preserves comparison type", () => {
    assert.equal(reversedComparisonSlug("lion-vs-tiger"), "tiger-vs-lion");
    assert.equal(reversedComparisonSlug("tiger-vs-cheetah-speed"), "cheetah-vs-tiger-speed");
    assert.equal(reversedComparisonSlug("not-a-pair"), null);
});

test("canonicalUnpublishedComparisonSlug picks a deterministic alphabetical pair", () => {
    assert.equal(canonicalUnpublishedComparisonSlug("tiger-vs-lion"), "lion-vs-tiger");
    assert.equal(canonicalUnpublishedComparisonSlug("lion-vs-tiger"), "lion-vs-tiger");
    assert.equal(
        canonicalUnpublishedComparisonSlug("cheetah-vs-tiger-speed"),
        "cheetah-vs-tiger-speed"
    );
    assert.equal(
        canonicalUnpublishedComparisonSlug("tiger-vs-cheetah-speed"),
        "cheetah-vs-tiger-speed"
    );
});

test("parseComparisonSlug round-trips canonical unpublished slugs", () => {
    const slug = canonicalUnpublishedComparisonSlug("orangutan-vs-chimpanzee-intelligence");
    assert.equal(slug, "chimpanzee-vs-orangutan-intelligence");
    assert.deepEqual(parseComparisonSlug(slug || ""), {
        animalASlug: "chimpanzee",
        animalBSlug: "orangutan",
        comparisonType: "intelligence"
    });
});
