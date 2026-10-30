import assert from "node:assert/strict";
import test from "node:test";
import {powerHistoryDetailLine, powerHistoryHref, sortPowerHistory, trialHistoryHref, type PlayPowerHistoryItem} from "@/lib/power-history";

const CAPTURE = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

function item(overrides: Partial<PlayPowerHistoryItem>): PlayPowerHistoryItem {
    return {
        id: "power-1",
        speciesProfileId: "s1",
        captureId: CAPTURE,
        animalName: "Red Fox",
        imageSrc: null,
        powerName: "Edge Hunting",
        isFused: false,
        route: "Earned in your own life",
        earnedAt: "2026-10-31T09:00:00Z",
        ...overrides
    };
}

test("Powers history is newest first, undated last", () => {
    const sorted = sortPowerHistory([
        item({id: "old", earnedAt: "2026-10-01T09:00:00Z"}),
        item({id: "none", earnedAt: null}),
        item({id: "new", earnedAt: "2026-10-30T09:00:00Z"})
    ]);
    assert.deepEqual(sorted.map((entry) => entry.id), ["new", "old", "none"]);
});

test("a row says the animal, how it was earned and when", () => {
    assert.match(powerHistoryDetailLine(item({})), /^Red Fox · Earned in your own life · /);
    assert.equal(powerHistoryDetailLine(item({route: null, earnedAt: null})), "Red Fox");
});

test("an animal's own Power opens its Bond tab; a fused one its Battle tab (3.2: no Power Loop page)", () => {
    assert.equal(powerHistoryHref(item({})), `/app/capture/${CAPTURE}?tab=bond`);
    assert.equal(powerHistoryHref(item({isFused: true})), `/app/capture/${CAPTURE}?tab=battle`);
    assert.equal(powerHistoryHref(item({captureId: null})), null);
});

test("a Trial history row opens the animal: its record when completed, its chat otherwise", () => {
    const cards = [
        {captureId: "old", speciesProfileId: "S1", capturedAt: "2026-09-01T00:00:00Z"},
        {captureId: "new", speciesProfileId: "s1", capturedAt: "2026-10-01T00:00:00Z"},
        {captureId: "other", speciesProfileId: "s2", capturedAt: "2026-10-30T00:00:00Z"}
    ];
    assert.equal(trialHistoryHref({speciesProfileId: "s1", status: "completed"}, cards), "/app/capture/new?tab=bond");
    assert.equal(trialHistoryHref({speciesProfileId: "s1", status: "expired"}, cards), "/app/capture/new?talk=1");
    assert.equal(trialHistoryHref({speciesProfileId: "s9", status: "completed"}, cards), null);
});
