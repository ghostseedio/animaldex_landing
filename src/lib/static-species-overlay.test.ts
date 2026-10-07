import assert from "node:assert/strict";
import test from "node:test";
import {speciesEntries} from "@/data/species";
import {applyStaticSpeciesOverlay, getPublishedSpeciesForContent, getStaticSpeciesOverlay} from "@/lib/static-species-overlay";
import {speciesHasSubstantiveFieldGuide} from "@/lib/species-field-guide";

const TEMPLATE_MARKERS = [
    "adjusts movement and feeding to match light",
    "Regional relatives may look similar at a distance",
    "is a useful example of how anatomy and habitat fit together"
];

function rendersTemplateCopy(entry: ReturnType<typeof applyStaticSpeciesOverlay>) {
    const text = [
        ...entry.premiumDetails.behaviorTraits,
        ...entry.premiumDetails.whyInteresting,
        ...entry.premiumDetails.lookalikes
    ].join(" ");
    return TEMPLATE_MARKERS.some((marker) => text.includes(marker));
}

function indexable(entry: ReturnType<typeof applyStaticSpeciesOverlay>) {
    return speciesHasSubstantiveFieldGuide({
        name: entry.name,
        summary: entry.analysis.summary,
        habitat: entry.analysis.habitat,
        nativeRange: entry.analysis.nativeRange,
        identification: entry.analysis.identification,
        behaviorTraits: entry.premiumDetails.behaviorTraits,
        interestingFacts: entry.premiumDetails.whyInteresting,
        diet: entry.databaseSource?.fieldGuide.dietSummary ?? null,
        predators: entry.databaseSource?.fieldGuide.predatorsSummary ?? null,
        sleepPattern: entry.databaseSource?.fieldGuide.sleepPattern ?? null,
        lifespan: entry.databaseSource?.fieldGuide.lifespanEstimate ?? null
    });
}

test("template species pages take the DB field guide instead of generated copy", () => {
    const tayra = speciesEntries.find((entry) => entry.slug === "tayra");
    assert.ok(tayra);
    assert.equal(tayra.contentSource, "template");
    assert.ok(getStaticSpeciesOverlay("tayra"), "the overlay snapshot carries tayra");

    const merged = applyStaticSpeciesOverlay(tayra);
    assert.match(merged.analysis.summary, /weasel family/);
    assert.ok(merged.databaseSource?.fieldGuide.dietSummary);
    assert.ok(merged.databaseSource?.canonicalGameStats);
    assert.equal(rendersTemplateCopy(merged), false);
});

test("no hand-coded species page renders the generated premium-details template", () => {
    const offenders = speciesEntries
        .map((entry) => applyStaticSpeciesOverlay(entry))
        .filter((entry) => entry.contentSource === "template" && rendersTemplateCopy(entry))
        .map((entry) => entry.slug);
    assert.deepEqual(offenders, []);
});

test("the overlay never drops a hand-coded species page out of the index", () => {
    const lost = speciesEntries
        .filter((entry) => indexable(entry) && !indexable(applyStaticSpeciesOverlay(entry)))
        .map((entry) => entry.slug);
    assert.deepEqual(lost, []);
});

test("authored species keep their hand-written copy and only gain DB data", () => {
    const authored = speciesEntries.find((entry) => entry.contentSource === "authored" && getStaticSpeciesOverlay(entry.slug));
    assert.ok(authored);
    const merged = applyStaticSpeciesOverlay(authored);
    assert.equal(merged.analysis.summary, authored.analysis.summary);
    assert.deepEqual(merged.premiumDetails, authored.premiumDetails);
    assert.ok(merged.databaseSource);
});

test("content pages can quote any published animal without a network call", () => {
    assert.ok(getPublishedSpeciesForContent("tayra")?.databaseSource);
    assert.ok(getPublishedSpeciesForContent("globular-springtail"));
    assert.equal(getPublishedSpeciesForContent("definitely-not-a-species"), null);
});
