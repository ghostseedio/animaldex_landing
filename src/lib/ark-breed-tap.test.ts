import assert from "node:assert/strict";
import test from "node:test";

import {breedFocus, clutchFrame, clutchSize, isBreedKind, kinFrameApart, seenAt, youngStillWanted, YOUNG_SETTLE_MS, YOUNG_WAIT_MS} from "@/ark-scene/live/breed-focus";
import {clutchSpot, matingScript, type MatingBody} from "@/ark-scene/live-matings";

// Owner 2026-11-16, on the live Ark: "some of the logs like '[animal] has mated' or 'laid a clutch of eggs' or
// 'hatched' etc. don't show anything". Real ids of that day's record (a wall lizard pair, an Oriental White-eye brood).
const A = "60b11646-d8f0-4ce8-ae2c-782120ff2b62";
const B = "8b7b1c6c-38fd-42f0-ac60-9c199d58d369";
const YOUNG = "18fda90e-0000-4000-8000-000000000001";
const MOTHER = "06246ff0-fccf-4a64-b752-ec78dce9e24d";
const FATHER = "462239df-3522-4dbd-9966-d2594b5a9251";
const aboard = (...ids: string[]) => (id: string) => ids.includes(id);

test("only the record's breeding lines take this path", () => {
    for (const kind of ["mated", "laid", "birth", "hatched"]) assert.ok(isBreedKind(kind));
    for (const kind of ["meal", "death", "arrival", "courting", "nest", undefined, null]) assert.equal(isBreedKind(kind as string), false);
});

test("a mating: the pair when both are aboard, drawn now or resting out of sight", () => {
    // (The old tap asked the scene to locate the animal: only those drawn one by one answer, 1,200 of 3,698 at most.)
    assert.deepEqual(breedFocus("mated", A, {partner: B}, aboard(A, B)), {do: "pair", a: A, b: B});
    assert.deepEqual(breedFocus("mated", A, {partner: B}, aboard(A)), {do: "one", id: A});
    // The first gone since (eaten, dead): its partner.
    assert.deepEqual(breedFocus("mated", A, {partner: B}, aboard(B)), {do: "one", id: B});
    // No partner remembered (a line folded from an older read): the first.
    assert.deepEqual(breedFocus("mated", A, {}, aboard(A, B)), {do: "one", id: A});
    // Neither aboard: the caller's fallbacks.
    assert.equal(breedFocus("mated", A, {partner: B}, aboard()), null);
    assert.equal(breedFocus("mated", null, {partner: B}, aboard(A, B)), null);
    // A partner the same as the first is not a pair.
    assert.deepEqual(breedFocus("mated", A, {partner: A}, aboard(A)), {do: "one", id: A});
});

test("a clutch: its parents, as the mating's", () => {
    assert.deepEqual(breedFocus("laid", A, {partner: B}, aboard(A, B)), {do: "pair", a: A, b: B});
    assert.deepEqual(breedFocus("laid", A, {partner: null}, aboard(A)), {do: "one", id: A});
});

test("a young: with its mother when both are aboard; not aboard yet, its mother, the young chosen once it comes", () => {
    const parents = [MOTHER, FATHER];
    assert.deepEqual(breedFocus("hatched", YOUNG, {parents}, aboard(YOUNG, MOTHER, FATHER)), {do: "pair", a: YOUNG, b: MOTHER});
    // The first parent gone: the other.
    assert.deepEqual(breedFocus("birth", YOUNG, {parents}, aboard(YOUNG, FATHER)), {do: "pair", a: YOUNG, b: FATHER});
    assert.deepEqual(breedFocus("birth", YOUNG, {parents}, aboard(YOUNG)), {do: "one", id: YOUNG});
    assert.deepEqual(breedFocus("hatched", YOUNG, {parents}, aboard(MOTHER, FATHER)), {do: "parent", id: MOTHER, young: YOUNG});
    assert.equal(breedFocus("hatched", YOUNG, {parents}, aboard()), null);
    // No parents remembered: the young alone, or nothing.
    assert.deepEqual(breedFocus("birth", YOUNG, {}, aboard(YOUNG)), {do: "one", id: YOUNG});
    assert.equal(breedFocus("birth", YOUNG, {}, aboard(MOTHER)), null);
});

test("a newborn and its mother framed together only while near, by the mother's size", () => {
    // A white-eye (12 cm): within 1.5 m; a giraffe (4.5 m): 27 m.
    assert.equal(kinFrameApart(0.12), 1.5);
    assert.equal(kinFrameApart(4.5), 27);
});

test("a body made out at the framing's distance: a lizard close yes, a fly from a pair's wide frame no", () => {
    const FOV = 38;
    assert.ok(seenAt(0.11, 1.2, FOV));
    // Two Common Flesh Flies (1.3 cm) two metres apart, framed together from about 3.5 m: specks.
    assert.equal(seenAt(0.013, 3.5, FOV), false);
    // The one fly alone at its close-up (6 lengths, at least 12 cm).
    assert.ok(seenAt(0.013, 0.12, FOV));
    // An elephant pair 20 m apart from 35 m: both seen.
    assert.ok(seenAt(6, 35, FOV));
});

test("a clutch's size follows its mother's, a fly's eggs no hen's", () => {
    assert.equal(clutchSize(0.012), 0.012 * 0.55);
    assert.equal(clutchSize(0.3), 0.3 * 0.55);
    assert.equal(clutchSize(10), 1.6);
    assert.ok(clutchSize(0) > 0);
});

test("a pair's clutch is laid where she stood for the mating that took, at her side, in the pair's picture", () => {
    const body = (x: number): MatingBody => ({x, z: 0, pace: 0.3, length: 0.2, height: 0.1, plan: "reptile", courtship: null, male: null});
    for (const apart of [0.5, 4, 30]) {
        const sc = matingScript(body(0), body(apart), `clutch${apart}`)!;
        const took = sc.attempts.find((a) => a.took) ?? sc.attempts[sc.attempts.length - 1];
        const spot = clutchSpot(sc);
        const off = Math.hypot(spot.x - took.spot.x, spot.z - took.spot.z);
        assert.ok(Math.abs(off - sc.f.length * 0.9) < 1e-9, `${apart} m: ${off.toFixed(3)} m from her`);
        // Square to her heading (beside her, not under him behind her).
        assert.ok(Math.abs((spot.x - took.spot.x) * sc.dir.x + (spot.z - took.spot.z) * sc.dir.z) < 1e-9);
        // On the other side from where he rests.
        const toSide = {x: sc.side.x - took.spot.x, z: sc.side.z - took.spot.z};
        assert.ok((spot.x - took.spot.x) * toSide.x + (spot.z - took.spot.z) * toSide.z <= 1e-9);
    }
});

test("a young waited for is forgotten the moment the viewer chooses, follows or closes anything else", () => {
    const wait = {parent: MOTHER, since: 0, until: YOUNG_WAIT_MS};
    const on = {selected: MOTHER, followed: null};
    assert.ok(youngStillWanted(wait, 5_000, on));
    // Following the mother herself keeps it.
    assert.ok(youngStillWanted(wait, 5_000, {selected: MOTHER, followed: MOTHER}));
    // Another animal chosen, the card closed, another followed: gone.
    assert.equal(youngStillWanted(wait, 5_000, {selected: FATHER, followed: null}), false);
    assert.equal(youngStillWanted(wait, 5_000, {selected: null, followed: null}), false);
    assert.equal(youngStillWanted(wait, 5_000, {selected: MOTHER, followed: FATHER}), false);
    // Past the wait, or with no scene: gone.
    assert.equal(youngStillWanted(wait, YOUNG_WAIT_MS + 1, on), false);
    assert.equal(youngStillWanted(wait, 5_000, null), false);
    assert.equal(youngStillWanted(null, 5_000, on), false);
    // The tap's own choice still landing (the scene placing a read): nothing chosen yet is not the viewer's doing.
    assert.ok(youngStillWanted(wait, YOUNG_SETTLE_MS - 1, {selected: null, followed: null}));
    assert.equal(youngStillWanted(wait, YOUNG_SETTLE_MS - 1, {selected: FATHER, followed: null}), false);
});

test("a clutch tap frames the mother and her eggs at half the view's height, never too close", () => {
    const FOV = 38;
    const tan = Math.tan((FOV * Math.PI) / 360);
    // A wall lizard (20 cm drawn) beside her eggs 16 cm off: about 1 m back, nearer than the pair's 1.45 m.
    const lizard = clutchFrame({x: 0, y: 0.05, z: 0}, {x: 0.16, y: 0, z: 0}, 0.2, FOV);
    assert.ok(Math.abs(lizard.x - 0.08) < 1e-9 && Math.abs(lizard.z) < 1e-9);
    const share = (0.16 + 0.2 * 1.2) / (2 * lizard.distance * tan);
    assert.ok(Math.abs(share - 0.5) < 1e-9, `fills ${share.toFixed(2)} of the height`);
    assert.ok(lizard.distance < 1.45 && lizard.distance > 0.5);
    // Still walking to her mate, metres off: the eggs and a body round them.
    const walking = clutchFrame({x: 3, y: 0, z: 0}, {x: 0, y: 0, z: 0}, 0.2, FOV);
    assert.deepEqual([walking.x, walking.z], [0, 0]);
    assert.ok(walking.distance >= 0.5);
    // A fly's: the floor.
    assert.equal(clutchFrame({x: 0, y: 0, z: 0}, {x: 0.01, y: 0, z: 0}, 0.012, FOV).distance, 0.12);
});
