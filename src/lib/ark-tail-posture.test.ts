import assert from "node:assert/strict";
import {test} from "node:test";
import animalLook from "@/ark-scene/animal-look.json";
import {socialTarget, stepSocial, tailHold, tailPostureLinks, tailPostureOf, tailPostureSpecies} from "@/ark-scene/tail-posture";

const now = (over: Partial<{motion: number; social: number; clock: number; seed: number}> = {}) => ({motion: 0, social: 0, clock: 10, seed: 0.3, ...over});

test("a tail posture is only for the species whose own catalogue row tells it, each with its quote and its sentence", () => {
    const all = tailPostureSpecies();
    assert.deepEqual(all.map(([slug]) => slug).sort(), ["domestic-dog", "eastern-chipmunk", "hamadryas-baboon", "olive-baboon", "south-american-coati", "toque-macaque"]);
    const models = animalLook.species as Record<string, unknown>;
    for (const [slug, spec] of all) {
        assert.ok(models[slug], `${slug} has a model`);
        assert.match(spec.id, /^[0-9a-f-]{36}$/, slug);
        assert.ok(spec.quote.length > 10, slug);
        assert.match(spec.line, /^\{aAnimal\} [^{}]+$/, slug);
        assert.ok(spec.pitch.length === 3, `${slug}: a posture for each of the rig's three tail links`);
    }
    for (const slug of ["african-lion", "domestic-cat", "giraffe", null, undefined]) assert.equal(tailPostureOf(slug), null);
});

test("a dog's tail wags only while it signals socially: swinging side to side, the tip last, a little raised", () => {
    const dog = tailPostureOf("domestic-dog")!;
    assert.equal(dog.when, "social");
    assert.ok(dog.wag && dog.wag.rate > 2 && dog.wag.rate < 6);
    const calm = tailPostureLinks(dog, now({social: 0}), 3);
    assert.deepEqual(calm.yaw, [0, 0, 0], "not at all when it is not signalling");
    assert.deepEqual(calm.pitch, [0, 0, 0], "and the tail is its own springs'");
    const wagging = (clock: number) => tailPostureLinks(dog, now({social: 1, clock}), 3);
    let most = 0;
    let least = 0;
    for (let t = 0; t < 2; t += 0.01) {
        const links = wagging(t).yaw;
        most = Math.max(most, links[2]);
        least = Math.min(least, links[2]);
    }
    assert.ok(most > 0.4 && least < -0.4, `the tip swings both sides: ${least.toFixed(2)} to ${most.toFixed(2)} rad`);
    const up = wagging(1).pitch;
    assert.ok(up[0] > 0.3, "raised at the base while it signals");
    // The swing arrives later down the chain (the tip last): the base link's peak is before the tip's.
    let baseAt = 0;
    let tipAt = 0;
    let base = -1;
    let tip = -1;
    for (let t = 0; t < 1 / dog.wag!.rate; t += 0.001) {
        const l = tailPostureLinks(dog, now({social: 1, clock: t, seed: 0}), 3).yaw;
        const unit = l[0] / dog.wag!.amp[0];
        const unitTip = l[2] / dog.wag!.amp[2];
        if (unit > base) { base = unit; baseAt = t; }
        if (unitTip > tip) { tip = unitTip; tipAt = t; }
    }
    assert.ok(tipAt > baseAt, `base peaks at ${baseAt.toFixed(3)} s, the tip at ${tipAt.toFixed(3)} s`);
    // Half the signal: half the swing.
    const half = Math.max(...Array.from({length: 200}, (_, i) => tailPostureLinks(dog, now({social: 0.5, clock: i * 0.01}), 3).yaw[2]));
    assert.ok(half < most * 0.6 && half > most * 0.4);
    // Pure in the clock and the seed; each dog on its own beat.
    assert.deepEqual(tailPostureLinks(dog, now({social: 1}), 3), tailPostureLinks(dog, now({social: 1}), 3));
    assert.notDeepEqual(tailPostureLinks(dog, now({social: 1, seed: 0.1}), 3).yaw, tailPostureLinks(dog, now({social: 1, seed: 0.6}), 3).yaw);
});

test("a coati and a chipmunk carry the tail up while they move, the coati's half up at rest; the baboons and the macaque always carry theirs so", () => {
    const coati = tailPostureOf("south-american-coati")!;
    const moving = tailPostureLinks(coati, now({motion: 1}), 3).pitch;
    const resting = tailPostureLinks(coati, now({motion: 0}), 3).pitch;
    assert.ok(moving[0] > 0.9, "straight up like a flag");
    assert.ok(resting[0] > 0.2 && resting[0] < moving[0] * 0.5, "half up at rest");
    assert.deepEqual(tailPostureLinks(coati, now({motion: 1}), 3).yaw, [0, 0, 0], "no wag");
    const chip = tailPostureOf("eastern-chipmunk")!;
    assert.ok(tailPostureLinks(chip, now({motion: 1}), 3).pitch[0] > 1);
    assert.ok(tailPostureLinks(chip, now({motion: 0}), 3).pitch[0] < 0.3);
    const arch = tailPostureOf("hamadryas-baboon")!;
    const a = tailPostureLinks(arch, now({motion: 0}), 3).pitch;
    assert.ok(a[0] > 0.8 && a[2] < 0, "an arch: up from the base, down toward the tip");
    assert.deepEqual(tailPostureLinks(arch, now({motion: 1}), 3).pitch, a, "the same still or moving");
    const bent = tailPostureLinks(tailPostureOf("olive-baboon")!, now(), 3).pitch;
    assert.ok(bent[0] > 1 && bent[1] < -0.9, "bent sharply near the base, then hanging down");
    const s = tailPostureLinks(tailPostureOf("toque-macaque")!, now(), 3).pitch;
    assert.ok(s[0] > 0 && s[1] < 0 && s[2] > 0, "an S: up, back, up");
    // A rig with another number of tail links gets the nearest of the three.
    assert.equal(tailPostureLinks(coati, now({motion: 1}), 5).pitch.length, 5);
    assert.equal(tailPostureLinks(coati, now({motion: 1}), 2).pitch.length, 2);
});

test("the hold, and the social signal: a greeting or a play, never a sound or a spot", () => {
    const dog = tailPostureOf("domestic-dog")!;
    assert.equal(tailHold(dog, {motion: 1, social: 0.4}), 0.4);
    assert.equal(tailHold(tailPostureOf("south-american-coati")!, {motion: 0.7, social: 1}), 0.7);
    assert.equal(tailHold(tailPostureOf("toque-macaque")!, {motion: 0, social: 0}), 1);
    assert.equal(socialTarget(dog, {looking: "an-animal-id", doing: "forage"}), 1);
    assert.equal(socialTarget(dog, {looking: "camera", doing: null}), 1);
    assert.equal(socialTarget(dog, {looking: null, doing: "play"}), 1);
    assert.equal(socialTarget(dog, {looking: "sound", doing: "rest"}), 0);
    assert.equal(socialTarget(dog, {looking: "spot", doing: "rest"}), 0);
    assert.equal(socialTarget(dog, {looking: null, doing: "rest"}), 0);
    assert.equal(socialTarget(tailPostureOf("south-american-coati")!, {looking: "camera", doing: "play"}), 0, "a flag is not a greeting");
    let k = 0;
    for (let i = 0; i < 30; i++) k = stepSocial(k, 1, 1 / 60);
    assert.ok(k > 0.8, `up in about a third of a second: ${k}`);
    let down = 1;
    for (let i = 0; i < 60; i++) down = stepSocial(down, 0, 1 / 60);
    assert.ok(down > 0.3 && down < 0.6, `down over a second or two: ${down}`);
    assert.equal(stepSocial(0.5, 1, 0), 0.5);
});
