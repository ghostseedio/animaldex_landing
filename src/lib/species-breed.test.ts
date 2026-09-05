import test from "node:test";
import assert from "node:assert/strict";
import {buildSpeciesCaptureMatchCandidates, primarySpeciesCaptureMatchCandidate} from "./species-breed";
import type {SpeciesEntry} from "../data/species";

function fakeEntry(overrides: Partial<SpeciesEntry> = {}): SpeciesEntry {
    return {
        slug: "amazonian-manatee",
        name: "Amazonian Manatee",
        speciesProfileId: "profile-1",
        normalizedIdentityKey: "amazonian_manatee",
        heroTitle: "Amazonian Manatee",
        publishedAt: "2026-01-01",
        updatedAt: "2026-01-01",
        featuredImage: {src: "/x", alt: "x", width: 1, height: 1},
        searchIntents: [],
        analysis: {
            summary: "summary",
            scientificName: "Trichechus inunguis",
            category: "Mammal",
            identification: [],
            habitat: "river",
            nativeRange: "Amazon",
            rarityScore: 10,
            rarityReason: "reason"
        },
        premiumDetails: {behaviorTraits: [], whyInteresting: [], respectfulSpotting: [], lookalikes: []},
        relatedSpecies: [],
        ...overrides
    };
}

test("species image/ranking match candidates stay bounded", () => {
    const entry = fakeEntry();
    const candidates = buildSpeciesCaptureMatchCandidates(entry);
    const primary = primarySpeciesCaptureMatchCandidate(entry);
    assert.ok(candidates.length <= 4);
    assert.equal(candidates[0]?.column, "species_profile_id");
    assert.deepEqual(primary, {column: "species_profile_id", value: "profile-1"});
});
