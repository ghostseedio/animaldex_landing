import assert from "node:assert/strict";
import test from "node:test";
import {resolveNativeRangePresentation, withReadableRangeText} from "@/data/native-range";
import {getSnapshotSpeciesBySlug, listSnapshotAnimalSlugs} from "@/lib/published-seo-page-data";
import type {SpeciesEntry} from "@/data/species";
import animalSnapshot from "@/data/published-seo-animal-pages.json";

function mapShape(entry: SpeciesEntry) {
    const presentation = resolveNativeRangePresentation(entry);
    if (presentation.kind !== "mapped") return presentation.kind;
    const {habitatText: _prose, ...shape} = presentation.descriptor;
    return shape;
}

const KEYED = "Native range keys: north_america, sub_saharan_africa. Still or slow-moving fresh water: ponds and swamps.";

test("the catalog's range-keys line moves off the reader-facing text", () => {
    const analysis = withReadableRangeText({
        summary: "",
        scientificName: "",
        category: "",
        identification: [],
        habitat: KEYED,
        nativeRange: KEYED,
        rarityScore: 0,
        rarityReason: ""
    });

    assert.equal(analysis.habitat, "Still or slow-moving fresh water: ponds and swamps.");
    assert.equal(analysis.nativeRange, "North America, Sub-Saharan Africa");
    assert.deepEqual(analysis.nativeRangeKeys, ["north_america", "sub_saharan_africa"]);
});

test("a habitat that was only keys becomes region names", () => {
    const analysis = withReadableRangeText({
        summary: "", scientificName: "", category: "", identification: [],
        habitat: "Native range keys: europe.", nativeRange: "Native range keys: europe.",
        rarityScore: 0, rarityReason: ""
    });

    assert.equal(analysis.habitat, "Europe");
    assert.equal(analysis.nativeRange, "Europe");
});

test("no published animal page shows raw range keys, and every map is unchanged", () => {
    const raw = new Map((animalSnapshot.entries as unknown as SpeciesEntry[]).map((entry) => [entry.slug, entry]));
    let keyed = 0;
    for (const slug of listSnapshotAnimalSlugs()) {
        const entry = getSnapshotSpeciesBySlug(slug) as SpeciesEntry;
        assert.doesNotMatch(entry.analysis.habitat, /native range keys/i, slug);
        assert.doesNotMatch(entry.analysis.nativeRange, /native range keys/i, slug);
        if (entry.analysis.nativeRangeKeys?.length) {
            keyed += 1;
            // Same regions and tier as reading the keys out of the raw text; only the prose changes.
            assert.deepEqual(mapShape(entry), mapShape(raw.get(slug)!), slug);
        }
    }
    assert.ok(keyed > 1000, `expected the catalog-keyed pages, saw ${keyed}`);
});
