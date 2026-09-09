import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {SpeciesEntry} from "@/data/species";
import {
    collectionAliasTokensForCanonical,
    getMergedIdentityAliases,
    resolveCollectionIdentityToken,
    setRuntimeSpeciesIdentityAliases
} from "@/lib/collection-identity-aliases";
import {
    dedupeCatalogSpeciesEntries,
    filterCanonicalCatalogSpeciesEntries
} from "@/lib/catalog-species-dedupe";
import {
    isNonCanonicalLifeStageCatalogIdentity,
    resolveCanonicalSlugFromIdentity,
    resolveCaptureVariantDisplay,
    shouldNoindexLifeStageAliasSlug,
    speciesDirectoryMatchesQuery,
    speciesDirectorySearchMatch
} from "@/lib/species-life-stage-policy";

function makeEntry(overrides: Partial<SpeciesEntry> & Pick<SpeciesEntry, "slug" | "name">): SpeciesEntry {
    return {
        heroTitle: overrides.name,
        publishedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        featuredImage: {src: "/api/species-images/test", alt: overrides.name, width: 1, height: 1},
        searchIntents: [overrides.name],
        analysis: {
            summary: "Test species",
            scientificName: "Species testicus",
            category: "Animal",
            identification: [],
            habitat: "Test habitat",
            nativeRange: "Test range",
            rarityScore: 50,
            rarityReason: "Test"
        },
        premiumDetails: {
            behaviorTraits: [],
            whyInteresting: [],
            respectfulSpotting: [],
            lookalikes: []
        },
        relatedSpecies: [],
        ...overrides
    };
}

describe("canonical life-stage catalog policy", () => {
    it("excludes life-stage duplicate profiles from the catalog", () => {
        const entries = [
            makeEntry({slug: "monarch-butterfly", name: "Monarch Butterfly", normalizedIdentityKey: "monarch_butterfly"}),
            makeEntry({slug: "monarch-caterpillar", name: "Monarch Caterpillar", normalizedIdentityKey: "monarch_caterpillar"}),
            makeEntry({slug: "kea", name: "Kea", normalizedIdentityKey: "kea"}),
            makeEntry({slug: "kea-juvenile", name: "Kea Juvenile", normalizedIdentityKey: "kea_juvenile"})
        ];

        const filtered = filterCanonicalCatalogSpeciesEntries(entries);
        const deduped = dedupeCatalogSpeciesEntries(entries);

        assert.equal(filtered.some((entry) => entry.slug === "monarch-caterpillar"), false);
        assert.equal(filtered.some((entry) => entry.slug === "kea-juvenile"), false);
        assert.equal(deduped.some((entry) => entry.slug === "monarch-butterfly"), true);
        assert.equal(deduped.some((entry) => entry.slug === "kea"), true);
    });

    it("keeps Tadpole Shrimp canonical despite the tadpole word", () => {
        assert.equal(isNonCanonicalLifeStageCatalogIdentity("tadpole_shrimp"), false);
        assert.equal(
            filterCanonicalCatalogSpeciesEntries([
                makeEntry({slug: "tadpole-shrimp", name: "Tadpole Shrimp", normalizedIdentityKey: "tadpole_shrimp"})
            ]).length,
            1
        );
    });

    it("keeps canonical selection unchanged when canonical and alias rows coexist", () => {
        const deduped = dedupeCatalogSpeciesEntries([
            makeEntry({slug: "african-lion", name: "African Lion", normalizedIdentityKey: "african_lion"}),
            makeEntry({slug: "lion", name: "Lion", normalizedIdentityKey: "lion"})
        ]);

        assert.deepEqual(deduped.map((entry) => entry.slug), ["lion"]);
    });
});

describe("collection identity alias indexes", () => {
    it("preserves canonical, alias, and one-hop chained resolution semantics", () => {
        assert.equal(resolveCollectionIdentityToken("lion"), "lion");
        assert.equal(resolveCollectionIdentityToken("African-Lion"), "lion");

        setRuntimeSpeciesIdentityAliases({first_alias: "second_alias", second_alias: "lion"});
        try {
            assert.equal(resolveCollectionIdentityToken("first_alias"), "second_alias");
            assert.equal(resolveCollectionIdentityToken("second_alias"), "lion");
        } finally {
            setRuntimeSpeciesIdentityAliases(null);
        }
    });

    it("returns the same ordered aliases as filtering the merged table", () => {
        const expected = Object.entries(getMergedIdentityAliases())
            .filter(([, canonical]) => canonical === "lion")
            .map(([alias]) => alias);

        assert.deepEqual(collectionAliasTokensForCanonical("lion"), expected);
    });

    it("reuses merged alias data across lookups and rebuilds it only on runtime updates", () => {
        const before = getMergedIdentityAliases();
        resolveCollectionIdentityToken("african_lion");
        collectionAliasTokensForCanonical("lion");
        assert.equal(getMergedIdentityAliases(), before);

        setRuntimeSpeciesIdentityAliases({test_lion_alias: "lion"});
        try {
            const updated = getMergedIdentityAliases();
            assert.notEqual(updated, before);
            assert.equal(getMergedIdentityAliases(), updated);
            const aliases = collectionAliasTokensForCanonical("lion");
            assert.equal(aliases[aliases.length - 1], "test_lion_alias");
        } finally {
            setRuntimeSpeciesIdentityAliases(null);
        }
    });
});

describe("capture variant display", () => {
    it('shows "Monarch Caterpillar" with a counts-as line for Monarch Butterfly', () => {
        const display = resolveCaptureVariantDisplay({
            animalName: "Monarch Caterpillar",
            lifeStage: "caterpillar",
            normalizedIdentityKey: "monarch_caterpillar",
            canonicalSpecies: {name: "Monarch Butterfly", slug: "monarch-butterfly"}
        });

        assert.equal(display.title, "Monarch Caterpillar");
        assert.equal(display.countsAsLine, "Counts as Monarch Butterfly");
        assert.equal(display.lifeStageChip, "Caterpillar");
    });

    it("does not show a counts-as line for adult captures", () => {
        const display = resolveCaptureVariantDisplay({
            animalName: "Monarch Butterfly",
            normalizedIdentityKey: "monarch_butterfly",
            canonicalSpecies: {name: "Monarch Butterfly", slug: "monarch-butterfly"}
        });

        assert.equal(display.isStageVariant, false);
        assert.equal(display.countsAsLine, null);
    });
});

describe("species directory search", () => {
    const monarch = makeEntry({
        slug: "monarch-butterfly",
        name: "Monarch Butterfly",
        normalizedIdentityKey: "monarch_butterfly"
    });

    it("matches Monarch Caterpillar queries to Monarch Butterfly", () => {
        assert.equal(speciesDirectoryMatchesQuery(monarch, "monarch caterpillar"), true);

        const match = speciesDirectorySearchMatch(monarch, "monarch caterpillar");
        assert.ok(match);
        assert.equal(match?.mainLabel, "Monarch Butterfly");
        assert.equal(match?.aliasMatchLabel, "Alias match: Monarch Caterpillar");
        assert.equal(match?.helperText, "Caterpillar captures count here");
    });

    it("preserves direct-name search without alias helper text", () => {
        const match = speciesDirectorySearchMatch(monarch, "monarch butterfly");

        assert.ok(match);
        assert.equal(match.aliasMatchLabel, null);
        assert.equal(match.helperText, null);
    });

    it("matches Kea Juvenile queries to Kea", () => {
        const kea = makeEntry({slug: "kea", name: "Kea", normalizedIdentityKey: "kea"});
        assert.equal(speciesDirectoryMatchesQuery(kea, "kea juvenile"), true);
    });

    it("does not enumerate the merged alias table while matching an entry", () => {
        const originalEntries = Object.entries;
        let entriesCalls = 0;
        Object.entries = ((value: object) => {
            entriesCalls += 1;
            return originalEntries(value);
        }) as typeof Object.entries;

        try {
            assert.ok(speciesDirectorySearchMatch(monarch, "monarch caterpillar"));
        } finally {
            Object.entries = originalEntries;
        }

        assert.equal(entriesCalls, 0);
    });
});

describe("routing and SEO", () => {
    it("resolves stage slugs to canonical species URLs", () => {
        assert.equal(resolveCanonicalSlugFromIdentity("monarch_caterpillar"), "monarch-butterfly");
        assert.equal(resolveCanonicalSlugFromIdentity("kea_juvenile"), "kea");
    });

    it("flags stage alias slugs for noindex while keeping canonical slugs indexable", () => {
        assert.equal(shouldNoindexLifeStageAliasSlug("monarch-caterpillar", "monarch-butterfly"), true);
        assert.equal(shouldNoindexLifeStageAliasSlug("monarch-butterfly", "monarch-butterfly"), false);
    });
});

describe("species capture association", () => {
    it("includes monarch caterpillar captures when filtering for monarch butterfly", () => {
        const captures = [
            {
                captureId: "cap-1",
                animalName: "Monarch Caterpillar",
                scientificName: null,
                speciesSlug: "monarch_caterpillar",
                speciesProfileId: "profile-monarch",
                lifeStage: "caterpillar",
                confidence: 0.9,
                score: 10,
                captureValidity: null,
                learnedScenarioTags: [],
                capturedAt: null,
                imageBucket: null,
                imagePath: null,
                contextLabel: null,
                locationDisplayLabel: null
            }
        ];

        const entry = makeEntry({
            slug: "monarch-butterfly",
            name: "Monarch Butterfly",
            normalizedIdentityKey: "monarch_butterfly",
            speciesProfileId: "profile-monarch"
        });

        const identityKeys = new Set(["monarch_butterfly", "monarch_caterpillar"]);
        const matched = captures.filter((capture) => {
            const captureKey = capture.speciesSlug?.toLowerCase() ?? null;
            return Boolean(captureKey && identityKeys.has(captureKey));
        });

        assert.equal(matched.length, 1);
        assert.equal(entry.slug, "monarch-butterfly");
    });
});
