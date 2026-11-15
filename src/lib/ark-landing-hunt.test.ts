/**
 * The home page's meals figure never shows a bare 0 while no predator is due (owner 2026-11-15): the soonest hunt from
 * `voyage_hunting_v1`, and the line said in the 0's place.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {arkLandingHunt, decodeArkHunting} from "@/lib/ark-hunting";
import {arkMealsWait} from "@/lib/ark-landing";

const START = "2026-11-08T21:45:21.431Z";
const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const WORDS = {firstOn: "First hunts from {date}", firstIn: "First hunt in {duration}", nextOn: "Next hunts from {date}", nextIn: "Next hunt in {duration}"};

function read(extra: Record<string, unknown>) {
    return decodeArkHunting({hunting: "encounter", started_at: START, ark_day: 158.82, ticked_to: 156.75, predators: [[A, 1108.2], [B, 294.4375]], meals: [], ...extra});
}

test("no predator due: waiting until the soonest hunt_from, as a real time (production 2026-11-15: 20 Nov 04:47 UTC)", () => {
    const hunt = arkLandingHunt(read({}), false);
    assert.equal(hunt?.state, "waiting");
    assert.ok(hunt && hunt.state === "waiting");
    assert.equal(hunt.first, true);
    assert.equal(hunt.at.slice(0, 16), "2026-11-20T04:47");
    const now = Date.parse("2026-11-15T09:00:00Z");
    assert.equal(arkMealsWait(hunt, now, "en-GB", WORDS, "UTC"), "First hunts from 20\u00a0Nov");
    assert.equal(arkMealsWait({...hunt, first: false}, now, "en-GB", WORDS, "UTC"), "Next hunts from 20\u00a0Nov");
});

test("within a day: how long until it; once the time has come, nothing is promised", () => {
    const at = "2026-11-20T04:46:00Z";
    const near = Date.parse(at) - 3 * 3_600_000 - 600_000;
    // (No breaking space inside the duration: Intl's own non-breaking spaces, or ours.)
    const spaced = (line: string | null) => line?.replace(/[\u00a0\u202f]/g, "_");
    assert.equal(spaced(arkMealsWait({state: "waiting", at, first: false}, near, "en", WORDS)), "Next hunt in 3_hr");
    assert.equal(spaced(arkMealsWait({state: "waiting", at, first: true}, Date.parse(at) - 20 * 60_000, "en", WORDS)), "First hunt in 20_min");
    assert.equal(arkMealsWait({state: "waiting", at, first: true}, Date.parse(at) + 1, "en", WORDS), null);
});

test("a 0 that is a real count, or no read: no line", () => {
    assert.deepEqual(arkLandingHunt(read({ark_day: 300}), false), {state: "counting"});
    assert.deepEqual(arkLandingHunt(read({hunting: "pool"}), false), {state: "counting"});
    assert.deepEqual(arkLandingHunt(read({predators: []}), false), {state: "counting"});
    assert.equal(arkLandingHunt(null, false), null);
    assert.equal(arkLandingHunt(read({ark_day: null}), false), null);
    assert.equal(arkMealsWait({state: "counting"}, Date.now(), "en", WORDS), null);
    assert.equal(arkMealsWait(null, Date.now(), "en", WORDS), null);
});

test("hunts have begun once an encounter meal is in the log or the read", () => {
    const seen = arkLandingHunt(read({}), true);
    assert.ok(seen?.state === "waiting" && !seen.first);
    const recent = arkLandingHunt(read({meals: [{id: 1, ark_day: 150, predator: A, prey: B, encounter: {t: 1, predator: {x: 0, z: 0}, prey: {x: 1, z: 1, r: 1}}}]}), false);
    assert.ok(recent?.state === "waiting");
});
