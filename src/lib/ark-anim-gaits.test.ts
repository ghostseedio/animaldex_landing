// ARK-ANIM (decision 447): hops for rigs with no moving clip, and a flyer's heading and bank from its track.
import assert from "node:assert/strict";
import test from "node:test";
import {HOP_LENGTH, newHopState, stepHop} from "@/ark-scene/hop-gait";
import {BANK_MAX, SLIP, flightHeading, newFlightHeading} from "@/ark-scene/flight-heading";

test("a hop: still on the ground between hops, a forward arc in them, never more than two hops behind", () => {
    const state = newHopState();
    const L = 0.6;
    const dt = 1 / 60;
    let last = 0;
    let s = 0;
    let stillFrames = 0;
    let airFrames = 0;
    let maxBack = 0;
    for (let i = 0; i < 600; i++) {
        s += 0.9 * dt;
        const out = stepHop(state, 0.9 * dt, dt, L);
        const drawn = s - out.back;
        assert.ok(drawn >= last - 1e-9, "never backwards");
        if (!out.air) {
            if (Math.abs(drawn - last) < 1e-9) stillFrames++;
            else assert.fail(`slid ${drawn - last} m on the ground`);
        } else airFrames++;
        maxBack = Math.max(maxBack, out.back);
        last = drawn;
    }
    assert.ok(stillFrames > 30 && airFrames > 100, `${stillFrames} still, ${airFrames} in the air`);
    assert.ok(maxBack <= 2 * HOP_LENGTH * L + 1e-9);
    // It stops: it finishes its hop and stands where its path ended (within a hop's overshoot).
    for (let i = 0; i < 120; i++) stepHop(state, 0, dt, L);
    const settled = stepHop(state, 0, dt, L);
    assert.equal(settled.lift, 0);
    assert.ok(Math.abs(settled.back) < 0.35 * HOP_LENGTH * L, `settled ${settled.back}`);
});

test("on the wing: the body faces its track within SLIP and banks into the turn (left turn, left wing down)", () => {
    const state = newFlightHeading();
    const r = 4;
    const dt = 1 / 60;
    let worst = 0;
    let roll = 0;
    for (let i = 0; i < 400; i++) {
        const a = i * dt * 1.5;
        // A left-hand circle (heading growing), drawn heading pointing backwards along it (the old swallow).
        const x = r * (1 - Math.cos(a));
        const z = r * Math.sin(a);
        const track = a;
        const out = flightHeading(state, x, z, i * dt, track + Math.PI, true);
        if (i > 5) {
            const off = Math.abs(Math.atan2(Math.sin(out.yaw - track), Math.cos(out.yaw - track)));
            worst = Math.max(worst, off);
            roll = out.roll;
        }
    }
    assert.ok(worst <= SLIP + 0.05, `faces its track (worst ${worst})`);
    assert.ok(roll < -0.1 && roll >= -BANK_MAX, `left wing down (roll ${roll})`);
    // Straight and level: no bank.
    const s2 = newFlightHeading();
    let r2 = 1;
    for (let i = 0; i < 200; i++) r2 = flightHeading(s2, i * 0.1, 0, i / 60, Math.PI / 2, true).roll;
    assert.ok(Math.abs(r2) < 1e-3);
    // On the ground: unchanged, no bank.
    assert.deepEqual(flightHeading(s2, 0, 0, 10, 1, false), {yaw: 1, roll: 0});
});

test("a sleeping snake lies coiled: lengths kept along the body, on a flat spiral, wider than one straight body is not", async () => {
    const {Vector3} = await import("three");
    const {laidOnCoil} = await import("@/ark-scene/locomotion/l2-drivers");
    const n = 24;
    const rest = Array.from({length: n}, (_, k) => new Vector3(0, 0.05, 1 - (2 * k) / (n - 1)));
    const out = rest.map((p) => p.clone());
    laidOnCoil(rest, 1, 0.08, out);
    for (let k = 1; k < n; k++) {
        const seg = out[k].distanceTo(out[k - 1]);
        assert.ok(seg <= (2 / (n - 1)) * 1.01 && seg > (2 / (n - 1)) * 0.8, `segment ${k} ${seg}`);
    }
    const xs = out.map((p) => p.x);
    const zs = out.map((p) => p.z);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    assert.ok(span < 1, `a 2 m body coils within ${span} m`);
    assert.ok(out.slice(6).every((p) => Math.abs(p.y - 0.05) < 1e-9), "the coils lie on the ground");
});
