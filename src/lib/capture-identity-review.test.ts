import assert from "node:assert/strict";
import test from "node:test";
import {findReviewCandidates, isBroadLabel, namesAreRelated, shouldQueue, type CaptureForReview} from "@/lib/capture-identity-review";

const at = (seconds: number) => Date.parse("2026-09-12T02:00:00Z") + seconds * 1000;
const capture = (id: string, seconds: number, name: string, scientificName: string | null, confidence: number | null, species = id, userId = "u1"): CaptureForReview => ({
    id, userId, takenAt: at(seconds), latitude: 14.3, longitude: 120.84, speciesProfileId: species, name, scientificName, confidence
});

test("name and label signals", () => {
    assert.equal(namesAreRelated("Fly", "House Fly"), true);
    assert.equal(namesAreRelated("Broad-nosed Weevil", "Pachyrhynchus Weevil"), true);
    assert.equal(namesAreRelated("Brahminy Kite", "Smooth-coated Otter"), false);
    assert.equal(isBroadLabel("Mantodea"), true);
    assert.equal(isBroadLabel("Parmarion martensi"), false);
});

test("low confidence alone only counts inside one burst", () => {
    assert.equal(shouldQueue(["low_confidence"], 20), true);
    assert.equal(shouldQueue(["low_confidence"], 90), false);
    assert.equal(shouldQueue(["related_names"], 170), true);
});

test("the semi-slug filed as a mantis egg case is queued; a kite then an otter is not", () => {
    const pairs = findReviewCandidates([
        capture("slug", 0, "Semi-slug", "Parmarion martensi", 0.5),
        capture("ootheca", 27, "Mantis Ootheca", "Mantodea", 0.88),
        capture("kite", 400, "Brahminy Kite", "Haliastur indus", 0.9),
        capture("otter", 430, "Smooth-coated Otter", "Lutrogale perspicillata", 0.9)
    ]);
    assert.deepEqual(pairs.map((pair) => [pair.captureA.id, pair.captureB.id]), [["slug", "ootheca"]]);
    assert.ok(pairs[0].signals.includes("broad_label"));
});

test("same species, other owners, or far apart in time or place are never paired", () => {
    const far = {...capture("b", 10, "House Fly", "Musca domestica", 0.5), latitude: 15.3};
    const pairs = findReviewCandidates([
        capture("a", 0, "Fly", "Diptera", 0.5),
        far,
        capture("c", 5, "Fly", "Diptera", 0.5, "a"),
        capture("d", 8, "House Fly", "Musca domestica", 0.5, "d", "u2"),
        capture("e", 600, "House Fly", "Musca domestica", 0.5)
    ]);
    assert.equal(pairs.length, 0);
});
