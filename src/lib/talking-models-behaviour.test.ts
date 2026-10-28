import assert from "node:assert/strict";
import test from "node:test";

// The web port of the iOS behaviour director, held to a timeline recorded
// from the Swift code itself (`__fixtures__/ios-behaviour-timeline.swift`):
// the same seed plays the same behaviours at the same frames.
import timeline from "./talking-models/__fixtures__/ios-behaviour-timeline.json";
import {
    BehaviourDirector,
    BehaviourRandom,
    IDLE_BEHAVIOURS,
    motionUniforms,
    movedPoint,
    type BehaviourAbilities,
    type BehaviourPose,
    type IdleBehaviour,
    type TalkingBehaviour
} from "@/lib/talking-models/behaviour";
import {talkingModelAsset, talkingModelSlug, talkingModelSlugFor} from "@/lib/talking-models/catalog";
import {eyeOpenness, MouthEnvelope, TalkingFraming} from "@/lib/talking-models/model-math";

type Recorded = {
    slug: string;
    scenario: "quiet" | "talks";
    seed: string;
    abilities: BehaviourAbilities;
    behaviour: TalkingBehaviour;
    events: Array<{frame: number; kind: IdleBehaviour | null}>;
    samples: number[][];
};

const fixture = timeline as unknown as {
    random: {seed: string; next: string[]; unit: number[]};
    animals: Recorded[];
    poses: Array<[IdleBehaviour, number, number, ...number[]]>;
    fields: Array<keyof BehaviourPose>;
};

const FPS = 60;
const SPEAKING: Record<Recorded["scenario"], Array<[number, number]>> = {
    quiet: [],
    talks: [[20, 26], [40, 43.5]]
};

/** Runs the director as the recorder did: 60 frames a second for three minutes. */
function replay(animal: Recorded) {
    const director = new BehaviourDirector(animal.behaviour, animal.abilities, BigInt(animal.seed));
    const events: Array<{frame: number; kind: IdleBehaviour | null}> = [];
    const samples = new Map<number, BehaviourPose>();
    let last: IdleBehaviour | null = null;
    for (let frame = 0; frame < 180 * FPS; frame++) {
        const t = frame / FPS;
        const speaking = SPEAKING[animal.scenario].some(([from, to]) => t >= from && t < to);
        const pose = director.pose(t, speaking);
        const now = director.playing;
        if (now !== last) events.push({frame, kind: now});
        last = now;
        if (frame % 97 === 0) samples.set(frame, pose);
    }
    return {events, samples};
}

test("the generator draws the same numbers as the Swift one", () => {
    assert.equal(BehaviourRandom.seed("red-fox").toString(), fixture.random.seed);
    const random = new BehaviourRandom(BehaviourRandom.seed("red-fox"));
    for (const expected of fixture.random.next) assert.equal(random.next().toString(), expected);
    for (const expected of fixture.random.unit) assert.equal(random.unit(), expected);
});

test("each animal's seed is its slug's, as on iOS", () => {
    for (const animal of fixture.animals) {
        assert.equal(BehaviourRandom.seed(animal.slug).toString(), animal.seed, animal.slug);
    }
});

test("every recorded animal plays the same behaviours at the same frames as iOS", () => {
    assert.ok(fixture.animals.length >= 10);
    for (const animal of fixture.animals) {
        const {events} = replay(animal);
        assert.deepEqual(events, animal.events, `${animal.slug} (${animal.scenario})`);
    }
});

test("the poses along the way match iOS to float precision", () => {
    for (const animal of fixture.animals) {
        const {samples} = replay(animal);
        for (const [frame, ...values] of animal.samples) {
            const pose = samples.get(frame);
            assert.ok(pose, `${animal.slug} frame ${frame}`);
            fixture.fields.forEach((field, index) => {
                assert.ok(
                    Math.abs(pose[field] - values[index]) < 2e-5,
                    `${animal.slug} (${animal.scenario}) frame ${frame} ${field}: ${pose[field]} vs ${values[index]}`
                );
            });
        }
    }
});

test("each behaviour's pose curve matches iOS", () => {
    assert.equal(fixture.poses.length, IDLE_BEHAVIOURS.length * 14 * 2);
    for (const [kind, t, direction, ...values] of fixture.poses) {
        const pose = BehaviourDirector.poseOf(kind, t, direction);
        fixture.fields.forEach((field, index) => {
            assert.ok(Math.abs(pose[field] - values[index]) < 2e-5, `${kind} at ${t} ${field}: ${pose[field]} vs ${values[index]}`);
        });
    }
});

test("a koala mostly yawns and dozes, never the same thing twice running", () => {
    const koala = fixture.animals.find((animal) => animal.slug === "koala" && animal.scenario === "quiet") as Recorded;
    const seen = replay(koala).events.map((event) => event.kind).filter((kind): kind is IdleBehaviour => kind !== null);
    assert.ok(seen.length >= 8);
    assert.ok(seen.filter((kind) => kind === "yawn" || kind === "doze").length / seen.length > 0.5);
    seen.slice(1).forEach((kind, index) => assert.notEqual(kind, seen[index]));
});

test("what it cannot do never plays, and nothing starts while it speaks", () => {
    const koala: TalkingBehaviour = {plan: "mammal", idle: {yawn: 3, doze: 3, chew: 2, sniff: 1, look: 1}, tempo: "slow"};
    const director = new BehaviourDirector(koala, {jaw: false, eyes: false, nose: true, tail: false}, BigInt(7));
    const speaking = new BehaviourDirector(koala, {jaw: true, eyes: true, nose: true, tail: false}, BigInt(7));
    for (let frame = 0; frame < 1200; frame++) {
        director.pose(frame / 10, false);
        const playing = director.playing;
        assert.ok(playing === null || playing === "sniff" || playing === "look");
        speaking.pose(frame / 10, frame < 300);
        if (frame < 300) assert.equal(speaking.playing, null);
    }
});

test("speaking stops a yawn at once", () => {
    const director = new BehaviourDirector({idle: {yawn: 3}}, {jaw: true, eyes: true, nose: true, tail: true}, BigInt(1));
    let t = 0;
    while (director.playing !== "yawn" && t < 60) {
        t += 0.1;
        director.pose(t, false);
    }
    assert.equal(director.playing, "yawn");
    const pose = director.pose(t + 0.1, true);
    assert.equal(director.playing, null);
    assert.equal(pose.mouth, 0);
});

test("a manta's wings rise at the tips and its head stays still", () => {
    const manta = fixture.animals.find((animal) => animal.slug === "giant-oceanic-manta-ray") as Recorded;
    const uniforms = motionUniforms(manta.behaviour);
    assert.ok(uniforms);
    assert.equal(uniforms.motionKind, 2);
    const beat = 1; // a quarter of the way into a 4 s beat: the wings near their top
    const tip = movedPoint([0.55, 0, 0], uniforms, beat, 1, 0);
    const middle = movedPoint([0.05, 0, 0], uniforms, beat, 1, 0);
    assert.ok(Math.abs(tip[1]) > 0.05);
    assert.equal(middle[1], 0);
    // A plain mammal with no motion and no tail has no motion at all.
    assert.equal(motionUniforms({plan: "mammal", idle: {look: 2}}), null);
});

// MARK: - The catalogue and the model's numbers

test("a card finds its model by any of its names, folded as the build scripts fold them", () => {
    const manifest = {models: {"galapagos-tortoise": "v1", "giant-oceanic-manta-ray": "v2"}, aliases: {"manta-ray": "giant-oceanic-manta-ray"}, glb: "g1"};
    assert.equal(talkingModelSlug("Galápagos Tortoise"), "galapagos-tortoise");
    assert.equal(talkingModelSlug("Cooper's Hawk"), "coopers-hawk");
    assert.equal(talkingModelSlugFor(manifest, [null, "Manta Ray", "manta-ray"]), "giant-oceanic-manta-ray");
    assert.equal(talkingModelSlugFor(manifest, ["Dodo"]), null);
});

test("no call on the web until the animal's glTF is published", () => {
    const published = {models: {"red-fox": "abc"}, glb: "g1"};
    const asset = talkingModelAsset(published, "red-fox");
    assert.ok(asset?.model.endsWith("/red-fox/abc.g1.glb"));
    assert.ok(asset?.texture.endsWith("/red-fox/abc.jpg"));
    assert.ok(asset?.rig.endsWith("/red-fox/abc.json"));
    // The manifest as it is today: USDZ only.
    assert.equal(talkingModelAsset({models: {"red-fox": "abc"}}, "red-fox"), null);
    assert.equal(talkingModelAsset({...published, glb_missing: ["red-fox"]}, "red-fox"), null);
});

test("it blinks every 4.1 s, twice every third time, and its mouth opens faster than it shuts", () => {
    assert.equal(eyeOpenness(1), 1);
    assert.ok(eyeOpenness(4.1 + 0.08) < 0.2);
    assert.equal(eyeOpenness(4.1 + 0.24 + 0.08), 1);
    assert.ok(eyeOpenness(2 * 4.1 + 0.24 + 0.08) < 0.2);
    const opening = new MouthEnvelope();
    const closing = new MouthEnvelope();
    closing.openness = 1;
    const up = opening.update(-14, 0.04);
    const down = 1 - closing.update(-42, 0.04);
    assert.ok(up > down);
    assert.equal(new MouthEnvelope().update(-90, 1), 0);
});

test("at rest the camera is the iOS three-quarter view, and turned round it backs off to fit", () => {
    const framing = TalkingFraming.forBox([-0.1, -0.33, -0.5], [0.37, 0.33, 0.5]);
    const rest = framing.pose(0, 0);
    const offset = rest.position.map((value, index) => value - rest.target[index]);
    // Yaw atan2(0.62, 1) and pitch asin(0.3 / |(0.62, 0.3, 1)|): the direction (0.62, 0.3, 1).
    const length = Math.hypot(...offset);
    const direction = offset.map((value) => value / length);
    const expected = [0.62, 0.3, 1].map((value) => value / Math.hypot(0.62, 0.3, 1));
    direction.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-9));
    const behind = framing.pose(Math.PI, 0);
    assert.ok(Math.hypot(...behind.position.map((value, index) => value - behind.target[index])) >= length);
});
