import assert from "node:assert/strict";
import {test} from "node:test";
import {ANTLER_NONE, antlerOf, antlerState, antlerUniform, foldAntler, packAntler} from "@/ark-scene/antler-cycle";
import {LOOK_ALBEDO, LOOK_VERTEX, LOOK_VERTEX_DECLARATIONS} from "@/ark-scene/animal-look-shader";
import {packYoung} from "@/ark-scene/young-coat";

test("the antler cycle is only for the deer whose own row tells it", () => {
    for (const slug of ["eurasian-elk", "reindeer", "red-deer", "chital"]) assert.ok(antlerOf(slug), slug);
    for (const slug of ["fallow-deer", "white-tailed-deer", "javan-rusa-deer", "african-lion", null]) assert.equal(antlerOf(slug), null);
    assert.deepEqual(antlerUniform("african-lion").slice(3), [0]);
});

test("an elk bull's grow in velvet each summer and are gone from early winter; a cow has none", () => {
    const elk = antlerOf("eurasian-elk")!;
    const at = (m: number, sex: "male" | "female" = "male") => antlerState(elk, m, sex, "e1");
    assert.equal(at(6).phase, "velvet");
    assert.ok(at(6).code < at(8).code, "they grow over the summer");
    assert.equal(at(8).say, true);
    assert.equal(at(10).phase, "hard");
    for (const m of [12, 1, 2, 3, 4, 5]) assert.equal(at(m).code, ANTLER_NONE);
    for (let m = 1; m <= 12; m++) assert.equal(at(m, "female").phase, "bare");
});

test("reindeer: the males' are gone in winter while the females keep theirs (her sentence then)", () => {
    const r = antlerOf("reindeer")!;
    assert.equal(antlerState(r, 1, "male", "a").phase, "bare");
    const her = antlerState(r, 1, "female", "b");
    assert.equal(her.phase, "hard");
    assert.equal(her.say, true);
    assert.equal(antlerState(r, 7, "female", "b").say, false);
    assert.equal(antlerState(r, 7, "male", "a").phase, "hard");
});

test("red deer are in velvet the three months before their stored rut, hard in it", () => {
    const r = antlerOf("red-deer")!;
    assert.deepEqual(r.velvet, [6, 7, 8]);
    assert.equal(antlerState(r, 7, "male", "s").phase, "velvet");
    assert.equal(antlerState(r, 10, "male", "s").phase, "hard");
});

test("chital stags are each on their own year, so some are in hard antler every month", () => {
    const c = antlerOf("chital")!;
    const stags = Array.from({length: 24}, (_, k) => `stag-${k}`);
    for (let m = 1; m <= 12; m++) assert.ok(stags.some((id) => antlerState(c, m, "male", id).phase === "hard"), `month ${m}`);
    const phases = new Set(stags.map((id) => antlerState(c, 3, "male", id).phase));
    assert.ok(phases.size >= 2, "not in step");
    assert.deepEqual(antlerState(c, 3, "male", "stag-1"), antlerState(c, 3, "male", "stag-1"));
    assert.equal(antlerState(c, 3, "female", "hind").phase, "bare");
});

test("the code rides above the dust and the young coat, and the fold shrinks to the skull", () => {
    const y = packAntler(packYoung(0.4, 9), 15);
    assert.equal(Math.floor(y / 32), 15);
    assert.equal(Math.floor(y * 0.5) % 16, 9);
    assert.ok(Math.abs(y - 2 * Math.floor(y * 0.5) - 0.4) < 1e-9);
    assert.equal(packAntler(y, 3), y - 32 * 12);
    const cut: [number, number, number] = [0.3, -0.05, 0.32];
    assert.deepEqual(foldAntler([0.1, 0.5, 0.2], cut, 15), [0, 0.3, 0.32]);
    assert.deepEqual(foldAntler([0.1, 0.2, 0.2], cut, 15), [0.1, 0.2, 0.2]);
    assert.deepEqual(foldAntler([0.1, 0.5, 0.2], cut, 0), [0.1, 0.5, 0.2]);
    const grown = foldAntler([0.1, 0.5, 0.2], cut, 14);
    assert.ok(Math.abs(grown[1] - 0.5) < 1e-9);
    assert.match(LOOK_VERTEX_DECLARATIONS, /uniform vec4 arkAntler;/);
    assert.match(LOOK_VERTEX, /arkCoat\.y \/ 32\.0/);
    assert.match(LOOK_ALBEDO, /mod\(arkYoungAll, 16\.0\)/);
});
