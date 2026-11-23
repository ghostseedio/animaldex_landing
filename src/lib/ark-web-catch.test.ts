import assert from "node:assert/strict";
import test from "node:test";
import {catchAt, catchTimes, type CatchGeometry} from "@/ark-scene/web-catch";

const g: CatchGeometry = {hub: {x: 0, y: 1, z: 0}, at: {x: 0.15, y: 0.9, z: 0}, normal: {x: 0, y: 0, z: 1}, rest: {x: 0, y: -1, z: 0}};

test("a web's catch goes in, held, run, bite, wrap, home, feed, in that order, and the same for every viewer", () => {
    const times = catchTimes(g, "seed-1");
    assert.ok(times.stuck < times.run && times.run < times.bite && times.bite < times.wrap && times.wrap < times.haul && times.haul < times.home && times.home < times.feedTo);
    const phases: string[] = [];
    for (let t = 0; t < times.feedTo + 4; t += 0.05) {
        const p = catchAt(g, times, "seed-1", t).phase;
        if (phases[phases.length - 1] !== p) phases.push(p);
    }
    assert.deepEqual(phases, ["in", "stuck", "run", "bite", "wrap", "haul", "feed", "done"]);
    assert.deepEqual(catchAt(g, times, "seed-1", 5.3), catchAt(g, times, "seed-1", 5.3));
});

test("held: the insect is at its point on the silk, the web shakes, the spider stays at its hub until it runs", () => {
    const times = catchTimes(g, "s");
    const f = catchAt(g, times, "s", (times.stuck + times.run) / 2);
    assert.equal(f.phase, "stuck");
    assert.deepEqual({x: f.prey.x, y: f.prey.y, z: f.prey.z}, g.at);
    assert.ok(f.shake > 0.3);
    assert.deepEqual({x: f.spider.x, y: f.spider.y, z: f.spider.z}, g.hub);
});

test("the wrap builds a white bundle at the insect; the spider carries it back and feeds at the hub", () => {
    const times = catchTimes(g, "s");
    const mid = catchAt(g, times, "s", (times.wrap + times.haul) / 2);
    assert.equal(mid.phase, "wrap");
    assert.ok(mid.bundle && mid.bundle.size > 0.3 && mid.bundle.size < 1);
    const fed = catchAt(g, times, "s", times.home + 1);
    assert.equal(fed.phase, "feed");
    assert.ok(Math.hypot(fed.spider.x - g.hub.x, fed.spider.y - g.hub.y) < 1e-9);
    assert.ok(fed.bundle && Math.hypot(fed.bundle.x - g.hub.x, fed.bundle.y - g.hub.y) < 0.02);
    assert.equal(fed.prey.hidden, true);
});

test("a miss: the insect breaks free and flies off; the spider never reaches it and goes back", () => {
    const times = catchTimes(g, "m");
    for (let t = 0; t < times.bite + 3; t += 0.05) {
        const f = catchAt(g, times, "m", t, true);
        assert.ok(f.bundle === null);
        assert.ok(Math.hypot(f.spider.x - g.at.x, f.spider.y - g.at.y) > 0.03 || t < times.run);
    }
    assert.equal(catchAt(g, times, "m", times.bite + 2.5, true).prey.flying, true);
});

test("the read's web catch: a town meal's trap, a wild meal's encounter.web; any other meal is not one", async () => {
    const {decodeArkEvents} = await import("./ark-life");
    const spider = {id: "s1", name: "Common House Spider", species_profile_id: "sp", model_slug: "common-house-spider", zone: "farm_garden"};
    const fly = {id: "f1", name: "House Fly", species_profile_id: "fl", model_slug: "house-fly", zone: "farm_garden"};
    const events = decodeArkEvents({events: [
        {id: 1, kind: "meal", at: "2026-11-25T10:00:00Z", animal: spider, other: fly, trap: "web"},
        {id: 2, kind: "meal", at: "2026-11-25T10:01:00Z", animal: spider, other: fly, encounter: {predator: {x: 0, z: 0}, prey: {x: 0.2, z: 0, r: 1}, web: true}},
        {id: 3, kind: "meal", at: "2026-11-25T10:02:00Z", animal: spider, other: fly},
        {id: 4, kind: "arrival", at: "2026-11-25T10:03:00Z", animal: spider, trap: "web"}
    ]}, null);
    assert.deepEqual(events.map((e) => e.web ?? null), [true, true, null, null]);
});
