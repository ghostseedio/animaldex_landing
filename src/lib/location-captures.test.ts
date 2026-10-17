import assert from "node:assert/strict";
import test from "node:test";
import {getLocationCaptureProof, getLocationCaptureProofSlugs} from "@/data/location-captures";
import {legacyLocationCaptureAreas} from "@/data/location-capture-areas";
import {locationPages} from "@/data/locations";
import {getSpeciesBySlug} from "@/data/species";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";

test("every capture-proof snapshot entry belongs to a live location page", () => {
    const slugs = new Set(locationPages.map((page) => page.slug));
    const orphans = getLocationCaptureProofSlugs().filter((slug) => !slugs.has(slug));
    assert.deepEqual(orphans, [], "re-run scripts/refreshLocationCaptures.mts after renaming a location");
});

test("capture proof only shows published, non-human species with coarse coordinates", () => {
    const problems: string[] = [];
    for (const slug of getLocationCaptureProofSlugs()) {
        const proof = getLocationCaptureProof(slug);
        if (!proof) continue;
        for (const species of proof.species) {
            if (species.slug === "human") problems.push(`${slug}: human in species list`);
            if (!getSpeciesBySlug(species.slug) && !isPublishedAnimalSlug(species.slug)) problems.push(`${slug}: unpublished species ${species.slug}`);
        }
        const featuredSpecies = new Set<string>();
        for (const capture of proof.featured) {
            if (featuredSpecies.has(capture.speciesSlug)) problems.push(`${slug}: ${capture.speciesSlug} featured twice`);
            featuredSpecies.add(capture.speciesSlug);
            if (Number(capture.lat.toFixed(2)) !== capture.lat || Number(capture.lng.toFixed(2)) !== capture.lng) {
                problems.push(`${slug}: ${capture.captureId} coordinates are not rounded`);
            }
            if (/^near /i.test(capture.area)) problems.push(`${slug}: raw POI label leaked: ${capture.area}`);
        }
        if (proof.featured.length > 12) problems.push(`${slug}: too many featured captures`);
    }
    assert.deepEqual(problems, []);
});

test("every location page has a capture area so field proof can attach", () => {
    const missing = locationPages
        .filter((page) => !page.captureArea && !legacyLocationCaptureAreas[page.slug])
        .map((page) => page.slug);
    assert.deepEqual(missing, []);
});

test("every location page has a map centre", () => {
    const {getLocationCoordinate} = require("@/data/location-coordinates") as typeof import("@/data/location-coordinates");
    const missing = locationPages.filter((page) => !getLocationCoordinate(page.slug)).map((page) => page.slug);
    assert.deepEqual(missing, []);
});
