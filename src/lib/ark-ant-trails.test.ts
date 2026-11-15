import assert from "node:assert/strict";
import test from "node:test";
import {antColony, antPose, antSpec, forgetAntColonies, type AntGround} from "@/ark-scene/ant-trails";
import type {AttachPoint} from "@/ark-scene/map/sampler";

const flat: AntGround = {heightAt: (x, z) => 0.02 * x + 0.01 * z, walkable: () => true};
const nest = (id: string, extra: Partial<AttachPoint> = {}): AttachPoint => ({id, tag: "worm_hole", x: 10, y: 0.2, z: 0, normal: [0, 1, 0], tangent: [0, 0, 1], size: {min: 0, max: 1}, zone: "rainforest", ...extra});
const always = () => true;
const T0 = Date.parse("2026-11-15T00:00:00Z") / 1000;

test("ants: the kinds aboard that lay trails, and the Sahara desert ant forages alone", () => {
    for (const slug of ["asian-weaver-ant", "big-headed-ant", "carpenter-ant", "silky-carpenter-ant", "ghost-ant", "red-imported-fire-ant"]) assert.equal(antSpec(slug)?.foraging, "trail", slug);
    assert.equal(antSpec("sahara-desert-ant")?.foraging, "solo");
    // Not ants (a velvet ant is a wasp; an ant-mimic mantis is a mantis).
    assert.equal(antSpec("red-velvet-ant"), null);
    assert.equal(antSpec("ant-mimic-mantis"), null);
});

test("ants: a colony's trail is pure in its colony, and every forager moves without a jump", () => {
    forgetAntColonies();
    const a = antColony("big-headed-ant", "rainforest", 218, nest("n1"), 0.003, flat)!;
    forgetAntColonies();
    const b = antColony("big-headed-ant", "rainforest", 218, nest("n1"), 0.003, flat)!;
    assert.deepEqual(a, b);
    assert.ok(a.ground && a.length >= 1.4 && a.length <= 5, `a ground trail of a few metres (${a.length})`);
    for (let rank = 0; rank < 4; rank++) {
        let prev = antPose(a, `ant${rank}`, rank, 0.003, T0, always, flat);
        let out = 0;
        for (let t = T0 + 0.25; t < T0 + 3 * a.period; t += 0.25) {
            const now = antPose(a, `ant${rank}`, rank, 0.003, t, always, flat);
            const step = Math.hypot(now.x - prev.x, now.z - prev.z);
            assert.ok(step <= a.spec.speed * 0.25 * 1.6 + 1e-6, `no jump: ${step.toFixed(4)} m in 0.25 s (rank ${rank})`);
            assert.ok(Math.abs(now.y - flat.heightAt(now.x, now.z)) < 1e-9, "on the ground");
            if (now.leg !== "nest") out++;
            prev = now;
        }
        assert.ok(out > 0, "it goes out");
    }
});

test("ants: foragers follow one another in rank order, out on one side of the trail and back on the other", () => {
    forgetAntColonies();
    const c = antColony("asian-weaver-ant", "rainforest", 38, nest("n2"), 0.008, flat)!;
    // Halfway out for the first forager: the second, a gap behind, is on its way out too, nearer the nest.
    const way = c.length / c.spec.speed;
    assert.ok(c.gap < way / 2);
    const t = c.offset + 100 * c.period + way / 2;
    const first = antPose(c, "w0", 0, 0.008, t, always, flat);
    const second = antPose(c, "w1", 1, 0.008, t, always, flat);
    assert.equal(first.leg, "out");
    assert.equal(second.leg, "out");
    assert.ok(Math.hypot(first.x - c.nest.x, first.y - c.nest.y, first.z - c.nest.z) > Math.hypot(second.x - c.nest.x, second.y - c.nest.y, second.z - c.nest.z), "the second behind the first");
    // Out and back at the same point of the trail: on opposite sides of it.
    const back = antPose(c, "w0", 0, 0.008, c.offset + 100 * c.period + 2 * way + c.atFood * 1.2 - way / 2, always, flat);
    assert.equal(back.leg, "back");
    assert.ok(first.tx * back.tx + first.ty * back.ty + first.tz * back.tz < 0, "heading opposite ways");
});

test("ants: asleep the colony stays by the nest, and a loaded forager only carries on its way home", () => {
    forgetAntColonies();
    const c = antColony("red-imported-fire-ant", "farm_garden", 100, nest("n3"), 0.003, flat)!;
    for (let t = T0; t < T0 + 2 * c.period; t += 5) {
        const asleep = antPose(c, "f0", 0, 0.003, t, () => false, flat);
        assert.equal(asleep.leg, "nest");
        assert.ok(Math.hypot(asleep.x - c.nest.x, asleep.z - c.nest.z) < 0.05, "by the entrance");
        const awake = antPose(c, "f0", 0, 0.003, t, always, flat);
        if (awake.carrying) assert.equal(awake.leg, "back");
    }
});

test("ants: the trail keeps to walkable ground", () => {
    forgetAntColonies();
    // Only the half-plane x >= 10 is walkable (a wall, water or rock on the other side).
    const half: AntGround = {heightAt: () => 0, walkable: (x) => x >= 10};
    const c = antColony("carpenter-ant", "woodland", 42, nest("n4", {y: 0}), 0.02, half)!;
    assert.ok(c.path!.every((p) => p.x >= 10 - 1e-9 || Math.hypot(p.x - 10, p.z) <= 0.25), "never across into the blocked side");
});

test("ants: the Sahara desert ant searches out alone and runs straight home", () => {
    forgetAntColonies();
    const c = antColony("sahara-desert-ant", "desert", 33, nest("n5", {y: 0}), 0.0095, {heightAt: () => 0, walkable: always})!;
    assert.equal(c.path, null);
    let farthest = 0;
    let lastBack: {x: number; z: number} | null = null;
    let straight = true;
    for (let t = c.offset + c.period * 50; t < c.offset + c.period * 51; t += 0.5) {
        const p = antPose(c, "s0", 0, 0.0095, t, always, {heightAt: () => 0, walkable: always});
        farthest = Math.max(farthest, Math.hypot(p.x - c.nest.x, p.z - c.nest.z));
        if (p.leg === "back") {
            const d = Math.hypot(p.x - c.nest.x, p.z - c.nest.z);
            if (lastBack && d > Math.hypot(lastBack.x - c.nest.x, lastBack.z - c.nest.z) + 1e-6) straight = false;
            lastBack = p;
        }
    }
    assert.ok(farthest > 1, `it goes out a few metres (${farthest.toFixed(2)})`);
    assert.ok(straight, "home is a straight run: always nearer");
});
