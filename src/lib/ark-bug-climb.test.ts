import assert from "node:assert/strict";
import test from "node:test";
import {CLIMB_SECONDS, climbAt, climbPoint, climbStem, climbsBlades, mixClimb, type ClimbPoint} from "@/ark-scene/bug-climb";

const P = (): ClimbPoint => ({x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, ty: 0, tz: 1});

test("bug climb: only small ground arthropods climb, never a crustacean, a butterfly or a bug off the ground", () => {
    assert.equal(climbsBlades("carpenter-ant", "litter", "arthropod", 0.012), true);
    assert.equal(climbsBlades("cherry-shrimp", "litter", "arthropod", 0.03), false);
    assert.equal(climbsBlades("atlas-beetle", "litter", "arthropod", 0.11), false);
    assert.equal(climbsBlades("peacock", "litter", "butterfly", 0.03), false);
    assert.equal(climbsBlades("carpenter-ant", "bark", "arthropod", 0.012), false);
    // On a ground point of the map (where most ground bugs are placed), not on a rock or a log.
    assert.equal(climbsBlades("carpenter-ant", "attach", "arthropod", 0.012, "leaf_litter"), true);
    assert.equal(climbsBlades("carpenter-ant", "attach", "arthropod", 0.012, "rock_face"), false);
});

test("bug climb: a blade as tall as the ground grows there, none on ground with no blades or too short for it", () => {
    const home = {x: 1, y: 2, z: 3};
    const stem = climbStem("a", home, {surface: "meadow", height: 2, dry: 0}, 0.01)!;
    assert.ok(stem.height >= 0.07 && stem.height <= 0.26, String(stem.height));
    assert.equal(climbStem("a", home, null, 0.01), null);
    assert.equal(climbStem("a", home, {surface: "lawn", height: 2, dry: 0}, 0.03), null, "a lawn's short blades do not take a 3 cm beetle");
});

test("bug climb: pure in its id and the clock, continuous, a 12 s climb now and then (up, turn at the top, down)", () => {
    assert.deepEqual(climbAt("x", 1234.5), climbAt("x", 1234.5));
    let climbing = 0;
    let topped = false;
    let last = climbAt("x", 0);
    for (let t = 0; t < 600; t += 0.05) {
        const now = climbAt("x", t);
        assert.ok(Math.abs(now.on - last.on) < 0.1 && Math.abs(now.up - last.up) < 0.1 && Math.abs(now.turn - last.turn) < 0.1, `jump at ${t}`);
        if (now.on > 0) climbing += 0.05;
        if (now.up === 1) topped = true;
        // Head up going up, head down coming down.
        if (now.up > 0 && now.up < 1 && now.turn > 0 && now.turn < 1) assert.fail(`turning mid-blade at ${t}`);
        last = now;
    }
    assert.ok(topped);
    const share = climbing / 600;
    assert.ok(share > CLIMB_SECONDS / 70 && share < CLIMB_SECONDS / 30, `climbing ${(share * 100).toFixed(1)}% of the time`);
});

test("bug climb: on the blade it is on the blade's face, its back out, heading along the blade; mixed frames stay orthonormal", () => {
    const stem = climbStem("b", {x: 0, y: 0, z: 0}, {surface: "meadow", height: 0, dry: 0}, 0.01)!;
    const p = climbPoint(stem, 1, 0, P());
    assert.ok(p.y > 0.5 * stem.height && p.y < stem.height, String(p.y));
    assert.ok(Math.abs(p.ny) < 1e-9 && Math.abs(p.ty - 1) < 1e-9);
    const down = climbPoint(stem, 0.5, 1, P());
    assert.ok(Math.abs(down.ty + 1) < 1e-9);
    for (let k = 0; k <= 1; k += 0.1) {
        const m = mixClimb(P(), climbPoint(stem, 0, 0, P()), k, P());
        assert.ok(Math.abs(Math.hypot(m.nx, m.ny, m.nz) - 1) < 1e-6 && Math.abs(Math.hypot(m.tx, m.ty, m.tz) - 1) < 1e-6);
        assert.ok(Math.abs(m.nx * m.tx + m.ny * m.ty + m.nz * m.tz) < 1e-6);
    }
});
