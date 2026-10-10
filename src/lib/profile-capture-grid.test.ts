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
