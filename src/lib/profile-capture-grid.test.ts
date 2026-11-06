import assert from "node:assert/strict";
import test from "node:test";
import {buildProfileGridItems, formatAnimalDexNumber} from "@/lib/profile-capture-grid";

const capture = (id: string, animalDexNumber: number | null, capturedAt: string, isMovingMedia = false) => ({
    id, animalDexNumber, capturedAt, isMovingMedia, animalName: id, href: `/x/${id}`, imageSrc: `/i/${id}`
});

test("index chip pads to three digits like iOS", () => {
    assert.equal(formatAnimalDexNumber(7), "#007");
    assert.equal(formatAnimalDexNumber(1234), "#1234");
});

test("one cell per index, newest capture represents it, unindexed captures stay separate", () => {
    const captures = [
        capture("a", 12, "2026-10-01T00:00:00Z"),
        capture("b", 12, "2026-10-05T00:00:00Z", true),
        capture("c", null, "2026-10-03T00:00:00Z"),
        capture("d", null, "2026-10-02T00:00:00Z"),
        capture("e", 3, "2026-09-01T00:00:00Z")
    ];

    const recent = buildProfileGridItems(captures, "recent");
    assert.deepEqual(recent.map((item) => item.representative.id), ["b", "c", "d", "e"]);
    assert.equal(recent[0].captureCount, 2);
    assert.equal(recent[0].isMovingMedia, true);

    const byIndex = buildProfileGridItems(captures, "index");
    assert.deepEqual(byIndex.map((item) => item.representative.id), ["e", "b", "c", "d"]);
});

test("a custom grid is the chosen captures, one cell each, in the order they were tapped", () => {
    const captures = [
        capture("a", 12, "2026-10-01T00:00:00Z"),
        capture("b", 12, "2026-10-05T00:00:00Z"),
        capture("c", null, "2026-10-03T00:00:00Z")
    ];
    const custom = buildProfileGridItems(captures, "custom", ["C", "a", "missing", "a"]);
    assert.deepEqual(custom.map((item) => item.representative.id), ["c", "a"]);
    assert.deepEqual(custom.map((item) => item.captureCount), [1, 1]);
    // Nothing chosen yet: an empty grid ("Nothing selected yet.").
    assert.deepEqual(buildProfileGridItems(captures, "custom", []), []);
});

test("star order is newest first on the web until it reads star ratings", () => {
    const captures = [capture("a", 3, "2026-10-01T00:00:00Z"), capture("b", 9, "2026-10-05T00:00:00Z")];
    assert.deepEqual(buildProfileGridItems(captures, "stars").map((item) => item.representative.id), ["b", "a"]);
});
