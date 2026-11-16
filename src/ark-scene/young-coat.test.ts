import assert from "node:assert/strict";
import {test} from "node:test";
import look from "@/ark-scene/animal-look.json";
import {LOOK_ALBEDO, LOOK_FRAGMENT_DECLARATIONS, LOOK_VERTEX, LOOK_VERTEX_DECLARATIONS} from "@/ark-scene/animal-look-shader";
import table from "@/ark-scene/young-life.json";
import {applyYoungCoat, packYoung, YOUNG_STEPS, youngCoatOf, youngCoatStrength, youngCoatUniforms, youngSteps} from "@/ark-scene/young-coat";

const coats = (table as unknown as {coats: Record<string, {name: string; id: string; quote: string; line: string; base?: number[]; mark?: string; markColour?: number[]; fade?: number[]}>}).coats;

test("every young coat is a model of the Ark with its catalogue row's quote and its own log sentence", () => {
    const slugs = Object.keys(coats);
    assert.ok(slugs.length >= 30, `${slugs.length} species`);
    for (const slug of slugs) {
        const c = coats[slug];
        assert.ok(slug in (look as unknown as {species: Record<string, unknown>}).species, `${slug} is a model`);
        assert.ok(c.quote.length > 10 && /^[0-9a-f-]{36}$/.test(c.id), `${slug} keeps its row`);
        assert.ok(/^\{aAnimal\} |^\{animals\} /.test(c.line), `${slug}: ${c.line}`);
        assert.ok(c.base || c.mark || (c as {dull?: number}).dull, `${slug} draws something`);
        if (c.mark) assert.ok(["bars", "stripes", "spots", "back"].includes(c.mark) && c.markColour?.length === 3);
        if (c.fade) assert.ok(c.fade[0] < c.fade[1]);
    }
    // The ones the owner named: spotted and striped young of mammals, banded hatchlings, juvenile fish colours.
    for (const slug of ["wild-boar", "south-american-tapir", "collared-peccary", "saltwater-crocodile", "gray-angelfish", "little-blue-heron"]) assert.ok(youngCoatOf(slug), slug);
    assert.equal(youngCoatOf("plains-zebra"), null);
    assert.equal(youngCoatOf(null), null);
});

test("a species without a young coat gets all-zero uniforms (drawn as before); one with it, linear colours and its marks", () => {
    const none = youngCoatUniforms("plains-zebra");
    assert.equal(none.arkYoungA.value[3], 0);
    assert.equal(none.arkYoungB.value[3], 0);
    assert.equal(none.arkYoungC.value[0], 0);
    assert.equal(none.arkYoungC.value[3], 0);
    const boar = youngCoatUniforms("wild-boar");
    assert.equal(boar.arkYoungA.value.length, 4);
    assert.ok(boar.arkYoungA.value[3] > 0.5 && boar.arkYoungB.value[3] > 0.5);
    assert.equal(boar.arkYoungC.value[0], 2, "stripes along the body");
    assert.ok(boar.arkYoungA.value[0] < 0.44, "sRGB to linear");
    assert.equal(youngCoatUniforms("southeastern-five-lined-skink").arkYoungC.value[2], 1, "the tail only");
    assert.ok(youngCoatUniforms("scarlet-ibis").arkYoungC.value[3] > 0, "duller");
});

test("only the Ark-born wear it, by their age: the text's own months where it gives them, else while they grow", () => {
    const boar = youngCoatOf("wild-boar");
    const young = (ageDays: number, growth = 0.2) => ({ageDays, growth, young: true});
    assert.equal(youngCoatStrength(boar, false, young(10)), 0, "one that came aboard grown");
    assert.equal(youngCoatStrength(boar, true, null), 0, "no age from the record");
    assert.equal(youngCoatStrength(null, true, young(10)), 0);
    assert.equal(youngCoatStrength(boar, true, young(30)), 1);
    assert.ok(youngCoatStrength(boar, true, young(105)) > 0.2 && youngCoatStrength(boar, true, young(105)) < 0.8, "fading at 3 to 4 months");
    assert.equal(youngCoatStrength(boar, true, young(121)), 0);
    // A gull is full grown long before its brown is gone: the text's three years, not its growth.
    const gull = youngCoatOf("ring-billed-gull");
    assert.equal(youngCoatStrength(gull, true, {ageDays: 400, growth: 1, young: false}), 1);
    assert.equal(youngCoatStrength(gull, true, {ageDays: 1100, growth: 1, young: false}), 0);
    // No ages in the text: while it is young, gone by the time it is grown.
    const langur = youngCoatOf("francois-langur");
    assert.equal(youngCoatStrength(langur, true, young(20, 0.3)), 1);
    assert.ok(youngCoatStrength(langur, true, young(200, 0.85)) < 1);
    assert.equal(youngCoatStrength(langur, true, {ageDays: 900, growth: 1, young: false}), 0);
});

test("the steps ride in arkCoat.y's twos and leave the dust as it was", () => {
    assert.equal(youngSteps(1), YOUNG_STEPS);
    assert.equal(youngSteps(0), 0);
    assert.equal(youngSteps(2), YOUNG_STEPS);
    for (const dust of [0, 0.3, 1]) {
        for (const steps of [0, 1, 7, 15]) {
            const y = packYoung(dust, steps);
            // The shader's read.
            const got = Math.floor(y * 0.5 + 0.001);
            assert.equal(got, steps);
            assert.ok(Math.abs(y - 2 * got - dust) < 1e-9);
            assert.equal(packYoung(y, steps), y, "written again each frame: the same");
            assert.ok(Math.abs(packYoung(y, 0) - dust) < 1e-9);
        }
    }
    const ys = [0.25, 0.5];
    const attribute = {count: 2, getY: (i: number) => ys[i], setY: (i: number, y: number) => void (ys[i] = y), needsUpdate: false};
    const geometry = {getAttribute: (name: string) => (name === "arkCoat" ? attribute : undefined)};
    applyYoungCoat(geometry, 1, 15);
    assert.deepEqual(ys, [0.25, 30.5]);
    applyYoungCoat(geometry, 0, 0);
    applyYoungCoat(geometry, 5, 9);
    assert.deepEqual(ys, [0.25, 30.5], "an adult and an index out of range are left alone");
    applyYoungCoat({getAttribute: () => undefined}, 0, 9);
});

test("the look shader reads the young coat: declared both sides, dust taken from under the steps, no backtick in the GLSL", () => {
    assert.ok(LOOK_VERTEX_DECLARATIONS.includes("varying vec2 vArkBody;") && LOOK_VERTEX.includes("vArkBody = vec2((position.z - motionRear)"));
    for (const name of ["arkYoungA", "arkYoungB", "arkYoungC"]) assert.ok(LOOK_FRAGMENT_DECLARATIONS.includes(`uniform vec4 ${name};`), name);
    assert.ok(LOOK_FRAGMENT_DECLARATIONS.includes("uniform vec2 arkYoungD;") && LOOK_FRAGMENT_DECLARATIONS.includes("varying vec2 vArkBody;"));
    assert.ok(LOOK_ALBEDO.includes("float arkYoung = floor(vArkLookV.y * 0.5 + 0.001);"));
    assert.ok(LOOK_ALBEDO.includes("clamp(vArkLookV.y - 2.0 * arkYoung, 0.0, 1.0)"));
    assert.ok(LOOK_ALBEDO.indexOf("if (arkYoung > 0.5)") < LOOK_ALBEDO.indexOf("diffuseColor.rgb *= mix(1.0, arkWetDark, arkWet);"), "under the wet and the dust");
});
