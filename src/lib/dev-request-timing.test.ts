import assert from "node:assert/strict";
import test from "node:test";

test("dev perf timer records steps", async () => {
    const timing = await import("@/lib/dev-request-timing");
    const timer = timing.createDevRequestTimer("test.timer");
    if (!timer) return;

    await timing.timeDevStep(timer, "fast", () => undefined);
    await timing.timeDevStep(timer, "slow", async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
    });

    timing.finishDevRequestTimer(timer);
    assert.equal(timer.steps.length, 2);
});
