import assert from "node:assert/strict";
import test from "node:test";
import {ARK_SEE_IT_HOLD_MAX_MS, ARK_SEE_IT_LANDING_MS, arkArrivalActOf, arkSeeIt, arkSeeItPlan, type ArkSeeItScene} from "@/ark-scene/see-it";
import type {ArkAnimal, ArkReplayRun} from "@/ark-scene/types";

/**
 * "See it in the Ark": one entry for the web page and both apps. An animal id opens the Ark on that animal; `follow`
 * keeps the camera on it; `arrival` (the first time a person's animal comes aboard) acts the arrival out first, then
 * comes close and follows. Nothing here finds an animal: the host gives the id and the snapshot's animal.
 */

const wolf = {
    id: "5b0f2a9e-0f6e-4c1a-9a43-3a2d4f1b7c11",
    species_profile_id: "11111111-2222-4333-8444-555555555555",
    name: "Gray Wolf",
    scientific_name: null,
    model_slug: "gray-wolf",
    zone: "forest",
    arrived_at: "2026-11-17T09:30:00Z",
    brought_by: {label: "Voyager 4", named: false},
    mine: true,
    origin: "arrived"
} as unknown as ArkAnimal;

function recorder(options: {play?: boolean; mounted?: boolean; playReturnsNothing?: boolean} = {}) {
    const calls: string[] = [];
    let finish: () => void = () => undefined;
    const scene: ArkSeeItScene = {
        select: (id, closeUp) => void calls.push(`select:${id}:${closeUp ? "close" : "wide"}`),
        follow: (id) => void calls.push(`follow:${id}`)
    };
    if (options.play !== false) {
        scene.play = (acts) => {
            calls.push(`play:${acts.map((act) => act.kind).join(",")}`);
            if (options.playReturnsNothing) return undefined;
            const done = new Promise<void>((resolve) => {
                finish = resolve;
            });
            return {skip: () => undefined, done} satisfies ArkReplayRun;
        };
    }
    if (options.mounted) scene.mounted = () => Promise.resolve().then(() => void calls.push("mounted"));
    return {scene, calls, finish: () => finish()};
}

const later = () => new Promise<void>((resolve) => setImmediate(resolve));

test("an animal id alone is a plain selection, as before", () => {
    const r = recorder();
    arkSeeIt(r.scene, {id: wolf.id, closeUp: true}, wolf);
    assert.deepEqual(r.calls, [`select:${wolf.id}:close`]);
});

test("follow selects it and then follows it", () => {
    const r = recorder();
    arkSeeIt(r.scene, {id: wolf.id, closeUp: true, follow: true}, wolf);
    assert.deepEqual(r.calls, [`select:${wolf.id}:close`, `follow:${wolf.id}`]);
});

test("no id clears the selection and follows nothing", () => {
    const r = recorder();
    arkSeeIt(r.scene, {id: null, follow: true, arrival: true}, wolf);
    assert.deepEqual(r.calls, ["select:null:wide"]);
});

test("the arrival acts first, and only once it is over comes close and follows", async () => {
    const r = recorder({mounted: true});
    arkSeeIt(r.scene, {id: wolf.id, follow: true, arrival: true}, wolf);
    await later();
    assert.deepEqual(r.calls, ["mounted", "play:arrival"], "the act plays after the scene is built, with no selection yet");
    r.finish();
    await later();
    assert.deepEqual(r.calls, ["mounted", "play:arrival", `select:${wolf.id}:close`, `follow:${wolf.id}`]);
});

test("the arrival's end is always close and followed, even when the host asked for neither", async () => {
    const r = recorder();
    arkSeeIt(r.scene, {id: wolf.id, arrival: true}, wolf);
    r.finish();
    await later();
    assert.deepEqual(r.calls.slice(-2), [`select:${wolf.id}:close`, `follow:${wolf.id}`]);
});

test("reduced motion has no acting out: the plain close look, followed", () => {
    const r = recorder();
    arkSeeIt(r.scene, {id: wolf.id, closeUp: true, follow: true, arrival: true}, wolf, true);
    assert.deepEqual(r.calls, [`select:${wolf.id}:close`, `follow:${wolf.id}`]);
});

test("an animal the snapshot does not hold is selected and held by the scene, never acted", () => {
    const r = recorder();
    arkSeeIt(r.scene, {id: wolf.id, follow: true, arrival: true}, null);
    assert.deepEqual(r.calls, [`select:${wolf.id}:wide`, `follow:${wolf.id}`]);
    const other = recorder();
    arkSeeIt(other.scene, {id: "someone-else", follow: true, arrival: true}, wolf);
    assert.ok(!other.calls.some((call) => call.startsWith("play")), "another animal's snapshot row is not this one");
});

test("a scene that cannot act it (no play, or play answers nothing) falls back to the close look, followed", () => {
    const none = recorder({play: false});
    arkSeeIt(none.scene, {id: wolf.id, arrival: true}, wolf);
    assert.deepEqual(none.calls, [`select:${wolf.id}:close`, `follow:${wolf.id}`]);
    const silent = recorder({playReturnsNothing: true});
    arkSeeIt(silent.scene, {id: wolf.id, arrival: true}, wolf);
    assert.deepEqual(silent.calls, ["play:arrival", `select:${wolf.id}:close`, `follow:${wolf.id}`]);
});

test("a scene that fails to build still selects and follows", async () => {
    const calls: string[] = [];
    const scene: ArkSeeItScene = {
        select: (id) => void calls.push(`select:${id}`),
        follow: (id) => void calls.push(`follow:${id}`),
        play: () => undefined,
        mounted: () => Promise.reject(new Error("no webgl"))
    };
    arkSeeIt(scene, {id: wolf.id, arrival: true}, wolf);
    await later();
    assert.deepEqual(calls, [`select:${wolf.id}`, `follow:${wolf.id}`]);
});

test("the arrival act names the animal as the replay's acts do", () => {
    const act = arkArrivalActOf(wolf);
    assert.equal(act.kind, "arrival");
    if (act.kind !== "arrival") return;
    assert.equal(act.at, wolf.arrived_at);
    assert.equal(act.animal.id, wolf.id);
    assert.equal(act.animal.model_slug, "gray-wolf");
    assert.equal(act.animal.status, "present");
    assert.equal(act.animal.origin, "arrived");
});

test("the plan: arrival only for the animal asked, follow and close come with it", () => {
    assert.deepEqual(arkSeeItPlan({id: wolf.id, arrival: true}, wolf, false).follow, true);
    assert.equal(arkSeeItPlan({id: wolf.id, arrival: true}, wolf, false).act?.kind, "arrival");
    assert.equal(arkSeeItPlan({id: wolf.id}, wolf, false).act, null);
    assert.equal(arkSeeItPlan({id: wolf.id, arrival: true}, null, false).act, null);
    assert.equal(arkSeeItPlan({id: wolf.id, arrival: true}, wolf, true).act, null);
});

/** A clock the test turns by hand: what was asked to run later runs when time reaches it. */
function handClock() {
    let now = 1_000_000;
    const queue: Array<{at: number; run: () => void}> = [];
    return {
        clock: {now: () => now, later: (run: () => void, ms: number) => void queue.push({at: now + ms, run})},
        advance(ms: number) {
            const until = now + ms;
            while (true) {
                queue.sort((a, b) => a.at - b.at);
                const next = queue[0];
                if (!next || next.at > until) break;
                queue.shift();
                now = next.at;
                next.run();
            }
            now = until;
        }
    };
}

function staged(options: {flightHeldFor?: number} = {}) {
    const calls: string[] = [];
    const time = handClock();
    const startedAt = time.clock.now();
    const scene: ArkSeeItScene = {
        select: (id, closeUp) => void calls.push(`select:${id}:${closeUp ? "close" : "wide"}`),
        follow: (id) => void calls.push(`follow:${id}`),
        hold: (id) => void calls.push(`hold:${id}`),
        arrive: (id) => void calls.push(`arrive:${id}`),
        // The flight is held (the animal cannot be drawn yet) for the first `flightHeldFor` ms.
        flightHeld: () => (time.clock.now() - startedAt < (options.flightHeldFor ?? 0) ? {steps: 3, done: 1} : null)
    };
    return {scene, calls, time};
}

test("the arrival holds the animal out of sight, flies close, and brings it aboard only once the camera has landed", () => {
    const r = staged();
    arkSeeIt(r.scene, {id: wolf.id, follow: true, arrival: true}, wolf, false, r.time.clock);
    assert.deepEqual(r.calls, [`hold:${wolf.id}`, `select:${wolf.id}:close`, `follow:${wolf.id}`], "held first, never seen arriving from afar");
    r.time.advance(400 + ARK_SEE_IT_LANDING_MS - 200);
    assert.ok(!r.calls.includes(`arrive:${wolf.id}`), "still flying");
    r.time.advance(600);
    assert.equal(r.calls.filter((call) => call.startsWith("arrive")).length, 1, "aboard once, in front of the camera");
    r.time.advance(10_000);
    assert.equal(r.calls.filter((call) => call.startsWith("arrive")).length, 1, "never twice");
});

test("a flight held for the animal's models counts from when it is let go, not from the ask", () => {
    const r = staged({flightHeldFor: 9_000});
    arkSeeIt(r.scene, {id: wolf.id, arrival: true}, wolf, false, r.time.clock);
    r.time.advance(9_000 + ARK_SEE_IT_LANDING_MS - 300);
    assert.ok(!r.calls.includes(`arrive:${wolf.id}`), "the camera has not landed yet");
    r.time.advance(700);
    assert.ok(r.calls.includes(`arrive:${wolf.id}`));
});

test("an animal the scene never lets the camera reach still comes aboard after the longest wait", () => {
    const r = staged({flightHeldFor: Number.MAX_SAFE_INTEGER});
    arkSeeIt(r.scene, {id: wolf.id, arrival: true}, wolf, false, r.time.clock);
    r.time.advance(ARK_SEE_IT_HOLD_MAX_MS - 1000);
    assert.ok(!r.calls.includes(`arrive:${wolf.id}`));
    r.time.advance(2000);
    assert.ok(r.calls.includes(`arrive:${wolf.id}`), "never held out of sight for good");
});
