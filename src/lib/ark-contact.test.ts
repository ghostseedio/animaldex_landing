import assert from "node:assert/strict";
import test from "node:test";
import {behaviourProfile, bodyLengthsPerSecond, freeBodyLengthsPerSecond} from "@/ark-scene/behaviour-profile";
import {ClimbStems, type ClimbStem} from "@/ark-scene/bug-climb";
import {benthicCreep, edgeBase, inPlaceLift, IN_PLACE_LIFT_FREE, livesUnderWater, shadowFootprint, wadeBase, wadeDepth} from "@/ark-scene/grounding/contact";
import {feetCarryClip, modelBase} from "@/ark-scene/grounding/base";
import {lieOnGround} from "@/ark-scene/grounding/stand";
import {lyingTorso} from "@/ark-scene/sleep";

// Lane ARK-CONTACT (decision 447): the contact rules the scene and the contact audit share (`grounding/contact.ts`).
// The whole audit: `npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-contact-audit.mts --validator`.

test("no bird walks the bed: past its wading depth it rides at its float line, its head over the surface", () => {
    const height = 0.4;
    // Shallow: on the bed, its legs in the water.
    assert.deepEqual(wadeBase(1.0, 1.05, height, "wader", "bird"), {base: 1.0, floating: false});
    // A sparrow in 50 cm of water: not on the bed under it.
    const sparrow = wadeBase(0.5, 1.0, 0.12, null, "bird");
    assert.equal(sparrow.floating, true);
    assert.ok(sparrow.base + 0.12 * 0.9 > 1.0, "its head is out of the water");
    // A heron wades deeper than a duck-sized bird would.
    assert.ok(wadeDepth(1, "wader") > wadeDepth(1, null));
    // A lion crossing a river floats, head up.
    const lion = wadeBase(0, 1.5, 1.1, null, "mammal");
    assert.ok(lion.floating && lion.base + 1.1 * 0.9 > 1.5);
    // A sea anemone, an urchin, a crab live on the bed: never floated up.
    assert.ok(livesUnderWater(behaviourProfile("magnificent-sea-anemone", modelBase("magnificent-sea-anemone")?.plan), modelBase("magnificent-sea-anemone")?.plan));
    assert.deepEqual(wadeBase(-4, 0, 0.3, null, "sessile", true), {base: -4, floating: false});
});

test("sliding out of the water up a bank, the body never goes into the bank", () => {
    // Half way up a bank 30 cm over the water: the float line (under the bank) is not where it is drawn.
    const ground = 0.3;
    const fitted = -0.1;
    assert.equal(edgeBase(ground, fitted, 0.5, ground), ground);
    // In the water, the float line as before.
    assert.equal(edgeBase(0, -0.1, 1, -0.6), -0.1);
});

test("sea stars, urchins and sea cucumbers creep (cm a minute); sessile animals keep still", () => {
    for (const slug of ["crown-of-thorns-starfish", "blue-linckia-sea-star", "collector-urchin", "black-sea-cucumber"]) {
        const profile = behaviourProfile(slug, modelBase(slug)?.plan);
        assert.equal(benthicCreep(profile), 0.01, slug);
        // A 25 cm star at most 0.3 cm/s on the ground and in the water (it was 16 cm/s).
        assert.ok(bodyLengthsPerSecond(profile) * 0.25 < 0.003, slug);
        assert.ok(freeBodyLengthsPerSecond(profile) * 0.25 < 0.003, slug);
    }
    assert.equal(benthicCreep(behaviourProfile("mediterranean-feather-star", "sessile")), 0);
    // Crabs walk as before.
    assert.equal(benthicCreep(behaviourProfile("mangrove-crab", modelBase("mangrove-crab")?.plan)), null);
});

test("a contact shadow is its body's own size and shape, turned with it", () => {
    const giraffe = {min: {x: -0.14, y: -0.64, z: -0.5}, max: {x: 0.14, y: 0.64, z: 0.5}};
    const upright = shadowFootprint(giraffe, 4, 0, 0);
    assert.ok(Math.abs(upright.width - 1.12) < 1e-6 && Math.abs(upright.length - 4) < 1e-6);
    // On its side (a quarter roll): as wide as it was tall.
    const side = shadowFootprint(giraffe, 4, 0, Math.PI / 2);
    assert.ok(Math.abs(side.width - 1.28 * 4) < 1e-6);
    // A beetle's shadow is a beetle's, not 40 cm across.
    const beetle = shadowFootprint({min: {x: -0.3, y: -0.2, z: -0.5}, max: {x: 0.3, y: 0.2, z: 0.5}}, 0.01, 0, 0);
    assert.ok(beetle.width < 0.01 && beetle.length <= 0.01 + 1e-9);
});

test("a clip played in place on the ground keeps the body on its feet: only a bob of rise is left", () => {
    assert.equal(inPlaceLift(0.01, 1), 0);
    assert.ok(Math.abs(inPlaceLift(0.3, 1) - (0.3 - IN_PLACE_LIFT_FREE)) < 1e-9);
    // Gaits and standing clips keep their own (the feet carry them; a hop's air time is a hop).
    for (const name of ["walk", "run", "hop", "idle", "graze", "strike"]) assert.ok(feetCarryClip(name), name);
    for (const name of ["pounce", "play", "power_ambush"]) assert.ok(!feetCarryClip(name), name);
});

test("a long body asleep keeps its chin and tail on the ground over a hollow, not in the bank", () => {
    // A 5 m body lying across a bank that rises 40 cm toward its head (curving: flat under its middle).
    const box = {min: {x: -0.2, y: -0.1, z: -0.5}, max: {x: 0.2, y: 0.1, z: 0.5}};
    const torso = lyingTorso(box, 0.5);
    const scale = 5;
    const ground = (x: number, z: number) => (z > 1 ? (z - 1) * 0.27 : 0);
    const flat = {nx: 0, ny: 1, nz: 0};
    const was = lieOnGround(0, 0, 0, scale, {...torso, ends: undefined}, 0.06, 0, 0, flat);
    const now = lieOnGround(0, 0, 0, scale, torso, 0.06, 0, 0, flat, ground);
    const chin = (stand: {rootY: number; pitch: number}) => {
        const p = stand.pitch + 0.06;
        const y1 = torso.bottom * scale;
        const z1 = torso.ends.z1 * scale;
        return {y: stand.rootY + y1 * Math.cos(p) - z1 * Math.sin(p), z: y1 * Math.sin(p) + z1 * Math.cos(p)};
    };
    const before = chin(was);
    const after = chin(now);
    assert.ok(before.y < ground(0, before.z) - 0.05, "before: its chin was in the bank");
    assert.ok(after.y >= ground(0, after.z) - 1e-6, "after: on it");
});

test("a bug climbs only a blade that is drawn (the nearest 24 within 14 m)", () => {
    const stems = new ClimbStems();
    const near: ClimbStem = {x: 1, y: 0, z: 0, height: 0.15, side: 0, length: 0.02, shade: 1};
    const far: ClimbStem = {x: 30, y: 0, z: 0, height: 0.15, side: 0, length: 0.02, shade: 1};
    stems.note(far);
    stems.note(near);
    stems.update({x: 0, y: 1, z: 0});
    assert.equal(stems.shown(near), true);
    assert.equal(stems.shown(far), false);
    // Past the cap, the nearest are drawn, not the first noted.
    const many = Array.from({length: 30}, (_, i): ClimbStem => ({x: 13 - i * 0.4, y: 0, z: 0, height: 0.15, side: 0, length: 0.02, shade: 1}));
    for (const stem of many) stems.note(stem);
    stems.update({x: 0, y: 0, z: 0});
    const nearest = many.slice().sort((a, b) => Math.abs(a.x) - Math.abs(b.x)).slice(0, 24);
    for (const stem of nearest) assert.ok(stems.shown(stem));
    stems.dispose();
});
