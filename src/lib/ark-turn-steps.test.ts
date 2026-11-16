/**
 * A walker turning on the spot steps round (graphics pass 1, lane PLACE; the owner, 2026-11-16: "horses seem to spin
 * around on one spot"). The schedule turns a walker on the spot before it sets off well away from the way it faces
 * (`behaviour-schedule.ts`, TURN_RATE): its gait (`rig-player.ts` stepGait, turnSteps) now counts the feet's arc as
 * steps, so the rig plays its walk and the cheap gait bobs, instead of the body pivoting with its feet still.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {gaitMoving, stepGait, turnSteps} from "@/ark-scene/rig-player";
import {TURN_RATE} from "@/ark-scene/behaviour-schedule";

test("a horse's half turn on the spot is a walk; standing, a slow drift of its heading or a cut is not", () => {
    const length = 2.4;
    const dt = 1 / 60;
    // The schedule's turn on the spot: half a turn at TURN_RATE.
    let g = stepGait(null, 5, 5, 0, length, 0);
    let moving = 0;
    const frames = Math.round(Math.PI / TURN_RATE / dt);
    for (let i = 1; i <= frames; i++) {
        g = stepGait(g, 5, 5, dt, length, (i / frames) * Math.PI);
        if (i > frames / 3 && gaitMoving(g, length)) moving++;
    }
    assert.ok(moving > (frames * 2) / 3 * 0.9, `stepping through the turn: ${moving} of ${Math.round((frames * 2) / 3)} frames`);
    assert.ok(g.phase > 0.5, `its feet went round: ${g.phase.toFixed(2)} cycles`);
    // Standing still, its heading still: no step.
    let still = stepGait(null, 0, 0, 0, length, 1);
    for (let i = 0; i < 120; i++) still = stepGait(still, 0, 0, dt, length, 1);
    assert.equal(gaitMoving(still, length), false);
    // A slow drift of its heading (an idle look, 0.2 rad/s): no step.
    let drift = stepGait(null, 0, 0, 0, length, 0);
    for (let i = 0; i < 120; i++) drift = stepGait(drift, 0, 0, dt, length, i * dt * 0.2);
    assert.equal(gaitMoving(drift, length), false);
    // A cut (a new heading at once): no step.
    assert.equal(turnSteps(Math.PI * 0.9, dt, length), 0);
    // (Across the wrap: the short way round.)
    assert.ok(Math.abs(turnSteps(Math.PI * 2 - 0.05, dt, length) - 0.05 * 0.35 * length) < 1e-9);
    // Without a heading (afloat): as before, by its path only.
    let swim = stepGait(null, 0, 0, 0, length);
    for (let i = 0; i < 60; i++) swim = stepGait(swim, 0, 0, dt, length);
    assert.equal(gaitMoving(swim, length), false);
});
