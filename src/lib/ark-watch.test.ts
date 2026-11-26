import assert from "node:assert/strict";
import test from "node:test";

import {ARK_WATCH_AGAIN, ARK_WATCH_GRACE, ARK_WATCH_HIDDEN, ARK_WATCH_HIDDEN_AGAIN, ARK_WATCH_HOLD, ARK_WATCH_MOST, ARK_WATCH_PREEMPT, arkWatchGiveUp, arkWatchNext, arkWatchParam, arkWatchRanked, arkWatchScore, arkWatchStart, type ArkWatchCandidate} from "@/lib/ark-watch";

const c = (id: string, kind: ArkWatchCandidate["kind"], weight = 1, since = 0): ArkWatchCandidate => ({id, kind, weight, since});

test("the rank: a hunt, a birth, a chase, a mate, rivals, a signature; a hunter by its catch chance", () => {
    const order = arkWatchRanked([c("s", "signature"), c("r", "rivals"), c("m", "mate"), c("e", "chase"), c("b", "birth"), c("h", "hunt", 0.2)]).map((x) => x.id);
    assert.deepEqual(order, ["h", "b", "e", "m", "r", "s"]);
    assert.ok(arkWatchScore(c("a", "hunt", 0.9)) > arkWatchScore(c("b", "hunt", 0.5)));
    // (One per subject, its best; the newer of two equal ones first.)
    assert.deepEqual(arkWatchRanked([c("x", "signature"), c("x", "birth"), c("y", "birth", 1, 5)]).map((x) => `${x.id}:${x.kind}`), ["y:birth", "x:birth"]);
});

test("nothing happening: no cut, the view stays", () => {
    const step = arkWatchNext(arkWatchStart(), [], 0);
    assert.equal(step.cut, null);
    assert.equal(step.state.shot, null);
});

test("a shot is held at least the minimum, whatever starts", () => {
    let {state, cut} = arkWatchNext(arkWatchStart(), [c("a", "mate")], 0);
    assert.equal(cut?.id, "a");
    // A signature starting (lower) and a better mate: held.
    ({state, cut} = arkWatchNext(state, [c("a", "mate", 0.5), c("b", "mate", 1)], ARK_WATCH_HOLD - 1));
    assert.equal(cut, null);
    // A stronger kind takes over once the pre-empt time is past, never before.
    assert.equal(arkWatchNext(state, [c("a", "mate"), c("h", "hunt")], ARK_WATCH_PREEMPT - 0.5).cut, null);
    assert.equal(arkWatchNext(state, [c("a", "mate"), c("h", "hunt")], ARK_WATCH_PREEMPT).cut?.id, "h");
});

test("its act over: a short grace, then the next; with nothing else, it holds", () => {
    let {state} = arkWatchNext(arkWatchStart(), [c("a", "birth")], 0);
    let step = arkWatchNext(state, [c("b", "signature")], ARK_WATCH_HOLD + 1);
    assert.equal(step.cut, null, "the grace");
    state = step.state;
    step = arkWatchNext(state, [c("b", "signature")], ARK_WATCH_HOLD + 1 + ARK_WATCH_GRACE);
    assert.equal(step.cut?.id, "b");
    assert.equal(arkWatchNext({...state}, [], 999).cut, null);
});

test("past the longest hold it moves on, and does not cut straight back", () => {
    let {state} = arkWatchNext(arkWatchStart(), [c("a", "hunt")], 0);
    // Held: "b" is lower and "a" is still on.
    assert.equal(arkWatchNext(state, [c("a", "hunt"), c("b", "signature")], ARK_WATCH_MOST - 1).cut, null);
    const moved = arkWatchNext(state, [c("a", "hunt"), c("b", "signature")], ARK_WATCH_MOST);
    assert.equal(moved.cut?.id, "b");
    state = moved.state;
    // "a" is better, but just left: "b" is held to its longest, then "c" (fresh) before "a".
    const t = ARK_WATCH_MOST * 2;
    assert.equal(arkWatchNext(state, [c("a", "hunt"), c("b", "signature"), c("c", "rivals")], t).cut?.id, "c");
    // After a while "a" may come back.
    assert.ok(ARK_WATCH_AGAIN > ARK_WATCH_MOST);
});

test("the address switch", () => {
    assert.equal(arkWatchParam("?watch=1"), "on");
    assert.equal(arkWatchParam("?watch=0"), "off");
    assert.equal(arkWatchParam("?x=1"), null);
    assert.equal(arkWatchParam(null), null);
});

test("a subject hidden from the camera is given up: the next other, and never it again for a while", () => {
    let {state} = arkWatchNext(arkWatchStart(), [c("a", "hunt")], 0);
    state = arkWatchGiveUp(state, 5);
    assert.equal(state.shot, null);
    // The hunt is still the best on, but hidden: the lower one instead.
    assert.equal(arkWatchNext(state, [c("a", "hunt"), c("b", "signature")], 6).cut?.id, "b");
    // With only it on: nothing (the caller goes back to the island's view), until the while is over.
    assert.equal(arkWatchNext(state, [c("a", "hunt")], 6).cut, null);
    assert.equal(arkWatchNext(state, [c("a", "hunt")], 5 + ARK_WATCH_HIDDEN_AGAIN).cut?.id, "a");
    assert.ok(ARK_WATCH_HIDDEN < ARK_WATCH_HOLD);
});
