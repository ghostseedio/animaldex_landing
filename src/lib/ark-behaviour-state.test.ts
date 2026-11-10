import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {ARK_FLYERS} from "@/ark-scene/flyers";
import {animationTargets, behaviourState, cardSaysAsleep, type ArkBehaviourInput} from "@/ark-scene/behaviour-state";
import {daylightAt, isAwake} from "@/lib/ark-daylight";
import type {ArkAnimal} from "@/ark-scene/types";

const SEA = new Set(["coral_reef", "open_ocean"]);
const snapshot = decodeArkSnapshot(fixtureV2);
const animals: ArkAnimal[] = snapshot ? snapshot.animals : [];

/** A sample across activities, flyers and zones: every flyer, and every 3rd of the rest. */
const sample = animals.filter((animal, index) => ARK_FLYERS.has(animal.model_slug) || index % 3 === 0);
const HOURS = Array.from({length: 48}, (_, i) => i / 2);

function input(animal: ArkAnimal, hours: number, extra: Partial<ArkBehaviourInput> = {}): ArkBehaviourInput {
    return {activity: animal.activity, elevation: daylightAt(hours).elevation, flyer: ARK_FLYERS.has(animal.model_slug) && !SEA.has(animal.zone), ...extra};
}

test("the sample covers flyers and every activity", () => {
    assert.ok(sample.length >= 30, `sample of ${sample.length}`);
    assert.ok(sample.some((a) => ARK_FLYERS.has(a.model_slug)));
    for (const activity of ["diurnal", "nocturnal", "crepuscular"]) assert.ok(sample.some((a) => a.activity === activity), activity);
});

test("at every hour, the animation and the tap card say the same thing", () => {
    let checked = 0;
    for (const animal of sample) {
        for (const hours of HOURS) {
            const state = behaviourState(input(animal, hours));
            const targets = animationTargets(state);
            // The card's "Asleep now" is exactly the animation's sleep.
            assert.equal(cardSaysAsleep(state), targets.rest === 1, `${animal.model_slug} at ${hours}`);
            // Nothing flies asleep, and an awake bird of the air is up in it.
            if (state.asleep) assert.equal(targets.air, 0, `${animal.model_slug} asleep in the air at ${hours}`);
            const flyer = ARK_FLYERS.has(animal.model_slug) && !SEA.has(animal.zone);
            if (flyer && !state.asleep) assert.equal(targets.air, 1, `${animal.model_slug} awake on the ground at ${hours}`);
            if (!flyer) assert.equal(targets.air, 0);
            // The same rule the species' activity has always had: the card adds no clock of its own.
            assert.equal(state.asleep, !isAwake(animal.activity ?? null, daylightAt(hours).elevation));
            checked++;
        }
    }
    assert.ok(checked > 1000);
});

test("selecting or following is not an input: the state is the hour's and the species'", () => {
    // The reported hawk: circling in the day, tapped. Its state (and so its animation and its card) can't change on a tap,
    // because nothing about the tap reaches the state; the same input gives the same state, frame after frame.
    const hawk = animals.find((a) => a.model_slug === "red-tailed-hawk");
    assert.ok(hawk);
    const noon = behaviourState(input(hawk, 12));
    assert.equal(noon.kind, "flying");
    assert.equal(cardSaysAsleep(noon), false);
    const night = behaviourState(input(hawk, 23));
    assert.equal(night.kind, "asleep");
    assert.equal(animationTargets(night).air, 0);
    assert.equal(cardSaysAsleep(night), true);
    assert.equal(behaviourState(input(hawk, 12)), noon);
});

test("an act is wide awake, a visitor is awake, and reduced motion keeps a flyer on its spot", () => {
    const owl = animals.find((a) => a.model_slug === "barn-owl");
    assert.ok(owl);
    assert.equal(behaviourState(input(owl, 12)).kind, "asleep");
    assert.equal(behaviourState(input(owl, 12, {acting: true})).kind, "awake");
    assert.equal(behaviourState(input(owl, 12, {visitor: true})).asleep, false);
    assert.equal(behaviourState(input(owl, 0)).kind, "flying");
    assert.equal(behaviourState(input(owl, 0, {reducedMotion: true})).kind, "awake");
});
