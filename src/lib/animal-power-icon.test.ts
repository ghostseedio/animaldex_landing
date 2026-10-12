import assert from "node:assert/strict";
import test from "node:test";
import {decodeAnimalPowerIconRows, isAnimalPowerIconId, parseAnimalPowerIcon} from "@/lib/animal-power-icon";

const ROOT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
const FALCON = `${ROOT}<circle cx="5" cy="4" r="2" fill="currentColor" stroke="none"/><path d="M8 4.5c4.5 1 8 5.5 9.4 13"/><path d="M14.4 15.4l3.1 3.4 2.6-3.8"/><path d="M3 21h18"/></svg>`;

test("the stored subset parses into shapes", () => {
    assert.deepEqual(parseAnimalPowerIcon(FALCON), [
        {kind: "circle", cx: 5, cy: 4, r: 2, fill: "currentColor", stroke: "none"},
        {kind: "path", d: "M8 4.5c4.5 1 8 5.5 9.4 13", fill: undefined, stroke: undefined},
        {kind: "path", d: "M14.4 15.4l3.1 3.4 2.6-3.8", fill: undefined, stroke: undefined},
        {kind: "path", d: "M3 21h18", fill: undefined, stroke: undefined}
    ]);
});

test("anything outside the subset is dropped, and nothing left is no icon", () => {
    const hostile = `${ROOT}<script>alert(1)</script><path d="M0 0" onclick="x()"/><path d="url(#x)"/><circle cx="1" cy="1" r="1" fill="red"/><path d="M1 1h2"/></svg>`;
    assert.deepEqual(parseAnimalPowerIcon(hostile), [
        {kind: "path", d: "M0 0", fill: undefined, stroke: undefined},
        {kind: "path", d: "M1 1h2", fill: undefined, stroke: undefined}
    ]);
    assert.equal(parseAnimalPowerIcon(`${ROOT}<rect width="2" height="2"/></svg>`), null);
    assert.equal(parseAnimalPowerIcon("<path d=\"M0 0\"/>"), null);
    assert.equal(parseAnimalPowerIcon(""), null);
    assert.equal(parseAnimalPowerIcon(null), null);
});

test("rows decode by lower-cased species id", () => {
    assert.deepEqual(
        decodeAnimalPowerIconRows([
            {species_profile_id: "D1EE13C5-C5A4-462C-8535-0A97831517AA", svg: FALCON},
            {species_profile_id: "x", svg: null},
            null
        ]),
        {"d1ee13c5-c5a4-462c-8535-0a97831517aa": FALCON}
    );
    assert.equal(isAnimalPowerIconId("d1ee13c5-c5a4-462c-8535-0a97831517aa"), true);
    assert.equal(isAnimalPowerIconId("fused:abc"), false);
    assert.equal(isAnimalPowerIconId(""), false);
});
