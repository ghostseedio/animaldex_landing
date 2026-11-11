import assert from "node:assert/strict";
import test from "node:test";
import {ARK_TIME_PERIOD, ARK_TIME_REBASE_AFTER, arkAnimalClock, arkEpochSeconds, ArkShaderClock, arkWholeCycles, arkWholeLoops, arkWindowSeconds, pinArkClock} from "@/ark-scene/shared-clock";

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
/** A term's phase, mod a cycle. */
const phase = (angular: number, t: number) => ((angular * t) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

test("shared clock: two viewers who opened at different times see the same phase of every whole-cycle term", () => {
    const now = 1_800_000_123.25;
    const early = new ArkShaderClock(now - 5_000);
    const late = new ArkShaderClock(now - 7);
    // Each viewer's number is small (precision), different, and apart by whole windows.
    assert.ok(late.seconds(now) < ARK_TIME_PERIOD);
    assert.ok(near((early.seconds(now) - late.seconds(now)) % ARK_TIME_PERIOD, 0));
    // The foliage's sway at 1.5 rad/s, aligned to the window: the same phase on both screens.
    const sway = arkWholeCycles(1.5);
    assert.ok(near(phase(sway, early.seconds(now)), phase(sway, late.seconds(now)), 1e-6));
    // Unaligned, it would differ (what the old per-page clock did to everyone).
    assert.ok(!near(phase(1.5, early.seconds(now)), phase(1.5, late.seconds(now)), 1e-3));
    // And the CPU twins that only take the window's seconds (fish schools, sway) agree with the shader's time.
    assert.ok(near(phase(sway, arkWindowSeconds(now)), phase(sway, late.seconds(now)), 1e-6));
});

test("shared clock: no wrap while seen; brought down only at an unseen moment, past an hour, to a whole window", () => {
    const opened = 1_800_000_000;
    const clock = new ArkShaderClock(opened);
    // Continuous across what would have been a wrap.
    assert.ok(near(clock.seconds(opened + 599.99) + 0.02, clock.seconds(opened + 600.01)));
    assert.equal(clock.rebase(opened + 1800), false, "under an hour: left alone");
    const later = opened + ARK_TIME_REBASE_AFTER + 1234.5;
    const before = clock.seconds(later);
    assert.equal(clock.rebase(later), true);
    const after = clock.seconds(later);
    assert.ok(after < ARK_TIME_PERIOD);
    assert.ok(near((before - after) % ARK_TIME_PERIOD, 0), "the jump is whole windows: aligned terms do not move");
});

test("shared clock: whole cycles and loops round to the window by a hair; the pin runs on", () => {
    for (const f of [1.5, 2.9, 6.3, 5.1, 5.7, 1.25, 2.6, 7.1, 6.7, 0.42, 2.2, 1.8]) {
        const aligned = arkWholeCycles(f);
        assert.ok(Math.abs(aligned - f) / f < 0.01, `${f} -> ${aligned}`);
        assert.ok(near((aligned * ARK_TIME_PERIOD) / (2 * Math.PI) % 1, 0, 1e-9) || near((aligned * ARK_TIME_PERIOD) / (2 * Math.PI) % 1, 1, 1e-9));
    }
    assert.equal(arkWholeLoops(0.11) * ARK_TIME_PERIOD, 66);
    assert.equal(arkAnimalClock(3600 * 5 + 12), 12);
    pinArkClock(1_234_567);
    assert.ok(arkEpochSeconds() >= 1_234_567 && arkEpochSeconds() < 1_234_568);
    pinArkClock(null);
    assert.ok(Math.abs(arkEpochSeconds() - Date.now() / 1000) < 1);
});
