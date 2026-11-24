import assert from "node:assert/strict";
import test from "node:test";
import {arkCoatOf, coatDraw, coatUnvary, coatVary, drawnColour, hexToLab, isGinger} from "@/ark-scene/pet-coat-colour";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";

// Real coat colours read from aboard pets' capture photos (lane COATS' review sheet, colours only).
const GINGER = ["#cca872", "#d7b28a", "#a47041", "#996631"];
const TABBY_AND_WHITE = "#4c453e";
const GREY_TABBY = "#5f4e4c";
const BLACK = ["#28221c", "#1f2027"];
const WHITE = "#c5c7c8";

test("the read's coat is checked: two #rrggbb colours (second may be null), white clamped 0-1", () => {
    assert.deepEqual(arkCoatOf({base: "#4C453E", second: null, white: 0.16}), {base: "#4c453e", second: null, white: 0.16});
    assert.deepEqual(arkCoatOf({base: "#1e1717", second: "#6c3d27", white: 3}), {base: "#1e1717", second: "#6c3d27", white: 1});
    assert.equal(arkCoatOf({base: "red", white: 0}), null);
    assert.equal(arkCoatOf({miss: "no_subject"}), null);
    assert.equal(arkCoatOf(null), null);
    assert.equal(arkCoatOf([1]), null);
    assert.deepEqual(arkCoatOf({base: "#202020", second: "nope", white: "x"}), {base: "#202020", second: null, white: 0});
});

test("ginger and golden coats keep the kind's own skin; no other coat does", () => {
    for (const hex of GINGER) assert.equal(isGinger(hex), true, hex);
    for (const hex of [TABBY_AND_WHITE, GREY_TABBY, WHITE, ...BLACK, "#2e1d1a", "#6c3d27"]) assert.equal(isGinger(hex), false, hex);
    assert.equal(coatDraw({base: "#a47041", second: null, white: 0.53}).keep, true);
});

test("a red dog with a darker saddle is its own warm coat, not hard patches on the kind's skin; a piebald ginger keeps them", () => {
    assert.equal(coatDraw({base: "#c67453", second: "#623222", white: 0.02}).keep, false);
    assert.equal(coatDraw({base: "#c67453", second: "#623222", white: 0.4}).keep, true);
    assert.equal(coatDraw({base: "#cca872", second: null, white: 0.16}).keep, true);
});

test("a light coat is never drawn lighter than its photo", () => {
    for (const hex of ["#8a806c", "#cdc5bc", "#7b828c", "#af9c78"]) assert.ok(hexToLab(rgbHex(drawnColour(hex)))[0] <= hexToLab(hex)[0] + 0.5, hex);
});

test("a mid-tone is lifted to a mid brown-grey; black and white stay as they are", () => {
    const lifted = hexToLab(rgbHex(drawnColour(TABBY_AND_WHITE)))[0];
    assert.ok(lifted > 38 && lifted < 45, `#4c453e drawn at L ${lifted}`);
    for (const hex of BLACK) assert.ok(Math.abs(hexToLab(rgbHex(drawnColour(hex)))[0] - hexToLab(hex)[0]) < 1.5, hex);
    assert.ok(Math.abs(hexToLab(rgbHex(drawnColour(WHITE)))[0] - hexToLab(WHITE)[0]) < 1, WHITE);
});

test("a near-neutral grey keeps a little warmth and is never mauve or lilac", () => {
    for (const hex of [GREY_TABBY, "#9b8c8b", "#8f7e75", "#7b828c"]) {
        const [, a, b] = hexToLab(rgbHex(drawnColour(hex)));
        const hue = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
        assert.ok(hue > 40 && hue < 75 && Math.hypot(a, b) >= 3 && Math.hypot(a, b) <= 12, `${hex}: hue ${hue}`);
    }
    // A purple-ish grey is turned warm, not left mauve.
    const [, ap, bp] = hexToLab(rgbHex(drawnColour("#5a4d5c")));
    const hp = ((Math.atan2(bp, ap) * 180) / Math.PI + 360) % 360;
    assert.ok(hp > 40 && hp < 75, `#5a4d5c: hue ${hp}`);
});

test("the coat rides in arkVary exactly, a Power's whole turns added after", () => {
    const draw = coatDraw({base: "#1e1717", second: "#6c3d27", white: 0.32});
    const [x, y, z] = coatVary(draw);
    assert.ok(z < 0, "a coat says so with a negative z");
    // Float32, as the attribute stores them.
    const f = new Float32Array([x + 3, y, z]);
    const back = coatUnvary(f[0], f[1], f[2])!;
    assert.deepEqual(back.base, draw.base);
    assert.deepEqual(back.second, draw.second);
    assert.equal(back.keep, false);
    assert.ok(Math.abs(back.white - 0.32) < 0.002);
    const ginger = coatVary(coatDraw({base: "#cca872", second: null, white: 0}));
    const g = coatUnvary(ginger[0] + 1, ginger[1], ginger[2])!;
    assert.equal(g.keep, true);
    assert.equal(g.white, 0);
    assert.deepEqual(g.second, g.base, "no second colour: patches the base's own");
    assert.equal(coatUnvary(0.1, 1, 1), null, "a plain animal's variation is not a coat");
});

test("the snapshot carries a coat only when the server sent a good one", () => {
    const raw = structuredClone(fixtureV2) as {animals: Array<Record<string, unknown>>};
    raw.animals[0].coat = {base: "#4c453e", second: null, white: 0.16};
    raw.animals[1].coat = {miss: "gated", v: 1};
    const snapshot = decodeArkSnapshot(raw)!;
    const first = snapshot.animals.find((a) => a.id === raw.animals[0].id)!;
    const second = snapshot.animals.find((a) => a.id === raw.animals[1].id)!;
    assert.deepEqual(first.coat, {base: "#4c453e", second: null, white: 0.16});
    assert.equal("coat" in second, false);
});

function rgbHex([r, g, b]: [number, number, number]) {
    return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
