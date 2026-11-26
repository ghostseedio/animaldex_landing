/**
 * Life so far (lane BIO): the read's answer decoded (unknown kinds and fields dropped, nothing about a person kept),
 * newest first, a repeated trip said once, each moment in words, and the switch.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {ARK_MOMENT_KINDS, arkLifeSoFar, arkLifeStoryOn, arkMomentText, arkMomentTone, decodeArkMoments, type ArkMoment} from "@/lib/ark-life-so-far";

const MATE = "fc5a1b8e-b6bc-4933-85f3-079d66992195";
const HERON = "41251c2f-f766-4e34-a24e-72cf71684f41";

// The shape voyage_animal_moments_v1 answered on production for an Amazon Sailfin Catfish (2026-11-26, read-only), trimmed.
const READ = {
    moments: [
        {id: "e26751", kind: "died", at: "2026-11-26T14:00:16Z", ark_day: 460.79, way: "eaten", phrase: "fish", place: {island: "wild"}, predator: "Black-headed Ibis", predator_id: HERON},
        {id: "e26651", kind: "revived", at: "2026-11-26T13:21:00Z", ark_day: 460, cause: "eaten", place: {island: "wild"}},
        {id: "y25827", kind: "young", at: "2026-11-25T23:49:00Z", ark_day: 445, count: 1, from_egg: true, ids: ["33c252d0-05c8-4f8d-adc8-309ce4dec2ab"]},
        {id: "e25050", kind: "escaped", at: "2026-11-25T12:10:16Z", ark_day: 432.76, predator: "Javan Pond Heron", predator_id: "2fee0f16-5017-427c-8ecd-67c5d2d99c9c", place: {island: "wild"}},
        {id: "e24063", kind: "mated", at: "2026-11-24T20:29:00Z", ark_day: 415, eggs: true, young: 1, way: "spawn_pair", partner: {id: MATE, name: "Amazon Sailfin Catfish", status: "present"}},
        {id: "e23860", kind: "went_to_mate", at: "2026-11-24T19:24:00Z", ark_day: 414, distance: 143, way: "water", partner: {id: MATE, name: "Amazon Sailfin Catfish", status: "present"}},
        {id: "e23748", kind: "went_to_mate", at: "2026-11-24T18:02:00Z", ark_day: 413.2, distance: 143, way: "water", partner: {id: MATE, name: "Amazon Sailfin Catfish", status: "present"}},
        {id: "e23747", kind: "went_to_mate", at: "2026-11-24T18:01:00Z", ark_day: 413.1, distance: 143, way: "water", partner: {id: MATE, name: "Amazon Sailfin Catfish", status: "present"}},
        {id: "e6702", kind: "arrived", at: "2026-11-11T20:43:45Z", ark_day: 77.08, source: "capture", captured_on: "2026-01-02", owner: "x", bringer: "@someone"},
        {id: "e1", kind: "laid", at: "2026-11-11T20:43:45Z"},
        {id: "e2", kind: "died", at: "not a date"}
    ],
    total: 13,
    more: false
};

test("decode: known kinds only, newest first, the documented fields only (nothing about a person survives)", () => {
    const read = decodeArkMoments(READ);
    assert.ok(read);
    assert.deepEqual(read.moments.map((m) => m.kind), ["died", "revived", "young", "escaped", "mated", "went_to_mate", "went_to_mate", "went_to_mate", "arrived"]);
    assert.equal(read.total, 13);
    const arrived = read.moments.at(-1)!;
    assert.deepEqual(Object.keys(arrived).sort(), ["area", "arkDay", "at", "id", "island", "kind", "source"]);
    assert.equal(JSON.stringify(read).includes("someone"), false);
    assert.equal(JSON.stringify(read).includes("captured_on"), false);
    assert.equal(read.moments[0].predatorId, HERON);
    assert.equal(read.moments[0].island, "wild");
    assert.equal(decodeArkMoments(null), null);
    assert.equal(decodeArkMoments({moments: "no"}), null);
    assert.deepEqual(decodeArkMoments({moments: [{id: "x", kind: "arrived", at: "2026-11-11T00:00:00Z", partner: {id: "not-a-uuid"}}]})?.moments[0].partner, undefined);
});

test("the list: the same journey to the same mate on one Ark day said once; a later one kept", () => {
    const list = arkLifeSoFar(decodeArkMoments(READ));
    assert.deepEqual(list.map((m) => m.id), ["e26751", "e26651", "y25827", "e25050", "e24063", "e23860", "e23748", "e6702"]);
    assert.deepEqual(arkLifeSoFar(null), []);
});

test("words: each moment, with the hunter, the prey and a mate of another kind named; old age peaceful for a person", () => {
    const list = arkLifeSoFar(decodeArkMoments(READ));
    const say = (m: ArkMoment) => arkMomentText(m, {self: "Amazon Sailfin Catfish"});
    assert.deepEqual(list.map(say), [
        "Eaten by a Black-headed Ibis",
        "Came back for another life",
        "One of its eggs hatched",
        "Escaped a Javan Pond Heron",
        "Mated · eggs on the way",
        "Swam 143 m to find a mate",
        "Swam 143 m to find a mate",
        "Came aboard with a capture"
    ]);
    const at = Date.parse("2026-11-20T00:00:00Z");
    const base = {at, arkDay: 1, island: null, area: null} as const;
    assert.equal(arkMomentText({...base, id: "a", kind: "meal", prey: "Arctic Hare"}), "Caught an Arctic Hare");
    assert.equal(arkMomentText({...base, id: "a", kind: "meal", prey: "Fly", trap: "web"}), "Caught a Fly in its web");
    assert.equal(arkMomentText({...base, id: "a", kind: "meal", prey: "Zebra", carcass: true}), "Fed on a Zebra carcass");
    assert.equal(arkMomentText({...base, id: "a", kind: "meal"}), "Had a meal");
    assert.equal(arkMomentText({...base, id: "a", kind: "mated", partner: {id: MATE, name: "Donkey"}, young: 2}, {self: "Horse"}), "Mated with a Donkey · 2 young on the way");
    assert.equal(arkMomentText({...base, id: "a", kind: "mated", first: true, young: 1}), "First mating · a young one on the way");
    assert.equal(arkMomentText({...base, id: "a", kind: "young", count: 3}), "Had 3 young");
    assert.equal(arkMomentText({...base, id: "a", kind: "went_to_mate", distance: 1250, way: "fly"}), "Flew 1,250 m to find a mate");
    assert.equal(arkMomentText({...base, id: "a", kind: "cache_stolen", role: "thief", other: {id: MATE, name: "Eurasian Jay"}}), "Raided a Eurasian Jay's food store");
    assert.equal(arkMomentText({...base, id: "a", kind: "cache_stolen", role: "victim", other: {id: MATE, name: "Red Squirrel"}}), "Its food store was raided by a Red Squirrel");
    assert.equal(arkMomentText({...base, id: "a", kind: "escaped", predator: "Lion", shelter: true}), "Escaped a Lion in a shelter");
    assert.equal(arkMomentText({...base, id: "a", kind: "died", way: "death_old"}, {human: true}), "Died peacefully of old age");
    assert.equal(arkMomentText({...base, id: "a", kind: "died", way: "deforested"}), "Lost its home to logging");
    assert.equal(arkMomentText({...base, id: "a", kind: "born", fromEgg: true}), "Hatched on the Ark");
    assert.equal(arkMomentText({...base, id: "a", kind: "arrived", source: "step"}), "Came aboard after a step that worked");
    assert.equal(arkMomentText({...base, id: "a", kind: "died", way: "death_old"}, {words: {diedOld: "Starb an Altersschwäche"}}), "Starb an Altersschwäche");
    // Every kind says something, and has a tone.
    for (const kind of ARK_MOMENT_KINDS) {
        const m = {...base, id: kind, kind} as ArkMoment;
        assert.ok(arkMomentText(m).length > 2, kind);
        assert.ok(arkMomentTone(m), kind);
    }
});

test("the switch: off by default; on with ?lifestory (not ?lifestory=0) or the global", () => {
    const g = globalThis as {__arkLifeStory?: boolean; location?: unknown};
    const before = g.location;
    try {
        g.location = {search: ""};
        assert.equal(arkLifeStoryOn(), false);
        g.location = {search: "?lifestory"};
        assert.equal(arkLifeStoryOn(), true);
        g.location = {search: "?x=1&lifestory=1"};
        assert.equal(arkLifeStoryOn(), true);
        g.location = {search: "?lifestory=0"};
        assert.equal(arkLifeStoryOn(), false);
        g.__arkLifeStory = true;
        assert.equal(arkLifeStoryOn(), true);
    } finally {
        delete g.__arkLifeStory;
        g.location = before;
    }
});
