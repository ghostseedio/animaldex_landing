import assert from "node:assert/strict";
import test from "node:test";
import {selectAim} from "@/ark-scene/selection";

/**
 * `ark:select` from the wide view (the film lane): the camera aims where the animal is drawn now, not at its snapshot
 * place, and the flight keeps aiming at it as it moves (`index.ts` select: `flight.aim` follows `selectAim`).
 */

test("the aim is the animal's drawn position, 0.4 of its height up, whatever its snapshot place", () => {
    // A Komodo dragon (drawn 0.6 m tall) walked 4.6 m from its place on its schedule: the aim is where it is drawn.
    const place = {x: 10, z: 20};
    const drawn = {x: place.x + 4.6, y: 3.2 + 0.3, z: place.z};
    const aim = selectAim(drawn, 0.6);
    assert.equal(aim.x, drawn.x);
    assert.equal(aim.z, drawn.z);
    assert.ok(Math.abs(aim.y - (3.2 + 0.6 * 0.4)) < 1e-9, `0.4 of its height over its feet: ${aim.y}`);
    assert.ok(Math.hypot(aim.x - place.x, aim.z - place.z) > 4.5, "not its snapshot place");
});

test("an animal at the sea's surface is aimed at 0.4 of its height over the water, never under it", () => {
    const aim = selectAim({x: 0, y: -0.2, z: 0}, 1.5);
    assert.ok(Math.abs(aim.y - 0.6) < 1e-9, `${aim.y}`);
});

test("as it moves, the aim moves with it (the flight follows each frame's aim)", () => {
    const path = [0, 1, 2, 3].map((k) => selectAim({x: k * 0.8, y: 1, z: -k * 0.3}, 1));
    for (let k = 1; k < path.length; k++) assert.ok(Math.hypot(path[k].x - path[k - 1].x, path[k].z - path[k - 1].z) > 0.8, "each frame's aim is the animal's own place then");
});
