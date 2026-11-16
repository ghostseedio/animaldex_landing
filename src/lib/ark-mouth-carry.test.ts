import assert from "node:assert/strict";
import {test} from "node:test";
import type {ActPose} from "@/ark-scene/acts";
import {FRY_MOST, JAWS_SHOWN, MouthCarry, fryOut, fryPose, jawsMotherPose, jawsScript, jawsYoungPose, mouthCarryOf} from "@/ark-scene/mouth-carry";

const flat = () => 0;

test("mouth carrying is only for the six species whose own text says so, carried by the sex it names", () => {
    for (const slug of ["american-alligator", "mugger-crocodile", "saltwater-crocodile"]) {
        const spec = mouthCarryOf(slug);
        assert.ok(spec, slug);
        assert.equal(spec.kind, "jaws");
        assert.equal(spec.carrier, "female");
        assert.equal(spec.say, "carry");
    }
    assert.equal(mouthCarryOf("silver-arowana")?.carrier, "male");
    assert.equal(mouthCarryOf("asian-arowana")?.kind, "brood");
    // (The Asian Arowana's sentence is about eggs: never said of fry.)
    assert.equal(mouthCarryOf("asian-arowana")?.say, null);
    assert.equal(mouthCarryOf("nile-tilapia")?.carrier, "female");
    assert.equal(mouthCarryOf("nile-tilapia")?.say, "danger");
    assert.equal(mouthCarryOf("red-deer"), null);
    assert.equal(mouthCarryOf(null), null);
});

test("a crocodilian's carry: to the nest, the hatchlings taken up at her jaw, let go at the water", () => {
    const sc = jawsScript({x: 0, z: 0, length: 4, height: 0.6, pace: 1}, {x: 10, z: 0}, {x: 10, z: 12}, 9);
    assert.ok(sc.atNest > 0 && sc.taken > sc.atNest && sc.atWater > sc.taken && sc.end > sc.atWater);
    assert.equal(sc.shown, JAWS_SHOWN);
    // At the nest her snout is over it: her middle half her length short.
    const atNest = jawsMotherPose(sc, sc.atNest + 1, flat);
    assert.ok(Math.abs(atNest.x - 8) < 1e-6 && Math.abs(atNest.z) < 1e-6);
    assert.ok(atNest.pitch > 0, "head down at the nest");
    const atWater = jawsMotherPose(sc, sc.atWater + 1, flat);
    assert.ok(Math.abs(atWater.x - 10) < 1e-6 && Math.abs(atWater.z - 12) < 1e-6);
    // Before she takes it up, a hatchling is round the nest.
    const before = jawsYoungPose(sc, 0, 1, flat);
    assert.ok(Math.hypot(before.x - 10, before.z) < 4 * 0.2);
    // While she carries, the first few ride at the tip of her jaw, the others out of sight.
    const mid = (sc.taken + sc.atWater) / 2;
    const mother = jawsMotherPose(sc, mid, flat);
    const held = jawsYoungPose(sc, 0, mid, flat);
    assert.equal(held.hidden, false);
    assert.ok(Math.abs(Math.hypot(held.x - mother.x, held.z - mother.z) - 4 * 0.45) < 0.2, "at her jaw");
    assert.ok(held.base > 0, "lifted off the ground");
    assert.equal(jawsYoungPose(sc, JAWS_SHOWN + 1, mid, flat).hidden, true);
    // Let go, they are ahead of her at the water.
    const freed = jawsYoungPose(sc, 2, sc.end, flat);
    assert.equal(freed.hidden, false);
    assert.ok(Math.hypot(freed.x - 10, freed.z - 12) > 4 * 0.5 - 1e-6);
    assert.ok(freed.z > 12, "out in front, toward the water");
});

test("a mouthbrooder's fry are held at first, then come and go by the shared clock, the same for everyone", () => {
    assert.equal(fryOut("hatch:x", 0), 0);
    assert.equal(fryOut("hatch:x", 11), 0);
    const samples = Array.from({length: 200}, (_, i) => fryOut("hatch:x", 12 + i * 0.5));
    assert.ok(samples.some((v) => v === 1), "out at times");
    assert.ok(samples.slice(60).some((v) => v === 0), "in again at times");
    assert.deepEqual(samples, Array.from({length: 200}, (_, i) => fryOut("hatch:x", 12 + i * 0.5)));
    const parent = {x: 1, y: -1, z: 2, yaw: 0, length: 0.3};
    const outPose = fryPose(parent, 3, 40, "hatch:x", 1);
    assert.equal(outPose.hidden, false);
    assert.ok(outPose.z > parent.z + 0.15, "ahead of the mouth");
    assert.equal(fryPose(parent, 3, 40, "hatch:x", 0).hidden, true);
    assert.ok(FRY_MOST >= 8);
});

type Fake = {id: string; slug: string; male: boolean | null; act: ActPose | null};

test("the fry dart in at danger, and only then is the tilapia's own sentence said", () => {
    const cast: Fake[] = [
        {id: "m", slug: "nile-tilapia", male: true, act: null},
        {id: "f", slug: "nile-tilapia", male: false, act: null},
        ...Array.from({length: 5}, (_, k): Fake => ({id: `y${k}`, slug: "nile-tilapia", male: null, act: null}))
    ];
    let alarmed = false;
    const layer = new MouthCarry<Fake>({
        find: (id) => cast.find((c) => c.id === id) ?? null,
        slug: (e) => e.slug,
        placeAt: () => ({x: 0, y: -1, z: 0, yaw: 0}),
        ground: flat,
        waterNear: () => null,
        walk: () => 0.5,
        length: () => 0.3,
        height: () => 0.1,
        male: (e) => e.male,
        alarmed: () => alarmed,
        setAct: (e, pose) => {
            e.act = pose;
        },
        busy: () => false
    });
    const t0 = 1000;
    layer.add([{key: "hatch:t", parents: ["m", "f"], young: cast.slice(2).map((c) => c.id), t0}], t0);
    // Find a moment the fry are out by the clock.
    let s = 12;
    while (fryOut("hatch:t", s) < 1) s += 0.5;
    layer.step(t0 + s);
    assert.equal(layer.debug()[0].carrier, "f", "the female carries");
    assert.equal(cast[2].act?.hidden, false, "out at her mouth");
    assert.equal(layer.showing("f"), null, "holding is not the danger sentence");
    alarmed = true;
    layer.step(t0 + s + 0.1);
    assert.equal(cast[2].act?.hidden, true, "darted in");
    assert.equal(layer.showing("f")?.line, mouthCarryOf("nile-tilapia")?.line);
    alarmed = false;
    layer.step(t0 + s + 1);
    assert.equal(cast[2].act?.hidden, true, "kept in a little after");
    assert.ok(layer.pins().includes("f"));
});
