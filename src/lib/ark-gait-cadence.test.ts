// SPECIES-ANIM-A: the gait cadence cap by body size (gait-cadence.ts).
import assert from "node:assert/strict";
import test from "node:test";
import {GAIT_HZ_FULL_LENGTH, GAIT_HZ_MAX, GAIT_HZ_MAX_SMALL, gaitHzMax} from "@/ark-scene/gait-cadence";

test("half a metre and longer: decision 447's 6 Hz, unchanged (the eastern blue-tongued skink, 0.525 m, among them)", () => {
    for (const m of [GAIT_HZ_FULL_LENGTH, 0.525, 0.67, 1.2, 3, 25]) assert.equal(gaitHzMax(m), GAIT_HZ_MAX);
});

test("an unknown length keeps 6 Hz", () => {
    for (const m of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(gaitHzMax(m), GAIT_HZ_MAX);
});

test("smaller animals stride faster, as 1/√L, never above 10 Hz", () => {
    let last = gaitHzMax(GAIT_HZ_FULL_LENGTH);
    for (let m = 0.49; m > 0.001; m *= 0.9) {
        const hz = gaitHzMax(m);
        assert.ok(hz >= last - 1e-12, `${m} m: ${hz} after ${last}`);
        assert.ok(hz <= GAIT_HZ_MAX_SMALL);
        last = hz;
    }
    assert.equal(gaitHzMax(0.1), GAIT_HZ_MAX_SMALL);
    assert.ok(Math.abs(gaitHzMax(0.25) - 6 * Math.SQRT2) < 1e-9);
});

test("the rodents whose run slid at 6 Hz play their own run with the feet planted", () => {
    // [true length m (species-stats.json lengths), the re-baked run's cycle seconds]
    const runs: Record<string, [number, number]> = {"golden-hamster": [0.15, 0.12], "guinea-pig": [0.25, 0.12], "black-rat": [0.18, 0.132]};
    for (const [slug, [m, seconds]] of Object.entries(runs)) assert.ok(gaitHzMax(m) * seconds >= 1, `${slug}: ${gaitHzMax(m)} Hz`);
});
