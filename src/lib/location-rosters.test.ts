import assert from "node:assert/strict";
import test from "node:test";
import {locationPages} from "@/data/locations";
import {getSpeciesBySlug} from "@/data/species";
import {getPublishedSpeciesForContent} from "@/lib/static-species-overlay";

test("every location roster animal resolves to a published species page", () => {
    const stale = locationPages.flatMap((location) => location.animalsToSpot
        .filter((animal) => !getSpeciesBySlug(animal.speciesSlug) && !getPublishedSpeciesForContent(animal.speciesSlug))
        .map((animal) => `${location.slug}: ${animal.speciesSlug}`));
    assert.deepEqual(stale, [], "rename or drop these roster slugs in src/data/locations.ts");
});
